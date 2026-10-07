import type { ProductSnapshot, Verification } from "../contracts.ts";

/** Unknown facts carry no assertion. Every other state, including negatives and custom prices, does. */
export function definiteFacts(p: ProductSnapshot): Array<Verification & { field: string }> {
  const facts: Array<Verification & { field: string }> = [];
  const add = (field: string, definite: boolean, verification: Verification) => {
    if (definite) facts.push({ field, ...verification });
  };
  add("lifecycle", p.version.lifecycleStatus !== "unknown", {
    evidenceId: p.version.lifecycleEvidenceId, verifiedAt: p.version.lifecycleVerifiedAt,
  });
  for (const f of p.markets) add(`market:${f.marketCode}`, f.availabilityStatus !== "unknown", f);
  for (const f of p.languages) add(`language:${f.languageCode}`,
    [f.inputSupport, f.outputSupport, f.uiSupport].some(s => s !== "unknown"), f);
  for (const f of p.platforms) add(`platform:${f.platformKey}`, f.status !== "unknown", f);
  for (const f of p.capabilities) add(`capability:${f.capabilityKey}`, f.supportLevel !== "unknown", f);
  for (const plan of p.plans) {
    add(`plan:${plan.planKey}`, [plan.audience, plan.billingModel, plan.activeStatus].some(s => s !== "unknown"), plan);
    for (const f of plan.prices) add(`price:${f.id}`, f.priceType !== "unknown", f);
  }
  return facts;
}

export function lastVerifiedAt(p: ProductSnapshot): string | null {
  const evidenceIds = new Set(p.evidence.map(e => e.id));
  const instants = definiteFacts(p).filter(f => f.verifiedAt !== null && f.evidenceId !== null && evidenceIds.has(f.evidenceId))
    .map(f => f.verifiedAt!);
  return instants.sort().at(-1) ?? null;
}

export function validatePublishedFacts(p: ProductSnapshot): void {
  const evidenceIds = new Set(p.evidence.map(e => e.id));
  for (const fact of definiteFacts(p)) {
    if (!fact.evidenceId || !evidenceIds.has(fact.evidenceId)) throw new Error(`${fact.field} requires evidence`);
    if (!fact.verifiedAt) throw new Error(`${fact.field} requires verification time`);
  }
}
