import { config } from '@aihot/backend/config';
import { readPublishedSnapshot } from '@aihot/backend/publication/snapshot';
import { type Tx } from '@aihot/backend/db';
import { escapeXml } from '@aihot/backend/lib/text';
import { authoredMarkdownBody } from '@aihot/backend/content/markdown';
import { SlugSchema } from '../contracts.ts';
import { productRefs, type EditorialRevision, type EditorialType } from '../editorial/contracts.ts';
import { readEditorialRevisions } from '../editorial/read.ts';
import { readCurrentPublicProducts, projectPublicProduct } from './public-products.ts';
import { readProducts, type VersionRow } from '../catalog/read.ts';
import { readEditorialAssets, checkedAssetBytes } from '../editorial/assets.ts';
import type { PublicEditorial, PublicEditorialSummary, PublicEditorialResolution, PublicEditorialRelated } from '../editorial/public-contracts.ts';

export const editorialPath = (type: EditorialType, slug: string) => (type==='comparison'?'/compare/':type==='guide'?'/howto/':'/categories/')+slug;
/** No Product fact lives in an editorial revision: all facts below are current Published projections. */
export async function projectEditorialRevisions(tx: Tx, revisions: EditorialRevision[], adminPreview=false): Promise<Map<string,PublicEditorial>> {
  const refs = revisions.flatMap(r => productRefs(r.content).map(p => ({ productId: p.productId, referencePublishedVersionId: p.referencePublishedVersionId })));
  const current = await readCurrentPublicProducts(tx,refs.map(p => p.productId));
  const ids = [...new Set(refs.map(p => p.referencePublishedVersionId))];
  const reference = ids.length ? await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id IN ${tx(ids)} AND published_at IS NOT NULL AND status<>'draft'` : [];
  const byReference = new Map(reference.map(r => [r.id,r]));
  const output = new Map<string,PublicEditorial>();
  const guideVersionIds=new Set(revisions.flatMap(r=>r.content.type==='guide'?r.content.guide.products.map(p=>p.referencePublishedVersionId):[]));
  const historical=new Map((await readProducts(tx,reference.filter(v=>guideVersionIds.has(v.id)))).filter(p=>p.languages.some(l=>l.languageCode==='ja')).map(p=>[p.version.id,projectPublicProduct(p,'listed')]));
  const allAssets=await readEditorialAssets(tx,revisions.flatMap(r=>r.content.type==='guide'?r.content.guide.assets.map(a=>a.assetId):[]));
  const availableAssets=new Set<string>();
  await Promise.all([...allAssets.values()].map(async a=>{if((adminPreview||(a.rightsBasis!=='unreviewed'&&a.rightsReviewedAt&&a.privacyReviewedAt))&&await checkedAssetBytes(a))availableAssets.add(a.id);}));
  for (const r of revisions) {
    const c=r.content, ps=productRefs(c);
    // Strict whole-document dependency policy, not a partially trimmed table.
    if (ps.some(p => !current.has(p.productId) || byReference.get(p.referencePublishedVersionId)?.product_id!==p.productId)) continue;
    const canonicalUrl=config.siteUrl+editorialPath(c.type,c.slug),rendered:Record<string,string>={bodyMd:authoredMarkdownBody(c.bodyMd,canonicalUrl)};
    const prose=c.type==='comparison'?c.comparison:c.type==='guide'?c.guide:c.category;
    for(const [key,value] of Object.entries(prose))if(key.endsWith('Md')&&typeof value==='string')rendered[key]=authoredMarkdownBody(value,canonicalUrl);
    const base={slug:c.slug,title:c.title,excerpt:c.excerpt,bodyMd:c.bodyMd,seoTitle:c.seoTitle,seoDescription:c.seoDescription,
      canonicalUrl,revisionNo:r.revisionNo,publishedAt:r.publishedAt??r.createdAt,rendered};
    const ref = (p: typeof ps[number]) => {const now=current.get(p.productId)!,saved=byReference.get(p.referencePublishedVersionId)!;
      return {facts:now.product,referenceVersionNo:saved.version_no as number,referencePublishedAt:saved.published_at!.toISOString(),versionChanged:now.versionId!==p.referencePublishedVersionId};};
    if(c.type==='comparison') {
      const v=c.comparison,products=[...v.products].sort((a,b)=>a.position-b.position).map(p=>({...ref(p),testedPlanKey:p.testedPlanKey,hasTestedPriceReference:p.testedPriceRef!==null,testRecord:v.mode==='hands_on'?p.testRecord:null}));
      for(const p of products)if(p.testRecord)for(const [key,value]of Object.entries(p.testRecord))if(key.endsWith('Md')&&typeof value==='string')rendered[`test:${p.facts.slug}:${key}`]=authoredMarkdownBody(value,canonicalUrl);
      output.set(r.id,{...base,type:'comparison',needsRetest:products.some(p=>p.versionChanged),products,
        comparison:{mode:v.mode,question:v.question,purpose:v.purpose,methodologyMd:v.methodologyMd,verdictMd:v.verdictMd,goodForMd:v.goodForMd,notForMd:v.notForMd,incomparableConditionsMd:v.incomparableConditionsMd,limitationsMd:v.limitationsMd}});
    } else if(c.type==='category') {
      const v=c.category,products=[...v.products].sort((a,b)=>a.position-b.position).map(p=>({...ref(p),fitSummaryJa:p.fitSummaryJa,notForSummaryJa:p.notForSummaryJa,selectionNote:p.selectionNote}));
      output.set(r.id,{...base,type:'category',productInfoUpdated:products.some(p=>p.versionChanged),products,category:{question:v.question,selectionCriteriaMd:v.selectionCriteriaMd,limitationsMd:v.limitationsMd}});
    } else {
      const v=c.guide;
      if(v.products.some(p=>!historical.has(p.referencePublishedVersionId))||v.assets.some(a=>!availableAssets.has(a.assetId)))continue;
      const products=[...v.products].sort((a,b)=>a.position-b.position).map(p=>{
        const t=v.mode==='hands_on'?p.testRecord:null;
        const testRecord=t?{task:t.task,environmentMd:t.environmentMd,procedureMd:t.procedureMd,resultMd:t.resultMd,limitationsMd:t.limitationsMd,testedAt:t.testedAt,reviewer:t.reviewer,repeatCount:t.repeatCount,errorCriteria:t.errorCriteria}:null;
        return{...ref(p),role:p.role,referenceFacts:historical.get(p.referencePublishedVersionId)!,referencedPlanKey:p.referencedPlanKey,hasReferencedPrice:p.referencedPriceRef!==null,testRecord};
      });
      for(const p of products)if(p.testRecord)for(const [key,value]of Object.entries(p.testRecord))if(key.endsWith('Md')&&typeof value==='string')rendered[`test:${p.facts.slug}:${key}`]=authoredMarkdownBody(value,canonicalUrl);
      const {products:_products,assets:_assets,...guide}=v;
      const assets=[...v.assets].sort((a,b)=>a.position-b.position).map(a=>{const stored=allAssets.get(a.assetId)!;return{...a,url:(adminPreview?'/api/admin/aifind/assets/':'/api/site/aifind/assets/')+a.assetId+(adminPreview?'/file':''),width:stored.width,height:stored.height};});
      output.set(r.id,{...base,type:'guide',needsRetest:products.some(p=>p.role==='primary'&&p.versionChanged),products,guide,assets});
    }
  }
  return output;
}
export function editorialSummary(d: PublicEditorial): PublicEditorialSummary {
  return { type:d.type,slug:d.slug,title:d.title,excerpt:d.excerpt,canonicalUrl:d.canonicalUrl,publishedAt:d.publishedAt,products:d.products.map(p=>({slug:p.facts.slug,displayName:p.facts.displayName})),
    mode:d.type==='comparison'?d.comparison.mode:d.type==='guide'?d.guide.mode:null,needsRetest:d.type!=='category'&&d.needsRetest,referenceDates:d.products.map(p=>p.referencePublishedAt),
    testedDates:d.type!=='category'?d.products.flatMap(p=>p.testRecord?[p.testRecord.testedAt]:[]):[] };
}
async function publishedEditorial(tx: Tx, type?: EditorialType, productId?: string): Promise<PublicEditorial[]> {
  const rows=await tx`SELECT d.published_revision_id FROM af_editorial_documents d
    JOIN af_editorial_revisions r ON r.id=d.published_revision_id AND r.document_id=d.id AND r.published_at IS NOT NULL
    WHERE d.state='published'
    AND (${type??null}::text IS NULL OR d.doc_type=${type??null})
    AND (${productId??null}::text IS NULL OR EXISTS(SELECT 1 FROM af_comparison_products p WHERE p.revision_id=d.published_revision_id AND p.product_id=${productId??null})
      OR EXISTS(SELECT 1 FROM af_category_products p WHERE p.revision_id=d.published_revision_id AND p.product_id=${productId??null})
      OR EXISTS(SELECT 1 FROM af_guide_products p WHERE p.revision_id=d.published_revision_id AND p.product_id=${productId??null}))
    ORDER BY d.first_published_at DESC,d.id LIMIT 45000`;
  const revisions=await readEditorialRevisions(tx,rows.map(r=>r.published_revision_id as string));
  const projection=await projectEditorialRevisions(tx,revisions);
  return rows.flatMap(r=>projection.has(r.published_revision_id)?[projection.get(r.published_revision_id)!]:[]);
}
export function listPublicEditorial(type: EditorialType): Promise<PublicEditorialSummary[]> {
  return readPublishedSnapshot(async tx=>(await publishedEditorial(tx,type)).map(editorialSummary));
}
export function resolvePublicEditorial(type: EditorialType, slug: string): Promise<PublicEditorialResolution> {
  if(!SlugSchema.safeParse(slug).success)return Promise.resolve({kind:'not_found'});
  return readPublishedSnapshot(async tx=>{
    const [d]=await tx`SELECT d.public_slug,d.published_revision_id FROM af_editorial_slug_claims c JOIN af_editorial_documents d ON d.id=c.document_id
      JOIN af_editorial_revisions r ON r.id=d.published_revision_id AND r.document_id=d.id AND r.published_at IS NOT NULL
      WHERE c.doc_type=${type} AND c.slug=${slug} AND d.state='published'`;
    if(!d)return{kind:'not_found'};
    const revisions=await readEditorialRevisions(tx,[d.published_revision_id]),projection=await projectEditorialRevisions(tx,revisions),document=projection.get(d.published_revision_id);
    if(!document)return{kind:'not_found'};
    if(d.public_slug!==slug)return{kind:'redirect',slug:d.public_slug};
    if(document.type==='guide'){
      const primary=document.products.find(p=>p.role==='primary');
      const productId=primary?revisions[0].content.type==='guide'?revisions[0].content.guide.products.find(p=>p.role==='primary')?.productId:null:null;
      if(productId){const related=(await publishedEditorial(tx,'comparison',productId)).concat(await publishedEditorial(tx,'category',productId)).map(editorialSummary);
        document.related={comparisons:related.filter(d=>d.type==='comparison'),categories:related.filter(d=>d.type==='category')};}
    }
    return{kind:'found',document};
  });
}
export async function relatedPublicEditorial(tx: Tx, productId: string): Promise<PublicEditorialRelated> {
  const summaries=(await publishedEditorial(tx,undefined,productId)).map(editorialSummary);
  const guides=summaries.filter(d=>d.type==='guide');
  return {comparisons:summaries.filter(d=>d.type==='comparison'),categories:summaries.filter(d=>d.type==='category'),...(guides.length?{guides}:{})};
}
export function listRelatedPublicEditorial(productSlug: string): Promise<PublicEditorialRelated> {
  return readPublishedSnapshot(async tx=>{const [p]=await tx`SELECT id FROM af_products WHERE slug=${productSlug} AND public_visibility='listed'`;
    return p?relatedPublicEditorial(tx,p.id):{comparisons:[],categories:[]};});
}
export function editorialSitemapXml(): Promise<string> {
  return readPublishedSnapshot(async tx=>{const docs=await publishedEditorial(tx);
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${docs.length?`<url><loc>${escapeXml(config.siteUrl+'/compare')}</loc></url><url><loc>${escapeXml(config.siteUrl+'/categories')}</loc></url>`:''}${docs.some(d=>d.type==='guide')?`<url><loc>${escapeXml(config.siteUrl+'/howto')}</loc></url>`:''}${docs.map(d=>`<url><loc>${escapeXml(d.canonicalUrl)}</loc><lastmod>${escapeXml(d.publishedAt)}</lastmod></url>`).join('')}</urlset>`;
  });
}
