import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stamp } from '../web/format.ts';

test('date-only leaderboard evidence cannot appear as a precise JST 09:00 publication', () => {
  assert.equal(stamp('2026-10-02T00:00:00.000Z', 'day'), '2026/10/02 JST');
  assert.equal(stamp('2026-10-04T15:00:00.000Z', 'day'), '2026/10/05 JST');
  assert.equal(stamp(null, 'day'), '未確認');
  assert.equal(stamp('invalid', 'day'), '未確認');
});

test('actual computation and collection instants retain their Tokyo clock times', () => {
  assert.equal(stamp('2026-10-04T11:04:00.000Z'), '2026/10/04 20:04 JST');
  assert.equal(stamp('2026-10-04T15:00:00.000Z'), '2026/10/05 00:00 JST');
});
