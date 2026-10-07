import {assertPreviewWrites} from '../modules/aifind/preview/config.ts';
assertPreviewWrites(process.env);
for(const flag of ['COLLECT_ENABLED','MODEL_CALLS_ENABLED','FEISHU_CONTENT_PUSH_ENABLED','FEISHU_INTERNAL_ENABLED','INDEXNOW_SUBMIT_ENABLED','AIFIND_DETECTOR_ENABLED'])process.env[flag]='false';
const {seedDiscoveryPreview}=await import('../modules/aifind/preview/discovery-seed.ts');
const {closeDb}=await import('@aihot/backend/db');
try{await seedDiscoveryPreview();console.log('Phase 5 synthetic Preview created; Draft import and separate human Publish/visibility simulated only in disposable local DB.');}finally{await closeDb();}
