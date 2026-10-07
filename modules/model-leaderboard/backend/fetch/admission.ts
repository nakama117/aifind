// Admission describes what produced a score, independently of reasoning-tier selection. Reviewed
// source protocols provide defaults; explicit run exceptions always win. Judges are not solvers.
import type { FetchResult } from "./types.ts";

export type EvaluationMode = "DIRECT" | "TOOLS" | "MIXED_FIXED_SINGLE_MODEL" | "SYSTEM" | "UNKNOWN";
export type FallbackStatus = "NONE" | "PRESENT" | "UNKNOWN";
export interface AdmissionRow {
  sourceModelName?: string;
  configurationKey?: string;
  configuration?: { key: string; ineligible: string | null };
  metadata?: Record<string, unknown>;
}
export interface Admission {
  eligible: boolean;
  mode: EvaluationMode;
  reason: string | null;
  protocolId: string | null;
  version: string | null;
  scope: string | null;
  evidenceUrls: string[];
  fallback: FallbackStatus;
}
interface Protocol {
  mode: EvaluationMode;
  protocolId: string;
  scope: string;
  evidenceUrls: string[];
  version?: string;
  harness?: string;
  referenceReason?: string;
  runStartedAt?: boolean;
}

const REVIEWED_AT = "2026-10-02";
const ARENA = "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/blob/main/README.md";
const LIVEBENCH = "https://github.com/LiveBench/LiveBench";
const EPOCH = "https://epoch.ai/benchmarks/about";
const epoch = (mode: EvaluationMode, page: string, scope: string, version?: string): Protocol => ({
  mode, protocolId: `epoch:${page}`, scope, version, runStartedAt: true,
  evidenceUrls: [EPOCH, `https://epoch.ai/benchmarks/${page}`],
});

/** Scope names the audited protocol, not a claim that every source row follows it. A private test set
 * limits reproducibility but does not by itself invalidate an officially declared common protocol. */
