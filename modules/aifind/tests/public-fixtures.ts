import { sql } from "@aihot/backend/db";
import { makeDraft, proof } from "./fixtures.ts";
import { updateProductDraft } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform } from "../catalog/facts.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { setProductPublicVisibility } from "../catalog/public-settings.ts";

export async function publicFixture(visibility: "private" | "unlisted" | "listed" = "listed", setup?: (f: Awaited<ReturnType<typeof makeDraft>>, p: Awaited<ReturnType<typeof proof>>) => Promise<void>) {
  const f = await makeDraft(), p = await proof();
  await updateProductDraft(f.product.id, f.draft.version.id, { officialUrl: "https://synthetic.example/product", summaryJa: "公開テスト用の文章作成ツールです。" });
  await setProductMarket(f.product.id, f.draft.version.id, { marketCode: "JP", availabilityStatus: "unknown" });
  await setProductLanguageSupport(f.product.id, f.draft.version.id, { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "unknown", ...p });
  await setProductPlatform(f.product.id, f.draft.version.id, { platformKey: "web", status: "available", ...p });
  if (setup) await setup(f, p);
  const published = await publishProductVersion(f.product.id, f.draft.version.id, "test-editor", "Synthetic publication");
  if (visibility !== "private") await visibilityChange(f.product.id, visibility);
  return { ...f, published, proof: p };
}
export async function visibilityChange(id: string, visibility: "private" | "unlisted" | "listed") {
  const [r] = await sql`SELECT identity_revision FROM af_products WHERE id=${id}`;
  return setProductPublicVisibility(id, { visibility, expectedRevision: r.identity_revision, reason: "Synthetic public fixture" }, "test-editor");
}
