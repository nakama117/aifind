import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { findTopic } from "@aihot/backend/publication/topics";
import { chronicleTopic, selectTopicChronicle, selectTopicHighlights, chronicleReadReports, type ChronicleReport } from "../backend/selection.ts";

const now = new Date("2026-09-30T20:00:00+09:00");
let n = 0;
function report(title: string, options: Partial<ChronicleReport> = {}): ChronicleReport {
  const at = new Date("2026-09-10T12:00:00+09:00");
  return { id: `r${++n}`, title, originalTitle: null, category: "ai-models", tags: ["モデル公開"], score: 85,
    topicSlugs: ["openai", "google", "anthropic", "agent", "model-releases", "product-updates", "tutorials"],
    timelineAt: at, publishedAt: at, factPublishedAt: null, firstParty: true, owner: null, factId: null,
    factSubject: "OpenAI", factAction: "launch", factOccurredAt: null, storyPublicId: null, sourceCount: 1, scope: "single", ...options };
}
const events = (slug: string, reports: ChronicleReport[]) => selectTopicChronicle(chronicleTopic(findTopic(slug)!), reports, { now }).flatMap((m) => m.events);

test("company months retain separate model, product and company quotas", () => {
  const reports = [
    ...Array.from({ length: 4 }, (_, i) => report(`OpenAI、Model ${i + 1}を発表`, { score: 90 - i })),
    ...Array.from({ length: 3 }, (_, i) => report(`OpenAI、製品${i + 1}を公開`, { category: "ai-products", score: 90 - i })),
    ...Array.from({ length: 2 }, (_, i) => report(`OpenAI、資金調達${i + 1}を発表`, { category: "industry", score: 95 - i })),
  ];
  const picked = events("openai", reports);
  assert.equal(picked.filter((e) => e.kind === "model").length, 3);
  assert.equal(picked.filter((e) => e.kind === "product").length, 2);
  assert.equal(picked.filter((e) => e.kind === "company").length, 1);
});

test("Japanese announcements, tutorials, rankings, promotions and platform listings are not launches", () => {
  const titles = ["OpenAI、GPT-9を来月公開予定", "OpenAI、GPT-9の発表を予告", "GPT-9の使い方を解説", "GPT-9とは？", "GPT-9技術レポート",
    "GPT-9がランキング首位に", "GPT-9を期間限定で無料提供", "OpenAIの更新まとめ", "OpenRouter、GPT-9の提供を開始", "GPT-9のGGUF版を公開"];
  assert.deepEqual(events("model-releases", titles.map((t) => report(t, { score: 99 }))), []);
  assert.equal(events("model-releases", [report("OpenAI、GPT-9を公開しベンチマーク首位に")]).length, 1);
  assert.equal(events("model-releases", [report("OpenAI、GPT-9を公開しランキング首位に")]).length, 1);
});

test("a launch belongs to its fact subject, never a company merely mentioned", () => {
  const r = report("Anthropic、OpenAIと比較したClaude 9を発表", { factSubject: "Anthropic" });
  assert.equal(events("openai", [r]).length, 0);
  assert.equal(events("anthropic", [r]).length, 1);
});

test("one event keeps its original occurrence date and the best current headline", () => {
  const early = report("OpenAI、GPT-9を発表", { factId: 1, factOccurredAt: new Date("2026-09-01T00:00:00+09:00"), score: 80 });
  const later = report("OpenAI、GPT-9の提供を開始", { factId: 1, score: 95 });
  const picked = events("openai", [later, early]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].title, later.title);
  assert.equal(picked[0].at, "2026-08-31T15:00:00.000Z");
});

test("nearby reports of one version merge while distinct versions and variants remain separate", () => {
  const reports = [report("OpenAI、GPT-9を発表"), report("OpenAI、GPT-9の公開を発表", { score: 90 }), report("OpenAI、GPT-9.1を発表"),
    report("Google、Gemini 9 Flashを発表", { factSubject: "Google" }), report("Google、Gemini 9 Liveを発表", { factSubject: "Google" })];
  assert.equal(events("model-releases", reports).length, 4);
});

test("a Japanese comparison does not merge a new version into the older model it names", () => {
  assert.equal(events("model-releases", [report("OpenAI、GPT-9を公開"), report("OpenAI、GPT-9.1を公開、GPT-9に匹敵")]).length, 2);
});

test("versionless Japanese launch reports merge when their only difference is the release verb", () => {
  assert.equal(events("model-releases", [report("OpenAI、Muse Sparkを公開"), report("OpenAI、Muse Sparkを発表")]).length, 1);
});

test("technical fields require their subject in the headline; genres retain their own limits", () => {
  const generic = report("OpenAI、GPT-9を発表");
  assert.equal(events("agent", [generic]).length, 0);
  assert.equal(events("agent", [report("OpenAI、エージェントモデルGPT-9を発表")]).length, 1);
  assert.equal(events("model-releases", Array.from({ length: 9 }, (_, i) => report(`Lab${i}、Model ${i + 1}を公開`))).length, 8);
  assert.equal(events("tutorials", [generic]).length, 0);
});

test("null scores, composite articles, future events and old events never become milestones", () => {
  assert.deepEqual(events("openai", [report("OpenAI、Model 1を公開", { score: null }), report("OpenAI、Model 2を公開", { scope: "composite" }),
    report("OpenAI、Model 3を公開", { factOccurredAt: new Date("2026-10-01") }), report("OpenAI、Model 4を公開", { factOccurredAt: new Date("2024-01-01") })]), []);
});

test("original dates survive read bounds when a public story spans several months", () => {
  const old = report("OpenAI、Model 1を公開", { storyPublicId: "story-1", publishedAt: new Date("2026-08-01"), score: 99 });
  const current = report("OpenAI、Model 1を更新", { storyPublicId: "story-1" });
  const picked = selectTopicChronicle(chronicleTopic(findTopic("openai")!), [old, current], { now });
  assert.equal(picked[0]?.events[0]?.id, old.id);
  assert.equal(picked[0]?.events[0]?.at.slice(0, 10), "2026-08-01");
  assert.equal(chronicleReadReports([old, current], { now }).length, 2);
});

test("highlights lead with model launches and labels remain Japanese", () => {
  const picked = selectTopicHighlights(chronicleTopic(findTopic("openai")!), [report("OpenAI、資金調達を発表", { category: "industry", score: 99 }),
    report("OpenAI、GPT-9を発表。開発者向けに提供", { score: 80 })], { now });
  assert.deepEqual(picked.map((p: { kind: string }) => p.kind), ["model", "company"]);
  assert.equal(picked[0].label, "OpenAI、GPT-9を発表");
});
