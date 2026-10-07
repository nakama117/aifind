import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { visibilityChange } from './public-fixtures.ts';
import { createProductDraft } from '../catalog/versions.ts';
import { editorialContent, editorialActor as actor, editorialReason as reason, syntheticTestRecord } from './editorial-fixtures.ts';
import type { EditorialAdminDetail, EditorialContent } from '../editorial/contracts.ts';
const commands = await import('../editorial/documents.ts').catch(e => { if (e.code === 'ERR_MODULE_NOT_FOUND') return null; throw e; });
const reader = await import('../editorial/read.ts').catch(e => { if (e.code === 'ERR_MODULE_NOT_FOUND') return null; throw e; });
function domain() { assert.ok(commands, 'Editorial Domain commands must exist'); return commands; }
function read() { assert.ok(reader, 'Editorial reader must exist'); return reader; }
const action = (d: EditorialAdminDetail) => ({ expectedRevision: d.revision, reason });
async function create(content: EditorialContent) { return domain().createEditorial({ content, reason }, actor); }
async function publish(d: EditorialAdminDetail) { return domain().publishEditorial(d.id, action(d), actor); }
after(closeDb);

test('E01 creates a private Draft with no Published pointer and typed Product references', async () => {
  const f = await editorialContent(), d = await create(f.content);
  assert.equal(d.type, 'comparison'); assert.equal(d.state, 'draft'); assert.equal(d.published, null);
  assert.equal(d.draft?.content.title, '[TEST] 日語の資料整理をどう選ぶ？'); assert.equal(d.draft?.revisionNo, 1);
  assert.equal(d.draft?.content.type === 'comparison' && d.draft.content.comparison.products[0].referencePublishedVersionId, f.products[0].published.version.id);
});
test('E02/E03 saves only the expected document revision and stale save rolls back without lost work', async () => {
  const f = await editorialContent(), d = await create(f.content), content = { ...f.content, title: '[TEST] 新しい下書き' };
  const saved = await domain().saveEditorialDraft(d.id, { ...action(d), content }, actor);
  assert.equal(saved.revision, d.revision + 1); assert.equal(saved.draft?.content.title, '[TEST] 新しい下書き');
  await assert.rejects(domain().saveEditorialDraft(d.id, { ...action(d), content: f.content }, actor), { code: 'conflict' });
  assert.deepEqual(await read().readEditorialAdmin(d.id), saved);
});
test('E04/E05/E06 Publish is explicit; editing a Published document creates a separate Draft', async () => {
  const f = await editorialContent(), d = await publish(await create(f.content)), pub = d.published!;
  assert.equal(d.draft, null); assert.equal(d.state, 'published'); assert.ok(pub.publishedAt);
  await assert.rejects(domain().saveEditorialDraft(d.id, { ...action(d), content: f.content }, actor), { code: 'conflict' });
  const draft = await domain().createEditorialDraft(d.id, action(d), actor);
  const saved = await domain().saveEditorialDraft(d.id, { ...action(draft), content: { ...f.content, bodyMd: '[TEST] SECRET EDITORIAL DRAFT' } }, actor);
  assert.equal(saved.draft?.revisionNo, 2); assert.equal(saved.published?.id, pub.id); assert.deepEqual(saved.published, pub);
});
test('E07/E08 Restore writes a new Draft and cannot overwrite Published historical prose or relations', async () => {
  const f = await editorialContent(), first = await publish(await create(f.content));
  const draft = await domain().createEditorialDraft(first.id, action(first), actor);
  const changed = await domain().saveEditorialDraft(first.id, { ...action(draft), content: { ...f.content, title: '[TEST] 第二の公開版' } }, actor);
  const second = await publish(changed), restored = await domain().restoreEditorial(first.id, { ...action(second), sourceRevisionId: first.published!.id }, actor);
  assert.equal(restored.draft?.revisionNo, 3); assert.equal(restored.draft?.content.title, first.published!.content.title);
  assert.deepEqual(restored.published, second.published); assert.equal(restored.history.length, 3);
  await assert.rejects(sql`UPDATE af_editorial_revisions SET title='tampered' WHERE id=${first.published!.id}`, { code: '23514' });
  await assert.rejects(sql`DELETE FROM af_comparison_products WHERE revision_id=${first.published!.id}`, { code: '23514' });
});
test('E09/E10 Withdraw preserves history and each successful editorial action has an audit reason', async () => {
  const f = await editorialContent(), d = await publish(await create(f.content));
  const withdrawn = await domain().withdrawEditorial(d.id, action(d), actor);
  assert.equal(withdrawn.state, 'withdrawn'); assert.deepEqual(withdrawn.published, d.published);
  const audit = await sql`SELECT action,reason FROM audit_log WHERE subject=${'aifind:editorial:' + d.id} ORDER BY created_at,id`;
  assert.equal(audit.length, 3); assert.deepEqual(audit.map(a => a.action), ['aifind.editorial.create','aifind.editorial.publish','aifind.editorial.withdraw']);
  assert.ok(audit.every(a => a.reason === reason));
});
for (const [type, counts] of [['comparison',[2,3]], ['category',[3,5]]] as const) for (const count of counts) {
  test(`${type === 'comparison' ? 'C01/C02' : 'CAT01/CAT02'} ${type} publishes ${count} distinct eligible Products`, async () => {
    const f = await editorialContent(type, count), d = await publish(await create(f.content)); assert.equal(d.state, 'published'); assert.equal(d.published?.content.type, type);
  });
}
for (const [type, counts] of [['comparison',[1,4]], ['category',[2,6]]] as const) for (const count of counts) {
  test(`${type === 'comparison' ? 'C03/C04' : 'CAT03/CAT04'} ${type} rejects Publish with ${count} Products while allowing incomplete Draft`, async () => {
    const f = await editorialContent(type, count), d = await create(f.content);
    await assert.rejects(publish(d), { statusCode: 422 }); assert.equal((await read().readEditorialAdmin(d.id)).published, null);
  });
}
for (const type of ['comparison','category'] as const) {
  test(`${type === 'comparison' ? 'C05' : 'CAT05'} ${type} duplicate Products or positions cannot be stored`, async () => {
    domain();
    const f = await editorialContent(type), content = structuredClone(f.content);
    const rows = content.type === 'comparison' ? content.comparison.products : content.category.products;
    rows[1].productId = rows[0].productId; rows[1].referencePublishedVersionId = rows[0].referencePublishedVersionId;
    await assert.rejects(create(content)); rows[1] = { ...rows[0] }; await assert.rejects(create(content));
  });
  for (const visibility of ['private','unlisted'] as const) test(`${type === 'comparison' ? 'C06/C07' : 'CAT06/CAT07'} ${type} ${visibility} Product blocks Publish`, async () => {
    const f = await editorialContent(type), d = await create(f.content); await visibilityChange(f.products[0].product.id, visibility);
    await assert.rejects(publish(d), { statusCode: 422 }); assert.equal((await read().readEditorialAdmin(d.id)).state, 'draft');
  });
}
test('C13 hands_on requires complete human Test Records for every Product; official sources makes no tested claim', async () => {
  const f = await editorialContent(); assert.equal(f.content.type, 'comparison'); if(f.content.type !== 'comparison') return;
  f.content.comparison.mode = 'hands_on'; const d = await create(f.content); await assert.rejects(publish(d), { statusCode: 422 });
  f.content.comparison.products.forEach(p => p.testRecord = syntheticTestRecord());
  const saved = await domain().saveEditorialDraft(d.id, { ...action(d), content: f.content }, actor), published = await publish(saved);
  assert.ok(published.published?.content.type === 'comparison' && published.published.content.comparison.products.every(p => p.testRecord?.reviewer === '[SYNTHETIC] テスト担当'));
  await assert.rejects(sql`UPDATE af_comparison_test_records SET result_md='forged' WHERE revision_id=${published.published!.id}`, {code:'23514'});
});
test('C14 reference version must be previously Published and belong to the selected Product', async () => {
  domain();
  const f = await editorialContent(); if(f.content.type !== 'comparison') return;
  f.content.comparison.products[0].referencePublishedVersionId = f.products[1].published.version.id; await assert.rejects(create(f.content));
  const draft = await createProductDraft(f.products[0].product.id, { displayName: '[TEST] Secret Product Draft' });
  f.content.comparison.products[0].referencePublishedVersionId = draft.version.id; await assert.rejects(create(f.content));
});
test('C14 tested plan and price references cannot cross the saved Product reference version', async () => {
  domain();
  const f = await editorialContent(); if(f.content.type !== 'comparison') return;
  f.content.comparison.products[0].testedPlanKey = 'does-not-exist'; await assert.rejects(create(f.content));
  f.content.comparison.products[0].testedPlanKey = null; f.content.comparison.products[0].testedPriceRef = 'does-not-exist'; await assert.rejects(create(f.content));
});
test('CAT08/CAT09 Category needs an independent question, selection criteria and per-Product conditions, not capability auto generation', async () => {
  const f = await editorialContent('category'); if(f.content.type !== 'category') return;
  f.content.category.selectionCriteriaMd = ''; f.content.category.products[0].fitSummaryJa = '';
  const d = await create(f.content); await assert.rejects(publish(d), { statusCode: 422 });
  assert.equal((await sql`SELECT count(*)::int AS n FROM af_categories WHERE revision_id=${d.draft!.id}`)[0].n, 1);
});
test('SL02/SL03/SL04 published slug claims are permanent across renames and cannot be reused by another document', async () => {
  const f = await editorialContent(), first = await publish(await create(f.content));
  let d = await domain().createEditorialDraft(first.id, action(first), actor);
  d = await domain().saveEditorialDraft(d.id, { ...action(d), content: { ...f.content, slug: f.content.slug + '-two' } }, actor); d = await publish(d);
  d = await domain().createEditorialDraft(d.id, action(d), actor);
  d = await domain().saveEditorialDraft(d.id, { ...action(d), content: { ...f.content, slug: f.content.slug + '-three' } }, actor); d = await publish(d);
  const claims = await sql`SELECT slug,document_id FROM af_editorial_slug_claims WHERE document_id=${d.id} ORDER BY slug`;
  assert.equal(claims.length, 3); assert.ok(claims.every(r => r.document_id === first.id));
  const collision = await create(f.content); await assert.rejects(publish(collision), {code:'conflict'});
});
test('schema rejects wrong editorial subtype relations, orphan references and edits to published Test Records', async () => {
  const f = await editorialContent('category'), d = await create(f.content);
  await assert.rejects(sql`INSERT INTO af_comparisons(revision_id) VALUES (${d.draft!.id})`, {code:'23514'});
  await assert.rejects(sql`INSERT INTO af_editorial_slug_claims(doc_type,slug,document_id) VALUES ('comparison','orphan','missing')`, {code:'23503'});
  const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name IN ('af_comparisons','af_comparison_products','af_categories','af_category_products')`;
  assert.ok(columns.every(r => !/amount_minor|availability_status|ui_support|facts_json|winner|score|rank/.test(r.column_name)));
});
