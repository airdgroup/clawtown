import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url, timeoutMs = 15000) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - started > timeoutMs) throw new Error(`timeout waiting for ${url}`);
    await sleep(150);
  }
}

const PORT = Number(process.env.PORT || 3120);
const baseURL = `http://127.0.0.1:${PORT}`;

const server = spawn('node', ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), CT_TEST: '1' },
  stdio: 'inherit',
});

try {
  await waitForHealth(`${baseURL}/api/health`);

  // Reset to ensure level/kill counters start fresh.
  await fetch(`${baseURL}/api/debug/reset`, { method: 'POST' });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone-ish portrait

  await page.goto(`${baseURL}/?coach=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);

  // Close onboarding modal if present.
  const modal = page.locator('#onboarding');
  if (await modal.isVisible().catch(() => false)) {
    await page.locator('#onboardingStart').click();
  }

  // English copy for the screenshot.
  await page.locator('#langEn').click();

  // Move a bit to reach "attack" step (and make it feel like gameplay).
  await page.locator('#game').click({ position: { x: 140, y: 160 } });
  await page.waitForTimeout(350);

  // Get playerId + coords to spawn a 1HP slime.
  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  if (!playerId) throw new Error('missing playerId');

  const pos = await page.waitForFunction(() => {
    const you = globalThis.__ct?.you;
    if (!you) return null;
    if (typeof you.x !== 'number' || typeof you.y !== 'number') return null;
    return { x: you.x, y: you.y };
  });
  const { x, y } = await pos.jsonValue();

  await fetch(`${baseURL}/api/debug/spawn-monster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, kind: 'slime', name: 'Poring', maxHp: 1, hp: 1 }),
  });

  // Attack (slot 4).
  await page.locator('#slot4').click();

  // Wait for the toast to show (this is the “celebration” moment).
  const bubble = page.locator('.ct-coach-bubble');
  await bubble.waitFor({ state: 'visible', timeout: 6000 });
  await bubble.waitFor({ state: 'visible' });

  const outDir = path.resolve('test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'celebration-iphone-portrait.png');

  // Capture just the stage (map + overlays), not the whole right panel.
  await page.locator('#stage').screenshot({ path: outPath });
  console.log(`Wrote screenshot: ${outPath}`);

  await browser.close();
} finally {
  try {
    server.kill('SIGTERM');
  } catch {
    // ignore
  }
}

