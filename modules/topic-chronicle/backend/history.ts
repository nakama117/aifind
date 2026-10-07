import { z } from "zod";
import { isValidDate, tokyoDate } from "@aihot/contracts/time";
import { findTopic, type TopicMember } from "@aihot/backend/publication/topics";
import type { TopicMilestone, TopicMonth } from "../types.ts";

const calendarDate = z.string().refine(isValidDate, "実在する日付 YYYY-MM-DD が必要です");
const date = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/)
  .refine((v) => v.length < 10 || isValidDate(v), "実在する日付が必要です");
const entry = z.strictObject({
  date, kind: z.enum(["model", "product", "research", "company", "industry"]),
  title: z.string().trim().min(1).max(120), summary: z.string().trim().min(1).max(240).optional(),
  source: z.string().trim().min(1).max(100),
  url: z.url({ protocol: /^https$/ }).refine((v) => { const url = URL.parse(v); return !!url && !url.username && !url.password; }, "認証情報を含むURLは使用できません"),
  major: z.boolean().optional(), item: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
});
const document = z.strictObject({
  topic: z.string(), compiledOn: calendarDate,
  through: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), events: z.array(entry).min(1).max(1000),
}).refine((v) => v.events.every((e) => e.date.slice(0, 7) <= v.through), "収録範囲より後の出来事があります")
  .refine((v) => v.through <= v.compiledOn.slice(0, 7) && v.events.every((e) => e.date <= v.compiledOn), "編纂日は出来事と収録範囲以降にしてください");

export type ChronicleHistory = z.infer<typeof document>;

export function parseHistory(value: unknown, slug: string): ChronicleHistory {
  const parsed = document.parse(value);
  if (parsed.topic !== slug || findTopic(slug)?.group !== "company") {
    throw Object.assign(new Error("企業トピックとファイルの topic が一致する必要があります"), { statusCode: 400 });
  }
  return parsed;
}

/** Archive dates are original calendar dates; automatic events use the site's Tokyo calendar. */
export function companyMilestones(history: ChronicleHistory | null, picked: TopicMonth[], live: ReadonlyMap<string, TopicMember>): TopicMilestone[] {
  const archived = (history?.events ?? []).map((e): TopicMilestone => ({
    date: e.date, kind: e.kind, title: e.title, headline: null, summary: e.summary ?? null,
    href: e.url, source: e.source, external: true, major: e.major ?? false,
    related: e.item && live.get(e.item)?.topics.includes(history!.topic) ? `/items/${e.item}` : null,
  }));
  const linked = (history?.events ?? []).flatMap((e) => {
    const member = e.item ? live.get(e.item) : undefined;
    return member?.topics.includes(history!.topic) ? [member] : [];
  });
  const recent = picked.flatMap((m) => m.events).filter((e) => {
    const current = live.get(e.id);
    return !linked.some((m) => m.id === e.id || (m.factId != null && m.factId === current?.factId) || (m.story && m.story === current?.story));
  }).map((e): TopicMilestone => ({
    date: tokyoDate(e.at), kind: e.kind, title: e.label, headline: e.title, summary: null,
    href: e.href, external: false, major: false,
  }));
  return [...archived, ...recent].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
