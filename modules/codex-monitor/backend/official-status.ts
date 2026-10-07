import { z } from "zod";
import type { OfficialIncident } from "../contracts.ts";

export const OFFICIAL_STATUS_URL = "https://status.openai.com/api/v2/incidents.json";
const incident = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/), name: z.string().max(1000), status: z.string().max(100),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }), resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incident_updates: z.array(z.object({ body: z.string().max(20000) })).optional(),
});

/** Shared by the collector and its read-only live schema probe. No database or configuration access. */
export function parseOfficialStatus(value: unknown): { total: number; incidents: OfficialIncident[] } {
  const parsed = z.object({ incidents: z.array(incident).max(1000) }).parse(value);
  const incidents: OfficialIncident[] = parsed.incidents.filter((i) => /\bcodex\b/i.test(`${i.name} ${i.incident_updates?.map((u) => u.body).join(" ") ?? ""}`)).map((i) => ({
    id: i.id, title: i.name, status: i.status, publishedAt: i.created_at, updatedAt: i.updated_at, resolvedAt: i.resolved_at ?? null,
    url: `https://status.openai.com/incidents/${encodeURIComponent(i.id)}`,
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 30);
  return { total: parsed.incidents.length, incidents };
}
