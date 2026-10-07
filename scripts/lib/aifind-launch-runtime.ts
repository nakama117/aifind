import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';

type Pids={launcher:number;api:number|null;web:number|null;worker:number|null};
/** Local launcher receipts only: no database mutation, seed or production action. */
export function prepareLaunchRun(dataDir:string,webPort:number,database:string,entryPath='/admin/aifind/preview/launch-readiness'){
  const parent=path.dirname(dataDir),runtimeFile=path.join(parent,'launch-runtime.json'),passwordFile=path.join(parent,'launch-login.txt'),url='http://localhost:'+webPort;
  let previous:Record<string,unknown>|null=null;
  if(fs.existsSync(runtimeFile)){
    previous=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
    if(previous!.url!==url||previous!.database!==database)throw Error('Existing launch receipt belongs to a different runtime');
    for(const key of ['launcher','api','web','worker']){
      const pid=previous![key];if(pid===null||pid===undefined)continue;
      if(typeof pid!=='number'||!Number.isInteger(pid)||pid<=0)throw Error('Invalid previous process receipt');
      try{process.kill(pid,0);throw Error('Previous launch process is still running; stop it explicitly before restarting');}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
    }
  }
  fs.mkdirSync(parent,{recursive:true});
  let password:string;
  if(fs.existsSync(passwordFile)){
    const text=fs.readFileSync(passwordFile,'utf8');password=text.match(/^Password: (.+)$/m)?.[1]??'';
    if(!text.includes('URL: '+url+entryPath)||password.length<16)throw Error('Invalid existing local login receipt');
  }else{
    password=randomBytes(18).toString('base64url');
    fs.writeFileSync(passwordFile,'Local AIFIND launch staging only\nURL: '+url+entryPath+'\nPassword: '+password+'\n',{flag:'wx',mode:0o600});
  }
  const runs=path.join(parent,'launch-runs');fs.mkdirSync(runs,{recursive:true});const runId=randomUUID(),receiptFile=path.join(runs,runId+'.json');
  if(previous)fs.writeFileSync(path.join(runs,runId+'-previous.json'),JSON.stringify(previous,null,2),{flag:'wx'});
  return{password,passwordFile,receiptFile,record(pids:Pids){
    const record={...pids,url,database,runId,seedOnStartup:false,externalActions:false,startedAt:new Date().toISOString()};
    fs.writeFileSync(receiptFile,JSON.stringify(record,null,2),{flag:'wx'});
    // Historical bytes have an exclusive copy before the current pointer changes.
    fs.writeFileSync(runtimeFile,JSON.stringify(record,null,2));
  }};
}
