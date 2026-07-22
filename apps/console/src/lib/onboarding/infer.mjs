// Aza onboarding inference. Pure and deterministic: a free-text business
// description maps to a set of capability keys, dependencies resolved, so the
// chat path and the click path (CapabilityPicker) provision the SAME graph.
// Written as plain ESM so a node self-test imports the exact code the console
// runs. No LLM, no network, no clock. An LLM can later widen the keyword sets
// without changing this contract. Mirrors the seed in 0003_capabilities.sql.
// No em-dashes.

// capability_key -> its hard prerequisite (from capability_catalog.requires_capability_key)
export const REQUIRES = {
  'rail.cites': 'commodity.timber',
  financing: 'settlement',
};

// Any commodity pulls in the EUDR rail: EUDR applies to both cocoa and timber
// (default_for_vertical {cocoa,timber} in the seed).
const COMMODITY_KEYS = ['commodity.cocoa', 'commodity.timber', 'commodity.other'];

// Ordered so the most specific signal wins the phrasing. Each entry: the
// capability it votes for and the words (lowercased, French + English + the
// vernacular exporters actually use) that vote for it.
const SIGNALS = [
  { key: 'commodity.cocoa', words: ['cocoa', 'cacao', 'coco', 'feves', 'beans', 'ndumbe'] },
  { key: 'commodity.timber', words: ['timber', 'wood', 'bois', 'log', 'logs', 'lumber', 'sawn', 'sciage', 'grume', 'ayous', 'sapelli', 'okoume', 'iroko', 'bubinga'] },
  { key: 'rail.cites', words: ['cites', 'species', 'espece', 'especes', 'protected', 'protege', 'endangered', 'quota', 'permit', 'permis', 'regulated', 'reglemente'] },
  { key: 'rail.eudr', words: ['eudr', 'deforestation', 'due diligence', 'diligence', 'dds', 'traceability', 'tracabilite', 'geolocation', 'geolocalisation', 'compliance', 'conformite'] },
  { key: 'field_capture', words: ['field', 'terrain', 'offline', 'hors ligne', 'photo', 'gps', 'farmer', 'planteur', 'agriculteur', 'capture', 'plot', 'plots', 'parcelle', 'parcelles', 'polygon', 'village'] },
  { key: 'settlement', words: ['settlement', 'reglement', 'payment', 'paiement', 'beac', 'repatriation', 'rapatriement', 'invoice', 'facture', 'letter of credit', 'lettre de credit', 'lc', 'buyer', 'acheteur', 'export'] },
  { key: 'financing', words: ['financing', 'finance', 'financement', 'loan', 'pret', 'credit', 'warehouse receipt', 'recepisse', 'cash', 'tresorerie', 'working capital', 'prefinance', 'prefinancement', 'advance', 'avance'] },
  { key: 'groups', words: ['group', 'groupe', 'cooperative', 'coop', 'holding', 'union', 'federation', 'gic', 'cig'] },
];

function norm(s) {
  // Lowercase and fold the common French accents so "espèce" matches "espece".
  return String(s || '').toLowerCase()
    .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ûü]/g, 'u')
    .replace(/ç/g, 'c');
}

// Resolve prerequisites transitively, so enabling rail.cites also enables
// commodity.timber, and financing also enables settlement.
export function withDependencies(keys) {
  const out = new Set(keys);
  let grew = true;
  while (grew) {
    grew = false;
    for (const k of Array.from(out)) {
      const req = REQUIRES[k];
      if (req && !out.has(req)) { out.add(req); grew = true; }
    }
  }
  return out;
}

// The contract. Returns the capability keys to enable and a short reason per
// key (what in the text triggered it), for the confirmation Aza shows back.
export function inferCapabilities(description) {
  const text = ' ' + norm(description) + ' ';
  const hits = new Map(); // key -> matched word

  for (const sig of SIGNALS) {
    const found = sig.words.find((w) => text.includes(' ' + norm(w)) || text.includes(norm(w)));
    if (found) hits.set(sig.key, found);
  }

  // Any commodity implies the EUDR rail even if EUDR was never named.
  if (COMMODITY_KEYS.some((c) => hits.has(c)) && !hits.has('rail.eudr')) {
    hits.set('rail.eudr', 'commodity');
  }

  const resolved = withDependencies(hits.keys());
  const reasons = [];
  for (const key of resolved) {
    reasons.push({ key, matched: hits.get(key) ?? 'required by ' + [...resolved].find((k) => REQUIRES[k] === key && hits.has(k)) });
  }
  return { keys: [...resolved], reasons };
}
