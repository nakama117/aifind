import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { getDraftProduct, clonePublishedProduct } from "../catalog/versions.ts";
import { setProductMarket } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { actor, reason, publishedFixture } from "./admin-fixtures.ts";

after(closeDb);

test("existing-price UI proposals retain region, unit and validity when only amount changes", async () => {
  const { candidatePriceFromPublished } = await import("../admin/contracts.ts");
  const c = await changes(), a = await applyService(), f = await publishedFixture();
  const d = await clonePublishedProduct(f.product.id, actor);
  const plan = await saveProductPlan(f.product.id, d.version.id, { planKey: "regional", name: "Regional", ...f.proof });
  await saveProductPrice(f.product.id, d.version.id, plan.id, { priceType: "fixed", amountMinor: 1999, currencyCode: "USD", billingPeriod: "month",
    marketCode: "JP", unitLabel: "per seat", validFrom: "2026-10-01", validTo: "2026-12-31", ...f.proof });
  const before = await publishProductVersion(f.product.id, d.version.id, actor, reason);
  const price = before.plans.find(p => p.planKey === "regional")!.prices[0];
  const proposed = candidatePriceFromPublished(price);
  const candidate = await c.createCandidate({ productId: f.product.id, baseVersionId: before.version.id, sourceType: "manual", reason,
    candidateType: "price", targetKey: "regional", targetRef: price.id, evidenceId: f.proof.evidenceId, proposedValue: { ...proposed, amountMinor: 2099 } }, actor);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  await a.applyCandidate(candidate.id, { reason }, actor);
  const changed = (await getDraftProduct(f.product.id))!.plans.find(p => p.planKey === "regional")!.prices[0];
  assert.equal(changed.amountMinor, 2099);
  for (const key of ["marketCode", "unitLabel", "validFrom", "validTo"] as const) assert.equal(changed[key], price[key], key);
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
});
async function changes() {
  assert.ok(existsSync(new URL("../changes/candidates.ts", import.meta.url)), "typed Candidate services must exist");
  return import("../changes/candidates.ts");
}
async function applyService() {
  assert.ok(existsSync(new URL("../changes/apply.ts", import.meta.url)), "Candidate Apply service must exist");
  return import("../changes/apply.ts");
}
async function proposal(f: Awaited<ReturnType<typeof publishedFixture>>, type = "market", targetKey = "JP", value: unknown = { marketCode: "JP", availabilityStatus: "available", ...f.proof }, targetRef: string | null = null) {
  return (await changes()).createCandidate({ productId: f.product.id, baseVersionId: f.published.version.id,
    candidateType: type, targetKey, targetRef, proposedValue: value, evidenceId: f.proof.evidenceId, sourceType: "manual", reason }, actor);
}

test("A14 Candidate permits only typed manual proposals and legal review transitions", async () => {
  const c = await changes(); const f = await publishedFixture(); const candidate = await proposal(f);
  assert.equal(candidate.status, "pending_review");
  const approved = await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedBy, actor);
  await assert.rejects(c.reviewCandidate(candidate.id, "reject", { reason }, actor), { code: "conflict" });
  for (const change of [{ candidateType: "sql", targetKey: "status" }, { targetKey: "US" }, { sourceType: "detector" }, { evidenceId: "missing" }]) {
    await assert.rejects(c.createCandidate({ productId: f.product.id, baseVersionId: f.published.version.id, candidateType: "market", targetKey: "JP",
      proposedValue: { marketCode: "JP", availabilityStatus: "available", ...f.proof }, evidenceId: f.proof.evidenceId, sourceType: "manual", reason, ...change }, actor));
  }
  await assert.rejects(sql`UPDATE af_product_change_candidates SET status='applied' WHERE id=${candidate.id}`, /appl|transition|constraint/i);
  const missingReason = await proposal(f);
  await assert.rejects(sql`UPDATE af_product_change_candidates SET status='approved',reviewed_at=now(),reviewed_by='synthetic-admin' WHERE id=${missingReason.id}`, { code: "23514" });
  await assert.rejects(proposal(f, "price", "pro", { id: "arbitrary-price", priceType: "fixed", amountMinor: 0, billingPeriod: "month" }));
});

