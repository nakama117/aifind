// Serve an existing local content database without seeding, migrations or worker jobs.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { SITE } from "@aihot/site";

const { values } = parseArgs({ options: { database: { type: "string" } } });
if (!values.database) throw new Error("Pass --database for an existing local PostgreSQL database");
const url = new URL(values.database);
if (!["postgres:","postgresql:"].includes(url.protocol) || !["127.0.0.1","localhost","[::1]"].includes(url.hostname)) throw new Error("This preview only connects to a local database");
// Explicit local values win over unrelated shell credentials. Never log this object.
const local = parseEnv(readFileSync(new URL("../.env",import.meta.url),"utf8"));
const env: NodeJS.ProcessEnv = {...process.env,...local,DATABASE_URL:values.database,NODE_ENV:"production",AIHOT_ENVIRONMENT:"staging",SITE_URL:"http://127.0.0.1:3100",SITE_PREVIEW:"true",API_HOST:"127.0.0.1",API_PORT:"3101",API_BASE_URL:"http://127.0.0.1:3101",WEB_HOST:"127.0.0.1",WEB_PORT:"3100",TRUST_PROXY:"false",COLLECT_ENABLED:"false",MODEL_CALLS_ENABLED:"false",LEADERBOARD_REFRESH_ENABLED:"false",FEISHU_CONTENT_PUSH_ENABLED:"false",FEISHU_INTERNAL_ENABLED:"false",INDEXNOW_SUBMIT_ENABLED:"false"};
delete env.DEV_AUTH_ROLE;
delete env.DEV_AUTH_DISPLAY_NAME;
const webEnv = {...env};
for (const key of Object.keys(webEnv)) if (/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(key)) delete webEnv[key];
const children = [
  spawn(process.execPath,["apps/api/src/main.ts"],{env,stdio:"inherit",windowsHide:true}),
  spawn(process.execPath,["apps/web/server.ts"],{env:webEnv,stdio:"inherit",windowsHide:true}),
];
let closing=false;
const stop=(code:number)=>{if(closing)return;closing=true;for(const child of children)child.kill("SIGTERM");process.exitCode=code;};
for(const child of children){child.on("error",()=>stop(1));child.on("exit",code=>stop(code??0));}
process.on("SIGINT",()=>stop(0));
process.on("SIGTERM",()=>stop(0));
console.log(`${SITE.name}: http://127.0.0.1:3100 — existing content; collection and model calls disabled.`);
