#!/usr/bin/env node
// onboarding-infer-selftest: proves Aza's chat-onboarding inference maps real
// business descriptions to the right capability set, with dependencies resolved,
// so the chat path provisions the same graph the click path would. Runs offline,
// no DB, no browser: the piece of the onboarding we CAN verify on this machine.
// No em-dashes. Run: node scripts/onboarding-infer-selftest.mjs
import { inferCapabilities } from '../apps/console/src/lib/onboarding/infer.mjs';

let pass = 0, fail = 0;
const set = (a) => new Set(a);
const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// name, description, expected capability keys (exact set after dependency resolution)
const CASES = [
  ['cocoa exporter, plain',
    'We are a cocoa exporter in Douala shipping to the EU.',
    ['commodity.cocoa', 'rail.eudr', 'settlement']],
  ['cocoa, EUDR named, no settlement signal',
    'Cooperative de cacao qui doit preparer la diligence raisonnee EUDR.',
    ['commodity.cocoa', 'rail.eudr', 'groups']],
  ['timber pulls EUDR even unnamed; export -> settlement',
    'We export sawn timber and logs.',
    ['commodity.timber', 'rail.eudr', 'settlement']],
  ['CITES implies timber (dependency), no settlement signal',
    'We handle CITES permits and species quota for protected wood.',
    ['rail.cites', 'commodity.timber', 'rail.eudr']],
  ['financing implies settlement (dependency)',
    'We are a cocoa buyer needing prefinancing and warehouse receipts.',
    ['commodity.cocoa', 'rail.eudr', 'financing', 'settlement']],
  ['coffee exporter pulls EUDR',
    'We export robusta coffee from the West region to the EU.',
    ['commodity.coffee', 'rail.eudr', 'settlement']],
  ['palm oil pulls EUDR; export -> settlement',
    'Nous exportons de l huile de palme.',
    ['commodity.palm_oil', 'rail.eudr', 'settlement']],
  ['rubber pulls EUDR; export -> settlement',
    'We export natural rubber (latex).',
    ['commodity.rubber', 'rail.eudr', 'settlement']],
  ['cotton is outside EUDR (no rail); export -> settlement',
    'We export cotton to buyers abroad.',
    ['commodity.cotton', 'settlement']],
  ['banana is outside EUDR; export -> settlement',
    'Nous exportons des bananes.',
    ['commodity.banana', 'settlement']],
  ['field capture + farmers',
    'We register planteurs in the village with GPS plots offline.',
    ['field_capture']],
  ['full stack timber house',
    'Timber exporter: CITES species, EUDR plots captured in the field, settlement with BEAC and financing.',
    ['commodity.timber', 'rail.cites', 'rail.eudr', 'field_capture', 'settlement', 'financing']],
  ['empty description yields nothing',
    '   ',
    []],
  ['unrelated text yields nothing',
    'We run a taxi company.',
    []],
];

for (const [name, desc, expected] of CASES) {
  const { keys } = inferCapabilities(desc);
  const got = set(keys), want = set(expected);
  if (eq(got, want)) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n        want: ' + [...want].sort().join(', ') + '\n        got:  ' + [...got].sort().join(', ')); }
}

// Invariant: every returned set is closed under dependencies (no orphan cites/financing).
for (const [name, desc] of CASES) {
  const keys = new Set(inferCapabilities(desc).keys);
  const REQ = { 'rail.cites': 'commodity.timber', financing: 'settlement' };
  for (const [dep, req] of Object.entries(REQ)) {
    if (keys.has(dep) && !keys.has(req)) { fail++; console.log('  FAIL dependency-closure ' + name + ': ' + dep + ' without ' + req); }
  }
}

console.log('\nonboarding-infer-selftest: ' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
