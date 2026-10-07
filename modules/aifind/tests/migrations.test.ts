import "../../../tests/setup.ts";
import { createTestDatabase, dropTestDatabase } from "../../../tests/database-cleanup.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { closeDb, sql } from "@aihot/backend/db";
import { tag, gate } from "../../../tests/setup.ts";
import { createProductDraft } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { makeDraft, proof, markPublished } from "./fixtures.ts";

after(closeDb);

test("empty isolated database migrates all core/modules, then rerun applies nothing", async () => {
  const template = new URL(process.env.DATABASE_URL!);
  assert.match(template.pathname, /_(test|ci)$/);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(template.hostname));
  const name = `af_migration_${tag()}_test`;
  const adminUrl = new URL(template); adminUrl.pathname = "/postgres";
  const target = new URL(template); target.pathname = `/${name}`;
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  let db: postgres.Sql | undefined;
  try {
    await createTestDatabase(template.href, name);
    db = postgres(target.toString(), { max: 1 });
    assert.equal((await db`SELECT 1 FROM information_schema.tables WHERE table_schema='public'`).length, 0);
    const migrate = () => execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/migrate.ts", import.meta.url))], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: target.toString(), COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false",
        FEISHU_CONTENT_PUSH_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false", INDEXNOW_SUBMIT_ENABLED: "false" },
    });
    const first = migrate();
    assert.match(first, /migration\(s\) applied/);
    const files = (dir: URL) => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".sql")) : [];
    const moduleRoot = new URL("../../../modules/", import.meta.url);
    const expected = [...files(new URL("../../../database/migrations/", import.meta.url)),
      ...readdirSync(moduleRoot).flatMap(m => files(new URL(`${m}/migrations/`, moduleRoot)))].sort();
    const rows = await db<{ name: string }[]>`SELECT name FROM schema_migrations ORDER BY name`;
    assert.deepEqual(rows.map(r => r.name), expected);
    assert.equal(rows.filter(r => /^006[2-9]_aifind/.test(r.name)).length, 8);
    assert.equal(rows.filter(r => r.name.includes("aifind")).length, 23);
    assert.equal((await db`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND left(table_name,3)='af_'`).length, 33);
    assert.equal((await db`SELECT count(*)::int AS n FROM af_catalog_imports`)[0].n,0);
    assert.match(migrate(), /database is up to date/);
    assert.equal((await db`SELECT name FROM schema_migrations`).length, expected.length);
  } finally {
    await db?.end();
    await dropTestDatabase(template.href, name);
    await admin.end();
  }
});

test("foreign keys reject orphan product, version, alias, plan, price and evidence references", async () => {
  const f = await makeDraft();
  await assert.rejects(sql`INSERT INTO af_products(id,slug,canonical_name,vendor_id) VALUES ('orphan-product','orphan-product','orphan','missing')`, { code: "23503" });
  await assert.rejects(createProductDraft("missing", { displayName: "orphan" }), /not found/);
  await assert.rejects(sql`INSERT INTO af_product_versions(id,product_id,version_no,display_name) VALUES ('orphan-version','missing',1,'orphan')`, { code: "23503" });
  await assert.rejects(sql`INSERT INTO af_product_aliases(id,product_id,alias,normalized_alias,alias_type) VALUES ('orphan-alias','missing','orphan','orphan','common')`, { code: "23503" });
  await assert.rejects(sql`INSERT INTO af_product_plans(id,product_version_id,plan_key,name) VALUES ('orphan-plan','missing','orphan','orphan')`, { code: "23503" });
  await assert.rejects(sql`INSERT INTO af_product_prices(id,plan_id,billing_period,price_type) VALUES ('orphan-price','missing','none','unknown')`, { code: "23503" });
  await assert.rejects(setProductMarket(f.product.id, f.draft.version.id, { marketCode: "JP", availabilityStatus: "available", evidenceId: "missing" }), { code: "23503" });
});

