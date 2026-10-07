import type {FastifyInstance} from 'fastify';
import {adminHandler} from '@aihot/api/routes/admin-auth';
import {readLaunchPreflight} from './preflight.ts';
/** Read-only readiness is useful with synthetic Preview seeding disabled. */
export function registerLaunchRoutes(app:FastifyInstance){
  for(const path of ['/api/admin/aifind/preview/launch-readiness','/api/admin/aifind/launch-readiness'])app.get(path,async(req,reply)=>{
    reply.header('X-Robots-Tag','noindex, nofollow');
    return adminHandler(async()=>readLaunchPreflight())(req,reply);
  });
}
