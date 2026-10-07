import {assertPreviewWrites} from '../modules/aifind/preview/config.ts';
assertPreviewWrites(process.env);
const {seedDetectorPreview}=await import('../modules/aifind/preview/detector-seed.ts');
const {closeDb}=await import('@aihot/backend/db');
try {console.log(JSON.stringify({seed:await seedDetectorPreview(),synthetic:true,production:false}));}finally{await closeDb();}
