import { defineWebModule } from "@aihot/web/modules";
import { IconHistory } from "../../apps/web/app/components/icons";

export const codexMonitorWeb = defineWebModule({
  name: "codex-monitor",
  sidebar: { section: "データ", items: [{ to: "/codex-reset", label: "Codex リセット", icon: IconHistory }] },
  tools: [{ to: "/codex-reset", label: "Codex リセットの公式告知", icon: <IconHistory size={18} /> }],
  admin: { groups: [{ group: "Codex 监控", items: [{ to: "/admin/monitor", label: "公告、核实与撤回" }] }] },
});
