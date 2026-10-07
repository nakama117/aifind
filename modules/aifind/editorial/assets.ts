import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { sql, type Db, type Tx } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { audit } from '@aihot/backend/audit';
import { newUuid } from '@aihot/backend/lib/ids';
import { PublishAuditSchema, HttpUrlSchema } from '../contracts.ts';
import { adminTransaction } from '../admin/products.ts';
import { InvalidInput, NotFound } from '../admin/errors.ts';
import type { GuideContent } from './contracts.ts';

export const EDITORIAL_IMAGE_LIMIT = 5 * 1024 * 1024;
export interface EditorialAsset {
  id:string; originalSha256:string; processedSha256:string; mime:string; byteSize:number; width:number; height:number; storageKey:string;
  createdAt:string; uploader:string; rightsBasis:'unreviewed'|'self_captured'|'owned'|'licensed'; rightsNote:string; sourceUrl:string|null;
  rightsReviewedAt:string|null; rightsReviewer:string|null; privacyReviewedAt:string|null; privacyReviewer:string|null;
}
const reviewSchema=z.strictObject({rightsBasis:z.enum(['unreviewed','self_captured','owned','licensed']),rightsNote:z.string().trim().max(2000),
  sourceUrl:HttpUrlSchema.nullable(),rightsReviewed:z.boolean(),privacyReviewed:z.boolean(),reason:PublishAuditSchema.shape.reason})
  .refine(r=>!r.rightsReviewed||(r.rightsBasis!=='unreviewed'&&r.rightsNote.length>0),'Rights review requires an identified basis and note');
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function dto(r:Record<string,any>):EditorialAsset{return{id:r.id,originalSha256:r.original_sha256,processedSha256:r.processed_sha256,mime:r.mime,byteSize:r.byte_size,width:r.width,height:r.height,storageKey:r.storage_key,
  createdAt:r.created_at.toISOString(),uploader:r.uploader,rightsBasis:r.rights_basis,rightsNote:r.rights_note,sourceUrl:r.source_url,rightsReviewedAt:r.rights_reviewed_at?.toISOString()??null,rightsReviewer:r.rights_reviewer,
  privacyReviewedAt:r.privacy_reviewed_at?.toISOString()??null,privacyReviewer:r.privacy_reviewer};}
