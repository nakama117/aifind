import { assertPreviewWrites } from '../modules/aifind/preview/config.ts';
assertPreviewWrites(process.env);
const {seedEditorialPreview}=await import('../modules/aifind/preview/editorial-seed.ts');
const {closeDb}=await import('@aihot/backend/db');
try{await seedEditorialPreview();console.log('Local synthetic Editorial Drafts seeded. Human Publish is still required.');}finally{await closeDb();}
