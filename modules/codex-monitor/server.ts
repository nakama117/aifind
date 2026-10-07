import { z } from "zod";
import { defineServerModule } from "@aihot/backend/modules";
import { siteUrl } from "@aihot/backend/publication/links";
import { registerMonitorRoutes } from "./api/routes.ts";
import { loadMonitorAnswer, monitorAnswer } from "./backend/agent.ts";
import { loadMonitorSnapshot } from "./backend/publication.ts";
import { refreshOfficialStatus } from "./backend/refresh.ts";
import { monitorTick } from "./backend/collection.ts";
import { collectionEnabled } from "./backend/collection-schema.ts";
import { announcementQueue } from "./backend/jobs.ts";

export const codexMonitorServer = defineServerModule({
  name: "codex-monitor", http: registerMonitorRoutes,
  models: { codexMonitor: { label: "Codex 重置公告独立声明识别（OpenAI）", env: "CODEX_MONITOR_MODEL", purposes: ["codex-monitor.recognize"] } },
  queues: [announcementQueue],
  schedules: [
    { name: "codex-monitor.official-status", cron: "*/10 * * * *", missed: "skip", when: () => process.env.COLLECT_ENABLED === "true", run: refreshOfficialStatus },
    { name: "codex-monitor.announcements", cron: "*/10 * * * *", missed: "skip", when: collectionEnabled, run: monitorTick },
  ],
  sitemap: { pages: [{ loc: siteUrl("/codex-reset"), changefreq: "daily", priority: 0.5 }] },
  llms: () => ({ api: [`- Codex 公式リセット告知: ${siteUrl("/api/v1/codex-resets")}`], pages: [`- Codex リセット: ${siteUrl("/codex-reset")}`], usage: ["Codex 告知は設定された公式情報源と手動確認の範囲です。収集・解析・完全処理の各時点を確認してください。個人アカウントの利用枠、X の網羅的な監視は提供しません。"] }),
  agent: {
    abilities: [{ path: "/codex-resets", title: "Codex リセット告知", ask: "Codex 利用枠リセットの公式告知・確認根拠", answer: loadMonitorAnswer, etagPrefix: "codex-agent-jp", cacheControl: "no-cache",
      mcp: { tool: "get_codex_resets", use: "for reviewed Codex reset announcements", description: "Read public Codex reset announcements with sources and confirmation evidence. No personal usage limits or complete X coverage.", input: z.object({}).strict(), run: async () => { const snapshot = await loadMonitorSnapshot(); return { text: monitorAnswer(snapshot), structured: { ...snapshot } }; } },
    }],
    unavailable: ["個人アカウントの Codex 利用枠。X の全投稿・全リセット履歴。"],
  },
});
