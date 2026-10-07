import "./setup.ts";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";
import postgres from "postgres";
import { createTestDatabase, dropTestDatabase } from "./database-cleanup.ts";

const template = new URL(process.env.DATABASE_URL!);
const base = decodeURIComponent(template.pathname.slice(1)).match(/^(.*)_f[0-9a-f]+_(test|ci)$/)!;
assert.ok(base, "run with the full suite's database preload");
const adminUrl = new URL(template); adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.href, { max: 1, onnotice: () => {} });
const name = () => `${base[1]}_f${randomBytes(4).toString("hex")}_${base[2]}`;
after(() => admin.end());

test("DC01 test database cleanup refuses remote, production, template and unsafe targets before connecting", async () => {
  const remote = new URL(template); remote.hostname = "production.invalid";
  const production = new URL(template); production.pathname = "/production";
  for (const url of [remote, production]) {
    await assert.rejects(dropTestDatabase(url.href, name()), /local.*test.*database/i);
    await assert.rejects(createTestDatabase(url.href, name()), /local.*test.*database/i);
  }
  for (const target of ["production", "bad_test\";DROP DATABASE other;--", decodeURIComponent(template.pathname.slice(1))]) {
    await assert.rejects(dropTestDatabase(template.href, target), /test database target/i);
  }
  await assert.rejects(createTestDatabase(template.href, name(), "production"), /test database target/i);
});

test("DC02 fixture cleanup waits behind the cluster cleanup lock and then removes its database", async () => {
  const target = name(); await createTestDatabase(template.href, target);
  await admin`SELECT pg_advisory_lock(69427, 17005)`;
  let finished = false;
  const cleanup = dropTestDatabase(template.href, target).then(() => { finished = true; return null; }, error => { finished = true; return error; });
  try {
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && !finished && Date.now() < deadline) {
      waiting = (await admin`SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
        AND datname='postgres' AND wait_event_type='Lock' AND wait_event='advisory'
        AND query LIKE 'SELECT pg_advisory_lock%'`).length > 0;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(waiting && !finished, "cleanup must wait behind the test cluster lock, before DROP DATABASE");
    assert.equal((await admin`SELECT 1 FROM pg_database WHERE datname=${target}`).length, 1);
  } finally { await admin`SELECT pg_advisory_unlock(69427, 17005)`; }
  assert.equal(await cleanup, null);
  assert.equal((await admin`SELECT 1 FROM pg_database WHERE datname=${target}`).length, 0);
});

test("DC03 concurrent fixture cleanups both complete without checkpoint/process-barrier deadlock", async () => {
  const targets = [name(), name()];
  for (const target of targets) await createTestDatabase(template.href, target);
  await Promise.all(targets.map(target => dropTestDatabase(template.href, target)));
  assert.equal((await admin`SELECT datname FROM pg_database WHERE datname IN ${admin(targets)}`).length, 0);
});

test("DC04 template creation waits behind the same cluster lifecycle lock as cleanup", async () => {
  const target = name();
  await admin`SELECT pg_advisory_lock(69427, 17005)`;
  let finished = false;
  const created = createTestDatabase(template.href, target, decodeURIComponent(template.pathname.slice(1)))
    .then(() => { finished = true; return null; }, error => { finished = true; return error; });
  try {
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && !finished && Date.now() < deadline) {
      waiting = (await admin`SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
        AND datname='postgres' AND wait_event_type='Lock' AND wait_event='advisory'
        AND query LIKE 'SELECT pg_advisory_lock%'`).length > 0;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(waiting && !finished, "template creation must share the cleanup lifecycle lock");
    assert.equal((await admin`SELECT 1 FROM pg_database WHERE datname=${target}`).length, 0);
  } finally { await admin`SELECT pg_advisory_unlock(69427, 17005)`; }
  assert.equal(await created, null);
  assert.equal((await admin`SELECT 1 FROM pg_database WHERE datname=${target}`).length, 1);
  await dropTestDatabase(template.href, target);
});
