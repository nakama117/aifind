import type { Db } from "@aihot/backend/db";
import { audit } from "@aihot/backend/audit";
import { sha256, stableJson } from "@aihot/backend/lib/ids";
import type { AnnouncementSource, ResetEventInput } from "../contracts.ts";
import { EventSchema, officialSourceUrl } from "./schema.ts";
import type { Recognition, SourceDocument, Statement } from "./collection-schema.ts";

const hasReset = (text: string) => /\bcodex\b/i.test(text) && /\breset(?:s|ting)?\b/i.test(text);
const futureOrPolicy = /\b(?:will|would|might|may|going to|plan(?:s|ned)? to|expect(?:ed)?|every|you can|can use|if you)\b/i;
const shortApproval = /^(?:yes|yep|yup|done|correct|confirmed|it'?s done|we did|all set)[.!\s]*$/i;
function quotedDate(quote: string, day: string): boolean {
  if (quote.includes(day)) return true;
  const [year, month, date] = day.split("-").map(Number);
  const name = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1]!;
  const match = new RegExp(`\\b${name}(?: ${date}(?:st|nd|rd|th)?[,]? ${year})\\b`, "i");
  return match.test(quote);
}
function timeProblem(statement: Statement, document: SourceDocument): string | null {
  if (!statement.occurredOn && !statement.confirmedAt && !statement.schedule) return null;
  const quote = statement.timeQuote;
  if (!quote || !document.text.includes(quote)) return "时间依据不是原文连续引文";
  if (statement.occurredOn && !quotedDate(quote, statement.occurredOn)) return "事件日期没有明确原文日期依据";
  for (const instant of [statement.confirmedAt, statement.schedule?.from, statement.schedule?.through]) {
    if (instant && !quote.includes(instant)) return "精确时刻未在原文中以带时区的时间明确出现";
  }
  return null;
}

