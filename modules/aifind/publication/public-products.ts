import { config } from "@aihot/backend/config";
import { tokyoDate } from "@aihot/contracts/time";
import { readPublishedSnapshot } from "@aihot/backend/publication/snapshot";
import { SlugSchema } from "../contracts.ts";
import {DiscoveryQuerySchema} from '../discovery/contracts.ts';
import type { ProductSnapshot } from "../contracts.ts";
import { publicReadinessIssues } from "../catalog/public-settings.ts";
import { readProducts, type VersionRow } from "../catalog/read.ts";
import type { PublicProduct, PublicProductList, PublicProductResolution } from "../public-contracts.ts";
import type { Tx } from "@aihot/backend/db";
import { relatedPublicEditorial } from './editorial.ts';
import {readLaunchCorpus} from '../launch/corpus.ts';
import type {LaunchCorpus} from '../launch/contracts.ts';
import {reviewedFreePlanState} from '../launch/facts.ts';

export function projectPublicProduct(p: ProductSnapshot, visibility: "listed" | "unlisted",dossier?:LaunchCorpus['dossiers'][number]): PublicProduct {
  const ja = p.languages.find(l => l.languageCode === "ja")!;
  const today = tokyoDate(new Date());
  const hasCurrentFreePlan=p.plans.some(plan=>plan.activeStatus==='active'&&plan.prices.some(r=>r.priceType==='free'
    &&(!r.validFrom||r.validFrom<=today)&&(!r.validTo||r.validTo>=today)));
  const reviewed=reviewedFreePlanState(p,dossier);
  return {
    slug: p.identity.slug, displayName: p.version.displayName, summaryJa: p.version.summaryJa!, officialUrl: p.version.officialUrl!,
    vendor: p.vendor ? { name: p.vendor.name } : null, lifecycleStatus: p.version.lifecycleStatus, visibility,
    canonicalUrl: `${config.siteUrl}/products/${p.identity.slug}`, versionNo: p.version.versionNo,
    publishedAt: p.version.publishedAt!, lastVerifiedAt: p.lastVerifiedAt!,
    hasCurrentFreePlan,freePlanState:hasCurrentFreePlan?'free':reviewed==='free'?'unknown':reviewed,
    markets: p.markets.map(f => ({ marketCode: f.marketCode, availabilityStatus: f.availabilityStatus, verifiedAt: f.verifiedAt })),
    japanese: { inputSupport: ja.inputSupport, outputSupport: ja.outputSupport, uiSupport: ja.uiSupport, verifiedAt: ja.verifiedAt },
    platforms: p.platforms.map(f => ({ platformKey: f.platformKey, status: f.status, verifiedAt: f.verifiedAt })),
    capabilities: p.capabilities.map(f => ({ capabilityKey: f.capabilityKey, supportLevel: f.supportLevel, verifiedAt: f.verifiedAt })),
    plans: p.plans.map(f => ({ planKey: f.planKey, name: f.name, audience: f.audience, billingModel: f.billingModel, activeStatus: f.activeStatus, verifiedAt: f.verifiedAt,
      prices: f.prices.map(r => ({ marketCode: r.marketCode, currencyCode: r.currencyCode, billingPeriod: r.billingPeriod,
        priceType: r.priceType, amountMinor: r.amountMinor, unitLabel: r.unitLabel, validFrom: r.validFrom, validTo: r.validTo, verifiedAt: r.verifiedAt })) })),
    evidence: p.evidence.map(e => ({ url: e.url, title: e.title, publisher: e.publisher, sourceKind: e.sourceKind })),
  };
}
export function homeCoreFactsKnown(p:PublicProduct):boolean {
  return p.markets.some(m=>m.marketCode==='JP'&&m.availabilityStatus!=='unknown')
    &&[p.japanese.inputSupport,p.japanese.outputSupport,p.japanese.uiSupport].every(s=>s!=='unknown')
    &&(p.freePlanState??(p.hasCurrentFreePlan?'free':'unknown'))!=='unknown';
}
export async function listHomeProducts():Promise<PublicProduct[]> {
  const products:PublicProduct[]=[];
  for(let offset=0;;offset+=100){const page=await listPublicProducts({limit:100,offset,sort:'recently_verified'});
    products.push(...page.products.filter(homeCoreFactsKnown));if(products.length>=6||!page.hasMore)return products.slice(0,6);
  }
}
/** Internal composition helper: batched eligible Products and current version IDs in the caller's snapshot. */
export async function readCurrentPublicProducts(db: Tx, productIds: string[]): Promise<Map<string,{product:PublicProduct;versionId:string}>> {
  if (!productIds.length) return new Map();
  const versions = await db<VersionRow[]>`SELECT v.* FROM af_products p JOIN af_product_versions v ON v.product_id=p.id
    WHERE p.id IN ${db([...new Set(productIds)])} AND p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v)`;
  const {dossiers}=await readLaunchCorpus();
  return new Map((await readProducts(db, versions)).map(p => [p.identity.id,{product:projectPublicProduct(p,'listed',dossiers.find(d=>d.productSlug===p.identity.slug)),versionId:p.version.id}]));
}
async function listed(db: Tx, limit: number, offset: number): Promise<PublicProduct[]> {
  const versions = await db<VersionRow[]>`SELECT v.* FROM af_products p JOIN af_product_versions v ON v.product_id=p.id
    WHERE p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v)
    ORDER BY p.slug,p.id LIMIT ${limit} OFFSET ${offset}`;
  const snapshots = await readProducts(db, versions); const products: PublicProduct[] = [];
  for (const p of snapshots) if (!(await publicReadinessIssues(db,p)).length) products.push(projectPublicProduct(p,"listed"));
  return products;
}
export async function listPublicProducts(input: unknown = {}): Promise<PublicProductList> {
  const f = DiscoveryQuerySchema.parse(input);
  return readPublishedSnapshot(async db => {
    const today=tokyoDate(new Date());
    const where=db`p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v)
      AND (${f.q}='' OR position(${f.q} in lower(normalize(p.canonical_name,NFKC)))>0
        OR position(${f.q} in lower(normalize(v.display_name,NFKC)))>0
        OR position(${f.q} in lower(normalize(coalesce(vendor.name,''),NFKC)))>0
        OR EXISTS(SELECT 1 FROM af_product_aliases a WHERE a.product_id=p.id AND position(${f.q} in a.normalized_alias)>0))
      AND ${f.capability?db`EXISTS(SELECT 1 FROM af_product_capabilities c WHERE c.product_version_id=v.id AND c.capability_key=${f.capability} AND c.support_level='full')`:db`true`}
      AND ${f.platform?db`EXISTS(SELECT 1 FROM af_product_platforms t WHERE t.product_version_id=v.id AND t.platform_key=${f.platform} AND t.status='available')`:db`true`}
      AND ${f.japan?db`EXISTS(SELECT 1 FROM af_product_markets m WHERE m.product_version_id=v.id AND m.market_code='JP' AND m.availability_status='available')`:db`true`}
      AND ${f.japanese?db`EXISTS(SELECT 1 FROM af_product_language_support l WHERE l.product_version_id=v.id AND l.language_code='ja' AND l.input_support='full' AND l.output_support='full')`:db`true`}
      AND ${f.free?db`EXISTS(SELECT 1 FROM af_product_plans plan JOIN af_product_prices r ON r.plan_id=plan.id
        WHERE plan.product_version_id=v.id AND plan.active_status='active' AND r.price_type='free'
        AND (r.valid_from IS NULL OR r.valid_from<=${today}::date) AND (r.valid_to IS NULL OR r.valid_to>=${today}::date))`:db`true`}`;
    // Same definite-fact/Evidence semantics as catalog/verification.ts; unknown dates never imply freshness.
    const verified=db`(SELECT max(f.verified_at) FROM (
      SELECT v.lifecycle_evidence_id AS evidence_id,v.lifecycle_verified_at AS verified_at WHERE v.lifecycle_status<>'unknown'
      UNION ALL SELECT evidence_id,verified_at FROM af_product_markets WHERE product_version_id=v.id AND availability_status<>'unknown'
      UNION ALL SELECT evidence_id,verified_at FROM af_product_language_support WHERE product_version_id=v.id AND (input_support<>'unknown' OR output_support<>'unknown' OR ui_support<>'unknown')
      UNION ALL SELECT evidence_id,verified_at FROM af_product_platforms WHERE product_version_id=v.id AND status<>'unknown'
      UNION ALL SELECT evidence_id,verified_at FROM af_product_capabilities WHERE product_version_id=v.id AND support_level<>'unknown'
      UNION ALL SELECT evidence_id,verified_at FROM af_product_plans WHERE product_version_id=v.id AND (audience<>'unknown' OR billing_model<>'unknown' OR active_status<>'unknown')
      UNION ALL SELECT r.evidence_id,r.verified_at FROM af_product_prices r JOIN af_product_plans pl ON pl.id=r.plan_id WHERE pl.product_version_id=v.id AND r.price_type<>'unknown'
    ) f JOIN af_evidence e ON e.id=f.evidence_id WHERE f.verified_at IS NOT NULL)`;
    const order=f.sort==='name'?db`lower(normalize(v.display_name,NFKC)),v.published_at DESC NULLS LAST,p.slug,p.id`
      :f.sort==='recently_published'?db`v.published_at DESC NULLS LAST,p.slug,p.id`
      :db`${verified} DESC NULLS LAST,v.published_at DESC NULLS LAST,p.slug,p.id`;
    const [count]=await db`SELECT count(*)::int AS total FROM af_products p JOIN af_product_versions v ON v.product_id=p.id LEFT JOIN af_vendors vendor ON vendor.id=p.vendor_id WHERE ${where}`;
    const versions=await db<VersionRow[]>`SELECT v.* FROM af_products p JOIN af_product_versions v ON v.product_id=p.id LEFT JOIN af_vendors vendor ON vendor.id=p.vendor_id WHERE ${where} ORDER BY ${order} LIMIT ${f.limit} OFFSET ${f.offset}`;
    const products:PublicProduct[]=[],{dossiers}=await readLaunchCorpus();
    for(const p of await readProducts(db,versions))if(!(await publicReadinessIssues(db,p)).length)products.push(projectPublicProduct(p,'listed',dossiers.find(d=>d.productSlug===p.identity.slug)));
    return {products,limit:f.limit,offset:f.offset,hasMore:f.offset+f.limit<count.total,total:count.total,query:f};
  });
}
export function resolvePublicProductBySlug(slug: string): Promise<PublicProductResolution> {
  if (!SlugSchema.safeParse(slug).success) return Promise.resolve({ kind: "not_found" });
  return readPublishedSnapshot(async db => {
    const [identity] = await db`SELECT p.id,p.slug,p.public_visibility FROM af_products p
      WHERE p.slug=${slug} OR p.id=(SELECT product_id FROM af_product_slug_redirects WHERE old_slug=${slug})`;
    if (!identity || identity.public_visibility === "private") return { kind: "not_found" };
    const [v] = await db<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${identity.id} AND status='published'`;
    if (!v) return { kind: "not_found" };
    const p = (await readProducts(db,[v]))[0];
    if ((await publicReadinessIssues(db,p)).length) return { kind: "not_found" };
    if (identity.slug !== slug) return { kind: "redirect", slug: identity.slug };
    const {dossiers}=await readLaunchCorpus();
    const product = projectPublicProduct(p,identity.public_visibility,dossiers.find(d=>d.productSlug===p.identity.slug));
    const related = identity.public_visibility==='listed' ? await relatedPublicEditorial(db,identity.id) : {comparisons:[],categories:[]};
    if (related.comparisons.length || related.categories.length || related.guides?.length) product.relatedEditorial = related;
    return { kind: "found", product };
  });
}
/** A separate fresh product map, never inserted into the news sitemap's stale-cache entries. */
export function listPublicSitemapProducts(): Promise<Array<{ slug: string; publishedAt: string }>> {
  return readPublishedSnapshot(async db => (await listed(db,45000,0)).map(p => ({ slug: p.slug, publishedAt: p.publishedAt })));
}
