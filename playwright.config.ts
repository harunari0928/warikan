import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5184',
    trace: 'on-first-retry',
    viewport: { width: 412, height: 915 },
  },
  webServer: [
    {
      command: 'DB_PATH=data/test_warikan.db PORT=3121 npx tsx packages/web/src/server/index.ts',
      url: 'http://localhost:3121/api/users',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'cd packages/web && API_PORT=3121 npx vite --port 5184 --strictPort',
      url: 'http://localhost:5184',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
