// Local acceptance only; no environment file or third-party credential is read.
process.env.DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aisignal_launch';
process.env.MODEL_CALLS_ENABLED = 'false';
process.env.COLLECT_ENABLED = 'false';
process.env.LEADERBOARD_REFRESH_ENABLED = 'false';
process.env.AIHOT_CREDENTIALS_DIR = '/nonexistent-leaderboard-credentials';
process.env.DATABASE_POOL_MAX = '3';
const {writeFileSync} = await import('node:fs');
const {sql,closeDb} = await import('@aihot/backend/db');
const {runLeaderboardRound} = await import('../backend/method/run.ts');
const {buildRunInputs} = await import('../backend/method/inputs.ts');
const {ANCHORS} = await import('../backend/method/consensus.ts');
try {
  const round = await runLeaderboardRound();
  const [counts] = await sql`SELECT (SELECT count(*) FROM lb_models) models,(SELECT count(DISTINCT model_id) FROM lb_scores) scored_models,(SELECT count(*) FROM lb_scores) scores,(SELECT count(*) FROM lb_snapshots) snapshots,(SELECT count(*) FROM lb_runs WHERE status='published') published_runs`;
  const sources = await sql`SELECT source_key,record_count,published_at,fetched_at FROM lb_snapshots ORDER BY source_key,fetched_at`;
  const [state] = await sql`SELECT value FROM settings WHERE key='leaderboard.fetch'`;
  const inputs = await buildRunInputs();
  const eligibility = inputs.boards.map(b=>({board:b.board,models:b.models.length,anchors:b.models.filter(m=>ANCHORS.includes(m)).length,policy:b.policy}));
  const fetchState = structuredClone(state?.value);
  for (const source of Object.values(fetchState?.sources ?? {})) {
    if (typeof source.error === 'string' && source.error.includes('API rate limit exceeded')) source.error = 'GitHub HTTP 403: anonymous API rate limit exceeded';
  }
  const result = {at:new Date().toISOString(),counts,round,eligibility,sources,fetchState};
  writeFileSync(new URL('./2026-10-04-live-run.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {await closeDb();}
