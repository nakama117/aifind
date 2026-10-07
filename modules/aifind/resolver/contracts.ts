export const RESOLVER_VERSION = 'aifind-resolver-v1';
export const RESOLVER_PROMPT_VERSION = 'aifind-resolver-p1';
export interface ResolverProduct {
  id: string; canonicalName: string; aliases: string[]; vendorName: string | null; officialUrls: string[];
}
export interface ResolverInput {
  url: string; identity?: string | null; vendor?: string | null; text?: string; registeredProductId?: string | null;
}
export interface ResolverResult {
  status: 'resolved' | 'ambiguous' | 'unresolved'; productId: string | null; candidateIds: string[];
  method: 'identity' | 'vendor_identity' | 'registered_source' | 'text' | 'none' | 'model';
  version: string; reason: string; receiptId: number | null;
  /** Contradictory explicit identities cannot be resolved by a model guess. */
  hardConflict?: boolean;
}
