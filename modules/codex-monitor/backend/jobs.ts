import { defineQueue } from "@aihot/backend/modules";
import { monitorTick } from "./collection.ts";

export const announcementQueue = defineQueue<Record<string, never>>({
  name: "codex-monitor.announcements", options: { policy: "short", retryLimit: 0, expireInSeconds: 1800 }, worker: { localConcurrency: 1 },
  run: monitorTick,
});
