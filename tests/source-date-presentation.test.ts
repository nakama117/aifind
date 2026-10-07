import { tag } from './setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDb, sql } from '@aihot/backend/db';
import { parseLooseDate } from '@aihot/backend/sources/web-list';
import { exportMarkdown } from '@aihot/backend/publication/detail';
import { latestAnswer } from '@aihot/backend/publication/agent';
import { v1Items } from '@aihot/backend/publication/v1';

after(closeDb);

test('the existing date-only parser approximates ISO dates at UTC midnight and Japanese dates at Tokyo midnight', () => {
  assert.equal(parseLooseDate('2026-10-05')?.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(parseLooseDate('2026年10月5日')?.toISOString(), '2026-10-04T15:00:00.000Z');
  assert.equal(parseLooseDate('2026-10-05T12:34:00+09:00')?.toISOString(), '2026-10-05T03:34:00.000Z');
});

test('date-only news cannot acquire precise publication hours in exported Markdown or Agent answers', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-05T04:00:00Z') });
  const T = tag(), id = `date-only-${T}`, at = parseLooseDate('2026年10月5日')!;
  const discovered = new Date('2026-10-05T03:34:00Z');
  await sql`INSERT INTO sources(id,name,kind,tier) VALUES(${T},'Date-only fixture','web_list','T1')`;
  await sql`INSERT INTO articles(id,source_id,identity_key,url,title,published_at,discovered_at,timeline_at)
    VALUES(${id},${T},${id},'https://example.test/date-only','日付だけの公式記事',${at},${discovered},${at})`;
  await sql`INSERT INTO publications(article_id,title,summary,source_id,channel,url,published_at,discovered_at,timeline_at,sort_at,eligible,selected,visible_after,visibility,tags)
    VALUES(${id},'日付だけの公式記事','出典に公開日が記載された記事です。',${T},'news','https://example.test/date-only',${at},${discovered},${at},${at},true,true,${discovered},'public',${[T]})`;
  const markdown = await exportMarkdown(id);
  assert.ok(markdown);
  assert.match(markdown.body, /- 公開日：2026-10-05/);
  assert.doesNotMatch(markdown.body, /公開日時|2026-10-04T15:00/);
  const q = { mode: 'selected', window: '24h', category: null, limit: 10 } as const;
  const result = await v1Items({ ...q, by: 'timeline', q: null, cursor: null });
  assert.ok(result.items.some(item => item.id === id));
  const answer = latestAnswer(result, q);
  assert.match(answer, /公開日：2026-10-05/);
  assert.doesNotMatch(answer, /公開日時：.*00:00/);
});
