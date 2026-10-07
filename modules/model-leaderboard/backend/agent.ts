import { LEADERBOARD_BOARD_LABELS, type LeaderboardBoardKey } from "../taxonomy.ts";
import { loadBoard, NoLeaderboardRun } from "./read.ts";

export async function leaderboardAnswer(board: LeaderboardBoardKey = "overall") {
  try {
    const result = await loadBoard(board);
    if (!result) return {text:"指定されたランキングはありません。", structured:{available:false}};
    const text = [
      `# ${SITE.name} モデルランキング — ${LEADERBOARD_BOARD_LABELS[board]}`,
      `集計日時 (UTC): ${result.run.generatedAt}`,
      `評価方法: ${result.run.methodologyVersion}`,
      "スコアは相対指標です。正答率や将来の性能を表すものではありません。",
      "| 順位 | モデル | スコア | 出典数 | 証拠のカバー率 |",
      "| --- | --- | --- | --- | --- |",
      ...result.entries.map(e=>`| ${e.rank} | ${e.model.name.replaceAll("|","\\|")} | ${e.score?.toFixed(1) ?? "—"} | ${e.sourceCount} | ${(100*e.coverage).toFixed(1)}% |`),
      "評価方法と出典: /leaderboard/rules · /leaderboard/sources",
    ].join("\n\n");
    return {text, structured:result as unknown as Record<string,unknown>};
  } catch(error) {
    if (!(error instanceof NoLeaderboardRun)) throw error;
    return {text:"公開に必要な評価データを準備中です。未確認の順位は掲載しません。評価方法と出典は /leaderboard/rules と /leaderboard/sources を参照してください。", structured:{available:false,code:"leaderboard_pending"}};
  }
}
import { SITE } from "@aihot/site";
