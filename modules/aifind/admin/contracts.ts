import { z } from "zod";
import { ProductSchema, AliasSchema, VendorSchema, VendorUpdateSchema, DraftUpdateSchema, MarketSchema, LanguageSupportSchema,
  PlatformSchema, CapabilitySchema, PlanSchema, PriceSchema, EvidenceSchema, SlugSchema, MARKET_CODES, LANGUAGE_CODES, PLATFORM_KEYS, CAPABILITY_KEYS } from "../contracts.ts";
import type { ProductIdentity, Vendor, ProductAlias, ProductSnapshot, PublishedProduct, DraftProduct, Evidence, ProductPrice } from "../contracts.ts";
import type { PublicSettings } from "../catalog/public-settings.ts";

export const ReasonSchema = z.string().trim().min(1).max(500);
export const RevisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const ActionSchema = z.strictObject({ reason: ReasonSchema });
export const CreateProductSchema = ProductSchema.extend({ reason: ReasonSchema });
export const IdentityEditSchema = ProductSchema.extend({ expectedRevision: RevisionSchema, reason: ReasonSchema });
export const AddAliasSchema = AliasSchema.extend({ reason: ReasonSchema });
export const CreateVendorSchema = VendorSchema.extend({ reason: ReasonSchema });
export const EditVendorSchema = VendorUpdateSchema.extend({ expectedUpdatedAt: z.iso.datetime({ offset: true }), reason: ReasonSchema })
  .refine(v => [v.name, v.legalName, v.officialUrl, v.countryCode, v.status].some(value => value !== undefined), "Vendor の変更内容を入力してください。");
export const AddEvidenceSchema = EvidenceSchema.extend({ reason: ReasonSchema });
export function priceNeedsBillingPeriod(p: Pick<ProductPrice, "priceType" | "billingPeriod">): boolean {
  return (p.priceType === "fixed" || p.priceType === "from") && p.billingPeriod === "none";
}
export const AdminPriceSchema = PriceSchema.superRefine((p, ctx) => {
  if (priceNeedsBillingPeriod(p)) ctx.addIssue({ code: "custom", path: ["billingPeriod"], message: "固定料金・最低料金には課金周期が必要です。月・年・従量・一回などを選択してください。" });
});
export function candidatePriceFromPublished(p: ProductPrice): z.input<typeof PriceSchema> {
  return { marketCode: p.marketCode, currencyCode: p.currencyCode, billingPeriod: p.billingPeriod, priceType: p.priceType,
    amountMinor: p.amountMinor, unitLabel: p.unitLabel, validFrom: p.validFrom, validTo: p.validTo, evidenceId: p.evidenceId, verifiedAt: p.verifiedAt };
}
const DraftPlanSchema = PlanSchema.extend({ prices: z.array(AdminPriceSchema).max(20).default([]) });
export const DraftSaveSchema = z.strictObject({
  expectedRevision: RevisionSchema, reason: ReasonSchema, version: DraftUpdateSchema.optional(),
  markets: z.array(MarketSchema).max(2).optional(), languages: z.array(LanguageSupportSchema).max(2).optional(),
  platforms: z.array(PlatformSchema).max(7).optional(), capabilities: z.array(CapabilitySchema).max(10).optional(),
  plans: z.array(DraftPlanSchema).max(50).optional(),
}).superRefine((v, ctx) => {
  for (const [name, rows, key] of [["markets", v.markets, "marketCode"], ["languages", v.languages, "languageCode"],
    ["platforms", v.platforms, "platformKey"], ["capabilities", v.capabilities, "capabilityKey"], ["plans", v.plans, "planKey"]] as const) {
    if (rows && new Set(rows.map(row => (row as Record<string, unknown>)[key])).size !== rows.length)
      ctx.addIssue({ code: "custom", path: [name], message: "duplicate target in one save" });
  }
  const priceIds = v.plans?.flatMap(p => p.prices.map(price => price.id).filter(Boolean)) ?? [];
  if (new Set(priceIds).size !== priceIds.length) ctx.addIssue({ code: "custom", path: ["plans"], message: "duplicate price id" });
});
export const PublishSchema = ActionSchema.extend({ expectedRevision: RevisionSchema });
export const ProductListSchema = z.strictObject({ q: z.string().trim().max(100).default(""),
  filter: z.enum(["all", "published", "draft", "needs_review", "no_published"]).default("all"), page: z.coerce.number().int().min(1).max(100000).default(1) });
export const QueueListSchema = z.strictObject({ q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "pending_review", "approved", "rejected", "applied"]).default("pending_review"), page: z.coerce.number().int().min(1).max(100000).default(1) });
export const LookupSchema = z.strictObject({ q: z.string().trim().max(100).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) });
export interface AdminLookup<T> { rows: T[]; page: number; hasMore: boolean }

/** Decimal input is parsed as digits, never through a binary floating point multiplication. */
export function parseAmountMinor(text: string, currency: ProductPrice["currencyCode"]): number {
  if (!currency) throw new Error("通貨を選択してください。");
  const digits = currency === "JPY" ? 0 : 2;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m || (m[2]?.length ?? 0) > digits) throw new Error(`金額は非負の数値で、小数は${digits}桁までです。`);
  const units = BigInt(m[1]) * 10n ** BigInt(digits) + BigInt((m[2] ?? "").padEnd(digits, "0") || "0");
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("金額が保存可能な範囲を超えています。");
  return Number(units);
}
export function formatAmountMinor(amount: number, currency: ProductPrice["currencyCode"]): string {
  const s = String(amount);
  return currency === "JPY" ? s : `${s.padStart(3, "0").slice(0, -2)}.${s.padStart(3, "0").slice(-2)}`;
}

