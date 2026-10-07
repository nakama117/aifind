import {sql} from '@aihot/backend/db';
import {listPublicProducts} from '../publication/public-products.ts';
import {readAdminProduct} from '../admin/read.ts';
import {canWritePreview} from './service.ts';
import {BOOTSTRAP_SLUG,bootstrapPack} from './discovery-pack.ts';
import {inspectCatalogPack} from '../catalog-pack/import.ts';

export const discoveryCases=[
  ['P01','製品名検索','/products?q=Sakura%20Writer'],['P02','登録済み別名検索','/products?q=さくらライター'],['P03','提供元検索','/products?q=Preview%20Studio%201'],
  ['P04','用途','/products?capability=coding'],['P05','プラットフォーム','/products?platform=windows'],['P06','日本で利用可能','/products?japan=available'],
  ['P07','日本語入力・出力','/products?japanese=usable'],['P08','確認済み無料プラン','/products?free=true'],['P09','AND 組み合わせ','/products?capability=coding&platform=web&japan=available&japanese=usable&free=true'],
  ['P10','検索結果なし','/products?q=definitely-absent'],['P11','最近確認された順','/products?sort=recently_verified'],['P12','絞り込み後のページ送り','/products?capability=coding&page=2'],
  ['P13','Private / unlisted を除外','/products?q=Only'],['P14','条件クリア','/products'],['P15','ホームの Discovery','/'],
  ['P16','Pack dry-run',null],['P17','Draft-only import',null],['P18','同じ Pack を再実行',null],['P19','既存 Product conflict',null],['P20','Evidence なしは拒否',null],['P21','小数の minor units は拒否',null],['P22','import-only は公開されない','/products?q=Import%20Only'],['P23','管理者の別の Publish が必要',null],
] as const;
export async function readDiscoveryPreview(){
  const rows=await sql`SELECT id,slug,canonical_name,public_visibility FROM af_products WHERE slug LIKE 'aifind-preview-discovery-%' ORDER BY slug`;
  const [bootstrap]=await sql`SELECT id FROM af_products WHERE slug=${BOOTSTRAP_SLUG}`;
  return{cases:discoveryCases.map(([id,title,path])=>({id,title,path})),products:rows.map(p=>({id:p.id,slug:p.slug,name:p.canonical_name,visibility:p.public_visibility})),
    discovery:await listPublicProducts({limit:6}),canImport:canWritePreview(),
    bootstrapProduct:bootstrap?await readAdminProduct(bootstrap.id):null,inspection:canWritePreview()?await inspectCatalogPack(bootstrapPack()):null};
}
export type DiscoveryPreview=Awaited<ReturnType<typeof readDiscoveryPreview>>;