function statementProblem(statement: Statement, document: SourceDocument, target: ResetEventInput | null): string | null {
  if (!statement.explicit) return "声明不明确";
  if (!document.text.includes(statement.quote)) return "声明引文不是原文连续片段";
  const linkedContext = target && document.context.some((context) => context.relation === "reply" && officialSourceUrl(context.url) && target.sources.some((source) => source.url === context.url) && hasReset(context.text));
  if (!hasReset(statement.quote) && !(linkedContext && shortApproval.test(statement.quote.trim()))) return "缺少 Codex 重置的明确声明或可信原帖上下文";
  if (statement.action === "confirm" && futureOrPolicy.test(statement.quote)) return "未来计划或周期机制不是完成确认";
  if (statement.action !== "withdraw" && /\b(?:every|you can|can use|no reset|will not|won't|not (?:offering|resetting))\b/i.test(statement.quote)) return "机制说明或否定句不是本次重置";
  if (statement.action !== "withdraw" && statement.quote.trim().endsWith("?")) return "疑问句不是本次重置声明";
  if (statement.type === "direct_reset" && /\b(?:banked|saved|credit)\b/i.test(statement.quote)) return "保存型重置不能归为直接重置";
  if (statement.type === "reset_credit" && !/\b(?:banked|saved|credit|reset card)\b/i.test(statement.quote) && !linkedContext) return "保存型重置缺少原文类型依据";
  if (statement.targetEventId && !target) return "关联事件不存在或已经撤回";
  if (target && target.type !== statement.type) return "关联事件类型不一致";
  if (target && !target.sources.some((source) => source.url === document.url) && !linkedContext
      && !(statement.occurredOn && target.occurredOn === statement.occurredOn && target.scopeJa === statement.scopeJa)) return "跨来源声明未能证明是同一次事件";
  if (["withdraw", "amend", "progress"].includes(statement.action) && !target) return "变更声明必须关联明确的已有事件";
  if (statement.action !== "confirm" && (statement.confirmedAt || statement.occurredOn || statement.evidenceJa)) return "未确认声明携带了完成字段";
  if (statement.action === "confirm" && !statement.evidenceJa) return "确认缺少公开依据";
  if (target?.status === "confirmed" && (statement.confirmedAt && target.confirmedAt && Date.parse(statement.confirmedAt) !== Date.parse(target.confirmedAt)
      || statement.occurredOn && target.occurredOn && statement.occurredOn !== target.occurredOn)) return "新声明与已核实的实施时间冲突，请人工核验";
  return timeProblem(statement, document);
}
function shortExcerpt(quote: string) {
  return quote.split(/\s+/).slice(0, 24).join(" ").slice(0, 180);
}
function sourceFor(document: SourceDocument, statement: Statement): AnnouncementSource {
  return { id: `source-${sha256(`${document.key}|${statement.action}|${statement.quote}`).slice(0, 20)}`, author: document.author, url: document.url, publishedAt: document.publishedAt, verifiedAt: document.observedAt,
    textJa: statement.summaryJa, originalExcerpt: shortExcerpt(statement.quote), stage: statement.action === "confirm" ? "confirmation" : statement.action === "progress" ? "progress" : "announcement" };
}

function occurrenceDays(event: Pick<ResetEventInput, "confirmedAt" | "occurredOn" | "schedule">) {
  const utcDay = (instant: string) => Math.floor(Date.parse(instant) / 86_400_000);
  if (event.confirmedAt) return { from: utcDay(event.confirmedAt), through: utcDay(event.confirmedAt), dateOnly: false };
  if (event.occurredOn) return { from: utcDay(`${event.occurredOn}T00:00:00Z`), through: utcDay(`${event.occurredOn}T00:00:00Z`), dateOnly: true };
  if (event.schedule) return { from: utcDay(event.schedule.from), through: utcDay(event.schedule.through), dateOnly: false };
  return null;
}

function mayRepeatProtectedEvent(event: ResetEventInput, statement: Statement, sourceUrl: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const quote = normalize(statement.quote);
  // Public excerpts are deliberately short; their exact prefix still identifies repeated evidence.
  if (event.sources.some((source) => {
    const excerpt = normalize(source.originalExcerpt);
    return source.url === sourceUrl && excerpt.length >= 20 && (quote.startsWith(excerpt) || excerpt.startsWith(quote));
  })) return true;
  const previous = occurrenceDays(event);
  const next = occurrenceDays(statement);
  if (!previous || !next) return true;
  // Normalize instants/windows to UTC before comparison. A bare date can overlap an adjacent UTC
  // day in an unstated timezone; this is only an identity check, never a generated event timestamp.
  if (previous.dateOnly !== next.dateOnly) {
    const date = previous.dateOnly ? previous : next;
    date.from--; date.through++;
  }
  return previous.from <= next.through && next.from <= previous.through;
}

/** Apply independently supported statements, keeping uncertain ones in the review queue. No missing-page withdrawal. */
export async function applyRecognition(db: Db, document: SourceDocument, recognition: Recognition, opts: { actor: string; reason: string; approved?: boolean }) {
  const appliedIds: string[] = [];
  const problems: string[] = [];
  if (recognition.reviewReason && !opts.approved) return { appliedIds, problems: [recognition.reviewReason] };
  for (const [index, statement] of recognition.statements.entries()) {
    if (statement.category !== "reset_event") continue;
    const id = statement.targetEventId ?? `auto-${sha256(`${document.key}|${statement.type}|${statement.occurredOn ?? statement.schedule?.from ?? statement.quote}`).slice(0, 24)}`;
    const [before] = await db<{ body: ResetEventInput; withdrawn: boolean; managed_by: string }[]>`SELECT body, withdrawn, managed_by FROM codex_monitor_events WHERE id=${id} FOR UPDATE`;
    const target = before && !before.withdrawn ? before.body : null;
    const problem = statementProblem(statement, document, target)
      ?? (statement.needsReview && !opts.approved ? "模型要求人工复核" : null)
      ?? (before?.managed_by === "manual" && !opts.approved ? "已有记录由人工管理，自动识别不能覆盖或恢复" : null)
      ?? (before?.withdrawn ? "已撤回记录不能由自动声明恢复" : null);
    if (problem) { problems.push(`声明 ${index + 1}：${problem}`); continue; }
    if (!opts.approved) {
      const sourceEvents = await db<{ body: ResetEventInput; withdrawn: boolean; managed_by: string }[]>`
        SELECT e.body, e.withdrawn, e.managed_by FROM codex_monitor_events e
        WHERE e.body->>'type'=${statement.type} AND (
          EXISTS (SELECT 1 FROM jsonb_array_elements(e.body->'sources') source WHERE source->>'url'=${document.url})
          OR EXISTS (SELECT 1 FROM codex_monitor_documents d WHERE d.document_key=${document.key} AND e.id=ANY(d.applied_ids)))
        FOR UPDATE OF e`;
      if (sourceEvents.some((event) => (event.withdrawn || event.managed_by === "manual") && mayRepeatProtectedEvent(event.body, statement, document.url))) {
        problems.push(`声明 ${index + 1}：同源已撤回或人工管理的事件仍可能是本次声明，不能换 ID 自动发布，请人工核验`);
        continue;
      }
    }
    if (!before && !statement.targetEventId && !opts.approved) {
      // A dated historical import may already describe this offer. Never silently create a duplicate.
      const duplicates = statement.occurredOn ? await db`SELECT id FROM codex_monitor_events WHERE body->>'type'=${statement.type} AND body->>'occurredOn'=${statement.occurredOn}` : [];
      if (duplicates.length) { problems.push(`声明 ${index + 1}：同类型同日期已有记录，请人工关联或确认是独立事件后审核`); continue; }
    }
    if (statement.action === "withdraw") {
      await db`UPDATE codex_monitor_events SET withdrawn=true, managed_by=${opts.approved ? "manual" : "automatic"}, updated_at=clock_timestamp() WHERE id=${id}`;
      await audit(opts.actor, "codex-monitor.auto-withdraw", `codex-monitor:${id}`, opts.reason, before, { withdrawn: true, source: { url: document.url, quote: statement.quote, observedAt: document.observedAt } }, { db });
      appliedIds.push(id); continue;
    }
    if (target?.status === "confirmed" && statement.action !== "confirm") { problems.push(`声明 ${index + 1}：不能以未确认声明覆盖已经确认的记录`); continue; }
    const source = sourceFor(document, statement);
    const sources = [...(target?.sources ?? []).filter((old) => old.id !== source.id), source];
    const confirmedAt = statement.action === "confirm" ? statement.confirmedAt ?? target?.confirmedAt ?? null : null;
    const occurredOn = statement.action === "confirm" ? statement.occurredOn ?? target?.occurredOn ?? null : null;
    const parsed = EventSchema.safeParse({
      id, type: statement.type, titleJa: statement.titleJa, summaryJa: statement.summaryJa, scopeJa: statement.scopeJa,
      status: statement.action === "confirm" ? "confirmed" : "announced", inProgress: statement.action === "progress",
      reportedAt: target?.reportedAt ?? document.publishedAt, schedule: statement.schedule ?? target?.schedule ?? null,
      confirmedAt, occurredOn,
      ...(occurredOn ? { occurredOnTimezone: statement.occurredOn ? "unspecified" : target?.occurredOnTimezone ?? "Asia/Tokyo" } : {}),
      confirmationBasis: statement.action === "confirm" ? "source_post" : null, evidenceJa: statement.action === "confirm" ? statement.evidenceJa : null, sources,
    });
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`).join("；").slice(0, 800);
      problems.push(`声明 ${index + 1}：最终事件校验未通过，须人工复核（${detail}）`);
      continue;
    }
    const event = parsed.data;
    if (!before || stableJson(before.body) !== stableJson(event)) {
      await db`INSERT INTO codex_monitor_events (id, body, managed_by) VALUES (${id}, ${db.json(event as never)}, ${opts.approved ? "manual" : "automatic"})
        ON CONFLICT (id) DO UPDATE SET body=EXCLUDED.body, managed_by=EXCLUDED.managed_by, updated_at=clock_timestamp()`;
      await audit(opts.actor, `codex-monitor.auto-${statement.action}`, `codex-monitor:${id}`, opts.reason, before?.body ?? null, event, { db });
    }
    appliedIds.push(id);
  }
  return { appliedIds, problems };
}
