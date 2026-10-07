import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { readAdminProduct } from "../admin/read.ts";
import { saveAdminDraft, publishAdminDraft } from "../admin/products.ts";
import { listCandidates } from "../changes/candidates.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { actor, reason } from "./admin-fixtures.ts";
after(closeDb);
async function seed() {
  assert.ok(existsSync(new URL("../preview/admin-seed.ts", import.meta.url)), "explicit guarded Phase 2 seed must exist");
  return import("../preview/admin-seed.ts");
}
test("Phase 2 preview fixture never seeds by default or in production, including module/API startup imports", async () => {
  const s = await seed(); delete process.env.AIFIND_PREVIEW_ENABLED;
  await import("../server.ts");
  assert.equal((await sql`SELECT count(*) AS n FROM af_products`)[0].n, 0);
  await assert.rejects(s.seedAdminPreview(), /AIFIND_PREVIEW_ENABLED/);
  process.env.AIFIND_PREVIEW_ENABLED = "true";
  const old = process.env.NODE_ENV;
  try { process.env.NODE_ENV = "production"; await assert.rejects(s.seedAdminPreview(), /production/); }
  finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
  assert.equal((await sql`SELECT count(*) AS n FROM af_products`)[0].n, 0);
});
test("Phase 2 seed provides marked A Published+Draft, B Published-only and real pending/approved candidates", async () => {
  const s = await seed(); process.env.AIFIND_PREVIEW_ENABLED = "true";
  const f = await s.seedAdminPreview();
  const a = await readAdminProduct(f.productAId), b = await readAdminProduct(f.productBId);
  assert.ok(a.published); assert.ok(a.draft); assert.ok(b.published); assert.equal(b.draft, null);
  assert.match(a.identity.canonicalName, /^\[PREVIEW\]/); assert.match(b.identity.canonicalName, /^\[PREVIEW\]/);
  assert.equal(a.published.languages.find(l => l.languageCode === "ja")!.uiSupport, "unknown");
  assert.equal(a.draft.languages.find(l => l.languageCode === "ja")!.uiSupport, "unknown");
  assert.deepEqual(new Set(a.published.plans.flatMap(p => p.prices.map(v => v.priceType))), new Set(["unknown", "free", "fixed", "custom"]));
  assert.ok(a.evidence.every(e => e.url.includes("preview.example.invalid")));
  const queue = await listCandidates({ status: "all" });
  assert.ok(queue.rows.some(v => v.candidate.status === "pending_review")); assert.ok(queue.rows.some(v => v.candidate.status === "approved"));
  assert.ok(queue.rows.every(v => v.candidate.sourceType === "manual"));
});
test("repeated Phase 2 seed preserves Draft edits, later publication and Candidate history without writing duplicates", async () => {
  const s = await seed(); const f = await s.seedAdminPreview(); const a = await readAdminProduct(f.productAId);
  const before = await getPublishedProductBySlug(s.ADMIN_PREVIEW_A);
  await saveAdminDraft(f.productAId, a.draft!.version.id, { expectedRevision: a.draftRevision, version: { displayName: "[PREVIEW] 保存した編集" }, reason }, actor);
  const count = (await sql`SELECT count(*) AS n FROM audit_log`)[0].n;
  assert.deepEqual(await s.seedAdminPreview(), f);
  assert.equal((await readAdminProduct(f.productAId)).draft!.version.displayName, "[PREVIEW] 保存した編集");
  assert.equal((await sql`SELECT count(*) AS n FROM audit_log`)[0].n, count);
  assert.deepEqual(await getPublishedProductBySlug(s.ADMIN_PREVIEW_A), before);
  const ready = await readAdminProduct(f.productAId);
  await publishAdminDraft(f.productAId, ready.draft!.version.id, { expectedRevision: ready.draftRevision, reason }, actor);
  assert.deepEqual(await s.seedAdminPreview(), f);
  assert.equal((await readAdminProduct(f.productAId)).draft, null);
});
