// Public topic chronicle data. News comes exclusively from the framework's current publication map;
// this module only reads its own source-attributed historical archive.
import type { TopicPageAsk } from "@aihot/backend/modules";
import type { TopicMember } from "@aihot/backend/publication/topics";
import { factSources } from "@aihot/backend/publication/coverage";
import type { ChroniclePart } from "../types.ts";
import { chronicleReadReports, chronicleTopic, CHRONICLE_KINDS, selectTopicChronicle, selectTopicHighlights, type ChronicleReport } from "./selection.ts";
import { companyMilestones } from "./history.ts";
import { listHistories, readHistory } from "./store.ts";

function asReport(m: TopicMember, sources: ReadonlyMap<number, number>): ChronicleReport {
  return { id: m.id, title: m.title, originalTitle: m.originalTitle, category: m.category, tags: m.tags, score: m.score,
    topicSlugs: m.topics, timelineAt: m.at, publishedAt: m.publishedAt, factPublishedAt: m.factPublishedAt,
    firstParty: m.firstParty, owner: null, factId: m.factId, factSubject: m.factSubject, factAction: m.factAction,
    factOccurredAt: m.factOccurredAt, storyPublicId: m.story,
    sourceCount: m.factId === null ? 1 : Math.max(1, sources.get(m.factId) ?? 1), scope: m.scope };
}

interface ChronicleIndex { related: string[]; sources: Map<number, number> }

export async function chronicleIndex(members: readonly TopicMember[], now: Date): Promise<ChronicleIndex> {
  const ids = [...new Set(members.flatMap((m) => m.factId === null ? [] : [m.factId]))];
  const [histories, coverage] = await Promise.all([listHistories(), factSources(ids, now)]);
  return {
    related: histories.filter((r) => r.enabled).flatMap((r) => r.document.events.flatMap((e) => e.item ? [e.item] : [])),
    sources: new Map([...coverage].map(([id, sources]) => [id, sources.length])),
  };
}

export function readChroniclePart(ask: TopicPageAsk) {
  if (ask.page !== 1) return null;
  const index = ask.index as ChronicleIndex;
  const reports = chronicleReadReports(ask.members.map((m) => asReport(m, index.sources)), { now: ask.now });
  const recheck = [...new Set([...reports.map((r) => r.id), ...index.related])];
  return { recheck, part: async (live: ReadonlyMap<string, TopicMember>): Promise<ChroniclePart> => {
    const history = ask.topic.group === "company" ? await readHistory(ask.topic.slug) : null;
    const current = recheck.flatMap((id) => { const r = live.get(id); return r?.topics.includes(ask.topic.slug) ? [asReport(r, index.sources)] : []; });
    const topic = chronicleTopic(ask.topic);
    const window = { now: ask.now };
    const months = selectTopicChronicle(topic, current, window);
    return { kinds: CHRONICLE_KINDS, months, milestones: ask.topic.group === "company" ? companyMilestones(history, months, live) : [],
      highlights: selectTopicHighlights(topic, current, window),
      archive: history ? { compiledOn: history.compiledOn, through: history.through, sources: history.events.length } : null };
  } };
}
