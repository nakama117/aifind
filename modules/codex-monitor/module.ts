import { defineModule } from "@aihot/contracts/modules";

export const codexMonitorModule = defineModule({
  name: "codex-monitor",
  pages: [{ path: "codex-reset", file: "web/page.tsx" }],
  adminPages: [{ path: "admin/monitor", file: "web/admin.tsx" }],
  apiPaths: [/^\/api\/v1\/codex-resets(?:\/|$)/, /^\/api\/site\/codex-reset(?:\/|$)/, /^\/api\/admin\/monitor(?:\/|$)/],
});
