import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '@aihot/backend/db';
import { readPublishedSnapshot } from '@aihot/backend/publication/snapshot';
import { handler } from '../admin/routes.ts';
import { InvalidInput, NotFound } from '../admin/errors.ts';
import { uploadEditorialAsset, reviewEditorialAsset, readEditorialAsset, readEditorialAssets, listEditorialAssets, assetBytes, checkedAssetBytes, EDITORIAL_IMAGE_LIMIT } from './assets.ts';
import { readEditorialRevisions } from './read.ts';
import { projectEditorialRevisions } from '../publication/editorial.ts';

export function registerEditorialAssetRoutes(app:FastifyInstance){
  const root='/api/admin/aifind/assets';
  app.get(root,handler(async req=>{
    const q=z.strictObject({ids:z.string().min(1).max(1109).optional()}).parse(req.query);
    if(!q.ids)return listEditorialAssets();
    const ids=z.array(z.uuid()).max(30).parse(q.ids.split(','));
    return [...(await readEditorialAssets(sql,ids)).values()];
  }));
  app.post(root,{bodyLimit:EDITORIAL_IMAGE_LIMIT+64*1024},handler(async(req,_reply,admin)=>{
    let form:FormData;
    try{form=await new Response(req.body as Buffer<ArrayBuffer>,{headers:{'content-type':String(req.headers['content-type']??'')}}).formData();}
    catch{throw new InvalidInput('multipart image / reason が必要です。');}
    const files=form.getAll('image'),reason=form.get('reason');
    if(files.length!==1||!(files[0] instanceof File)||typeof reason!=='string'||[...form.keys()].some(k=>!['image','reason'].includes(k)))throw new InvalidInput('画像は 1 点ずつアップロードしてください。');
    const f=files[0];return uploadEditorialAsset({bytes:Buffer.from(await f.arrayBuffer()),fileName:f.name,mime:f.type,reason},admin.name);
  }));
  app.post(root+'/:id/review',handler(async(req,_reply,admin)=>reviewEditorialAsset((req.params as {id:string}).id,req.body,admin.name)));
  app.get(root+'/:id/file',handler(async(req,reply)=>{
    const bytes=await assetBytes((req.params as {id:string}).id);if(!bytes)throw new NotFound('画像ファイルが見つかりません。');
    return reply.header('X-Content-Type-Options','nosniff').type('image/webp').send(bytes);
  }));
  app.get('/api/site/aifind/assets/:id',async(req,reply)=>{
    reply.headers({'Cache-Control':'no-store','X-Accel-Expires':'0','X-Content-Type-Options':'nosniff'});
    const id=(req.params as {id:string}).id;
    const bytes=await readPublishedSnapshot(async tx=>{
      const rows=await tx`SELECT d.published_revision_id FROM af_editorial_documents d
        JOIN af_editorial_revisions r ON r.id=d.published_revision_id AND r.document_id=d.id AND r.published_at IS NOT NULL
        JOIN af_editorial_revision_assets a ON a.revision_id=r.id WHERE d.doc_type='guide' AND d.state='published' AND a.asset_id=${id}`;
      if(!rows.length)return null;
      const eligible=await projectEditorialRevisions(tx,await readEditorialRevisions(tx,rows.map(r=>r.published_revision_id as string)));
      if(!eligible.size)return null;
      const a=await readEditorialAsset(id,tx);return a?checkedAssetBytes(a):null;
    });
    return bytes?reply.type('image/webp').send(bytes):reply.code(404).send({kind:'not_found'});
  });
}
