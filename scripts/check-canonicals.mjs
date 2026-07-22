#!/usr/bin/env node
// check-canonicals.mjs: the Wouri build gate. Enforces the laws in CLAUDE.md that
// can be checked statically over the source. Dependency-free (Node built-ins only)
// so it runs before any package is installed. Exit non-zero on a hard failure.
//
//   node scripts/check-canonicals.mjs
//
// Hard failures (block the build): em-dashes anywhere.
// Warnings (surface, do not block yet): regulatory literal near a regulatory word
//   in code; a hardcoded vertical/commodity branch instead of a capability lookup.
// The RLS-on-every-table and anon-surface checks run against the database in the
// self-test, not here (this script is source-only).

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

// Warning: a regulatory literal in code. A numeric literal on a line that also
// names a regulatory concept is probably a rule that belongs in the registry.
const REG_WORD = /\b(duty|tariff|levy|rate_bps|threshold|deadline|quota|repatriat|min_diameter|minimum.?diameter|aflatoxin|moisture|ppm|ppb|percent|surrender|valid_for|expiry_days|days_to)\b/i;
const NUM = /\b\d{2,}\b/; // 2+ digit literal; single digits are usually structural
for (const f of files) {
  if (!CODE_EXT.test(f)) continue;
  if (f.startsWith('scripts/') || f.includes('test')) continue; // gates and tests may carry expected values
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    const l = line.replace(/\/\/.*/, ''); // ignore comments
    if (REG_WORD.test(l) && NUM.test(l)) {
      warnings++;
      console.warn(`WARN regulatory-literal  ${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
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
  console.error('BLOCKED: fix the hard failures above (no em-dashes).');
  process.exit(1);
}
process.exit(0);
