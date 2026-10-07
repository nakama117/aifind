// A CLI round must not bypass the automatic-publication valve, even with complete evidence.
import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { sql, closeDb } from '@aihot/backend/db';
import { configurationOf } from '../backend/fetch/configuration.ts';
import { storeSnapshot } from '../backend/fetch/store.ts';
import { ANCHORS, SCORING_SOURCES } from '../backend/method/consensus.ts';

after(closeDb);
beforeEach(async()=>{
  await sql`TRUNCATE lb_models, lb_runs, lb_snapshots, lb_calibrations CASCADE`;
  for (const key of ['deepswe-v1-1','livebench-coding','livebench-reasoning','epoch-chess','mercor-apex-agents','vals-finance-agent','epoch-simpleqa','epoch-gpqa']) {
    const source=SCORING_SOURCES.find(s=>s.key===key)!;
    await storeSnapshot({
      sourceKey:key, sourceName:key, sourceUrl:'https://example.org/', attributionUrl:'https://example.org/', license:'test', publishedAt:null,
      metadata:key.startsWith('livebench')?{release:'2026-09-01'}:{},
      rows:ANCHORS.slice(0,10).map((slug,i)=>({sourceModelName:slug,baseName:slug,rawScore:100-i,metricKey:source.unit,metricName:key,configuration:configurationOf([])})),
    });
  }
});

for (const [setting,expected] of [[undefined,'shadow'],['false','shadow'],['true','published']] as const) {
  test(`CLI --round with LEADERBOARD_AUTO_PUBLISH=${setting??'unset'} saves ${expected}`,async()=>{
    const env:NodeJS.ProcessEnv={...process.env,COLLECT_ENABLED:'true',LEADERBOARD_REFRESH_ENABLED:'true',MODEL_CALLS_ENABLED:'false'};
    if(setting===undefined) delete env.LEADERBOARD_AUTO_PUBLISH;
    else env.LEADERBOARD_AUTO_PUBLISH=setting;
    const {stdout}=await promisify(execFile)(process.execPath,[
      '--import',new URL('./fixtures/refresh-sources-http.ts',import.meta.url).href,
      fileURLToPath(new URL('../scripts/refresh-sources.ts',import.meta.url)),
      '--sources','livebench-coding','--round',
    ],{env,timeout:60_000});
    const result=JSON.parse(stdout);
    assert.equal(result.sources['livebench-coding'].ok,true);
    assert.equal(result.round.status,expected);
    const [run]=await sql`SELECT status FROM lb_runs WHERE id=${result.round.runId}`;
    assert.equal(run!.status,expected);
    assert.equal((await sql`SELECT count(DISTINCT board)::int AS n FROM lb_rankings WHERE run_id=${result.round.runId}`)[0]!.n,5);
    assert.equal((await sql`SELECT count(*)::int AS n FROM lb_runs WHERE status='published'`)[0]!.n,expected==='published'?1:0);
  });
}
