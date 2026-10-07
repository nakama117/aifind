export type TopicMilestoneKind = string;
export interface TopicKind { label: string; above: boolean; launch: boolean }
export interface TopicEvent { id: string; title: string; label: string; at: string; kind: string; href: string }
export interface TopicMonth { month: string; events: TopicEvent[] }
export interface TopicMilestone {
  date: string; kind: string; title: string; headline: string | null; summary: string | null;
  href: string | null; external: boolean; major: boolean; source?: string; related?: string | null;
}
export interface ChroniclePart {
  kinds: Record<string, TopicKind>; milestones: TopicMilestone[]; months: TopicMonth[]; highlights: TopicEvent[];
  archive: { compiledOn: string; through: string; sources: number } | null;
}
