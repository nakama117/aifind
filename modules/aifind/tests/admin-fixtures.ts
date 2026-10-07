import "../../../tests/setup.ts";
import { tag } from "../../../tests/setup.ts";
import { makeDraft, proof } from "./fixtures.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { setProductLanguageSupport } from "../catalog/facts.ts";

export const actor = "synthetic-admin";
export const reason = "合成テストの確認操作";
export async function publishedFixture() {
  const f = await makeDraft();
  const evidence = await proof();
  await setProductLanguageSupport(f.product.id, f.draft.version.id, {
    languageCode: "ja", inputSupport: "full", outputSupport: "partial", uiSupport: "unknown", ...evidence,
  });
  const published = await publishProductVersion(f.product.id, f.draft.version.id, actor, reason);
  return { ...f, published, proof: evidence };
}
export const slug = () => `admin-synthetic-${tag()}`;
