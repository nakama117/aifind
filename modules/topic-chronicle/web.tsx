import { defineWebModule } from "@aihot/web/modules";

export const topicChronicleWeb = defineWebModule({
  name: "topic-chronicle",
  topicPage: () => import("./web/part.tsx"),
  admin: { content: [{ to: "/admin/topic-chronicle", label: "主题大事记" }] },
});
