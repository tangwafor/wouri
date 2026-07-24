#!/usr/bin/env node
// preflight: the BLOCKING gate that runs before every push/deploy. Each step is hard
// and fail-fast. This is what makes the guards actually guard: canonicals, RLS
// coverage, the security surface, concurrency, and the critical-path e2e in a real
// browser. Per the canonical critical-path rule, a real failure or a missing browser
// BLOCKS; only a genuinely unreachable target soft-skips (set PREFLIGHT_SKIP_E2E=1 to
// skip the browser step deliberately, e.g. a headless CI without a browser). No em-dashes.
// Run: node scripts/preflight.mjs
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
let failed = 0;

function step(name, cmd, args, opts = {}) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const r = spawnSync(cmd, args, { cwd: opts.cwd || root, stdio: 'inherit', shell: win });
  if (r.status !== 0) {
    if (opts.soft) { console.warn(`SOFT-SKIP: ${name} (${opts.soft})`); return; }
    console.error(`BLOCKED: ${name} failed`);
    failed++;
  }
}

step('canonicals', 'node', ['scripts/check-canonicals.mjs']);
if (failed) finish();
step('rls coverage', 'node', ['scripts/rls-coverage.mjs']);
step('security surface', 'node', ['scripts/security-check.mjs']);
step('stress (concurrency invariants)', 'node', ['scripts/stress-test.mjs']);

if (process.env.PREFLIGHT_SKIP_E2E === '1') {
  console.warn('\nSOFT-SKIP: critical-path e2e (PREFLIGHT_SKIP_E2E=1)');
} else {
  step('critical path (browser)', 'node', ['scripts/run-e2e.mjs']);
}

finish();

function finish() {
  if (failed > 0) { console.error(`\npreflight: ${failed} hard failure(s). Push BLOCKED.`); process.exit(1); }
  console.log('\npreflight: all gates green. Clear to push.');
  process.exit(0);
}
