import "../../../tests/setup.ts";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("Codex announcements retain uncertainty and use the Japanese calendar", async () => {
  const file = new URL("../backend/presentation.ts", import.meta.url);
  assert.ok(existsSync(file), "the Codex announcement publication module must exist");
  const { eventStatus, jstIso, calendarDate } = await import(file.href);
  const event = { status: "announced", inProgress: true, schedule: { from: "2026-10-04T14:00:00Z", through: "2026-10-04T16:00:00Z" } };
  assert.equal(eventStatus(event, Date.parse("2026-10-04T15:00:00Z")), "in_progress");
  assert.equal(eventStatus(event, Date.parse("2026-10-04T16:00:00Z")), "expired_unconfirmed");
  assert.equal(eventStatus(event, Date.parse("2026-10-05T22:00:00Z")), "expired_unconfirmed", "elapsed time cannot establish completion");
  assert.equal(eventStatus({ ...event, status: "confirmed" }, Date.parse("2026-10-05T22:00:00Z")), "confirmed");
  assert.equal(jstIso("2026-10-04T16:00:00Z"), "2026-10-05T01:00:00.000+09:00");
  assert.equal(calendarDate({ ...event, confirmedAt: null, occurredOn: null, reportedAt: "2026-10-04T13:00:00Z" }), "2026-10-04");
});
