import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { clonePublishedProduct, getDraftProduct, updateProductDraft } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { makeDraft, proof, markPublished } from "./fixtures.ts";

after(closeDb);
async function domain() {
  assert.ok(existsSync(new URL("../catalog/publish.ts", import.meta.url)), "atomic publish primitive must exist");
  return import("../catalog/publish.ts");
}
const actor = "synthetic-editor";
const reason = "合成 fixture の検証";

test("P18 every definite published price requires evidence and verifiedAt", async () => {
  const { publishProductVersion } = await domain();
  for (const priceType of ["free", "fixed", "from", "custom"] as const) {
    const f = await makeDraft();
    const args = [f.product.id, f.draft.version.id] as const;
    const plan = await saveProductPlan(...args, { planKey: "test", name: "合成" });
    const shape = { priceType, billingPeriod: "month" as const, currencyCode: "JPY" as const,
      amountMinor: priceType === "free" ? 0 : priceType === "custom" ? null : 2000 };
    const price = await saveProductPrice(...args, plan.id, shape);
    await assert.rejects(publishProductVersion(...args, actor, reason), /evidence|verification/i);
    const verified = await proof();
    await saveProductPrice(...args, plan.id, { ...shape, id: price.id, evidenceId: verified.evidenceId });
    await assert.rejects(publishProductVersion(...args, actor, reason), /verification/i);
    await saveProductPrice(...args, plan.id, { ...shape, id: price.id, ...verified });
    assert.equal((await publishProductVersion(...args, actor, reason)).plans[0].prices[0].priceType, priceType);
  }
});

test("P19 all definite availability states require evidence and verifiedAt", async () => {
  const { publishProductVersion } = await domain();
  for (const availabilityStatus of ["available", "unavailable", "waitlist", "restricted"] as const) {
    const f = await makeDraft();
    const args = [f.product.id, f.draft.version.id] as const;
    await setProductMarket(...args, { marketCode: "JP", availabilityStatus });
    await assert.rejects(publishProductVersion(...args, actor, reason), /evidence|verification/i);
    const verified = await proof();
    await setProductMarket(...args, { marketCode: "JP", availabilityStatus, verifiedAt: verified.verifiedAt });
    await assert.rejects(publishProductVersion(...args, actor, reason), /evidence/i);
    await setProductMarket(...args, { marketCode: "JP", availabilityStatus, ...verified });
    assert.equal((await publishProductVersion(...args, actor, reason)).markets[0].availabilityStatus, availabilityStatus);
  }
});

test("lifecycle, language, platform, capability and plan assertions also require evidence and verification", async () => {
  const { publishProductVersion } = await domain();
  const changes = [
    (p: string, v: string) => updateProductDraft(p, v, { lifecycleStatus: "discontinued" }),
    (p: string, v: string) => setProductLanguageSupport(p, v, { languageCode: "ja", inputSupport: "none", outputSupport: "unknown", uiSupport: "unknown" }),
    (p: string, v: string) => setProductPlatform(p, v, { platformKey: "web", status: "unavailable" }),
    (p: string, v: string) => setProductCapability(p, v, { capabilityKey: "api", supportLevel: "full" }),
    (p: string, v: string) => saveProductPlan(p, v, { planKey: "test", name: "合成", audience: "enterprise" }),
  ];
  for (const change of changes) {
    const f = await makeDraft();
    await change(f.product.id, f.draft.version.id);
    await assert.rejects(publishProductVersion(f.product.id, f.draft.version.id, actor, reason), /evidence|verification/i);
    assert.equal(await getPublishedProductBySlug(f.product.slug), null);
  }
});

test("P20 all-unknown facts and unknown price can publish without evidence", async () => {
  const { publishProductVersion } = await domain();
  const f = await makeDraft();
  const args = [f.product.id, f.draft.version.id] as const;
  await setProductMarket(...args, { marketCode: "JP", availabilityStatus: "unknown" });
  await setProductLanguageSupport(...args, { languageCode: "ja", inputSupport: "unknown", outputSupport: "unknown", uiSupport: "unknown" });
  await setProductPlatform(...args, { platformKey: "android", status: "unknown" });
  await setProductCapability(...args, { capabilityKey: "coding", supportLevel: "unknown" });
  const plan = await saveProductPlan(...args, { planKey: "test", name: "未調査の合成プラン" });
  await saveProductPrice(...args, plan.id, { priceType: "unknown", amountMinor: null, billingPeriod: "none" });
  const published = await publishProductVersion(...args, actor, reason);
  assert.equal(published.version.status, "published");
  assert.deepEqual(published.evidence, []);
  assert.equal(published.lastVerifiedAt, null);
  assert.equal(published.plans[0].prices[0].amountMinor, null);
});

