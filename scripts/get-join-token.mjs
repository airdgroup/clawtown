import { chromium } from '@playwright/test';

const baseUrl = process.env.CLAWTOWN_URL || 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  const onboarding = page.locator('#onboarding');
  if (await onboarding.isVisible().catch(() => false)) {
    await page.locator('#onboardingStart').click();
  }

  await page.locator('.ui-tab[data-tab="link"]').click();
  await page.locator('#makeJoinCode').click();

  await page.locator('#joinToken').waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('#joinToken');
    return el && el.value && el.value.includes('|');
  });

  const joinToken = await page.locator('#joinToken').inputValue();
  const joinCode = joinToken.split('|')[2] || (await page.locator('#joinCode').textContent())?.trim() || '';
  const sandboxJoinToken = await page.locator('#sandboxJoinToken').inputValue();
  const botPrompt = await page.locator('#botPrompt').inputValue().catch(() => '');

  console.log(JSON.stringify({ joinCode, joinToken, sandboxJoinToken }, null, 2));
  if (botPrompt) {
    console.log('\n--- bot prompt (recommended) ---\n');
    console.log(botPrompt);
  }

  await browser.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
