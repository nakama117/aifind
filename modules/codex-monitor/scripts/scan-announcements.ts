// Explicit one-shot operator entry point. Never loads .env or enables any runtime safety valve.
import { parseArgs } from "node:util";
import { DEFAULT_COLLECTION_SOURCES } from "../backend/collection-schema.ts";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, database: { type: "string" }, mode: { type: "string", default: "collect" }, limit: { type: "string", default: "1" } }, strict: true });
if (!["collect", "process", "run"].includes(values.mode!)) throw new Error("--mode must be collect, process or run");
const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("--limit must be an integer from 1 to 20");
if (!values.apply) {
  console.log(JSON.stringify({ mode: "dry-run", officialOnly: true, operation: values.mode, limit, defaultSources: DEFAULT_COLLECTION_SOURCES.filter((source) => source.kind !== "x_search"), notice: "No database or network access. --apply requires --database. collect reads only free official pages; process/run may call OpenAI through receipts when existing safety valves permit." }, null, 2));
} else {
  if (!values.database) throw new Error("--apply requires --database; no implicit target database");
  const database = new URL(values.database);
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("--database must be a PostgreSQL URL");
  process.env.DATABASE_URL = values.database;
  const { closeDb } = await import("@aihot/backend/db");
  try {
    const { installModules } = await import("@aihot/backend/modules");
    const { codexMonitorServer } = await import("../server.ts");
    const { monitorTick } = await import("../backend/collection.ts");
    const { audit } = await import("@aihot/backend/audit");
    installModules([codexMonitorServer]);
    const result = await monitorTick({ mode: values.mode as "collect" | "process" | "run", officialOnly: true, limit });
    await audit("operator:codex-monitor-cli", "codex-monitor.manual-run", "codex-monitor:sources", "Explicit official-only CLI execution", null, { mode: values.mode, ...result });
    console.log(JSON.stringify({ mode: values.mode, officialOnly: true, database: database.pathname.slice(1), result }, null, 2));
    if ("collection" in result && (result.collection?.failed || result.recognition?.failed)) process.exitCode = 1;
  } finally { await closeDb(); }
}
