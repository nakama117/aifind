import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { setProductPlatform, setProductMarket } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { updateProductDraft } from "../catalog/versions.ts";
import { makeDraft } from "./fixtures.ts";
import { actor, reason, publishedFixture, slug } from "./admin-fixtures.ts";

after(closeDb);

test("fixed/from require a billing period in Draft, Candidate and publish validation", async () => {
  const { DraftSaveSchema, CandidateSchema } = await import("../admin/contracts.ts");
  const f = await publishedFixture(), a = await admin(), r = await reader();
  const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  for (const priceType of ["fixed", "from"] as const) {
    const price = { priceType, currencyCode: "USD", amountMinor: 1999, billingPeriod: "none", ...f.proof };
    assert.equal(DraftSaveSchema.safeParse({ expectedRevision: d.revision, reason, plans: [{ planKey: "period", name: "Period", prices: [price] }] }).success, false);
    assert.equal(CandidateSchema.safeParse({ productId: f.product.id, baseVersionId: f.published.version.id, sourceType: "manual", reason,
      evidenceId: f.proof.evidenceId, candidateType: "price", targetKey: "period", proposedValue: price }).success, false);
    for (const billingPeriod of ["month", "year", "usage", "one_time"])
      assert.equal(DraftSaveSchema.safeParse({ expectedRevision: d.revision, reason, plans: [{ planKey: "period", name: "Period", prices: [{ ...price, billingPeriod }] }] }).success, true);
  }
  const plan = await saveProductPlan(f.product.id, d.draft.version.id, { planKey: "period", name: "Period", ...f.proof });
  await saveProductPrice(f.product.id, d.draft.version.id, plan.id, { priceType: "fixed", currencyCode: "USD", amountMinor: 1999, billingPeriod: "none", ...f.proof });
  const current = await r.readAdminProduct(f.product.id);
  assert.ok(current.publishIssues.some(i => i.field.startsWith("price:period:") && i.problem === "billingPeriod"));
  await assert.rejects(a.publishAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: current.draftRevision, reason }, actor), { statusCode: 422 });
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), f.published);
});

test("Admin selectors search and paginate beyond 50 products and 200 vendors/evidence", async () => {
  const r = await reader(); const { createProductDraft } = await import("../catalog/versions.ts");
  const { createProduct } = await import("../catalog/identity.ts"); const { publishProductVersion } = await import("../catalog/publish.ts");
  const prefix = slug();
  const vendors = Array.from({ length: 205 }, (_, i) => ({ id: randomUUID(), slug: `${prefix}-v-${i}`, name: `${prefix} Vendor ${String(i).padStart(3, "0")}` }));
  const evidence = Array.from({ length: 205 }, (_, i) => ({ id: randomUUID(), url: `https://synthetic.example.invalid/${prefix}/${i}`, title: `${prefix} Evidence ${String(i).padStart(3, "0")}`,
    source_kind: "official_product", retrieved_at: "2026-10-06T00:00:00Z" }));
  await sql`INSERT INTO af_vendors ${sql(vendors)}`;
  await sql`INSERT INTO af_evidence ${sql(evidence)}`;
  for (let i = 0; i < 55; i++) {
    const p = await createProduct({ slug: `${prefix}-p-${i}`, canonicalName: `${prefix} Product ${String(i).padStart(3, "0")}` });
    const d = await createProductDraft(p.id, { displayName: p.canonicalName }, actor);
    await publishProductVersion(p.id, d.version.id, actor, reason);
  }
  const first = await r.listAdminProducts({ q: `${prefix} Product`, filter: "published", page: 1 });
  assert.equal(first.rows.length, 50); assert.equal(first.hasMore, true);
  const second = await r.listAdminProducts({ q: `${prefix} Product`, filter: "published", page: 2 });
  assert.equal(second.rows.length, 5); assert.equal(second.hasMore, false);
  const vendorPage = await r.lookupAdminVendors({ q: `${prefix} Vendor`, page: 5 });
  assert.equal(vendorPage.rows.length, 5); assert.equal(vendorPage.hasMore, false);
  assert.equal((await r.lookupAdminVendors({ q: vendors[204].name })).rows[0].name, vendors[204].name);
  const evidencePage = await r.lookupAdminEvidence({ q: `${prefix} Evidence`, page: 5 });
  assert.equal(evidencePage.rows.length, 5); assert.equal(evidencePage.hasMore, false);
  assert.equal((await r.lookupAdminEvidence({ q: evidence[204].title })).rows[0].title, evidence[204].title);
  assert.ok((await r.lookupAdminVendors({})).rows.length <= 50);
  assert.ok((await r.lookupAdminEvidence({})).rows.length <= 50);
  await assert.rejects(r.lookupAdminEvidence({ page: 0 }));
});

