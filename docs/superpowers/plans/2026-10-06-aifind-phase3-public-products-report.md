# AIFIND Phase 3 — Public Product Pages + SEO 验收报告

日期：2026-10-06。Phase 4 Gate：**READY**。本轮只完成 Phase 3，未开始 Phase 4。

所有执行证据均为本轮新日志；实施前计划保存在 [Phase 3 plan](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase3-public-products.md)。逐项验收引用真实 PostgreSQL、HTTP、built SSR 和本机 Chrome；没有静态假页面、旧日志替代或生产数据写入。

## A. Architecture

实际链路：Postgres → Product Domain 的当前 Published snapshot → AIFIND Public Projection → 内部 Site API → React Router SSR → 浏览器。

公开投影在 [public-products.ts](D:/Projects/aihot/modules/aifind/publication/public-products.ts)，通过 [publication/snapshot.ts](D:/Projects/aihot/packages/backend/src/publication/snapshot.ts) 的通用只读 Repeatable Read 边界调用 Domain reader。公开 DTO 单独定义，显式挑选字段；不复用 Admin 全量 DTO。Draft、内部 ID、aliases、Evidence note、未引用 Evidence、Candidate 和 Audit 都不出现在公开返回值中。Phase 1 的内部 Published Reader 保持原边界。

前端只通过 HTTP 读取 API。framework 只增加通用 home-part/sitemap-files 插槽，没有 AIFIND 业务 import 或站名/域名硬编码。SITE/SITE_URL 继续决定品牌、生产 URL 与 canonical。

## B. Schema

| Migration | 实际变化 | 旧数据行为 |
|---|---|---|
| 0072_aifind_public_pages.sql | af_products.public_visibility（private/unlisted/listed，默认 private）、永久 first_public_at；af_product_versions.summary_ja；公开 readiness/时间保护 | 旧产品 private；summary NULL；不伪造首次公开时间 |
| 0073_aifind_slug_history.sql | 新增 af_product_slug_redirects：id、product_id、全局 UNIQUE old_slug、created_at；FK RESTRICT；历史不可改删；当前/历史共用 advisory namespace lock | 从未公开的改名无历史；曾公开后的旧 slug 永久保留，包括撤回期间 |
| 0074_aifind_slug_claim_isolation.sql | slug claim/history insert 必须在 Read Committed；阻止旧 RR/Serializable 写快照漏查跨表占用 | 前两迁移不重写；RR 公开读取继续允许；无新表 |

summary_ja 是人工普通文本，属于 version，Draft clone/edit 与 Published immutability 沿用 Domain。公开切换必须具备真实 Published、summary、JP/ja 行、有效官方 URL、可信 lastVerifiedAt 和既有事实约束。实际行允许 unknown；缺行与 unknown 不等价。公开产品发布替代版本也执行同一 readiness；失败保留原 Published。private 仍可先 Published、后整理公开资料。

## C. Public Routes

| URL | 行为 |
|---|---|
| /products（可带 ?page=N） | 日文 SSR 目录，仅 listed/current/ready；24 条分页 |
| /products/:slug | 当前 Published 日文详情；private/missing/not-ready 404，unlisted 200+noindex，历史 slug 301 |
| /api/site/aifind/products?limit=N&offset=N | 内部 Site API 的 allowlist 列表；不是新 public API v1 |
| /api/site/aifind/products/:slug | found/redirect resolution；private 404；只返回公开 DTO |
| /og/products/:slug.png | 现有日文字体/品牌 renderer；private 404、旧 slug 301、unlisted noindex；无外部图片请求 |
| /sitemap-products.xml | 独立且新鲜的 listed/current/ready product map |
| /sitemap-index.xml | 同时登记原 news /sitemap.xml 与独立 product map |
| /（首页） | 仅有 listed 时显示最多六张 Product 卡片和“すべて見る”；无产品时不显示空模块 |

公开导航加入“AIを探す”，沿用现有 module 注册。旧数据模块、RSS/MCP/API v1 保持边界，无 Compare/How-to 空入口。

## D. Admin Changes

现有 /admin/aifind/products/:id 增加小型“公開設定”面板：三种 visibility、当前公开 URL/canonical、永久初次公开时间、具体 readiness issues。PATCH /api/admin/aifind/products/:id/public-settings 沿用管理员认证、CSRF、identity revision 和 actor/reason Audit；无登录/缺 CSRF 拒绝，缺资料 422。Draft editor 增加日文 summary 字段，Published 栏和 diff 能明确识别不同版本。既有 Review/Apply/独立 Publish 流程没有合并或绕过。

## E. W01–W35

以下每项来自最终完整测试（[full-final.log](D:/Projects/aihot/.data/phase3-20261006-d802943d/full-final.log)、[web-full-final.log](D:/Projects/aihot/.data/phase3-20261006-d802943d/web-full-final.log)），无 FAIL/UNRUN。

