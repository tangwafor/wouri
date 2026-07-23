#!/usr/bin/env node
// ui-qa-sweep: the mandatory UI render sweep (TaTech point 6c). Drives a real
// Chromium over the console's public and operator pages and asserts each renders
// with no uncaught error. Thin runner over the Playwright suite in apps/console so
// it sits alongside the other gates. Requires the browser (npx playwright install
// chromium) and the Supabase env. No em-dashes.
// Run: node scripts/ui-qa-sweep.mjs
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const console_dir = resolve(root, 'apps/console');
const r = spawnSync('npx', ['playwright', 'test'], { cwd: console_dir, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