test("legacy Vendor empty updates remain valid without changing its identity fields", async () => {
  const { createVendor, updateVendor } = await import("../catalog/identity.ts");
  const v = await createVendor({ name: "[TEST] Legacy no-op", slug: slug() });
  const updated = await updateVendor(v.id, {});
  assert.equal(updated.name, v.name); assert.equal(updated.slug, v.slug);
  assert.ok(updated.updatedAt > v.updatedAt);
});

test("A22 one existing audit chain records Product/Draft/Evidence/review/apply/publish with actor and reason", async () => {
  const a = await admin(); const { createCandidate, reviewCandidate } = await import("../changes/candidates.ts");
  const { applyCandidate } = await import("../changes/apply.ts");
  const p = await a.createAdminProduct({ slug: slug(), canonicalName: "[TEST] Audit workflow", reason }, actor);
  const evidence = await a.addAdminEvidence({ url: "https://preview.example.invalid/audit", sourceKind: "official_product", retrievedAt: "2026-10-06T00:00:00Z", reason }, actor);
  const draft = await a.createAdminDraft(p.id, { reason }, actor);
  const saved = await a.saveAdminDraft(p.id, draft.draft.version.id, { expectedRevision: draft.revision, version: { displayName: "[TEST] Audited draft" }, reason }, actor);
  const published = await a.publishAdminDraft(p.id, draft.draft.version.id, { expectedRevision: saved.revision, reason }, actor);
  const proposal = { productId: p.id, baseVersionId: published.version.id, candidateType: "market", targetKey: "JP", evidenceId: evidence.id, sourceType: "manual", reason,
    proposedValue: { marketCode: "JP", availabilityStatus: "available", evidenceId: evidence.id, verifiedAt: "2026-10-06T00:00:00Z" } };
  const approved = await createCandidate(proposal, actor), rejected = await createCandidate(proposal, actor);
  await reviewCandidate(approved.id, "approve", { reason }, actor); await reviewCandidate(rejected.id, "reject", { reason }, actor);
  await applyCandidate(approved.id, { reason }, actor);
  const rows = await sql`SELECT action,actor,reason FROM audit_log WHERE subject IN (${`aifind:product:${p.id}`},${`aifind:evidence:${evidence.id}`},${`aifind:candidate:${approved.id}`},${`aifind:candidate:${rejected.id}`})`;
  for (const action of ["aifind.product.create", "aifind.draft.create", "aifind.draft.edit", "aifind.evidence.add", "aifind.candidate.create", "aifind.candidate.approve", "aifind.candidate.reject", "aifind.candidate.apply", "aifind.product.publish"])
    assert.ok(rows.some(r => r.action === action && r.actor === actor && r.reason === reason), action);
});
async function admin() {
  assert.ok(existsSync(new URL("../admin/products.ts", import.meta.url)), "Product Admin services must exist");
  return import("../admin/products.ts");
}
async function reader() {
  assert.ok(existsSync(new URL("../admin/read.ts", import.meta.url)), "Product Admin reader must exist");
  return import("../admin/read.ts");
}

