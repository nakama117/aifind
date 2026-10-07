import '../../../tests/setup.ts';
import {createTestDatabase,dropTestDatabase} from '../../../tests/database-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
test('Phase 3 0074 upgrade appends Detector schema while preserving old Product/Published/Draft/Evidence/Candidate values',async()=>{
  const url=new URL(process.env.DATABASE_URL!);assert.match(url.pathname,/_(test|ci)$/);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  const name='aifind_phase4_upgrade_'+randomUUID().replaceAll('-','')+'_test';url.pathname='/postgres';const admin=postgres(url.href,{max:1,onnotice:()=>{}});let db:postgres.Sql|undefined;
  try {await createTestDatabase(process.env.DATABASE_URL!,name);url.pathname='/'+name;db=postgres(url.href,{max:1,onnotice:()=>{}});
    const files=(dir:URL)=>existsSync(dir)?readdirSync(dir).filter(n=>n.endsWith('.sql')).map(name=>({name,file:new URL(name,dir)})):[];
    const modules=new URL('../../../modules/',import.meta.url),migrations=[...files(new URL('../../../database/migrations/',import.meta.url)),...readdirSync(modules).flatMap(m=>files(new URL(m+'/migrations/',modules)))].sort((a,b)=>a.name.localeCompare(b.name));
    for(const m of migrations.filter(m=>m.name<'0075'))await db.begin(tx=>tx.unsafe(readFileSync(m.file,'utf8')));
    await db`INSERT INTO af_products(id,slug,canonical_name) VALUES('old-product','phase4-old-product','[TEST] Existing product')`;
    await db`INSERT INTO af_product_versions(id,product_id,version_no,display_name) VALUES('old-published','old-product',1,'[TEST] Old Published')`;
    await db`UPDATE af_product_versions SET status='published',published_at=now() WHERE id='old-published'`;
    await db`INSERT INTO af_product_versions(id,product_id,version_no,display_name,base_version_id) VALUES('old-draft','old-product',2,'[TEST] Existing Draft','old-published')`;
    await db`INSERT INTO af_evidence(id,url,source_kind,retrieved_at) VALUES('old-evidence','https://synthetic.example/old','official_product',now())`;
    await db`INSERT INTO af_product_change_candidates(id,product_id,base_version_id,candidate_type,target_key,proposed_value,evidence_id) VALUES('old-candidate','old-product','old-published','language','ja','{"languageCode":"ja","inputSupport":"full","outputSupport":"partial","uiSupport":"unknown"}','old-evidence')`;
    const tables=['af_products','af_product_versions','af_evidence','af_product_change_candidates'];const before:Record<string,any[]>={};for(const table of tables)before[table]=await db.unsafe(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`);
    await db.begin(tx=>tx.unsafe(readFileSync(new URL('../migrations/0075_aifind_observations.sql',import.meta.url),'utf8')));
    for(const table of tables){const after:Array<{row:Record<string,unknown>}>=await db.unsafe(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`);assert.equal(after.length,before[table].length);before[table].forEach((r,i)=>{for(const [key,value] of Object.entries(r.row))assert.deepEqual(after[i].row[key],value,table+'.'+key);});}
    assert.equal((await db`SELECT id FROM af_source_monitors`).length,0);assert.equal((await db`SELECT id FROM af_source_observations`).length,0);
    assert.equal((await db`SELECT status FROM af_product_change_candidates WHERE id='old-candidate'`)[0].status,'pending_review');
    await assert.rejects(()=>db!`INSERT INTO af_source_monitors(id,product_id,url,source_kind,publisher) VALUES('orphan','missing','https://synthetic.example/x','other','test')`,{code:'23503'});
  } finally {await db?.end();await dropTestDatabase(process.env.DATABASE_URL!,name);await admin.end();}
});
