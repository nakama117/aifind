import { sql } from '@aihot/backend/db';
import { readEditorialAdminIn } from '../editorial/read.ts';
import { listPublicEditorial } from '../publication/editorial.ts';
const cases=['Guide Draft','Guide Admin Preview','official_sources label','Human Publish','/howto directory','/howto/:slug','Product current facts','reference Product version','Product Draft no effect','Product Publish → needs_retest','steps remain unchanged','hands_on Test Record','testedAt visible','screenshot upload','sanitized public rendition','original not public','Draft asset 404 public','rights review gate','privacy review gate','Restore revision with assets','slug history','Product dependency invalidation','Withdraw','sitemap removal','Product related Guide','backup contains Guide asset'];
export async function readGuidePreview(){
  const documents=await sql.begin('isolation level repeatable read read only',async tx=>{
    const rows=await tx`SELECT DISTINCT d.id FROM af_editorial_documents d JOIN af_editorial_revisions r ON r.document_id=d.id WHERE d.doc_type='guide' AND r.slug LIKE 'aifind-preview-guide-%' ORDER BY d.id`;
    const output=[];for(const r of rows)output.push(await readEditorialAdminIn(tx,r.id));return output;
  });
  return{synthetic:true,seedOnRead:false,cases:cases.map((name,i)=>({id:'P'+String(i+1).padStart(2,'0'),name})),documents,guides:await listPublicEditorial('guide')};
}
export type GuidePreview=Awaited<ReturnType<typeof readGuidePreview>>;
