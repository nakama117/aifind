import "../../../tests/setup.ts";
import { createTestDatabase, dropTestDatabase } from "../../../tests/database-cleanup.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import postgres from "postgres";
import { tag } from "../../../tests/setup.ts";

test("Phase 2 upgrades the existing 0069 chain without losing identities, Published, Draft or price lineage", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.match(url.pathname, /_(test|ci)$/);
  const name = `af_admin_upgrade_${tag()}_test`; const target = new URL(url); target.pathname = `/${name}`;
  url.pathname = "/postgres"; const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
  let db: postgres.Sql | undefined;
  try {
    await createTestDatabase(process.env.DATABASE_URL!, name);
    db = postgres(target.toString(), { max: 1, onnotice: () => {} });
    const files = (dir: URL) => readdirSync(dir).filter(f => f.endsWith(".sql")).map(name => ({ name, file: new URL(name, dir) }));
    const modules = new URL("../../../modules/", import.meta.url);
    const migrations = [...files(new URL("../../../database/migrations/", import.meta.url)), ...readdirSync(modules).flatMap(module => {
      try { return files(new URL(`${module}/migrations/`, modules)); } catch { return []; }
    })].sort((a, b) => a.name.localeCompare(b.name));
    await db`CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const m of migrations.filter(m => m.name < "0070")) await db.begin(async tx => {
      await tx.unsafe(readFileSync(m.file, "utf8")); await tx`INSERT INTO schema_migrations(name) VALUES (${m.name})`;
    });
    await db`INSERT INTO af_vendors(id,slug,name) VALUES ('old-vendor','old-vendor','[TEST] Old vendor')`;
    await db`INSERT INTO af_products(id,slug,canonical_name,vendor_id) VALUES ('old-product','old-product','[TEST] Old product','old-vendor')`;
    await db`INSERT INTO af_product_versions(id,product_id,version_no,display_name) VALUES ('old-published','old-product',1,'[TEST] Published')`;
    await db`INSERT INTO af_product_plans(id,product_version_id,plan_key,name) VALUES ('old-pub-plan','old-published','trial','[TEST] Trial')`;
    await db`INSERT INTO af_product_prices(id,plan_id,price_type,billing_period) VALUES ('old-pub-price','old-pub-plan','unknown','none')`;
    await db`UPDATE af_product_versions SET status='published',published_at=now() WHERE id='old-published'`;
    await db`INSERT INTO af_product_versions(id,product_id,version_no,display_name) VALUES ('old-draft','old-product',2,'[TEST] Draft')`;
    await db`INSERT INTO af_product_plans(id,product_version_id,plan_key,name) VALUES ('old-draft-plan','old-draft','trial','[TEST] Trial')`;
    await db`INSERT INTO af_product_prices(id,plan_id,price_type,billing_period) VALUES ('old-draft-price','old-draft-plan','unknown','none')`;
    await db`INSERT INTO af_product_markets(id,product_version_id,market_code,availability_status) VALUES ('old-market','old-draft','JP','unknown')`;
    const before = await db`SELECT to_jsonb(v) AS value FROM af_product_versions v ORDER BY version_no`;
    const migrate = () => execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/migrate.ts", import.meta.url))], { encoding: "utf8", env: { ...process.env, DATABASE_URL: target.toString() }, windowsHide: true });
    assert.match(migrate(), /15 migration\(s\) applied/);
    assert.equal((await db`SELECT count(*)::int AS n FROM af_catalog_imports`)[0].n,0);
    assert.equal((await db`SELECT count(*)::int AS n FROM af_catalog_evidence`)[0].n,0);
    const after = await db`SELECT to_jsonb(v)-'revision'-'base_version_id'-'summary_ja' AS value FROM af_product_versions v ORDER BY version_no`;
    assert.deepEqual(Array.from(after), Array.from(before));
    assert.equal((await db`SELECT summary_ja FROM af_product_versions WHERE id='old-published'`)[0].summary_ja,null);
    assert.deepEqual({...((await db`SELECT public_visibility,first_public_at FROM af_products WHERE id='old-product'`)[0])},{public_visibility:'private',first_public_at:null});
    assert.equal((await db`SELECT 1 FROM af_product_slug_redirects WHERE product_id='old-product'`).length,0);
    assert.equal((await db`SELECT base_version_id FROM af_product_versions WHERE id='old-draft'`)[0].base_version_id, "old-published");
    assert.equal((await db`SELECT base_price_id FROM af_product_prices WHERE id='old-draft-price'`)[0].base_price_id, "old-pub-price");
    const previous = Number((await db`SELECT revision FROM af_product_versions WHERE id='old-draft'`)[0].revision);
    await db`UPDATE af_product_markets SET availability_status='restricted' WHERE id='old-market'`;
    assert.equal(Number((await db`SELECT revision FROM af_product_versions WHERE id='old-draft'`)[0].revision), previous + 1);
    await assert.rejects(db`UPDATE af_product_versions SET display_name='overwrite' WHERE id='old-published'`, { code: "23514" });
    await assert.rejects(db`UPDATE af_product_versions SET base_version_id=NULL WHERE id='old-draft'`, { code: "23514" });
    assert.match(migrate(), /database is up to date/);
  } finally { await db?.end(); await dropTestDatabase(process.env.DATABASE_URL!, name); await admin.end(); }
});