test("A04 Admin list filters, searches and paginates real product/version data", async () => {
  const a = await admin(); const r = await reader();
  const product = await a.createAdminProduct({ slug: slug(), canonicalName: "[TEST] Unique admin list name", reason }, actor);
  const initial = await a.createAdminDraft(product.id, { reason }, actor);
  const found = await r.listAdminProducts({ q: "Unique admin list", filter: "no_published", page: 1 });
  assert.equal(found.rows.length, 1);
  assert.equal(found.rows[0].publishedVersionNo, null);
  assert.equal(found.rows[0].draftVersionNo, initial.draft.version.versionNo);
  assert.equal((await r.listAdminProducts({ q: "Unique admin list", filter: "published", page: 1 })).rows.length, 0);
  const dash = await r.readDashboard();
  assert.ok(dash.products.total >= 1);
  assert.ok(dash.dataHealth.productsWithoutVendor >= 1);
  assert.ok(dash.products.noPublished >= 1);
  assert.doesNotMatch(JSON.stringify(found), /csrf|adminPassword|createdBy/);
});

test("A05 Create Draft clones every current Published fact and records its base", async () => {
  const a = await admin(); const r = await reader(); const f = await publishedFixture();
  const clone = await a.createAdminDraft(f.product.id, { reason }, actor);
  const detail = await r.readAdminProduct(f.product.id);
  assert.equal(detail.baseVersionId, f.published.version.id);
  assert.equal(detail.draft!.version.id, clone.draft.version.id);
  assert.equal(detail.draft!.languages.find(l => l.languageCode === "ja")!.inputSupport, "full");
  assert.equal(detail.published!.version.id, f.published.version.id);
  await assert.rejects(a.createAdminDraft(f.product.id, { reason }, actor), { code: "conflict" });
});

test("A06 structured Draft save changes only Draft; unknown stays distinct from negative states", async () => {
  const a = await admin(); const f = await publishedFixture();
  const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const before = await getPublishedProductBySlug(f.product.slug);
  const saved = await a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason,
    languages: [{ languageCode: "ja", inputSupport: "full", outputSupport: "partial", uiSupport: "full", ...f.proof }],
    platforms: [{ platformKey: "android", status: "unavailable", ...f.proof }, { platformKey: "ios", status: "unknown" }],
  }, actor);
  assert.equal(saved.draft.languages.find(l => l.languageCode === "ja")!.uiSupport, "full");
  assert.equal(saved.draft.platforms.find(p => p.platformKey === "ios")!.status, "unknown");
  assert.equal(saved.draft.platforms.find(p => p.platformKey === "android")!.status, "unavailable");
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
});

