import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { loadReport, v1Period } from "@aihot/backend/publication/reports";
import { reportFeed } from "@aihot/backend/publication/feeds";
import { periodAnswer } from "@aihot/backend/publication/agent";
import { stopBoss } from "@aihot/backend/jobs/queue";

after(async () => { await stopBoss(); await closeDb(); });

test("withdrawal removes report prose based on a withdrawn citation from every outlet", async () => {
  const source = `withdraw-prose-${tag()}`;
  await sql`INSERT INTO sources(id,name,kind,tier) VALUES (${source},'Official','rss','T1')`;
  const entries = [];
  for (const title of ["取り下げた主張", "公開中の新しいモデル"]) {
    const { articleId } = await upsertMaterial({sourceId:source,url:`https://example.org/${tag()}`,title,excerpt:title,via:"fetch",publishedAt:new Date()});
    await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,category,title_zh,summary_zh,score,selected) VALUES (${articleId},1,'rule','pass','ai-models',${title},${title},80,true)`;
    await publishArticle(articleId,{releasedAt:new Date(Date.now()-60_000)});
    entries.push({itemId:articleId,title,summary:title,sourceName:"Official",sourceUrl:`https://example.org/${articleId}`});
  }
  const prose = "取り下げた主張に基づく導読です。";
  for (const [kind,key] of [["weekly","2026-W38"],["monthly","2026-09"]] as const) {
    const content = {retrospective:true,headline:entries[0]!.title,leadItemId:entries[0]!.itemId,overview:prose,themes:[{heading:"モデル",summary:prose,storyRefs:entries}]};
    await sql`INSERT INTO reports(kind,key,window_start,window_end,content,generated_at,origin) VALUES (${kind},${key},now()-interval '30 days',now(),${sql.json(content)},now(),'model')`;
  }
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${entries[0]!.itemId}`;
  for (const [kind,key] of [["weekly","2026-W38"],["monthly","2026-09"]] as const) {
    const detail = await loadReport(kind,key);
    const api = await v1Period(kind,key);
    const outputs = [JSON.stringify(detail),JSON.stringify(api),await reportFeed(kind),periodAnswer(api!.report,kind,"http")];
    for (const output of outputs) {
      assert.doesNotMatch(output,/取り下げた主張/,kind);
      assert.match(output,/公開中の新しいモデル/,kind);
    }
    assert.equal(detail!.sections[0]!.summary,null);
  }
});
