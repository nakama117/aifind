import { z } from "zod";
import { DateSchema, EventSchema } from "./schema.ts";
import type { ResetEventInput } from "../contracts.ts";

export const TRUSTED_HANDLES = ["thsottiaux", "OpenAI", "OpenAIDevs"] as const;
export function officialPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash
      && (url.hostname === "openai.com" || url.hostname.endsWith(".openai.com")) && url.hostname !== "status.openai.com";
  } catch { return false; }
}
const base = { id: z.string().regex(/^[a-z][a-z0-9-]{1,60}$/), enabled: z.boolean() };
const url = z.string().max(1500).refine(officialPageUrl, "仅支持无查询参数的 OpenAI 官方 HTTPS 页面；服务故障使用单独状态源");
export const CollectionSourceSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("official_page"), url }).strict(),
  z.object({ ...base, kind: z.literal("official_feed"), url }).strict(),
  z.object({ ...base, kind: z.literal("x_search"), handle: z.enum(TRUSTED_HANDLES) }).strict(),
]);
export type CollectionSource = z.infer<typeof CollectionSourceSchema>;
export const CollectionSettingsSchema = z.object({
  sources: z.array(CollectionSourceSchema).min(1).max(12), version: z.string().nullable(), reason: z.string().trim().min(1).max(1000),
}).strict().superRefine(({ sources }, ctx) => {
  if (new Set(sources.map((source) => source.id)).size !== sources.length) ctx.addIssue({ code: "custom", message: "来源 ID 不能重复" });
  if (new Set(sources.map((source) => source.kind === "x_search" ? source.handle : source.url)).size !== sources.length) ctx.addIssue({ code: "custom", message: "来源地址或账号不能重复" });
});
export const DEFAULT_COLLECTION_SOURCES: CollectionSource[] = [
  { id: "openai-astra-usage", kind: "official_page", enabled: true, url: "https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex" },
  { id: "openai-codex-plan", kind: "official_page", enabled: true, url: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan" },
  { id: "openai-news", kind: "official_feed", enabled: true, url: "https://openai.com/news/rss.xml" },
  { id: "tibo-x", kind: "x_search", enabled: false, handle: "thsottiaux" },
];

export const RecognitionSchema = z.object({
  statements: z.array(z.object({
    category: z.enum(["reset_event", "policy_explanation", "service_incident", "other"]),
    action: z.enum(["announce", "progress", "confirm", "amend", "withdraw"]), type: z.enum(["direct_reset", "reset_credit"]),
    targetEventId: z.string().max(100).nullable(), explicit: z.boolean(), needsReview: z.boolean(),
    titleJa: z.string().min(1).max(200), summaryJa: z.string().min(1).max(1000), scopeJa: z.string().max(500).nullable(),
    quote: z.string().min(1).max(600), timeQuote: z.string().max(600).nullable(),
    occurredOn: DateSchema.nullable(), confirmedAt: z.iso.datetime({ offset: true }).nullable(),
    schedule: EventSchema.shape.schedule, evidenceJa: z.string().max(1000).nullable(),
  }).strict()).max(12),
  reviewReason: z.string().max(1000).nullable(),
}).strict();
export type Recognition = z.infer<typeof RecognitionSchema>;
export type Statement = Recognition["statements"][number];
export interface KnownEvent extends ResetEventInput { withdrawn: boolean; managedBy: "manual" | "automatic" }
export interface SourceContext { id: string; author: string; url: string; text: string; publishedAt: string | null; relation: "reply" | "quote" }
export interface SourceDocument { key: string; sourceKey: string; url: string; author: string; text: string; publishedAt: string | null; observedAt: string; context: SourceContext[] }
export interface StoredDocument extends SourceDocument {
  id: string; status: "pending" | "processed" | "review" | "failed" | "dismissed";
  recognition: Recognition | null; receiptId: number | null; appliedIds: string[]; reviewReason: string | null; version: string;
}
export interface SourceState {
  lastAttemptAt?: string; lastSuccessAt?: string; status?: "ok" | "failed" | "missing_credentials";
  failureCode?: string; cursor?: { lastId: string | null; backlog: Array<{ query: string; next: string }> };
  backlog?: number; dropped?: number;
}
export const collectionEnabled = () => process.env.CODEX_MONITOR_ENABLED === "true" && process.env.COLLECT_ENABLED === "true";
