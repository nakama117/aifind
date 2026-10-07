import { z } from "zod";
import { sql } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { config, credential } from "@aihot/backend/config";
import { stableJson } from "@aihot/backend/lib/ids";
import type { AdminCollection } from "../contracts.ts";
import { CollectionSettingsSchema, RecognitionSchema, collectionEnabled } from "./collection-schema.ts";
import { asDocument, collectionSettings, sourceStates, type DocumentRow } from "./collection-store.ts";
import { applyRecognition } from "./apply-recognition.ts";

export async function saveCollectionSettings(input: unknown, actor: string) {
  const change = CollectionSettingsSchema.parse(input);
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('codex-monitor.settings'))`;
    const before = await collectionSettings(tx);
    if (before.version !== change.version) throw new Conflict("采集配置已修改，请刷新后再保存");
    for (const source of before.sources) if (stableJson(source) !== stableJson(change.sources.find((next) => next.id === source.id) ?? null)) {
      await tx`DELETE FROM codex_monitor_state WHERE key=${`announcement:${source.id}`}`;
      await tx`UPDATE codex_monitor_documents SET is_current=false WHERE source_key=${source.id} AND is_current`;
    }
    await tx`INSERT INTO codex_monitor_state (key,value) VALUES ('collection-settings',${tx.json({ sources: change.sources })}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=clock_timestamp()`;
    await tx`DELETE FROM codex_monitor_state WHERE key='announcement-review'`;
    await audit(actor, "codex-monitor.configure", "codex-monitor:sources", change.reason, before.sources, change.sources, { db: tx });
    return collectionSettings(tx);
  });
}

export async function loadCollectionAdmin(): Promise<AdminCollection> {
  const [settings, states, documents] = await Promise.all([
    collectionSettings(), sourceStates(), sql<DocumentRow[]>`SELECT * FROM codex_monitor_documents ORDER BY (status IN ('review','failed','pending')) DESC, observed_at DESC LIMIT 40`,
  ]);
  const socialdataConfigured = !!credential("collectors", "SOCIALDATA_API_KEY");
  return {
    settings, enabled: collectionEnabled(), modelEnabled: process.env.MODEL_CALLS_ENABLED === "true" && config.modelCallsEnabled, socialdataConfigured,
    sources: settings.sources.map((source) => {
      const state = states.get(source.id);
      return { id: source.id, kind: source.kind, enabled: source.enabled, status: !source.enabled ? "disabled" : source.kind === "x_search" && !socialdataConfigured ? "missing_credentials" : state?.status ?? "never", lastAttemptAt: state?.lastAttemptAt ?? null, lastSuccessAt: state?.lastSuccessAt ?? null, failureCode: state?.failureCode ?? null, backlog: state?.backlog ?? 0, dropped: state?.dropped ?? 0 };
    }),
    documents: documents.map((row) => {
      const document = asDocument(row);
      return { id: document.id, sourceKey: document.sourceKey, url: document.url, author: document.author, text: document.text, publishedAt: document.publishedAt, observedAt: document.observedAt, status: document.status, recognition: document.recognition, receiptId: document.receiptId, appliedIds: document.appliedIds, reviewReason: document.reviewReason, version: document.version };
    }),
  };
}
const ReviewSchema = z.object({ action: z.enum(["approve", "dismiss", "retry"]), version: z.string(), reason: z.string().trim().min(1).max(1000), recognition: RecognitionSchema.optional() }).strict();
export async function reviewDocument(id: string, input: unknown, actor: string) {
  const change = ReviewSchema.parse(input);
  return sql.begin(async (tx) => {
    const [row] = await tx<(DocumentRow & { is_current: boolean })[]>`SELECT * FROM codex_monitor_documents WHERE id=${id} FOR UPDATE`;
    if (!row) return null;
    const document = asDocument(row);
    if (document.version !== change.version) throw new Conflict("该来源修订已处理，请刷新后再审核");
    if (change.action === "approve" && !row.is_current) throw new Conflict("原文已有更新版本，请审核最新修订");
    if (change.action === "retry" && document.status !== "failed") throw new Conflict("仅失败记录可重试；待审核结果请修正后审核或忽略");
    let appliedIds = row.applied_ids;
    let recognition = row.recognition;
    if (change.action === "approve") {
      recognition = RecognitionSchema.parse(change.recognition ?? row.recognition);
      const result = await applyRecognition(tx, document, recognition, { actor, reason: change.reason, approved: true });
      if (result.problems.length) throw new Conflict(result.problems.join("；"));
      appliedIds = result.appliedIds;
    }
    const status = change.action === "approve" ? "processed" : change.action === "dismiss" ? "dismissed" : "pending";
    await tx`UPDATE codex_monitor_documents SET status=${status}, recognition=${recognition ? tx.json(recognition as never) : null}, applied_ids=${appliedIds}, review_reason=${change.reason}, updated_at=clock_timestamp() WHERE id=${id}`;
    await audit(actor, `codex-monitor.review-${change.action}`, `codex-monitor:document:${id}`, change.reason, { status: row.status, recognition: row.recognition }, { status, recognition, appliedIds }, { db: tx });
    if (change.action === "approve") await tx`INSERT INTO codex_monitor_state (key,value) VALUES ('review',${tx.json({ lastReviewedAt: new Date().toISOString() })}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=clock_timestamp()`;
    return { id, status, appliedIds };
  });
}