test("parent deletion is RESTRICT and cannot erase version, plan, price or evidence history", async () => {
  const f = await makeDraft();
  const verified = await proof();
  const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey: "test", name: "合成", ...verified });
  await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType: "free", billingPeriod: "none", amountMinor: 0, ...verified });
  await assert.rejects(sql`DELETE FROM af_vendors WHERE id=${f.vendor.id}`, { code: "23503" });
  await assert.rejects(sql`DELETE FROM af_products WHERE id=${f.product.id}`, { code: "23503" });
  await assert.rejects(sql`DELETE FROM af_product_versions WHERE id=${f.draft.version.id}`, { code: "23503" });
  await assert.rejects(sql`DELETE FROM af_product_plans WHERE id=${plan.id}`, { code: "23503" });
  await assert.rejects(sql`DELETE FROM af_evidence WHERE id=${verified.evidenceId}`, { code: "23514" });
  const fks = await sql<{ confdeltype: string }[]>`SELECT c.confdeltype FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    WHERE c.contype='f' AND left(t.relname,3)='af_'`;
  assert.ok(fks.length >= 15);
  assert.ok(fks.every(fk => fk.confdeltype === "r"));
  const [orphan] = await sql`SELECT
    (SELECT count(*) FROM af_product_versions v LEFT JOIN af_products p ON p.id=v.product_id WHERE p.id IS NULL)::int AS versions,
    (SELECT count(*) FROM af_product_plans p LEFT JOIN af_product_versions v ON v.id=p.product_version_id WHERE v.id IS NULL)::int AS plans,
    (SELECT count(*) FROM af_product_prices r LEFT JOIN af_product_plans p ON p.id=r.plan_id WHERE p.id IS NULL)::int AS prices`;
  assert.deepEqual({ ...orphan }, { versions: 0, plans: 0, prices: 0 });
});

test("all fact families reject SQL ownership reassignment and published or superseded mutation", async () => {
  const a = await makeDraft(); const b = await makeDraft(); const verified = await proof();
  const args = [a.product.id, a.draft.version.id] as const;
  await setProductMarket(...args, { marketCode: "JP", availabilityStatus: "available", ...verified });
  await setProductLanguageSupport(...args, { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "none", ...verified });
  await setProductPlatform(...args, { platformKey: "web", status: "available", ...verified });
  await setProductCapability(...args, { capabilityKey: "text", supportLevel: "full", ...verified });
  const plan = await saveProductPlan(...args, { planKey: "test", name: "合成", ...verified });
  const price = await saveProductPrice(...args, plan.id, { priceType: "free", billingPeriod: "none", amountMinor: 0, ...verified });
  const tables = ["af_product_markets", "af_product_language_support", "af_product_platforms", "af_product_capabilities", "af_product_plans"];
  for (const table of tables) await assert.rejects(sql`UPDATE ${sql(table)} SET product_version_id=${b.draft.version.id} WHERE product_version_id=${a.draft.version.id}`, { code: "23514" });
  const bPlan = await saveProductPlan(b.product.id, b.draft.version.id, { planKey: "other", name: "合成" });
  await assert.rejects(sql`UPDATE af_product_prices SET plan_id=${bPlan.id} WHERE id=${price.id}`, { code: "23514" });
  await markPublished(a.draft.version.id);
  for (const table of tables) {
    await assert.rejects(sql`UPDATE ${sql(table)} SET verified_at=now() WHERE product_version_id=${a.draft.version.id}`, { code: "23514" });
    await assert.rejects(sql`DELETE FROM ${sql(table)} WHERE product_version_id=${a.draft.version.id}`, { code: "23514" });
  }
  await assert.rejects(sql`UPDATE af_product_prices SET amount_minor=0 WHERE id=${price.id}`, { code: "23514" });
  await assert.rejects(sql`DELETE FROM af_product_prices WHERE id=${price.id}`, { code: "23514" });
  await sql`UPDATE af_product_versions SET status='superseded', superseded_at=now() WHERE id=${a.draft.version.id}`;
  await assert.rejects(sql`UPDATE af_product_versions SET display_name='overwrite' WHERE id=${a.draft.version.id}`, { code: "23514" });
  await assert.rejects(sql`DELETE FROM af_product_versions WHERE id=${a.draft.version.id}`, { code: "23514" });
  await assert.rejects(sql`UPDATE af_product_capabilities SET support_level='none' WHERE product_version_id=${a.draft.version.id}`, { code: "23514" });
});

