import { useEffect, useState } from "react";
import { Form, Link, useLoaderData, useRevalidator } from "react-router";
import { loadOr404 } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { STATUS_JA, TYPE_JA, type MonitorPage, type ResetEvent } from "../contracts";
import "./style.css";

export const handle: Screen = { tab: "me", name: "Codex リセット" };
export async function loader({ request }: { request: Request }) {
  const date = new URL(request.url).searchParams.get("date");
  return loadOr404<MonitorPage>(`/api/site/codex-reset${date ? `?date=${encodeURIComponent(date)}` : ""}`, { signal: request.signal });
}
export const headers = () => ({ "Cache-Control": "no-cache" });
export const meta = () => pageMeta({ title: "Codex リセットの公式告知", description: "Codex の利用枠リセットと保存型リセットの告知、確認根拠、履歴を確認。正確な時刻は日本時間、時刻不明の記録は原文の日付で表示します。", path: "/codex-reset" });
const time = (at: string | null) => at ? `${at.slice(0, 10)} ${at.slice(11, 16)} JST` : "未確認";

function EventCard({ event }: { event: ResetEvent }) {
  return <article className="cm-card cm-event" id={`event-${event.id}`}>
    <div className="cm-row"><span className={`cm-badge ${event.status === "confirmed" ? "cm-confirmed" : ""}`}>{STATUS_JA[event.presentation.status]}</span><span className="cm-muted">{TYPE_JA[event.type]}</span></div>
    <h3>{event.titleJa}</h3><p>{event.summaryJa}</p>
    <dl className="cm-facts">
      <div><dt>対象</dt><dd>{event.scopeJa ?? "公式情報では対象範囲が明示されていません"}</dd></div>
      <div><dt>原文公開日時</dt><dd>{event.reportedAt ? time(event.reportedAt) : "不明（原文に日時の記載なし）"}</dd></div>
      {event.schedule && <div><dt>予定</dt><dd>{event.schedule.labelJa}<br /><span className="cm-muted">{time(event.schedule.from)} ～ {time(event.schedule.through)}</span></dd></div>}
      {event.status === "confirmed" && <>
        <div><dt>{event.confirmedAt ? "実施日時（原文明記）" : "実施日"}</dt><dd>{event.confirmedAt ? time(event.confirmedAt) : event.occurredOn ? `${event.occurredOn}（${event.occurredOnTimezone === "unspecified" ? "原文記載日・時刻とタイムゾーンは不明" : "日本時間・日付のみ"}）` : "不明（完了の声明はありますが、実施日時は明記されていません）"}</dd></div>
        <div><dt>確認方法</dt><dd>{event.confirmationBasis === "source_post" ? "公式情報源による完了確認" : "運営による利用記録の確認（全利用者への適用は未確認）"}</dd></div>
        <div><dt>確認根拠</dt><dd>{event.evidenceJa}</dd></div>
      </>}
    </dl>
    <details className="cm-sources" open><summary>情報源と経緯 · {event.sources.length} 件</summary>
      {event.sources.map((source) => <div key={source.id} className="cm-source">
        <a href={source.url} target="_blank" rel="noreferrer">{source.author} · 原文を読む ↗</a><div className="cm-muted">原文公開日時：{source.publishedAt ? time(source.publishedAt) : "不明"} · {{ announcement: "告知", progress: "進行状況", confirmation: "完了確認", context: "関連情報" }[source.stage]}</div>
        {source.verifiedAt && <div className="cm-muted">本サイトが原文を確認した日時：{time(source.verifiedAt)}（原文公開・実施時刻ではありません）</div>}
        <p>{source.textJa}</p>{source.originalExcerpt && <details><summary>原文抜粋</summary><blockquote>{source.originalExcerpt}</blockquote></details>}
      </div>)}
    </details>
  </article>;
}

