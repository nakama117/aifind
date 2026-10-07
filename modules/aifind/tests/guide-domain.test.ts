import '../../../tests/setup.ts';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql, closeDb } from '@aihot/backend/db';
import { createEditorialDraft, saveEditorialDraft, withdrawEditorial, restoreEditorial } from '../editorial/documents.ts';
import { readEditorialAdmin } from '../editorial/read.ts';
import { EditorialContentSchema } from '../editorial/contracts.ts';
import { createProductDraft } from '../catalog/versions.ts';
import { visibilityChange } from './public-fixtures.ts';
import { editorialContent } from './editorial-fixtures.ts';
import { guideFixture, guideTestRecord, createGuide, publishGuide, guideAction, guideActor } from './guide-fixtures.ts';
after(closeDb);
const save = (d: Parameters<typeof guideAction>[0], content: unknown) => saveEditorialDraft(d.id, { ...guideAction(d), content }, guideActor);

test('G01/G03 Guide uses existing Document/Revision with a Draft pointer and typed sections', async () => {
  const f = await guideFixture(), d = await createGuide(f.content);
  assert.equal(d.type, 'guide'); assert.equal(d.state, 'draft'); assert.equal(d.published, null);
  assert.deepEqual(d.draft?.content, f.content);
  const [r] = await sql`SELECT doc_type FROM af_editorial_documents WHERE id=${d.id}`;
  assert.equal(r.doc_type, 'guide'); assert.equal((await sql`SELECT count(*)::int n FROM af_guides WHERE revision_id=${d.draft!.id}`)[0].n, 1);
});
for (const type of ['comparison', 'category'] as const) test(`G02 existing ${type} publication remains unchanged`, async () => {
  const f = await editorialContent(type), d = await publishGuide(await createGuide(f.content));
  assert.equal(d.published?.content.type, type); assert.equal(d.state, 'published');
});
test('G04 stale Guide save returns conflict and does not overwrite the accepted save', async () => {
  const f = await guideFixture(), d = await createGuide(f.content), original = structuredClone(f.content);
  f.content.guide.stepsMd = '保存された新しい手順'; const fresh = await save(d, f.content);
  await assert.rejects(save(d, original), /revision/);
  assert.deepEqual((await readEditorialAdmin(d.id)).draft?.content, fresh.draft?.content);
});
test('G05/G06 publishing and later Draft edits keep Published Guide isolated and immutable', async () => {
  const f = await guideFixture(), published = await publishGuide(await createGuide(f.content));
  const d = await createEditorialDraft(published.id, guideAction(published), guideActor);
  f.content.guide.stepsMd = 'SECRET GUIDE DRAFT'; await save(d, f.content);
  const current = await readEditorialAdmin(d.id); assert.deepEqual(current.published, published.published);
  await assert.rejects(sql`UPDATE af_guides SET steps_md='forged' WHERE revision_id=${published.published!.id}`, { code: '23514' });
});
test('G07 Restore copies a historical Guide into a distinct new Draft revision', async () => {
  const f = await guideFixture(), d = await publishGuide(await createGuide(f.content));
  const restored = await restoreEditorial(d.id, { ...guideAction(d), sourceRevisionId: d.published!.id }, guideActor);
  assert.notEqual(restored.draft?.id, d.published?.id); assert.deepEqual(restored.draft?.content, d.published?.content);
  assert.deepEqual(restored.published, d.published);
});
test('G08 Withdraw retains Guide history and records withdrawn state', async () => {
  const f = await guideFixture(), d = await publishGuide(await createGuide(f.content));
  const stopped = await withdrawEditorial(d.id, guideAction(d), guideActor);
  assert.equal(stopped.state, 'withdrawn'); assert.deepEqual(stopped.published, d.published);
});
test('G09 Guide create, save, publish and withdraw write existing Editorial audit', async () => {
  const f = await guideFixture(); let d = await createGuide(f.content); d = await save(d, f.content); d = await publishGuide(d);
  await withdrawEditorial(d.id, guideAction(d), guideActor);
  const rows = await sql`SELECT action FROM audit_log WHERE subject=${'aifind:editorial:' + d.id} ORDER BY id`;
  assert.deepEqual(rows.map(r => r.action), ['aifind.editorial.create', 'aifind.editorial.save', 'aifind.editorial.publish', 'aifind.editorial.withdraw']);
});
test('G10 Guide public slug remains claimed after rename and cannot be reused', async () => {
  const f = await guideFixture(), old = f.content.slug; let d = await publishGuide(await createGuide(f.content));
  d = await createEditorialDraft(d.id, guideAction(d), guideActor); f.content.slug += '-renamed'; d = await publishGuide(await save(d, f.content));
  const other = structuredClone(f.content); other.slug = old;
  await assert.rejects(publishGuide(await createGuide(other)), /slug/);
  assert.equal((await readEditorialAdmin(d.id)).slugHistory.length, 2);
});
for (const [name, mutate] of [
  ['H01 at least one Product is required', (c: Awaited<ReturnType<typeof guideFixture>>['content']) => { c.guide.products = []; }],
  ['H02 exactly one primary Product is required', (c: Awaited<ReturnType<typeof guideFixture>>['content']) => { c.guide.products[0].role = 'alternative'; }],
] as const) test(name, async () => {
  const f = await guideFixture(), d = await createGuide(f.content); mutate(f.content);
  const updated = await save(d, f.content); await assert.rejects(publishGuide(updated), { statusCode: 422 });
});
test('H03 more than three Guide Products is rejected', async () => {
  const f = await guideFixture(4); assert.equal(EditorialContentSchema.safeParse({ ...(await guideFixture()).content }).success, true);
  await assert.rejects(createGuide(f.content));
});
test('H04 duplicate Guide Product identities are rejected', async () => {
  const f = await guideFixture(2), d = await createGuide(f.content); f.content.guide.products[1] = { ...f.content.guide.products[0], position: 2 };
  await assert.rejects(save(d, f.content));
});
for (const visibility of ['private', 'unlisted'] as const) test(`H05/H06 ${visibility} Product blocks Guide Publish`, async () => {
  const f = await guideFixture(), d = await createGuide(f.content); await visibilityChange(f.products[0].product.id, visibility);
  await assert.rejects(publishGuide(d), { statusCode: 422 }); assert.equal((await readEditorialAdmin(d.id)).state, 'draft');
});
test('H07 Draft Product version cannot be a Guide reference', async () => {
  const f = await guideFixture(), d = await createGuide(f.content), v = await createProductDraft(f.products[0].product.id, { displayName: 'SECRET Draft' });
  f.content.guide.products[0].referencePublishedVersionId = v.version.id;
  await assert.rejects(save(d, f.content), { statusCode: 400 });
  await assert.rejects(sql`UPDATE af_guide_products SET reference_version_id=${v.version.id} WHERE revision_id=${d.draft!.id}`, { code: '23514' });
});
test('H08 reference Published version must belong to its Guide Product', async () => {
  const f = await guideFixture(2), d = await createGuide(f.content); f.content.guide.products[0].referencePublishedVersionId = f.products[1].published.version.id;
  await assert.rejects(save(d, f.content), { statusCode: 400 });
});
test('H09 unknown Plan and Price references are rejected by the real DB', async () => {
  const f = await guideFixture(), d = await createGuide(f.content); f.content.guide.products[0].referencedPlanKey = 'nonexistent-plan';
  await assert.rejects(save(d, f.content), { statusCode: 400 });
  f.content.guide.products[0].referencedPlanKey = null; f.content.guide.products[0].referencedPriceRef = 'missing-price';
  await assert.rejects(save(d, f.content));
});
for (const key of ['task', 'taskResultMd', 'prerequisitesMd', 'materialsMd', 'stepsMd', 'resultMd', 'failuresMd', 'limitationsMd', 'costNotesMd', 'alternativesMd'] as const) {
  test(`H10 Guide Publish rejects empty structured section ${key}`, async () => {
    const f = await guideFixture(), d = await createGuide(f.content); f.content.guide[key] = '';
    await assert.rejects(publishGuide(await save(d, f.content)), { statusCode: 422 });
  });
}
test('H11 Guide schema accepts editing and references without Product fact columns', async () => {
  const f = await guideFixture(), d = await createGuide(f.content);
  const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='af_guides'`;
  assert.ok(columns.some(c => c.column_name === 'steps_md'));
  assert.equal(columns.some(c => /price|availability|japan|platform|capability/.test(c.column_name)), false);
  assert.ok(d.draft);
});
test('M01 official_sources Guide publishes without a Test Record', async () => {
  const f = await guideFixture(), d = await publishGuide(await createGuide(f.content)); assert.equal(d.state, 'published');
  assert.equal((await sql`SELECT count(*)::int n FROM af_guide_test_records WHERE revision_id=${d.published!.id}`)[0].n, 0);
});
test('M03 hands_on Guide without a primary Test Record cannot publish', async () => {
  const f = await guideFixture(); f.content.guide.mode = 'hands_on'; const d = await createGuide(f.content);
  await assert.rejects(publishGuide(d), { statusCode: 422 });
  await assert.rejects(sql`UPDATE af_editorial_revisions SET published_at=now() WHERE id=${d.draft!.id}`, { code: '23514' });
});
test('M04 valid hands_on Test Record binds Guide revision, Product, reference and independent testedAt', async () => {
  const f = await guideFixture(); f.content.guide.mode = 'hands_on'; f.content.guide.products[0].testRecord = guideTestRecord(f.content.guide.products[0]);
  const d = await publishGuide(await createGuide(f.content));
  const [r] = await sql`SELECT * FROM af_guide_test_records WHERE revision_id=${d.published!.id}`;
  assert.equal(r.product_id, f.products[0].product.id); assert.equal(r.reference_version_id, f.products[0].published.version.id);
  assert.equal(r.tested_at.toISOString(), '2026-10-06T01:00:00.000Z'); assert.notEqual(r.tested_at.toISOString(), d.published!.publishedAt);
  await assert.rejects(sql`UPDATE af_guide_test_records SET result_md='forged' WHERE revision_id=${d.published!.id}`, { code: '23514' });
});
for (const key of ['testedAt', 'reviewer'] as const) test(`M05/M06 hands_on record requires ${key}`, async () => {
  const f = await guideFixture(), d = await createGuide(f.content); f.content.guide.mode = 'hands_on'; const t = guideTestRecord(f.content.guide.products[0]); t[key] = '';
  f.content.guide.products[0].testRecord = t; await assert.rejects(save(d, f.content));
});
test('M07 Test Record reference mismatch is rejected instead of relabelled', async () => {
  const f = await guideFixture(2), d = await createGuide(f.content); const t = guideTestRecord(f.content.guide.products[0]);
  t.referencePublishedVersionId = f.products[1].published.version.id; f.content.guide.products[0].testRecord = t;
  await assert.rejects(save(d, f.content));
});
test('M08 Test Record Product binding cannot move silently to another Guide Product', async () => {
  const f = await guideFixture(2), d = await createGuide(f.content); const t = guideTestRecord(f.content.guide.products[0]);
  f.content.guide.products[1].testRecord = t; await assert.rejects(save(d, f.content));
});
