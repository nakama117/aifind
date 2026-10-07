export type EventType = "direct_reset" | "reset_credit";
export type PresentationStatus = "announced" | "in_progress" | "confirmed" | "expired_unconfirmed";

export interface AnnouncementSource {
  id: string;
  author: string;
  publishedAt: string | null;
  verifiedAt?: string | null;
  url: string;
  textJa: string;
  originalExcerpt: string;
  stage: "announcement" | "progress" | "confirmation" | "context";
}

export interface ResetSchedule {
  precision: "exact" | "window" | "day";
  from: string;
  through: string;
  labelJa: string;
}

export interface ResetEventInput {
  id: string;
  type: EventType;
  titleJa: string;
  summaryJa: string;
  scopeJa: string | null;
  status: "announced" | "confirmed";
  inProgress: boolean;
  reportedAt: string | null;
  schedule: ResetSchedule | null;
  confirmedAt: string | null;
  occurredOn: string | null;
  occurredOnTimezone?: "Asia/Tokyo" | "unspecified";
  confirmationBasis: "source_post" | "receipt_review" | null;
  evidenceJa: string | null;
  sources: AnnouncementSource[];
}

export interface ResetEvent extends ResetEventInput {
  createdAt: string;
  updatedAt: string;
  presentation: { status: PresentationStatus; scopeKnown: boolean };
  calendarDate: string | null;
}

export interface OfficialIncident {
  id: string;
  title: string;
  status: string;
  publishedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  url: string;
}

export interface MonitorHealth {
  mode: "manual_announcements" | "configured_sources";
  status: "unknown" | "partial";
  lastReviewedAt: string | null;
  lastStatusAttemptAt: string | null;
  lastStatusSuccessAt: string | null;
  statusFetch: "never" | "ok" | "failed";
  collectionEnabled: boolean;
  announcementEnabled: boolean;
  lastAnnouncementAttemptAt: string | null;
  lastAnnouncementSuccessAt: string | null;
  lastAnnouncementProcessedAt: string | null;
  lastAnnouncementCompleteAt: string | null;
  announcementFetch: "never" | "ok" | "failed" | "missing_credentials";
  pendingDocuments: number;
  reviewDocuments: number;
  noticeJa: string;
}

export interface MonitorSnapshot {
  schemaVersion: 2;
  timezone: "Asia/Tokyo";
  today: string;
  checkedAt: string | null;
  historyFrom: string | null;
  version: string;
  count: number;
  events: ResetEvent[];
  activities: Array<AnnouncementSource & { eventIds: string[] }>;
  monitor: MonitorHealth;
  incidents: OfficialIncident[];
  current: ResetEvent | null;
  lastLanded: ResetEvent | null;
  stats: { resets90: number; credits90: number; medianIntervalDays: number | null; lastResetDate: string | null };
  calendar: Array<{ date: string; eventId: string; type: EventType; state: "confirmed" | "pending"; label: string }>;
  confirmMinutes: number[];
}

export interface MonitorPage extends MonitorSnapshot { selectedDate: string; dayEvents: ResetEvent[] }
export interface AdminEvent { event: ResetEventInput; withdrawn: boolean; version: string; createdAt: string; managedBy: "manual" | "automatic" }
export type AnnouncementSourceConfig = { id: string; enabled: boolean } & ({ kind: "official_page" | "official_feed"; url: string } | { kind: "x_search"; handle: "thsottiaux" | "OpenAI" | "OpenAIDevs" });
export interface AdminCollection {
  settings: { sources: AnnouncementSourceConfig[]; version: string | null };
  enabled: boolean; modelEnabled: boolean; socialdataConfigured: boolean;
  sources: Array<{ id: string; kind: string; enabled: boolean; status: string; lastAttemptAt: string | null; lastSuccessAt: string | null; failureCode: string | null; backlog: number; dropped: number }>;
  documents: Array<{ id: string; sourceKey: string; url: string; author: string; text: string; publishedAt: string | null; observedAt: string; status: string; recognition: unknown; receiptId: number | null; appliedIds: string[]; reviewReason: string | null; version: string }>;
}
export interface AdminMonitor { events: AdminEvent[]; monitor: MonitorHealth; incidents: OfficialIncident[]; collection: AdminCollection }

export const STATUS_JA: Record<PresentationStatus, string> = {
  announced: "実施予定", in_progress: "実施中", confirmed: "確認済み", expired_unconfirmed: "予定時刻経過・未確認",
};
export const TYPE_JA: Record<EventType, string> = { direct_reset: "利用枠リセット", reset_credit: "保存型リセット" };
