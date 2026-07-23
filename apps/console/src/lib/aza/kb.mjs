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

// Everything about the app itself, so Aza can explain the product offline. Add a
// new entry here whenever a feature ships (the "fill the KB as we go" rule).
export const APP = {
  what_is: {
    label_en: 'What Wouri is', label_fr: 'Ce qu est Wouri',
    what_en: 'Wouri is the registry of record for African commodity export, the trust and credit layer. Like a land registry or a classification society, its value is that third parties rely on it. Wouri never takes title, holds money, or lends.',
    what_fr: 'Wouri est le registre de reference de l export de matieres premieres africaines, la couche de confiance et de credit. Comme un cadastre ou une societe de classification, sa valeur tient au fait que des tiers s y fient. Wouri ne prend jamais titre, ne detient pas d argent et ne prete pas.',
  },
  onboarding: {
    label_en: 'Onboarding (chat or click)', label_fr: 'Demarrage (chat ou clic)',
    what_en: 'A tenant creates a workspace two ways that produce the same result: describe the business and Aza sets it up, or pick capabilities by hand. Aza runs locally with no external API, so onboarding always works.',
    what_fr: 'Un locataire cree un espace de deux facons au meme resultat: decrire son activite et Aza la configure, ou choisir soi-meme. Aza fonctionne en local sans API externe, donc le demarrage marche toujours.',
  },
  capabilities: {
    label_en: 'Capabilities', label_fr: 'Capacites',
    what_en: 'Each tenant picks capabilities: what they export, compliance rails (EUDR, CITES), field capture, settlement, financing, groups. Capabilities are data, so the menu grows with no code change. Dependencies auto-enable (CITES needs timber; financing needs settlement).',
    what_fr: 'Chaque locataire choisit ses capacites: ce qu il exporte, les filieres de conformite (EUDR, CITES), la capture terrain, le reglement, le financement, les groupes. Les capacites sont des donnees; le menu grandit sans code. Les dependances s activent seules (CITES exige le bois; le financement exige le reglement).',
  },
  origin: {
    label_en: 'Where the chain starts', label_fr: 'Ou commence la chaine',
    what_en: 'A tenant enters custody at one of two points, a choice not a code branch: at harvest (they own the plot, so they capture the origin unit with its geolocation and the harvest event) or after harvest (they received the lot from a supplier, so the chain starts at the receipt). For an EUDR commodity a missing plot geolocation is never blocked; it surfaces on the readiness board as an origin gap to fill before the border. This applies to every commodity, not just timber.',
    what_fr: 'Un locataire entre dans la custody a l un des deux points, un choix et non un branchement de code: a la recolte (il possede la parcelle et capture l unite d origine avec sa geolocalisation et l evenement de recolte) ou apres la recolte (il a recu le lot d un fournisseur et la chaine commence a la reception). Pour un produit EUDR, une geolocalisation manquante n est jamais bloquante; elle apparait au tableau de preparation comme un ecart d origine a combler avant la frontiere. Vrai pour tout produit, pas seulement le bois.',
  },
  custody: {
    label_en: 'Custody spine (tamper-evident)', label_fr: 'Chaine de custody (inviolable)',
    what_en: 'Physical custody is an append-only event stream. Each event is client-minted for offline capture, then sealed server-side into a per-lot hash chain and counter-signed onto a per-tenant chain, so history is tamper-evident and cannot be rewritten. Corrections are compensating events, never deletes.',
    what_fr: 'La custody physique est un flux d evenements en ajout seul. Chaque evenement est cree cote client pour la saisie hors ligne, puis scelle cote serveur dans une chaine de hachage par lot et contresigne sur une chaine par locataire, rendant l historique inviolable. Les corrections sont des evenements compensatoires, jamais des suppressions.',
  },
  quality: {
    label_en: 'Quality capture', label_fr: 'Saisie qualite',
    what_en: 'Record measured quality values against the commodity declared attributes (moisture, bean count, and the rest), each checked against its range. Recording these lets the quality certificate issue with real numbers. The lot detail also shows the custody timeline and the tamper-evident chain status.',
    what_fr: 'Enregistrez les valeurs qualite mesurees face aux attributs declares du produit (humidite, grainage, etc.), chacune verifiee par rapport a sa plage. Ces valeurs permettent au certificat de qualite d etre emis avec de vrais chiffres. Le detail du lot montre aussi l historique de custody et l etat de la chaine inviolable.',
  },
  documents: {
    label_en: 'Document engine', label_fr: 'Moteur documentaire',
    what_en: 'The engine builds each export document from the spine. A required field that does not resolve blocks issuance; a declared weight that does not match the consignment blocks issuance. Issuance is idempotent by content hash, so the same inputs reproduce the same document.',
    what_fr: 'Le moteur construit chaque document a partir de la colonne vertebrale. Un champ requis non resolu bloque l emission; un poids declare qui ne correspond pas a l expedition bloque l emission. L emission est idempotente par hachage: memes entrees, meme document.',
  },
  verification: {
    label_en: 'Proof and verification', label_fr: 'Preuve et verification',
    what_en: 'Every issued document is a W3C Verifiable Credential signed with Ed25519. Anyone verifies it offline at wouri.co/v/{code} with the public key alone, no account, without contacting Wouri. A tampered or revoked document reads as such.',
    what_fr: 'Chaque document emis est une preuve verifiable W3C signee en Ed25519. N importe qui la verifie hors ligne sur wouri.co/v/{code} avec la seule cle publique, sans compte, sans contacter Wouri. Un document altere ou revoque apparait comme tel.',
  },
  settlement: {
    label_en: 'Settlement and the BEAC clock', label_fr: 'Reglement et horloge BEAC',
    what_en: 'Settlement tracks the documentary flow to payment, flags discrepancies, and runs the BEAC 150-day repatriation clock. In Wouri, settled means repatriated, not merely paid.',
    what_fr: 'Le reglement suit le flux documentaire jusqu au paiement, signale les ecarts et fait tourner l horloge de rapatriement BEAC de 150 jours. Chez Wouri, regle veut dire rapatrie, pas seulement paye.',
  },
  financing: {
    label_en: 'Financing (records, never lends)', label_fr: 'Financement (enregistre, ne prete pas)',
    what_en: 'Financing records warehouse receipts and a cash timeline so a consignment can back credit. Wouri records financing; it never lends.',
    what_fr: 'Le financement enregistre les recepisses d entrepot et un calendrier de tresorerie pour qu une expedition adosse un credit. Wouri enregistre le financement; il ne prete jamais.',
  },
  field: {
    label_en: 'Field capture (offline)', label_fr: 'Capture terrain (hors ligne)',
    what_en: 'The field app captures plots, photos, GPS, and signatures offline and syncs later. Media never blocks a record.',
    what_fr: 'L application terrain capture parcelles, photos, GPS et signatures hors ligne et synchronise plus tard. Les medias ne bloquent jamais un enregistrement.',
  },
  roles: {
    label_en: 'Roles', label_fr: 'Roles',
    what_en: 'Access is role-based per organization: owner, admin, export manager, documentation officer, field agent, finance, viewer. Each role sees only its surface.',
    what_fr: 'L acces est base sur les roles par organisation: proprietaire, administrateur, responsable export, agent documentaire, agent de terrain, finance, lecteur. Chaque role ne voit que sa surface.',
  },
  languages: {
    label_en: 'Languages', label_fr: 'Langues',
    what_en: 'The console is bilingual, French by default (Cameroon first) and English, switchable per user. Documents can be produced in the language the destination needs.',
    what_fr: 'La console est bilingue, francais par defaut (Cameroun d abord) et anglais, commutable par utilisateur. Les documents peuvent etre produits dans la langue attendue a destination.',
  },
  security: {
    label_en: 'Security and isolation', label_fr: 'Securite et isolation',
    what_en: 'Row-level security is the single isolation gate: a tenant sees only its own data, an anonymous visitor sees nothing. Every table denies by default.',
    what_fr: 'La securite au niveau des lignes est l unique barriere: un locataire ne voit que ses donnees, un visiteur anonyme ne voit rien. Chaque table refuse par defaut.',
  },
  resilience: {
    label_en: 'Resilience (Aza never blocks)', label_fr: 'Resilience (Aza ne bloque jamais)',
    what_en: 'Aza never blocks a tenant. Its inference and knowledge base are local, so there is no external API to fail. If Aza is unavailable a tenant still creates a workspace by clicking, and the knowledge base still answers from the bundled copy.',
    what_fr: 'Aza ne bloque jamais un locataire. Son inference et sa base de connaissances sont locales, donc aucune API externe ne peut echouer. Si Aza est indisponible, un locataire cree quand meme un espace en cliquant, et la base repond depuis la copie embarquee.',
  },
  stays_current: {
    label_en: 'How it stays current', label_fr: 'Comment cela reste a jour',
    what_en: 'Regulatory and quality data is effective-dated: an update is a new row and old documents stay reproducible. Every change is logged. Fast-moving facts carry a review-by date; FX and market rates are real-time.',
    what_fr: 'Les donnees reglementaires et qualite sont datees: une mise a jour est une nouvelle ligne et les anciens documents restent reproductibles. Chaque changement est journalise. Les faits mouvants ont une date de revision; les taux de change et de marche sont en temps reel.',
  },
  cockpit: {
    label_en: 'Live cockpit', label_fr: 'Cockpit en direct',
    what_en: 'Real-time exchange rates (XAF against EUR, USD, GBP, CNY, with the fixed EUR peg) and weather at the export hotspots (Douala port, the cocoa, coffee, and timber zones), with a wet-weather flag that warns when drying or transport is at risk. Fetched live and cached, so it survives an outage: last-known values with a staleness note, never blank. The data sources are free and keyless.',
    what_fr: 'Taux de change en temps reel (XAF face a EUR, USD, GBP, CNY, avec la parite fixe EUR) et meteo des zones cles d export (port de Douala, zones cacao, cafe, bois), avec une alerte humidite quand le sechage ou le transport est menace. Recupere en direct et mis en cache, donc resiste a une panne: dernieres valeurs connues avec mention de fraicheur, jamais vide. Les sources sont gratuites et sans cle.',
  },
  dashboard: {
    label_en: 'Owner dashboard', label_fr: 'Tableau de bord',
    what_en: 'The owner home: at a glance, the counts (consignments, lots, documents), what needs attention (the ranked blockers), and the repatriation clock (nearest due or overdue). Everything the owner needs without hunting, with quick actions to create a lot or a consignment.',
    what_fr: 'L accueil du proprietaire: en un coup d oeil, les compteurs (expeditions, lots, documents), ce qui demande attention (les blocages classes) et l horloge de rapatriement (echeance la plus proche ou retard). Tout ce dont le proprietaire a besoin sans chercher, avec des actions rapides pour creer un lot ou une expedition.',
  },
  readiness: {
    label_en: 'Readiness board', label_fr: 'Tableau de preparation',
    what_en: 'The operator morning surface: what is blocking each consignment right now, most urgent first. It ranks a repatriation past the BEAC window (critical), a window closing soon, an open settlement discrepancy, and overdue tasks. It is a rebuildable projection over the spine, scoped to the tenant.',
    what_fr: 'La surface du matin de l operateur: ce qui bloque chaque expedition maintenant, le plus urgent d abord. Elle classe un rapatriement hors delai BEAC (critique), une fenetre bientot close, un ecart de reglement ouvert et les taches en retard. C est une projection reconstructible sur la colonne vertebrale, limitee au locataire.',
  },
  dual_rail: {
    label_en: 'The dual-rail moat', label_fr: 'Le double rail, l avantage',
    what_en: 'The dual-rail consignment, EUDR and CITES on one lot, is the category no competitor serves. A CITES-listed lot is identity-preserved and can never be mass-balanced.',
    what_fr: 'L expedition a double rail, EUDR et CITES sur un meme lot, est la categorie qu aucun concurrent ne sert. Un lot CITES est a identite preservee et ne peut jamais etre en bilan massique.',
  },
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
export function docLabel(key) { return DOC_LABELS[key] || key; }
export function documentsFor(commodityKey) {
  const c = commodityInfo(commodityKey);
  return (c?.documents || []).map((d) => ({ key: d, label: docLabel(d) }));
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
