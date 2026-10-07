import { sql } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import type { AdminMonitor, ResetEventInput } from "../contracts.ts";
import { ImportSchema, UpdateSchema } from "./schema.ts";
import { loadMonitorSnapshot } from "./publication.ts";
import { loadCollectionAdmin } from "./collection-admin.ts";

export async function importAnnouncements(input: unknown, actor: string) {
  const batch = ImportSchema.parse(input);
  return sql.begin(async (tx) => {
    for (const event of batch.events) {
      const inserted = await tx`INSERT INTO codex_monitor_events (id, body) VALUES (${event.id}, ${tx.json(event)}) ON CONFLICT (id) DO NOTHING RETURNING id`;
      if (!inserted.length) throw new Conflict(`事件 ${event.id} 已存在，请在事件编辑中修正，不能导入覆盖`);
      await audit(actor, "codex-monitor.import", `codex-monitor:${event.id}`, batch.reason, null, event, { db: tx });
    }
    await tx`INSERT INTO codex_monitor_state (key, value) VALUES ('review', ${tx.json({ lastReviewedAt: new Date().toISOString() })})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    return { imported: batch.events.length };
  });
}

export async function updateEvent(id: string, input: unknown, actor: string) {
  const change = UpdateSchema.parse(input);
  if (change.event && change.event.id !== id) throw Object.assign(new Error("事件 ID 不能修改"), { statusCode: 400 });
  return sql.begin(async (tx) => {
    const [before] = await tx<{ body: ResetEventInput; withdrawn: boolean; updated_at: Date }[]>`SELECT body, withdrawn, updated_at FROM codex_monitor_events WHERE id = ${id} FOR UPDATE`;
    if (!before) return null;
    if (before.updated_at.toISOString() !== change.version) throw new Conflict("事件已被其他操作修改，请刷新后再改");
    const body = change.event ?? before.body;
    const withdrawn = change.withdrawn ?? before.withdrawn;
    const [after] = await tx`UPDATE codex_monitor_events SET body = ${tx.json(body as never)}, withdrawn = ${withdrawn}, managed_by='manual', updated_at = clock_timestamp() WHERE id = ${id} RETURNING updated_at`;
    await audit(actor, "codex-monitor.update", `codex-monitor:${id}`, change.reason, { event: before.body, withdrawn: before.withdrawn }, { event: body, withdrawn }, { db: tx });
    await tx`INSERT INTO codex_monitor_state (key, value) VALUES ('review', ${tx.json({ lastReviewedAt: new Date().toISOString() })})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    return { id, version: (after.updated_at as Date).toISOString(), withdrawn };
  });
}

export async function listAdminMonitor(): Promise<AdminMonitor> {
  const [rows, snapshot, collection] = await Promise.all([
    sql<{ body: ResetEventInput; withdrawn: boolean; managed_by: "manual" | "automatic"; updated_at: Date; created_at: Date }[]>`SELECT body, withdrawn, managed_by, updated_at, created_at FROM codex_monitor_events ORDER BY updated_at DESC LIMIT 500`,
    loadMonitorSnapshot(),
    loadCollectionAdmin(),
  ]);
  return { events: rows.map((r) => ({ event: r.body, withdrawn: r.withdrawn, managedBy: r.managed_by, version: r.updated_at.toISOString(), createdAt: r.created_at.toISOString() })), monitor: snapshot.monitor, incidents: snapshot.incidents, collection };
}
