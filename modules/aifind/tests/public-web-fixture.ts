// Backend process used only by built-SSR tests. Every connection is local and the DB is disposable.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { assertPreviewWrites } from "../preview/config.ts";

const [mode, name] = process.argv.slice(2);
assertPreviewWrites(process.env);
if (!/_(test|ci)$/.test(new URL(process.env.DATABASE_URL!).pathname) || !/^aifind_public_web_[a-f0-9]{12}_test$/.test(name ?? "")) {
  throw new Error("Preview SSR fixture requires a local test database and its unique scoped copy name");
}
const url = new URL(process.env.DATABASE_URL!); url.pathname = "/postgres";
const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
if (mode === "cleanup") {
  try { await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`; }
  finally { await admin.end(); }
  process.exit(0);
}
if (!['serve','serve-discovery'].includes(mode)) throw new Error("Unknown test fixture mode");
try { await admin`CREATE DATABASE ${admin(name)}`; }
finally { await admin.end(); }
url.pathname = `/${name}`; process.env.DATABASE_URL = url.toString();
execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/migrate.ts", import.meta.url))], { env: process.env, stdio: "pipe", windowsHide: true });
await import("../../../tests/setup.ts");
const { closeDb } = await import("@aihot/backend/db");
const { installModules } = await import("@aihot/backend/modules");
const { SERVER_MODULES } = await import("@aihot/site/modules/server");
const { buildApp } = await import("../../../apps/api/src/app.ts");
const { seedPublicPreview } = await import("../preview/public-seed.ts");

installModules(SERVER_MODULES);
await seedPublicPreview();
if(mode==='serve-discovery')await (await import('../preview/discovery-seed.ts')).seedDiscoveryPreview();
// Real Published products for the current-free-plan card regression; never production seed.
const { publicFixture } = await import("./public-fixtures.ts");
const { saveProductPlan, saveProductPrice } = await import("../catalog/pricing.ts");
const { updateProductIdentity } = await import("../catalog/identity.ts");
const { sql } = await import("@aihot/backend/db");
const {setProductMarket,setProductLanguageSupport}=await import('../catalog/facts.ts');
for (const [kind, period] of [
  ["current", { validFrom: "2000-01-01", validTo: "2099-12-31" }],
  ["expired", { validFrom: "2000-01-01", validTo: "2000-01-31" }],
  ["future", { validFrom: "2099-01-01", validTo: "2099-12-31" }],
] as const) {
  const f = await publicFixture("listed", async (f, p) => {
    await setProductMarket(f.product.id,f.draft.version.id,{marketCode:'JP',availabilityStatus:'available',...p});
    await setProductLanguageSupport(f.product.id,f.draft.version.id,{languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'full',...p});
    const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey: "free", name: "Synthetic free period", activeStatus: "active", ...p });
    await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType: "free", amountMinor: 0, billingPeriod: "none", ...period, ...p });
  });
  await sql.begin(tx => updateProductIdentity(f.product.id, { slug: `aifind-web-free-${kind}`, canonicalName: f.product.canonicalName, vendorId: f.vendor.id }, tx));
}
const app = await buildApp();
const origin = await app.listen({ host: "127.0.0.1", port: 0 });
console.log(JSON.stringify({ previewTestApi: origin }));
process.on("SIGTERM", async () => { await app.close(); await closeDb(); process.exit(0); });