const PROTOCOLS: Record<string, Protocol> = {
  "artificial-analysis": { mode: "UNKNOWN", protocolId: "aa:intelligence-index", scope: "Intelligence Index v4.3.2 aggregate, including direct and tool tasks", evidenceUrls: ["https://artificialanalysis.ai/methodology/intelligence-benchmarking"], referenceReason: "分野横断の総合指数は照合用とし、構成評価と重複加点しません。" },
  "arena-text": { mode: "DIRECT", protocolId: "arena:text-style-control", scope: "Text style-controlled overall; overlaps its creative-writing subset", evidenceUrls: [ARENA], referenceReason: "全体の文章評価は複合的な照合用資料で、個別結果と重複加点しません。" },
  "arena-creative-writing": { mode: "DIRECT", protocolId: "arena:text-style-control:creative-writing", scope: "Human preference on direct text responses; creative_writing subset, not agent subsets", evidenceUrls: [ARENA] },
  "arena-vision": { mode: "DIRECT", protocolId: "arena:vision-style-control", scope: "Human preference on direct vision responses; not agent subsets", evidenceUrls: [ARENA] },
  "arena-webdev": { mode: "SYSTEM", protocolId: "arena:code-arena", scope: "Current Code Arena, separate from legacy WebDev; common per-row solver configuration not established", evidenceUrls: [ARENA, "https://arena.ai/blog/code-arena"], referenceReason: "成果には実行システムの影響があり、統一された単一モデル設定が未確認のため参考のみです。" },
  "livebench-writing": { mode: "DIRECT", protocolId: "livebench:language-if", scope: "Release-specific Language and IF task tables; objective grading", evidenceUrls: [LIVEBENCH] },
  "livebench-reasoning": { mode: "DIRECT", protocolId: "livebench:reasoning-mathematics", scope: "Release-specific Reasoning and Mathematics task tables; objective grading", evidenceUrls: [LIVEBENCH] },
  "livebench-coding": { mode: "MIXED_FIXED_SINGLE_MODEL", protocolId: "livebench:coding-and-agentic", scope: "Coding is direct; Agentic Coding uses the common single-model mini-swe-agent shell workflow, with API action-format adapters", evidenceUrls: [LIVEBENCH, "https://github.com/LiveBench/LiveBench/tree/main/livebench/agentic_code_runner/minisweagent"] },
  "deepswe-v1-1": { mode: "TOOLS", protocolId: "deepswe:mini-swe-agent", version: "1.1", harness: "mini-swe-agent", scope: "DeepSWE v1.1 through the shared mini-swe-agent harness; no model-specific agent", evidenceUrls: ["https://deepswe.datacurve.ai/run", "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json"] },
  "taptap-maker": { mode: "SYSTEM", protocolId: "taptap:main-board", scope: "Main board mixes claude, codex, grok and pi drivers and multiple engine commits", evidenceUrls: ["https://maker.taptap.cn/leaderboard/data/latest.json"], referenceReason: "モデルごとに Agent が異なるため、統一条件の単一モデル成績には使いません。" },
  "mercor-apex-agents": { mode: "TOOLS", protocolId: "mercor:loop-truncated-tools:pass-1", version: "1.1", harness: "loop_truncated_tools_agent", scope: "APEX-Agents v1.1, common loop_truncated_tools_agent, pass@1 only", evidenceUrls: ["https://www.mercor.com/apex/apex-agents-leaderboard/", "https://github.com/Mercor-Intelligence/apex_loop_truncated_tools_agent"] },
  "vals-finance-agent": { mode: "TOOLS", protocolId: "vals:finance-agent-v2", version: "2", scope: "Finance Agent v2 common tool harness; retrieval uses the same solver instance; disclosed model fallback is excluded", evidenceUrls: ["https://www.vals.ai/benchmarks/fabv2", "https://github.com/vals-ai/finance-agent-v2"] },
  "epoch-frontiermath": epoch("TOOLS", "frontiermath-tiers-1-3-v2", "FrontierMath tiers 1–3 v2, common Python and answer-submission tools", "2"),
  "epoch-frontiermath-tier4": epoch("TOOLS", "frontiermath-tier-4-v2", "FrontierMath tier 4 v2, common Python and answer-submission tools", "2"),
  "epoch-simpleqa": epoch("DIRECT", "simple-qa-verified", "SimpleQA Verified with the anti-abstention prompt introduced 2026-08-27; earlier scores retired", "2026-08-27"),
  "epoch-gpqa": epoch("DIRECT", "gpqa-diamond", "GPQA Diamond with answer-format scoring prompt 1.0.6", "1.0.6"),
  "epoch-chess": epoch("DIRECT", "chess-puzzles", "One solver API call per FEN puzzle; answer extraction and answer-key generation are grading machinery"),
  "epoch-mystery": epoch("TOOLS", "mystery-game-puzzles", "Epoch common minimal scaffold and move-submission tool; prompts and transcripts withheld against contamination"),
  "eq-creative": { mode: "DIRECT", protocolId: "eq:creative-writing-v3", version: "creative-writing-v3", scope: "One model generates each story; rubric and pairwise judges score completed outputs separately", evidenceUrls: ["https://eqbench.com/about.html#creative-writing-v3"] },
  "eq-longform": { mode: "DIRECT", protocolId: "eq:longform-v1.11", version: "longform-v1.11", scope: "One model plans, revises and writes successive chapters; judge model acts only after generation", evidenceUrls: ["https://eqbench.com/creative_writing_longform.html"] },
};

const object = (x: unknown): Record<string, unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const text = (x: unknown) => typeof x === "string" && x.trim() ? x : null;
const versionTag = (x: unknown) => typeof x === "number" && Number.isFinite(x) ? String(x) : text(x);
const modes = new Set<EvaluationMode>(["DIRECT", "TOOLS", "MIXED_FIXED_SINGLE_MODEL", "SYSTEM", "UNKNOWN"]);

