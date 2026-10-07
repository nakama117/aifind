import assert from "node:assert/strict";
import { test } from "node:test";
import { readable } from "@aihot/backend/content/extract";

test("official pages with omitted html tags still yield their article body",()=>{
 const paragraph="新しい研究手法について、評価条件と観測結果を説明します。同じ課題を繰り返して測定し、性能と一貫性を比較しました。".repeat(12);
 const html=`<!doctype html><head><title>研究の発表</title></head><header><a href="/">公式サイト</a></header><article><header><h1>研究の発表</h1><time>2026-09-16</time></header><p>${paragraph}</p><p>${paragraph}</p></article><footer>Copyright</footer>`;
 const article=readable(html,"https://example.org/research/");
 assert.ok(article);assert.match(article.text,/評価条件と観測結果/);assert.ok(article.text.length>500);
});
