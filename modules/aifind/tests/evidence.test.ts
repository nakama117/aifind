import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { createProduct } from "../catalog/identity.ts";
import { createProductDraft, clonePublishedProduct } from "../catalog/versions.ts";
import { tag } from "../../../tests/setup.ts";

after(closeDb);
async function domain() {
  assert.ok(existsSync(new URL("../catalog/evidence.ts", import.meta.url)), "evidence domain must exist");
  return import("../catalog/evidence.ts");
}
const input = {
  url: "https://synthetic.example/docs", title: "Synthetic official documentation", publisher: "Synthetic vendor",
  sourceKind: "official_docs", retrievedAt: "2026-10-05T09:00:00+09:00", publishedAt: null,
  contentHash: "a".repeat(64), evidenceNote: "テスト用の短い出典説明。",
};

test("evidence round-trips metadata and retrieval time without a full-page field", async () => {
  const { createEvidence, getEvidence } = await domain();
  const row = await createEvidence(input);
  const evidence = await getEvidence(row.id);
  assert.equal(evidence?.retrievedAt, "2026-10-05T00:00:00.000Z");
  assert.equal(evidence?.publishedAt, null);
  assert.equal(evidence?.contentHash, "a".repeat(64));
  assert.equal(evidence?.evidenceNote, "テスト用の短い出典説明。");
  assert.equal(await getEvidence("missing"), null);
  await assert.rejects(createEvidence({ ...input, fulltext: "copyrighted body" }));
});

test("evidence validation rejects unsafe schemes, date-only instants and oversized notes", async () => {
  const { createEvidence } = await domain();
  for (const patch of [
    { url: "javascript:alert(1)" }, { url: "file:///etc/passwd" }, { sourceKind: "automatic_truth" },
    { retrievedAt: "2026-10-05" }, { evidenceNote: "x".repeat(501) }, { contentHash: "not-a-hash" },
  ]) await assert.rejects(createEvidence({ ...input, ...patch }));
});

test("lifecycle evidence is cloned by reference while historical evidence stays immutable", async () => {
  const { createEvidence } = await domain();
  const evidence = await createEvidence(input);
  const p = await createProduct({ slug: `life-${tag()}`, canonicalName: "Synthetic" });
  const v1 = await createProductDraft(p.id, { displayName: "Synthetic", lifecycleStatus: "beta",
    lifecycleEvidenceId: evidence.id, lifecycleVerifiedAt: "2026-10-05T01:00:00Z" });
  await sql`UPDATE af_product_versions SET status='published', published_at=now() WHERE id=${v1.version.id}`;
  const v2 = await clonePublishedProduct(p.id);
  assert.equal(v2.version.lifecycleEvidenceId, evidence.id);
  assert.equal(v2.version.lifecycleVerifiedAt, "2026-10-05T01:00:00.000Z");
  await assert.rejects(sql`UPDATE af_evidence SET evidence_note='rewrite history' WHERE id=${evidence.id}`, /immutable/);
  await assert.rejects(sql`DELETE FROM af_evidence WHERE id=${evidence.id}`, /immutable/);
});
