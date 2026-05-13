import { defineConfig } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

// Load .env.local so DATABASE_URL and other env vars are available in tests
dotenvConfig({ path: '.env.local' });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', headless: true },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
