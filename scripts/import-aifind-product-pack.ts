import {readFile} from 'node:fs/promises';

const args=process.argv.slice(2),fileIndex=args.indexOf('--file');
if(fileIndex<0||!args[fileIndex+1]||args.some((a,i)=>i!==fileIndex+1&&!['--file','--dry-run'].includes(a)))throw Error('Usage: node scripts/import-aifind-product-pack.ts --file <pack.json> [--dry-run]');
// Guard before backend imports/configuration and never load a production .env implicitly.
const u=new URL(process.env.DATABASE_URL??'postgres://unset/unset');
if(process.env.NODE_ENV==='production'||process.env.AIHOT_ENVIRONMENT==='production'||u.search||!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||!/^\/[a-zA-Z0-9_]+_(test|ci|preview)$/.test(u.pathname))throw Error('Only a non-production local *_test/_ci/_preview database is permitted');
for(const flag of ['COLLECT_ENABLED','MODEL_CALLS_ENABLED','FEISHU_CONTENT_PUSH_ENABLED','FEISHU_INTERNAL_ENABLED','INDEXNOW_SUBMIT_ENABLED','AIFIND_DETECTOR_ENABLED'])process.env[flag]='false';
const {inspectCatalogPack,importCatalogPack}=await import('../modules/aifind/catalog-pack/import.ts');
const {closeDb}=await import('@aihot/backend/db');
try{const input=JSON.parse(await readFile(args[fileIndex+1],'utf8')),dryRun=args.includes('--dry-run');
  const result=dryRun?await inspectCatalogPack(input):await importCatalogPack(input,'catalog-pack-cli');
  console.log(JSON.stringify({dryRun,...result},null,2));if(!result.valid)process.exitCode=1;
}finally{await closeDb();}
