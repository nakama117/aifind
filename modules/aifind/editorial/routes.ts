import type { FastifyInstance } from 'fastify';
import type { AdminHandler } from '@aihot/api/routes/admin-auth';
import { sendProblem } from '@aihot/api/http/respond';
import { sql } from '@aihot/backend/db';
import { z } from 'zod';
import { handler } from '../admin/routes.ts';
import { InvalidInput, NotFound } from '../admin/errors.ts';
import { EditorialContentSchema, EditorialPublicationError, type EditorialType } from './contracts.ts';
import { readEditorialAdmin, readEditorialAdminIn, listEditorialAdmin, editorialProductChoices } from './read.ts';
import { createEditorial, saveEditorialDraft, createEditorialDraft, publishEditorial, withdrawEditorial, restoreEditorial } from './documents.ts';
import { editorialPublishIssues } from './validation.ts';
import { projectEditorialRevisions } from '../publication/editorial.ts';

const params=z.object({id:z.string().min(1).max(80)});
function guarded(fn:AdminHandler){return handler(async(req,reply,admin)=>{
  try{return await fn(req,reply,admin);}catch(error){
    if(error instanceof EditorialPublicationError)return sendProblem(req,reply,{status:422,code:'editorial_publication',detail:error.message});
    throw error;
  }
});}
export function registerEditorialAdminRoutes(app:FastifyInstance):void{
  const root='/api/admin/aifind';
  app.get(root+'/editorial/products',guarded(async()=>editorialProductChoices()));
  for(const [path,type] of [['compare','comparison'],['categories','category'],['howto','guide']] as const){
    const prefix=`${root}/${path}`;
    const document=async(raw:unknown)=>{const id=params.parse(raw).id,d=await readEditorialAdmin(id);if(d.type!==type)throw new NotFound('編集ドキュメントが見つかりません。');return d;};
    app.get(prefix,guarded(async()=>listEditorialAdmin(type)));
    app.post(prefix,guarded(async(req,_reply,admin)=>{
      const content=EditorialContentSchema.parse((req.body as {content?:unknown})?.content);
      if(content.type!==type)throw new InvalidInput('ドキュメントの種類が一致しません。');
      return createEditorial(req.body,admin.name);
    }));
    app.get(prefix+'/:id',guarded(async(req)=>document(req.params)));
    app.patch(prefix+'/:id/draft',guarded(async(req,_reply,admin)=>saveEditorialDraft((await document(req.params)).id,req.body,admin.name)));
    for(const [suffix,command] of [['draft',createEditorialDraft],['publish',publishEditorial],['withdraw',withdrawEditorial],['restore',restoreEditorial]] as const){
      app.post(prefix+'/:id/'+suffix,guarded(async(req,_reply,admin)=>command((await document(req.params)).id,req.body,admin.name)));
    }
    app.get(prefix+'/:id/preview',guarded(async(req)=>{
      const id=params.parse(req.params).id;
      return sql.begin('isolation level repeatable read read only',async tx=>{
        const d=await readEditorialAdminIn(tx,id);if(d.type!==type)throw new NotFound('編集ドキュメントが見つかりません。');
        const revision=d.draft??d.published;
        if(!revision)return{preview:null,issues:['保存された Revision がありません。'],revisionNo:null,kind:'none'};
        const projection=await projectEditorialRevisions(tx,[revision],true);
        return{preview:projection.get(revision.id)??null,issues:await editorialPublishIssues(tx,revision.content),revisionNo:revision.revisionNo,kind:d.draft?'draft':'published'};
      });
    }));
  }
}
export interface EditorialPreviewResult { preview: import('./public-contracts.ts').PublicEditorial|null; issues:string[]; revisionNo:number|null; kind:string }
export const adminEditorialPath=(type:EditorialType)=>type==='comparison'?'/admin/aifind/compare':type==='guide'?'/admin/aifind/howto':'/admin/aifind/categories';
