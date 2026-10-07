import { defineServerModule } from "@aihot/backend/modules";
import { chronicleIndex, readChroniclePart } from "./backend/publication.ts";
import { registerChronicleRoutes } from "./api/routes.ts";

export const topicChronicleServer = defineServerModule({
  name: "topic-chronicle",
  http: registerChronicleRoutes,
  topics: { page: { index: chronicleIndex, read: readChroniclePart } },
  llms: () => ({ topics: ["企業の年表には出典付き歴史資料と公開中の関連記事を掲載。歴史資料には編纂日と原文リンクを明記"] }),
});
