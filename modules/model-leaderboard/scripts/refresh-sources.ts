// A bounded operational check: only the explicitly named public-data sources, no model calls.
import { closeDb } from "@aihot/backend/db";
import { importModelDirectory } from "../backend/directory.ts";
import { FETCHERS } from "../backend/fetch/index.ts";
import { fetchSources } from "../backend/fetch/refresh.ts";
import { runLeaderboardRound } from "../backend/method/run.ts";

try {
  if (process.env.COLLECT_ENABLED !== "true" || process.env.LEADERBOARD_REFRESH_ENABLED !== "true") throw new Error("Both COLLECT_ENABLED and LEADERBOARD_REFRESH_ENABLED must be true after reviewing source terms.");
  const at = process.argv.indexOf("--sources");
  const sourceKeys = (at>=0 ? process.argv[at+1] ?? "" : "").split(",").filter(Boolean);
  if (!sourceKeys.length) throw new Error("Specify --sources livebench-coding,livebench-reasoning,livebench-writing (optionally --round).");
  const available = new Set(FETCHERS.flatMap(f=>f.sourceKeys).filter(k=>k!=="artificial-analysis"));
  for(const key of sourceKeys) if(!available.has(key)) throw new Error(`Unsupported public-data source: ${key}`);
  const directory = await importModelDirectory();
  const all = await fetchSources({sourceKeys,retryDelayMs:1000});
  const sources = Object.fromEntries(sourceKeys.map(k=>[k,all[k]]));
  const round = process.argv.includes("--round") ? await runLeaderboardRound({publish:process.env.LEADERBOARD_AUTO_PUBLISH==='true'}) : null;
  console.log(JSON.stringify({directory,sources,round},null,2));
  if (sourceKeys.some(k=>!all[k]?.ok) || round?.status === "failed") process.exitCode=1;
} finally { await closeDb(); }
