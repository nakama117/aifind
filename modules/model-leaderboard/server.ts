import { z } from "zod";
import { SITE } from "@aihot/site";
import { defineServerModule } from "@aihot/backend/modules";
import { registerLeaderboard } from "./api/routes.ts";
import { leaderboardAnswer } from "./backend/agent.ts";
import { leaderboardDetailUrls } from "./backend/read.ts";
import { LEADERBOARD_PUBLIC_BOARDS, type LeaderboardBoardKey } from "./taxonomy.ts";
import { leaderboardQueue } from './backend/admin.ts';
import { enqueueOn } from '@aihot/backend/jobs/queue';

export const refreshEnabled = () => process.env.COLLECT_ENABLED === "true" && process.env.LEADERBOARD_REFRESH_ENABLED === "true";

export default defineServerModule({
  name:"model-leaderboard",
  http:registerLeaderboard,
  queues:[leaderboardQueue],
  schedules:[{name:"model-leaderboard.refresh",cron:"20 0,6,12,18 * * *",when:refreshEnabled,missed:"skip",run:async()=>refreshEnabled()?{jobId:await enqueueOn(leaderboardQueue,{operation:'refresh',actor:'worker',reason:'定期更新'},{singletonKey:'leaderboard'})}:{skipped:"disabled"}}],
  sitemap:{pages:[{loc:"/leaderboard"},{loc:"/leaderboard/sources"},{loc:"/leaderboard/rules"}],entries:async()=>(await leaderboardDetailUrls()).map(loc=>({loc}))},
  agent:{abilities:[{
    path:"/leaderboard",title:"モデルランキング",ask:"公開評価に基づくモデルの順位と出典を知りたい",
    answer:async()=>(await leaderboardAnswer()).text,etagPrefix:"lb-agent",cacheControl:"public, max-age=120",
    mcp:{tool:"get_model_leaderboard",use:"for published model rankings and evidence",description:`Read the latest published ${SITE.name} model leaderboard. Scores are relative, not accuracy. No evaluation or paid model call is started.`,input:z.object({board:z.enum(LEADERBOARD_PUBLIC_BOARDS).optional()}),run:args=>leaderboardAnswer((args.board ?? "overall") as LeaderboardBoardKey)},
  }]},
  llms:()=>({api:["- モデルランキング: /api/v1/leaderboard/boards/overall","- 評価元と方法: /api/v1/leaderboard/catalogue"],pages:["- [モデルランキング](/leaderboard)","- [評価方法](/leaderboard/rules)"],usage:["ランキングは公開済みの集計だけを返します。データ不足を順位に置き換えません。"]}),
});
