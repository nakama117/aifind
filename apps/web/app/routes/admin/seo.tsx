import { Link } from "react-router";
import { SITE } from "@aihot/site";
import type { AdminSeo } from "@aihot/contracts/admin";
import type { Route } from "./+types/seo";
import { adminGet } from "../../lib/admin.server";
import { AdminPage, Badge, Card, KV, Stat } from "../../features/admin/ui";

export function loader({ request }: Route.LoaderArgs) { return adminGet<AdminSeo>(request, "/api/admin/seo"); }
export const meta: Route.MetaFunction = () => [{ title: `SEO 与上线配置 · ${SITE.name} 后台` }];

export default function Seo({ loaderData: s }: Route.ComponentProps) {
  return <AdminPage title="SEO 与上线配置" subtitle="这里显示本站实际配置。验证值已填写不代表搜索引擎已验证域名，也不代表文章已被收录。">
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat label="搜索引擎访问" value={s.preview ? "预览 · 不收录" : "允许按页收录"} tone={s.preview ? "warn" : "ok"} hint="单篇文章仍遵守自己的收录标记" />
      <Stat label="符合站内收录条件的文章" value={s.indexableArticles} hint="与搜索引擎实际收录数量不同" />
      <Stat label="当前公开精选" value={s.selectedArticles} />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="域名与索引">
        <KV items={[
          ["站点地址", s.siteUrl], ["正式域名格式", s.publicOrigin ? "已填写域名（尚未验证 DNS）" : "本地或临时地址"],
          ["HTTPS 地址", s.https ? "已配置（证书需部署后验证）" : "未配置"], ["日文语言", s.locale],
          ["运营联系邮箱", s.contactConfigured ? "已填写" : "待填写"],
          ["首页标题", s.title], ["首页说明", s.description],
        ]} />
        <p className="mt-4 text-[13px] text-ink-3">正式部署时设置 <code>SITE_URL=https://正式域名</code>；受限测试结束后再把 <code>SITE_PREVIEW</code> 改为 <code>false</code> 并重建服务。站名和默认说明在 <code>site/site.ts</code> 修改。</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-accent"><a href="/sitemap.xml" target="_blank" rel="noreferrer">查看站点地图</a><a href="/robots.txt" target="_blank" rel="noreferrer">查看 robots.txt</a><a href="/og/site.png" target="_blank" rel="noreferrer">查看分享图</a></div>
      </Card>
      <Card title="搜索引擎验证">
        <div className="space-y-3 text-[13px]">
          <p>Google 验证值：<Badge tone={s.verification.google.configured ? "ok" : "muted"}>{s.verification.google.configured ? "已配置，平台验证待确认" : "未配置"}</Badge></p>
          <p>Bing 验证值：<Badge tone={s.verification.bing.configured ? "ok" : "muted"}>{s.verification.bing.configured ? "已配置，平台验证待确认" : "未配置"}</Badge></p>
          <p className="text-ink-3">支持在部署配置中填写 <code>GOOGLE_SITE_VERIFICATION</code> 和 <code>BING_SITE_VERIFICATION</code> 的公开 HTML 验证值，再重建服务。使用 DNS 验证的域名不需要这些值。</p>
          <p>IndexNow：{s.indexNow.enabled && s.indexNow.keyConfigured ? "提交已启用" : s.indexNow.keyConfigured ? "密钥已配置，提交关闭" : "未配置"}。这是可选提交渠道，不保证收录。</p>
          <a className="block text-accent" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">打开 Google Search Console</a>
          <a className="block text-accent" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">打开 Bing Webmaster Tools</a>
          <p className="break-all text-ink-3">验证所有权后提交：{s.sitemap}</p>
        </div>
      </Card>
      <Card title="日常文章管理">
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>在<Link to="/admin/content" className="text-accent">内容管理</Link>中筛选文章，点击标题进入详情。</li>
          <li>“人工修正”修改日文标题、摘要、分类、标签或精选，填写修改原因后保存；人工修正优先于模型结果。</li>
          <li>“公开范围”可撤稿、恢复公开或限制为摘要；撤稿同步影响页面、RSS、API、主题和报表。</li>
          <li>“标记收录 / 取消收录”控制单篇 robots 和站点地图。站点地图有约 5 分钟缓存，搜索引擎更新需再次抓取。</li>
        </ol>
      </Card>
      <Card title="已经自动生成的 SEO">
        <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>日文标题、摘要、语言属性、规范网址 canonical。</li>
          <li>OG 和 X 分享卡片；文章、报表和列表对应的 JSON-LD。</li>
          <li>RSS、站点地图、主题与模型页面的发现链接。</li>
          <li>后台、站内搜索和收藏页不收录；预览模式整站不收录。</li>
        </ul>
        <p className="mt-4 text-[13px] text-ink-3">上线后仍需检查真实域名、HTTPS、移动端速度和 Search Console 报告；这里不显示未经验证的排名或收录承诺。</p>
      </Card>
    </div>
  </AdminPage>;
}
