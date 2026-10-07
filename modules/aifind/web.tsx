import { defineWebModule } from "@aihot/web/modules";
import { IconGrid } from "@aihot/web/components/icons";
import {PolicyFooter} from './web/policy-footer.tsx';

export const aifindWeb = defineWebModule({ name: "aifind", sidebar:{section:"コンテンツ",items:[{to:"/products",label:"AIを探す",icon:IconGrid},{to:"/compare",label:"AIを比べる",icon:IconGrid},{to:"/categories",label:"用途から探す",icon:IconGrid},{to:"/howto",label:"使い方",icon:IconGrid}]},
  tabs:[{key:"products",to:"/products",label:"AIを探す",icon:IconGrid},{key:"compare",to:"/compare",label:"AIを比べる",icon:IconGrid},{key:"categories",to:"/categories",label:"用途から探す",icon:IconGrid},{key:"howto",to:"/howto",label:"使い方",icon:IconGrid}], home:()=>import('./web/home-products.tsx'), admin: {
  content: [
    { to: "/admin/aifind", label: "AIFIND 概要" },
    { to: "/admin/aifind/products", label: "製品管理" },
    { to: "/admin/aifind/review", label: "変更提案" },
    { to: "/admin/aifind/monitors", label: "Source Monitor" },
    { to: "/admin/aifind/launch-readiness", label: "公開準備" },
    { to: "/admin/aifind/preview", label: "AIFIND Preview" },
    { to: "/admin/aifind/compare", label: "比較の管理" },
    { to: "/admin/aifind/categories", label: "用途ページの管理" },
    { to: "/admin/aifind/howto", label: "使い方の管理" },
  ],
},root:{Bottom:PolicyFooter},termsLinks:[{to:'/editorial-policy',label:'編集方針'},{to:'/contact',label:'お問い合わせ'}] });
