import { defineModule } from "@aihot/contracts/modules";

export const topicChronicle = defineModule({
  name: "topic-chronicle",
  adminPages: [{ path: "admin/topic-chronicle", file: "web/admin.tsx" }],
  apiPaths: [/^\/api\/admin\/topic-chronicle(?:\/|$)/],
});