export interface PublishIssue { field: string; problem: "evidence" | "verifiedAt" | "billingPeriod" }
export interface AdminDraftResult { draft: DraftProduct; revision: number }
export interface ProductAdminRow {
  id: string; canonicalName: string; vendorName: string | null; slug: string;
  publishedVersionNo: number | null; draftVersionNo: number | null; lifecycleStatus: string; lastVerifiedAt: string | null; needsReview: boolean;
}
export interface ProductAdminList { rows: ProductAdminRow[]; page: number; hasMore: boolean }
export interface ProductAdminDetail {
  publicSettings: PublicSettings;
  identity: ProductIdentity; identityRevision: number; vendor: Vendor | null; vendors: Vendor[]; aliases: ProductAlias[];
  published: PublishedProduct | null; draft: DraftProduct | null; draftRevision: number | null; baseVersionId: string | null;
  history: ProductSnapshot["version"][]; evidence: Evidence[]; publishIssues: PublishIssue[];
}
export interface Dashboard {
  products: { total: number; published: number; draft: number; noPublished: number };
  review: { pending: number; approved: number; rejected: number; applied: number };
  dataHealth: { factsMissingEvidence: number; factsMissingVerifiedAt: number; productsWithoutVendor: number };
}

const candidateCommon = { productId: z.string().min(1).max(80), baseVersionId: z.string().min(1).max(80),
  evidenceId: z.string().min(1).max(80), sourceType: z.literal("manual"), reason: ReasonSchema };
const CandidatePriceSchema = AdminPriceSchema.superRefine((p, ctx) => {
  if (p.id !== undefined) ctx.addIssue({ code: "custom", path: ["id"], message: "use targetRef for an existing Published price" });
});
export const CandidateSchema = z.discriminatedUnion("candidateType", [
  z.strictObject({ ...candidateCommon, candidateType: z.literal("market"), targetKey: z.enum(MARKET_CODES), targetRef: z.null().optional(), proposedValue: MarketSchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("language"), targetKey: z.enum(LANGUAGE_CODES), targetRef: z.null().optional(), proposedValue: LanguageSupportSchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("platform"), targetKey: z.enum(PLATFORM_KEYS), targetRef: z.null().optional(), proposedValue: PlatformSchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("capability"), targetKey: z.enum(CAPABILITY_KEYS), targetRef: z.null().optional(), proposedValue: CapabilitySchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("plan"), targetKey: SlugSchema, targetRef: z.null().optional(), proposedValue: PlanSchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("price"), targetKey: SlugSchema, targetRef: z.string().min(1).max(80).nullable().optional(), proposedValue: CandidatePriceSchema }),
  z.strictObject({ ...candidateCommon, candidateType: z.literal("lifecycle"), targetKey: z.literal("lifecycle"), targetRef: z.null().optional(),
    proposedValue: DraftUpdateSchema.pick({ lifecycleStatus: true, lifecycleEvidenceId: true, lifecycleVerifiedAt: true }).required({ lifecycleStatus: true }) }),
]).superRefine((c, ctx) => {
  const keyFields: Partial<Record<CandidateType, string>> = { market: "marketCode", language: "languageCode", platform: "platformKey", capability: "capabilityKey", plan: "planKey" };
  const keyField = keyFields[c.candidateType];
  if (keyField && (c.proposedValue as Record<string, unknown>)[keyField] !== c.targetKey) ctx.addIssue({ code: "custom", path: ["targetKey"], message: "target and typed value disagree" });
  const evidence = (c.proposedValue as Record<string, unknown>)[c.candidateType === "lifecycle" ? "lifecycleEvidenceId" : "evidenceId"];
  if (evidence && evidence !== c.evidenceId) ctx.addIssue({ code: "custom", path: ["evidenceId"], message: "candidate evidence and proposed fact disagree" });
});
export type CandidateInput = z.infer<typeof CandidateSchema>;
export type CandidateType = CandidateInput["candidateType"];
export type CandidateStatus = "detected" | "pending_review" | "approved" | "rejected" | "applied";
export interface Candidate {
  id: string; productId: string; baseVersionId: string; candidateType: CandidateType; targetKey: string; targetRef: string | null;
  proposedValue: Record<string, unknown>; evidenceId: string; sourceType: "manual" | "detector" | "import"; status: CandidateStatus;
  createdAt: string; reviewedAt: string | null; reviewedBy: string | null; reviewReason: string | null; appliedAt: string | null; appliedVersionId: string | null;
  detector?: { observationId: string; sourceUrl: string; resolverMethod: string; resolverVersion: string; detectorVersion: string;
    promptVersion: string; resolverReceiptId: number | null; detectorReceiptId: number | null; proposalKey: string };
}
export interface CandidateDetail {
  candidate: Candidate; productName: string; currentPublishedVersionId: string | null;
  baseValue: Record<string, unknown> | null; currentValue: Record<string, unknown> | null; draftValue: Record<string, unknown> | null;
  evidence: Evidence; conflict: string | null;
  detectorEvidence?: { quote: string; start: number; end: number; contextBefore:string;contextAfter:string;retainedInputHash:string;sourceLength:number };
  supportingEvidence: {evidence:Evidence;observationId:string|null;primary:boolean;linkedAt:string;context:CandidateDetail['detectorEvidence']|null}[];
}
export interface CandidateList { rows: CandidateDetail[]; page: number; hasMore: boolean }
export interface ApplyResult { candidateId: string; status: "applied"; draftVersionId: string; alreadyApplied: boolean }
