// Aza's knowledge base: a rich, BUNDLED, offline knowledge base. Everything Aza
// needs to guide a Cameroon exporter lives here as plain data, so Aza works with
// zero external API. If any API is down, this still answers. It is also mirrored
// into the aza_kb table (migration 0016) so an owner can edit it and it stays
// current; this module is the offline floor. Fast-moving facts carry a
// review_by date and a source, so nothing silently goes stale. No em-dashes.

export const KB_META = {
  version: 'kb-2026-07',
  updated: '2026-07-23',
  note: 'Bundled offline knowledge base. No external API. Reconcile fast-moving facts on the review cadence.',
};

// The Cameroon export document set most consignments carry. Per-commodity extras
// are listed on each commodity below.
const COMMON_DOCS = ['commercial_invoice', 'packing_list', 'certificate_of_origin_eur1', 'bill_of_lading', 'vgm'];

export const COMMODITIES = {
  cocoa: {
    label_en: 'Cocoa', label_fr: 'Cacao', hs_code: '1801', eudr: true, cites: false,
    body: 'ONCC (Office National du Cacao et du Cafe)',
    what_en: 'Cocoa beans for export. Cameroon is a top-ten producer; ONCC grades and certifies quality.',
    what_fr: 'Feves de cacao pour l export. Le Cameroun est un producteur majeur; l ONCC classe et certifie la qualite.',
    quality: [
      { key: 'moisture', label: 'Moisture', unit: '%', max: 7.5 },
      { key: 'bean_count', label: 'Bean count', unit: 'beans/100g', min: 80, max: 120 },
      { key: 'defects', label: 'Defective beans', unit: '%', max: 10 },
      { key: 'foreign_matter', label: 'Foreign matter', unit: '%', max: 2 },
    ],
    documents: [...COMMON_DOCS, 'eudr_dds', 'phytosanitary', 'oncc_quality_certificate'],
    sources: ['ISO 2451', 'ICCO', 'ONCC grading rules'],
  },
  coffee: {
    label_en: 'Coffee', label_fr: 'Cafe', hs_code: '0901', eudr: true, cites: false,
    body: 'ONCC (Office National du Cacao et du Cafe)',
    what_en: 'Green coffee, arabica or robusta. Graded by moisture, screen size, and defect count.',
    what_fr: 'Cafe vert, arabica ou robusta. Classe par humidite, calibre et nombre de defauts.',
    quality: [
      { key: 'moisture', label: 'Moisture', unit: '%', min: 9, max: 13 },
      { key: 'screen_size', label: 'Screen size', unit: '1/64 in', min: 12, max: 18 },
      { key: 'defect_count', label: 'Defect count', unit: '/300g', max: 86 },
    ],
    documents: [...COMMON_DOCS, 'eudr_dds', 'phytosanitary', 'oncc_quality_certificate'],
    sources: ['ISO 4150 (size)', 'ISO 6673 (moisture)', 'ICO/SCA defect grading'],
  },
  palm_oil: {
    label_en: 'Palm oil', label_fr: 'Huile de palme', hs_code: '1511', eudr: true, cites: false,
    body: 'MINADER / MINCOMMERCE',
    what_en: 'Crude palm oil (CPO). Traded on free fatty acid, moisture and impurities, DOBI, and iodine value.',
    what_fr: 'Huile de palme brute (CPO). Negociee sur l acidite, l humidite et impuretes, le DOBI et l indice d iode.',
    quality: [
      { key: 'ffa', label: 'Free fatty acid (as palmitic)', unit: '%', max: 5 },
      { key: 'moisture_impurities', label: 'Moisture and impurities', unit: '%', max: 0.25 },
      { key: 'dobi', label: 'DOBI', unit: 'index', min: 2.3 },
      { key: 'iodine_value', label: 'Iodine value', unit: 'gI2/100g', min: 49, max: 56 },
    ],
    documents: [...COMMON_DOCS, 'eudr_dds', 'certificate_of_analysis'],
    sources: ['PORAM/MPOA', 'MS 814'],
  },
  rubber: {
    label_en: 'Rubber', label_fr: 'Caoutchouc', hs_code: '4001', eudr: true, cites: false,
    body: 'HEVECAM / CDC context',
    what_en: 'Natural rubber, technically specified (TSR 10 / TSR 20). Graded on dirt, ash, nitrogen, volatile matter, plasticity Po, and PRI.',
    what_fr: 'Caoutchouc naturel specifie techniquement (TSR 10 / TSR 20). Classe sur impuretes, cendres, azote, matieres volatiles, plasticite Po et IRP.',
    quality: [
      { key: 'dirt', label: 'Dirt content', unit: '%', max: 0.16 },
      { key: 'ash', label: 'Ash content', unit: '%', max: 1.0 },
      { key: 'nitrogen', label: 'Nitrogen', unit: '%', max: 0.6 },
      { key: 'volatile_matter', label: 'Volatile matter', unit: '%', max: 0.8 },
      { key: 'po_plasticity', label: 'Plasticity Po', unit: 'Wallace', min: 30 },
      { key: 'pri', label: 'Plasticity retention index', unit: '%', min: 40 },
    ],
    documents: [...COMMON_DOCS, 'eudr_dds', 'certificate_of_analysis'],
    sources: ['ISO 2000'],
  },
  cotton: {
    label_en: 'Cotton', label_fr: 'Coton', hs_code: '5201', eudr: false, cites: false,
    body: 'SODECOTON',
    what_en: 'Cotton lint, classed on the HVI: micronaire, staple length, strength, uniformity, and trash. Outside EUDR.',
    what_fr: 'Fibre de coton, classee au HVI: micronaire, longueur, tenacite, uniformite et dechets. Hors EUDR.',
    quality: [
      { key: 'micronaire', label: 'Micronaire', unit: 'mic', min: 3.5, max: 4.9 },
      { key: 'staple_length', label: 'Staple length', unit: 'mm', min: 28 },
      { key: 'strength', label: 'Strength', unit: 'g/tex', min: 28 },
      { key: 'uniformity_index', label: 'Uniformity index', unit: '%', min: 80 },
      { key: 'trash', label: 'Trash', unit: '%', max: 5 },
    ],
    documents: [...COMMON_DOCS, 'phytosanitary', 'certificate_of_analysis'],
    sources: ['USDA HVI classing'],
  },
  banana: {
    label_en: 'Banana', label_fr: 'Banane', hs_code: '0803', eudr: false, cites: false,
    body: 'MINADER / producer (PHP, CDC)',
    what_en: 'Fresh green bananas, graded by finger length, caliber, and quality class (Extra, I, II). Outside EUDR.',
    what_fr: 'Bananes vertes fraiches, classees par longueur du doigt, calibre et classe (Extra, I, II). Hors EUDR.',
    quality: [
      { key: 'finger_length', label: 'Finger length', unit: 'cm', min: 14 },
      { key: 'grade_caliber', label: 'Grade (caliber)', unit: 'mm', min: 27 },
      { key: 'quality_class', label: 'Quality class', unit: 'Extra/I/II' },
    ],
    documents: [...COMMON_DOCS, 'phytosanitary'],
    sources: ['Codex STAN 205', 'EU Reg 1333/2011'],
  },
  timber: {
    label_en: 'Timber', label_fr: 'Bois', hs_code: '4403', eudr: true, cites: true,
    body: 'MINFOF (SIGIF2)',
    what_en: 'Logs and sawnwood. In scope for EUDR; CITES-listed species (e.g. some Pericopsis, bubinga) need a CITES permit and can never be mass-balanced. FLEGT is terminated for Cameroon.',
    what_fr: 'Grumes et sciages. Concerne par l EUDR; les especes CITES (ex. certains Pericopsis, bubinga) exigent un permis CITES et ne peuvent jamais etre en bilan massique. Le FLEGT est termine pour le Cameroun.',
    quality: [
      { key: 'moisture', label: 'Moisture (sawnwood, air-dry)', unit: '%', max: 20 },
    ],
    documents: [...COMMON_DOCS, 'eudr_dds', 'cites_permit', 'minfof_specification'],
    sources: ['SIGIF2', 'CITES appendices', 'EUDR wood scope'],
  },
};

