// Scoped, disposable loopback fixture used by the built SSR tests only.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import postgres from 'postgres';
import {assertPreviewWrites} from '../preview/config.ts';
const[mode,name]=process.argv.slice(2);assertPreviewWrites(process.env);
const url=new URL(process.env.DATABASE_URL!);
if(!/_(test|ci)$/.test(url.pathname)||!/^aifind_editorial_web_[a-f0-9]{12}_test$/.test(name??''))throw Error('Disposable Editorial SSR database required');
url.pathname='/postgres';const admin=postgres(url.href,{max:1,onnotice:()=>{}});
if(mode==='cleanup'){try{await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH(FORCE)`;}finally{await admin.end();}process.exit(0);}
if(mode!=='serve')throw Error('Unknown fixture mode');
try{await admin`CREATE DATABASE ${admin(name)}`;}finally{await admin.end();}
url.pathname='/'+name;process.env.DATABASE_URL=url.href;
execFileSync(process.execPath,[fileURLToPath(new URL('../../../scripts/migrate.ts',import.meta.url))],{env:process.env,stdio:'pipe',windowsHide:true});
await import('../../../tests/setup.ts');
const{sql,closeDb}=await import('@aihot/backend/db');
const{seedEditorialPreview}=await import('../preview/editorial-seed.ts');
const{readEditorialAdmin}=await import('../editorial/read.ts');
const{publishEditorial,saveEditorialDraft,createEditorialDraft}=await import('../editorial/documents.ts');
await seedEditorialPreview();
const rows=await sql`SELECT id FROM af_editorial_documents ORDER BY id`;
for(const row of rows){let d=await readEditorialAdmin(row.id);if(d.type==='comparison'&&d.draft!.content.slug.endsWith('-compare')){d=await saveEditorialDraft(d.id,{content:{...d.draft!.content,bodyMd:d.draft!.content.bodyMd+'\n\n<script>alert(1)</script>\n<iframe src="https://evil.example"></iframe>\n\n[unsafe](javascript:alert)\n\n![pixel](https://evil.example/pixel)'},expectedRevision:d.revision,reason:'[SYNTHETIC] Safe authored Markdown fixture'},'synthetic-human');}
  d=await publishEditorial(d.id,{expectedRevision:d.revision,reason:'[SYNTHETIC] Explicit human Publish test setup'},'synthetic-human');
  if(d.type==='comparison'&&d.publicSlug?.endsWith('-compare')){const draft=await createEditorialDraft(d.id,{expectedRevision:d.revision,reason:'[SYNTHETIC] Private editorial Draft'},'synthetic-human');await saveEditorialDraft(d.id,{content:{...draft.draft!.content,title:'SECRET EDITORIAL DRAFT',slug:'secret-editorial-draft'},expectedRevision:draft.revision,reason:'[SYNTHETIC] Private notes never public'},'synthetic-human');}
}
const{installModules}=await import('@aihot/backend/modules');const{SERVER_MODULES}=await import('@aihot/site/modules/server');const{buildApp}=await import('../../../apps/api/src/app.ts');installModules(SERVER_MODULES);
const app=await buildApp(),origin=await app.listen({host:'127.0.0.1',port:0});console.log(JSON.stringify({editorialTestApi:origin}));
process.on('SIGTERM',async()=>{await app.close();await closeDb();process.exit(0);});
