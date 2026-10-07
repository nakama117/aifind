import type { ProductMarket, ProductLanguageSupport, ProductPlatform, ProductCapability, ProductPrice, ProductPlan, Evidence, VersionMetadata } from "./contracts.ts";
import type {DiscoveryQuery} from './discovery/contracts.ts';
import type { PublicEditorialRelated } from './editorial/public-contracts.ts';

/** Intentionally separate from the full Domain/Admin DTO. No private notes or internal references. */
export interface PublicProduct {
  relatedEditorial?: PublicEditorialRelated;
  slug: string; displayName: string; summaryJa: string; officialUrl: string;
  vendor: { name: string } | null; lifecycleStatus: VersionMetadata["lifecycleStatus"];
  visibility: "listed" | "unlisted"; canonicalUrl: string; versionNo: number;
  publishedAt: string; lastVerifiedAt: string;
  hasCurrentFreePlan: boolean;
  freePlanState?: 'free' | 'trial' | 'paid' | 'custom' | 'unknown';
  markets: Array<Pick<ProductMarket, "marketCode" | "availabilityStatus" | "verifiedAt">>;
  japanese: Pick<ProductLanguageSupport, "inputSupport" | "outputSupport" | "uiSupport" | "verifiedAt">;
  platforms: Array<Pick<ProductPlatform, "platformKey" | "status" | "verifiedAt">>;
  capabilities: Array<Pick<ProductCapability, "capabilityKey" | "supportLevel" | "verifiedAt">>;
  plans: Array<Pick<ProductPlan, "planKey" | "name" | "audience" | "billingModel" | "activeStatus" | "verifiedAt"> & {
    prices: Array<Pick<ProductPrice, "marketCode" | "currencyCode" | "billingPeriod" | "priceType" | "amountMinor" | "unitLabel" | "validFrom" | "validTo" | "verifiedAt">>;
  }>;
  evidence: Array<Pick<Evidence, "url" | "title" | "publisher" | "sourceKind">>;
}
export interface PublicProductList { products: PublicProduct[]; limit: number; offset: number; hasMore: boolean; total:number; query:DiscoveryQuery }
export type PublicProductResolution = { kind: "found"; product: PublicProduct } | { kind: "redirect"; slug: string } | { kind: "not_found" };
