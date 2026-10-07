import { stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { extractArticleBody } from "@aihot/backend/content/extract";

const page = await stub(() => ({ unavailable: true }));
config.allowPrivateNetworkFetch = true;
process.env.JINA_API_KEY = "";
after(async () => { await page.close(); await closeDb(); });

test("an unreadable page without an optional reader leaves the source excerpt available without paid calls", async () => {
  const sourceId = `optional-reader-${tag()}`;
  await sql`INSERT INTO sources (id,name,kind) VALUES (${sourceId},'Optional reader','rss')`;
  const { articleId } = await upsertMaterial({ sourceId, url: `${page.url}/article`, title: "A real source headline", excerpt: "The publisher supplied this brief announcement.", via: "fetch" });
  const [before] = await sql`SELECT count(*) AS count FROM receipt_attempts`;
  assert.equal(await extractArticleBody(articleId), "unconfirmed");
  const [article] = await sql`SELECT excerpt, body_text, body_status FROM articles WHERE id=${articleId}`;
  assert.equal(article!.excerpt, "The publisher supplied this brief announcement.");
  assert.equal(article!.body_text, null);
  assert.equal(article!.body_status, "unconfirmed");
  const [after] = await sql`SELECT count(*) AS count FROM receipt_attempts`;
  assert.equal(after!.count, before!.count);
});
