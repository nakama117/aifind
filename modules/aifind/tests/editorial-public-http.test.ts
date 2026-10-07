import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import { closeDb } from '@aihot/backend/db';
import { installModules } from '@aihot/backend/modules';
import { SERVER_MODULES } from '@aihot/site/modules/server';
import { buildApp } from '../../../apps/api/src/app.ts';
import { editorialContent,editorialActor as actor,editorialReason as reason } from './editorial-fixtures.ts';
import { createEditorial,publishEditorial,createEditorialDraft,saveEditorialDraft,withdrawEditorial } from '../editorial/documents.ts';
import { visibilityChange } from './public-fixtures.ts';
installModules(SERVER_MODULES);const app=await buildApp();after(async()=>{await app.close();await closeDb();});
const root='/api/site/aifind';
test('E05/E06 public Site endpoints and home show only eligible human-Published editorial; Draft stays private',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor),path=root+'/compare/'+f.content.slug;
  assert.equal((await app.inject({url:path})).statusCode,404);
  assert.doesNotMatch((await app.inject({url:root+'/compare'})).body,new RegExp(f.content.slug));
  const p=await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor);
  const get=await app.inject({url:path});assert.equal(get.statusCode,200,get.body);assert.equal(get.json().document.title,f.content.title);assert.match(String(get.headers['cache-control']),/no-store/);
  assert.match((await app.inject({url:root+'/home'})).body,new RegExp(f.content.slug));
  const draft=await createEditorialDraft(d.id,{expectedRevision:p.revision,reason},actor);
  await saveEditorialDraft(d.id,{content:{...f.content,title:'PRIVATE EDITORIAL DRAFT',slug:'private-editorial-draft'},expectedRevision:draft.revision,reason},actor);
  assert.deepEqual((await app.inject({url:path})).json(),get.json());
  for(const url of [root+'/compare',root+'/home','/sitemap-aifind-editorial.xml'])assert.doesNotMatch((await app.inject({url})).body,/PRIVATE EDITORIAL DRAFT|private-editorial-draft/);
});
test('SL01/SL02 old editorial slugs resolve directly; sitemap index registers fresh dedicated editorial map',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor),p=await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor);
  const draft=await createEditorialDraft(d.id,{expectedRevision:p.revision,reason},actor),slug=f.content.slug+'-new';
  const saved=await saveEditorialDraft(d.id,{content:{...f.content,slug},expectedRevision:draft.revision,reason},actor);await publishEditorial(d.id,{expectedRevision:saved.revision,reason},actor);
  assert.deepEqual((await app.inject({url:root+'/compare/'+f.content.slug})).json(),{kind:'redirect',slug});
  assert.match((await app.inject({url:'/sitemap-index.xml'})).body,/sitemap-aifind-editorial\.xml/);
  const map=await app.inject({url:'/sitemap-aifind-editorial.xml'});assert.equal(map.statusCode,200);assert.match(String(map.headers['cache-control']),/no-store/);assert.match(map.body,new RegExp('/compare/'+slug+'<'));assert.doesNotMatch(map.body,new RegExp('/compare/'+f.content.slug+'<'));
});
test('C21/CAT09 public OG, directory, home, related links and sitemap disappear for private/unlisted dependency',async()=>{
  const f=await editorialContent(),d=await createEditorial({content:f.content,reason},actor);await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor);
  const slug=f.content.slug,og='/og/aifind-editorial/compare/'+slug+'.png';assert.equal((await app.inject({url:og})).statusCode,200);
  const related=root+'/products/'+f.products[1].product.slug;assert.match((await app.inject({url:related})).body,new RegExp(slug));
  await visibilityChange(f.products[0].product.id,'unlisted');
  for(const url of [root+'/compare/'+slug,og])assert.equal((await app.inject({url})).statusCode,404,url);
  for(const url of [root+'/compare',root+'/home',related,'/sitemap-aifind-editorial.xml'])assert.doesNotMatch((await app.inject({url})).body,new RegExp(slug),url);
});
test('CAT08 withdrawn curated Category is absent from all public exits and no new v1/RSS/MCP ability is registered',async()=>{
  const f=await editorialContent('category'),d=await createEditorial({content:f.content,reason},actor),p=await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor),slug=f.content.slug;
  assert.equal((await app.inject({url:root+'/categories/'+slug})).statusCode,200);
  await withdrawEditorial(d.id,{expectedRevision:p.revision,reason},actor);
  assert.equal((await app.inject({url:root+'/categories/'+slug})).statusCode,404);
  for(const url of [root+'/categories',root+'/home','/sitemap-aifind-editorial.xml','/feed.xml','/api/v1/items','/llms.txt'])assert.doesNotMatch((await app.inject({url})).body,new RegExp(slug));
  for(const url of ['/api/v1/aifind/compare','/api/v1/categories'])assert.equal((await app.inject({url})).statusCode,404);
});
