// Only for scripts/preview.ts, or an explicitly configured local *_preview database.
import { readFileSync } from "node:fs";
import { assertOnlyPreviewMaterial, previewEnvironment } from "./preview-config.ts";
Object.assign(process.env, previewEnvironment(process.env.DATABASE_URL ?? "", process.env));
// Import after validating the target and disabling all paid/external side effects.
const { sql, closeDb } = await import("@aihot/backend/db");
const { upsertMaterial } = await import("@aihot/backend/content/materials");
const { publishArticle } = await import("@aihot/backend/publication/publish");
const { stopBoss } = await import("@aihot/backend/jobs/queue");

interface PreviewNews {
  checkedAt: string;
  sources: { id: string; name: string; owner: string }[];
  articles: { source: string; url: string; sourceTitle: string; language: string; publishedAt: string; dateEvidence: string;
    title: string; summary: string; reason: string; category: string; tags: string[] }[];
}
const news: PreviewNews = JSON.parse(readFileSync(new URL("../site/preview-news.json", import.meta.url), "utf8"));

try {
  await assertOnlyPreviewMaterial(sql);
  for (const source of news.sources) await sql`
    INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, owner_entity_id, enabled, site_fulltext, syndicate_fulltext)
    VALUES (${`preview-${source.id}`}, ${source.name}, 'external', 'T1', 'editorial', true, ${source.owner}, false, false, false)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = false, site_fulltext = false, syndicate_fulltext = false`;
  for (const item of news.articles) {
    const { articleId } = await upsertMaterial({
      sourceId: `preview-${item.source}`, identityKey: `preview-news:${item.url}`, url: item.url, title: item.sourceTitle,
      language: item.language, bodyStatus: "none", via: "import", publishedAt: new Date(item.publishedAt),
      backfill: "preview-official-news", raw: { checkedAt: news.checkedAt, dateEvidence: item.dateEvidence, summaryMethod: "editorial-preview" },
    });
    // A local editorial import, not a fabricated model analysis or a historical publication by this site.
    const fields = { title: item.title, summary: item.summary, reason: item.reason, category: item.category,
      tags: [...item.tags, `entity:${item.source}`], relevance: "pass", selected: true };
    await sql`INSERT INTO editorial_overrides (article_id, fields, reason, updated_by)
      VALUES (${articleId}, ${sql.json(fields)}, 'Official-source summary for local preview; not automatically scored', 'preview-import')
      ON CONFLICT (article_id) DO UPDATE SET fields = EXCLUDED.fields, updated_at = now()`;
    await sql`UPDATE articles SET grouped_at = coalesce(grouped_at, now()), grouping_status = 'complete', processing_state = 'analyzed' WHERE id = ${articleId}`;
    await publishArticle(articleId);
  }
  // Backfilled stories do not fabricate live heat or dated reports. Their empty states remain visible.
  console.log(`Imported ${news.articles.length} official-source Japanese summaries; original dates and links preserved; no model calls.`);
} finally { await stopBoss(); await closeDb(); }