export const RAILS = {
  'rail.eudr': {
    label_en: 'EUDR rail', label_fr: 'Filiere EUDR',
    what_en: 'The EU Deforestation Regulation due-diligence file: plot geolocation, a due diligence statement (DDS) with a reference number, and a country-risk assessment. Without a DDS reference the container is held at the EU border.',
    what_fr: 'Le dossier de diligence raisonnee du reglement EUDR: geolocalisation des parcelles, une declaration (DDS) avec numero de reference, et une evaluation du risque pays. Sans numero DDS, le conteneur est bloque a la frontiere UE.',
    applies_from: 'Large and medium: 30 December 2026. Micro and small: 30 June 2027.',
    review_by: '2026-10-01',
    sources: ['Reg (EU) 2023/1115', 'Reg (EU) 2025/2650 (delay)'],
  },
  'rail.cites': {
    label_en: 'CITES rail', label_fr: 'Filiere CITES',
    what_en: 'CITES permits and a quota ledger for listed species. A CITES-listed lot is identity-preserved and can never be mass-balanced; the quota ledger never goes negative.',
    what_fr: 'Permis CITES et registre de quotas pour les especes listees. Un lot CITES est a identite preservee et ne peut jamais etre en bilan massique; le registre de quotas ne devient jamais negatif.',
    review_by: '2026-10-01',
    sources: ['CITES appendices', 'CoP20 outcomes Dec 2025'],
  },
};

