import assert from "node:assert/strict";
import { test } from "node:test";
import type { LbBoardEntry } from "../contracts.ts";
import type { LbPrice } from "../contracts.ts";

test('an unknown price with an editorial note does not claim the vendor has no paid API',async()=>{
  const {price}=await import('../web/format.ts');
  const value:LbPrice={currency:'USD',input:null,output:null,cached:null,inputCny:null,outputCny:null,cachedCny:null,officialUrl:'https://example.org',note:'価格を再確認中です',asOf:null,origin:'unknown'};
  assert.equal(price(value),'未確認');
});

test("Japan display crosses midnight in JST without changing the stored UTC timestamp", async () => {
  const { stamp } = await import("../web/format.ts");
  assert.equal(stamp("2026-10-03T16:00:00Z"), "2026/10/04 01:00 JST");
  assert.equal(stamp(null), "未確認");
});

test("combined reader filters retain published rank and include qualifying models beyond the unfiltered top 30", async () => {
  const { selectEntries } = await import("../web/format.ts");
  const entries = Array.from({length:60},(_,i)=>({rank:i+1,score:100-i,model:{name:`Model ${i}`,slug:`m-${i}`,releasedAt:null},coverage:0.5,sourceCount:3,price:null,access:{domestic:i%2===0,weightsUrl:i%3===0?"https://example.org/weights":null}} as LbBoardEntry));
  const result=selectEntries(entries,{domestic:true,open:true,sort:"rank"});
  assert.deepEqual(result.map(e=>e.rank),[1,7,13,19,25,31,37,43,49,55]);
  assert.equal(result[5],entries[30]);
});

test('leaderboard metadata canonicalizes the overall alias and exposes only actual published list positions',async()=>{
  const format=await import('../web/format.ts');
  const seo=(format as unknown as {leaderboardSeo?:(input:unknown)=>{path:string;noindex:boolean;jsonLd:Array<Record<string,any>>}}).leaderboardSeo;
  const input={kind:'board',key:'overall',path:'/leaderboard/boards/overall?utm_source=test',title:'総合モデルランキング',base:'https://example.org',publishedAt:'2026-10-04T00:00:00Z',entries:[{rank:2,model:{name:'Actual model',slug:'actual'}}]};
  const result=seo?.(input);
  assert.equal(result?.path,'/leaderboard');
  assert.equal(result?.noindex,false);
  assert.equal(result?.jsonLd[0]?.mainEntity.itemListElement[0].position,2);
  assert.equal(result?.jsonLd[0]?.mainEntity.itemListElement[0].url,'https://example.org/leaderboard/actual');
  assert.equal(JSON.stringify(result).includes('AggregateRating'),false);
  assert.equal(seo?.({...input,publishedAt:null,entries:[]}).noindex,true);
});