| ID | 绑定验收要求 | Result | 测试文件及实际测试名称 |
|---|---|---|---|
| W01 | Draft-only产品公网404。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W01/W02 Draft-only and private Published products are 404 and absent from all public lists |
| W02 | Private + Published公网404。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W01/W02 Draft-only and private Published products are 404 and absent from all public lists |
| W03 | Unlisted + Published直链200。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only |
| W04 | Unlisted返回noindex。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only |
| W05 | Listed + Published直链200。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only |
| W06 | Directory只返回listed。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only |
| W07 | Homepage只返回listed。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W06/W07/W08 listed cards alone appear on directory/home and sitemap |
| W08 | Product sitemap只包含listed。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only |
| W09 | 旧slug返回301。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W09/W10/W12 old and intermediate slugs each 301 straight to the latest self-canonical |
| W10 | Redirect直接指向当前slug，不形成链。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W09/W10/W12 old and intermediate slugs each 301 straight to the latest self-canonical |
| W11 | 历史slug不能被另一Product复用。 | PASS | [modules/aifind/tests/slug-history.test.ts](D:/Projects/aihot/modules/aifind/tests/slug-history.test.ts) — W11 a historical slug cannot be reused as another product's current slug |
| W12 | Canonical使用当前slug。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W09/W10/W12 old and intermediate slugs each 301 straight to the latest self-canonical |
| W13 | Draft summary不泄露。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W13/W14/W15 Draft summary, price, market, Japanese UI and capability edits leave the public DTO and sitemap unchanged |
| W14 | Draft prices不泄露。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W13/W14/W15 Draft summary, price, market, Japanese UI and capability edits leave the public DTO and sitemap unchanged |
| W15 | Draft market/language/capability不泄露。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W13/W14/W15 Draft summary, price, market, Japanese UI and capability edits leave the public DTO and sitemap unchanged |
| W16 | Public DTO不含internal evidence note。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W16/W17 public allowlist omits internal IDs, notes, aliases, unreferenced Evidence, Candidates and audit |
| W17 | Public DTO不含Candidate/Audit信息。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W16/W17 public allowlist omits internal IDs, notes, aliases, unreferenced Evidence, Candidates and audit |
| W18 | unknown和unavailable状态不同。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W18 unknown and unavailable have different labels and visual status; Japanese supports stay separate |
| W19 | Free和Unknown价格不同。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W19/W20/W21/W22 free, fixed, from, custom and unknown retain exact native-currency price meanings |
| W20 | Custom和Unknown价格不同。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W19/W20/W21/W22 free, fixed, from, custom and unknown retain exact native-currency price meanings |
| W21 | Fixed minor unit显示正确。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W19/W20/W21/W22 free, fixed, from, custom and unknown retain exact native-currency price meanings |
| W22 | 不做FX转换。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W19/W20/W21/W22 free, fixed, from, custom and unknown retain exact native-currency price meanings |
| W23 | lastVerifiedAt不是updated_at。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W23 lastVerifiedAt is the credible published fact time, never the identity edit time |
| W24 | Public readiness缺summary拒绝公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W24 missing summary blocks a public transition without mutating state or audit |
| W25 | 缺current Published拒绝公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W25 public transition rejects a product without a Published version |
| W26 | 缺JP market记录拒绝公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W26 missing JP blocks a public transition without mutating state or audit |
| W27 | 缺ja language记录拒绝公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W27 missing ja blocks a public transition without mutating state or audit |
| W28 | 缺lastVerifiedAt拒绝公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W28 missing verification blocks a public transition without mutating state or audit |
| W29 | listed产品发布新Version时仍执行Public Readiness。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W29 a public product cannot publish a replacement with missing summary; previous version survives |
| W30 | Private产品可以Published后暂不公开。 | PASS | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) — W30 private products still publish domain-valid, SEO-incomplete versions |
| W31 | listed→private立即从public reader移除。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W31/W32 withdrawal and unlisting apply immediately to API, lists, sitemap and OG with no-store |
| W32 | listed→unlisted从directory/sitemap移除。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W31/W32 withdrawal and unlisting apply immediately to API, lists, sitemap and OG with no-store |
| W33 | JSON-LD无虚假rating。 | PASS | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) — W23/W33 detail verification/SEO/SoftwareApplication contain supported facts only |
| W34 | Private/Unlisted不进入Product sitemap。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W34/W35 sitemap index includes the fresh product map; maps omit admin, private and unlisted routes |
| W35 | Admin/private route不意外进入public sitemap。 | PASS | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) — W34/W35 sitemap index includes the fresh product map; maps omit admin, private and unlisted routes |

补充审查回归：两方向 stale-RR slug claim + Serializable 写入拒绝；当前/过期/未来 free price 的真实 Published → Directory/Home SSR；Tokyo 有效日期午夜前后四边界；未知 plan activity 不被当成已确认当前免费方案。[review-domain-green.log](D:/Projects/aihot/.data/phase3-20261006-d802943d/review-domain-green.log) 22/22 PASS。

## F. C01–C18

