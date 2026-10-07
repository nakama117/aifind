import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { adaptIntervals } from "@aihot/backend/sources/collect";
import { upsertMaterial } from "@aihot/backend/content/materials";
after(closeDb);

test("active official feeds retain an hourly collection interval", async () => {
  const id = `hourly-${tag()}`;
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, interval_minutes)
    VALUES (${id}, 'Official hourly source', 'rss', 'T1', 'editorial', 60)`;
  for (let n = 0; n < 70; n++) await upsertMaterial({ sourceId: id, url: `https://example.com/${id}/${n}`, title: `News ${n}`, bodyText: `Article ${n}`, bodyStatus: "ok", publishedAt: new Date(), via: "fetch" });
  await adaptIntervals();
  const [source] = await sql`SELECT interval_minutes FROM sources WHERE id=${id}`;
  assert.equal(source!.interval_minutes, 60);
});
