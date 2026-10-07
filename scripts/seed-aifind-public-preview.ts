// Explicit new disposable Phase 3 Preview only. Never invoked by application startup.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { assertPreviewWrites } from "../modules/aifind/preview/config.ts";
assertPreviewWrites(process.env);
const url=new URL(process.env.DATABASE_URL!),name=url.pathname.slice(1);
const adminUrl=new URL(url);adminUrl.pathname="/postgres";
const admin=postgres(adminUrl.toString(),{max:1,onnotice:()=>{}});
try {if(!(await admin`SELECT 1 FROM pg_database WHERE datname=${name}`).length) await admin`CREATE DATABASE ${admin(name)}`;} finally {await admin.end();}
execFileSync(process.execPath,[fileURLToPath(new URL('./migrate.ts',import.meta.url))],{env:process.env,stdio:'inherit',windowsHide:true});
const {seedPublicPreview}=await import('../modules/aifind/preview/public-seed.ts');
const {closeDb}=await import('@aihot/backend/db');
try {console.log(JSON.stringify({preview:await seedPublicPreview(),productionWrites:false,externalActions:false}));} finally {await closeDb();}