test("A15 rejecting a Candidate preserves Product and Draft and prevents Apply", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture();
  await clonePublishedProduct(f.product.id, actor);
  const before = { published: await getPublishedProductBySlug(f.product.slug), draft: await getDraftProduct(f.product.id) };
  const candidate = await proposal(f);
  await c.reviewCandidate(candidate.id, "reject", { reason }, actor);
  await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), { code: "conflict" });
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before.published);
  assert.deepEqual(await getDraftProduct(f.product.id), before.draft);
  assert.equal((await c.readCandidate(candidate.id)).candidate.status, "rejected");
});

test("A16/A18/A19 approved Apply clones only Draft and leaves the complete Published reader unchanged", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture(); const before = await getPublishedProductBySlug(f.product.slug);
  const candidate = await proposal(f);
  await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), { code: "conflict" });
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const result = await a.applyCandidate(candidate.id, { reason }, actor);
  assert.equal(result.status, "applied");
  assert.equal(result.alreadyApplied, false);
  const draft = await getDraftProduct(f.product.id);
  assert.equal(draft!.version.id, result.draftVersionId);
  assert.equal(draft!.markets.find(m => m.marketCode === "JP")!.availabilityStatus, "available");
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  const [v] = await sql`SELECT base_version_id FROM af_product_versions WHERE id=${draft!.version.id}`;
  assert.equal(v.base_version_id, f.published.version.id);
});

test("A17 repeated and concurrent Apply of a price creates one component and one apply audit", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture();
  const d = await clonePublishedProduct(f.product.id, actor);
  await saveProductPlan(f.product.id, d.version.id, { planKey: "pro", name: "Synthetic Pro" });
  f.published = await publishProductVersion(f.product.id, d.version.id, actor, reason);
  const candidate = await proposal(f, "price", "pro", { priceType: "fixed", amountMinor: 1999, currencyCode: "USD", billingPeriod: "month", ...f.proof });
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const results = await Promise.all([a.applyCandidate(candidate.id, { reason }, actor), a.applyCandidate(candidate.id, { reason }, actor)]);
  assert.equal(results.filter(r => !r.alreadyApplied).length, 1);
  assert.equal((await getDraftProduct(f.product.id))!.plans.find(p => p.planKey === "pro")!.prices.length, 1);
  assert.equal((await a.applyCandidate(candidate.id, { reason }, actor)).alreadyApplied, true);
  assert.equal((await sql`SELECT count(*) AS n FROM audit_log WHERE action='aifind.candidate.apply' AND subject=${`aifind:candidate:${candidate.id}`}`)[0].n, 1);
});

test("A20 stale base version cannot overwrite a later Published version or its Draft", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture(); const candidate = await proposal(f);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const d = await clonePublishedProduct(f.product.id, actor);
  await publishProductVersion(f.product.id, d.version.id, actor, reason);
  const before = await getPublishedProductBySlug(f.product.slug);
  await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), { code: "conflict" });
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  assert.equal(await getDraftProduct(f.product.id), null);
  assert.equal((await c.readCandidate(candidate.id)).candidate.status, "approved");
});

test("A21 a changed Draft target conflicts rather than being merged or silently replaced", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture(); const candidate = await proposal(f);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const d = await clonePublishedProduct(f.product.id, actor);
  await setProductMarket(f.product.id, d.version.id, { marketCode: "JP", availabilityStatus: "restricted", ...f.proof });
  const before = await getDraftProduct(f.product.id);
  await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), { code: "conflict" });
  assert.deepEqual(await getDraftProduct(f.product.id), before);
});

test("a Candidate may apply over a compatible Draft with unrelated edits, without resetting those edits", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture(); const candidate = await proposal(f);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const d = await clonePublishedProduct(f.product.id, actor);
  await setProductMarket(f.product.id, d.version.id, { marketCode: "US", availabilityStatus: "unavailable", ...f.proof });
  await a.applyCandidate(candidate.id, { reason }, actor);
  const after = await getDraftProduct(f.product.id);
  assert.equal(after!.version.id, d.version.id);
  assert.equal(after!.markets.find(m => m.marketCode === "US")!.availabilityStatus, "unavailable");
  assert.equal(after!.markets.find(m => m.marketCode === "JP")!.availabilityStatus, "available");
});

