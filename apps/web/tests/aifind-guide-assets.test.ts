import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendUploadedGuideAsset } from '../../../modules/aifind/web/guide-assets.ts';
import type { GuideContent } from '../../../modules/aifind/editorial/contracts.ts';
type Assets=GuideContent['assets'];
const asset=(assetId:string,position:number):Assets[number]=>({assetId,position,role:'step',captionJa:'保存済みの説明',altJa:'保存済みの alt'});
test('Delayed Guide upload preserves intervening caption/alt/role changes and current order',async()=>{
  let latest:Assets=[asset('a',1),asset('b',2)];
  let finish!:(id:string)=>void;const upload=new Promise<string>(resolve=>{finish=resolve;}).then(id=>{latest=appendUploadedGuideAsset(latest,id);});
  latest=[{...latest[1],position:1,captionJa:'アップロード中に直した説明',altJa:'新しい alt',role:'result'}, {...latest[0],position:2}];
  const edited=[...latest];finish('new');await upload;
  assert.deepEqual(latest.slice(0,2),edited);assert.equal(latest[2].position,3);assert.equal(latest[2].assetId,'new');
});
test('Delayed Guide upload never resurrects an intervening detached asset',async()=>{
  let latest:Assets=[asset('removed',1)];
  let finish!:(id:string)=>void;const upload=new Promise<string>(resolve=>{finish=resolve;}).then(id=>{latest=appendUploadedGuideAsset(latest,id);});
  latest=[];finish('new');await upload;assert.deepEqual(latest,[{assetId:'new',position:1,role:'step',captionJa:'',altJa:''}]);
});
test('Guide upload completion rechecks the current30 relation bound and never duplicates an ID',()=>{
  const full=Array.from({length:30},(_,i)=>asset('asset'+i,i+1));
  assert.deepEqual(appendUploadedGuideAsset(full,'new'),full);
  assert.deepEqual(appendUploadedGuideAsset(full.slice(0,2),'asset0'),full.slice(0,2));
});
