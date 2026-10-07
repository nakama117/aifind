import type { FastifyInstance } from 'fastify';
import { actorOf } from '@aihot/backend/admin/auth';
import { adminHandler } from '@aihot/api/routes/admin-auth';
import { sendProblem } from '@aihot/api/http/respond';
import { leaderboardAdminModels,leaderboardAdminOverview,leaderboardAdminPreview,publishLeaderboardRun,queueLeaderboardOperation,saveLeaderboardContext,saveLeaderboardFx,saveLeaderboardPrice } from '../backend/admin.ts';
import type { LeaderboardOperation } from '../admin-contracts.ts';

export function registerLeaderboardAdmin(app:FastifyInstance) {
  const p='/api/admin/model-leaderboard';
  app.get(p,adminHandler(async()=>leaderboardAdminOverview()));
  app.get(p+'/models',adminHandler(async req=>leaderboardAdminModels((req.query as {q?:string}).q??'')));
  for(const operation of ['refresh','compute','context','fx','prices'] as LeaderboardOperation[]) {
    app.post(p+(operation==='refresh'?'/refresh':`/queue/${operation}`),adminHandler(async(req,reply,admin)=>{
      const result=await queueLeaderboardOperation(operation,req.body,actorOf(admin));
      return reply.code(202).send(result);
    }));
  }
  app.post(p+'/models/:slug/price',adminHandler(async(req,_reply,admin)=>saveLeaderboardPrice((req.params as {slug:string}).slug,req.body,actorOf(admin))));
  app.post(p+'/models/:slug/context',adminHandler(async(req,_reply,admin)=>saveLeaderboardContext((req.params as {slug:string}).slug,req.body,actorOf(admin))));
  app.post(p+'/fx',adminHandler(async(req,_reply,admin)=>saveLeaderboardFx(req.body,actorOf(admin))));
  app.get(p+'/runs/:id',adminHandler(async(req,reply)=>{
    const data=await leaderboardAdminPreview((req.params as {id:string}).id);
    return data??sendProblem(req,reply,{status:404,code:'not_found',detail:'集计不存在'});
  }));
  app.post(p+'/runs/:id/publish',adminHandler(async(req,_reply,admin)=>publishLeaderboardRun((req.params as {id:string}).id,req.body,actorOf(admin))));
}
