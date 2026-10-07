# AIFIND Phase 5 — Product Discovery + Catalog Bootstrap

> 执行方式：按 executing-plans 在当前受保护工作树中逐项执行；本计划是用户已确认 Phase 5 规格的实施拆分，不重新申请设计批准。结束后停止，不进入 Phase 6。

**Goal:** 在既有 `/products` 上建立真实 Published 数据的搜索、筛选、排序及首页入口；提供严格、幂等、仅写 Draft 的本地 Catalog Pack 导入与浏览器 Preview。

**Architecture:** AIFIND module 的 publication reader → Site API → Web SSR。Pack 是导入运输格式，不是公开运行时数据源；Domain 写入复用现有事务接口。新增简单导入凭证表，不引入 CMS、搜索服务、缓存或新框架。

**Tech Stack:** 现有 Node 24 / TypeScript / Zod / PostgreSQL 17 / Fastify / React Router SSR。

**Spec:** 用户附件 `94b6da21-fdbe-4e49-a8e7-3ed77f3ac54d/已粘贴的文本.txt`；Master Spec；Phase 3 / Phase 4 报告。Phase 4 接受基线为 870 tests / 862 PASS / 0 FAIL / 8 SKIP，Web 57 PASS。

**Global Constraints:** 保护全部历史 tracked/untracked 工作、Git index/HEAD、`.env`、72 个既有 migration 和 SC 字体删除。只操作新建 loopback `*_test` / `*_preview` 库；全部外部安全阀关闭。不自动 Publish、不自动 listed、不安装软件、不修改生产数据。当前实施必须提供 Preview 和实际 Chrome 验收。

**Review Focus:** Published/Draft 隔离；AND 筛选先于分页；unknown 与 positive/free 边界；NFKC 搜索；SQL 与 DTO 语义一致；Pack Evidence 完整性；dry-run 零写入；事务失败回滚；手工 Draft 冲突；幂等并发；SEO / Preview 访问边界。

## Task 1 — Discovery contract and real database reader

Files: `modules/aifind/discovery/contracts.ts`, `public-contracts.ts`, `publication/public-products.ts`, `public/routes.ts`, `tests/discovery.test.ts`。

Interface: 保留 `limit/offset`；扩展 `q/capability/platform/japan/japanese/free/sort`，返回 `total` 和规范化 query。`q` trim + NFKC + lower，最多 200 字；受控 enum 和严格参数校验；sort 为 `recently_verified`（默认）、`recently_published`、`name`。日语 usable = ja input/output 均 full，UI 单独显示。capability 只 full；platform/JP 只 available；free 只 active + free price + Tokyo 当前有效期。

1. RED：真实 DB fixtures 证明目前没有搜索/筛选/排序/count；覆盖 S01–S10、F01–F12、Published/private/unlisted/Draft 泄露边界。
2. GREEN：一个只读快照中 SQL 搜索和 AND 筛选在 COUNT/LIMIT/OFFSET 前完成，验证时间仅取有 Evidence 的确定事实；稳定 publishedAt/slug/id 次序。保留详情/OG/sitemap 安全边界。
3. 验证实际 query plan，只有出现有证据的查询问题才加索引。

## Task 2 — Directory, homepage and SEO

Files: `modules/aifind/web/public-products.tsx`, `public-view.tsx`, `home-products.tsx`, `web.tsx`, `apps/web/tests/aifind-discovery.test.ts`。

1. RED：构建 SSR + 真实 HTTP/DB 的 query 状态、筛选前分页、canonical/noindex、首页和卡片断言。
2. GREEN：GET 表单、标签、用途快捷入口、有效条件摘要/清除/计数/空结果；分页保留全部条件；刷新、前后导航由 URL 驱动。基础页 index，page>1 self canonical，搜索/筛选页 noindex,follow canonical `/products`。不向 sitemap 注册 query。
3. 首页保留 News，Product 部件增加小搜索、六个用途链接、最近确认的六个卡片和目录 CTA，不作人气/推荐宣称。

## Task 3 — Strict Catalog Pack and safe importer

Files: `modules/aifind/catalog-pack/contracts.ts`, `import.ts`, `modules/aifind/migrations/0076_aifind_catalog_imports.sql`, `detector/monitors.ts`, `scripts/import-aifind-product-pack.ts`, `tests/catalog-pack.test.ts`。

