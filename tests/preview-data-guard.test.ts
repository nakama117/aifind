import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { assertOnlyPreviewMaterial } from "../scripts/preview-config.ts";
after(closeDb);
test("the pre-migration preview check rejects a database containing real material", async () => {
  await assertOnlyPreviewMaterial(sql);
  const id = `real-${tag()}`;
  await sql`INSERT INTO sources (id, name, kind) VALUES (${id}, 'Existing real source', 'rss')`;
  await upsertMaterial({ sourceId: id, url: `https://example.com/${id}`, title: "Real material", via: "import" });
  await assert.rejects(assertOnlyPreviewMaterial(sql), /non-preview material/);
});
