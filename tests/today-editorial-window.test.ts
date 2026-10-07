import { tag } from './setup.ts';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { closeDb, sql } from '@aihot/backend/db';
import { dueDaily } from '@aihot/backend/reports/compose';
import { buildApp } from '../apps/api/src/app.ts';

const app = await buildApp();
const T = tag();
const source = `morning-${T}`;
const instants = [
  ['previous-day', '2026-10-04T14:59:59Z'],
  ['midnight', '2026-10-04T15:00:00Z'],
  ['four-am', '2026-10-04T19:00:00Z'],
  ['seven-thirty', '2026-10-04T22:30:00Z'],
  ['future', '2026-10-05T01:00:00Z'],
] as const;

before(async () => {
  await sql`INSERT INTO sources(id,name,kind,tier) VALUES(${source},'Morning fixture','rss','T1')`;
  for (const [label, iso] of instants) {
    const id = `${T}-${label}`, at = new Date(iso);
    await sql`INSERT INTO articles(id,source_id,identity_key,url,title,discovered_at,timeline_at)
      VALUES(${id},${source},${id},'https://example.test/morning',${label},${at},${at})`;
    await sql`INSERT INTO publications(article_id,title,source_id,channel,url,discovered_at,timeline_at,sort_at,eligible,selected,visible_after,visibility,tags)
      VALUES(${id},${label},${source},'news','https://example.test/morning',${at},${at},${at},true,true,${at},'public',${[T]})`;
  }
  // Only yesterday's 08:00 edition exists; today's morning news must not wait for a new report.
  await sql`INSERT INTO reports(kind,key,window_start,window_end,content,generated_at)
    VALUES('daily','2026-10-04','2026-10-02T23:00:00Z','2026-10-03T23:00:00Z',${sql.json({ date: '2026-10-04', sections: [] })},'2026-10-03T23:00:00Z')`;
});
after(async () => { await app.close(); await closeDb(); });

for (const [clock, due] of [
  ['2026-10-04T22:59:59Z', '2026-10-04'],
  ['2026-10-04T23:00:00Z', '2026-10-05'],
  ['2026-10-05T00:00:00Z', '2026-10-05'],
] as const) test(`home timeline and today's pool include JST 00:00–08:00 at ${clock}`, async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) });
  assert.equal(dueDaily(), due, 'the daily edition still changes at 08:00 JST');
  const response = await app.inject(`/api/site/timeline?tag=${T}`);
  assert.equal(response.statusCode, 200, response.body);
  const data = response.json();
  assert.deepEqual(data.cards.map((c: { item: { id: string } }) => c.item.id),
    ['seven-thirty', 'four-am', 'midnight', 'previous-day'].map(label => `${T}-${label}`));
  assert.deepEqual(data.dayCounts, { '2026-10-04': 1, '2026-10-05': 3 });
  const pool = await app.inject(`/api/site/pool?tag=${T}`);
  assert.equal(pool.statusCode, 200, pool.body);
  assert.equal(pool.json().todayCount, 3, 'today uses Tokyo midnight, not the editorial cutoff');
});
