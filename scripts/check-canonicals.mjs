#!/usr/bin/env node
// check-canonicals.mjs: the Wouri build gate. Enforces the laws in CLAUDE.md that
// can be checked statically over the source. Dependency-free (Node built-ins only)
// so it runs before any package is installed. Exit non-zero on a hard failure.
//
//   node scripts/check-canonicals.mjs
//
// Hard failures (block the build): em-dashes anywhere; a regulatory literal in
//   logic (a rule that belongs in the registry as a row, not a literal in a view,
//   function, or branch). Seed `insert` statements in migrations are exempt: that
//   is the registry data itself. A single line may opt out with a trailing
//   `-- canon:allow-literal <reason>` when the number is genuinely structural.
// Warnings (surface, do not block): a hardcoded vertical/commodity branch instead
//   of a capability lookup.
// The RLS-on-every-table and anon-surface coverage gate is a separate script,
// rls-coverage.mjs, run against the database in the self-test.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|sql)$/;
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|sql|md|json|html|css)$/;

function tracked() {
  try {
    return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    console.error('check-canonicals: not a git repo or git unavailable.');
    process.exit(2);
  }
}

const files = tracked();
let hardFailures = 0;
let warnings = 0;

// Law: no em-dashes. Covers the em-dash (U+2014) and the en-dash (U+2013) used as
// a dash. Built from escapes so this gate file contains no literal dash to self-flag.
const EM_DASH = new RegExp('[\\u2014\\u2013]');
for (const f of files) {
  if (!TEXT_EXT.test(f)) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (EM_DASH.test(line)) {
      hardFailures++;
      console.error(`FAIL em-dash  ${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}

// Hard failure: a regulatory literal in logic. A numeric literal on a line that
// also names a regulatory concept is a rule that belongs in the registry as a row.
// Stems, no trailing boundary, so "repatriation_days" and "thresholds" match.
const REG_WORD = /(dut(y|ies)|tariff|levy|levies|rate_bps|threshold|deadline|quota|repatriat|diameter|aflatoxin|moisture|ppm|ppb|percent|surrender|valid_for|expiry|days_to|tolerance|_days\b|window)/i;
const NUM = /(\b\d{2,}\b|\b\d+\.\d+\b)/; // a 2+ digit integer or any decimal
for (const f of files) {
  if (!CODE_EXT.test(f)) continue;
  // Gates and tests may carry expected values.
  if (f.startsWith('scripts/') || f.includes('test')) continue;
  // The bundled KB data module is registry data, like the seed rows below.
  if (f.endsWith('kb.mjs')) continue;
  const isMigration = f.includes('supabase/migrations/');
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  let inInsert = false;
  text.split('\n').forEach((line, i) => {
    // In a migration, a seed `insert into ... values (...)` IS the registry data,
    // so exempt those lines; view and function bodies are still scanned.
    if (isMigration) {
      if (/insert\s+into/i.test(line)) inInsert = true;
      const wasInsert = inInsert;
      if (/;\s*$/.test(line)) inInsert = false;
      if (wasInsert) return;
    }
    const l = line.replace(/--.*/, '').replace(/\/\/.*/, ''); // ignore comments
    if (/canon:allow-literal/.test(line)) return;             // explicit, justified opt-out
    if (REG_WORD.test(l) && NUM.test(l)) {
      hardFailures++;
      console.error(`FAIL regulatory-literal (registry-back it, or mark canon:allow-literal)  ${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}

// Warning: a hardcoded vertical/commodity branch instead of a capability lookup.
const HARDCODED_VERTICAL = /\b(vertical|commodity|storefront_type)\s*===?\s*['"]/;
for (const f of files) {
  if (!CODE_EXT.test(f)) continue;
  if (f.startsWith('scripts/')) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    if (HARDCODED_VERTICAL.test(line)) {
      warnings++;
      console.warn(`WARN hardcoded-vertical (use hasCapability)  ${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}

console.log(`\ncheck-canonicals: ${files.length} files, ${hardFailures} hard failure(s), ${warnings} warning(s).`);
if (hardFailures > 0) {
  console.error('BLOCKED: fix the hard failures above (no em-dashes; no regulatory literals in logic).');
  process.exit(1);
}
process.exit(0);
