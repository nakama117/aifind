import { z } from "zod";

export const MARKET_CODES = ["JP", "US"] as const;
export const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const HttpUrlSchema = z.url().max(2000).refine((url) => ["http:", "https:"].includes(new URL(url).protocol), "HTTP/S URL required");
export const NameSchema = z.string().trim().min(1).max(200);
const vendorFields = {
  name: NameSchema,
  legalName: NameSchema.nullable().optional(),
  officialUrl: HttpUrlSchema.nullable().optional(),
  countryCode: z.enum(MARKET_CODES).nullable().optional(),
  status: z.enum(["active", "inactive", "unknown"]).optional(),
};
export const VendorSchema = z.strictObject({ slug: SlugSchema, ...vendorFields });
export const VendorUpdateSchema = z.strictObject(vendorFields).partial();
export const ProductSchema = z.strictObject({
  slug: SlugSchema, canonicalName: NameSchema, vendorId: z.string().min(1).max(80).nullable().optional(),
});
export const AliasSchema = z.strictObject({
  alias: z.string().min(1).max(200).refine(v => v.normalize("NFKC").trim().length > 0, "nonempty alias required"),
  locale: z.string().min(2).max(35).nullable().optional(),
  aliasType: z.enum(["official", "brand", "former_name", "common", "model_family"]),
});

export interface Vendor {
  id: string; slug: string; name: string; legalName: string | null; officialUrl: string | null;
  countryCode: (typeof MARKET_CODES)[number] | null; status: "active" | "inactive" | "unknown";
  createdAt: string; updatedAt: string;
}
export interface ProductIdentity {
  id: string; vendorId: string | null; slug: string; canonicalName: string; createdAt: string; updatedAt: string;
}
export interface ProductAlias {
  id: string; productId: string; alias: string; normalizedAlias: string; locale: string | null;
  aliasType: "official" | "brand" | "former_name" | "common" | "model_family"; createdAt: string;
}

export const LIFECYCLE_STATUSES = ["unknown", "active", "beta", "waitlist", "discontinued", "acquired"] as const;
export const TimestampSchema = z.iso.datetime({ offset: true });
export const EvidenceIdSchema = z.string().min(1).max(80);
export const SOURCE_KINDS = ["official_product", "official_pricing", "official_docs", "official_support", "official_blog", "official_terms", "reputable_media", "other"] as const;
export const EvidenceSchema = z.strictObject({
  url: HttpUrlSchema, title: z.string().trim().max(500).nullable().optional(),
  publisher: z.string().trim().max(200).nullable().optional(), sourceKind: z.enum(SOURCE_KINDS),
  retrievedAt: TimestampSchema, publishedAt: TimestampSchema.nullable().optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
  evidenceNote: z.string().trim().max(500).nullable().optional(),
});
export interface Evidence {
  id: string; url: string; title: string | null; publisher: string | null;
  sourceKind: (typeof SOURCE_KINDS)[number]; retrievedAt: string; publishedAt: string | null;
  contentHash: string | null; evidenceNote: string | null; createdAt: string;
}
const versionFields = {
  displayName: NameSchema,
  summaryJa: z.string().trim().min(1).max(2000).nullable().optional(),
  officialUrl: HttpUrlSchema.nullable().optional(),
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional(),
  lifecycleEvidenceId: EvidenceIdSchema.nullable().optional(),
  lifecycleVerifiedAt: TimestampSchema.nullable().optional(),
};
export const DraftSchema = z.strictObject(versionFields);
export const DraftUpdateSchema = z.strictObject(versionFields).partial();

export interface VersionMetadata {
  id: string; productId: string; versionNo: number; displayName: string; officialUrl: string | null;
  summaryJa: string | null;
  lifecycleStatus: (typeof LIFECYCLE_STATUSES)[number]; createdAt: string;
  lifecycleEvidenceId: string | null; lifecycleVerifiedAt: string | null;
  publishedAt: string | null; supersededAt: string | null;
}
export interface ProductSnapshot {
  identity: ProductIdentity; vendor: Vendor | null; aliases: ProductAlias[];
  version: VersionMetadata & { status: "draft" | "published" | "superseded" };
  markets: ProductMarket[]; languages: ProductLanguageSupport[]; platforms: ProductPlatform[];
  capabilities: ProductCapability[];
  plans: Array<ProductPlan & { prices: ProductPrice[] }>;
  evidence: Evidence[];
  lastVerifiedAt: string | null;
}
export interface PublishedProduct extends Omit<ProductSnapshot, "version"> {
  version: VersionMetadata & { status: "published" };
}
export interface DraftProduct extends Omit<ProductSnapshot, "version"> {
  version: VersionMetadata & { status: "draft"; createdBy: string | null };
}

