import {readFile} from 'node:fs/promises';
import {closeDb} from '@aihot/backend/db';
import {stageLaunchCorpus,rehearseLaunchPublication,publishLaunchCandidate} from '../modules/aifind/launch/staging.ts';
const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--'));
if(!file)throw Error('Usage: node scripts/stage-aifind-launch.ts <corpus.json> [--publish-simulation|--publish-candidate]');
if(args.includes('--publish-simulation')&&args.includes('--publish-candidate'))throw Error('Choose one explicit publication mode');
const actor=args.includes('--publish-candidate')?'local-launch-candidate-operator':'local-launch-operator-simulation';
try{const c=JSON.parse(await readFile(file,'utf8'));console.log(JSON.stringify(await stageLaunchCorpus(c,actor)));
  if(args.includes('--publish-simulation'))console.log(JSON.stringify(await rehearseLaunchPublication(c,'local-launch-operator-simulation','Phase 8 explicit simulation; not Owner factual approval')));
  if(args.includes('--publish-candidate'))console.log(JSON.stringify(await publishLaunchCandidate(c,actor,'Official source-backed launch publication; non-production Release Candidate')));
}finally{await closeDb();}