最终 Chrome 154.0.8037.95，真实已安装可执行文件，headless=false；2026-10-06T06:06:56.613Z → 2026-10-06T06:07:21.900Z。桌面 1440×1000，移动 375×812。浏览器 context 仅允许 localhost/127.0.0.1/::1 与 data/blob，实际 blockedExternalRequests=0，pageErrors=0。[chrome-smoke.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-smoke.json) 与 [browser-smoke.log](D:/Projects/aihot/.data/phase3-20261006-d802943d/browser-smoke.log)。

| ID | 场景 | Result | 实际浏览器证据 |
|---|---|---|---|
| C01 | Directory | PASS | Two listed cards only; real SSR/hydration, anonymous Chrome |
| C02 | Product Detail | PASS | Identity, vendor, JP, three Japanese dimensions, 7 platforms/10 capabilities/5 prices |
| C03 | Draft Isolation | PASS | Actual admin UI saved summary, Pro price and Japanese UI; refreshed public detail/list/home/map/JSON-LD/DTO unchanged |
| C04 | Unlisted | PASS | 200 + product noindex,follow meta; not listed or mapped |
| C05 | Private | PASS | Anonymous private URL returns 404 |
| C06 | Price Semantics | PASS | Five different price meanings, USD/JPY originals; unknown is not free |
| C07 | Unknown State | PASS | Unavailable vs unknown labels and solid vs dotted badge styling |
| C08 | Last Verified | PASS | Published fact timestamp, JST date; no updated_at substitution |
| C09 | Evidence | PASS | Only referenced product/pricing evidence title, publisher, kind and URL |
| C10 | Canonical | PASS | http://localhost:3400/products/aifind-preview-public-a |
| C11 | JSON-LD | PASS | SoftwareApplication; no invented reviews, ratings or offers |
| C12 | Sitemap | PASS | Chrome opened actual XML map; listed/current only |
| C13 | Slug Redirect | PASS | [{"url":"http://localhost:3400/products/aifind-preview-public-d-original","status":301},{"url":"http://localhost:3400/products/aifind-preview-public-d-current","status":200}] |
| C14 | Multiple Old Slugs | PASS | Original and intermediate each one-hop 301 → current |
| C15 | Withdraw | PASS | Admin UI withdrawal: current+2 historical URLs404, no home/list/map; restored demo listed, first_public_at unchanged |
| C16 | Homepage | PASS | Home has listed A/D and directory entry only |
| C17 | Desktop | PASS | 1440×1000 real Chrome, no horizontal overflow or replacement characters |
| C18 | Mobile | PASS | 375×812 detail and directory no overflow; price/heading/official CTA readable |

过程异常已解决：computer-use connector 两次 Windows sandbox helper 启动失败，改用已安装 Playwright 控制真实 Chrome，未安装软件。第一 Chrome 尝试 C15 停在测试脚本错误的 getByLabel 定位；视觉 Field 没有对应 label-for，改为已观察 dialog 的 textbox。原结果保存在 chrome-attempt1；第二次完整通过保存在 chrome-attempt2；最终在修复、build 和 0074 后再次 C01–C18 全通过。没有把失败尝试冒充最终结果。

## G. Draft Isolation Proof

真实 Admin UI 保存（不是直接 SQL）后，受保护 API 的只读复核结果：

| 字段 | Published | 修改后的 Draft |
|---|---|---|
| Summary | 文章作成とコードの補助を想定した合成デモです。実在する製品の情報・料金ではありません。 | [DRAFT ONLY] 最終ブラウザー検証で編集した説明。 |
| Pro amountMinor / 原币显示 | 2000 USD / $20 | 12545 USD / $125.45 |
| Japanese UI | unknown / 未確認 | partial / 一部対応 |

同一 Chrome 会话先捕获公开内容，再改 Draft，再刷新。detail HTML、list DTO、sitemap、JSON-LD、Site API DTO 的 before/after SHA256 一致；首页 Product 区域也做了严格字符串相等断言。

| Surface | Before SHA256 | After SHA256 | Result |
|---|---|---|---|
| product | d5ea172383f5c6c5d4dbe74f2e288ea56820cbdbf596e6466b2891ae1d88a4a8 | d5ea172383f5c6c5d4dbe74f2e288ea56820cbdbf596e6466b2891ae1d88a4a8 | PASS |
| ld | defe5de4c748d3e592bbf95d04b6b5e452f2845f431c065f83a438421f0f91c8 | defe5de4c748d3e592bbf95d04b6b5e452f2845f431c065f83a438421f0f91c8 | PASS |
| dto | 8231c9305f7a03de84b473ae0c94ce1aa5e81cd26d4db1a7e2671474a859f665 | 8231c9305f7a03de84b473ae0c94ce1aa5e81cd26d4db1a7e2671474a859f665 | PASS |
| list | f0cd0c35261650bd35709932c018ee9e83d8ef4c0571352ec814fc3ba980392c | f0cd0c35261650bd35709932c018ee9e83d8ef4c0571352ec814fc3ba980392c | PASS |
| map | df43ef57793bd1725ab963c4faf788e03fbba4f8c69f48c505eba4836cfc2195 | df43ef57793bd1725ab963c4faf788e03fbba4f8c69f48c505eba4836cfc2195 | PASS |

