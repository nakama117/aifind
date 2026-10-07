import type { LbPrice, LbSourceStatus } from './contracts.ts';

export type LeaderboardOperation = 'refresh' | 'compute' | 'context' | 'fx' | 'prices';
export interface LeaderboardAdminModel {
  slug: string; name: string;
  context: { tokens: number | null; sourceUrl: string | null; verifiedAt: string | null };
  price: { currency: 'USD'|'CNY'; input:number|null; output:number|null; cached:number|null; sourceUrl:string|null; asOf:string|null; origin:LbPrice['origin']; note:string|null } | null;
}
export interface LeaderboardAdminRun {
  id:string; status:string; generatedAt:string; method:string;
  boards:Array<{board:string;models:number;optimal:boolean;ms:number}>;
}
export interface LeaderboardAdminOverview {
  refreshEnabled:boolean;
  automaticPublication:boolean;
  sources:Array<{key:string;name:string;status:LbSourceStatus;supported:boolean;requiresKey:boolean;configured:boolean;license:string;rows:number;upstreamAt:string|null;fetchedAt:string|null;lastAttempt:{ok:boolean;at:string;lastOkAt:string|null;error?:string}|null}>;
  runs:LeaderboardAdminRun[];
  jobs:Array<{id:number;status:string;startedAt:string;finishedAt:string|null;error:string|null;detail:unknown}>;
  fx:{asOf:string;rate:number;sourceName:string;sourceUrl:string|null}|null;
}
export interface LeaderboardAdminPreview {
  run:LeaderboardAdminRun;
  problem:string|null;
  inputs:Array<{board:string;models:number;anchors:number}>;
  rankings:Array<{board:string;rank:number;score:number|null;name:string;slug:string}>;
  snapshots:Array<{source_key:string;published_at:string|null;fetched_at:string;record_count:number;source_url:string|null}>;
}
