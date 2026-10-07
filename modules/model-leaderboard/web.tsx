import { defineWebModule } from "@aihot/web/modules";
import { IconChart } from "../../apps/web/app/components/icons";

export default defineWebModule({
  name:"model-leaderboard",
  admin:{content:[{to:'/admin/model-leaderboard',label:'模型排行榜'}]},
  sidebar:{section:"データ",items:[{to:"/leaderboard",label:"モデルランキング",icon:IconChart}]},
  tools:[{to:"/leaderboard",label:"モデルランキング",icon:<IconChart />}],
  agent:()=>import("./web/agent"),
  termsLinks:[{to:"/leaderboard/sources",label:"評価データの出典"}],
});
