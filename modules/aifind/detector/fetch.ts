import {load} from 'cheerio';
import {guardedFetch} from '@aihot/backend/lib/http-fetch';
import {jinaRead} from '@aihot/backend/providers/jina';
import {sql} from '@aihot/backend/db';
import {ReceiptUnknownError,ReceiptBusyError} from '@aihot/backend/providers/receipts';
import {SITE} from '@aihot/site';
import type {Monitor} from './contracts.ts';
import type {FetchResult} from './observations.ts';
import {sha256} from './validate.ts';
import {assertMonitorPolicy} from './source-policy.ts';
import {readMonitor} from './monitors.ts';

/** Conservative RFC-style Allow/Disallow matching; inaccessible robots means no source fetch. */
export function robotsAllowed(text:string,url:string):boolean {
  const groups:Array<{agents:string[];rules:Array<{allow:boolean;path:string}>}>=[];
  let group:typeof groups[number]|null=null,hasRules=false;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.split('#')[0].trim(),at=line.indexOf(':');if(at<0)continue;
    const field=line.slice(0,at).trim().toLowerCase(),value=line.slice(at+1).trim();
    if(field==='user-agent'){if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}
    else if(group && ['allow','disallow'].includes(field)){hasRules=true;if(value)group.rules.push({allow:field==='allow',path:value});}
  }
  const agent=SITE.crawlerName.toLowerCase();
  const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.includes(a)));
  const applicable=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  const u=new URL(url),pathname=u.pathname+u.search;
  const rules=applicable.flatMap(g=>g.rules).filter(r=>{
    const end=r.path.endsWith('$'),pattern=(end?r.path.slice(0,-1):r.path).split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return new RegExp('^'+pattern+(end?'$':'')).test(pathname);
  }).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length || Number(b.allow)-Number(a.allow));
  return rules[0]?.allow??true;
}
export async function fetchMonitor(m:Monitor,requestKey:string):Promise<FetchResult> {
  // Recheck saved review immediately before transport, including already queued or manually invoked jobs.
  const recheck=async()=>{
    const current=await readMonitor(m.id);assertMonitorPolicy(current);
    if(current.revision!==m.revision)throw new Error('Source policy / monitor changed before fetch');
  };
  await recheck();
  const at=new Date().toISOString();
  try {
    const robots=await guardedFetch(new URL('/robots.txt',m.url).href,{maxBytes:128000,timeoutMs:15000,maxRedirects:0});
    if(robots.status!==404 && (robots.status!==200||!robotsAllowed(robots.text(),m.url)))return {text:'',httpStatus:robots.status,fetchOutcome:'blocked',retrievedAt:at,reason:'robots policy refused/unavailable'};
    // Redirects need explicit monitor re-registration so a new path is checked before it is fetched.
    await recheck();
    const response=await guardedFetch(m.url,{maxBytes:1024*1024,timeoutMs:20000,maxRedirects:0});
    if(response.status!==200)return {text:'',httpStatus:response.status,fetchOutcome:response.status===404?'not_found':response.status===401||response.status===403?'blocked':'error',retrievedAt:at,reason:'HTTP '+response.status};
    const html=response.text(),type=response.headers.get('content-type')??'';
    if(/captcha|verify you are human|access denied|sign in to continue|subscribe to (?:read|continue)|ログインが必要/i.test(html))return {text:'',httpStatus:200,fetchOutcome:'blocked',retrievedAt:at,reason:'login/paywall/anti-bot content'};
    let text=html,receiptId:number|undefined;
    if(type.includes('html')||/^\s*<!doctype|^\s*<html/i.test(html)){
      const $=load(html);$('script,style,noscript,nav,footer,header,form').remove();
      const main=$('main,article').first();text=(main.length?main:$('body')).text().replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
    }
    if(!text.trim() && m.allowJina) {
      const subject='aifind:monitor:'+m.id;
      const [outstanding]=await sql`SELECT id,status FROM receipts WHERE service='jina' AND purpose='aifind.observe.render' AND subject=${subject}
        AND status IN ('pending','unknown') ORDER BY id LIMIT 1`;
      if(outstanding?.status==='unknown')throw new ReceiptUnknownError(outstanding.id,'Jina outcome unknown; wait for receipt Recovery');
      if(outstanding)throw new ReceiptBusyError('Jina receipt '+outstanding.id+' is in flight');
      const [recoverable]=await sql`SELECT request->>'logicalIdentity' AS identity FROM receipts WHERE service='jina' AND purpose='aifind.observe.render' AND subject=${subject}
        AND status IN ('received','failed') AND request->>'url'=${m.url} AND request->>'logicalIdentity' IS NOT NULL ORDER BY id DESC LIMIT 1`;
      // Received answers and explicitly released requests keep their identity across new jobs.
      // Completed reads retain normal same-job reuse; new jobs can observe a newer rendering.
      await recheck();
      const rendered=await jinaRead(m.url,{purpose:'aifind.observe.render',subject:'aifind:monitor:'+m.id,
        logicalIdentity:recoverable?.identity??sha256(`${m.id}:${m.revision}:${requestKey}`),cacheToleranceSeconds:0});
      text=rendered.markdown;
      receiptId=rendered.receiptId;
    }
    return {text,httpStatus:200,fetchOutcome:text.trim()?'ok':'empty',retrievedAt:at,receiptId,
      etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
  } catch(error) {
    if((error as {receiptId?:number})?.receiptId)throw error;
    return {text:'',httpStatus:null,fetchOutcome:/timeout|aborted/i.test(String(error))?'timeout':'error',retrievedAt:at,reason:String(error).slice(0,1000)};
  }
}
