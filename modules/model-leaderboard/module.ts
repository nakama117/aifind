import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "model-leaderboard",
  pages: [
    { path: "leaderboard", file: "web/page.tsx", id: "leaderboard-overall" },
    { path: "leaderboard/boards/:key", file: "web/page.tsx", id: "leaderboard-board" },
    { path: "leaderboard/sources", file: "web/page.tsx", id: "leaderboard-sources" },
    { path: "leaderboard/sources/:key", file: "web/page.tsx", id: "leaderboard-source" },
    { path: "leaderboard/rules", file: "web/page.tsx", id: "leaderboard-rules" },
    { path: "leaderboard/:slug", file: "web/page.tsx", id: "leaderboard-model" },
  ],
  adminPages:[{path:'admin/model-leaderboard',file:'web/admin.tsx',id:'model-leaderboard-admin'}],
  apiPaths: [/^\/api\/(site|v1)\/leaderboard(?:\/|$)/,/^\/api\/admin\/model-leaderboard(?:\/|$)/],
});
