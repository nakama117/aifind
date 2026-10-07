// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import type { ServerModule } from "@aihot/backend/modules";
import leaderboard from "@aihot/model-leaderboard/server";
import { codexMonitorServer } from "@aihot/codex-monitor/server";
import { topicChronicleServer } from "@aihot/topic-chronicle/server";
import { aifindServer } from "@aihot/aifind/server";

export const SERVER_MODULES: readonly ServerModule[] = [leaderboard, codexMonitorServer, topicChronicleServer, aifindServer];
