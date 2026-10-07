import { tokyoDate, tokyoTime, tokyoWeekday } from "@aihot/contracts/time";
import type { FeedItemSummary } from "@aihot/contracts/site";

/** "9月28日" of a calendar date (YYYY-MM-DD). */
export function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

/** "周六" of a calendar date (YYYY-MM-DD). */
export function weekdayShort(date: string): string {
  return tokyoWeekday(date).replace("曜日", "曜");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "たった今";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}日前`;
  return tokyoDate(iso);
}

export function fullDateTime(iso: string): string {
  return `${tokyoDate(iso)} ${tokyoTime(iso)}`;
}

/** Legacy news material has no source-date precision. Show its day rather than invent hours. */
export function publicationTime(item: { channel: "news" | "x"; publishedAt: string | null }, fallback: string) {
  const iso = item.publishedAt ?? fallback;
  const precise = item.channel === "x" || !item.publishedAt;
  return {
    dateTime: precise ? iso : tokyoDate(iso),
    text: precise ? fullDateTime(iso) : tokyoDate(iso),
    label: item.publishedAt ? (precise ? "公開日時" : "公開日") : "掲載日時",
    precise,
  };
}

/** Backfills use the source date for sorting; a group's earlier anchor can also be approximate. */
export function approximateTimeline(item: Pick<FeedItemSummary, "channel" | "publishedAt" | "timelineAt">, at = item.timelineAt): boolean {
  return item.channel === "news" && (at === item.publishedAt || at !== item.timelineAt);
}

/** "9月24日 10:51" (Tokyo), for lists that span days. */
export function monthDayTime(iso: string): string {
  return `${monthDay(tokyoDate(iso))} ${tokyoTime(iso)}`;
}

export function sourceInitial(name: string): string {
  const s = name.replace(/^[^\p{L}\p{N}]+/u, "");
  return (s[0] ?? "A").toUpperCase();
}
