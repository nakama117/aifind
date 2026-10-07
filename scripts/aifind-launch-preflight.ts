// Read-only. Never migrates, imports, seeds, fetches or publishes.
import {readLaunchPreflight} from '../modules/aifind/launch/preflight.ts';
import {closeDb} from '@aihot/backend/db';
try{const result=await readLaunchPreflight();console.log(JSON.stringify(result,null,2));if(result.checks.some(c=>c.status==='BLOCK'))process.exitCode=2;}finally{await closeDb();}
