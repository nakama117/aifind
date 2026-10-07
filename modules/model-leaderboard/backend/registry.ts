// Reader-facing leaderboard vocabulary: evaluation sources, board copy, score formats and brand marks.
// Scoring weights and eligibility never come from here; they come from the computation run.
import type { LeaderboardBoardKey } from "@aihot/model-leaderboard/taxonomy";
import type { LbBoardMeta, LbBrand, LbScoreFormat, LbSourceStatus } from "@aihot/model-leaderboard/contracts";
import { SITE } from "@aihot/site";
import registryData from "./source-registry.json" with { type: "json" };
import { providerSlugOf } from "./providers.ts";

export interface RegistrySource {
  key: string;
  status: LbSourceStatus;
  name: string;
  fullName?: string;
  operator: string;
  area?: string;
  description: string;
  logo: string | null;
  officialUrl: string | null;
  what: string;
  usage: string;
  limits: string;
  license: string;
  attribution?: string;
  components?: { note: string; label: string };
  /** Reference sources that keep every system row instead of one representative per model. */
  allRows?: boolean;
}

export interface RegistryGroup {
  key: string;
  name: string;
  blurb: string;
  sources: RegistrySource[];
}

export const SOURCE_GROUPS = registryData.groups as RegistryGroup[];

const byKey = new Map<string, { source: RegistrySource; group: RegistryGroup }>();
for (const group of SOURCE_GROUPS) for (const source of group.sources) byKey.set(source.key, { source, group });

export function registrySource(key: string) {
  return byKey.get(key) ?? null;
}

/** Signal units carry a metric suffix for multi-metric sources ("artificial-analysis:intelligence"). */
export function sourceKeyOfUnit(unit: string): string {
  return unit.split(":")[0]!;
}

const GENERAL_READING = `${SITE.name} スコアが高いほど、この評価内の相対的な総合結果が強いことを示します。正答率ではありません。個別結果も確認してください。`;

/** Page copy of each board; board names are LEADERBOARD_BOARD_LABELS. */
export const BOARD_COPY: Record<LeaderboardBoardKey, Pick<LbBoardMeta, "title" | "description" | "howToRead">> = {
  overall: {
    title: `${SITE.name} モデルランキング`,
    description: `単一モデルの統一条件で公開評価を比較し、 ${SITE.name} スコア、参考順位、元の個別結果を掲載します。`,
    howToRead: GENERAL_READING,
  },
  coding: {
    title: `コーディングランキング · ${SITE.name}`,
    description: "コード生成からリポジトリ修正まで、ソフトウェアを実装する能力を比較。",
    howToRead: GENERAL_READING,
  },
  reasoning: {
    title: `推論ランキング · ${SITE.name}`,
    description: "数学、論理、未知の規則に対する推論を比較。",
    howToRead: GENERAL_READING,
  },
  knowledge: {
    title: `知識ランキング · ${SITE.name}`,
    description: "事実質問と大学院水準の科学知識の正確さを比較。",
    howToRead: "知識ランキングは Epoch の 2 評価を使い、同じ機関による結果です。",
  },
  professional: {
    title: `専門業務ランキング · ${SITE.name}`,
    description: "金融分析、法律相談、銀行業務などの専門タスクを比較。",
    howToRead: "金融分析と専門相談が中心で、全業務を代表しません。共通のツール手順による結果を比較します。",
  },
};

export const BOARD_LIMIT = 30;

// How each source publishes its numbers: already in percent, a 0–1 fraction, or a plain score.
const PERCENT_SOURCES = new Set(["livebench-general", "livebench-coding", "livebench-reasoning", "livebench-writing", "mercor-apex-agents", "vals-finance-agent", "tau-banking"]);
const PLAIN_SOURCES = new Set(["artificial-analysis", "artificial-analysis-multilingual", "arena-text", "arena-webdev", "arena-vision", "arena-creative-writing", "eq-creative", "eq-longform", "eq-emotional-v4"]);

export function scoreFormat(sourceKey: string, sample?: number | null): LbScoreFormat {
  if (PERCENT_SOURCES.has(sourceKey)) return "percent";
  if (PLAIN_SOURCES.has(sourceKey)) return "number";
  return sample != null && Math.abs(sample) <= 1 ? "fraction" : "number";
}

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatScore(value: number | null | undefined, format: LbScoreFormat): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (format === "fraction") return `${(value * 100).toFixed(1)}%`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return grouping.format(value);
}

// Every model mark lives in assets/model-providers (served at /model-providers/) and is chosen here.
// Model-family marks win over company marks: a Qwen mark identifies Qwen, not Alibaba.
const FAMILY_MARKS: Array<[RegExp, string]> = [
  [/^claude/, "anthropic.svg"],
  [/^(gemini|gemma)/, "google.svg"],
  [/^(qwen|qwq)/, "qianwen.svg"],
  [/^kimi/, "moonshot.svg"],
  [/^grok/, "xai.svg"],
  [/^deepseek/, "deepseek.svg"],
  [/^(hy-|hunyuan)/, "tencent.svg"],
  [/^(seed|doubao)/, "bytedance.svg"],
  [/^(glm|chatglm)/, "z-ai.svg"],
  [/^mimo/, "xiaomi-mimo.svg"],
];

/** Genuine company marks, used when no family mark applies. */
const PROVIDER_MARKS: Record<string, string> = {
  openai: "openai.svg",
  meta: "meta.svg",
  minimax: "minimax.svg",
  mistral: "mistral.svg",
  nvidia: "nvidia.svg",
  "z-ai": "z-ai.svg",
  "thinking-machines": "thinking-machines.png",
};

export function modelBrand(slug: string, providerSlug: string | null, provider: string | null, name: string): LbBrand {
  const family = FAMILY_MARKS.find(([re]) => re.test(slug))?.[1];
  const company = providerSlugOf({ name, provider, provider_slug: providerSlug });
  const file = family ?? (company ? PROVIDER_MARKS[company] : undefined);
  const label = (provider && provider !== "其他" ? provider : name).replace(/[^\p{L}\p{N}]/gu, "");
  return { src: file ? `/api/site/leaderboard/assets/model-providers/${file}` : null, monogram: label.slice(0, 1).toUpperCase() || "?", raster: !!file?.endsWith(".png") };
}

// eqbench.svg and livebench.png carry raster artwork; they get a plate in dark mode.
const RASTER_SOURCE_MARKS = new Set(["eqbench.svg", "livebench.png", "sierra.png", "agents-last-exam.svg", "llm2014.svg"]);

export function sourceBrand(source: RegistrySource): LbBrand {
  return {
    src: source.logo ? `/api/site/leaderboard/assets/leaderboard-sources/${source.logo}` : null,
    monogram: source.operator.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?",
    raster: source.logo ? RASTER_SOURCE_MARKS.has(source.logo) : false,
  };
}