test("A07 stale Draft edit rejects the old token rather than overwriting the winner", async () => {
  const a = await admin(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const results = await Promise.allSettled(["winner one", "winner two"].map(displayName => a.saveAdminDraft(f.product.id, d.draft.version.id,
    { expectedRevision: d.revision, reason, version: { displayName } }, actor)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "conflict");
  assert.match(rejected.reason.message, /最新の内容を再読み込み/);
  const winner = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<{ draft: { version: { displayName: string } } }>).value;
  const detail = await (await reader()).readAdminProduct(f.product.id);
  assert.equal(detail.draft!.version.displayName, winner.draft.version.displayName);
});

test("Draft tokens also become stale after legacy Catalog, plan, price and direct SQL writes", async () => {
  const a = await admin(); const r = await reader(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const id = d.draft.version.id;
  const writes = [
    () => updateProductDraft(f.product.id, id, { displayName: "Legacy preview edit" }),
    () => setProductPlatform(f.product.id, id, { platformKey: "web", status: "unknown" }),
    () => sql`INSERT INTO af_product_capabilities(product_version_id, capability_key, support_level) VALUES (${id}, 'text', 'unknown')`,
    async () => { const plan = await saveProductPlan(f.product.id, id, { planKey: "token-plan", name: "Plan" });
      await saveProductPrice(f.product.id, id, plan.id, { priceType: "unknown", billingPeriod: "none" }); },
  ];
  for (const write of writes) {
    const prior = (await r.readAdminProduct(f.product.id)).draftRevision!;
    await write();
    const latest = (await r.readAdminProduct(f.product.id)).draftRevision!;
    assert.ok(latest > prior);
    await assert.rejects(a.saveAdminDraft(f.product.id, id, { expectedRevision: prior, reason, version: { displayName: "Stale" } }, actor), { code: "conflict" });
  }
});

test("A08 explicit unverified facts save as Draft but publish reports their exact missing fields", async () => {
  const a = await admin(); const r = await reader(); const f = await makeDraft();
  const initial = await r.readAdminProduct(f.product.id);
  await a.saveAdminDraft(f.product.id, f.draft.version.id, { expectedRevision: initial.draftRevision!, reason,
    markets: [{ marketCode: "JP", availabilityStatus: "available" }], platforms: [{ platformKey: "ios", status: "unavailable" }],
  }, actor);
  const detail = await r.readAdminProduct(f.product.id);
  assert.ok(detail.publishIssues.some(i => i.field === "market:JP" && i.problem === "evidence"));
  assert.ok(detail.publishIssues.some(i => i.field === "platform:ios" && i.problem === "verifiedAt"));
  await assert.rejects(a.publishAdminDraft(f.product.id, f.draft.version.id, { expectedRevision: detail.draftRevision!, reason }, actor), { statusCode: 422 });
  assert.equal(await getPublishedProductBySlug(f.product.slug), null);
});

test("A09 unknown facts and prices without evidence may be published without inventing verification", async () => {
  const a = await admin(); const r = await reader(); const f = await makeDraft(); const detail = await r.readAdminProduct(f.product.id);
  const d = await a.saveAdminDraft(f.product.id, f.draft.version.id, { expectedRevision: detail.draftRevision!, reason,
    markets: [{ marketCode: "JP", availabilityStatus: "unknown" }],
    plans: [{ planKey: "unknown", name: "未確認", prices: [{ priceType: "unknown", amountMinor: null, billingPeriod: "none" }] }],
  }, actor);
  const published = await a.publishAdminDraft(f.product.id, f.draft.version.id, { expectedRevision: d.revision, reason }, actor);
  assert.equal(published.lastVerifiedAt, null);
  assert.equal(published.plans[0].prices[0].amountMinor, null);
});

test("A10 Publish uses the Domain transition and audit, leaving history superseded and no Draft", async () => {
  const a = await admin(); const r = await reader(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const saved = await a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason, version: { displayName: "Published next" } }, actor);
  const result = await a.publishAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: saved.revision, reason }, actor);
  const detail = await r.readAdminProduct(f.product.id);
  assert.equal(result.version.id, d.draft.version.id);
  assert.equal(detail.draft, null);
  assert.equal(detail.history.find(v => v.id === f.published.version.id)!.status, "superseded");
  const audits = await sql`SELECT action, actor, reason FROM audit_log WHERE subject=${`aifind:product:${f.product.id}`} AND action='aifind.product.publish'`;
  assert.equal(audits.length, 2);
  assert.equal(audits.at(-1)!.actor, actor);
  await assert.rejects(sql`UPDATE af_product_versions SET display_name='Forbidden' WHERE id=${result.version.id}`, /immutable/);
});