export function admissionOf(sourceKey: string, row: AdmissionRow = {}): Admission {
  const p = PROTOCOLS[sourceKey];
  if (!p) return { eligible: false, mode: "UNKNOWN", reason: "この出典の単一モデル評価手順は未確認です。", protocolId: null, version: null, scope: null, evidenceUrls: [], fallback: "UNKNOWN" };
  const meta = row.metadata ?? {};
  const declared = object(meta.evaluation);
  // Missing legacy metadata can use this audit's default. An explicitly recorded unknown version
  // cannot: otherwise a later registry change would silently upgrade an old run's provenance.
  const protocolId = Object.hasOwn(declared, "protocolId") ? text(declared.protocolId) : p.protocolId;
  const version = Object.hasOwn(declared, "version") ? versionTag(declared.version)
    : Object.hasOwn(meta, "benchmarkVersion") ? versionTag(meta.benchmarkVersion)
    : Object.hasOwn(meta, "release") ? versionTag(meta.release) : p.version ?? null;
  const fallback = declared.fallback === "PRESENT" ? "PRESENT" : p.mode === "UNKNOWN" || p.mode === "SYSTEM" ? "UNKNOWN" : "NONE";
  const out: Admission = { eligible: false, mode: p.mode, reason: null, protocolId, version, scope: p.scope, evidenceUrls: [...p.evidenceUrls], fallback };
  const reject = (reason: string, mode = out.mode) => ({ ...out, mode, reason });
  const configKey = row.configurationKey ?? row.configuration?.key ?? "";
  const namedFallback = /\bfallback\b/i.test(`${row.sourceModelName ?? ""} ${configKey}`);
  // Vals explicitly discloses one Opus 5 run-task routed to Opus 4.8, even though that task's zero
  // score did not change. This exception is about the solver identity, not the numerical impact.
  const valsFallback = sourceKey === "vals-finance-agent" && /^(?:anthropic\/)?claude[- ]opus[- ]5$/i.test(row.sourceModelName ?? "") && (!version || version === "2");
  if (namedFallback || valsFallback || declared.fallback === "PRESENT") {
    out.fallback = "PRESENT";
    return reject("混合モデルまたはフォールバックが明示され、単一モデルの結果には使えません。", "SYSTEM");
  }
  if (row.configuration?.ineligible) return reject(row.configuration.ineligible);
  if ((declared.mode === "UNKNOWN" || declared.mode === "SYSTEM") && declared.mode !== p.mode) return reject("専用システムまたは未確認の実行設定です。", declared.mode);
  if (modes.has(declared.mode as EvaluationMode) && declared.mode !== p.mode) return reject("確認済みの出典の評価手順と実行方式が一致しません。", "UNKNOWN");
  if (protocolId !== p.protocolId || (p.version && version !== p.version)) return reject("この評価手順または版は未確認です。別の版の承認を引き継ぎません。", "UNKNOWN");
  const harness = text(meta.harness);
  if (p.harness && harness && harness !== p.harness) return reject("この Agent は確認済みの共通ツール手順に含まれません。", "SYSTEM");
  const scaffolded = configKey.startsWith("scaffolded:") || meta.configurationKind === "SCAFFOLDED";
  if (scaffolded && (!p.harness || harness !== p.harness)) return reject("この Agent 設定に対応する共通ツール手順は未確認です。", "SYSTEM");
  if (p.referenceReason) return reject(p.referenceReason);
  return { ...out, eligible: true };
}

/** Attach only facts we can establish: method provenance, actual run-start dates and typed counts.
 * Row exceptions enter configuration selection before the fixed effort priority is applied. */
export function annotateEvaluation(result: FetchResult): FetchResult {
  const p = PROTOCOLS[result.sourceKey];
  const source = admissionOf(result.sourceKey, { metadata: result.metadata });
  const sourceMetadata = { ...result.metadata, evaluation: {
    mode: source.mode, protocolId: source.protocolId, version: source.version,
    scope: source.scope, evidenceUrls: source.evidenceUrls, fallback: source.fallback, reviewedAt: p ? REVIEWED_AT : null,
  } };
  return { ...result, metadata: sourceMetadata, rows: result.rows.map((row) => {
    const a = admissionOf(result.sourceKey, { ...row, metadata: { ...sourceMetadata, ...row.metadata } });
    const metadata: Record<string, unknown> = { ...row.metadata, evaluation: {
      mode: a.mode, protocolId: a.protocolId, version: a.version,
      scope: a.scope, evidenceUrls: a.evidenceUrls, fallback: a.fallback, reviewedAt: p ? REVIEWED_AT : null,
    } };
    if (p?.runStartedAt && row.sourcePublishedAt) metadata.measuredAt = row.sourcePublishedAt;
    if (result.sourceKey === "epoch-mystery") metadata.traceAvailability = "WITHHELD";
    if (result.sourceKey.startsWith("arena-") && row.sampleSize != null) metadata.sample = { unit: "votes", votes: row.sampleSize };
    if (result.sourceKey === "deepswe-v1-1") metadata.sample = {
      unit: "tasks", uniqueItems: row.metadata?.taskCount ?? null, attempts: row.sampleSize ?? null, runs: row.metadata?.runCount ?? null,
    };
    return { ...row, metadata, configuration: p && !p.referenceReason && !a.eligible
      ? { ...row.configuration, ineligible: row.configuration.ineligible ?? a.reason }
      : row.configuration };
  }) };
}
