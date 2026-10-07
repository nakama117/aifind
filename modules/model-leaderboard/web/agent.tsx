import type { AgentPart } from "@aihot/web/modules";

export default {
  resources:[["モデルランキング","/api/v1/agent/leaderboard","公開された順位と証拠を Markdown で取得"]],
  tools:[{name:"get_model_leaderboard",does:"総合・分野別のモデル順位と元の集計情報を取得",ask:"コーディングのモデルランキングと出典を教えて"}],
  api:{group:"モデルランキング",rows:[
    ["/api/v1/leaderboard/boards/overall","総合ランキング","最新の公開済み集計"],
    ["/api/v1/leaderboard/models/:slug","モデル詳細","個別評価・設定・比較"],
    ["/api/v1/leaderboard/catalogue","出典と方法","未集計時も利用可能"],
  ]},
} satisfies AgentPart;
