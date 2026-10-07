import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sql} from '@aihot/backend/db';
const corpus=JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8'));
after(()=>sql.end());
const good={nodeVersion:process.versions.node,siteUrl:'http://localhost:4000',databaseConfigured:true,dataDirPresent:true,credentialsConfigured:true,previewEnabled:false,productionImportDisabled:true,externalEnabled:[],syntheticCount:0,products:12,eligible:12,comparison:2,category:2,guide:2,needsRetest:0,ownerPending:12,missingEvidence:0,staleEvidence:0,brokenOfficial:0,missingAssets:0,unreviewedAssets:0,unreviewedSources:12,blockedEnabledSources:0,enabledSources:0,backupOk:false,backupConfigured:false,localBackupOk:true,restoreOk:true,remoteRestoreOk:false,workerHealthy:true,pendingReceipts:0,unknownReceipts:0,failedJobs:0,operatorConfigured:true,policiesReviewed:true,publicationPolicy:'source_backed' as const,launchCollectionMode:'off' as const,sourceBackedIssueCount:0,production:false};
Object.assign(good,{factCompletenessIssueCount:0});
const preflight=()=>import('../launch/preflight.ts');
async function checks(changes:Record<string,unknown>={}){return(await preflight()).evaluateLaunchChecks({...good,...changes});}
const find=(rows:Awaited<ReturnType<typeof checks>>,id:string)=>rows.find(row=>row.id===id);
const issues=async(value:unknown=corpus)=>(await import('../launch/corpus.ts')).sourceBackedReadinessIssues(value);

