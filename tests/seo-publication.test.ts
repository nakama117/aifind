/// <reference lib="dom" />
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { sitemapXml } from "@aihot/backend/publication/sitemap";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { articleLd, siteUrl } from "../apps/web/app/lib/seo.ts";

after(async () => { await stopBoss(); await closeDb(); });
test("sitemap excludes unreleased selected items as well as withdrawn articles", async () => {
  const source = `sitemap-${tag()}`;
  await sql`INSERT INTO sources (id, name, kind, tier) VALUES (${source}, 'Sitemap', 'rss', 'T1')`;
  const ids: string[] = [];
  for (const kind of ["visible", "future", "withdrawn"]) {
    const { articleId } = await upsertMaterial({ sourceId: source, url: `https://example.com/${source}/${kind}`, title: kind, via: "fetch" });
    ids.push(articleId);
    await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, title_zh, summary_zh, selected)
      VALUES (${articleId}, 1, 'rule', 'pass', '公開ニュース', '日本語の要約です。', true)`;
    await sql`UPDATE articles SET grouping_status = 'complete', grouped_at = now() WHERE id = ${articleId}`;
    await publishArticle(articleId);
    if (kind === "future") await sql`UPDATE publications SET visible_after = '2100-01-01' WHERE article_id = ${articleId}`;
    if (kind === "withdrawn") await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${articleId}`;
  }
  const xml = await sitemapXml();
  assert.ok(xml.includes(`/items/${ids[0]}`));
  assert.ok(!xml.includes(`/items/${ids[1]}`), "not-yet-released items must not be advertised to crawlers");
  assert.ok(!xml.includes(`/items/${ids[2]}`));
});

test("article structured data provides the same share image as its page", () => {
  const ld = articleLd({ path: "/items/japanese-story", headline: "日本語の記事", image: "/og/items/japanese-story.png" });
  assert.equal(ld.image, `${siteUrl()}/og/items/japanese-story.png`);
  assert.equal(ld.inLanguage, "ja-JP");
});
