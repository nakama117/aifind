import { sql, type Tx } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { createProduct, createVendor, updateVendor, updateProductIdentity, addProductAlias } from "../catalog/identity.ts";
import type { IdentityRow, VendorRow } from "../catalog/identity.ts";
import { clonePublishedProduct, createProductDraft, updateProductDraft, STALE_DRAFT_MESSAGE } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { createEvidence } from "../catalog/evidence.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { readProducts, draftDto } from "../catalog/read.ts";
import type { VersionRow } from "../catalog/read.ts";
import { CreateProductSchema, IdentityEditSchema, AddAliasSchema, CreateVendorSchema, EditVendorSchema, AddEvidenceSchema, ActionSchema, DraftSaveSchema, PublishSchema } from "./contracts.ts";
import type { AdminDraftResult } from "./contracts.ts";
import { NotFound, InvalidInput, PublishValidation } from "./errors.ts";
import { publishIssues } from "./read.ts";

export async function adminTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try { return await sql.begin("isolation level read committed", fn) as T; }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") throw new Conflict("同じ slug / key / 別名がすでに存在します。最新の内容を確認してください。");
    if (code === "23503") throw new InvalidInput("参照先が存在しないか、この製品に属していません。");
    if (code === "23514") throw new InvalidInput("Domain の制約に一致しない入力です。");
    throw error;
  }
}
export async function lockAdminProduct(tx: Tx, id: string) {
  const [p] = await tx<(IdentityRow & { identity_revision: number })[]>`SELECT * FROM af_products WHERE id=${id} FOR UPDATE`;
  if (!p) throw new NotFound("製品が見つかりません。");
  return p;
}
export async function lockAdminDraft(tx: Tx, productId: string, versionId: string, expectedRevision: number) {
  const [v] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id=${versionId} AND product_id=${productId} FOR UPDATE`;
  if (!v) throw new NotFound("製品のバージョンが見つかりません。");
  if (v.status !== "draft" || v.revision !== expectedRevision) throw new Conflict(STALE_DRAFT_MESSAGE);
  return v;
}
async function vendorExists(tx: Tx, id?: string | null) {
  if (id && !(await tx`SELECT id FROM af_vendors WHERE id=${id}`).length) throw new InvalidInput("Vendor が見つかりません。");
}
export async function createAdminProduct(input: unknown, actor: string) {
  const { reason, ...p } = CreateProductSchema.parse(input);
  return adminTransaction(async tx => {
    await vendorExists(tx, p.vendorId);
    const product = await createProduct(p, tx);
    await audit(actor, "aifind.product.create", `aifind:product:${product.id}`, reason, null, product, { db: tx });
    return product;
  });
}
export async function updateAdminIdentity(id: string, input: unknown, actor: string) {
  const { reason, expectedRevision, ...p } = IdentityEditSchema.parse(input);
  return adminTransaction(async tx => {
    const before = await lockAdminProduct(tx, id);
    if (before.identity_revision !== expectedRevision) throw new Conflict("製品の Identity は更新されています。最新の内容を再読み込みしてください。");
    await vendorExists(tx, p.vendorId);
    const product = await updateProductIdentity(id, p, tx);
    await audit(actor, "aifind.identity.edit", `aifind:product:${id}`, reason, before, product, { db: tx });
    return product;
  });
}
export async function addAdminAlias(id: string, input: unknown, actor: string) {
  const { reason, ...p } = AddAliasSchema.parse(input);
  return adminTransaction(async tx => {
    await lockAdminProduct(tx, id);
    const alias = await addProductAlias(id, p, tx);
    await audit(actor, "aifind.alias.add", `aifind:product:${id}`, reason, null, alias, { db: tx });
    return alias;
  });
}
export async function createAdminVendor(input: unknown, actor: string) {
  const { reason, ...p } = CreateVendorSchema.parse(input);
  return adminTransaction(async tx => {
    const vendor = await createVendor(p, tx);
    await audit(actor, "aifind.vendor.create", `aifind:vendor:${vendor.id}`, reason, null, vendor, { db: tx });
    return vendor;
  });
}
export async function updateAdminVendor(id: string, input: unknown, actor: string) {
  const { reason, expectedUpdatedAt, ...p } = EditVendorSchema.parse(input);
  return adminTransaction(async tx => {
    const [before] = await tx<VendorRow[]>`SELECT * FROM af_vendors WHERE id=${id} FOR UPDATE`;
    if (!before) throw new NotFound("Vendor が見つかりません。");
    if (before.updated_at.toISOString() !== expectedUpdatedAt) throw new Conflict("Vendor は更新されています。最新の内容を再読み込みしてください。");
    const vendor = await updateVendor(id, p, tx);
    await audit(actor, "aifind.vendor.edit", `aifind:vendor:${id}`, reason, before, vendor, { db: tx });
    return vendor;
  });
}
export async function addAdminEvidence(input: unknown, actor: string) {
  const { reason, ...p } = AddEvidenceSchema.parse(input);
  return adminTransaction(async tx => {
    const evidence = await createEvidence(p, tx);
    await audit(actor, "aifind.evidence.add", `aifind:evidence:${evidence.id}`, reason, null, evidence, { db: tx });
    return evidence;
  });
}
async function draftResult(tx: Tx, versionId: string): Promise<AdminDraftResult> {
  const [v] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id=${versionId}`;
  return { draft: draftDto((await readProducts(tx, [v]))[0], v.created_by), revision: v.revision };
}
export async function createAdminDraft(id: string, input: unknown, actor: string): Promise<AdminDraftResult> {
  const { reason } = ActionSchema.parse(input);
  return adminTransaction(async tx => {
    const p = await lockAdminProduct(tx, id);
    const [pub] = await tx`SELECT id FROM af_product_versions WHERE product_id=${id} AND status='published'`;
    const draft = pub ? await clonePublishedProduct(id, actor, tx) : await createProductDraft(id, { displayName: p.canonical_name }, actor, tx);
    const result = await draftResult(tx, draft.version.id);
    await audit(actor, "aifind.draft.create", `aifind:product:${id}`, reason, pub ? { baseVersionId: pub.id } : null,
      { versionId: draft.version.id, revision: result.revision }, { db: tx });
    return result;
  });
}
export async function saveAdminDraft(id: string, versionId: string, input: unknown, actor: string): Promise<AdminDraftResult> {
  const p = DraftSaveSchema.parse(input);
  return adminTransaction(async tx => {
    await lockAdminProduct(tx, id);
    const before = await lockAdminDraft(tx, id, versionId, p.expectedRevision);
    if (p.version) await updateProductDraft(id, versionId, p.version, tx);
    for (const fact of p.markets ?? []) await setProductMarket(id, versionId, fact, tx);
    for (const fact of p.languages ?? []) await setProductLanguageSupport(id, versionId, fact, tx);
    for (const fact of p.platforms ?? []) await setProductPlatform(id, versionId, fact, tx);
    for (const fact of p.capabilities ?? []) await setProductCapability(id, versionId, fact, tx);
    for (const { prices, ...planInput } of p.plans ?? []) {
      const plan = await saveProductPlan(id, versionId, planInput, tx);
      for (const price of prices) {
        if (price.id && !(await tx`SELECT id FROM af_product_prices WHERE id=${price.id} AND plan_id=${plan.id}`).length)
          throw new InvalidInput("Price はこの Draft の Plan に属していません。");
        await saveProductPrice(id, versionId, plan.id, price, tx);
      }
    }
    const result = await draftResult(tx, versionId);
    await audit(actor, "aifind.draft.edit", `aifind:product:${id}`, p.reason,
      { versionId, revision: before.revision }, { versionId, revision: result.revision, changes: p }, { db: tx });
    return result;
  });
}
export async function publishAdminDraft(id: string, versionId: string, input: unknown, actor: string) {
  const p = PublishSchema.parse(input);
  return adminTransaction(async tx => {
    await lockAdminProduct(tx, id);
    const version = await lockAdminDraft(tx, id, versionId, p.expectedRevision);
    const issues = publishIssues((await readProducts(tx, [version]))[0]);
    if (issues.length) throw new PublishValidation(issues);
    return publishProductVersion(id, versionId, actor, p.reason, { db: tx, expectedRevision: p.expectedRevision });
  });
}