test('RC01 explicit OFF with every Monitor disabled defers collection permission only',async()=>{
  const rows=await checks();assert.equal(find(rows,'sources.policy')?.status,'DEFERRED');assert.equal(find(rows,'safety.external')?.status,'PASS');
});
test('RC02 OFF rejects each unexpectedly enabled collection or model valve',async()=>{
  for(const flag of ['COLLECT_ENABLED','AIFIND_DETECTOR_ENABLED','MODEL_CALLS_ENABLED'])assert.equal(find(await checks({externalEnabled:[flag]}),'safety.external')?.status,'BLOCK');
});
test('RC03 OFF rejects even an approved enabled Monitor',async()=>{
  assert.equal(find(await checks({enabledSources:1,unreviewedSources:0}),'safety.collection')?.status,'BLOCK');
});
test('RC04 deterministic source-backed readiness does not require per-Product Owner approval',async()=>{
  const rows=await checks();assert.equal(find(rows,'content.owner')?.status,'INFO');assert.equal(find(rows,'content.sourceBacked')?.status,'PASS');
  assert.equal(find(await checks({sourceBackedIssueCount:1}),'content.sourceBacked')?.status,'BLOCK');
});
test('RC05 weak admin configuration blocks the candidate rather than warning',async()=>{
  assert.equal(find(await checks({credentialsConfigured:false}),'runtime.credentials')?.status,'BLOCK');
});
test('RC06 local paired recovery earns candidate READY while remote disaster recovery stays PARTIAL',async()=>{
  const gates=(await preflight()).evaluateLaunchGates(good);
  assert.equal(gates.engineering,'READY');assert.equal(gates.content,'READY');assert.equal(gates.releaseCandidate,'READY');assert.equal(gates.operations,'PARTIAL');assert.equal(gates.productionDeploy,'NOT EXECUTED');
});
test('RC07 absent local backup or failed paired restore blocks candidate readiness',async()=>{
  for(const changes of [{localBackupOk:false},{restoreOk:false}])assert.equal((await preflight()).evaluateLaunchGates({...good,...changes}).releaseCandidate,'NOT READY');
});
test('RC08 source-backed definite facts reject inaccessible or cross-Product Evidence',async()=>{
  const unavailable=structuredClone(corpus),first=unavailable.pack.products[0],key=first.capabilities[0].evidenceKey,url=unavailable.pack.evidence.find((e:{key:string})=>e.key===key).url;
  for(const s of unavailable.dossiers[0].sources)if(s.url===url)s.access='unavailable';
  assert.ok((await issues(unavailable)).some((s:string)=>/accessible|access/i.test(s)));
  const crossed=structuredClone(corpus);crossed.pack.products[0].capabilities[0].evidenceKey='claude-docs';
  assert.ok((await issues(crossed)).some((s:string)=>/dossier|Product|source/i.test(s)));
});
test('RC09 unresolved source contradictions block asserted facts but not downgraded unknown fields',async()=>{
  const c=structuredClone(corpus);c.dossiers[0].unresolvedContradictions=['capability:text'];
  assert.ok((await issues(c)).some((s:string)=>/contradiction/i.test(s)));
  const fact=c.pack.products[0].capabilities.find((f:{capabilityKey:string})=>f.capabilityKey==='text');fact.supportLevel='unknown';fact.evidenceKey=null;fact.verifiedAt=null;
  assert.deepEqual(await issues(c),[]);
});
test('RC10 unknown Japan, language, platform and price remain valid launch states',async()=>{
  const c=structuredClone(corpus);c.pack.products[0].markets[0]={marketCode:'JP',availabilityStatus:'unknown'};
  assert.deepEqual(await issues(c),[]);
});
test('RC11 candidate rejects fake winner and unsupported hands-on claims in generated editorial text',async()=>{
  for(const marker of ['AIFIND実測でNo.1','ユーザー数100万人','最強のAI']){const c=structuredClone(corpus);c.editorial[0].bodyMd+='\n'+marker;
    assert.ok((await issues(c)).some((s:string)=>/claim|ranking|hands.on/i.test(s)));}
});
test('RC12 launch candidate stays exactly twelve Products',async()=>{
  const c=structuredClone(corpus),p=structuredClone(c.pack.products[0]);p.slug='extra-product';p.aliases=[];c.pack.products.push(p);
  const d=structuredClone(c.dossiers[0]);d.productSlug='extra-product';c.dossiers.push(d);
  assert.ok((await issues(c)).some((s:string)=>/12|twelve/i.test(s)));
});
test('RC13 actual preflight rejects weak credentials and accepts only explicitly configured strong local credentials',async()=>{
  const read=(await preflight()).readLaunchPreflight;
  for(const [password,status] of [['admin','BLOCK'],['local-fake-credential-for-tests-only','PASS']]){
    const r=await read({env:{...process.env,SITE_URL:'http://localhost:4000',ADMIN_PASSWORD:password}});
    assert.equal(r.checks.find(c=>c.id==='runtime.credentials')?.status,status);
  }
});
test('RC14 a fabricated local backup receipt without verified files cannot earn readiness',async()=>{
  const [before]=await sql`SELECT value FROM settings WHERE key='backup.last'`;
  try{
    await sql`INSERT INTO settings(key,value,updated_by) VALUES ('backup.last',${sql.json({uploaded:false,objects:[{key:'local-only:not-created.dump',sha256:'a'.repeat(64),bytes:1},{key:'local-only:not-created.tar.gz',sha256:'b'.repeat(64),bytes:1}]} as never)},'local-test') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
    const r=await(await preflight()).readLaunchPreflight({env:{...process.env,SITE_URL:'http://localhost:4000',ADMIN_PASSWORD:'local-fake-credential-for-tests-only'}});
    assert.equal(r.counts.localBackupOk,false);
  }finally{if(before)await sql`UPDATE settings SET value=${sql.json(before.value)} WHERE key='backup.last'`;else await sql`DELETE FROM settings WHERE key='backup.last'`;}
});
test('RC28 twelve Products cannot replace an authorized launch identity with a new one',async()=>{const c=structuredClone(corpus),old=c.pack.products.at(-1)!.slug;c.pack.products.at(-1)!.slug='unexpected-product';c.dossiers.find((d:{productSlug:string})=>d.productSlug===old)!.productSlug='unexpected-product';assert.ok((await issues(c)).some((s:string)=>/authorized|identity|首発/i.test(s)));});
test('RC29 local restore booleans without matching backup hashes cannot earn a candidate restore gate',async()=>{const [before]=await sql`SELECT value FROM settings WHERE key='aifind.launch.rehearsal'`;try{await sql`INSERT INTO settings(key,value,updated_by) VALUES ('aifind.launch.rehearsal',${sql.json({restore:{passed:true,uploadsIncluded:true}})},'local-test') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;const r=await(await preflight()).readLaunchPreflight({env:{...process.env,SITE_URL:'http://localhost:4000',ADMIN_PASSWORD:'local-fake-credential-for-tests-only'}});assert.equal(r.counts.restoreOk,false);}finally{if(before)await sql`UPDATE settings SET value=${sql.json(before.value)} WHERE key='aifind.launch.rehearsal'`;else await sql`DELETE FROM settings WHERE key='aifind.launch.rehearsal'`;}});

test('RC31 same-Product countries Evidence cannot support its free price or plan',async()=>{
  for(const target of ['price','plan']){const c=structuredClone(corpus),plan=c.pack.products[0].plans.find((p:{planKey:string})=>p.planKey==='free');
    if(target==='price')plan.prices[0].evidenceKey='chatgpt-docs';else plan.evidenceKey='chatgpt-docs';
    assert.ok((await issues(c)).some((s:string)=>/reviewed|support|field/i.test(s)),target);
  }
});
test('RC32 reviewed source values reject inverted availability and unsupported capability or price',async()=>{
  for(const target of ['market','capability','price','language']){const c=structuredClone(corpus),p=c.pack.products[0];
    if(target==='market')p.markets[0].availabilityStatus='unavailable';
    if(target==='capability')p.capabilities[0].supportLevel=p.capabilities[0].supportLevel==='full'?'none':'full';
    if(target==='price')Object.assign(p.plans[0].prices[0],{priceType:'fixed',billingPeriod:'month',amountMinor:100,currencyCode:'USD'});
    if(target==='language')Object.assign(p.languages[0],{uiSupport:'full',evidenceKey:'chatgpt-identity',verifiedAt:p.draft.verifiedAt});
    assert.ok((await issues(c)).some((s:string)=>/reviewed|support|value/i.test(s)),target);
  }
});
