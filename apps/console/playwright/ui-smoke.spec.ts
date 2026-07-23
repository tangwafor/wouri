import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The UI render sweep: every key page loads and renders with no uncaught error.
// Public pages unauthenticated; operator pages after a real login. No em-dashes.
const creds = JSON.parse(readFileSync(resolve(__dirname, '.auth.json'), 'utf8'));

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('public pages render with no uncaught error', async ({ page }) => {
  const errors = trackErrors(page);
  for (const path of ['/login', '/signup', '/forgot']) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBeLessThan(400);
    await expect(page.locator('h1')).toBeVisible();
  }
  // A verification code that does not exist renders the not-found state, not a crash.
  await page.goto('/v/NONEXISTENT-CODE-000');
  await expect(page.locator('body')).toBeVisible();
  expect(errors, errors.join(' | ')).toHaveLength(0);
});

test('operator pages render after login', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await Promise.all([
    page.waitForURL(/\/(home|onboarding)/, { timeout: 40_000 }),
    page.locator('button[type="submit"]').first().click(),
  ]);
  for (const path of ['/home', '/lots', '/consignments', '/cockpit', '/board', '/inbox']) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBeLessThan(400);
    await expect(page.locator('nav')).toBeVisible();
  }
  expect(errors, errors.join(' | ')).toHaveLength(0);
});
