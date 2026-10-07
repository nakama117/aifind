import assert from 'node:assert/strict';
import {test} from 'node:test';
const selection=await import('../web/editorial-selection.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const row={productId:'product-a',referencePublishedVersionId:'version-a1',position:1,testedPlanKey:'plan-a',testedPriceRef:'price-a',testRecord:{task:'Actual task for Product A v1',resultMd:'Result belonging only to A v1'}};
function change(productId:string,versionId:string){assert.ok(selection,'Editorial reference changes must invalidate version-bound tests');return selection.changeEditorialReference(row,productId,versionId);}
test('Changing compared Product clears the previous Product Test Record and Plan/Price references',()=>{
  const updated=change('product-b','version-b1');assert.equal(updated.productId,'product-b');assert.equal(updated.referencePublishedVersionId,'version-b1');assert.equal(updated.testRecord,null);assert.equal(updated.testedPlanKey,null);assert.equal(updated.testedPriceRef,null);assert.ok(row.testRecord);assert.equal(row.testedPriceRef,'price-a');
});
test('Changing comparison reference version clears old-version tests rather than claiming a retest',()=>{
  const updated=change('product-a','version-a2');assert.equal(updated.testRecord,null);assert.equal(updated.testedPlanKey,null);assert.equal(updated.testedPriceRef,null);assert.equal(row.referencePublishedVersionId,'version-a1');
});
test('Selecting the same Product/reference retains its existing Test Record without destructive reset',()=>{
  assert.equal(change('product-a','version-a1'),row);
});
test('Category reference changes preserve authored fit notes without inventing comparison test fields',()=>{
  assert.ok(selection);const original={productId:'product-a',referencePublishedVersionId:'version-a1',position:1,fitSummaryJa:'少量の資料',notForSummaryJa:'機密資料',selectionNote:'編集条件'};const updated=selection.changeEditorialReference(original,'product-b','version-b1');assert.equal(updated.fitSummaryJa,original.fitSummaryJa);assert.equal('testRecord'in updated,false);
});
