import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import { matchRoutes, type RouteObject } from 'react-router';
test('the admin navigation URL resolves inside the sign-in layout rather than a root sibling',async()=>{
  const {default:routes}=await import('../../../apps/web/app/routes.ts');
  const matches=matchRoutes(routes as RouteObject[],'/admin/model-leaderboard');
  assert.ok(matches?.some(m=>m.route.id==='model-leaderboard-admin'));
  assert.ok(matches?.some(m=>m.route.id==='admin-layout'));
  assert.equal(matchRoutes(routes as RouteObject[],'/model-leaderboard'),null);
});
test('the restored leaderboard declares its own pages and backend entry point', async()=>{
assert.ok(existsSync(new URL('../module.ts',import.meta.url)), 'the restored module declaration is required');
const {default: declaration} = await import('../module.ts');
assert.equal(declaration.name,'model-leaderboard');
assert.ok(declaration.apiPaths?.some(r=>r.test('/api/v1/leaderboard/boards/overall')));
assert.ok(existsSync(new URL('../server.ts',import.meta.url)));
});

test('scheduled refresh requires both explicit valves and stays inert while disabled', async()=>{
  const {default: server, refreshEnabled}=await import('../server.ts');
  const previous=[process.env.COLLECT_ENABLED,process.env.LEADERBOARD_REFRESH_ENABLED];
  try {
    for(const [collect,refresh] of [['false','true'],['true','false'],['1','true'],['true','1']]) {
      process.env.COLLECT_ENABLED=collect;
      process.env.LEADERBOARD_REFRESH_ENABLED=refresh;
      assert.equal(refreshEnabled(),false);
      assert.deepEqual(await server.schedules![0]!.run(),{skipped:'disabled'});
    }
    process.env.COLLECT_ENABLED='true';process.env.LEADERBOARD_REFRESH_ENABLED='true';
    assert.equal(refreshEnabled(),true);
    assert.equal(server.schedules![0]!.cron,'20 0,6,12,18 * * *');
  } finally {
    for(const [i,key] of ['COLLECT_ENABLED','LEADERBOARD_REFRESH_ENABLED'].entries()) {
      if(previous[i]===undefined) delete process.env[key]; else process.env[key]=previous[i];
    }
  }
});
