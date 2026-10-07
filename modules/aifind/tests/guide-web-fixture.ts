import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import postgres from 'postgres';
import { assertPreviewWrites } from '../preview/config.ts';
const [mode,name]=process.argv.slice(2);assertPreviewWrites(process.env);
const url=new URL(process.env.DATABASE_URL!);
if(!/_(test|ci)$/.test(url.pathname)||!/^aifind_guide_web_[a-f0-9]{12}_test$/.test(name??''))throw Error('Disposable Guide SSR database required');
const dataDir=path.resolve(tmpdir(),name);
if(path.dirname(dataDir)!==path.resolve(tmpdir())||path.basename(dataDir)!==name)throw Error('Unsafe fixture directory');
url.pathname='/postgres';const admin=postgres(url.href,{max:1,onnotice:()=>{}});
if(mode==='cleanup'){try{await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH(FORCE)`;await fs.rm(dataDir,{recursive:true,force:true});}finally{await admin.end();}process.exit(0);}
if(mode!=='serve')throw Error('Unknown fixture mode');
try{await admin`CREATE DATABASE ${admin(name)}`;}finally{await admin.end();}
url.pathname='/'+name;process.env.DATABASE_URL=url.href;process.env.AIHOT_DATA_DIR=dataDir;await fs.mkdir(dataDir);
execFileSync(process.execPath,[fileURLToPath(new URL('../../../scripts/migrate.ts',import.meta.url))],{env:process.env,stdio:'pipe',windowsHide:true});
await import('../../../tests/setup.ts');
const {seedGuidePreview}=await import('../preview/guide-seed.ts');await seedGuidePreview();
const {sql,closeDb}=await import('@aihot/backend/db'),{readEditorialAdmin}=await import('../editorial/read.ts');
const {reviewEditorialAsset}=await import('../editorial/assets.ts');
const {publishEditorial,createEditorialDraft,saveEditorialDraft}=await import('../editorial/documents.ts');
const reason='[SYNTHETIC] Explicit SSR fixture action';
for(const a of await sql`SELECT id FROM af_editorial_assets`)await reviewEditorialAsset(a.id,{rightsBasis:'self_captured',rightsNote:'Self-created synthetic diagram',sourceUrl:null,rightsReviewed:true,privacyReviewed:true,reason},'synthetic-human');
for(const row of await sql`SELECT id FROM af_editorial_documents ORDER BY id`){
  let d=await readEditorialAdmin(row.id);if(d.draft!.content.slug.endsWith('draft-only'))continue;
  d=await publishEditorial(d.id,{expectedRevision:d.revision,reason},'synthetic-human');
  if(d.type==='guide'&&d.publicSlug?.endsWith('official')){
    const draft=await createEditorialDraft(d.id,{expectedRevision:d.revision,reason},'synthetic-human');
    await saveEditorialDraft(d.id,{expectedRevision:draft.revision,reason,content:{...draft.draft!.content,title:'SECRET GUIDE DRAFT'}},'synthetic-human');
  }
}
const{installModules}=await import('@aihot/backend/modules');const{SERVER_MODULES}=await import('@aihot/site/modules/server');const{buildApp}=await import('../../../apps/api/src/app.ts');installModules(SERVER_MODULES);
const app=await buildApp(),origin=await app.listen({host:'127.0.0.1',port:0});console.log(JSON.stringify({guideTestApi:origin}));
process.on('SIGTERM',async()=>{await app.close();await closeDb();process.exit(0);});
