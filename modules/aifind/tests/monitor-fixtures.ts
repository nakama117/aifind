import {createMonitor,updateMonitor} from '../detector/monitors.ts';
import {reviewSourcePolicy} from '../detector/source-policy.ts';
import {assertCatalogWrites} from '../catalog-pack/import.ts';

/** Test-only review of existing fake endpoints, not a real source rights approval. */
export async function createReviewedTestMonitor(input:Record<string,unknown>,actor:string){
  assertCatalogWrites(process.env);
  const host=new URL(String(input.url)).hostname;
  if(!['localhost','127.0.0.1','[::1]','synthetic.example','synthetic.invalid'].includes(host))throw Error('Only a local/fake test source may use fixture approval');
  const m=await createMonitor({...input,enabled:false},actor),reviewed=await reviewSourcePolicy(m.id,{expectedRevision:m.revision,status:'approved',retentionClass:'evidence_only',excerptDays:30,
    allowAutomatedFetch:true,allowJina:input.allowJina===true,reason:'[TEST] Local fake service only; not a real source rights approval'},actor);
  return input.enabled?updateMonitor(m.id,{enabled:true,expectedRevision:reviewed.revision,reason:String(input.reason)},actor):reviewed;
}