export const SUPPORT_LEVELS = ["unknown", "none", "partial", "full"] as const;
export const LANGUAGE_CODES = ["ja", "en"] as const;
export const PLATFORM_KEYS = ["web", "ios", "android", "windows", "macos", "linux", "browser_extension"] as const;
export const verificationFields = {
  verifiedAt: TimestampSchema.nullable().optional(), evidenceId: EvidenceIdSchema.nullable().optional(),
};
export interface Verification { verifiedAt: string | null; evidenceId: string | null }
export const MarketSchema = z.strictObject({ marketCode: z.enum(MARKET_CODES),
  availabilityStatus: z.enum(["unknown", "available", "unavailable", "waitlist", "restricted"]), ...verificationFields });
export const LanguageSupportSchema = z.strictObject({ languageCode: z.enum(LANGUAGE_CODES),
  inputSupport: z.enum(SUPPORT_LEVELS), outputSupport: z.enum(SUPPORT_LEVELS), uiSupport: z.enum(SUPPORT_LEVELS), ...verificationFields });
export const PlatformSchema = z.strictObject({ platformKey: z.enum(PLATFORM_KEYS),
  status: z.enum(["unknown", "available", "unavailable"]), ...verificationFields });
export interface ProductMarket extends Verification {
  id: string | null; productVersionId: string; marketCode: (typeof MARKET_CODES)[number];
  availabilityStatus: "unknown" | "available" | "unavailable" | "waitlist" | "restricted";
}
export interface ProductLanguageSupport extends Verification {
  productVersionId: string; languageCode: (typeof LANGUAGE_CODES)[number];
  inputSupport: (typeof SUPPORT_LEVELS)[number]; outputSupport: (typeof SUPPORT_LEVELS)[number]; uiSupport: (typeof SUPPORT_LEVELS)[number];
}
export interface ProductPlatform extends Verification {
  productVersionId: string; platformKey: (typeof PLATFORM_KEYS)[number]; status: "unknown" | "available" | "unavailable";
}

export const CAPABILITY_KEYS = ["text", "image_generation", "image_understanding", "video_generation", "audio", "coding", "search", "research", "agent", "api"] as const;
export const CapabilitySchema = z.strictObject({ capabilityKey: z.enum(CAPABILITY_KEYS), supportLevel: z.enum(SUPPORT_LEVELS), ...verificationFields });
export interface ProductCapability extends Verification {
  productVersionId: string; capabilityKey: (typeof CAPABILITY_KEYS)[number]; supportLevel: (typeof SUPPORT_LEVELS)[number];
}

export const CURRENCY_CODES = ["JPY", "USD", "EUR", "GBP"] as const;
export const PlanSchema = z.strictObject({ planKey: SlugSchema, name: NameSchema,
  audience: z.enum(["free", "personal", "team", "business", "enterprise", "developer", "unknown"]).optional(),
  billingModel: z.enum(["free", "subscription", "usage", "custom", "unknown"]).optional(),
  activeStatus: z.enum(["unknown", "active", "inactive"]).optional(), ...verificationFields });
export const PriceSchema = z.strictObject({
  id: z.string().min(1).max(80).optional(), marketCode: z.enum(MARKET_CODES).nullable().optional(),
  currencyCode: z.enum(CURRENCY_CODES).nullable().optional(),
  billingPeriod: z.enum(["month", "year", "usage", "one_time", "custom", "none"]),
  priceType: z.enum(["free", "fixed", "from", "custom", "unknown"]),
  amountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  unitLabel: z.string().trim().max(200).nullable().optional(),
  validFrom: z.iso.date().nullable().optional(), validTo: z.iso.date().nullable().optional(), ...verificationFields,
}).superRefine((p, ctx) => {
  const validAmount = p.priceType === "free" ? p.amountMinor === 0
    : p.priceType === "unknown" || p.priceType === "custom" ? p.amountMinor == null
    : p.currencyCode != null && p.amountMinor != null && p.amountMinor > 0;
  if (!validAmount) ctx.addIssue({ code: "custom", path: ["amountMinor"], message: "price type, currency and minor-unit amount disagree" });
  if (p.validFrom && p.validTo && p.validTo < p.validFrom) ctx.addIssue({ code: "custom", path: ["validTo"], message: "validTo precedes validFrom" });
});
export interface ProductPlan extends Verification {
  id: string; productVersionId: string; planKey: string; name: string;
  audience: "free" | "personal" | "team" | "business" | "enterprise" | "developer" | "unknown";
  billingModel: "free" | "subscription" | "usage" | "custom" | "unknown"; activeStatus: "unknown" | "active" | "inactive";
}
export interface ProductPrice extends Verification {
  id: string; planId: string; marketCode: (typeof MARKET_CODES)[number] | null; currencyCode: (typeof CURRENCY_CODES)[number] | null;
  billingPeriod: "month" | "year" | "usage" | "one_time" | "custom" | "none";
  priceType: "free" | "fixed" | "from" | "custom" | "unknown"; amountMinor: number | null;
  unitLabel: string | null; validFrom: string | null; validTo: string | null;
}

export const PublishedListSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
});

export const PublishAuditSchema = z.strictObject({
  actor: NameSchema, reason: z.string().trim().min(1).max(500),
});
