// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import leaderboard from "@aihot/model-leaderboard/web";
import { codexMonitorWeb } from "@aihot/codex-monitor/web";
import { topicChronicleWeb } from "@aihot/topic-chronicle/web";
import { aifindWeb } from "@aihot/aifind/web";

export const WEB_MODULES: readonly WebModule[] = [leaderboard, codexMonitorWeb, topicChronicleWeb, aifindWeb];
