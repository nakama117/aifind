import { assertPreviewWrites } from '../modules/aifind/preview/config.ts';
assertPreviewWrites(process.env);
const {seedGuidePreview}=await import('../modules/aifind/preview/guide-seed.ts');
const {closeDb}=await import('@aihot/backend/db');
try{await seedGuidePreview();console.log('Local synthetic Guide Drafts and unreviewed private image seeded. Human review and Publish are required.');}finally{await closeDb();}
