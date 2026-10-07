import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { importOfficialPrices } from '../backend/prices.ts';
import { invalidateLeaderboard, loadModel } from '../backend/read.ts';
after(closeDb);

test('dated seed prices expose their observation day instead of the import time',async()=>{
  await sql`INSERT INTO lb_models(id,slug,name) VALUES('dated-model','claude-sonnet-5-5','Claude Sonnet 5.5')`;
  await importOfficialPrices();
  await sql`INSERT INTO lb_runs(id,methodology_version,generated_at,status,summary) VALUES('dated-run','2026.10-observed-evidence-v17',now(),'published','{}')`;
  await sql`INSERT INTO lb_rankings(run_id,board,model_id,rank,score) VALUES('dated-run','overall','dated-model',1,70)`;
  invalidateLeaderboard();
  const model=await loadModel('claude-sonnet-5-5');
  assert.equal(model!.price!.asOf,'2026-09-30');
  assert.equal(model!.price!.origin,'seed');
  assert.equal(model!.model.contextVerifiedAt,null,'unknown context is not dated by the metadata import');
});
