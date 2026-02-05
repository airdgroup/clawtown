#!/usr/bin/env node
/* eslint-disable no-console */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = { joinToken: "", pollMs: 1200, runForMs: 0, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!out.joinToken && typeof a === "string" && a.startsWith("CT1|") && a.includes("|")) out.joinToken = a;
    else if (a === "--pollMs") out.pollMs = Number(argv[++i] || 0);
    else if (a === "--runForMs") out.runForMs = Number(argv[++i] || 0);
    else if (a === "--verbose") out.verbose = true;
  }
  return out;
}

function parseJoinToken(joinToken) {
  const raw = String(joinToken || "").trim();
  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const version = parts[0].trim();
  const baseUrl = parts[1].trim().replace(/\/+$/, "");
  const joinCode = parts[2].trim();
  if (version !== "CT1" || !baseUrl || !joinCode) return null;
  return { raw, baseUrl, joinCode };
}

async function apiJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
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

function nearestAliveMonster(you, monsters) {
  const list = Array.isArray(monsters) ? monsters : [];
  if (!you) return null;
  let best = null;
  let bestD2 = Infinity;
  for (const m of list) {
    if (!m || m.alive === false) continue;
    const dx = Number(m.x || 0) - Number(you.x || 0);
    const dy = Number(m.y || 0) - Number(you.y || 0);
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = m;
    }
  }
  return best ? { m: best, d2: bestD2 } : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const parsed = parseJoinToken(args.joinToken);
  if (!parsed) {
    console.error('Usage: node examples/node-agent/bot.mjs "CT1|<baseUrl>|<joinCode>" [--runForMs 60000] [--pollMs 1200] [--verbose]');
    process.exit(2);
  }

  const pollMs = Math.max(500, Math.floor(Number(args.pollMs) || 1200));
  const runForMs = Math.max(0, Math.floor(Number(args.runForMs) || 0));
  const verbose = Boolean(args.verbose);

  const baseUrl = parsed.baseUrl;
  const linked = await apiJson(`${baseUrl}/api/bot/link`, { method: "POST", body: { joinToken: parsed.raw } });
  if (!linked.ok || !linked.data?.ok || !linked.data?.botToken) {
    console.error("link failed", linked.status, linked.data);
    process.exit(2);
  }
  const botToken = String(linked.data.botToken);
  const headers = { Authorization: `Bearer ${botToken}` };

  const mode = await apiJson(`${baseUrl}/api/bot/mode`, { method: "POST", headers, body: { mode: "agent" } });
  if (!mode.ok || !mode.data?.ok) {
    console.error("mode failed", mode.status, mode.data);
    process.exit(2);
  }

  console.log(`Connected. baseUrl=${baseUrl} playerId=${linked.data.playerId || ""}`);
  console.log("Loop: world → goal/cast. Ctrl+C to stop.");

  const started = Date.now();
  let lastCastAt = 0;
  let lastGoalAt = 0;
  let lastThoughtAt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (runForMs > 0 && Date.now() - started > runForMs) break;

    const w = await apiJson(`${baseUrl}/api/bot/world`, { headers });
    if (!w.ok || !w.data?.ok) {
      if (verbose) console.log("world error", w.status, w.data);
      await sleep(pollMs);
      continue;
    }

    const snap = w.data.snapshot || {};
    const you = snap.you || null;
    const nearest = nearestAliveMonster(you, snap.monsters || []);
    const now = Date.now();

    if (nearest && you) {
      const hitRange = 140;
      if (nearest.d2 <= hitRange * hitRange) {
        if (now - lastCastAt > 850) {
          lastCastAt = now;
          const r = await apiJson(`${baseUrl}/api/bot/cast`, { method: "POST", headers, body: { spell: "signature" } });
          if (verbose) console.log("cast", r.status, r.data?.ok ? "ok" : r.data);
        }
      } else if (now - lastGoalAt > 1200) {
        lastGoalAt = now;
        const r = await apiJson(`${baseUrl}/api/bot/goal`, {
          method: "POST",
          headers,
          body: { x: Number(nearest.m.x || 0), y: Number(nearest.m.y || 0) },
        });
        if (verbose) console.log("goal", r.status, r.data?.ok ? "ok" : r.data);
      }
    }

    // Keep it lightweight: a thought bubble every ~8s (no public chat spam).
    if (now - lastThoughtAt > 8000) {
      lastThoughtAt = now;
      const r = await apiJson(`${baseUrl}/api/bot/thought`, { method: "POST", headers, body: { text: "Auto-grinding… (tiny agent)" } });
      if (verbose) console.log("thought", r.status, r.data?.ok ? "ok" : r.data);
    }

    await sleep(pollMs);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
