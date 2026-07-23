#!/usr/bin/env node
// run-e2e: the critical-path gate in one command. Runs the critical-path spec in a
// real browser (against PLAYWRIGHT_BASE_URL if set, else the local dev server), then
// e2e-cleanup --check to prove the environment is left clean. A real failure or a
// missing browser BLOCKS; only an unreachable target soft-skips. No em-dashes.
// Run: node scripts/run-e2e.mjs   (or PLAYWRIGHT_BASE_URL=https://... node scripts/run-e2e.mjs)
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const consoleDir = resolve(root, 'apps/console');
const win = process.platform === 'win32';

const test = spawnSync('npx', ['playwright', 'test', 'critical-path.spec.ts'], { cwd: consoleDir, stdio: 'inherit', shell: win });
// Always attempt cleanup, even on failure, then prove clean.
const clean = spawnSync('node', ['scripts/e2e-cleanup.mjs', '--check'], { cwd: root, stdio: 'inherit', shell: win });

if (test.status !== 0) { console.error('run-e2e: critical path FAILED'); process.exit(test.status ?? 1); }
if (clean.status !== 0) { console.error('run-e2e: environment not left clean'); process.exit(1); }
console.log('run-e2e: critical path green and clean');