export async function readEditorialAsset(id:string,db:Db=sql):Promise<EditorialAsset|null>{
  const [r]=await db`SELECT * FROM af_editorial_assets WHERE id=${id}`;return r?dto(r):null;
}
export async function listEditorialAssets():Promise<EditorialAsset[]>{return(await sql`SELECT * FROM af_editorial_assets ORDER BY created_at DESC,id LIMIT 100`).map(dto);}
export async function readEditorialAssets(db:Db,ids:string[]):Promise<Map<string,EditorialAsset>>{
  if(!ids.length)return new Map();return new Map((await db`SELECT * FROM af_editorial_assets WHERE id IN ${db([...new Set(ids)])}`).map(r=>[r.id,dto(r)]));
}
function location(a:EditorialAsset){
  if(a.storageKey!=='uploads/aifind-editorial/'+a.processedSha256+'.webp'||!/^[a-f0-9]{64}$/.test(a.processedSha256))throw new InvalidInput('Invalid controlled asset storage key');
  return path.join(config.dataDir,a.storageKey);
}
export async function checkedAssetBytes(a:EditorialAsset):Promise<Buffer|null>{
  try {const b=await fs.readFile(location(a));return b.length===a.byteSize&&hash(b)===a.processedSha256?b:null;}
  catch(e){if(['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))return null;throw e;}
}
export async function assetBytes(id:string):Promise<Buffer|null>{const a=await readEditorialAsset(id);return a?checkedAssetBytes(a):null;}
function sniff(b:Buffer):'png'|'jpeg'|'webp'|null{
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'png';
  if(b[0]===255&&b[1]===216&&b[2]===255)return'jpeg';
  if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return'webp';
  return null;
}
function animatedPng(b:Buffer){for(let n=8;n+12<=b.length;){const size=b.readUInt32BE(n);if(b.toString('ascii',n+4,n+8)==='acTL')return true;n+=12+size;}return false;}
export async function uploadEditorialAsset(input:{bytes:Buffer;fileName:string;mime:string;reason:string},actor:string):Promise<EditorialAsset>{
  PublishAuditSchema.parse({actor,reason:input.reason});
  const {bytes,fileName,mime}=input, format=sniff(bytes), ext=path.extname(fileName).toLowerCase();
  if(!bytes.length||bytes.length>EDITORIAL_IMAGE_LIMIT||fileName.length>200||/[\\/:<>|?*\x00-\x1f]/.test(fileName)||fileName==='.'||fileName==='..'
    ||!format||mime!=='image/'+format||!(format==='jpeg'?['.jpg','.jpeg']:['.'+format]).includes(ext))throw new InvalidInput('PNG / JPEG / WebP (5 MiB 以下) が必要です。');
  let sanitized:Buffer, width:number,height:number;
  try{
    const decoder=sharp(bytes,{limitInputPixels:60_000_000,failOn:'warning',animated:true}),m=await decoder.metadata();
    if(!m.width||!m.height||m.width*m.height>60_000_000||(m.pages??1)>1||(format==='png'&&animatedPng(bytes)))throw Error('Static image required');
    await decoder.clone().stats(); // Complete decode, not just a plausible header.
    const out=await sharp(bytes,{limitInputPixels:60_000_000,failOn:'warning'}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
    sanitized=out.data;width=out.info.width;height=out.info.height;
    if(sanitized.length>EDITORIAL_IMAGE_LIMIT)throw Error('Sanitized image too large');
  }catch{throw new InvalidInput('画像を安全にデコードできません。静止画像を確認してください。');}
  const originalSha256=hash(bytes),processedSha256=hash(sanitized),storageKey='uploads/aifind-editorial/'+processedSha256+'.webp';
  const destination=path.join(config.dataDir,storageKey),temporary=destination+'.'+newUuid()+'.tmp';
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(temporary,sanitized,{flag:'wx'});
  try{await fs.rename(temporary,destination);}catch(e){await fs.unlink(temporary).catch(()=>{});if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  // The file precedes its row. A failed transaction leaves only a private orphan; never
  // unlink a deduplicated file which another concurrent upload may already reference.
  return adminTransaction(async tx=>{
    const id=newUuid();await tx`INSERT INTO af_editorial_assets(id,original_sha256,processed_sha256,mime,byte_size,width,height,storage_key,uploader)
      VALUES(${id},${originalSha256},${processedSha256},'image/webp',${sanitized.length},${width},${height},${storageKey},${actor})`;
    const a=(await readEditorialAsset(id,tx))!;await audit(actor,'aifind.asset.create','aifind:asset:'+id,input.reason,null,{id,originalSha256,processedSha256,width,height},{db:tx});return a;
  });
}
export async function reviewEditorialAsset(id:string,input:unknown,actor:string):Promise<EditorialAsset>{
  const r=reviewSchema.parse(input);PublishAuditSchema.parse({actor,reason:r.reason});
  return adminTransaction(async tx=>{
    const [row]=await tx`SELECT * FROM af_editorial_assets WHERE id=${id} FOR UPDATE`;if(!row)throw new NotFound('画像が見つかりません。');
    await tx`UPDATE af_editorial_assets SET rights_basis=${r.rightsBasis},rights_note=${r.rightsNote},source_url=${r.sourceUrl},
      rights_reviewed_at=CASE WHEN ${r.rightsReviewed} THEN clock_timestamp() ELSE NULL END,rights_reviewer=${r.rightsReviewed?actor:null},
      privacy_reviewed_at=CASE WHEN ${r.privacyReviewed} THEN clock_timestamp() ELSE NULL END,privacy_reviewer=${r.privacyReviewed?actor:null} WHERE id=${id}`;
    const a=(await readEditorialAsset(id,tx))!;await audit(actor,'aifind.asset.review','aifind:asset:'+id,r.reason,dto(row),a,{db:tx});return a;
  });
}
export async function assetPublishIssues(ids:string[],db:Db=sql):Promise<string[]>{
  if(!ids.length)return[];
  const rows=await db`SELECT * FROM af_editorial_assets WHERE id IN ${db(ids)}`,byId=new Map(rows.map(r=>[r.id,dto(r)])),issues:string[]=[];
  await Promise.all(ids.map(async id=>{const a=byId.get(id);if(!a){issues.push('asset:'+id+': missing');return;}
    if(a.rightsBasis==='unreviewed'||!a.rightsReviewedAt)issues.push('asset:'+id+': rights review が必要です。');
    if(!a.privacyReviewedAt)issues.push('asset:'+id+': privacy review が必要です。');
    if(!await checkedAssetBytes(a))issues.push('asset:'+id+': persistent file missing / hash mismatch');}));
  return issues.sort();
}
export async function syncGuideAssets(tx:Tx,revisionId:string,refs:GuideContent['assets'],actor:string,reason:string){
  const old=await tx`SELECT * FROM af_editorial_revision_assets WHERE revision_id=${revisionId}`;
  await tx`DELETE FROM af_editorial_revision_assets WHERE revision_id=${revisionId}`;
  for(const r of refs)await tx`INSERT INTO af_editorial_revision_assets(revision_id,asset_id,role,position,caption_ja,alt_ja)
    VALUES(${revisionId},${r.assetId},${r.role},${r.position},${r.captionJa},${r.altJa})`;
  const [revision]=await tx`SELECT document_id FROM af_editorial_revisions WHERE id=${revisionId}`;
  for(const a of old)if(!refs.some(r=>r.assetId===a.asset_id))await audit(actor,'aifind.asset.detach','aifind:editorial:'+revision.document_id,reason,{revisionId,assetId:a.asset_id},null,{db:tx});
  for(const r of refs){const prior=old.find(a=>a.asset_id===r.assetId);
    if(!prior||prior.position!==r.position||prior.role!==r.role||prior.caption_ja!==r.captionJa||prior.alt_ja!==r.altJa)await audit(actor,prior?'aifind.asset.update':'aifind.asset.attach','aifind:editorial:'+revision.document_id,reason,prior??null,{revisionId,...r},{db:tx});}
}
