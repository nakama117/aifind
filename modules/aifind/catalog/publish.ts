import { sql, type Tx } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { PublishAuditSchema } from "../contracts.ts";
import type { PublishedProduct } from "../contracts.ts";
import { readProducts, publishedDto } from "./read.ts";
import type { VersionRow } from "./read.ts";
import { validatePublishedFacts } from "./verification.ts";
import { STALE_DRAFT_MESSAGE } from "./versions.ts";
import { requirePublicReady } from "./public-settings.ts";

/** Pure domain transaction; Admin authorization/review belongs at its calling boundary. */
export async function publishProductVersion(productId: string, versionId: string, actor: string, reason: string,
  options: { db?: Tx; expectedRevision?: number } = {}): Promise<PublishedProduct> {
  const change = PublishAuditSchema.parse({ actor, reason });
  const publish = async (tx: Tx) => {
    const [product] = await tx`SELECT id,public_visibility FROM af_products WHERE id=${productId} FOR UPDATE`;
    if (!product) throw new Error("product not found");
    const [version] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id=${versionId} FOR UPDATE`;
    if (!version || version.product_id !== productId) throw new Error("version does not belong to product");
    if (version.status !== "draft") throw new Conflict("only a draft can be published");
    if (options.expectedRevision !== undefined && options.expectedRevision !== version.revision) throw new Conflict(STALE_DRAFT_MESSAGE);
    const snapshot = (await readProducts(tx, [version]))[0];
    validatePublishedFacts(snapshot);
    if (product.public_visibility !== "private") await requirePublicReady(tx, snapshot);
    const [previous] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='published' FOR UPDATE`;
    const [clock] = await tx<{ at: Date }[]>`SELECT clock_timestamp() AS at`;
    if (previous) await tx`UPDATE af_product_versions SET status='superseded', superseded_at=${clock.at} WHERE id=${previous.id}`;
    const [published] = await tx<VersionRow[]>`UPDATE af_product_versions SET status='published', published_at=${clock.at}
      WHERE id=${versionId} RETURNING *`;
    await audit(change.actor, "aifind.product.publish", `aifind:product:${productId}`, change.reason,
      previous ? { versionId: previous.id, versionNo: previous.version_no } : null,
      { versionId: published.id, versionNo: published.version_no }, { db: tx });
    return publishedDto((await readProducts(tx, [published]))[0]);
  };
  return options.db ? publish(options.db) : sql.begin("isolation level read committed", publish);
}
