import { sql } from '@aihot/backend/db';
import { readEditorialAdminIn } from '../editorial/read.ts';
import { listPublicEditorial } from '../publication/editorial.ts';
const names=['Comparison Draft','Comparison Preview','Human Publish','Public Compare','Current Product facts','reference Product versions','Product Published version update','dynamic table updates','verdict unchanged','needs_retest becomes visible','official_sources ≠ hands_on','Test Record hands_on','Category Draft','Category 3–5 Products','Category Publish','Category public page','Draft revision change does not affect public','Restore old revision as new Draft','slug history 301','private/unlisted dependency invalidates public editorial','Withdraw removes public route','sitemap removal','Product related comparison link','mobile comparison table'];
export async function readEditorialPreview(){
  const documents=await sql.begin('isolation level repeatable read read only',async tx=>{const rows=await tx`SELECT DISTINCT d.id FROM af_editorial_documents d JOIN af_editorial_revisions r ON r.document_id=d.id WHERE r.slug LIKE 'aifind-preview-editorial-%' ORDER BY d.id`;const output=[];for(const r of rows)output.push(await readEditorialAdminIn(tx,r.id));return output;});
  const [comparisons,categories]=await Promise.all([listPublicEditorial('comparison'),listPublicEditorial('category')]);
  return{synthetic:true,seedOnRead:false,cases:names.map((name,i)=>({id:'P'+String(i+1).padStart(2,'0'),name})),documents,comparisons,categories};
}
export type EditorialPreview=Awaited<ReturnType<typeof readEditorialPreview>>;
