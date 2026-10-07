// All public monitor exits share this projection. Withdrawn events and their source activity leave it together.
import { sql } from "@aihot/backend/db";
import { sha256, stableJson } from "@aihot/backend/lib/ids";
import type { MonitorHealth, MonitorPage, MonitorSnapshot, OfficialIncident, ResetEvent, ResetEventInput } from "../contracts.ts";
import { TYPE_JA } from "../contracts.ts";
import { calendarDate, eventStatus, japanDate, jstIso } from "./presentation.ts";
import { DEFAULT_COLLECTION_SOURCES, type CollectionSource, type SourceState } from "./collection-schema.ts";

interface EventRow { body: ResetEventInput; created_at: Date; updated_at: Date }
interface State extends SourceState { lastReviewedAt?: string; lastProcessedAt?: string; lastCompleteAt?: string; incidents?: OfficialIncident[]; sources?: CollectionSource[] }

export async function loadMonitorSnapshot(now = Date.now()): Promise<MonitorSnapshot> {
  const { rows, states, documents } = await sql.begin("isolation level repeatable read read only", async (tx) => ({
    rows: await tx<EventRow[]>`SELECT body, created_at, updated_at FROM codex_monitor_events WHERE NOT withdrawn ORDER BY updated_at DESC, id ASC`,
    states: await tx<{ key: string; value: State }[]>`SELECT key, value FROM codex_monitor_state`,
    documents: await tx<{ source_key: string; pending: number; review: number }[]>`SELECT source_key, count(*) FILTER (WHERE status IN ('pending','failed'))::int AS pending, count(*) FILTER (WHERE status='review')::int AS review FROM codex_monitor_documents WHERE is_current GROUP BY source_key`,
  }));
  const state = new Map(states.map((s) => [s.key, s.value]));
  const review = state.get("review");
  const status = state.get("official-status");
  const enabledSources = (state.get("collection-settings")?.sources ?? DEFAULT_COLLECTION_SOURCES).filter((source) => source.enabled);
  const announcementStates = enabledSources.map((source) => state.get(`announcement:${source.id}`));
  const reviewed = state.get("announcement-review");
  const last = (field: "lastAttemptAt" | "lastSuccessAt") => announcementStates.flatMap((source) => source?.[field] ? [source[field]!] : []).sort().at(-1);
  const announcementEnabled = process.env.CODEX_MONITOR_ENABLED === "true" && process.env.COLLECT_ENABLED === "true";
  const hasAnnouncementAttempt = !!last("lastAttemptAt");
  const events: ResetEvent[] = rows.map(({ body: e, created_at, updated_at }) => ({
    id: e.id, type: e.type, titleJa: e.titleJa, summaryJa: e.summaryJa, scopeJa: e.scopeJa,
    status: e.status, inProgress: e.inProgress, occurredOn: e.occurredOn, occurredOnTimezone: e.occurredOn ? e.occurredOnTimezone ?? "Asia/Tokyo" : undefined, confirmationBasis: e.confirmationBasis, evidenceJa: e.evidenceJa,
    reportedAt: jstIso(e.reportedAt), confirmedAt: jstIso(e.confirmedAt),
    schedule: e.schedule ? { precision: e.schedule.precision, labelJa: e.schedule.labelJa, from: jstIso(e.schedule.from)!, through: jstIso(e.schedule.through)! } : null,
    sources: e.sources.map((s) => ({ id: s.id, author: s.author, url: s.url, textJa: s.textJa, originalExcerpt: s.originalExcerpt, stage: s.stage, publishedAt: jstIso(s.publishedAt), verifiedAt: jstIso(s.verifiedAt) })),
    createdAt: jstIso(created_at)!, updatedAt: jstIso(updated_at)!,
    presentation: { status: eventStatus(e, now), scopeKnown: !!e.scopeJa }, calendarDate: calendarDate(e),
  }));
  const monitor: MonitorHealth = {
    mode: announcementEnabled || hasAnnouncementAttempt ? "configured_sources" : "manual_announcements", status: review?.lastReviewedAt || reviewed?.lastProcessedAt ? "partial" : "unknown", lastReviewedAt: jstIso(review?.lastReviewedAt),
    lastStatusAttemptAt: jstIso(status?.lastAttemptAt), lastStatusSuccessAt: jstIso(status?.lastSuccessAt), statusFetch: status?.status === "ok" ? "ok" : status?.status === "failed" ? "failed" : "never",
    collectionEnabled: process.env.COLLECT_ENABLED === "true",
    announcementEnabled, lastAnnouncementAttemptAt: jstIso(last("lastAttemptAt")), lastAnnouncementSuccessAt: jstIso(last("lastSuccessAt")),
    lastAnnouncementProcessedAt: jstIso(reviewed?.lastProcessedAt), lastAnnouncementCompleteAt: jstIso(reviewed?.lastCompleteAt),
    announcementFetch: announcementStates.some((source) => source?.status === "failed") ? "failed" : announcementStates.some((source) => source?.status === "missing_credentials") ? "missing_credentials" : enabledSources.length > 0 && announcementStates.every((source) => source?.status === "ok") ? "ok" : "never",
    pendingDocuments: documents.filter((document) => enabledSources.some((source) => source.id === document.source_key)).reduce((sum, document) => sum + document.pending, 0),
    reviewDocuments: documents.filter((document) => enabledSources.some((source) => source.id === document.source_key)).reduce((sum, document) => sum + document.review, 0),
    noticeJa: `${announcementEnabled ? "設定された公式情報源の告知を定期収集し、明示的なリセット声明を確認しています。" : "告知の自動収集は停止中です。収録済みの記録だけを表示しています。"}全投稿・過去の全履歴を網羅するものではありません。サービス障害の取得状況とリセット告知の確認状況は別です。個人アカウントの残り利用枠は取得しません。`,
  };
  const incidents = (status?.incidents ?? []).map((i) => ({ id: i.id, title: i.title, status: i.status, url: i.url, publishedAt: jstIso(i.publishedAt)!, updatedAt: jstIso(i.updatedAt)!, resolvedAt: jstIso(i.resolvedAt) }));
  const today = japanDate(now);
  const landed = events.filter((e) => e.status === "confirmed");
  const recent = landed.filter((e) => (e.confirmedAt || e.occurredOn) && e.calendarDate && e.calendarDate <= today && Date.parse(`${e.calendarDate}T00:00:00+09:00`) > now - 90 * 86400_000);
  // Date-only evidence cannot establish an exact interval; never manufacture a noon timestamp.
  const rounds = recent.filter((e) => e.type === "direct_reset" && e.confirmedAt).map((e) => Date.parse(e.confirmedAt!)).filter((ms) => ms <= now).sort((a, b) => a - b);
  const intervals = rounds.slice(1).map((ms, i) => (ms - rounds[i]) / 86400_000).sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  const median = intervals.length ? Math.round((intervals.length % 2 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2) * 10) / 10 : null;
  const activity = new Map<string, MonitorSnapshot["activities"][number]>();
  for (const event of events) for (const source of event.sources) {
    const old = activity.get(source.id);
    activity.set(source.id, { ...source, eventIds: [...(old?.eventIds ?? []), event.id] });
  }
  return {
    schemaVersion: 2, timezone: "Asia/Tokyo", today, checkedAt: monitor.lastReviewedAt,
    historyFrom: events.map((e) => e.reportedAt).filter((at): at is string => at !== null).sort()[0] ?? null,
    version: sha256(stableJson({ events, incidents, monitor, today })).slice(0, 20),
    count: events.length, events, activities: [...activity.values()].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")), monitor, incidents,
    current: events.find((e) => e.status === "announced") ?? null,
    lastLanded: landed.sort((a, b) => (b.confirmedAt ?? b.occurredOn ?? "").localeCompare(a.confirmedAt ?? a.occurredOn ?? ""))[0] ?? null,
    stats: { resets90: recent.filter((e) => e.type === "direct_reset").length, credits90: recent.filter((e) => e.type === "reset_credit").length, medianIntervalDays: median, lastResetDate: landed.filter((e) => e.type === "direct_reset" && (e.confirmedAt || e.occurredOn)).map((e) => e.calendarDate).filter((date): date is string => date !== null).sort().at(-1) ?? null },
    calendar: events.flatMap((e) => e.calendarDate ? [{ date: e.calendarDate, eventId: e.id, type: e.type, state: e.status === "confirmed" ? "confirmed" as const : "pending" as const, label: TYPE_JA[e.type] }] : []),
    confirmMinutes: landed.filter((e) => e.type === "direct_reset" && e.confirmedAt && e.confirmationBasis === "source_post").map((e) => Number(e.confirmedAt!.slice(11, 13)) * 60 + Number(e.confirmedAt!.slice(14, 16))),
  };
}

export async function loadMonitorPage(date?: string, now = Date.now()): Promise<MonitorPage> {
  const snapshot = await loadMonitorSnapshot(now);
  const selectedDate = date ?? snapshot.today;
  return { ...snapshot, selectedDate, dayEvents: snapshot.events.filter((e) => e.calendarDate === selectedDate) };
}

export async function loadMonitorVersion(now = Date.now()) {
  const { version, today, checkedAt } = await loadMonitorSnapshot(now);
  return { version, today, checkedAt };
}

export async function loadRecentMonitor(now = Date.now()) {
  const snapshot = await loadMonitorSnapshot(now);
  const from = now - 7 * 86400_000;
  const events = snapshot.events.filter((e) => e.status === "announced" || Date.parse(e.updatedAt) >= from);
  const ids = new Set(events.map((e) => e.id));
  return { ...snapshot, count: events.length, events, activities: snapshot.activities.filter((a) => a.eventIds.some((id) => ids.has(id))) };
}
