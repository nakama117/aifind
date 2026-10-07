// One free GET to the official endpoint, then validate with the collector's actual parser. No DB access.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { OFFICIAL_STATUS_URL, parseOfficialStatus } from "../backend/official-status.ts";

const { values } = parseArgs({ options: { out: { type: "string" } }, strict: true });
const response = await fetch(OFFICIAL_STATUS_URL, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`OpenAI Status HTTP ${response.status}`);
const body = await response.text();
if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("OpenAI Status response exceeds 2 MiB");
const parsed = parseOfficialStatus(JSON.parse(body));
const result = {
  url: OFFICIAL_STATUS_URL, checkedAt: new Date().toISOString(), httpStatus: response.status, contentType: response.headers.get("content-type"),
  schema: "PASS", bytes: Buffer.byteLength(body), sha256: createHash("sha256").update(body).digest("hex"),
  incidentCount: parsed.total, codexIncidentCount: parsed.incidents.length,
  newestCodexIncidentUpdatedAt: parsed.incidents[0]?.updatedAt ?? null,
  note: "Read-only schema probe. No database writes. Service incidents do not confirm usage resets.",
};
const json = JSON.stringify(result, null, 2) + "\n";
if (values.out) writeFileSync(values.out, json, "utf8");
console.log(json);
