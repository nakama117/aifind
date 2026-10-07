import {sql} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {assertPreviewWrites} from './config.ts';
import {discoveryPack} from './discovery-pack.ts';
import {importCatalogPack} from '../catalog-pack/import.ts';
import {readAdminProduct} from '../admin/read.ts';
import {publishAdminDraft} from '../admin/products.ts';
import {setProductPublicVisibility} from '../catalog/public-settings.ts';
import {clonePublishedProduct,updateProductDraft} from '../catalog/versions.ts';

/** Explicit local seed only. Import remains Draft-only; human actions below are synthetic acceptance setup. */
export async function seedDiscoveryPreview():Promise<void>{
  assertPreviewWrites({...process.env,DATABASE_URL:config.databaseUrl});
  const pack=discoveryPack(),slugs=pack.products.map(p=>p.slug),existing=await sql`SELECT id,slug,canonical_name FROM af_products WHERE slug IN ${sql(slugs)}`;
  if(existing.length){
    if(existing.length!==pack.products.length||existing.some(p=>p.canonical_name!==pack.products.find(v=>v.slug===p.slug)?.canonicalName))throw Error('Preview collision/incomplete seed: use a fresh disposable database');
    for(const [i,p]of pack.products.entries()){
      const admin=await readAdminProduct(existing.find(v=>v.slug===p.slug)!.id),visibility=i===34?'private':i===35?'unlisted':'listed';
      if(!admin.published||admin.publicSettings.visibility!==visibility||(i===0&&!admin.draft))throw Error('Preview incomplete seed or later manual changes: preserve existing work and use a fresh disposable database');
    }
    return;
  }
  const imported=await importCatalogPack(pack,'synthetic-preview-import');
  for(const [i,p]of imported.products.entries()){
    const admin=await readAdminProduct(p.productId!);
    await publishAdminDraft(admin.identity.id,admin.draft!.version.id,{expectedRevision:admin.draftRevision,reason:'[SYNTHETIC] Explicit human Publish simulation for browser acceptance'},'synthetic-human-preview');
    if(i!==34){const state=await readAdminProduct(p.productId!);await setProductPublicVisibility(p.productId!,{visibility:i===35?'unlisted':'listed',expectedRevision:state.identityRevision,reason:'[SYNTHETIC] Separate human visibility simulation'},'synthetic-human-preview');}
  }
  const first=imported.products[0],draft=await clonePublishedProduct(first.productId!,'synthetic-preview-draft');
  await updateProductDraft(first.productId!,draft.version.id,{displayName:'[PREVIEW] [SYNTHETIC DRAFT ONLY] Secret Sakura',summaryJa:'下書きだけの情報です。公開検索に出てはいけません。'});
}