function Calendar({ data }: { data: MonitorPage }) {
  const [month, setMonth] = useState(data.selectedDate.slice(0, 7));
  useEffect(() => setMonth(data.selectedDate.slice(0, 7)), [data.selectedDate]);
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const changeMonth = (by: number) => setMonth(new Date(Date.UTC(year, number - 1 + by, 1)).toISOString().slice(0, 7));
  return <section className="cm-card" aria-label="日本時間のリセット履歴カレンダー">
    <div className="cm-row cm-between"><button type="button" className="cm-button" onClick={() => changeMonth(-1)} aria-label="前の月">←</button><h2>{year} 年 {number} 月</h2><button type="button" className="cm-button" onClick={() => changeMonth(1)} aria-label="次の月">→</button></div>
    <div className="cm-calendar">{["日", "月", "火", "水", "木", "金", "土"].map((d) => <span key={d} className="cm-weekday">{d}</span>)}
      {Array.from({ length: first.getUTCDay() }, (_, i) => <span key={`empty-${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const day = `${month}-${String(i + 1).padStart(2, "0")}`;
        const marks = data.calendar.filter((m) => m.date === day);
        return <Link key={day} to={`?date=${day}`} preventScrollReset className={`cm-day ${day === data.selectedDate ? "cm-selected" : ""} ${day === data.today ? "cm-today" : ""}`} aria-label={`${day}、告知 ${marks.length} 件`} aria-current={day === data.selectedDate ? "date" : undefined}>
          <span>{i + 1}</span><span className="cm-dots">{marks.slice(0, 3).map((m) => <i key={m.eventId} className={m.state === "confirmed" ? "cm-dot-confirmed" : "cm-dot-pending"} />)}</span>
        </Link>;
      })}
    </div>
    <div className="cm-row cm-muted cm-legend"><span>● 確認済み</span><span>○ 告知・未確認</span><Link to={`?date=${data.today}`} preventScrollReset>今日</Link></div>
    {data.events.some((event) => event.occurredOnTimezone === "unspecified") && <p className="cm-muted">タイムゾーンが不明な過去記録は、JST に変換せず原文の日付に表示しています。各記録の「実施日」を確認してください。</p>}
    <p className="cm-muted">実施日と予定が不明でも公開日が分かる告知は、公開日の位置に表示します。確認帖の公開日は実際の反映日とは限りません。</p>
    <Form method="get" className="cm-row cm-date-form"><label htmlFor="cm-date">日付を指定</label><input id="cm-date" name="date" type="date" defaultValue={data.selectedDate} key={data.selectedDate} /><button className="cm-button" type="submit">表示</button></Form>
  </section>;
}

const INCIDENT_STATUS: Record<string, string> = { investigating: "調査中", identified: "原因特定", monitoring: "復旧を確認中", resolved: "復旧済み", postmortem: "事後報告" };

export default function CodexResetPage() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [pollFailed, setPollFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/site/codex-reset/version", { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error("version unavailable");
        const current = await response.json() as { version: string; today: string };
        setPollFailed(false);
        if (current.version !== data.version || current.today !== data.today) void revalidator.revalidate();
      } catch { if (!abort.signal.aborted) setPollFailed(true); }
    };
    const timer = setInterval(() => void check(), 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { abort.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [data.version, data.today, revalidator]);
  const hours = Array.from({ length: 24 }, (_, hour) => data.confirmMinutes.filter((minute) => Math.floor(minute / 60) === hour).length);
  const max = Math.max(1, ...hours);
  return <div className="codex-monitor">
    <header className="cm-heading"><div className="cm-kicker">CODEX · 公式告知の記録</div><h1>Codex リセット</h1><p>利用枠リセットと保存型リセットの公式告知・履歴を確認できます。</p></header>
    <div className="cm-notice"><strong>{data.monitor.status === "unknown" ? "告知データは未確認です" : "確認できた範囲の告知を表示しています"}</strong><p>{data.monitor.noticeJa}</p><div className="cm-muted">最終手動確認：{time(data.monitor.lastReviewedAt)}</div><dl className="cm-facts">
      <div><dt>告知の取得試行</dt><dd>{time(data.monitor.lastAnnouncementAttemptAt)}</dd></div><div><dt>告知の取得成功</dt><dd>{time(data.monitor.lastAnnouncementSuccessAt)}</dd></div>
      <div><dt>声明の解析</dt><dd>{time(data.monitor.lastAnnouncementProcessedAt)}</dd></div><div><dt>設定範囲の処理完了</dt><dd>{time(data.monitor.lastAnnouncementCompleteAt)}（未処理・要確認がない時点）</dd></div>
    </dl><p className="cm-muted">未処理 {data.monitor.pendingDocuments} 件 · 要確認 {data.monitor.reviewDocuments} 件 · {data.monitor.announcementEnabled ? "告知収集は10分間隔" : "告知の自動収集は停止中"}{data.monitor.announcementFetch === "failed" ? " · 最後の取得に失敗" : data.monitor.announcementFetch === "missing_credentials" ? " · 一部の情報源は未接続" : data.monitor.announcementFetch === "never" ? " · 未取得の情報源があります" : ""}</p></div>
    {pollFailed && <p role="status" className="cm-warning">更新の確認に失敗しました。表示中の記録は最新とは限りません。</p>}
    <div className="cm-stats" aria-label="収録済みの確定イベントの統計">
      {[ ["過去90日・確認済みリセット", data.stats.resets90], ["過去90日・確認済み保存型リセット", data.stats.credits90], ["リセット間隔の中央値", data.stats.medianIntervalDays === null ? "—" : `${data.stats.medianIntervalDays} 日`], ["最後の確認済みリセット", data.stats.lastResetDate ?? "未確認"] ].map(([label, value]) => <div key={label} className="cm-card"><div className="cm-muted">{label}</div><strong>{value}</strong></div>)}
    </div>
    <p className="cm-muted cm-stat-note">収録した確認済みイベントのみの集計です。実施日が不明な記録は90日集計に含めません。日付しか分からない記録は原文の日付で数え、正確な実施時刻のない記録は間隔と時間帯の集計から除いています。確認帖の投稿時刻を実際の反映時刻とは扱いません。</p>
    {data.current && <section className="cm-current"><h2>現在の告知</h2><EventCard event={data.current} /></section>}
    {!data.current && data.lastLanded && <section className="cm-current"><h2>最後に収録した確認済みイベント</h2><EventCard event={data.lastLanded} /></section>}
    <div className="cm-main"><aside><Calendar data={data} /><section className="cm-card cm-method"><h2>読み方</h2><p>「実施予定」「実施中」「確認済み」を分けています。予定時刻の経過だけでは完了を確認できません。</p><p>公開記録がない日は、リセットがなかったと断定できません。対象プランや製品は各告知の原文で確認してください。</p><a href="https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan" target="_blank" rel="noreferrer">Codex の利用枠について（公式）↗</a></section></aside>
      <section><div className="cm-row cm-between"><h2>{data.selectedDate} の記録</h2><span className="cm-muted">JST / タイムゾーン不明の記録は原文の日付</span></div>
        {data.dayEvents.length ? data.dayEvents.map((event) => <EventCard key={event.id} event={event} />) : <div className="cm-card cm-empty"><h3>この日の公開記録はありません</h3><p>公式告知を確認して収録するまで、履歴や完了状態は表示しません。</p></div>}
        {data.events.length > 0 && <details className="cm-card"><summary>収録済みの告知一覧 · {data.events.length} 件</summary><ul className="cm-history">{data.events.map((e) => <li key={e.id}>{e.calendarDate ? <Link to={`?date=${e.calendarDate}`} preventScrollReset>{e.calendarDate} · {e.titleJa}</Link> : <a href={`#event-${e.id}`}>日付不明 · {e.titleJa}</a>}<span className="cm-muted">{STATUS_JA[e.presentation.status]}</span></li>)}</ul></details>}
        {data.events.some((event) => !event.calendarDate && event.id !== (data.current ?? data.lastLanded)?.id) && <section><h2>日付不明の告知</h2><p className="cm-muted">確認・取得した日をイベントの日付としてカレンダーには入れません。</p>{data.events.filter((event) => !event.calendarDate && event.id !== (data.current ?? data.lastLanded)?.id).map((event) => <EventCard key={event.id} event={event} />)}</section>}
      </section>
    </div>
    <section className="cm-card cm-status"><h2>OpenAI 公式サービス状態 · Codex 関連</h2><p>サービス障害と利用枠リセットは別の情報です。復旧済みの表示は、利用枠のリセット完了を意味しません。</p><p className="cm-muted">最終取得成功：{time(data.monitor.lastStatusSuccessAt)} · {data.monitor.collectionEnabled ? "取得は10分間隔" : "自動取得は停止中"}{data.monitor.statusFetch === "failed" ? " · 最後の取得に失敗（保存済み情報）" : ""}</p>
      {data.incidents.length ? <ul className="cm-history">{data.incidents.map((i) => <li key={i.id}><div><span className="cm-badge">{INCIDENT_STATUS[i.status] ?? "公式ページで確認"}</span> <a href={i.url} target="_blank" rel="noreferrer">{i.title} ↗</a><div className="cm-muted">原文の見出し · 更新 {time(i.updatedAt)}</div></div></li>)}</ul> : <p>{data.monitor.lastStatusSuccessAt ? "取得した範囲に Codex 関連の障害情報はありません。" : "公式サービス状態はまだ取得していません。"}</p>}
      <a href="https://status.openai.com/" target="_blank" rel="noreferrer">OpenAI Status を開く ↗</a>
    </section>
    <section className="cm-card"><h2>原文に明記された実施時間帯</h2><p className="cm-muted">実施時刻が明記された公式完了記録 {data.confirmMinutes.length} 件を日本時間で集計。確認帖の投稿時刻は代用しません。個人アカウントの次回リセット予測には使えません。</p>{data.confirmMinutes.length ? <div className="cm-hours">{hours.map((n, h) => <div key={h} title={`${h} 時：${n} 件`}><div className="cm-bar-area"><span style={{ height: `${n / max * 100}%` }} /></div><small>{h}</small></div>)}</div> : <p>集計できる公式完了記録はありません。</p>}</section>
    <footer className="cm-muted"><Link to="/agent">Agent 連携</Link> · <a href="/api/v1/codex-resets">公開 JSON</a> · 時刻は日本時間（JST）。タイムゾーン不明の日付は原文どおりに表示します。</footer>
  </div>;
}
