import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {sql,closeDb} from '@aihot/backend/db';
import {Conflict} from '@aihot/backend/audit';
import {editorialContent,editorialActor as actor,editorialReason as reason} from './editorial-fixtures.ts';
import {createEditorial,publishEditorial,saveEditorialDraft} from '../editorial/documents.ts';
import {newUuid} from '@aihot/backend/lib/ids';
import {resolvePublicEditorial,listPublicEditorial,editorialSitemapXml} from '../publication/editorial.ts';
import Fastify from 'fastify';
import {registerEditorialPublicRoutes} from '../public/editorial-routes.ts';
after(closeDb);
test('Editorial SQL revision insertion must start as Draft rather than bypass publication validation',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor);
  await assert.rejects(sql`INSERT INTO af_editorial_revisions(id,document_id,revision_no,slug,title,editor,reason,published_at) VALUES('invalid-direct-published',${d.id},2,'invalid-direct-published','',${actor},${reason},now())`,{code:'23514'});
});
test('Editorial Admin exposes real permanent slug claim dates for its immutable publication history',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor),p=await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor);
  const claims=(p as unknown as {slugHistory?:Array<{slug:string;claimedAt:string}>}).slugHistory;assert.ok(claims);assert.equal(claims.length,1);assert.equal(claims[0].slug,f.content.slug);
  const[row]=await sql`SELECT claimed_at FROM af_editorial_slug_claims WHERE document_id=${d.id}`;assert.equal(claims[0].claimedAt,row.claimed_at.toISOString());
});
test('Concurrent Editorial saves of one revision commit exactly one edit and reject the stale writer',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor);
  const results=await Promise.allSettled(['編集 A','編集 B'].map(title=>saveEditorialDraft(d.id,{content:{...f.content,title},expectedRevision:d.revision,reason},actor)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.ok(rejected.reason instanceof Conflict);assert.match(rejected.reason.message,/revision/);
});
test('Editorial SQL Document insertion cannot publish a Draft through deferred owner foreign keys',async()=>{
  const id=newUuid(),revision=newUuid(),slug='direct-document-'+id;
  await assert.rejects(sql.begin('isolation level read committed',async tx=>{
    await tx`INSERT INTO af_editorial_documents(id,doc_type,state,published_revision_id,public_slug,first_published_at) VALUES(${id},'comparison','published',${revision},${slug},now())`;
    await tx`INSERT INTO af_editorial_revisions(id,document_id,revision_no,slug,title,editor,reason) VALUES(${revision},${id},1,${slug},'UNPUBLISHED DIRECT INSERT',${actor},${reason})`;
    await tx`INSERT INTO af_comparisons(revision_id,mode) VALUES(${revision},'hands_on')`;
    await tx`INSERT INTO af_editorial_slug_claims(doc_type,slug,document_id) VALUES('comparison',${slug},${id})`;
  }),{code:'23514'});
  assert.equal((await resolvePublicEditorial('comparison',slug)).kind,'not_found');
  assert.equal((await listPublicEditorial('comparison')).some(d=>d.slug===slug),false);
  assert.doesNotMatch(await editorialSitemapXml(),new RegExp(slug));
  const app=Fastify();registerEditorialPublicRoutes(app);
  try{assert.equal((await app.inject('/api/site/aifind/compare/'+slug)).statusCode,404);assert.equal((await app.inject('/og/aifind-editorial/compare/'+slug+'.png')).statusCode,404);assert.doesNotMatch((await app.inject('/sitemap-aifind-editorial.xml')).body,new RegExp(slug));}finally{await app.close();}
});
