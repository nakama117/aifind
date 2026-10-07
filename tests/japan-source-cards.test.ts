import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fromHtml } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";
const sources=JSON.parse(readFileSync(new URL("../industry/sources.json",import.meta.url),"utf8")).sources;

test("Sakana cards keep their sibling date together with the linked headline",()=>{
 const source=sources.find((s:SourceRow)=>s.id==="web-sakana-ai") as SourceRow;
 const rows=fromHtml('<article><header><h1><a href="/marlin-update/">Sakana Marlin の更新</a></h1><time datetime="2026-09-16T00:00:00+09:00">September 16, 2026</time></header><div><a href="/marlin-update/">read more</a></div></article>',"https://sakana.ai/blog/",source);
 assert.equal(rows.length,1);assert.equal(rows[0]!.publishedAt?.toISOString(),"2026-09-15T15:00:00.000Z");
});
test("Preferred Networks cards keep the date and exclude category and offsite links",()=>{
 const source=sources.find((s:SourceRow)=>s.id==="web-preferred-networks") as SourceRow;
 const rows=fromHtml('<div class="flex-1 space-y-4"><time datetime="2026-09-29">2026.09.29</time><h2><a href="/ja/news/pr20260929"><span>PFN、CEATEC2026に出展</span></a></h2><a href="/ja/news/category/event">イベント</a></div><div><time datetime="2026-09-28"></time><h2><a href="https://prtimes.jp/external">外部記事</a></h2></div>',"https://www.preferred.jp/ja/news/",source);
 assert.equal(rows.length,1);assert.equal(rows[0]!.publishedAt?.toISOString(),"2026-09-29T00:00:00.000Z");
});
