import './setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { config } from '@aihot/backend/config';
import { closeDb } from '@aihot/backend/db';
import { buildApp } from '../apps/api/src/app.ts';

const originalUrl = config.siteUrl;
config.siteUrl = 'https://brand-cutover.example.jp';
const app = await buildApp();
after(async () => { config.siteUrl = originalUrl; await app.close(); await closeDb(); });

test('manifest, OpenAPI, llms, RSS and Agent discovery publish the owner-confirmed brand', async () => {
  const manifest = await app.inject('/manifest.webmanifest');
  assert.equal(manifest.statusCode, 200);
  assert.equal(manifest.json().short_name, 'AIFIND');
  assert.equal(manifest.json().name, 'AIFIND — いま使えるAIが、見つかる。');
  assert.match(manifest.json().description, /アイファインド/);
  const openapi = await app.inject('/openapi-v1.json');
  assert.equal(openapi.statusCode, 200);
  assert.match(openapi.json().info.title, /AIFIND/);
  assert.equal(openapi.json().servers[0].url, config.siteUrl);
  for (const path of ['/llms.txt', '/feed.xml', '/api/v1/agent']) {
    const response = await app.inject(path);
    assert.equal(response.statusCode, 200, path);
    assert.match(response.body, /AIFIND/, path);
    assert.doesNotMatch(response.body, /AI Signal JP|aifind\.jp/, path);
    assert.ok(response.body.includes(config.siteUrl), `${path} follows SITE_URL`);
  }
  assert.match((await app.inject('/llms.txt')).body, /AIを知る、比べる、使いこなす。/);
});

test('MCP discovery has the AIFIND display title while existing client tool identifiers stay stable', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/mcp',
    headers: { host: 'localhost', accept: 'application/json, text/event-stream' },
    payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'brand-test', version: '1' } } } });
  assert.equal(response.statusCode, 200, response.body);
  const payload = response.body.startsWith('{') ? response.json() : JSON.parse(response.body.match(/^data: (.+)$/m)![1]!);
  assert.equal(payload.result.serverInfo.title, 'AIFIND');
  assert.equal(payload.result.serverInfo.name, 'aisignaljp');
  assert.match(payload.result.instructions, /AIFIND/);
  assert.doesNotMatch(payload.result.instructions, /AI Signal JP/);
});
