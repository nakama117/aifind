/** Exact alias normalization only; this does not resolve or merge products. */
export function normalizeAlias(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}
