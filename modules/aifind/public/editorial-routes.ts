import type { FastifyInstance } from 'fastify';
import { renderOg } from '@aihot/api/og/render';
import { listPublicEditorial, resolvePublicEditorial, editorialSitemapXml } from '../publication/editorial.ts';
import { listHomeProducts } from '../publication/public-products.ts';
export function registerEditorialPublicRoutes(app:FastifyInstance):void{
  const root='/api/site/aifind',fresh={'Cache-Control':'no-store','X-Accel-Expires':'0'};
  for(const[path,type]of[['compare','comparison'],['categories','category'],['howto','guide']]as const){
    app.get(root+'/'+path,async(_req,reply)=>{reply.headers(fresh);return listPublicEditorial(type);});
    app.get(root+'/'+path+'/:slug',async(req,reply)=>{reply.headers(fresh);const r=await resolvePublicEditorial(type,(req.params as {slug:string}).slug);return r.kind==='not_found'?reply.code(404).send(r):r;});
    app.get('/og/aifind-editorial/'+path+'/:file',async(req,reply)=>{
      reply.headers(fresh);const file=(req.params as {file:string}).file;if(!file.endsWith('.png'))return reply.code(404).send('Not found');
      const r=await resolvePublicEditorial(type,file.slice(0,-4));if(r.kind==='not_found')return reply.code(404).send('Not found');
      if(r.kind==='redirect')return reply.code(301).header('Location',`/og/aifind-editorial/${path}/${r.slug}.png`).send();
      return reply.type('image/png').send((await renderOg({kicker:type==='comparison'?'AIを比べる':type==='guide'?'AIを使う':'用途から探す',title:r.document.title,subtitle:r.document.excerpt})).png);
    });
  }
  app.get(root+'/home',async(_req,reply)=>{reply.headers(fresh);const[products,comparisons,categories,guides]=await Promise.all([listHomeProducts(),listPublicEditorial('comparison'),listPublicEditorial('category'),listPublicEditorial('guide')]);return{products,comparisons:comparisons.slice(0,4),categories:categories.slice(0,4),guides:guides.slice(0,4)};});
  app.get('/sitemap-aifind-editorial.xml',async(_req,reply)=>reply.headers(fresh).type('application/xml; charset=utf-8').send(await editorialSitemapXml()));
}
