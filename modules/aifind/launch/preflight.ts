import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {sql} from '@aihot/backend/db';
import {config,isProduction,assertProductionSecrets} from '@aihot/backend/config';
import {backupConfigured} from '@aihot/backend/operations/backup';
import {readPublishedSnapshot} from '@aihot/backend/publication/snapshot';
import {readProducts,type VersionRow} from '../catalog/read.ts';
import {publicReadinessIssues} from '../catalog/public-settings.ts';
import {readEditorialRevisions} from '../editorial/read.ts';
import {projectEditorialRevisions} from '../publication/editorial.ts';
import {readEditorialAsset,checkedAssetBytes} from '../editorial/assets.ts';
import {readLaunchCorpus,assertNoSynthetic,sourceBackedReadinessIssues,sourceBackedProductIssues} from './corpus.ts';
import {readCandidate} from '../changes/candidates.ts';
import {assertCatalogWrites} from '../catalog-pack/import.ts';
import {readFrozenBundle} from './bundle.ts';
import {factCompletenessIssues,productFactCompletenessIssues} from './facts.ts';
export interface LaunchCheck {id:string;area:'runtime'|'safety'|'content'|'evidence'|'assets'|'sources'|'operations';status:'PASS'|'WARN'|'BLOCK'|'INFO'|'DEFERRED';detail:string}
export interface LaunchSnapshot {
  nodeVersion:string;siteUrl:string;databaseConfigured:boolean;dataDirPresent:boolean;credentialsConfigured:boolean;
  previewEnabled:boolean;productionImportDisabled:boolean;externalEnabled:string[];syntheticCount:number;
  products:number;eligible:number;comparison:number;category:number;guide:number;needsRetest:number;ownerPending:number;
  missingEvidence:number;staleEvidence:number;brokenOfficial:number;missingAssets:number;unreviewedAssets:number;
  unreviewedSources:number;blockedEnabledSources:number;backupOk:boolean;restoreOk:boolean;workerHealthy:boolean;
  pendingReceipts:number;unknownReceipts:number;failedJobs:number;operatorConfigured:boolean;policiesReviewed:boolean;
  production?:boolean;productionSecretsOk?:boolean;backupConfigured?:boolean;
  publicationPolicy?:'owner_review'|'source_backed';launchCollectionMode?:'off'|'on';sourceBackedIssueCount?:number;
  enabledSources?:number;localBackupOk?:boolean;remoteRestoreOk?:boolean;factCompletenessIssueCount?:number;
}
export function evaluateLaunchChecks(s:LaunchSnapshot):LaunchCheck[]{
  const checks:LaunchCheck[]=[],add=(id:string,status:LaunchCheck['status'],detail:string)=>checks.push({id,area:id.split('.')[0] as LaunchCheck['area'],status,detail});
  const candidate=s.publicationPolicy==='source_backed'&&s.launchCollectionMode==='off'&&!s.production;
  const collectionOff=s.launchCollectionMode==='off'&&!s.externalEnabled.length&&(s.enabledSources??0)===0;
  const [major,minor]=s.nodeVersion.split('.').map(Number);add('runtime.node',major>24||major===24&&minor>=11?'PASS':'BLOCK',s.nodeVersion);
  let urlOk=false;try{const u=new URL(s.siteUrl);urlOk=['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{}
  add('runtime.siteUrl',urlOk?'PASS':'BLOCK',urlOk?s.siteUrl:'SITE_URL missing or invalid');
  add('runtime.database',s.databaseConfigured?'PASS':'BLOCK','database configured: '+s.databaseConfigured);
  add('runtime.dataDir',s.dataDirPresent?'PASS':'BLOCK','persistent data directory present: '+s.dataDirPresent);
  add('runtime.credentials',s.credentialsConfigured?'PASS':'BLOCK','admin credential configured: '+s.credentialsConfigured);
  add('runtime.productionSecrets',s.production&&!s.productionSecretsOk?'BLOCK':'PASS',s.production?'critical production auth secrets checked; values redacted':'non-production; production secret validation not applicable');
  add('safety.preview',s.previewEnabled?'BLOCK':'PASS','synthetic Preview feature flag must be disabled');
  add('safety.synthetic',s.syntheticCount?'BLOCK':'PASS',String(s.syntheticCount)+' candidate public records with synthetic markers');
  add('safety.import',s.productionImportDisabled?'PASS':'BLOCK','production Catalog import guard');
  add('safety.external',s.externalEnabled.length?(s.launchCollectionMode==='off'?'BLOCK':'WARN'):'PASS','explicitly enabled external flags: '+(s.externalEnabled.join(', ')||'none; no external/model request from preflight'));
  add('safety.collection',s.launchCollectionMode==='off'&&!collectionOff?'BLOCK':'PASS',`launchCollectionMode ${s.launchCollectionMode??'on'}; enabled Product Monitors ${s.enabledSources??0}`);
  add('content.minimum',s.products>=12&&s.eligible>=12&&s.comparison>=2&&s.category>=2&&s.guide>=2?'PASS':'BLOCK',`Products ${s.products}, eligible ${s.eligible}; Compare ${s.comparison}, Category ${s.category}, Guide ${s.guide}`);
  add('content.owner',s.publicationPolicy==='source_backed'?'INFO':s.ownerPending?'BLOCK':'PASS',s.publicationPolicy==='source_backed'?'Per-Product Owner approval is not a publication gate; source-backed deterministic validation applies':String(s.ownerPending)+' Products require actual Owner factual review');
  if(s.publicationPolicy==='source_backed')add('content.sourceBacked',s.sourceBackedIssueCount===0&&s.products===12?'PASS':'BLOCK',`source-backed issues ${s.sourceBackedIssueCount??'not checked'}; exactly twelve launch Products required`);
  if(s.publicationPolicy==='source_backed')add('content.factCompleteness',s.factCompletenessIssueCount===0?'PASS':'BLOCK',`undocumented unknown or mismatched fact review issues ${s.factCompletenessIssueCount??'not checked'}`);
  add('content.operator',s.operatorConfigured?'PASS':'BLOCK','editorial operator display and real contact form entry configured: '+s.operatorConfigured);
  add('content.policies',s.policiesReviewed?'PASS':'BLOCK','terms/privacy/contact policy approval: '+s.policiesReviewed);
  add('content.retest',s.needsRetest?'WARN':'PASS',String(s.needsRetest)+' published editorials require retest');
  add('evidence.missing',s.missingEvidence?'BLOCK':'PASS',String(s.missingEvidence)+' missing verification or public readiness facts');
  add('evidence.stale',s.staleEvidence?'WARN':'PASS',String(s.staleEvidence)+' Products not verified within 30 days');
  add('evidence.urls',s.brokenOfficial?'WARN':'PASS',String(s.brokenOfficial)+' limited/unavailable official sources; no network request during preflight');
  add('assets.files',s.missingAssets?'BLOCK':'PASS',String(s.missingAssets)+' files missing or hash mismatched');
  add('assets.review',s.unreviewedAssets?'BLOCK':'PASS',String(s.unreviewedAssets)+' assets require rights/privacy review');
  add('sources.policy',collectionOff?'DEFERRED':s.unreviewedSources||s.blockedEnabledSources?'BLOCK':'PASS',collectionOff?'Automated Product collection is intentionally disabled for launch. Source permission review is required before enabling it.':`unreviewed ${s.unreviewedSources}; blocked+enabled ${s.blockedEnabledSources}; collection readiness only`);
  add('operations.backup',(candidate?s.localBackupOk:s.backupOk)?'PASS':'BLOCK',candidate?'verified local DB/uploads backup evidence: '+s.localBackupOk:'last uploaded backup evidence valid: '+s.backupOk);
  add('operations.backupConfig',s.backupConfigured===false?(candidate?'DEFERRED':'BLOCK'):'PASS','object store backup configuration: '+String(s.backupConfigured??true));
  if(candidate)add('operations.remoteRecovery',s.backupOk&&s.remoteRestoreOk?'PASS':'DEFERRED','Remote backup/restore is a Phase 9 production disaster-recovery prerequisite; local proof is separate');
  add('operations.restore',s.restoreOk?'PASS':'BLOCK','paired DB/uploads restore rehearsal proven: '+s.restoreOk);
  add('operations.worker',s.workerHealthy?'PASS':'BLOCK','worker heartbeat within three minutes: '+s.workerHealthy);
  add('operations.receipts',s.unknownReceipts?'BLOCK':s.pendingReceipts?'WARN':'PASS',`unknown ${s.unknownReceipts}; pending ${s.pendingReceipts}`);
  add('operations.jobs',s.failedJobs?'WARN':'PASS',String(s.failedJobs)+' failed runs in past 24 hours');
  return checks;
}
export function evaluateLaunchGates(s:LaunchSnapshot,checks=evaluateLaunchChecks(s)){
  const blocks=(areas:string[])=>checks.some(c=>c.status==='BLOCK'&&areas.includes(c.area));
  const engineering=blocks(['runtime','safety','evidence','assets'])?'NOT READY':'READY',content=blocks(['content'])?'NOT READY':'READY';
  const opsBlocked=blocks(['operations','sources'])||!s.operatorConfigured||!s.policiesReviewed;
  const operations=opsBlocked?'NOT READY':checks.some(c=>c.status==='DEFERRED'&&c.area==='operations')?'PARTIAL':'READY';
  const releaseCandidate=engineering==='READY'&&content==='READY'&&!opsBlocked?'READY':'NOT READY';
  const launchFactCompleteness=['content.factCompleteness','content.sourceBacked','content.minimum']
    .every(id=>checks.find(c=>c.id===id)?.status==='PASS')?'READY':'NOT READY';
  return{engineering,content,launchFactCompleteness,releaseCandidate,operations,productionDeploy:'NOT EXECUTED',phase9:releaseCandidate==='READY'&&operations==='READY'?'READY':'NOT READY',production:'NOT EXECUTED'};
}
async function localBackupVerified(backup:{filesError?:unknown;objects?:Array<{key:string;bytes:number;sha256:string}>}|undefined):Promise<boolean>{
  if(!backup||backup.filesError||!Array.isArray(backup.objects))return false;
  const objects=backup.objects.filter(o=>o.key.startsWith('local-only:'));
  const dump=objects.find(o=>o.key.endsWith('.dump')),archive=objects.find(o=>o.key.endsWith('.tar.gz'));
  if(!dump||!archive)return false;
  const base=await fs.realpath(path.join(config.dataDir,'backups')).catch(()=>null);if(!base)return false;
  for(const object of [dump,archive]){
    const name=object.key.slice('local-only:'.length);if(name!==path.basename(name)||!name||!Number.isSafeInteger(object.bytes)||object.bytes<=0||!/^[a-f0-9]{64}$/.test(object.sha256))return false;
    const file=await fs.realpath(path.join(base,name)).catch(()=>null);if(!file||path.dirname(file)!==base)return false;
    if((await fs.stat(file)).size!==object.bytes)return false;
    const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
    if(hash.digest('hex')!==object.sha256)return false;
  }
  return true;
}
export async function readLaunchPreflight(options:{env?:NodeJS.ProcessEnv;now?:Date}={}){
  const env=options.env??process.env,now=options.now??new Date(),corpus=await readLaunchCorpus();
  const owner=JSON.parse(await fs.readFile(new URL('../../../site/launch/owner-review.json',import.meta.url),'utf8'));
  const policyCopy=await Promise.all(['terms','privacy'].map(n=>fs.readFile(new URL('../../../site/pages/'+n+'.md',import.meta.url),'utf8')));
  const db=await readPublishedSnapshot(async tx=>{
    const all=await tx`SELECT id,slug,canonical_name,public_visibility FROM af_products ORDER BY slug`;
    const versions=await tx<VersionRow[]>`SELECT v.* FROM af_product_versions v WHERE status='published' ORDER BY product_id`;
    const products=await readProducts(tx,versions),published=products.filter(p=>all.some(r=>r.id===p.identity.id&&r.public_visibility!=='private'));
    let missingEvidence=0;for(const p of published)missingEvidence+=(await publicReadinessIssues(tx,p)).length;
    const [eligible]=await tx`SELECT count(*)::int AS n FROM af_products p JOIN af_product_versions v ON v.product_id=p.id WHERE p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v)`;
    const docs=await tx`SELECT id,doc_type,published_revision_id FROM af_editorial_documents WHERE state='published' ORDER BY id`;
    const revisions=await readEditorialRevisions(tx,docs.map(d=>d.published_revision_id)),publicDocs=[...(await projectEditorialRevisions(tx,revisions)).values()];
    let syntheticCount=0;for(const p of [...published,...revisions.map(r=>r.content)])try{assertNoSynthetic(p);}catch{syntheticCount++;}
    const assets=await tx`SELECT id,storage_key FROM af_editorial_assets ORDER BY id`,referenced=await tx`SELECT DISTINCT asset_id FROM af_editorial_revision_assets`;
    let missingAssets=0,unreviewedAssets=0;for(const r of assets){const a=(await readEditorialAsset(r.id,tx))!;if(!await checkedAssetBytes(a))missingAssets++;if(!a.rightsReviewedAt||!a.privacyReviewedAt||a.rightsBasis==='unreviewed')unreviewedAssets++;}
    const sources=await tx`SELECT id,url,source_kind,publisher,enabled,policy_status,retention_class,excerpt_days,policy_reviewed_at,policy_reviewed_by,policy_reason,policy_fetch_allowed,policy_jina_allowed FROM af_source_monitors ORDER BY id`;
    const observations=await tx`SELECT id,state,url,content_hash,retrieved_at,retention_class,retention_expires_at,pruned_at,length(source_text) AS retained_length FROM af_source_observations ORDER BY retrieved_at DESC,id LIMIT 20`;
    const [retention]=await tx`SELECT count(*) FILTER(WHERE state='fetch_failed')::int AS source_failures,
      count(*) FILTER(WHERE pruned_at IS NULL AND source_text<>'' AND retention_expires_at<=${now.toISOString()}::timestamptz AND state IN ('observed','model_disabled','budget_blocked','error','receipt_unknown'))::int AS expired_unfinished FROM af_source_observations`;
    const [receipts]=await tx`SELECT count(*) FILTER(WHERE status='unknown')::int AS unknown,count(*) FILTER(WHERE status='pending')::int AS pending FROM receipts`;
    const runs=await tx`SELECT job,status,started_at,finished_at FROM job_runs ORDER BY started_at DESC,id DESC LIMIT 20`;
    const [failed]=await tx`SELECT count(*)::int AS n FROM job_runs WHERE status='failed' AND started_at>${now.toISOString()}::timestamptz-interval '24 hours'`;
    const settings=await tx`SELECT key,value FROM settings WHERE key IN ('heartbeat.worker','backup.last','aifind.launch.rehearsal')`,byKey=new Map(settings.map(s=>[s.key,s.value]));
    const budgets=await tx`SELECT b.service,b.per_day,(SELECT count(*)::int FROM receipt_attempts a WHERE a.service=b.service AND a.origin='live' AND a.started_at>${now.toISOString()}::timestamptz-interval '24 hours') AS used FROM budgets b ORDER BY service`;
    const [candidateAge]=await tx`SELECT count(*)::int AS pending,min(created_at) AS oldest FROM af_product_change_candidates WHERE status IN ('pending_review','approved')`;
    const candidates=await tx`SELECT id FROM af_product_change_candidates ORDER BY created_at DESC,id LIMIT 3`;
    return{all,published,eligible:eligible.n,missingEvidence,docs,publicDocs,syntheticCount,assets,missingAssets,unreviewedAssets,referenced,sources,observations,retention,receipts,runs,failed:failed.n,byKey,budgets,candidateAge,candidates};
  });
  const heartbeat=db.byKey.get('heartbeat.worker'),backup=db.byKey.get('backup.last'),rehearsal=db.byKey.get('aifind.launch.rehearsal');
  const production=env.NODE_ENV==='production'||env.AIHOT_ENVIRONMENT==='production',localBackupOk=await localBackupVerified(backup);
  const candidate=owner.publicationPolicy==='source_backed'&&owner.launchCollectionMode==='off'&&!production;
  const sourceDatabase=env.DATABASE_URL?new URL(env.DATABASE_URL).pathname.slice(1):'';
  const restore=rehearsal?.restore,backupHashes=backup?.objects as Array<{key:string;sha256:string}>|undefined;
  const pairedRestore=restore?.passed===true&&restore?.uploadsIncluded===true&&localBackupOk&&restore.sourceDatabase===sourceDatabase
    &&typeof restore.database==='string'&&/_(test|ci)$/.test(restore.database)&&restore.database!==sourceDatabase
    &&restore.backupHashes?.dump===backupHashes?.find(o=>o.key.endsWith('.dump'))?.sha256
    &&restore.backupHashes?.files===backupHashes?.find(o=>o.key.endsWith('.tar.gz'))?.sha256;
  const dataDirPresent=await fs.stat(config.dataDir).then(s=>s.isDirectory()).catch(()=>false);
  const assetDir=path.join(config.dataDir,'uploads/aifind-editorial'),assetFiles=await fs.readdir(assetDir).catch(()=>[]);
  const externalFlags=['COLLECT_ENABLED','MODEL_CALLS_ENABLED','AIFIND_DETECTOR_ENABLED','FEISHU_CONTENT_PUSH_ENABLED','FEISHU_INTERNAL_ENABLED','INDEXNOW_SUBMIT_ENABLED'];
  let productionImportDisabled=false;try{assertCatalogWrites({...env,NODE_ENV:'production'});}catch{productionImportDisabled=true;}
  let productionSecretsOk=!production;if(isProduction)try{assertProductionSecrets([['auth','SESSION_SECRET'],['auth','IMG_PROXY_SIGN_SECRET']]);productionSecretsOk=true;}catch{}
  const adminPassword=options.env?(env.ADMIN_PASSWORD??config.adminPassword):config.adminPassword;
  const snapshot:LaunchSnapshot={nodeVersion:process.versions.node,siteUrl:env.SITE_URL??'',databaseConfigured:!!env.DATABASE_URL,dataDirPresent,
    credentialsConfigured:!!adminPassword&&adminPassword.trim().length>=16&&!/^(.)\1+$/.test(adminPassword),
    previewEnabled:env.AIFIND_PREVIEW_ENABLED==='true',productionImportDisabled,externalEnabled:externalFlags.filter(k=>env[k]==='true'),syntheticCount:db.syntheticCount,
    products:db.all.length,eligible:db.eligible,comparison:db.publicDocs.filter(d=>d.type==='comparison').length,category:db.publicDocs.filter(d=>d.type==='category').length,guide:db.publicDocs.filter(d=>d.type==='guide').length,
    needsRetest:db.publicDocs.filter(d=>d.type!=='category'&&d.needsRetest).length,ownerPending:corpus.dossiers.length,missingEvidence:db.missingEvidence,
    staleEvidence:db.published.filter(p=>!p.lastVerifiedAt||now.getTime()-new Date(p.lastVerifiedAt).getTime()>30*86400000).length,
    brokenOfficial:corpus.dossiers.flatMap(d=>d.sources).filter(s=>s.access!=='accessible').length,missingAssets:db.missingAssets,unreviewedAssets:db.unreviewedAssets,
    unreviewedSources:db.sources.filter(s=>s.policy_status==='unreviewed').length,blockedEnabledSources:db.sources.filter(s=>s.enabled&&s.policy_status!=='approved').length,
    backupOk:!!backup&&!backup.filesError&&backup.uploaded===true,restoreOk:candidate?pairedRestore:restore?.passed===true&&restore?.uploadsIncluded===true,
    workerHealthy:!!heartbeat?.at&&now.getTime()-new Date(heartbeat.at).getTime()>=0&&now.getTime()-new Date(heartbeat.at).getTime()<180000,
    pendingReceipts:db.receipts.pending,unknownReceipts:db.receipts.unknown,failedJobs:db.failed,
    operatorConfigured:owner.operatorName==='AIFIND編集部'&&owner.contactChannel==='/contact',policiesReviewed:owner.policiesReviewed===true&&!policyCopy.some(s=>/草案|公開前確認|未定|待确认|TODO|placeholder/i.test(s)),
    publicationPolicy:owner.publicationPolicy==='source_backed'?'source_backed':'owner_review',launchCollectionMode:owner.launchCollectionMode==='off'?'off':'on',
    enabledSources:db.sources.filter(s=>s.enabled).length,remoteRestoreOk:rehearsal?.restore?.remote===true,
    localBackupOk,
    sourceBackedIssueCount:sourceBackedReadinessIssues(corpus).length+db.published.reduce((n,p)=>{const d=corpus.dossiers.find(d=>d.productSlug===p.identity.slug);return n+(d?sourceBackedProductIssues(p,d).length:1);},0),
    factCompletenessIssueCount:factCompletenessIssues(corpus).length+db.published.reduce((n,p)=>{const d=corpus.dossiers.find(d=>d.productSlug===p.identity.slug);return n+(d?productFactCompletenessIssues(p,d).length:1);},0),
    production,productionSecretsOk,backupConfigured:backupConfigured()};
  const checks=evaluateLaunchChecks(snapshot);
  const supporting=[];for(const c of db.candidates)supporting.push(await readCandidate(c.id));
  return{schemaVersion:1,at:now.toISOString(),context:production?'production configuration only':'non-production staging',checks,counts:snapshot,
    gates:evaluateLaunchGates(snapshot,checks),
    review:corpus.dossiers.map(d=>({...d,facts:corpus.pack.products.find(p=>p.slug===d.productSlug)})),sources:db.sources,observations:db.observations,supportingEvidence:supporting,
    bundle:await readFrozenBundle(path.join(config.dataDir,'launch-bundle')),
    assets:{rows:db.assets.length,files:assetFiles.length,orphanRows:db.assets.filter(a=>!db.referenced.some(r=>r.asset_id===a.id)).length,orphanFiles:assetFiles.filter(f=>!db.assets.some(a=>path.basename(a.storage_key)===f)).length,gcImplemented:false},
    operations:{heartbeat:heartbeat?{at:heartbeat.at,startedAt:heartbeat.startedAt,release:heartbeat.release}:null,lastBackup:backup?{at:backup.at,uploaded:backup.uploaded,filesError:!!backup.filesError}:null,
      rehearsal:rehearsal?{at:rehearsal.at,restore:{passed:rehearsal.restore?.passed===true,uploadsIncluded:rehearsal.restore?.uploadsIncluded===true},bundleSha256:rehearsal.bundleSha256??null}:null,
      runs:db.runs,budgets:db.budgets,candidates:{pending:db.candidateAge.pending,oldest:db.candidateAge.oldest?.toISOString()??null},sourceFailures:db.retention.source_failures,expiredUnfinishedInput:db.retention.expired_unfinished}};
}
export type LaunchPreflight=Awaited<ReturnType<typeof readLaunchPreflight>>;
