// Read-only local acceptance. Uses no environment file, credential, model call, or DB write.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { SITE } from '@aihot/site';

const api = 'http://127.0.0.1:3101';
const web = 'http://127.0.0.1:3100';
const evidence = JSON.parse(await readFile(new URL('./2026-10-04-live-run.json', import.meta.url), 'utf8'));
const expectedRun = evidence.round.runId;
const result = { at: new Date().toISOString(), expectedRun, boards: [], sources: [], pages: [], links: [] };

async function json(path) {
  const response = await fetch(api + path, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, path);
  return { response, body: await response.json() };
}

const models = new Set();
for (const key of ['overall', 'coding', 'reasoning', 'knowledge', 'professional']) {
  const path = `/api/v1/leaderboard/boards/${key}`;
  const { response, body } = await json(path);
  const site = await json(`/api/site/leaderboard/boards/${key}`);
  assert.deepEqual(body, site.body);
  assert.equal(body.run.id, expectedRun);
  assert.ok(body.entries.length > 0);
  const cached = await fetch(api + path, { headers: { 'If-None-Match': response.headers.get('etag') } });
  assert.equal(cached.status, 304);
  const top = body.entries[0];
  models.add(top.model.slug);
  const detail = await json(`/api/v1/leaderboard/models/${top.model.slug}`);
  assert.equal(detail.body.run.id, expectedRun);
  const detailScore = key === 'overall' ? detail.body.overall.score : detail.body.categories.find(c => c.key === key)?.score;
  assert.equal(detailScore, top.score);
  result.boards.push({ key, status: response.status, run: body.run, displayed: body.entries.length, sources: body.board.sourceCount, operators: body.board.operatorCount, top: top.model.name, siteEqualsPublic: true, etagStatus: cached.status, modelScoreMatches: true });
}

const external = new Set();
for (const snapshot of evidence.sources) {
  const { response, body } = await json(`/api/v1/leaderboard/sources/${snapshot.source_key}`);
  assert.equal(body.run.id, expectedRun);
  assert.equal(body.collected, true);
  assert.equal(body.upstreamAt, snapshot.published_at);
  assert.equal(body.syncedAt, snapshot.fetched_at);
  assert.ok(body.rows.length > 0);
  const url = new URL(body.source.officialUrl);
  assert.equal(url.protocol, 'https:');
  url.hash = '';
  external.add(url.href);
  result.sources.push({ key: snapshot.source_key, status: response.status, rows: body.rows.length, upstreamAt: body.upstreamAt, syncedAt: body.syncedAt, officialUrl: body.source.officialUrl, licenseRecord: body.source.license });
}

const pages = ['/leaderboard', ...['coding','reasoning','knowledge','professional'].map(k => `/leaderboard/boards/${k}`), '/leaderboard/sources', '/leaderboard/rules', ...[...models].map(s => `/leaderboard/${s}`), ...evidence.sources.map(s => `/leaderboard/sources/${s.source_key}`)];
const internal = new Set();
for (const path of pages) {
  const response = await fetch(web + path, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(html, /<html[^>]*lang="ja-JP"/);
  assert.ok(text.includes(SITE.name));
  assert.ok(text.includes('出典'));
  if (path !== '/leaderboard/sources') assert.ok(text.includes('JST'), path);
  if (path === '/leaderboard') assert.ok(text.includes('2026/10/04 20:04 JST'));
  if (path === '/leaderboard/sources/arena-creative-writing') {
    assert.ok(text.includes('出典公開 2026/10/02 JST'));
    assert.ok(text.includes('取得確認 2026/10/04 20:02 JST'));
  }
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
    const link = match[1].replaceAll('&amp;', '&');
    if (link.startsWith('/leaderboard') || link.startsWith('/api/site/leaderboard/assets/')) internal.add(link);
  }
  result.pages.push({ path, status: response.status, title: html.match(/<title>(.*?)<\/title>/)?.[1], language: 'ja-JP', jst: text.includes('JST') });
}

for (const path of internal) {
  const response = await fetch(web + path, { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, path);
  await response.body?.cancel();
}
result.internalLinks = { checked: internal.size, failures: 0 };

// Only official public URLs from the catalogue; inherited proxy settings are never printed.
const dispatcher = new EnvHttpProxyAgent();
setGlobalDispatcher(dispatcher);
try {
  for (const url of external) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      result.links.push({ url, status: response.status, resolvedUrl: response.url });
      await response.body?.cancel();
    } catch (error) {
      result.links.push({ url, error: error.name });
    }
  }
} finally { await dispatcher.close(); }

await writeFile(new URL('./2026-10-04-api.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
