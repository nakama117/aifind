// Serve an explicitly prepared candidate DB through normal public routes. No startup data writes.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCatalogWrites} from '../modules/aifind/catalog-pack/import.ts';
import {prepareLaunchRun} from './lib/aifind-launch-runtime.ts';
assertCatalogWrites(process.env);
if(!new URL(process.env.DATABASE_URL!).pathname.endsWith('_launch_candidate_test'))throw Error('Dedicated local *_launch_candidate_test database required; never reuse Preview');
const root=fileURLToPath(new URL('..',import.meta.url)),dataDir=path.resolve(process.env.AIHOT_DATA_DIR??'');
const relative=path.relative(path.join(root,'.data'),dataDir);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Explicit owned .data directory required');
if(!fs.existsSync(path.join(root,'apps/web/build/server/index.js')))throw Error('Build @aihot/web first');
const webPort=Number(process.env.WEB_PORT??4000),apiPort=Number(process.env.API_PORT??4001);
if(![webPort,apiPort].every(p=>Number.isInteger(p)&&p>1024&&p<65536)||webPort===apiPort)throw Error('Distinct loopback ports required');
fs.mkdirSync(dataDir,{recursive:true});const launch=prepareLaunchRun(dataDir,webPort,new URL(process.env.DATABASE_URL!).pathname,'/admin/aifind/launch-readiness'),{password,passwordFile}=launch;
const inherited={...process.env};for(const k of Object.keys(inherited))if(/API_KEY|PASSWORD|SECRET|TOKEN|EGRESS_PROXY_URL|DB_BACKUP_STORE/.test(k)||k.startsWith('FEISHU_')||k.startsWith('DEV_AUTH_'))delete inherited[k];
delete inherited.OPENAI_BASE_URL;
const env:NodeJS.ProcessEnv={...inherited,DATABASE_URL:process.env.DATABASE_URL!,AIHOT_DATA_DIR:dataDir,AIHOT_CREDENTIALS_DIR:path.join(path.dirname(dataDir),'no-credentials'),NODE_ENV:'development',AIHOT_ENVIRONMENT:'launch-candidate',
  SITE_URL:`http://localhost:${webPort}`,API_BASE_URL:`http://127.0.0.1:${apiPort}`,API_PORT:String(apiPort),WEB_PORT:String(webPort),API_HOST:'127.0.0.1',WEB_HOST:'127.0.0.1',
  ADMIN_PASSWORD:password,SESSION_SECRET:randomBytes(32).toString('hex'),IMG_PROXY_SIGN_SECRET:randomBytes(32).toString('hex'),SITE_PREVIEW:'false',AIFIND_PREVIEW_ENABLED:'false',AIFIND_DETECTOR_ENABLED:'false',
  COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',ALLOW_PRIVATE_NETWORK_FETCH:'false',TRUST_PROXY:'false'};
const webEnv={...env};for(const k of Object.keys(webEnv))if(/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(k))delete webEnv[k];
const children=[spawn(process.execPath,[path.join(root,'apps/api/src/main.ts')],{cwd:root,env,stdio:'inherit',windowsHide:true}),
  spawn(process.execPath,[path.join(root,'apps/web/server.ts')],{cwd:root,env:webEnv,stdio:'inherit',windowsHide:true}),
  spawn(process.execPath,[path.join(root,'apps/worker/src/main.ts')],{cwd:root,env,stdio:'inherit',windowsHide:true})];
try{launch.record({launcher:process.pid,api:children[0].pid??null,web:children[1].pid??null,worker:children[2].pid??null});}
catch(error){children.forEach(c=>c.kill());throw error;}
console.log(JSON.stringify({publicUrl:env.SITE_URL,adminUrl:env.SITE_URL+'/admin/aifind/launch-readiness',passwordFile,seedOnStartup:false,externalActions:false,previewEnabled:false}));
let stopping=false;function stop(){if(stopping)return;stopping=true;children.forEach(c=>c.kill());}
for(const c of children){c.once('error',e=>{console.error(e.message);process.exitCode=1;stop();});c.once('exit',code=>{if(!stopping){process.exitCode=code??1;stop();}});}process.on('SIGTERM',stop);process.on('SIGINT',stop);