test("price Candidates follow clone lineage; manual edits to that price force a conflict", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture();
  const d = await clonePublishedProduct(f.product.id, actor);
  const plan = await saveProductPlan(f.product.id, d.version.id, { planKey: "paid", name: "Paid" });
  const price = await saveProductPrice(f.product.id, d.version.id, plan.id, { priceType: "fixed", currencyCode: "USD", amountMinor: 2000, billingPeriod: "month", ...f.proof });
  f.published = await publishProductVersion(f.product.id, d.version.id, actor, reason);
  const candidate = await proposal(f, "price", "paid", { priceType: "fixed", currencyCode: "USD", amountMinor: 2500, billingPeriod: "month", ...f.proof }, price.id);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const next = await clonePublishedProduct(f.product.id, actor); const p = next.plans[0];
  assert.notEqual(p.prices[0].id, price.id);
  await saveProductPrice(f.product.id, next.version.id, p.id, { id: p.prices[0].id, priceType: "fixed", currencyCode: "USD", amountMinor: 2300, billingPeriod: "month", ...f.proof });
  await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), { code: "conflict" });
  assert.equal((await getDraftProduct(f.product.id))!.plans[0].prices[0].amountMinor, 2300);
});

test("all seven Candidate types invoke controlled Draft setters, preserving Published facts", async () => {
  const c = await changes(); const a = await applyService();
  const cases = [
    ["market", "JP", { marketCode: "JP", availabilityStatus: "restricted" }],
    ["language", "ja", { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "full" }],
    ["platform", "android", { platformKey: "android", status: "unavailable" }],
    ["capability", "coding", { capabilityKey: "coding", supportLevel: "partial" }],
    ["plan", "new-plan", { planKey: "new-plan", name: "New plan", audience: "unknown" }],
    ["lifecycle", "lifecycle", { lifecycleStatus: "beta" }],
  ] as const;
  for (const [type, key, value] of cases) {
    const f = await publishedFixture(); const before = await getPublishedProductBySlug(f.product.slug);
    const proposalValue = type === "lifecycle" ? { ...value, lifecycleEvidenceId: f.proof.evidenceId, lifecycleVerifiedAt: f.proof.verifiedAt } : { ...value, ...f.proof };
    const candidate = await proposal(f, type, key, proposalValue);
    await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
    await a.applyCandidate(candidate.id, { reason }, actor);
    const detail = await c.readCandidate(candidate.id);
    assert.equal(detail.candidate.status, "applied");
    assert.deepEqual(detail.draftValue, detail.candidate.proposedValue);
    assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  }
});

test("A22 Apply audit failure rolls back cloned Draft, candidate status and all facts", async () => {
  const c = await changes(); const a = await applyService(); const f = await publishedFixture(); const candidate = await proposal(f);
  await c.reviewCandidate(candidate.id, "approve", { reason }, actor);
  const before = await getPublishedProductBySlug(f.product.slug);
  await sql.unsafe("CREATE FUNCTION af_test_apply_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='aifind.candidate.apply' THEN RAISE EXCEPTION 'intentional candidate audit rollback'; END IF; RETURN NEW; END $$");
  await sql.unsafe("CREATE TRIGGER af_test_apply_fail BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION af_test_apply_fail()");
  try { await assert.rejects(a.applyCandidate(candidate.id, { reason }, actor), /intentional candidate audit rollback/); }
  finally { await sql.unsafe("DROP TRIGGER af_test_apply_fail ON audit_log; DROP FUNCTION af_test_apply_fail()"); }
  assert.equal(await getDraftProduct(f.product.id), null);
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), before);
  const item = (await c.readCandidate(candidate.id)).candidate;
  assert.equal(item.status, "approved"); assert.equal(item.appliedAt, null);
});

test("Candidate ownership and price target references cannot cross Product boundaries", async () => {
  const c = await changes(); const f = await publishedFixture(); const other = await publishedFixture();
  await assert.rejects(c.createCandidate({ productId: other.product.id, baseVersionId: f.published.version.id, candidateType: "market", targetKey: "JP", evidenceId: f.proof.evidenceId,
    proposedValue: { marketCode: "JP", availabilityStatus: "unknown" }, sourceType: "manual", reason }, actor));
  await assert.rejects(proposal(f, "price", "missing-plan", { priceType: "unknown", billingPeriod: "none" }));
});
