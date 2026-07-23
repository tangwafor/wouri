import { defineConfig } from '@playwright/test';

// UI render + critical-path config. Boots the console dev server unless a live target
// is given via PLAYWRIGHT_BASE_URL, and drives a real Chromium. No em-dashes.
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3400';
const local = BASE.includes('localhost') || BASE.includes('127.0.0.1');

export default defineConfig({
  testDir: './playwright',
  globalSetup: './playwright/global-setup.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: BASE, headless: true, navigationTimeout: 45_000 },
  webServer: local
    ? { command: 'npm run dev', url: 'http://localhost:3400/login', reuseExistingServer: true, timeout: 180_000 }
    : undefined,
});
