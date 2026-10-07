// Exercise built SSR with a loopback API: branding, secondary navigation and source-date precision.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import type { SiteItemDetail } from '@aihot/contracts/site';

const sourceDate = '2026-10-04T15:00:00.000Z'; // The existing parser's approximation for "2026年10月5日".
const discovered = '2026-10-05T03:34:00.000Z';
const item = (id: string): SiteItemDetail => ({
  id, title: '日付のみを持つ公式記事', originalTitle: null, summary: '出典が示す公開日を確認できる記事です。', reason: null,
  source: { name: 'Date-only source' }, links: { original: 'https://example.org/date-only' },
  publishedAt: id === 'no-source-date' ? null : sourceDate, discoveredAt: discovered,
  timelineAt: id === 'live' || id === 'no-source-date' ? discovered : sourceDate,
  category: 'ai-products', tags: [], score: null, selected: true, channel: 'news', story: null, x: null,
  readingMode: 'summary-only', author: null, body: null, outline: [], relatedStories: [], topics: [],
  indexable: true, markdownAvailable: false, group: null, hasTranslation: false, bodyLanguage: 'original',
});

const api = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const pathname = new URL(req.url!, 'http://stub').pathname;
  if (pathname === '/api/site/meta') return res.end(JSON.stringify({ changelogVersion: null }));
  if (pathname === '/api/site/aifind/products') return res.end(JSON.stringify({ products: [], limit: 6, offset: 0, hasMore: false }));
  if (pathname === '/api/site/aifind/home') return res.end(JSON.stringify({ products: [], comparisons: [], categories: [], limit: 6, offset: 0, hasMore: false }));
  if (pathname === '/api/site/timeline') return res.end(JSON.stringify({
    filters: { channel: 'all', category: null, tag: null }, nextCursor: null, dayCounts: { '2026-10-05': 2 }, hot: null,
    cards: ['backfill', 'live'].map(id => ({ key: `a${id}`, anchorAt: item(id).timelineAt, item: item(id), group: null })),
  }));
  if (pathname.startsWith('/api/site/items/')) return res.end(JSON.stringify(item(pathname.split('/').pop()!)));
  res.statusCode = 404;
  res.end(JSON.stringify({ code: 'not_found' }));
});
let web: ChildProcess | undefined;
let origin: string;
let logs = '';
before(async () => {
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  web = spawn(process.execPath, [fileURLToPath(new URL('../server.ts', import.meta.url))], {
    env: { ...process.env, WEB_PORT: '0', WEB_HOST: '127.0.0.1', SITE_URL: 'https://brand.example.jp', SITE_PREVIEW: 'false',
      API_BASE_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
      COLLECT_ENABLED: 'false', MODEL_CALLS_ENABLED: 'false', FEISHU_CONTENT_PUSH_ENABLED: 'false', FEISHU_INTERNAL_ENABLED: 'false', INDEXNOW_SUBMIT_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  origin = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SSR start timeout: ${logs}`)), 15000);
    web!.once('exit', () => { clearTimeout(timer); reject(new Error(`SSR exited: ${logs}`)); });
    web!.stderr!.on('data', chunk => { logs += String(chunk); });
    web!.stdout!.on('data', chunk => {
      logs += String(chunk);
      const port = logs.match(/"msg":"web started","port":(\d+)/)?.[1];
      if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }
    });
  });
});
after(async () => {
  if (web && web.exitCode === null) { web.kill('SIGTERM'); await once(web, 'exit'); }
  await new Promise<void>(resolve => api.close(() => resolve()));
});

async function page(path: string) {
  const response = await fetch(origin + path);
  const html = await response.text();
  assert.equal(response.status, 200, `${path}: ${logs}`);
  return load(html);
}

test('navbar, title, description, OG and JSON-LD use AIFIND and the supplied SITE_URL', async () => {
  const $ = await page('/');
  assert.match($('title').text(), /AIFIND.*アイファインド/);
  assert.match($('meta[name="description"]').attr('content')!, /AIを知る、比べる、使いこなす。/);
  assert.equal($('meta[property="og:site_name"]').attr('content'), 'AIFIND');
  assert.match($('meta[property="og:title"]').attr('content')!, /いま使えるAIが、見つかる。/);
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://brand.example.jp/');
  assert.ok($('[role="img"][aria-label="AIFIND"]').length > 0);
  assert.doesNotMatch($('body').clone().find('script').remove().end().text(), /AI Signal JP|AIHOT/);
  const data = $('script[type="application/ld+json"]').toArray().flatMap(el => JSON.parse($(el).text()));
  assert.equal(data.find(value => value['@type'] === 'Organization')?.name, 'AIFIND編集部');
  for (const type of ['WebSite', 'Dataset']) {
    assert.match(data.find(value => value['@type'] === type)?.name ?? '', /^AIFIND(?:$| — )/);
  }
});

test('existing modules remain reachable in data/more entries and leave the phone primary tabs', async () => {
  const $ = await page('/');
  const phone = $('nav[aria-label="下部ナビゲーション"]');
  assert.equal(phone.find('a[href="/leaderboard"]').length, 0);
  assert.equal(phone.find('a[href="/codex-reset"]').length, 0);
  const sidebar = $('nav[aria-label="メインナビゲーション"]');
  const sections = sidebar.children('div');
  const data = sections.filter((_, el) => $(el).children('div').first().text() === 'データ');
  assert.equal(data.find('a[href="/leaderboard"]').length, 1);
  assert.equal(data.find('a[href="/codex-reset"]').length, 1);
  assert.equal(sections.first().find('a[href="/leaderboard"], a[href="/codex-reset"]').length, 0);
  const more = await page('/more');
  for (const path of ['/leaderboard', '/codex-reset', '/topics']) assert.ok(more(`a[href="${path}"]`).length > 0, path);
});

test('a news source date is rendered as a day in article facts and JSON-LD, without invented clock precision', async () => {
  const $ = await page('/items/backfill');
  const times = $('time').toArray();
  assert.ok(times.length > 0);
  for (const element of times) {
    assert.equal($(element).attr('datetime'), '2026-10-05');
    assert.equal($(element).text(), '2026-10-05');
  }
  assert.match($('body').clone().find('script').remove().end().text(), /公開日/);
  const data = $('script[type="application/ld+json"]').toArray().flatMap(el => JSON.parse($(el).text()));
  assert.equal(data.find(value => value['@type'] === 'NewsArticle')?.datePublished, '2026-10-05');
});

test('backfill cards omit approximate hours while actual site collection times remain precise', async () => {
  const $ = await page('/');
  for (const el of $('[data-card-key="abackfill"] time').toArray()) {
    assert.equal($(el).attr('datetime'), '2026-10-05');
    assert.doesNotMatch($(el).text(), /\d{2}:\d{2}/);
  }
  assert.match($('[data-card-key="alive"] time').first().text(), /12:34/);
  const noDate = await page('/items/no-source-date');
  assert.match(noDate('body').clone().find('script').remove().end().text(), /掲載日時/);
  assert.equal(noDate('time').first().attr('datetime'), discovered);
  assert.match(noDate('time').first().text(), /12:34/);
});
