import { gate, tag } from '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql, closeDb } from '@aihot/backend/db';
import { FETCHERS } from '../backend/fetch/index.ts';
import { fetchSources } from '../backend/fetch/refresh.ts';
import { storeSnapshot } from '../backend/fetch/store.ts';
import type { FetchResult, Fetcher } from '../backend/fetch/types.ts';

after(closeDb);

test('a bounded refresh only fetches the named family and stores the explicitly selected source', async()=>{
  const t=`bounded-${tag()}`;
  const selected=`${t}-a`,omitted=`${t}-b`;
  const result=(sourceKey:string):FetchResult=>({sourceKey,sourceName:sourceKey,sourceUrl:'https://example.org/',license:'test',attributionUrl:'https://example.org/',publishedAt:null,metadata:{},rows:[{sourceModelName:t,baseName:t,metricKey:'score',metricName:'Score',rawScore:42,configuration:{key:'default',label:'Default',kind:'FIRST_PARTY',priority:1,rank:1,ineligible:null}}]});
  let unused=0;
  const original=FETCHERS.splice(0,FETCHERS.length,
    {sourceKeys:[selected,omitted],fetch:async()=>[result(selected),result(omitted)]},
    {sourceKeys:[`${t}-unused`],fetch:async()=>{unused++;return [];}});
  try {
    const states=await fetchSources({sourceKeys:[selected],retryDelayMs:1});
    assert.equal(states[selected]!.ok,true);
    assert.equal(states[omitted],undefined);
    assert.equal(unused,0);
    const saved=await sql<{source_key:string}[]>`SELECT source_key FROM lb_snapshots WHERE source_key IN (${selected},${omitted})`;
    assert.deepEqual(saved.map(s=>s.source_key),[selected]);
  } finally {FETCHERS.splice(0,FETCHERS.length,...original);}
});

test('two source fetches overlap, a failing source is retried once, and its last snapshot is preserved', { timeout: 5000 }, async () => {
  const t = `parallel-${tag()}`;
  const keys = Array.from({ length: 4 }, (_, i) => `${t}-${i}`);
  const result = (i: number): FetchResult => ({ sourceKey: keys[i]!, sourceName: keys[i]!, sourceUrl: 'https://example.org/',
    license: 'test', attributionUrl: 'https://example.org/', publishedAt: null, metadata: {}, rows: [{
      sourceModelName: t, baseName: t, organization: keys[i], metricKey: 'score', metricName: 'Score', rawScore: 42,
      configuration: { key: 'default', label: 'Default', kind: 'FIRST_PARTY', priority: 1, rank: 1, ineligible: null },
    }] });
  const old = await storeSnapshot(result(2));
  const order: number[] = [];
  const calls = [0, 0, 0, 0];
  const started = gate();
  let active = 0, peak = 0;
  const fake: Fetcher[] = keys.map((key, i) => ({ sourceKeys: [key], async fetch() {
    calls[i]!++;
    active++;
    peak = Math.max(peak, active);
    try {
      if (i === 0) await started.promise;
      if (i === 1) started.open();
      if (i === 2) throw new Error('upstream unavailable');
      order.push(i);
      return i === 3 ? [] : [result(i)];
    } finally { active--; }
  } }));
  const saved = FETCHERS.splice(0, FETCHERS.length, ...fake);
  try {
    const states = await fetchSources({ retryDelayMs: 0 });
    assert.deepEqual(calls, [1, 1, 2, 1], 'only the failing source is fetched again');
    assert.equal(peak, 2);
    assert.deepEqual(order.slice(0, 2), [1, 0], 'the later fetch can finish before the first');
    assert.deepEqual(keys.map((k) => states[k]!.ok), [true, true, false, false]);
    const rows = await sql<{ source_key: string }[]>`SELECT source_key FROM lb_snapshots WHERE source_key = ANY(${keys.slice(0, 2)}) ORDER BY fetched_at`;
    assert.deepEqual(rows.map((r) => r.source_key), keys.slice(0, 2), 'snapshot and identity writes stay in registry order');
    const [retained] = await sql<{ id: string }[]>`SELECT id FROM lb_snapshots WHERE source_key = ${keys[2]!} ORDER BY fetched_at DESC LIMIT 1`;
    assert.equal(retained!.id, old.snapshotId, 'the failed source retains its last successful evidence');
  } finally { FETCHERS.splice(0, FETCHERS.length, ...saved); }
});
