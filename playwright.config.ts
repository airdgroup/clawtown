import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1365, height: 820 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.js',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3100',
      CT_TEST: '1',
    },
  },
});