test("A11 Publish failure rolls back both version transition and audit", async () => {
  const a = await admin(); const r = await reader(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  await sql.unsafe(`CREATE FUNCTION af_test_publish_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${d.draft.version.id}' AND NEW.status='published' THEN RAISE EXCEPTION 'intentional admin publish rollback'; END IF; RETURN NEW; END $$`);
  await sql.unsafe("CREATE TRIGGER af_test_publish_fail BEFORE UPDATE ON af_product_versions FOR EACH ROW EXECUTE FUNCTION af_test_publish_fail()");
  const before = await getPublishedProductBySlug(f.product.slug);
  const n = (await sql`SELECT count(*) AS n FROM audit_log`)[0].n;
  try { await assert.rejects(a.publishAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason }, actor), /intentional admin publish rollback/); }
  finally { await sql.unsafe("DROP TRIGGER af_test_publish_fail ON af_product_versions; DROP FUNCTION af_test_publish_fail()"); }
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  assert.equal((await r.readAdminProduct(f.product.id)).draftRevision, d.revision);
  assert.equal((await sql`SELECT count(*) AS n FROM audit_log`)[0].n, n);
});

test("A12 decimal UI input converts exactly to bounded integer minor units, rejecting excess precision", async () => {
  assert.ok(existsSync(new URL("../admin/contracts.ts", import.meta.url)), "Admin price contract must exist");
  const { parseAmountMinor, formatAmountMinor } = await import("../admin/contracts.ts");
  for (const [currency, amount, want] of [["USD", "19.99", 1999], ["USD", "0.29", 29], ["JPY", "2000", 2000], ["EUR", "90.01", 9001], ["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER]] as const) {
    assert.equal(parseAmountMinor(amount, currency), want);
    assert.equal(parseAmountMinor(formatAmountMinor(want, currency), currency), want);
  }
  for (const [amount, currency] of [["19.999", "USD"], ["20.1", "JPY"], ["-1", "JPY"], ["1e2", "USD"], ["90071992547409.92", "USD"], ["NaN", "USD"]] as const) assert.throws(() => parseAmountMinor(amount, currency));
  const a = await admin(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const saved = await a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason,
    plans: [{ planKey: "precise", name: "Precision", prices: [{ priceType: "fixed", currencyCode: "USD", amountMinor: 1999, billingPeriod: "month" }] }],
  }, actor);
  assert.equal(saved.draft.plans[0].prices[0].amountMinor, 1999);
  assert.equal((await sql`SELECT amount_minor::text AS amount FROM af_product_prices WHERE id=${saved.draft.plans[0].prices[0].id}`)[0].amount, "1999");
});

test("A13 free, fixed, from, custom and unknown retain independent price shapes", async () => {
  const a = await admin(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const prices = [
    { priceType: "free", amountMinor: 0, billingPeriod: "none" },
    { priceType: "fixed", amountMinor: 2000, currencyCode: "JPY", billingPeriod: "month" },
    { priceType: "from", amountMinor: 1000, currencyCode: "JPY", billingPeriod: "month" },
    { priceType: "custom", amountMinor: null, billingPeriod: "custom" },
    { priceType: "unknown", amountMinor: null, billingPeriod: "none" },
  ];
  const saved = await a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason,
    plans: prices.map(p => ({ planKey: p.priceType, name: p.priceType, prices: [p] })),
  }, actor);
  for (const p of prices) assert.equal(saved.draft.plans.find(plan => plan.planKey === p.priceType)!.prices[0].amountMinor, p.amountMinor);
  await assert.rejects(a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: saved.revision, reason,
    plans: [{ planKey: "bad", name: "Bad", prices: [{ priceType: "unknown", amountMinor: 0, billingPeriod: "none" }] }],
  }, actor));
});

