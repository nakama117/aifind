import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { tokyoDate, tokyoMidnight, tokyoTime, tokyoWeekday, isoWeekLabel } from "@aihot/contracts/time";
import { looksJapaneseCopy, needsShortTweetTranslation } from "@aihot/backend/editorial/writing";
import { isJapaneseBody } from "@aihot/backend/publication/items";
import { closeDb } from "@aihot/backend/db";
import { dueDaily, dueWeekly, dueMonthly } from "@aihot/backend/reports/compose";

after(closeDb);
test("reports become due at their exact Tokyo publication times", () => {
  assert.equal(dueDaily(new Date("2026-10-04T22:59:59Z")), "2026-10-04");
  assert.equal(dueDaily(new Date("2026-10-04T23:00:00Z")), "2026-10-05");
  assert.equal(dueWeekly(new Date("2026-10-05T00:59:59Z")), "2026-W39");
  assert.equal(dueWeekly(new Date("2026-10-05T01:00:00Z")), "2026-W40");
  assert.equal(dueMonthly(new Date("2026-11-01T01:29:59Z")), "2026-09");
  assert.equal(dueMonthly(new Date("2026-11-01T01:30:00Z")), "2026-10");
});
test("the publication calendar changes day, month and year at midnight in Tokyo", () => {
  assert.equal(tokyoDate("2026-12-31T14:59:59Z"), "2026-12-31");
  assert.equal(tokyoDate("2026-12-31T15:00:00Z"), "2027-01-01");
  assert.equal(tokyoTime("2026-12-31T15:00:00Z"), "00:00");
  assert.equal(tokyoMidnight("2027-01-01").toISOString(), "2026-12-31T15:00:00.000Z");
  assert.equal(tokyoWeekday("2027-01-01"), "金曜日");
  assert.equal(isoWeekLabel(tokyoDate("2027-01-03T15:00:00Z")), "2027-W01");
});
test("Japanese copy accepts kana and kanji headlines without accepting English or Korean prose", () => {
  assert.equal(looksJapaneseCopy("Sakana AIが新しいモデルを公開"), true);
  assert.equal(looksJapaneseCopy("新型言語模型公開"), true, "kanji-only headlines are ambiguous, not invalid");
  assert.equal(looksJapaneseCopy("かなだけでもよめます"), true);
  assert.equal(looksJapaneseCopy("A model has been released"), false);
  assert.equal(looksJapaneseCopy("새로운 모델을 공개"), false);
  assert.equal(needsShortTweetTranslation("新しいモデルを公開しました。日本語でも利用できます。"), false);
  assert.equal(needsShortTweetTranslation("我们发布了新的语言模型，可以免费使用。"), true, "shared Han text is not sufficient evidence for verbatim Japanese publication");
});
test("original-language metadata wins over shared Chinese/Japanese characters", () => {
  assert.equal(isJapaneseBody({ language: "ja", body_text: "新型言語模型公開" }), true);
  assert.equal(isJapaneseBody({ language: "ja-JP", body_text: "API" }), true);
  assert.equal(isJapaneseBody({ language: "zh", body_text: "モデル公開" }), false);
  assert.equal(isJapaneseBody({ language: null, body_text: "新型言語模型公開" }), false);
  assert.equal(isJapaneseBody({ language: null, body_text: "モデルを公開しました" }), true);
});
