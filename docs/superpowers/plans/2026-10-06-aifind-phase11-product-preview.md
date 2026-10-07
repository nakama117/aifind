# AIFIND Phase 1.1 — Product Domain Preview 实施计划

日期：2026-10-06。授权范围：将既有 Phase 1 Domain 可视化；不开始 Phase 2、不增加 Product 业务模型/迁移。

## Constraints / Rulings

- 保留当前 dirty tree；先保存 849 个 tracked/nonignored 路径 hash、HEAD/index、接入文件备份。原地局部修改，不 reset/clean/checkout/restore/stage/commit。
- 本项目永久规则：每个 Phase 必须交付浏览器可查看的 Preview。追加到项目 AGENTS.md；不写全局 memory。
- 原生 PowerShell 7 / Node 执行并保留 ignored evidence/ledger；不用 POSIX helper 或删除证据。
- 使用现有 adminPages、adminHandler、adminGet、module web admin entry。框架不反向依赖 AIFIND；公开 publication boundary 不变。
- AIFIND_PREVIEW_ENABLED 只有 true 开启，默认 false。读取只允许管理员。Seed 和名称切换 demo 必须非 production、localhost PostgreSQL、专用 *_preview / *_test / *_ci 数据库；生产即使打开 flag 也禁止写 demo。
- 不调用真实模型、采集、Feishu、IndexNow；不启动 worker；Web 子进程不接收数据库/密码/密钥。

## Tasks

1. Backend TDD：新增 module preview API/guard/seed 测试，观察 RED。用现有 identity、facts、pricing、publish、Published/Draft readers 生成并读取一个明显 [PREVIEW] 产品。Seed 显式执行且重复执行不重置 Draft。管理员固定 demo action 只切换该产品 Draft 名称，不能编辑/发布任意产品。证明未登录/CSRF拒绝、默认/production无 seed、读真实 Domain、证据时间、pub/draft隔离、公开出口无 Preview。
2. Web TDD：真实 DB + Fastify API + built SSR 集成测试，观察缺少页面的 RED。新增 /admin/aifind/preview 和 /admin/aifind/preview/product-domain；两栏完整字段、状态/价格独立标识、证据及核验时间。管理员导航只加 Preview Hub；无公开导航/sitemap/Agent注册。
3. 安全本机启动：专用 aifind_phase11_preview 数据库与 loopback ports；独立 seed CLI，显式启动脚本、不自动 seed。真实密码登录，浏览器查看并操作 Draft demo，截图与烟测；保持本机 Preview 可访问。
4. 验收：PG17.11 client PATH，新的 *_test 数据库完整 npm test；typecheck、Web build/tests、Tokyo/Brand基线比较。一次 fresh-context 完整审查，重要问题 RED→GREEN 修复；逐路径 Git Safety。保存最终报告，停止。

## File / Module Map

- 新增 modules/aifind/module.ts、web.tsx、preview/{config,contracts,seed,service,routes}.ts、web/{preview-hub,product-preview}.tsx、tests/preview.test.ts。
- 修改 modules/aifind/{server,package}.ts/json 与现有 module 注册边界测试；site/modules/{index,web}.ts；package-lock.json 仅 workspace 元数据；AGENTS.md、.env.example。
- 新增 scripts/{seed-aifind-preview,serve-aifind-preview}.ts、apps/web/tests/aifind-preview.test.ts；本计划与报告。
- 不修改 catalog/publication 原语、迁移、原 0.5/0.6 harness 或其他旧日本化文件。

## Acceptance / Review Focus

- 全新请求无 cookie 时页面跳转登录，API 401；404 disabled；CSRF拒绝；noindex/no-store、sitemap/public nav/RSS/MCP/public API 不含 Preview。
- 在真实 Domain 中 published v1 / draft v2，页面分别渲染；Draft demo 改名不改变 published 的全部 DTO，刷新仍隔离。
- available / unavailable / unknown 文字与颜色区分；价格 unknown 不出现免费/0，free=0、fixed有币种金额周期、custom=個別見積もり。
- Evidence URL/source kind 与引用事实 verifiedAt 可追溯；lastVerifiedAt 来自 reader 聚合，不用 updatedAt。
- 默认/production seed 在查询前拒绝，启动不 seed，其他正常产品不能被 demo action 修改。
- 真实浏览器桌面展示，无乱码、层次明确、无超宽溢出、无 hydration/API 错误。
- Phase 1 的 740 PASS + 8既有 Windows skips 全保留；新 tests 全通过。审查重点：flag绕过、生产标识/数据库host与后缀 guard、cookie/CSRF、泄漏Draft、对正常product误写、SSR禁索引、secret传到Web、启动意外seed。
