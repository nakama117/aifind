import { sql, type Tx } from "@aihot/backend/db";
import { ProductListSchema, LookupSchema, priceNeedsBillingPeriod } from "./contracts.ts";
import type { Dashboard, ProductAdminDetail, ProductAdminList, PublishIssue } from "./contracts.ts";
import type { ProductSnapshot } from "../contracts.ts";
import { readProducts, publishedDto, draftDto, versionDto } from "../catalog/read.ts";
import type { VersionRow } from "../catalog/read.ts";
import { identityDto, aliasDto, vendorDto } from "../catalog/identity.ts";
import type { IdentityRow, AliasRow, VendorRow } from "../catalog/identity.ts";
import { evidenceDto } from "../catalog/evidence.ts";
import type { EvidenceRow } from "../catalog/evidence.ts";
import { definiteFacts } from "../catalog/verification.ts";
import { NotFound } from "./errors.ts";
import { readPublicSettings } from "../catalog/public-settings.ts";

export function publishIssues(p: ProductSnapshot): PublishIssue[] {
  const evidenceIds = new Set(p.evidence.map(e => e.id));
  const facts = definiteFacts(p).flatMap(f => {
    if (!f.field.startsWith("language:")) return [f];
    const language = p.languages.find(v => `language:${v.languageCode}` === f.field)!;
    return (["input", "output", "ui"] as const).filter(key => language[`${key}Support`] !== "unknown").map(key => ({ ...f, field: `${f.field}:${key}` }));
  });
  return [...facts.flatMap(f => [
    ...(!f.evidenceId || !evidenceIds.has(f.evidenceId) ? [{ field: f.field, problem: "evidence" as const }] : []),
    ...(!f.verifiedAt ? [{ field: f.field, problem: "verifiedAt" as const }] : []),
  ]), ...p.plans.flatMap(plan => plan.prices.filter(priceNeedsBillingPeriod).map(price => ({ field: `price:${plan.planKey}:${price.id}`, problem: "billingPeriod" as const })))];
}
export async function lookupAdminVendors(input: unknown = {}) {
  const f = LookupSchema.parse(input), query = `%${f.q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const rows = await sql<VendorRow[]>`SELECT * FROM af_vendors WHERE name ILIKE ${query} OR slug ILIKE ${query}
    ORDER BY name, id LIMIT 51 OFFSET ${(f.page - 1) * 50}`;
  return { rows: rows.slice(0, 50).map(vendorDto), page: f.page, hasMore: rows.length > 50 };
}
export async function lookupAdminEvidence(input: unknown = {}) {
  const f = LookupSchema.parse(input), query = `%${f.q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const rows = await sql<EvidenceRow[]>`SELECT * FROM af_evidence WHERE title ILIKE ${query} OR url ILIKE ${query} OR publisher ILIKE ${query}
    ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET ${(f.page - 1) * 50}`;
  return { rows: rows.slice(0, 50).map(evidenceDto), page: f.page, hasMore: rows.length > 50 };
}
export async function listAdminVendors(db: Tx | typeof sql = sql) {
  return (await db<VendorRow[]>`SELECT * FROM af_vendors ORDER BY name, id LIMIT 200`).map(vendorDto);
}
export async function listAdminEvidence(db: Tx | typeof sql = sql) {
  return (await db<EvidenceRow[]>`SELECT * FROM af_evidence ORDER BY created_at DESC, id DESC LIMIT 200`).map(evidenceDto);
}
export async function readAdminProduct(productId: string): Promise<ProductAdminDetail> {
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [p] = await tx<(IdentityRow & { identity_revision: number })[]>`SELECT * FROM af_products WHERE id=${productId}`;
    if (!p) throw new NotFound("製品が見つかりません。");
    const versions = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} ORDER BY version_no DESC LIMIT 100`;
    const active = versions.filter(v => v.status === "published" || v.status === "draft");
    const snapshots = await readProducts(tx, active);
    const published = snapshots.find(p => p.version.status === "published");
    const draft = snapshots.find(p => p.version.status === "draft");
    const draftRow = versions.find(v => v.status === "draft");
    const aliases = await tx<AliasRow[]>`SELECT * FROM af_product_aliases WHERE product_id=${productId} ORDER BY normalized_alias, id`;
    const vendors = await listAdminVendors(tx);
    const [vendor] = p.vendor_id ? await tx<VendorRow[]>`SELECT * FROM af_vendors WHERE id=${p.vendor_id}` : [];
    const pool = await listAdminEvidence(tx);
    const evidence = [...new Map([...pool, ...snapshots.flatMap(p => p.evidence)].map(e => [e.id, e])).values()];
    return { publicSettings: await readPublicSettings(tx,productId,published??null), identity: identityDto(p), identityRevision: p.identity_revision, vendor: vendor ? vendorDto(vendor) : null,
      vendors: [...new Map([...vendors, ...(vendor ? [vendorDto(vendor)] : [])].map(v => [v.id, v])).values()], aliases: aliases.map(aliasDto), published: published ? publishedDto(published) : null,
      draft: draft ? draftDto(draft, draftRow!.created_by) : null, draftRevision: draftRow?.revision ?? null,
      baseVersionId: draftRow?.base_version_id ?? null, history: versions.map(versionDto), evidence,
      publishIssues: draft ? publishIssues(draft) : [] };
  });
}

export async function listAdminProducts(input: unknown = {}): Promise<ProductAdminList> {
  const f = ProductListSchema.parse(input);
  const query = `%${f.q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  return sql.begin("isolation level repeatable read read only", async tx => {
    const rows = await tx<(IdentityRow & { vendor_name: string | null; needs_review: boolean })[]>`
      SELECT p.*, ve.name AS vendor_name, EXISTS(SELECT 1 FROM af_product_change_candidates c
        WHERE c.product_id=p.id AND c.status IN ('pending_review','approved')) AS needs_review
      FROM af_products p LEFT JOIN af_vendors ve ON ve.id=p.vendor_id
      WHERE p.canonical_name ILIKE ${query}
        AND (${f.filter}='all'
          OR (${f.filter}='published' AND EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND v.status='published'))
          OR (${f.filter}='draft' AND EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND v.status='draft'))
          OR (${f.filter}='no_published' AND NOT EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND v.status='published'))
          OR (${f.filter}='needs_review' AND EXISTS(SELECT 1 FROM af_product_change_candidates c WHERE c.product_id=p.id AND c.status IN ('pending_review','approved'))))
      ORDER BY p.canonical_name, p.id LIMIT 51 OFFSET ${(f.page - 1) * 50}`;
    const ids = rows.slice(0, 50).map(p => p.id);
    const versions = ids.length ? await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id IN ${tx(ids)} AND status IN ('published','draft')` : [];
    const published = await readProducts(tx, versions.filter(v => v.status === "published"));
    return { page: f.page, hasMore: rows.length > 50, rows: rows.slice(0, 50).map(p => {
      const pub = published.find(v => v.identity.id === p.id); const draft = versions.find(v => v.product_id === p.id && v.status === "draft");
      return { id: p.id, canonicalName: p.canonical_name, slug: p.slug, vendorName: p.vendor_name,
        publishedVersionNo: pub?.version.versionNo ?? null, draftVersionNo: draft?.version_no ?? null,
        lifecycleStatus: pub?.version.lifecycleStatus ?? draft?.lifecycle_status ?? "unknown", lastVerifiedAt: pub?.lastVerifiedAt ?? null,
        needsReview: p.needs_review };
    }) };
  });
}

export async function readDashboard(): Promise<Dashboard> {
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [products] = await tx`SELECT count(*) AS total,
      count(*) FILTER(WHERE EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND status='published')) AS published,
      count(*) FILTER(WHERE EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND status='draft')) AS draft,
      count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM af_product_versions v WHERE v.product_id=p.id AND status='published')) AS no_published,
      count(*) FILTER(WHERE vendor_id IS NULL) AS no_vendor FROM af_products p`;
    const [review] = await tx`SELECT count(*) FILTER(WHERE status='pending_review') AS pending,
      count(*) FILTER(WHERE status='approved') AS approved, count(*) FILTER(WHERE status='rejected') AS rejected,
      count(*) FILTER(WHERE status='applied') AS applied FROM af_product_change_candidates`;
    const drafts = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE status='draft'`;
    const issues = (await readProducts(tx, drafts)).flatMap(publishIssues);
    return { products: { total: Number(products.total), published: Number(products.published), draft: Number(products.draft), noPublished: Number(products.no_published) },
      review: { pending: Number(review.pending), approved: Number(review.approved), rejected: Number(review.rejected), applied: Number(review.applied) },
      dataHealth: { factsMissingEvidence: issues.filter(i => i.problem === "evidence").length,
        factsMissingVerifiedAt: issues.filter(i => i.problem === "verifiedAt").length, productsWithoutVendor: Number(products.no_vendor) } };
  });
}
