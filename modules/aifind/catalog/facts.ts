import type { Tx } from "@aihot/backend/db";
import { newUuid } from "@aihot/backend/lib/ids";
import { MarketSchema, LanguageSupportSchema, PlatformSchema, CapabilitySchema } from "../contracts.ts";
import { editDraft } from "./versions.ts";

export async function setProductMarket(productId: string, versionId: string, input: unknown, db?: Tx): Promise<void> {
  const m = MarketSchema.parse(input);
  await editDraft(productId, versionId, async tx => {
    await tx`INSERT INTO af_product_markets (id, product_version_id, market_code, availability_status, verified_at, evidence_id)
      VALUES (${newUuid()}, ${versionId}, ${m.marketCode}, ${m.availabilityStatus}, ${m.verifiedAt ?? null}, ${m.evidenceId ?? null})
      ON CONFLICT (product_version_id, market_code) DO UPDATE SET availability_status=excluded.availability_status,
      verified_at=excluded.verified_at, evidence_id=excluded.evidence_id`;
  }, db);
}

export async function setProductLanguageSupport(productId: string, versionId: string, input: unknown, db?: Tx): Promise<void> {
  const l = LanguageSupportSchema.parse(input);
  await editDraft(productId, versionId, async tx => {
    await tx`INSERT INTO af_product_language_support (product_version_id, language_code, input_support, output_support, ui_support, verified_at, evidence_id)
      VALUES (${versionId}, ${l.languageCode}, ${l.inputSupport}, ${l.outputSupport}, ${l.uiSupport}, ${l.verifiedAt ?? null}, ${l.evidenceId ?? null})
      ON CONFLICT (product_version_id, language_code) DO UPDATE SET input_support=excluded.input_support,
      output_support=excluded.output_support, ui_support=excluded.ui_support, verified_at=excluded.verified_at, evidence_id=excluded.evidence_id`;
  }, db);
}

export async function setProductPlatform(productId: string, versionId: string, input: unknown, db?: Tx): Promise<void> {
  const p = PlatformSchema.parse(input);
  await editDraft(productId, versionId, async tx => {
    await tx`INSERT INTO af_product_platforms (product_version_id, platform_key, status, verified_at, evidence_id)
      VALUES (${versionId}, ${p.platformKey}, ${p.status}, ${p.verifiedAt ?? null}, ${p.evidenceId ?? null})
      ON CONFLICT (product_version_id, platform_key) DO UPDATE SET status=excluded.status,
      verified_at=excluded.verified_at, evidence_id=excluded.evidence_id`;
  }, db);
}

export async function setProductCapability(productId: string, versionId: string, input: unknown, db?: Tx): Promise<void> {
  const c = CapabilitySchema.parse(input);
  await editDraft(productId, versionId, async tx => {
    await tx`INSERT INTO af_product_capabilities (product_version_id, capability_key, support_level, verified_at, evidence_id)
      VALUES (${versionId}, ${c.capabilityKey}, ${c.supportLevel}, ${c.verifiedAt ?? null}, ${c.evidenceId ?? null})
      ON CONFLICT (product_version_id, capability_key) DO UPDATE SET support_level=excluded.support_level,
      verified_at=excluded.verified_at, evidence_id=excluded.evidence_id`;
  }, db);
}
