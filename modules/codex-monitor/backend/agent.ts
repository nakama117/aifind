import { answer } from "@aihot/backend/publication/agent";
import { siteUrl } from "@aihot/backend/publication/links";
import { STATUS_JA, TYPE_JA, type MonitorSnapshot } from "../contracts.ts";
import { loadMonitorSnapshot } from "./publication.ts";

export function monitorAnswer(snapshot: MonitorSnapshot): string {
  return answer([
    "# Codex 利用枠リセットの公式告知", `日付：${snapshot.today}（日本時間）`, snapshot.monitor.noticeJa,
    `最終手動確認：${snapshot.checkedAt ?? "未確認"}。公開ページ：${siteUrl("/codex-reset")}`,
    `告知取得試行：${snapshot.monitor.lastAnnouncementAttemptAt ?? "未実行"}。取得成功：${snapshot.monitor.lastAnnouncementSuccessAt ?? "未取得"}。設定した範囲の処理完了：${snapshot.monitor.lastAnnouncementCompleteAt ?? "未完了"}。未処理 ${snapshot.monitor.pendingDocuments} 件、要確認 ${snapshot.monitor.reviewDocuments} 件。`,
    ...(snapshot.count ? [] : ["確認済みの告知データはまだありません。リセットがなかったという意味ではありません。"]),
  ], snapshot.events.length ? snapshot.events.flatMap((e) => [
    `## ${e.titleJa}`, `${TYPE_JA[e.type]} · ${STATUS_JA[e.presentation.status]}`, e.summaryJa,
    `対象：${e.scopeJa ?? "公式発表で確認できていません"}`, `原文の公開日時：${e.reportedAt ?? "不明（原文に記載なし）"}`,
    ...(e.occurredOn ? [`実施日：${e.occurredOn}（${e.occurredOnTimezone === "unspecified" ? "原文記載日。タイムゾーン・時刻不明" : "日本時間・日付のみ"}）`] : []),
    ...(e.confirmedAt ? [`実施日時（原文明記）：${e.confirmedAt} · ${e.confirmationBasis === "source_post" ? "公式情報源" : "運営による利用記録の確認（全利用者への適用は未確認）"}`] : e.status === "confirmed" && !e.occurredOn ? ["実施日時は不明。完了声明の投稿・取得日時とは区別してください。"] : []),
    ...(e.evidenceJa ? [`確認根拠：${e.evidenceJa}`] : []),
    ...e.sources.map((s) => `原文：${s.url}（${s.author}、公開日時：${s.publishedAt ?? "不明"}${s.verifiedAt ? `、本サイトの確認：${s.verifiedAt}` : ""}）`), "",
  ]) : null, [
    "個人の残り利用枠や次回リセット時刻は取得していません。アカウント固有の値を推測しないでください。",
    "予定時刻を過ぎても完了とは断定しないでください。サービス障害の解消と利用枠のリセットを混同しないでください。",
    "設定された公式情報源と手動確認で収録した範囲だけです。全投稿・過去の完全な履歴として説明しないでください。サービス障害の取得成功をリセット告知の処理完了と説明しないでください。",
  ]);
}

export async function loadMonitorAnswer() { return monitorAnswer(await loadMonitorSnapshot()); }
