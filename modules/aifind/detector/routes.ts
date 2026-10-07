import {z} from 'zod';
import type {FastifyInstance} from 'fastify';
import {handler} from '../admin/routes.ts';
import {createMonitor,listMonitors,updateMonitor} from './monitors.ts';
import {readObservation} from './observations.ts';
import {queueMonitorRun} from './jobs.ts';
import {previewEnabled,assertPreviewWrites} from '../preview/config.ts';
import {readDetectorPreview,repeatPreviewObservation} from '../preview/detector-service.ts';
import {detectorPreviewSeed} from '../preview/detector-fixtures.ts';
import {ReasonSchema} from '../admin/contracts.ts';
import {InvalidInput} from '../admin/errors.ts';
import {reviewSourcePolicy} from './source-policy.ts';
const ids=z.record(z.string(),z.string().min(1).max(80));
export function registerDetectorRoutes(app:FastifyInstance):void {
  const prefix='/api/admin/aifind';
  app.get(prefix+'/monitors',handler(async req=>{const q=z.strictObject({productId:z.string().min(1).max(80).optional()}).parse(req.query);return listMonitors(q.productId);}));
  app.post(prefix+'/monitors',handler(async(req,_reply,admin)=>createMonitor(req.body,admin.name)));
  app.patch(prefix+'/monitors/:id',handler(async(req,_reply,admin)=>updateMonitor(ids.parse(req.params).id,req.body,admin.name)));
  app.post(prefix+'/monitors/:id/policy',handler(async(req,_reply,admin)=>reviewSourcePolicy(ids.parse(req.params).id,req.body,admin.name)));
  app.post(prefix+'/monitors/:id/run',handler(async(req,_reply,admin)=>queueMonitorRun(ids.parse(req.params).id,req.body,admin.name)));
  app.get(prefix+'/observations/:id',handler(async req=>readObservation(ids.parse(req.params).id)));
  app.get(prefix+'/preview/change-detector',handler(async(_req,reply)=>{
    if(!previewEnabled())return reply.code(404).send({code:'not_found'});return readDetectorPreview();
  }));
  app.post(prefix+'/preview/change-detector/run',handler(async(req,reply,admin)=>{
    if(!previewEnabled())return reply.code(404).send({code:'not_found'});
    try {assertPreviewWrites(process.env);}catch{return reply.code(403).send({code:'forbidden'});}
    const body=z.strictObject({fixtureKey:z.enum(['main','ambiguous','stale','stale_commit','repeat_main']),reason:ReasonSchema}).parse(req.body);
    if(body.fixtureKey==='repeat_main')return repeatPreviewObservation(body.reason,admin.name);
    const fixture=(await detectorPreviewSeed())?.fixtures.find(f=>f.key===body.fixtureKey);
    if(!fixture)throw new InvalidInput('先に専用データベースに Preview seed を作成してください。');
    return queueMonitorRun(fixture.monitorId,{reason:body.reason},admin.name,{fixtureKey:body.fixtureKey});
  }));
}