export const REGULATIONS = {
  eudr: {
    title_en: 'EUDR', title_fr: 'EUDR',
    what_en: 'Regulation (EU) 2023/1115 covers cattle, cocoa, coffee, oil palm, rubber, soy, and wood. Cameroon is standard risk. A due diligence statement with a reference number is required before EU market entry.',
    applies_from: 'Large and medium 30 Dec 2026; micro and small 30 Jun 2027.',
    review_by: '2026-10-01', sources: ['Reg (EU) 2023/1115', 'Reg (EU) 2025/2650'],
  },
  flegt: {
    title_en: 'FLEGT', title_fr: 'FLEGT',
    what_en: 'The Cameroon FLEGT VPA was terminated on 17 June 2025, so there is no FLEGT licence gate. Do not build a FLEGT requirement into timber issuance.',
    review_by: '2026-10-01', sources: ['EU-Cameroon VPA termination 17 Jun 2025'],
  },
  beac_repatriation: {
    title_en: 'BEAC foreign-exchange repatriation', title_fr: 'Rapatriement des devises BEAC',
    what_en: 'CEMAC/BEAC rules require export proceeds to be repatriated within 150 days and domiciled with a bank. In Wouri, settled means repatriated, not merely paid. Do not hardcode an extractive-only 35 percent rule.',
    review_by: '2026-10-01', sources: ['BEAC FX regulation', 'CEMAC'],
  },
  eur1: {
    title_en: 'EUR.1-CMR certificate of origin', title_fr: 'Certificat d origine EUR.1-CMR',
    what_en: 'The EUR.1 movement certificate evidences preferential Cameroon origin for EU market access.',
    review_by: '2027-01-01', sources: ['EU-Cameroon EPA'],
  },
};

// Non-commodity capabilities, so the KB covers every menu item.
export const CAPABILITIES = {
  field_capture: { label_en: 'Field capture', what_en: 'The offline field app: plots, photos, GPS, signatures, captured without a network and synced later.' },
  settlement: { label_en: 'Settlement', what_en: 'The documentary flow to payment, discrepancy tracking, and the BEAC repatriation clock. Settled means repatriated.' },
  financing: { label_en: 'Financing', what_en: 'Warehouse receipts and a cash timeline. Wouri records financing; it never lends.' },
  groups: { label_en: 'Groups', what_en: 'Holdings and cooperatives of cooperatives, for consolidated reporting.' },
  'commodity.other': { label_en: 'Other commodity', what_en: 'An export commodity not yet profiled. Aza treats it generically until a profile is added.' },
};

const DOC_LABELS = {
  commercial_invoice: 'Commercial invoice', packing_list: 'Packing list',
  certificate_of_origin_eur1: 'EUR.1 certificate of origin', bill_of_lading: 'Bill of lading',
  vgm: 'Verified gross mass (VGM)', eudr_dds: 'EUDR due diligence statement',
  phytosanitary: 'Phytosanitary certificate', oncc_quality_certificate: 'ONCC quality certificate',
  certificate_of_analysis: 'Certificate of analysis', cites_permit: 'CITES permit',
  minfof_specification: 'MINFOF specification',
};

// Lookups Aza uses. All synchronous, all local.
export function commodityInfo(key) {
  return COMMODITIES[key] || COMMODITIES[key?.replace(/^commodity\./, '')] || null;
}
export function documentsFor(commodityKey) {
  const c = commodityInfo(commodityKey);
  return (c?.documents || []).map((d) => ({ key: d, label: DOC_LABELS[d] || d }));
}
export function explain(capabilityKey) {
  const c = commodityInfo(capabilityKey);
  if (c) return c.what_en;
  return RAILS[capabilityKey]?.what_en || CAPABILITIES[capabilityKey]?.what_en || '';
}
// Every capability key the KB should cover, for the coverage self-test.
export function coveredKeys() {
  return [
    ...Object.keys(COMMODITIES).map((k) => 'commodity.' + k),
    ...Object.keys(RAILS),
    ...Object.keys(CAPABILITIES),
  ];
}