test("publication waits for an in-flight draft fact edit and validates its committed result", async () => {
  const f = await makeDraft();
  const locked = gate(); const release = gate();
  const edit = sql.begin(async tx => {
    await tx`SELECT id FROM af_product_versions WHERE id=${f.draft.version.id} FOR UPDATE`;
    locked.open(); await release.promise;
    await tx`INSERT INTO af_product_capabilities(product_version_id,capability_key,support_level) VALUES (${f.draft.version.id},'text','full')`;
  });
  await locked.promise;
  const publish = publishProductVersion(f.product.id, f.draft.version.id, "synthetic-editor", "合成競合テスト");
  const outcome = publish.then(() => null, error => error);
  try {
    const deadline = Date.now() + 5000;
    let blocked = false;
    while (!blocked && Date.now() < deadline) {
      const rows = await sql`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'
        AND query LIKE 'SELECT * FROM af_product_versions WHERE id=%FOR UPDATE%'
        AND pid <> pg_backend_pid()`;
      blocked = rows.length > 0;
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(blocked, "publisher must wait on the locked version row");
  } finally { release.open(); }
  await edit;
  assert.match((await outcome)?.message ?? "", /evidence/);
  assert.equal(await getPublishedProductBySlug(f.product.slug), null);
});

test("stale Repeatable Read snapshot cannot publish newly committed unverified facts", async () => {
  const f = await makeDraft();
  const stale = gate(); const committed = gate();
  const publish = sql.begin("isolation level repeatable read", async tx => {
    await tx`SELECT id FROM af_product_versions WHERE id=${f.draft.version.id}`;
    stale.open(); await committed.promise;
    await tx`UPDATE af_product_versions SET status='published',published_at=now() WHERE id=${f.draft.version.id}`;
  });
  const outcome = publish.then(() => null, error => error);
  await stale.promise;
  try {
    await setProductCapability(f.product.id, f.draft.version.id, { capabilityKey: "text", supportLevel: "full" });
  } finally { committed.open(); }
  const error = await outcome;
  assert.ok(error, "a stale snapshot must not admit the subsequently committed unverified assertion");
  // The Phase 2 fact trigger also updates revision, so PostgreSQL can reject the stale row first.
  if (error.code === "40001") assert.match(error.message, /could not serialize access due to concurrent update/);
  else assert.match(error.message, /isolation|evidence|verification/i);
  assert.equal(await getPublishedProductBySlug(f.product.slug), null);
});

test("publication rejects unsupported Serializable write isolation", async () => {
  const f = await makeDraft();
  await assert.rejects(sql.begin("isolation level serializable", async tx => {
    await tx`UPDATE af_product_versions SET status='published',published_at=now() WHERE id=${f.draft.version.id}`;
  }), /read committed isolation/);
  assert.equal(await getPublishedProductBySlug(f.product.slug), null);
});

test("domain publication explicitly selects Read Committed even when connection default is Repeatable Read", async () => {
  const f = await makeDraft();
  const name = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1));
  assert.match(name, /_(test|ci)$/);
  await sql`CREATE TABLE af_test_publish_isolation(value text NOT NULL)`;
  await sql`CREATE FUNCTION af_test_capture_isolation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status='published' THEN INSERT INTO af_test_publish_isolation VALUES(current_setting('transaction_isolation')); END IF; RETURN NEW; END; $$`;
  await sql`CREATE TRIGGER af_test_capture_isolation BEFORE UPDATE ON af_product_versions FOR EACH ROW EXECUTE FUNCTION af_test_capture_isolation()`;
  await sql`ALTER DATABASE ${sql(name)} SET default_transaction_isolation='repeatable read'`;
  try {
    // A new process creates new connections so the database default takes effect. No external I/O.
    const child = [
      'import assert from "node:assert/strict";',
      'import {sql,closeDb} from "@aihot/backend/db";',
      'import {publishProductVersion} from "@aihot/aifind/catalog/publish";',
      'try {',
      ' const [setting]=await sql`SHOW default_transaction_isolation`;',
      ' assert.equal(setting.default_transaction_isolation,"repeatable read");',
      ' await publishProductVersion(process.argv[1],process.argv[2],"synthetic-editor","合成 isolation 検証");',
      ' const [seen]=await sql`SELECT value FROM af_test_publish_isolation`;',
      ' assert.equal(seen.value,"read committed");',
      '} finally {await closeDb();}',
    ].join("\n");
    execFileSync(process.execPath, ["--input-type=module", "-e", child, f.product.id, f.draft.version.id], {
      stdio: "pipe", env: { ...process.env, MODEL_CALLS_ENABLED: "false", COLLECT_ENABLED: "false" },
    });
  } finally {
    await sql`ALTER DATABASE ${sql(name)} RESET default_transaction_isolation`;
    await sql`DROP TRIGGER af_test_capture_isolation ON af_product_versions`;
    await sql`DROP FUNCTION af_test_capture_isolation()`;
    await sql`DROP TABLE af_test_publish_isolation`;
  }
});