test("P22 publish atomically supersedes old version and commits audit with the new published snapshot", async () => {
  const { publishProductVersion } = await domain();
  const f = await makeDraft();
  await publishProductVersion(f.product.id, f.draft.version.id, actor, reason);
  const next = await clonePublishedProduct(f.product.id, "private-editor");
  await updateProductDraft(f.product.id, next.version.id, { displayName: "合成 v2" });
  const published = await publishProductVersion(f.product.id, next.version.id, actor, reason);
  assert.equal(published.version.versionNo, 2);
  assert.equal(published.version.displayName, "合成 v2");
  assert.ok(!("createdBy" in published.version));
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), published);
  assert.equal(await getDraftProduct(f.product.id), null);
  const [old] = await sql`SELECT status, superseded_at FROM af_product_versions WHERE id=${f.draft.version.id}`;
  assert.equal(old.status, "superseded");
  assert.ok(old.superseded_at instanceof Date);
  const entries = await sql`SELECT actor, reason, before, after FROM audit_log WHERE subject=${`aifind:product:${f.product.id}`} ORDER BY id`;
  assert.equal(entries.length, 2);
  assert.equal(entries[1].actor, actor);
  assert.equal(entries[1].reason, reason);
  assert.equal(entries[1].before.versionId, f.draft.version.id);
  assert.equal(entries[1].after.versionId, next.version.id);
});

test("P23 failed validation keeps old published, draft and audit unchanged", async () => {
  const { publishProductVersion } = await domain();
  const f = await makeDraft();
  await publishProductVersion(f.product.id, f.draft.version.id, actor, reason);
  const before = await getPublishedProductBySlug(f.product.slug);
  const next = await clonePublishedProduct(f.product.id);
  await setProductMarket(f.product.id, next.version.id, { marketCode: "JP", availabilityStatus: "unavailable" });
  await assert.rejects(publishProductVersion(f.product.id, next.version.id, actor, reason), /evidence|verification/i);
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  assert.equal((await getDraftProduct(f.product.id))?.version.id, next.version.id);
  const [count] = await sql`SELECT count(*)::int AS n FROM audit_log WHERE subject=${`aifind:product:${f.product.id}`}`;
  assert.equal(count.n, 1);
});

test("P23 database error after superseding old version rolls back both transitions and audit", async () => {
  const { publishProductVersion } = await domain();
  const f = await makeDraft();
  await publishProductVersion(f.product.id, f.draft.version.id, actor, reason);
  const before = await getPublishedProductBySlug(f.product.slug);
  const next = await clonePublishedProduct(f.product.id);
  await sql`CREATE FUNCTION af_test_abort_publish() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status='published' THEN RAISE EXCEPTION 'synthetic publication failure'; END IF; RETURN NEW; END; $$`;
  await sql`CREATE TRIGGER af_test_abort_publish BEFORE UPDATE ON af_product_versions FOR EACH ROW EXECUTE FUNCTION af_test_abort_publish()`;
  try {
    await assert.rejects(publishProductVersion(f.product.id, next.version.id, actor, reason), /synthetic publication failure/);
    assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
    assert.equal((await getDraftProduct(f.product.id))?.version.id, next.version.id);
    const [count] = await sql`SELECT count(*)::int AS n FROM audit_log WHERE subject=${`aifind:product:${f.product.id}`}`;
    assert.equal(count.n, 1);
  } finally {
    await sql`DROP TRIGGER af_test_abort_publish ON af_product_versions`;
    await sql`DROP FUNCTION af_test_abort_publish()`;
  }
});

test("publication rejects foreign/non-draft versions and missing audit identity/reason", async () => {
  const { publishProductVersion } = await domain();
  const a = await makeDraft();
  const b = await makeDraft();
  await assert.rejects(publishProductVersion(a.product.id, b.draft.version.id, actor, reason), /belong/);
  await assert.rejects(publishProductVersion(a.product.id, a.draft.version.id, "", reason));
  await assert.rejects(publishProductVersion(a.product.id, a.draft.version.id, actor, " "));
  await publishProductVersion(a.product.id, a.draft.version.id, actor, reason);
  await assert.rejects(publishProductVersion(a.product.id, a.draft.version.id, actor, reason), /draft/);
});

test("concurrent publishers serialize: one succeeds, one conflicts, one published and one audit remain", async () => {
  const { publishProductVersion } = await domain();
  const f = await makeDraft();
  const results = await Promise.allSettled([1, 2].map(() => publishProductVersion(f.product.id, f.draft.version.id, actor, reason)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "conflict");
  const [counts] = await sql`SELECT count(*) FILTER (WHERE status='published')::int AS published,
    count(*) FILTER (WHERE status='draft')::int AS draft FROM af_product_versions WHERE product_id=${f.product.id}`;
  assert.deepEqual({ ...counts }, { published: 1, draft: 0 });
  const [audit] = await sql`SELECT count(*)::int AS n FROM audit_log WHERE subject=${`aifind:product:${f.product.id}`}`;
  assert.equal(audit.n, 1);
});

test("direct SQL cannot bypass evidence gate for published assertions", async () => {
  const f = await makeDraft();
  await setProductCapability(f.product.id, f.draft.version.id, { capabilityKey: "text", supportLevel: "full" });
  await assert.rejects(markPublished(f.draft.version.id), { code: "23514" });
  assert.equal(await getPublishedProductBySlug(f.product.slug), null);
});
