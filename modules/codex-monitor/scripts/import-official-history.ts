// Dry run by default. An apply requires an explicit database; never loads .env or invokes a model.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ImportSchema } from "../backend/schema.ts";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, database: { type: "string" }, file: { type: "string" }, actor: { type: "string", default: "operator:official-history" } }, strict: true });
const file = values.file ?? new URL("../data/official-history.json", import.meta.url);
const text = readFileSync(file, "utf8");
const batch = ImportSchema.parse(JSON.parse(text));
console.log(JSON.stringify({ mode: values.apply ? "apply" : "dry-run", sha256: createHash("sha256").update(text).digest("hex"), count: batch.events.length, events: batch.events.map((e) => ({ id: e.id, occurredOn: e.occurredOn, occurredOnTimezone: e.occurredOnTimezone, reportedAt: e.reportedAt, confirmedAt: e.confirmedAt, verifiedAt: e.sources.map((s) => s.verifiedAt) })) }, null, 2));
if (values.apply) {
  if (!values.database) throw new Error("--apply requires --database with an explicitly chosen target; dry-run does not connect to a database");
  const target = new URL(values.database);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("--database must be a PostgreSQL URL");
  process.env.DATABASE_URL = values.database;
  const { importAnnouncements } = await import("../backend/admin.ts");
  const { closeDb } = await import("@aihot/backend/db");
  try { console.log(JSON.stringify({ database: target.pathname.slice(1), ...await importAnnouncements(batch, values.actor!) })); }
  finally { await closeDb(); }
}
