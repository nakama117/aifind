import type { DraftProduct, PublishedProduct } from "../contracts.ts";

export interface ProductDomainPreview {
  published: PublishedProduct | null;
  draft: DraftProduct | null;
  canMutateDemo: boolean;
}
export interface PreviewHub {
  previews: Array<{ title: string; path: string; status: "Available" | "Disabled" }>;
}
