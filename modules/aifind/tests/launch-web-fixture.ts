import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import postgres from 'postgres';
const [mode,name]=process.argv.slice(2);
const url=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.search||process.env.NODE_ENV==='production'||process.env.AIHOT_ENVIRONMENT==='production')throw Error('Non-production loopback fixture required');
if(!/_(test|ci)$/.test(url.pathname)||!/^aifind_launch_web_[a-f0-9]{12}_test$/.test(name??''))throw Error('Disposable Launch SSR database required');
const dataDir=path.resolve(tmpdir(),name);if(path.dirname(dataDir)!==path.resolve(tmpdir())||path.basename(dataDir)!==name)throw Error('Unsafe fixture directory');
url.pathname='/postgres';const admin=postgres(url.href,{max:1,onnotice:()=>{}});
if(mode==='cleanup'){try{await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH(FORCE)`;await fs.rm(dataDir,{recursive:true,force:true});}finally{await admin.end();}process.exit(0);}
if(mode!=='serve')throw Error('Unknown mode');
try{await admin`CREATE DATABASE ${admin(name)}`;}finally{await admin.end();}
url.pathname='/'+name;process.env.DATABASE_URL=url.href;process.env.AIHOT_DATA_DIR=dataDir;await fs.mkdir(dataDir);
execFileSync(process.execPath,[fileURLToPath(new URL('../../../scripts/migrate.ts',import.meta.url))],{env:process.env,stdio:'pipe',windowsHide:true});
await import('../../../tests/setup.ts');
const {readLaunchCorpus}=await import('../launch/corpus.ts'),{stageLaunchCorpus,rehearseLaunchPublication}=await import('../launch/staging.ts'),c=await readLaunchCorpus();
const {sql}=await import('@aihot/backend/db');if((await sql`SELECT current_database() AS name`)[0].name!==name)throw Error('Fixture connection differs from the explicitly created database');
await stageLaunchCorpus(c,'Launch SSR simulation');await rehearseLaunchPublication(c,'Launch SSR simulation','Phase 8 local publication simulation, Owner review required');
const {installModules}=await import('@aihot/backend/modules'),{SERVER_MODULES}=await import('@aihot/site/modules/server'),{buildApp}=await import('../../../apps/api/src/app.ts'),{closeDb}=await import('@aihot/backend/db');
installModules(SERVER_MODULES);const app=await buildApp(),origin=await app.listen({host:'127.0.0.1',port:0});console.log(JSON.stringify({launchTestApi:origin}));
process.on('SIGTERM',async()=>{await app.close();await closeDb();process.exit(0);});
