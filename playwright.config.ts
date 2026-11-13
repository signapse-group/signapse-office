import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT) || 4399;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: process.env.E2E_OUT || 'test-results',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  expect: { timeout: 30_000 },
  use: { baseURL, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `${baseURL}/health`,
    env: { NODE_ENV: 'production', OFFICE_HOST: '127.0.0.1', OFFICE_PORT: String(port), OFFICE_LANG: 'en' },
    timeout: 60_000,
  },
});
