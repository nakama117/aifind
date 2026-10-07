import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHistory, companyMilestones } from "../backend/history.ts";

const history = () => ({ topic: "openai", compiledOn: "2026-10-04", through: "2024-05", events: [
  { date: "2024-05-13", kind: "model", title: "GPT-4oを発表", source: "OpenAI", url: "https://openai.com/index/hello-gpt-4o/" },
  { date: "2022-11-30", kind: "product", title: "ChatGPTの研究プレビューを公開", source: "OpenAI", url: "https://openai.com/index/chatgpt/" },
] });

test("historical nodes keep original dates, direct source links and chronological order without news", () => {
  const milestones = companyMilestones(parseHistory(history(), "openai"), [], new Map());
  assert.deepEqual(milestones.map((m: { date: string }) => m.date), ["2022-11-30", "2024-05-13"]);
  assert.equal(milestones[0].href, "https://openai.com/index/chatgpt/");
  assert.equal(milestones[0].source, "OpenAI");
  assert.equal(milestones[0].external, true);
});

test("history rejects absent provenance, invalid calendar dates, unsafe URLs and mismatched topics", () => {
  for (const patch of [{ url: undefined }, { source: "" }, { date: "2023-02-29" }, { url: "javascript:alert(1)" }, { url: "https://user:secret@example.org/a" }]) {
    const document = history();
    Object.assign(document.events[0], patch);
    assert.throws(() => parseHistory(document, "openai"));
  }
  assert.throws(() => parseHistory(history(), "anthropic"));
  assert.throws(() => parseHistory({ ...history(), topic: "agent" }, "agent"));
});

test("archive compilation and coverage cannot precede its events", () => {
  assert.throws(() => parseHistory({ ...history(), through: "2023-01" }, "openai"));
  assert.throws(() => parseHistory({ ...history(), compiledOn: "2022-01-01" }, "openai"));
});

test("an internal related-news link is exposed only while the publication reader confirms membership", () => {
  const document = history();
  Object.assign(document.events[0], { item: "current-item" });
  const parsed = parseHistory(document, "openai");
  assert.equal(companyMilestones(parsed, [], new Map())[1].related, null);
  const live = new Map([["current-item", { id: "current-item", topics: ["openai"] }]]);
  assert.equal(companyMilestones(parsed, [], live as never)[1].related, "/items/current-item");
  const moved = new Map([["current-item", { id: "current-item", topics: ["anthropic"] }]]);
  assert.equal(companyMilestones(parsed, [], moved as never)[1].related, null);
});

test("automatic milestones after the curated month use Tokyo event dates and are not marked curated", () => {
  const picked = [{ month: "2024-06", events: [{ id: "a1", title: "新モデルを発表", label: "新モデルを発表", at: "2024-06-01T15:01:00.000Z", kind: "model", href: "/items/a1" }] }];
  const result = companyMilestones(parseHistory(history(), "openai"), picked, new Map());
  assert.equal(result.at(-1)?.date, "2024-06-02");
  assert.equal(result.at(-1)?.external, false);
  assert.equal(result.at(-1)?.major, false);
});

test("sparse archives retain unrelated automatic events in the curated month", () => {
  const picked = [{ month: "2024-05", events: [{ id: "a1", title: "別の製品を公開", label: "別の製品を公開", at: "2024-05-20T00:00:00.000Z", kind: "product", href: "/items/a1" }] }];
  const result = companyMilestones(parseHistory(history(), "openai"), picked, new Map());
  assert.equal(result.length, 3);
  assert.equal(result.at(-1)?.href, "/items/a1");
});

test("explicit archive links merge the same public fact while leaving unrelated events visible", () => {
  const document = history();
  Object.assign(document.events[0], { item: "archive-report" });
  const live = new Map([
    ["archive-report", { id: "archive-report", topics: ["openai"], factId: 11, story: null }],
    ["representative", { id: "representative", topics: ["openai"], factId: 11, story: null }],
    ["unrelated", { id: "unrelated", topics: ["openai"], factId: 12, story: null }],
  ]);
  const picked = [{ month: "2024-06", events: [
    { id: "representative", title: "同じ事実の別の見出し", label: "同じ事実", at: "2024-06-01T00:00:00.000Z", kind: "model", href: "/items/representative" },
    { id: "unrelated", title: "別のモデル", label: "別のモデル", at: "2024-06-02T00:00:00.000Z", kind: "model", href: "/items/unrelated" },
  ] }];
  const result = companyMilestones(parseHistory(document, "openai"), picked, live as never);
  assert.deepEqual(result.filter((m) => !m.external).map((m) => m.href), ["/items/unrelated"]);
  live.delete("archive-report");
  assert.equal(companyMilestones(parseHistory(document, "openai"), picked, live as never).filter((m) => !m.external).length, 2);
});
