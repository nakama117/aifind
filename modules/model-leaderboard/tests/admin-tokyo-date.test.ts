import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Fastify from 'fastify';
import { config } from '@aihot/backend/config';
import { closeDb, sql } from '@aihot/backend/db';
import { stopBoss } from '@aihot/backend/jobs/queue';
import { registerLeaderboard } from '../api/routes.ts';

const original = { dev: config.devAdmin, environment: config.environmentName };
const app = Fastify();
registerLeaderboard(app);
before(async () => {
  config.environmentName = 'development';
  config.devAdmin = { displayName: 'Tokyo date test' };
  await sql`INSERT INTO lb_models(id,slug,name) VALUES('tokyo-date','tokyo-date','Tokyo date fixture')`;
});
after(async () => {
  config.devAdmin = original.dev;
  config.environmentName = original.environment;
  await app.close();
  await stopBoss();
  await closeDb();
});

// The expected calendar dates are hand-written, independent of the Tokyo helper under test.
const boundaries = [
  ['JST 23:59:59 before midnight', '2026-10-04T14:59:59Z', '2026-10-04', '2026-10-05'],
  ['JST 00:00:00 after Tokyo rolls over', '2026-10-04T15:00:00Z', '2026-10-05', '2026-10-06'],
  ['JST 08:59:59 while UTC is still yesterday', '2026-10-04T23:59:59Z', '2026-10-05', '2026-10-06'],
  ['JST 09:00:00 when UTC rolls over', '2026-10-05T00:00:00Z', '2026-10-05', '2026-10-06'],
  ['JST 23:59:59 after UTC rolls over', '2026-10-05T14:59:59Z', '2026-10-05', '2026-10-06'],
  ['next JST midnight before UTC rolls over', '2026-10-05T15:00:00Z', '2026-10-06', '2026-10-07'],
] as const;

for (const [label, instant, today, tomorrow] of boundaries) {
  test(`manual price, context and FX accept Tokyo today and reject tomorrow: ${label}`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(instant) });
    const common = { sourceUrl: 'https://example.org/verified', reason: 'Tokyo boundary fixture' };
    const operations = [
      ['/models/tokyo-date/price', { ...common, currency: 'USD', input: 0, output: 4, cached: null, note: null }],
      ['/models/tokyo-date/context', { ...common, tokens: 128000 }],
      ['/fx', { ...common, rate: 7, sourceName: 'Local fixture' }],
    ] as const;
    for (const [path, payload] of operations) {
      const send = (asOf: string) => app.inject({ method: 'POST', url: `/api/admin/model-leaderboard${path}`,
        headers: { 'x-csrf-token': 'dev' }, payload: { ...payload, asOf } });
      const accepted = await send(today);
      assert.equal(accepted.statusCode, 200, `${path} ${today} at ${instant}: ${accepted.body}`);
      assert.equal((await send(tomorrow)).statusCode, 400, `${path} must reject ${tomorrow}`);
    }
    const metadata = (await app.inject('/api/admin/model-leaderboard/models?q=tokyo-date')).json();
    assert.equal(metadata.rows[0].price.asOf, today);
    assert.equal(metadata.rows[0].context.verifiedAt, `${today}T00:00:00.000Z`);
  });
}
