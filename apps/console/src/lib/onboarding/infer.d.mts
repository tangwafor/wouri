// Types for the plain-ESM Aza inference module. Kept beside infer.mjs so the
// console typechecks against the same code the node self-test runs.
export const REQUIRES: Record<string, string>;
export function withDependencies(keys: Iterable<string>): Set<string>;
export function inferCapabilities(description: string): {
  keys: string[];
  reasons: { key: string; matched: string }[];
};
