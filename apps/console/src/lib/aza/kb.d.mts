// Types for the bundled Aza knowledge base (kb.mjs), so the console typechecks
// against the same data the node coverage test runs.
export const KB_META: { version: string; updated: string; note: string };
export const COMMODITIES: Record<string, {
  label_en: string; label_fr: string; hs_code: string; eudr: boolean; cites: boolean;
  body: string; what_en: string; what_fr: string;
  quality: { key: string; label: string; unit: string; min?: number; max?: number }[];
  documents: string[]; sources: string[];
}>;
export const RAILS: Record<string, { label_en: string; label_fr: string; what_en: string; what_fr: string; applies_from?: string; review_by?: string; sources: string[] }>;
export const REGULATIONS: Record<string, { title_en: string; title_fr: string; what_en: string; applies_from?: string; review_by?: string; sources: string[] }>;
export const CAPABILITIES: Record<string, { label_en: string; what_en: string }>;
export function commodityInfo(key: string): (typeof COMMODITIES)[string] | null;
export function documentsFor(commodityKey: string): { key: string; label: string }[];
export function explain(capabilityKey: string): string;
export function coveredKeys(): string[];
