import { defineConfig } from '@playwright/test';

// UI render sweep config. Boots the console dev server and drives a real Chromium
// over the public pages and, signed in, the operator pages, asserting each renders
// with no uncaught error. No em-dashes.
export default defineConfig({
  testDir: './playwright',
  globalSetup: './playwright/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3400', headless: true, navigationTimeout: 45_000 },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3400/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
