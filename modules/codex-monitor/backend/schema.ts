import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}, "日期不存在");

export function officialSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (url.hostname === "openai.com" || url.hostname.endsWith(".openai.com")) return true;
    return ["x.com", "twitter.com"].includes(url.hostname) && /^\/(OpenAI|OpenAIDevs|thsottiaux)\/status\/\d+\/?$/i.test(url.pathname);
  } catch { return false; }
}

const source = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), author: z.string().min(1).max(100), publishedAt: instant.nullable(), verifiedAt: instant.nullable().optional(),
  url: z.string().max(1500).refine(officialSourceUrl, "需要 OpenAI 官方页面或已列明官方账号的 HTTPS 原文地址"),
  textJa: z.string().min(1).max(1000), originalExcerpt: z.string().max(1000),
  stage: z.enum(["announcement", "progress", "confirmation", "context"]),
}).strict().refine((value) => value.publishedAt !== null || !!value.verifiedAt, "原文发布时间不明时，必须单独记录实际核验时间");

export const EventSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,99}$/),
  type: z.enum(["direct_reset", "reset_credit"]), titleJa: z.string().min(1).max(200), summaryJa: z.string().min(1).max(1200),
  scopeJa: z.string().max(500).nullable(), status: z.enum(["announced", "confirmed"]), inProgress: z.boolean(), reportedAt: instant.nullable(),
  schedule: z.object({ precision: z.enum(["exact", "window", "day"]), from: instant, through: instant, labelJa: z.string().min(1).max(200) }).strict().nullable(),
  confirmedAt: instant.nullable(), occurredOn: day.nullable(), occurredOnTimezone: z.enum(["Asia/Tokyo", "unspecified"]).optional(), confirmationBasis: z.enum(["source_post", "receipt_review"]).nullable(),
  evidenceJa: z.string().min(1).max(1000).nullable(), sources: z.array(source).min(1).max(30),
}).strict().superRefine((event, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(event.sources.map((s) => s.id)).size !== event.sources.length) issue("来源 ID 不能重复");
  if (event.schedule && Date.parse(event.schedule.through) < Date.parse(event.schedule.from)) issue("时间窗口结束早于开始");
  if (!event.reportedAt && !event.schedule && !event.confirmedAt && !event.occurredOn && !event.sources.some((s) => s.verifiedAt)) issue("所有原文与事件时间未知时仍需单独记录来源核验时间");
  if (event.occurredOnTimezone && !event.occurredOn) issue("日期时区标记必须对应 occurredOn");
  if (event.status === "confirmed") {
    if (!event.confirmationBasis || !event.evidenceJa) issue("已确认事件必须有确认方式和公开确认依据；实际发生时间未知时保持空值");
    if (event.confirmationBasis === "source_post" && !event.sources.some((s) => s.stage === "confirmation")) issue("来源确认必须附确认阶段的官方来源");
    if (event.inProgress) issue("已确认事件不能同时标记进行中");
  } else if (event.confirmedAt || event.occurredOn || event.confirmationBasis || event.evidenceJa) issue("尚未确认的事件不能携带完成时间或确认依据");
});

export const ImportSchema = z.object({ events: z.array(EventSchema).min(1).max(100), reason: z.string().trim().min(1).max(1000) }).strict()
  .refine((batch) => new Set(batch.events.map((e) => e.id)).size === batch.events.length, "事件 ID 不能重复");
export const UpdateSchema = z.object({ event: EventSchema.optional(), withdrawn: z.boolean().optional(), version: z.string(), reason: z.string().trim().min(1).max(1000) }).strict()
  .refine((input) => input.event !== undefined || input.withdrawn !== undefined, "需要修改内容");
export const DateSchema = day;
