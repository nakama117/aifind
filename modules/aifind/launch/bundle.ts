import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {config} from '@aihot/backend/config';
import {stablePackJson} from '../catalog-pack/import.ts';
import {validateLaunchCorpus,sourceBackedReadinessIssues} from './corpus.ts';
import {factCompletenessIssues} from './facts.ts';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const hashSchema=z.string().regex(/^[a-f0-9]{64}$/);
const migrationSchema=z.strictObject({name:z.string(),path:z.string(),sha256:hashSchema});
const assetSchema=z.strictObject({id:z.string().min(1),storageKey:z.string(),sha256:hashSchema,rightsReviewed:z.literal(true),privacyReviewed:z.literal(true)});
const launchMetadataSchema=z.strictObject({publicationPolicy:z.literal('source_backed'),launchCollectionMode:z.literal('off'),operatorDisplayName:z.literal('AIFIND編集部'),contactPath:z.literal('/contact'),previewEnabled:z.literal(false),productionDeploy:z.literal('NOT EXECUTED')});
const inputSchema=z.strictObject({corpus:z.unknown(),assets:z.array(assetSchema),sourcePolicies:z.array(z.record(z.string(),z.unknown())),
  preflight:z.record(z.string(),z.unknown()),baselineHashes:z.array(z.strictObject({name:z.string().min(1),sha256:hashSchema})).min(1),migrations:z.array(migrationSchema),launchMetadata:launchMetadataSchema.optional()});
export interface ReleaseManifest {schemaVersion:1;packId:string;revision:number;researchedAt:string;purpose:string;files:Array<{name:string;sha256:string;bytes:number}>}
const manifestSchema=z.strictObject({schemaVersion:z.literal(1),packId:z.string().max(200),revision:z.number().int(),researchedAt:z.string(),purpose:z.string().max(500),
  files:z.array(z.strictObject({name:z.string().regex(/^(?:[a-z-]+\.json|assets\/[a-f0-9]{64}\.webp)$/),sha256:hashSchema,bytes:z.number().int().nonnegative()}))});
export async function readFrozenBundle(directory:string){
  const bytes=await fs.readFile(path.join(directory,'manifest.json')).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
  if(!bytes)return null;const manifest=manifestSchema.parse(JSON.parse(bytes.toString('utf8')));
  let valid=true;for(const f of manifest.files){const payload=await fs.readFile(path.join(directory,f.name)).catch(()=>null);if(!payload||sha(payload)!==f.sha256||payload.length!==f.bytes)valid=false;}
  return{manifestSha256:sha(bytes),valid,manifest};
}

/** Only the deployed migration directories, never .data backups or a hand-written partial list. */
export async function readMigrationManifest(){
  const dirs=['database/migrations',...(await fs.readdir(path.join(root,'modules'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>'modules/'+d.name+'/migrations')];
  const files=[];
  for(const dir of dirs)for(const name of await fs.readdir(path.join(root,dir)).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return[];throw e;})){
    if(!/^\d+_.+\.sql$/.test(name))continue;
    const relative=dir+'/'+name;files.push({name,path:relative,sha256:sha(await fs.readFile(path.join(root,relative)))});
  }
  return files.sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path));
}
function assertNoCredentials(value:unknown):void{
  if(Array.isArray(value)){value.forEach(assertNoCredentials);return;}
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
    if(/(?:password|secret|token|cookie|api[_-]?key|access[_-]?key|authorization|dsn|database[_-]?url|credentials?)$/i.test(key)||/^(?:env|headers)$/i.test(key))throw Error('secret/credential field refused: '+key);
    assertNoCredentials(item);
  }
  if(typeof value==='string'){
    if(/postgres(?:ql)?:\/\/|\bsk-(?:proj-|svcacct-|[A-Za-z0-9_-]{20})|-----BEGIN.*PRIVATE KEY|Bearer\s+\S+|[?&](?:api[_-]?key|token|password|secret)=/i.test(value))throw Error('secret/credential value refused');
    if(/^https?:\/\//.test(value)){const u=new URL(value);if(u.username||u.password)throw Error('URL credentials refused');}
  }
}
export async function buildLaunchBundle(input:unknown,directory:string):Promise<ReleaseManifest>{
  assertNoCredentials(input);const v=inputSchema.parse(input),corpus=validateLaunchCorpus(v.corpus),migrations=await readMigrationManifest();
  if(v.launchMetadata){const issues=sourceBackedReadinessIssues(corpus);if(issues.length)throw Error('source-backed bundle validation failed: '+issues.join('; '));}
  if(v.launchMetadata){const issues=factCompletenessIssues(corpus);if(issues.length)throw Error('fact completeness bundle validation failed: '+issues.join('; '));}
  for(const e of corpus.editorial)if(e.type==='guide'&&e.guide.assets.some(a=>!v.assets.some(v=>v.id===a.assetId)))throw Error('referenced asset missing from asset manifest');
  if(stablePackJson(v.migrations)!==stablePackJson(migrations))throw Error('complete current migration manifest required');
  const payloads=new Map<string,Buffer>();
  const json=(name:string,value:unknown)=>payloads.set(name,Buffer.from(stablePackJson(value)+'\n'));
  json('product-pack.json',corpus.pack);json('editorial-manifest.json',{referenceMode:corpus.referenceMode,candidates:corpus.editorial});
  json('content-review-manifest.json',{researchedAt:corpus.researchedAt,ownerApproved:0,dossiers:corpus.dossiers});
  json('source-policy-manifest.json',v.sourcePolicies);json('preflight.json',v.preflight);json('test-baseline-hashes.json',v.baselineHashes);
  json('migrations.json',migrations);json('asset-manifest.json',v.assets);
  if(v.launchMetadata)json('launch-metadata.json',v.launchMetadata);
  const dataRoot=await fs.realpath(config.dataDir).catch(()=>path.resolve(config.dataDir));
  for(const asset of v.assets){
    if(asset.storageKey!=='uploads/aifind-editorial/'+asset.sha256+'.webp')throw Error('invalid controlled asset path');
    const absolute=path.join(config.dataDir,asset.storageKey),real=await fs.realpath(absolute).catch(()=>{throw Error('asset file missing');});
    const relative=path.relative(dataRoot,real);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('asset outside data directory');
    const bytes=await fs.readFile(real);if(sha(bytes)!==asset.sha256)throw Error('asset hash mismatch');
    payloads.set('assets/'+asset.sha256+'.webp',bytes);
  }
  const manifest:ReleaseManifest={schemaVersion:1,packId:corpus.pack.packId,revision:corpus.pack.revision,researchedAt:corpus.researchedAt,
    purpose:v.launchMetadata?'non-production source-backed release candidate; production deployment not executed':'non-production release candidate; Owner review and operations approval required',files:[...payloads].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({name,sha256:sha(bytes),bytes:bytes.length}))};
  // All validation completes before exclusive directory creation. Never overwrite any prior release.
  await fs.mkdir(directory,{recursive:false});
  for(const [name,bytes] of payloads){const target=path.join(directory,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});}
  await fs.writeFile(path.join(directory,'manifest.json'),stablePackJson(manifest)+'\n',{flag:'wx'});
  return manifest;
}
