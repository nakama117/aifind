import { closeDb } from "@aihot/backend/db";
import { refreshLeaderboard } from "../backend/fetch/refresh.ts";
import { refreshEnabled } from "../server.ts";

try {
  if (!refreshEnabled()) throw new Error("Leaderboard refresh is disabled. Both COLLECT_ENABLED and LEADERBOARD_REFRESH_ENABLED must be true after reviewing source terms.");
  const result = await refreshLeaderboard();
  console.log(JSON.stringify(result, null, 2));
  if (result.round.status === "failed") process.exitCode = 1;
} finally { await closeDb(); }
