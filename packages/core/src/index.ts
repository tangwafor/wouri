// @wouri/core: the shared primitives. Money is integer minor units; quantity is
// integer base units and refuses cross-dimension conversion; fx is null not one.
// Traces to ADR-0017 and the Bazah money/units doctrine. No em-dashes.

// ── Money (integer minor units) ──────────────────────────────────────────────
export type Currency = 'XAF' | 'EUR' | 'USD' | 'GBP' | 'CAD';
const MINOR_UNIT: Record<Currency, number> = { XAF: 0, EUR: 2, USD: 2, GBP: 2, CAD: 2 };

export interface Money { minor: number; currency: Currency; }

export function money(minor: number, currency: Currency): Money {
  if (!Number.isInteger(minor)) throw new Error('Money must be integer minor units');
  return { minor, currency };
}

export function formatMoney(m: Money): string {
  const d = MINOR_UNIT[m.currency];
  const v = m.minor / 10 ** d;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })} ${m.currency}`;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error('Cannot add different currencies');
  return { minor: a.minor + b.minor, currency: a.currency };
}

// ── FX: null not one ─────────────────────────────────────────────────────────
// A missing rate is null and refuses conversion. Never silently assume 1.
export function applyFx(m: Money, to: Currency, rate: number | null): Money {
  if (m.currency === to) return m;
  if (rate === null || rate === undefined) throw new Error(`No fx rate ${m.currency}->${to}`);
  const fromMinor = 10 ** MINOR_UNIT[m.currency];
  const toMinor = 10 ** MINOR_UNIT[to];
  return { minor: Math.round((m.minor / fromMinor) * rate * toMinor), currency: to };
}

// ── Quantity (integer base units, cross-dimension refusal) ────────────────────
export type Dimension = 'mass' | 'volume' | 'count';
export interface Unit { code: string; dimension: Dimension; toBase: number; }

export const UNITS: Record<string, Unit> = {
  kg: { code: 'kg', dimension: 'mass', toBase: 1 },
  t: { code: 't', dimension: 'mass', toBase: 1000 },
  bag_60: { code: 'bag_60', dimension: 'mass', toBase: 60 },
  bag_65: { code: 'bag_65', dimension: 'mass', toBase: 65 },
  m3: { code: 'm3', dimension: 'volume', toBase: 1 },
};

export function toBase(qty: number, unitCode: string): number {
  const u = UNITS[unitCode];
  if (!u) throw new Error(`Unknown unit ${unitCode}`);
  return Math.round(qty * u.toBase);
}

export function convert(qty: number, from: string, to: string): number {
  const a = UNITS[from], b = UNITS[to];
  if (!a || !b) throw new Error('Unknown unit');
  if (a.dimension !== b.dimension) throw new Error(`Refusing cross-dimension convert ${from}->${to}`);
  return (qty * a.toBase) / b.toBase;
}
