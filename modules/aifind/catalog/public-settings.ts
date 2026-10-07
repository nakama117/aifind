import { z } from "zod";
import { sql, type Db, type Tx } from "@aihot/backend/db";
import { config } from "@aihot/backend/config";
import { audit, Conflict } from "@aihot/backend/audit";
import { HttpUrlSchema, NameSchema, PublishAuditSchema } from "../contracts.ts";
import type { ProductSnapshot } from "../contracts.ts";
import { readProducts, type VersionRow } from "./read.ts";
import { validatePublishedFacts } from "./verification.ts";

export const PublicVisibilitySchema = z.enum(["private", "unlisted", "listed"]);
export const PublicVisibilityChangeSchema = z.strictObject({ visibility: PublicVisibilitySchema,
  expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), reason: PublishAuditSchema.shape.reason });
export interface ReadinessIssue { field: string; message: string }
export interface PublicSettings {
  visibility: z.infer<typeof PublicVisibilitySchema>; firstPublicAt: string | null;
  publicUrl: string | null; canonicalUrl: string; readinessIssues: ReadinessIssue[];
}
export class PublicReadinessError extends Error {
  statusCode = 422;
  issues: ReadinessIssue[];
  constructor(issues: ReadinessIssue[]) { super(issues.map(i => `${i.field}: ${i.message}`).join("; ")); this.issues = issues; }
}

export async function publicReadinessIssues(db: Db, p: ProductSnapshot | null): Promise<ReadinessIssue[]> {
  if (!p) return [{ field: "published", message: "Published バージョンが必要です。" }];
  const issues: ReadinessIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  if (!NameSchema.safeParse(p.version.displayName).success) add("displayName", "表示名が必要です。");
  if (!HttpUrlSchema.safeParse(p.version.officialUrl).success) add("officialUrl", "有効な公式 HTTP(S) URL が必要です。");
  if (!p.version.summaryJa?.trim()) add("summaryJa", "日本語の製品説明が必要です。");
  const [rows] = await db<{ jp: boolean; ja: boolean }[]>`SELECT
    EXISTS(SELECT 1 FROM af_product_markets WHERE product_version_id=${p.version.id} AND market_code='JP') AS jp,
    EXISTS(SELECT 1 FROM af_product_language_support WHERE product_version_id=${p.version.id} AND language_code='ja') AS ja`;
  if (!rows.jp) add("market:JP", "JP の市場レコードが必要です（未確認でも登録できます）。");
  if (!rows.ja) add("language:ja", "日本語対応のレコードが必要です（未確認でも登録できます）。");
  if (!p.lastVerifiedAt) add("lastVerifiedAt", "根拠のある事実の確認日時が必要です。");
  try { validatePublishedFacts(p); } catch (error) { add("facts", `事実の根拠と確認日時を確認してください：${(error as Error).message}`); }
  for (const plan of p.plans) for (const price of plan.prices) {
    if (["fixed", "from"].includes(price.priceType) && price.billingPeriod === "none") add(`price:${plan.planKey}`, "固定料金・最低料金には課金周期が必要です。");
  }
  return issues;
}
export async function requirePublicReady(db: Db, p: ProductSnapshot | null): Promise<void> {
  const issues = await publicReadinessIssues(db, p); if (issues.length) throw new PublicReadinessError(issues);
}
export async function readPublicSettings(db: Db, productId: string, published: ProductSnapshot | null): Promise<PublicSettings> {
  const [p] = await db`SELECT public_visibility,first_public_at,slug FROM af_products WHERE id=${productId}`;
  const canonicalUrl = `${config.siteUrl}/products/${p.slug}`;
  return { visibility: p.public_visibility, firstPublicAt: p.first_public_at?.toISOString() ?? null,
    publicUrl: p.public_visibility === "private" ? null : canonicalUrl, canonicalUrl,
    readinessIssues: await publicReadinessIssues(db, published) };
}
export async function setProductPublicVisibility(productId: string, input: unknown, actor: string): Promise<PublicSettings> {
  const p = PublicVisibilityChangeSchema.parse(input); const change = PublishAuditSchema.parse({ actor, reason: p.reason });
  return sql.begin("isolation level read committed", async (tx: Tx) => {
    const [identity] = await tx`SELECT * FROM af_products WHERE id=${productId} FOR UPDATE`;
    if (!identity) throw new Conflict("製品が見つかりません。");
    if (identity.identity_revision !== p.expectedRevision) throw new Conflict("Identity は更新されています。最新の内容を再読み込みしてください。");
    const [version] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='published'`;
    const published = version ? (await readProducts(tx, [version]))[0] : null;
    if (p.visibility !== "private") await requirePublicReady(tx, published);
    await tx`UPDATE af_products SET public_visibility=${p.visibility},updated_at=clock_timestamp() WHERE id=${productId}`;
    const result = await readPublicSettings(tx, productId, published);
    await audit(change.actor, "aifind.product.visibility", `aifind:product:${productId}`, change.reason,
      { visibility: identity.public_visibility }, { visibility: result.visibility, firstPublicAt: result.firstPublicAt }, { db: tx });
    return result;
  });
}