test("Identity edits are guarded by revision, unique slug and ownership while default SQL slugs stay stable", async () => {
  const a = await admin(); const r = await reader(); const f = await makeDraft();
  const detail = await r.readAdminProduct(f.product.id); const changedSlug = slug();
  await a.updateAdminIdentity(f.product.id, { expectedRevision: detail.identityRevision, reason, canonicalName: "Changed", slug: changedSlug, vendorId: f.vendor.id }, actor);
  assert.equal((await r.readAdminProduct(f.product.id)).identity.slug, changedSlug);
  await assert.rejects(a.updateAdminIdentity(f.product.id, { expectedRevision: detail.identityRevision, reason, canonicalName: "Stale", slug: changedSlug }, actor), { code: "conflict" });
  await assert.rejects(sql`UPDATE af_products SET slug='bypass' WHERE id=${f.product.id}`, /slug/);
  const other = await a.createAdminProduct({ slug: slug(), canonicalName: "Other", reason }, actor);
  const current = await r.readAdminProduct(f.product.id);
  await assert.rejects(a.updateAdminIdentity(f.product.id, { expectedRevision: current.identityRevision, reason, canonicalName: "Duplicate", slug: other.slug }, actor), { code: "conflict" });
});

test("A22 manual mutations use the existing audit chain and immutable Evidence corrections preserve history", async () => {
  const a = await admin(); const r = await reader();
  const vendor = await a.createAdminVendor({ slug: slug(), name: "Synthetic audit vendor", reason }, actor);
  const updated = await a.updateAdminVendor(vendor.id, { expectedUpdatedAt: vendor.updatedAt, name: "Renamed vendor", reason }, actor);
  await assert.rejects(a.updateAdminVendor(vendor.id, { expectedUpdatedAt: vendor.updatedAt, name: "Stale vendor", reason }, actor), { code: "conflict" });
  const p = await a.createAdminProduct({ slug: slug(), canonicalName: "Synthetic audit product", vendorId: updated.id, reason }, actor);
  await a.addAdminAlias(p.id, { alias: "合成別名", aliasType: "common", reason }, actor);
  const d = await a.createAdminDraft(p.id, { reason }, actor);
  const e = await a.addAdminEvidence({ url: "https://synthetic.example.invalid/proof", sourceKind: "official_docs", retrievedAt: "2026-10-06T00:00:00Z", reason }, actor);
  await a.saveAdminDraft(p.id, d.draft.version.id, { expectedRevision: d.revision, reason,
    markets: [{ marketCode: "JP", availabilityStatus: "available", evidenceId: e.id, verifiedAt: "2026-10-06T01:00:00Z" }],
  }, actor);
  const actions = (await sql`SELECT action FROM audit_log WHERE actor=${actor}`).map(row => row.action);
  for (const action of ["aifind.product.create", "aifind.draft.create", "aifind.draft.edit", "aifind.evidence.add", "aifind.alias.add", "aifind.vendor.create", "aifind.vendor.edit"]) assert.ok(actions.includes(action), action);
  assert.equal((await r.readAdminProduct(p.id)).draft!.evidence[0].id, e.id);
  await assert.rejects(sql`UPDATE af_evidence SET url='https://changed.invalid' WHERE id=${e.id}`, /immutable/);
});

test("multi-field Draft save and audit failure roll back facts and revision together", async () => {
  const a = await admin(); const r = await reader(); const f = await publishedFixture(); const d = await a.createAdminDraft(f.product.id, { reason }, actor);
  const before = await r.readAdminProduct(f.product.id);
  await sql.unsafe("CREATE FUNCTION af_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='aifind.draft.edit' THEN RAISE EXCEPTION 'intentional admin audit rollback'; END IF; RETURN NEW; END $$");
  await sql.unsafe("CREATE TRIGGER af_test_audit_fail BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION af_test_audit_fail()");
  try { await assert.rejects(a.saveAdminDraft(f.product.id, d.draft.version.id, { expectedRevision: d.revision, reason,
    version: { displayName: "Must rollback" }, markets: [{ marketCode: "US", availabilityStatus: "unknown" }],
  }, actor), /intentional admin audit rollback/); }
  finally { await sql.unsafe("DROP TRIGGER af_test_audit_fail ON audit_log; DROP FUNCTION af_test_audit_fail()"); }
  const afterSave = await r.readAdminProduct(f.product.id);
  assert.deepEqual(afterSave.draft, before.draft);
  assert.equal(afterSave.draftRevision, before.draftRevision);
});
