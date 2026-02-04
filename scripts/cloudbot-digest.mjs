#!/usr/bin/env node
/* eslint-disable no-console */

// Clawtown bot "pet updates" digest:
// - Link via join token (no CLI)
// - Poll /api/bot/events with cursor
// - Print a compact digest to stdout
// - Optionally download /api/bot/map.png for chat-app screenshots
//
// Usage:
//   node ./scripts/cloudbot-digest.mjs 'CT1|https://clawtown.io|ABC123'
//   node ./scripts/cloudbot-digest.mjs 'CT1|http://localhost:3000|ABC123' --pollMs 5000 --runForMs 60000
//   node ./scripts/cloudbot-digest.mjs 'CT1|...' --mapEveryMs 60000 --outDir /tmp/clawtown

import fs from 'node:fs';
import path from 'node:path';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = { joinToken: '', pollMs: 5000, runForMs: 0, limit: 20, outDir: '', mapEveryMs: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!out.joinToken && a.includes('|') && a.startsWith('CT1|')) out.joinToken = a;
    else if (a === '--pollMs') out.pollMs = Number(argv[++i] || 0);
    else if (a === '--runForMs') out.runForMs = Number(argv[++i] || 0);
    else if (a === '--limit') out.limit = Number(argv[++i] || 0);
    else if (a === '--outDir') out.outDir = String(argv[++i] || '');
    else if (a === '--mapEveryMs') out.mapEveryMs = Number(argv[++i] || 0);
  }
  return out;
}

function parseJoinToken(joinToken) {
  const raw = String(joinToken || '').trim();
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  const version = parts[0].trim();
  const baseUrl = parts[1].trim().replace(/\/+$/, '');
  const joinCode = parts[2].trim();
  if (version !== 'CT1' || !baseUrl || !joinCode) return null;
  return { raw, baseUrl, joinCode };
}

async function apiJson(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function download(url, outPath, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

function prettyEvent(e) {
  const kind = String(e.kind || 'info');
  const text = String(e.text || '').trim();
  const when = e.at ? new Date(Number(e.at)).toLocaleTimeString() : '';
  const bang = e.important ? '!' : '';
  return `${when} [${kind}${bang}] ${text}`.trim();
}

async function main() {
  const args = parseArgs(process.argv);
  const parsed = parseJoinToken(args.joinToken);
  if (!parsed) {
    console.error('Usage: node ./scripts/cloudbot-digest.mjs \"CT1|<baseUrl>|<joinCode>\"');
    process.exit(2);
  }

  const baseUrl = parsed.baseUrl;
  const outDir = String(args.outDir || '').trim();
  const pollMs = Math.max(1200, Math.floor(Number(args.pollMs) || 5000));
  const runForMs = Math.max(0, Math.floor(Number(args.runForMs) || 0));
  const limit = Math.max(1, Math.min(60, Math.floor(Number(args.limit) || 20)));
  const mapEveryMs = Math.max(0, Math.floor(Number(args.mapEveryMs) || 0));

  const link = await apiJson(`${baseUrl}/api/bot/link`, { method: 'POST', body: { joinToken: parsed.raw } });
  if (!link.ok || !link.data?.ok || !link.data?.botToken) {
    console.error('link failed', link.status, link.data);
    process.exit(2);
  }
  const botToken = String(link.data.botToken);

  // Optional: show status once at start.
  const status = await apiJson(`${baseUrl}/api/bot/status`, { headers: { Authorization: `Bearer ${botToken}` } });
  if (status.ok && status.data?.ok) {
    const you = status.data.you || status.data.you || {};
    console.log(`Connected: baseUrl=${baseUrl} playerId=${you.id || link.data.playerId || ''} level=${you.level ?? ''} kills=${you.meta?.kills ?? ''}`);
  } else {
    console.log(`Connected: baseUrl=${baseUrl} playerId=${link.data.playerId || ''}`);
  }

  let cursor = 0;
  let lastMapAt = 0;
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await apiJson(`${baseUrl}/api/bot/events?cursor=${cursor}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    if (r.ok && r.data?.ok) {
      const events = Array.isArray(r.data.events) ? r.data.events : [];
      for (const e of events) {
        console.log(prettyEvent(e));
      }
      cursor = Math.max(cursor, Number(r.data.nextCursor || cursor) || cursor);

      // Download a fresh map screenshot on important events (or on a timer).
      const now = Date.now();
      const sawImportant = events.some((e) => e && e.important);
      const shouldMap = outDir && (sawImportant || (mapEveryMs > 0 && now - lastMapAt >= mapEveryMs));
      if (shouldMap) {
        const outPath = path.join(outDir, `map_${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
        const bytes = await download(`${baseUrl}/api/bot/map.png`, outPath, { Authorization: `Bearer ${botToken}` });
        lastMapAt = now;
        console.log(`(saved map.png ${Math.round(bytes / 1024)}KB -> ${outPath})`);
      }
    } else {
      console.error('events failed', r.status, r.data);
    }

    if (runForMs > 0 && Date.now() - started > runForMs) break;
    await sleep(pollMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

