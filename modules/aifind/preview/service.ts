import { config } from "@aihot/backend/config";
import { Conflict } from "@aihot/backend/audit";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { getDraftProduct, updateProductDraft } from "../catalog/versions.ts";
import { assertPreviewWrites } from "./config.ts";
import { CHANGED_DRAFT_NAME, DRAFT_NAME, PREVIEW_NAME, PREVIEW_SLUG } from "./seed.ts";
import type { ProductDomainPreview } from "./contracts.ts";

export function canWritePreview(): boolean {
  try { assertPreviewWrites({ ...process.env, DATABASE_URL: config.databaseUrl }); return true; }
  catch { return false; }
}
export async function readProductDomainPreview(): Promise<ProductDomainPreview> {
  const published = await getPublishedProductBySlug(PREVIEW_SLUG);
  const draft = published ? await getDraftProduct(published.identity.id) : null;
  return { published, draft, canMutateDemo: canWritePreview() && published?.identity.canonicalName === PREVIEW_NAME && !!draft };
}

/** Fixed demo command, not a general product editor. There is no publish HTTP action. */
export async function changePreviewDraftName(): Promise<void> {
  assertPreviewWrites({ ...process.env, DATABASE_URL: config.databaseUrl });
  const { published, draft } = await readProductDomainPreview();
  if (!published || published.identity.canonicalName !== PREVIEW_NAME || !draft) throw new Conflict("Marked Preview fixture is missing");
  await updateProductDraft(published.identity.id, draft.version.id, {
    displayName: draft.version.displayName === CHANGED_DRAFT_NAME ? DRAFT_NAME : CHANGED_DRAFT_NAME,
  });
}