Interface: schemaVersion=1，packId/revision，Vendor/Evidence/product key 引用；现有 Domain enums、minor units、ISO 时间；明确测试标记。所有确定事实必需 Evidence key 和 verifiedAt；严格禁止未知字段/无效 URL/非整数金额。Monitors 强制 disabled、allowJina=false。

1. RED：I01–I15 严格校验、Evidence/金额、同名别名冲突、dry-run 零写入、重复/并发幂等、失败回滚、Published 不变及 private 默认。
2. GREEN：预验证 pack 全部事实；只读 dry-run 输出 vendors/products/evidence/monitors/new/same/conflict/errors。CLI 默认仅接受 loopback `_test/_ci/_preview`，不从生产启动或默认 seed 调用。
3. 一个 Read Committed 事务复用 Domain APIs 创建 Vendor/Product/Alias/Evidence/Draft/facts；记录 pack identity/hash、导入结果及 revision。Evidence 内容身份跨 pack 去重。相同 pack 重试不重复写入，修改过的导入 Draft 冲突。
4. 已有 Product 必须显式提供 identityRevision/current Published base 且无现存 Draft；只克隆并填写新 Draft。现存非本次导入 Draft 一律 conflict，避免覆盖人的工作。保持 Published 和 visibility 不变。
5. optional monitor 接受外层 Tx，导入全批失败时一起回滚；不会启用 worker 或发请求。

## Task 4 — Local synthetic Preview and hub

Files: `preview/discovery-pack.ts`, `preview/discovery-seed.ts`, `preview/routes.ts`, `preview/contracts.ts`, `web/preview-discovery.tsx`, `module.ts`, `web.tsx`, `scripts/seed-aifind-discovery-preview.ts`, `scripts/start-preview.ts`（如现有 launcher 适用）、测试 fixture。

1. RED：管理员/flag/noindex/sitemap/public API 隔离；真实 Domain/API 数据；默认生产不 seed。
2. GREEN：`/admin/aifind/preview/product-discovery`，Hub Available。至少 12 个明确 SYNTHETIC 产品覆盖全部 Discovery 条件，另有 private/unlisted 和 import-only Draft。测试 seed 显式模拟独立 Human Publish + visibility，importer 本身完全不公开数据。
3. Preview 展示 P01–P23 链接/操作与 dry-run、导入、重复、冲突、校验示例，均调用真实后端。写操作只允许 flag + loopback preview/test DB + 管理员 CSRF。
4. 创建隔离 `aifind_phase5_preview` 和 3600/3601 环境，保留既有 3200–3501 环境。

## Task 5 — Phase 4 carryovers

Files: `modules/aifind/tests/detector-retention.test.ts`, Phase 5 报告/ADR。

1. 实际检查 12k Observation、Evidence quote/locator、immutable/审计约束及清理代码。保留 Evidence 可复核输入，记录版权/storage/hash+quote 的后续政策；不任意删除。
2. Characterization test：无关文本改变 contentHash 时相同业务语义会产生不同 proposal key / active Candidate。给出精准去重 ADR（product/base/target/semantic 的 active 范围、保留 Evidence/Observation、终态重提策略），本阶段不仓促改变 Phase 4 公布的 key。

## Task 6 — Final review, frozen verification and browser acceptance

Files: 最终报告；`.data/phase5-20261006-f735ab81/` 仅本地证据，不提交。

1. 完成全部 scoped changes 后，按 requesting-code-review 派出一次新的完整 Phase 5 final review，解决阻塞问题并复测。
2. 最终代码冻结后重新执行 typecheck / npm test / Web build / Web tests / 本地 smoke；对照 Phase 4 测试名称与八个原有 skip，保存本轮日志和新 baseline。
3. installed Chrome 可见窗口执行 C01–C20，检查桌面/手机、搜索/别名/组合/刷新/历史/清除/无结果/排序/分页、主页、private/unlisted、index/noindex、导入 Draft/未 Publish 的公开排除。
4. 保存并实际查看 `product-discovery-desktop.png`、`product-discovery-mobile.png`、`homepage-discovery-desktop.png`、`homepage-discovery-mobile.png`、`catalog-bootstrap-admin.png`。
5. 比较全部原文件 hash，逐项说明本轮修改；证明其他历史文件、所有原 migration、`.env`、index、HEAD 和三项字体删除原样保持。
6. 报告 A–P，Phase 6 Gate 只给 READY / NOT READY，然后停止。
