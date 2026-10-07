import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as markdown from '@aihot/backend/content/markdown';
const render=(text:string)=>{
  const fn=(markdown as unknown as {authoredMarkdownBody?:(text:string,url:string)=>string}).authoredMarkdownBody;
  assert.ok(fn,'untrusted authored Markdown needs the existing sanitized renderer with raw HTML disabled');
  return fn(text,'https://synthetic.example/editorial');
};
test('E12 Editorial Markdown disables raw HTML, scripts, iframe, events, MDX and remote media',()=>{
  const html=render('## 日本語の見出し\n\n**判断**\n\n<script>alert(1)</script>\n<iframe src="https://evil.example"></iframe>\n<img src=x onerror=alert(2)>\n<Component onClick={run()} />\n\n![remote](https://evil.example/pixel.png)');
  assert.match(html,/<h2>日本語の見出し<\/h2>/);assert.match(html,/<strong>判断<\/strong>/);
  assert.doesNotMatch(html,/<script|<iframe|<img|<Component|<[^>]+on(?:error|click)=/i);
});
test('E12 Editorial Markdown removes unsafe URI links while preserving HTTPS and readable lists/tables',()=>{
  const html=render('[unsafe](javascript:alert)\n\n[safe](https://synthetic.example/docs)\n\n- 条件\n- 限界\n\n|条件|判断|\n|---|---|\n|少量|確認|');
  assert.doesNotMatch(html,/href="javascript:|href="data:/i);assert.match(html,/href="https:\/\/synthetic.example\/docs"/);assert.match(html,/<ul>/);assert.match(html,/<table>/);
});
