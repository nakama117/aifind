// Explicit local/dev/test fixture. Never called from API, worker or web startup.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { assertPreviewWrites } from "../modules/aifind/preview/config.ts";

assertPreviewWrites(process.env); // Before connection, database creation or migration.
const url = new URL(process.env.DATABASE_URL!);
const name = url.pathname.slice(1);
const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
try {
  if (!(await admin`SELECT 1 FROM pg_database WHERE datname=${name}`).length) await admin`CREATE DATABASE ${admin(name)}`;
} finally { await admin.end(); }
execFileSync(process.execPath, [fileURLToPath(new URL("./migrate.ts", import.meta.url))], { env: process.env, stdio: "inherit", windowsHide: true });
const { seedPreviewProduct } = await import("../modules/aifind/preview/seed.ts");
const { seedAdminPreview } = await import("../modules/aifind/preview/admin-seed.ts");
const { closeDb } = await import("@aihot/backend/db");
try {
  await seedPreviewProduct();
  await seedAdminPreview();
  console.log("[PREVIEW] Product Domain + Phase 2 Admin fixtures ready; existing edits preserved.");
}
finally { await closeDb(); }
