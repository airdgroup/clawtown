import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  const baseUrl = (arg('--baseUrl') || process.env.CT_SMOKE_BASE_URL || 'https://clawtown.io').replace(/\/+$/, '');
  const outDir = arg('--outDir') || process.env.CT_SMOKE_OUT_DIR || 'output/playwright';
  const headed = Boolean(arg('--headed'));

  const health = await fetch(`${baseUrl}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Health check failed: ${baseUrl}/api/health`);
    process.exit(2);
  }

  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: !headed });
  const device = devices['iPhone 14'] || { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__ct?.state?.world), null, { timeout: 15_000 });

  const canvas = page.locator('#game');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });

  const nonTransparent = await canvas.evaluate((c) => {
    const canvas = c;
    const g = canvas.getContext('2d');
    if (!g) return 0;
    const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 900) {
      if (data[i] > 10) n++;
      if (n > 40) break;
    }
    return n;
  });

  const out = path.join(outDir, `smoke-mobile-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await canvas.screenshot({ path: out });

  await ctx.close();
  await browser.close();

  console.log(JSON.stringify({ ok: true, baseUrl, nonTransparent, screenshot: out }));
  if (nonTransparent < 20) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

