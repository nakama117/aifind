import type { PresentationStatus, ResetEventInput } from "../contracts.ts";

export function jstIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? `${new Date(ms + 9 * 3600_000).toISOString().slice(0, 23)}+09:00` : null;
}

export const japanDate = (now = Date.now()) => jstIso(new Date(now))!.slice(0, 10);

export function eventStatus(event: Pick<ResetEventInput, "status" | "inProgress" | "schedule">, now: number): PresentationStatus {
  if (event.status === "confirmed") return "confirmed";
  if (event.schedule && now >= Date.parse(event.schedule.through)) return "expired_unconfirmed";
  return event.inProgress ? "in_progress" : "announced";
}

export function calendarDate(event: Pick<ResetEventInput, "occurredOn" | "confirmedAt" | "schedule" | "reportedAt">): string | null {
  return event.occurredOn ?? jstIso(event.confirmedAt ?? event.schedule?.from ?? event.reportedAt)?.slice(0, 10) ?? null;
}