homepageUnchanged=true。证据：[chrome-draft-isolation.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-draft-isolation.json)、[acceptance-proof.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/acceptance-proof.json)、[chrome-admin-isolation.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-admin-isolation.png)。W15 还覆盖 Draft market/capability 编辑，公开 DTO 与 sitemap 完全不变。

## H. Visibility Proof

| Preview | 最终实际匿名 HTTP | Directory/Home/Product sitemap |
|---|---|---|
| A listed | 200 | 进入 |
| B unlisted | 200；存在 product robots=noindex,follow | 不进入 |
| C private + Published | 404 | 不进入 |
| Draft-only（隔离测试） | 404 | 不进入 |

当前状态 2026-10-06T06:12:01.357Z 只读复核在 [acceptance-proof.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/acceptance-proof.json)；动态撤回场景见 C15：D 从 listed → private，当前和两个历史 URL 均变为 404，目录/首页/map 即时移除。随后仅恢复本轮自己的合成 D 为 listed，first_public_at 保持原值；数据和历史不删除。C03 修改后的 Draft 保留供检查。

## I. Slug Redirect Proof

实际浏览器/HTTP：

```text
/products/aifind-preview-public-d-original → 301 → /products/aifind-preview-public-d-current
/products/aifind-preview-public-d-middle   → 301 → /products/aifind-preview-public-d-current
```

多次 original→middle→current 改名后，original 与 middle 各直接跳一次到当前 slug，均没有 chain。历史通过 product_id 查询当前身份；撤回时旧 URL 不泄露当前 slug。[chrome-redirect.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-redirect.json)、[acceptance-proof.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/acceptance-proof.json)。W11/数据库竞争测试证明旧 slug 不能被其他 Product 使用；审查的两方向 stale-RR 写缺陷已经 RED→GREEN 锁定，0074 解决而非放宽断言。

## J. SEO Proof

真实 SSR 的 A title：[PREVIEW] 製品 Aとは？料金・日本語対応・機能 | AIFIND

Description：文章作成とコードの補助を想定した合成デモです。実在する製品の情報・料金ではありません。

Canonical：http://localhost:3400/products/aifind-preview-public-a

Unlisted product robots：["noindex, nofollow","noindex,follow"]。本机 SITE_PREVIEW=true 额外附加全局 noindex,nofollow，所以本机 listed 合成数据也不会被索引；正常非 Preview SSR 的 W05 明确断言 listed 无 noindex，而 W04 unlisted 精确为 noindex,follow。此环境差异没有改变生产 listed 的语义。

