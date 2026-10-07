import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import { closeDb, sql } from "@aihot/backend/db";
import { registerLeaderboard } from "../api/routes.ts";
import { invalidateLeaderboard } from "../backend/read.ts";
import { storeSnapshot } from "../backend/fetch/store.ts";
import { configurationOf } from "../backend/fetch/configuration.ts";

after(closeDb);

test("an empty install has no invented rankings and still explains its sources and method", async () => {
  const app = Fastify();
  registerLeaderboard(app);
  try {
    const response = await app.inject("/api/site/leaderboard/boards/overall");
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "leaderboard_pending");
    assert.equal((await app.inject("/api/site/leaderboard/boards/invalid")).statusCode, 404);
    const catalogue = await app.inject("/api/v1/leaderboard/catalogue");
    assert.equal(catalogue.statusCode, 200);
    assert.ok(catalogue.json().groups.length > 0);
    assert.equal(catalogue.json().method.version, "2026.10-observed-evidence-v17");
    assert.equal(catalogue.json().run, null);
    assert.ok(catalogue.headers.etag);
    assert.equal((await app.inject({url: "/api/v1/leaderboard/catalogue", headers:{"if-none-match":String(catalogue.headers.etag)}})).statusCode, 304);
    assert.equal((await sql`SELECT count(*)::int AS n FROM lb_runs`)[0]!.n, 0);
    await storeSnapshot({sourceKey:"livebench-writing",sourceName:"LiveBench",sourceUrl:"https://example.org/test",license:"test",attributionUrl:"https://example.org/test",publishedAt:null,metadata:{},rows:[{sourceModelName:"http-fixture",baseName:"HTTP Fixture",metricKey:"livebench-writing",metricName:"Language + IF",rawScore:0,configuration:configurationOf([])}]});
    const source=await app.inject("/api/site/leaderboard/sources/livebench-writing");
    assert.equal(source.statusCode,200,"real source measurements remain readable before enough evidence exists for a ranking");
    assert.equal(source.json().run,null);
    assert.equal(source.json().rows[0].display,"0.0%");
    assert.equal(source.json().rows[0].modelSlug,null,"raw results do not invent a ranked model page");
    assert.equal(source.json().collection.supported,true);
    await sql`INSERT INTO settings(key,value) VALUES('leaderboard.fetch','{"sources":{"livebench-writing":{"ok":false,"at":"2026-10-04T00:00:00Z","lastOkAt":"2026-10-03T00:00:00Z","error":"HTTP 403: private diagnostic must not escape"}}}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
    const failed=await app.inject('/api/v1/leaderboard/sources/livebench-writing');
    assert.equal(failed.json().collected,true,'a failed check preserves its prior real evidence');
    assert.equal(failed.json().collection.state,'failed');
    assert.equal(failed.json().collection.lastSucceededAt,'2026-10-03T00:00:00Z');
    assert.ok(!JSON.stringify(failed.json()).includes('private diagnostic'));
  } finally { await app.close(); }
});

test("first-party and public exits read the same published run and never expose failed runs", async () => {
  await sql`INSERT INTO lb_models (id,slug,name) VALUES ('http-m','http-model','HTTP Model')`;
  const summary = {consensus:{input:[{board:'overall',registry:{},signals:[]}],boards:[],evidence:{}}};
  await sql`INSERT INTO lb_runs (id,methodology_version,generated_at,summary,status)
    VALUES ('http-run','2026.10-observed-evidence-v17','2026-10-04T00:00:00Z',${sql.json(summary)},'published'),
    ('http-failed','2026.10-observed-evidence-v17','2026-10-05T00:00:00Z',${sql.json(summary)},'failed')`;
  await sql`INSERT INTO lb_rankings (run_id,board,model_id,rank,score,coverage,detail)
    VALUES ('http-run','overall','http-m',1,72.5,0.5,'{"scoreVersion":"2026.10-pairwise-fit-v1"}')`;
  invalidateLeaderboard();
  const app = Fastify();
  registerLeaderboard(app);
  try {
    const site = await app.inject('/api/site/leaderboard/boards/overall');
    const publicResult = await app.inject('/api/v1/leaderboard/boards/overall');
    assert.equal(site.statusCode,200);
    assert.deepEqual(site.json(),publicResult.json());
    assert.equal(site.json().run.id,'http-run');
    assert.equal(site.json().entries[0].score,72.5);
    assert.equal(site.json().run.generatedAt,'2026-10-04T00:00:00.000Z');
    const detail=await app.inject('/api/site/leaderboard/models/http-model');
    assert.equal(detail.json().overall.score,72.5);
    assert.equal((await app.inject('/api/site/leaderboard/models/missing')).statusCode,404);
  } finally { await app.close(); }
});