真实 SoftwareApplication JSON-LD：

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "[PREVIEW] 製品 A",
  "description": "文章作成とコードの補助を想定した合成デモです。実在する製品の情報・料金ではありません。",
  "url": "http://localhost:3400/products/aifind-preview-public-a",
  "provider": {
    "@type": "Organization",
    "name": "[PREVIEW] デモベンダー"
  }
}
```

不生成 offers/aggregateRating/review；不猜价格、评分或 Draft 字段。OG 复用品牌及日文字体，只显示公开数据，本轮 DB/SSR 两层验证 PNG content-type/状态/no-store。

实际 product sitemap：

```xml
<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://localhost:3400/products/aifind-preview-public-a</loc><lastmod>2026-10-06T05:52:31.372Z</lastmod></url><url><loc>http://localhost:3400/products/aifind-preview-public-d-current</loc><lastmod>2026-10-06T05:52:31.565Z</lastmod></url></urlset>
```

lastmod 使用 Published publishedAt，历史 slug/unlisted/private/admin 均不在其中。sitemap index 与 robots 改为登记独立 map；原 news flat sitemap 继续可用。证据：[acceptance-proof.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/acceptance-proof.json)、[chrome-jsonld.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-jsonld.json)。

## K. Cache / Withdrawal

Product API、HTML、OG、目录、home Product 区域、product sitemap 和 slug 301 使用 no-store；核心对 API 还设置 X-Accel-Expires=0。实际 A HTML Cache-Control=private, no-store，product map=no-store，旧 slug 301=private, no-store。私有/404 也禁止存储。

Home 安装 module part 后使用现有更严格 private,no-store，原页面 absolute-deadline cache helper 和其他正常共享缓存测试保留。Product map 没有加入 news stale/SWR cache。W31/W32 与 C15 证明切换后新请求立即生效，不依赖缓存过期/CDN purge。详情保留价格有效期、原币种、minor-unit 精确显示；current-free card fact 由后端使用已有 tokyoDate helper 计算，不让前端时区或 hydration 改写日期判定。

## L. Full Regression

| Command | Result | 本轮 UTC 执行区间 | Fresh evidence |
|---|---|---|---|
| npm run typecheck | PASS | 2026-10-06T06:05:00.628Z → 2026-10-06T06:05:05.662Z | [typecheck-final-meta.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/typecheck-final-meta.json) |
| DATABASE_URL=postgres://postgres@127.0.0.1:55432/aifind_phase3_test npm test | PASS | 2026-10-06T06:05:32.931Z → 2026-10-06T06:07:59.754Z | [full-final-meta.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/full-final-meta.json) |
| npm run build -w @aihot/web | PASS | 2026-10-06T06:04:59.671Z → 2026-10-06T06:05:02.708Z | [build-final-meta.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/build-final-meta.json) |
| node --test apps/web/tests/*.test.ts | PASS | 2026-10-06T06:05:34.300Z → 2026-10-06T06:06:43.961Z | [web-full-final-meta.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/web-full-final-meta.json) |
| node scripts/smoke.ts --base http://localhost:3400 | PASS | 2026-10-06T06:06:56.193Z → 2026-10-06T06:06:58.236Z | [smoke-final-meta.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/smoke-final-meta.json) |

| Suite | Total | PASS | FAIL | CANCELLED | SKIPPED |
|---|---:|---:|---:|---:|---:|
| 完整数据库 | 827 | 819 | 0 | 0 | 8 |
| 全部 Web tests | 55 | 55 | 0 | 0 | 0 |
| 真实 Chrome C01–C18 | 18 | 18 | 0 | 0 | 0 |
| 全站 smoke（29 页面/机器出口 + MCP） | 30 | 30 | 0 | 0 | 0 |

测试库为 loopback aifind_phase3_test（root setup 为各文件隔离克隆 *_test）；SSR fixture 使用随机独立 *_test DB 并受限清理。复用已存在的 PostgreSQL 17 client tools，不安装系统软件。所有 COLLECT_ENABLED/MODEL_CALLS_ENABLED/FEISHU_CONTENT_PUSH_ENABLED/FEISHU_INTERNAL_ENABLED/INDEXNOW_SUBMIT_ENABLED=false；真实 provider 密钥/endpoint 从 runner 清除；测试假服务只能本地，worker 未启动。

完整基线逐项多重集合对照：Phase 2 的 **793/793 DB**、**43/43 Web** 保留精确 test name/depth/status/skip reason，missingOrChanged=[]；新增 **34 DB + 12 Web** 全部 PASS。新可信基线 [phase3-baseline.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/phase3-baseline.json) 包含所有 827+55 名称/状态、执行元数据和日志 SHA256。后续阶段必须以本文件为基线，本轮没有新增 skip。原 Tokyo/Brand 相关 24 项匹配测试全部保留/通过，完整名称在该基线中。

八项原有平台跳过，均为项目已明确交由 Linux CI 的 POSIX 行为；本轮没有用 skip 消除失败，也不宣称本机执行了这些 POSIX 场景：

| Test | 原有原因 | Result |
|---|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI | SKIPPED（原有） |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI | SKIPPED（原有） |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI | SKIPPED（原有） |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI | SKIPPED（原有） |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI | SKIPPED（原有） |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI | SKIPPED（原有） |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI | SKIPPED（原有） |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI | SKIPPED（原有） |

过程失败记录：TDD RED（缺功能）；第一次完整增量 819 total/809 PASS/2 FAIL/8 原 SKIP，均为 migration inventory/新增 nullable summary 的 fixture 升级预期；第一次 Web 52 total/44 PASS/8 FAIL，均为旧 fake API 未提供新 home API 及其旧缓存预期。修复 test fixture 并保留严格当前行为断言，最终结果如上。审查两重要问题分别有独立 RED（slug 5 PASS/3 FAIL、free-price 1 PASS/2 FAIL）和修复后的完整 GREEN，未删测试或放宽正确性断言。

## M. Preview

| Entry | URL |
|---|---|
| Directory | [http://localhost:3400/products](http://localhost:3400/products) |
| Listed detail | [http://localhost:3400/products/aifind-preview-public-a](http://localhost:3400/products/aifind-preview-public-a) |
| Unlisted detail | [http://localhost:3400/products/aifind-preview-public-b](http://localhost:3400/products/aifind-preview-public-b) |
| Old slug redirect | [http://localhost:3400/products/aifind-preview-public-d-original](http://localhost:3400/products/aifind-preview-public-d-original) |
| Preview Hub（管理员保护） | [http://localhost:3400/admin/aifind/preview](http://localhost:3400/admin/aifind/preview) |
| Admin Product isolation（管理员保护） | [http://localhost:3400/admin/aifind/products/e9e799c8-cecb-4141-bf0a-bf81b01ee99b](http://localhost:3400/admin/aifind/products/e9e799c8-cecb-4141-bf0a-bf81b01ee99b) |

本轮安全 runtime 使用 localhost 3400/API 3401、独立 aifind_phase3_preview；为应用最终代码仅重启经过 PID/parent/command 检查的本轮服务并追加 0074。旧 Phase 1.1（3200）/Phase 2（3300）runtime、数据库和登录文件未写入。登录密码仅存 [本机登录文件](D:/Projects/aihot/.data/aifind-public-preview/login.txt)，报告/日志不含密码。

Seed：[seed-aifind-public-preview.ts](D:/Projects/aihot/scripts/seed-aifind-public-preview.ts)，只在显式命令下执行；要求 AIFIND_PREVIEW_ENABLED=true、local loopback、*_preview/*_test/*_ci、无 URL query override、非 production。生产即使 flag=true 仍拒绝。server/module import/生产启动默认都不 seed，重复 seed 保留后续编辑。A/B/C/D、Vendor、Evidence 均显式 [PREVIEW] 合成标记，外链为 .invalid，无真实产品数据或外部调用。测试 fixture 对“默认不 seed / production 拒绝 / import 不写 / repeated seed 保留编辑”均 PASS。

桌面与移动截图路径：

- [chrome-directory-desktop.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-directory-desktop.png)
- [chrome-detail-desktop.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-detail-desktop.png)
- [chrome-home-desktop.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-home-desktop.png)
- [chrome-admin-isolation.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-admin-isolation.png)
- [chrome-directory-mobile.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-directory-mobile.png)
- [chrome-detail-mobile.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-detail-mobile.png)
- [chrome-pricing-mobile.png](D:/Projects/aihot/.data/phase3-20261006-d802943d/chrome-pricing-mobile.png)

人工像素检查：PASS。日文无乱码，Vendor/identity/JP/三种日本语支持/平台/capability/价格/Evidence 层次清楚。未確認为灰色虚线状态，与利用不可不同；免费、$20/月、¥3,000起/月、要询价和未知价格互不混淆。375px 与1440px无横向溢出，移动 CTA/价格/根拠可读。所有图来自真实 Chrome，而非设计稿。

## N. Git Safety

开始 HEAD=9848e936106db037d99a304887c36aad3fd0fad4，branch=codex/ai-signal-jp；结束均相同。Index SHA256=647cea9c84a71ae8002dc0bf17f59b2c704cdeedaf98c6b161415c9ffd1f4ccf；.env SHA256=1d03b4a5c9ae0f14c0eb9ef515b37f13b62c6ddb4df27f4e482ab40d85d6352a；均完全未改。

原有 **895** 文件全量备份并哈希；本轮 **31** 个已有文件追加范围内变化，其余 **864** 个 byte-identical；新增 **27** 文件；lost=0、unexpected modifications=0、原 **68** migrations changed=0。原有 SC 字体及其许可证的三项删除保持，不恢复字体。未 reset/clean/checkout/restore、未 stage/commit/push、未清理旧工作树或写生产库。Phase 0–2、日本化、AIFIND 品牌、Tokyo 和原有 Admin/Preview 的修改均作为实施基线保留，重叠文件仅在原内容上叠加本阶段功能。

证据：[git-before.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/git-before.json)、[git-safety.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/git-safety.json)、[owned-files.json](D:/Projects/aihot/.data/phase3-20261006-d802943d/owned-files.json)、[phase3-only.diff](D:/Projects/aihot/.data/phase3-20261006-d802943d/phase3-only.diff)。Diff 与 before 副本直接比较，而不是混入历史日本化工作的 HEAD diff。以下是全部实际文件变更：

| Change | File | 为什么 |
|---|---|---|
| 新增 | [.superpowers/sdd/2026-10-06-aifind-phase3-public-products/progress.md](D:/Projects/aihot/.superpowers/sdd/2026-10-06-aifind-phase3-public-products/progress.md) | 阶段进度、审查裁决及验证台账 |
| 修改 | [apps/api/src/routes/static.ts](D:/Projects/aihot/apps/api/src/routes/static.ts) | 通用 module sitemap 文件插槽与 sitemap index |
| 修改 | [apps/web/app/modules.ts](D:/Projects/aihot/apps/web/app/modules.ts) | 通用 module 首页 HTTP 插槽与新鲜读取策略 |
| 修改 | [apps/web/app/routes/home.tsx](D:/Projects/aihot/apps/web/app/routes/home.tsx) | 通用 module 首页 HTTP 插槽与新鲜读取策略 |
| 修改 | [apps/web/tests/aifind-baseline-runtime.test.ts](D:/Projects/aihot/apps/web/tests/aifind-baseline-runtime.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [apps/web/tests/cache.test.ts](D:/Projects/aihot/apps/web/tests/cache.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [apps/web/tests/seo-runtime.test.ts](D:/Projects/aihot/apps/web/tests/seo-runtime.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [docs/AIFIND_MASTER_SPEC.md](D:/Projects/aihot/docs/AIFIND_MASTER_SPEC.md) | 仅同步已验收 Phase 2 的 Candidate Apply/独立 Publish 契约 |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase3-public-products-report.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase3-public-products-report.md) | 本轮 A–P 验收报告 |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase3-public-products.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase3-public-products.md) | 实施前保存的计划，完成后勾选验收 |
| 修改 | [modules/aifind/admin/contracts.ts](D:/Projects/aihot/modules/aifind/admin/contracts.ts) | 受保护的公开设置 DTO/读取/PATCH action |
| 修改 | [modules/aifind/admin/read.ts](D:/Projects/aihot/modules/aifind/admin/read.ts) | 受保护的公开设置 DTO/读取/PATCH action |
| 修改 | [modules/aifind/admin/routes.ts](D:/Projects/aihot/modules/aifind/admin/routes.ts) | 受保护的公开设置 DTO/读取/PATCH action |
| 新增 | [modules/aifind/catalog/public-settings.ts](D:/Projects/aihot/modules/aifind/catalog/public-settings.ts) | 版本化 summary 与 visibility/readiness，保持 Domain 隔离 |
| 修改 | [modules/aifind/catalog/publish.ts](D:/Projects/aihot/modules/aifind/catalog/publish.ts) | 版本化 summary 与 visibility/readiness，保持 Domain 隔离 |
| 修改 | [modules/aifind/catalog/read.ts](D:/Projects/aihot/modules/aifind/catalog/read.ts) | 版本化 summary 与 visibility/readiness，保持 Domain 隔离 |
| 修改 | [modules/aifind/catalog/versions.ts](D:/Projects/aihot/modules/aifind/catalog/versions.ts) | 版本化 summary 与 visibility/readiness，保持 Domain 隔离 |
| 修改 | [modules/aifind/contracts.ts](D:/Projects/aihot/modules/aifind/contracts.ts) | 版本化 summary 与 visibility/readiness，保持 Domain 隔离 |
| 新增 | [modules/aifind/migrations/0072_aifind_public_pages.sql](D:/Projects/aihot/modules/aifind/migrations/0072_aifind_public_pages.sql) | 追加公开字段、slug 历史或 RC 写入保护，不改旧迁移 |
| 新增 | [modules/aifind/migrations/0073_aifind_slug_history.sql](D:/Projects/aihot/modules/aifind/migrations/0073_aifind_slug_history.sql) | 追加公开字段、slug 历史或 RC 写入保护，不改旧迁移 |
| 新增 | [modules/aifind/migrations/0074_aifind_slug_claim_isolation.sql](D:/Projects/aihot/modules/aifind/migrations/0074_aifind_slug_claim_isolation.sql) | 追加公开字段、slug 历史或 RC 写入保护，不改旧迁移 |
| 修改 | [modules/aifind/module.ts](D:/Projects/aihot/modules/aifind/module.ts) | 模块公开路由/导航/服务器挂载，保留旧 Admin/Preview |
| 新增 | [modules/aifind/preview/public-seed.ts](D:/Projects/aihot/modules/aifind/preview/public-seed.ts) | 显式、仅本地的示范数据与隔离 Preview；启动不 seed |
| 修改 | [modules/aifind/preview/routes.ts](D:/Projects/aihot/modules/aifind/preview/routes.ts) | 显式、仅本地的示范数据与隔离 Preview；启动不 seed |
| 新增 | [modules/aifind/public-contracts.ts](D:/Projects/aihot/modules/aifind/public-contracts.ts) | 公开 DTO 独立字段 allowlist |
| 新增 | [modules/aifind/public/routes.ts](D:/Projects/aihot/modules/aifind/public/routes.ts) | 当前 Published 公开投影、内部 Site API、OG、独立 sitemap |
| 新增 | [modules/aifind/publication/public-products.ts](D:/Projects/aihot/modules/aifind/publication/public-products.ts) | 当前 Published 公开投影、内部 Site API、OG、独立 sitemap |
| 新增 | [modules/aifind/publication/sitemap.ts](D:/Projects/aihot/modules/aifind/publication/sitemap.ts) | 当前 Published 公开投影、内部 Site API、OG、独立 sitemap |
| 修改 | [modules/aifind/server.ts](D:/Projects/aihot/modules/aifind/server.ts) | 模块公开路由/导航/服务器挂载，保留旧 Admin/Preview |
| 修改 | [modules/aifind/tests/admin-migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-migrations.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [modules/aifind/tests/migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/migrations.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [modules/aifind/tests/module.test.ts](D:/Projects/aihot/modules/aifind/tests/module.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-fixtures.ts](D:/Projects/aihot/modules/aifind/tests/public-fixtures.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-free-plan.test.ts](D:/Projects/aihot/modules/aifind/tests/public-free-plan.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/public-http.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-preview.test.ts](D:/Projects/aihot/modules/aifind/tests/public-preview.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-settings.test.ts](D:/Projects/aihot/modules/aifind/tests/public-settings.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/public-web-fixture.ts](D:/Projects/aihot/modules/aifind/tests/public-web-fixture.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 新增 | [modules/aifind/tests/slug-history.test.ts](D:/Projects/aihot/modules/aifind/tests/slug-history.test.ts) | 真实数据库/HTTP/SSR、边界或现有 fixture 回归验证 |
| 修改 | [modules/aifind/web.tsx](D:/Projects/aihot/modules/aifind/web.tsx) | 模块公开路由/导航/服务器挂载，保留旧 Admin/Preview |
| 修改 | [modules/aifind/web/admin-common.tsx](D:/Projects/aihot/modules/aifind/web/admin-common.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 修改 | [modules/aifind/web/draft-editor.tsx](D:/Projects/aihot/modules/aifind/web/draft-editor.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 新增 | [modules/aifind/web/home-products.tsx](D:/Projects/aihot/modules/aifind/web/home-products.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 修改 | [modules/aifind/web/identity-editor.tsx](D:/Projects/aihot/modules/aifind/web/identity-editor.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 修改 | [modules/aifind/web/product-detail.tsx](D:/Projects/aihot/modules/aifind/web/product-detail.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 修改 | [modules/aifind/web/product-view.tsx](D:/Projects/aihot/modules/aifind/web/product-view.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 新增 | [modules/aifind/web/public-product.tsx](D:/Projects/aihot/modules/aifind/web/public-product.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 新增 | [modules/aifind/web/public-products.tsx](D:/Projects/aihot/modules/aifind/web/public-products.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 新增 | [modules/aifind/web/public-settings.tsx](D:/Projects/aihot/modules/aifind/web/public-settings.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 新增 | [modules/aifind/web/public-view.tsx](D:/Projects/aihot/modules/aifind/web/public-view.tsx) | 模块内公开日文 UI、SEO、首页卡片或最小 Admin 编辑 |
| 修改 | [packages/backend/src/modules.ts](D:/Projects/aihot/packages/backend/src/modules.ts) | 通用 module sitemap 文件插槽与 sitemap index |
| 修改 | [packages/backend/src/publication/sitemap.ts](D:/Projects/aihot/packages/backend/src/publication/sitemap.ts) | 通用 module sitemap 文件插槽与 sitemap index |
| 新增 | [packages/backend/src/publication/snapshot.ts](D:/Projects/aihot/packages/backend/src/publication/snapshot.ts) | 通用只读 Repeatable Read publication 边界 |
| 修改 | [packages/contracts/src/http-policy.ts](D:/Projects/aihot/packages/contracts/src/http-policy.ts) | 新增站内公开路径的严格 HTTP 缓存策略 |
| 新增 | [scripts/seed-aifind-public-preview.ts](D:/Projects/aihot/scripts/seed-aifind-public-preview.ts) | 显式、仅本地的示范数据与隔离 Preview；启动不 seed |
| 修改 | [scripts/serve-aifind-preview.ts](D:/Projects/aihot/scripts/serve-aifind-preview.ts) | 显式、仅本地的示范数据与隔离 Preview；启动不 seed |
| 修改 | [site/public/robots.txt](D:/Projects/aihot/site/public/robots.txt) | Sitemap 指向 sitemap-index.xml |

## O. Known Limitations

仅保留明确排除的后续阶段：Resolver/Change Detector、Compare、Category/Best、How-to、Affiliate、Newsletter、Search redesign、Account/retention tools、Product public API v1、真实 production product 导入/seed/上线运维。当前没有这些入口或空页面，也没有新增 CMS/WordPress/Next.js/Redis/Elasticsearch/微服务。本轮不对这些后续功能或生产运营给出验收结论。

## P. Phase 4 Gate

**READY**。W01–W35、Chrome C01–C18、公开隔离/三种 visibility/slug namespace 与 301/SEO/即刻撤回均有真实证据；typecheck/build、827 DB（0 FAIL/0 CANCELLED/8 原 SKIP）、55 Web、30 smoke 全部通过；793 DB+43 Web 的既有基线无回归；已交付可浏览 Preview 和截图。两项 Important 与一项 Minor 审查发现均已处理，无延后 Minor 或未解决 Phase 3 要求。

阶段在此停止，**未自动进入 Phase 4**。

## 审查裁决与成本（时间顺序）

完整台账 [progress.md](D:/Projects/aihot/.superpowers/sdd/2026-10-06-aifind-phase3-public-products/progress.md)：1）执行已授权设计并先保存计划，成本为显式记录实现选择；2）保留 shared dirty checkout，Windows 原生快照/hash，成本为自维护 scoped diff，不提交/合并旧工作；3）本机 Preview 全局 noindex，正常 listed indexability 独立验证，成本为合成演示永不索引；4）reviewer Declined to judge 后续功能，裁决按绑定 scope 留到后续 Phase，成本为本轮不提供其验收；5）Declined to judge 生产上线/运营，裁决仅本地，成本为生产验收留到单独授权；6）connector helper 失败后复用实际 Chrome，成本为记录真实请求/截图与失败历史；7）新 0074 forward guard，成本为多一迁移而保留已应用 0073。Minor 长 Vendor/Publisher 无换行保护已用现有 break-words 修复，没有延期债务。
