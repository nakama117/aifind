# AIFIND Phase 1.1 — Product Domain Preview 完成报告

日期：2026-10-06。Phase 2 Gate：**READY**。本阶段已停止，没有开始 Phase 2。

本报告依据本轮实际源码、真实数据库/HTTP/SSR 测试、headed Chrome 交互和截图，以及工作树逐路径 hash 对照。证据目录：`D:/Projects/aihot/.data/phase11-20261006-0f8171`。不使用旧日志充当本轮结果。

## A. Browser Preview

- Product Domain：[http://localhost:3200/admin/aifind/preview/product-domain](http://localhost:3200/admin/aifind/preview/product-domain)
- Preview Hub：[http://localhost:3200/admin/aifind/preview](http://localhost:3200/admin/aifind/preview)
- 本机服务保持运行；Web/API 只监听 loopback 3200/3201。必须使用现有管理员密码登录。此次启动生成的本机专用登录信息：`D:/Projects/aihot/.data/aifind-product-preview/login.txt`。密码没有写入报告、Git、Web 环境或截图。
- 桌面截图：[product-domain-desktop.png](D:/Projects/aihot/.data/phase11-20261006-0f8171/product-domain-desktop.png)
- Draft 操作后：[product-domain-after-draft.png](D:/Projects/aihot/.data/phase11-20261006-0f8171/product-domain-after-draft.png)
- Evidence 截图：[product-domain-evidence.png](D:/Projects/aihot/.data/phase11-20261006-0f8171/product-domain-evidence.png)
- 机器可读 browser smoke：`browser-smoke.json`；最终实际执行日志：`browser-smoke-final.log`。

采用推荐 URL，遵守 module `adminPages` / module Web admin entry 约定；不扩展框架路由系统。项目永久 Preview 验收规则已追加到根 `AGENTS.md`。

## B. Implementation / Files

新增 14 个代码/测试文件及 2 个阶段文档；局部修改 8 个既有接入文件。所有新增业务代码位于 module 或显式本机脚本。

| 新增文件 | 用途 |
|---|---|
| `modules/aifind/module.ts` | 注册两个 adminPages 与仅 admin Preview 的 API ownership |
| `modules/aifind/web.tsx` | 管理员导航增加 Preview Hub 入口 |
| `modules/aifind/preview/config.ts` | flag 默认关闭；非生产、local 专用 DB 与连接参数保护 |
| `modules/aifind/preview/contracts.ts` | Web 可消费的 Published/Draft Preview DTO 与简单 Hub 类型 |
| `modules/aifind/preview/seed.ts` | 显式合成示范数据，全部写入调用既有 Domain service |
| `modules/aifind/preview/service.ts` | 既有 Published/Draft reader 聚合；固定示范 Draft 名称切换 |
| `modules/aifind/preview/routes.ts` | 复用管理员 session/CSRF；GET Hub/Domain、POST 固定 Draft demo |
| `modules/aifind/web/preview-hub.tsx` | Phase 1 Product Domain / Available 总入口 |
| `modules/aifind/web/product-preview.tsx` | Japanese Preview、两栏版本、全部事实/价格/根据及核验时间 |
| `modules/aifind/tests/preview.test.ts` | 6 项真实 DB/API/安全/公开出口隔离测试 |
| `modules/aifind/tests/preview-web-fixture.ts` | SSR 测试的独立模块后台进程；专用测试库创建/迁移/seed/清理 |
| `apps/web/tests/aifind-preview.test.ts` | 5 项 built SSR 集成测试，Web 测试也只通过 HTTP 读 Domain |
| `scripts/seed-aifind-preview.ts` | 显式 CLI，守卫通过后才创建专用库、迁移、seed |
| `scripts/serve-aifind-preview.ts` | 只启动已准备的 Preview 库；不 migrate/seed，不启动 worker |
| `docs/superpowers/plans/2026-10-06-aifind-phase11-product-preview.md` | 先于实现保存的计划、约束、验收与审查重点 |
| 本报告 | 交付与新基线 |

| 修改文件 | 实际修改与原因 |
|---|---|
| `AGENTS.md` | 追加每 Phase 必须交付浏览器 Preview 的永久项目规则 |
| `.env.example` | 追加 `AIFIND_PREVIEW_ENABLED=false` 与本机数据限制说明 |
| `modules/aifind/package.json` | module/Web exports、既有 API/Web/React/Fastify workspace 依赖 |
| `modules/aifind/server.ts` | 从 name-only 增加受管理员保护的阶段 Preview HTTP hook |
| `modules/aifind/tests/module.test.ts` | 按新授权允许 admin Preview；继续禁止 public pages、public API、Agent、sitemap、queues/schedules |
| `site/modules/index.ts` | 将 AIFIND 地址声明追加到原三个 module 后面 |
| `site/modules/web.ts` | 将 AIFIND admin Web entry 追加到原三个 module 后面 |
| `package-lock.json` | 离线同步 workspace 元数据；既有外部包 version/resolved/integrity 改动 0 |

没有修改 `catalog/`、`publication/`、66 个已存在 migrations、原测试 harness、框架 generic code、品牌、Sources、Prompts、分类、字体或日报周期。

## C. Real Domain / Seed

Web loader → `adminGet` → `/api/admin/aifind/preview/product-domain` → `getPublishedProductBySlug` / `getDraftProduct`。页面中的身份、版本、事实、价格与证据均来自真实 PostgreSQL 和 Phase 1 Domain reader。没有硬编码 HTML 结果。

本机只写入新专用库 **`aifind_phase11_preview`**。没有连接/修改 `aisignal_launch` 或生产数据。显式 CLI 已应用现有 66 个 migration 到此空库；没有新增/重写 migration。

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aifind_phase11_preview'
$env:NODE_ENV = 'development'
$env:AIHOT_ENVIRONMENT = 'preview'
$env:AIFIND_PREVIEW_ENABLED = 'true'
$env:COLLECT_ENABLED = 'false'
$env:MODEL_CALLS_ENABLED = 'false'
$env:FEISHU_CONTENT_PUSH_ENABLED = 'false'
$env:FEISHU_INTERNAL_ENABLED = 'false'
$env:INDEXNOW_SUBMIT_ENABLED = 'false'
node scripts/seed-aifind-preview.ts
node scripts/serve-aifind-preview.ts
```

在 PowerShell 7 中执行；启动前需 Web build。若当前服务已经运行，无需重复启动。服务脚本不读取生产 `.env` 作为启动配置，不自动 seed；生成独立本机登录密码，清除继承的付费/Feishu凭证，Web 子进程不接收数据库 URL、密码或密钥。

Seed/名称切换必须同时满足 flag 为 `true`、`NODE_ENV` 和 `AIHOT_ENVIRONMENT` 均不是 production、DB host 为 loopback、DB 名以 `_preview`/`_test`/`_ci` 结尾、URL 不带查询参数。浏览器服务额外要求 `_preview`。Production 即使显式开启 flag，也不能 seed 或执行 demo 写入；管理员只读 Preview 仍需 flag。

只初始化固定 slug `aifind-preview-product-domain`、明显 `[PREVIEW]` Vendor/Product/Plan/Evidence。根据 URL 使用 `preview.example.invalid`，没有请求外部页面。重复 seed 保留现有 Draft 编辑；若固定 slug 被占用或初始化中断，拒绝重置，要求选择新的专用空库。

Published **v1** 和 Draft **v2** 同时存在。JP 可用；日语 Input/Output/UI 独立；web available、android unavailable、ios 等 unknown；受控 capability key 来自 Domain。四种示范价格分别为 free、JPY fixed/月、custom、unknown。unknown 不显示为免费。

`lastVerifiedAt` 原样来自 reader：Published `2026-10-06T00:00:00.000Z` / 09:00 JST，Draft `2026-10-06T02:00:00.000Z` / 11:00 JST；都是明确标记的合成核验时刻，非当前更新时刻。Evidence 记录没有自身 verifiedAt 字段，页面明确显示“参照事实的 verifiedAt”，从该版本的事实引用关联，避免伪造 Evidence 时间。Draft 专用根据不会进入 Published 栏。

Demo 固定切换此示范产品 Draft 名称，沿用 `updateProductDraft`。没有任意产品编辑/发布端点，也没有 Product Admin/Review Queue 能力。

## D. Tests — Fresh Results

测试 runner：`.data/phase11-20261006-0f8171/check.mjs`。Node v24.14.0，复用并本轮核验 pg_dump/pg_restore **17.11**；完整数据库测试使用 `aifind_phase11_test` 和现有每文件独立 `_test` 副本机制。

| 检查 | 结果 | 本轮证据 |
|---|---|---|
| `npm run typecheck` | **PASS** | `typecheck-final.log` / meta，exit 0 |
| `DATABASE_URL=.../aifind_phase11_test npm test` | **PASS**：754 total / 746 PASS / 0 FAIL / 0 CANCELLED / 8 SKIPPED | `full-suite-reviewed.log` / meta，审查修复后完整重跑 |
| `npm run build -w @aihot/web` | **PASS** | `web-build-final.log` / meta，exit 0 |
| `node --test apps/web/tests/*.test.ts` | **PASS**：38/38 | `web-tests-reviewed.log` / meta，审查修复后完整重跑 |
| 6 项 Preview DB/API/guard 测试 | **PASS** | `query-guard-green.log`；也全部纳入最终完整 suite |
| 5 项 Preview built SSR 测试 | **PASS** | 最终 Web suite；真实模块后台进程与专用 `_test` 数据库 |
| Tokyo 午夜/08:59/09:00/跨日回归 | **PASS** | 最终 full suite 的 6 个 manual price/context/FX Tokyo boundary case，以及原日期周期测试 |
| AIFIND Brand / metadata / MCP / 日本语输出基线 | **PASS** | 原相应 full/Web tests 全保留并通过 |
| `node scripts/smoke.ts --base http://localhost:3200` | **PASS**：30 项 | `smoke-final.log`，公共页面/机器出口和 MCP initialize 全通过 |
| 真实 headed Chrome browser smoke | **PASS**：8 项交互验收 | `browser-smoke.json` / `browser-smoke-final.log` / PNG |
| 原 Phase 1 基线逐名称/结果比较 | **PASS** | `phase11-baseline.json`：原 748 项全部保留、缺失/变差 0，新增 6 项 PASS |
| Git Safety | **PASS** | `git-safety.json`，见下节 |
| Production migration / deploy | **UNRUN** | 不属于本阶段授权 |

8 个 SKIPPED 是原 Windows/POSIX signal 基线，不是本轮新增 skip；全部名称/原因保存在新 baseline 的 `originalSkipped`。没有删测试、放宽旧断言或用新增 skip 掩盖问题。

Runner 保持采集/模型/推送安全阀关闭。原 Phase 0.6 `tests/setup.ts` 按既有设计只在网络守卫下为本地 fake models 开启测试调用；该文件及 loopback-only 网络 guard hash 未变，没有真实模型/采集/Feishu/IndexNow 请求。

### TDD / Failure Closure

1. API 测试先 RED（缺少 Preview 实现）→ GREEN。一次 RSS fixture 错把旧 `/rss.xml` 重定向当正文，按实际路由改用 `/feed.xml`；MCP 检查使用真实 `/api/mcp` tools/list 200。
2. Web 5 项先 RED（真实 built SSR 路由不存在）→ GREEN。`.data` 未登录重定向是 React Router 的 202 transport 内封装 302；测试锁定目的地、内部状态及零 Draft 泄漏。没有改框架协议。
3. 第一次 full suite 754/745/1/8 抓到新 SSR fixture 在 Web 内导入 postgres。将数据库准备/清理移至 module-owned test process；原 architecture 测试保持原样，9/9 GREEN；最终 full/Web suites 全通过。
4. typecheck 指出测试中的可空 DTO，以及 Web 测试类型引用拉入后端 import attributes；明确非空断言与独立后台 fixture 解决，最终 typecheck PASS。

### Independent Review / Fix

一次 fresh-context 只读源码审查：Critical 0 / Important 1 / Minor 0。Important 是 `?database=` 可覆盖 postgres startup database，从而绕过 URL pathname 后缀守卫。审查只进行了无连接复现，未向普通/生产库写入。

先补查询参数回归：`query-guard-red.log` **1 FAIL**（Missing expected exception）；随后在连接前拒绝所有 DB URL 查询参数。`database` / `host` / `options` 三类输入全部被拒绝，`query-guard-green.log` **6/6 PASS**；最终完整 suite **754/746/0/0/8**。重启本轮自己的 Preview 服务后，浏览器和 HTTP smoke 再次 PASS。

Important 已由本轮 RED→GREEN 和完整回归关闭；没有未解决 Critical/Important、没有 deferred minors。遵循一次审查/一次重要问题修复流程，没有把作者自检称为第二次独立复审。

## E. Browser Smoke / Visual Acceptance

复用已安装 **Chrome 154.0.8037.95** 与 desktop bundled **Playwright 1.62.1**，headed 模式，1440×1000 CSS viewport，未安装/下载浏览器或自动化库。

| 项目 | 本轮观察 |
|---|---|
| 管理员保护 | 匿名访问实际跳到登录页；用真实密码 session 登录 |
| Japan UI | 实际截图无明显乱码；字段和状态可读；原中国语后台 shell 保持项目约定 |
| 层次与版本 | 左 Published/公開済み/v1，右 Draft/下書き/v2，背景与标题清楚 |
| Unknown 区分 | unknown 灰色 `rgb(89,101,107)`；unavailable 红色 `rgb(179,64,42)`；文字也不同 |
| Price | free=無料，fixed=JPY 2,000/月，custom=個別見積もり，unknown=料金未確認；不把未知标成免费 |
| Evidence | URL、source kind、所引用事实 verifiedAt 与 Draft 专用根据可读 |
| Draft 演示 | 实际点击 CSRF 操作按钮；Draft 名称改变，整个 Published DTO 和 Published DOM 文本完全不变 |
| Hub | hydrated browser 导航，Available → Product Domain Preview 成功 |
| Desktop width | 两栏各 562px，无面板或页面横向溢出；图中全部所需字段正常展示 |
| 浏览器错误与网络 | pageErrors 0、consoleErrors 0、failedRequests 0、外部请求 0；拦截器只放行 loopback |

工具入口限制如实记录：CUA 初始化失败（本机 sandbox helper）；远程 Playwright connector 返回 429。改用现有本机浏览器和 bundled CLI 完成上述真实交互，没有拿静态 HTML 或 HTTP 日志代替浏览器验收。初次 smoke 中重复 robots meta 导致 locator strict-mode 失败，以及 Hub URL 更新早于 DOM 导致过早断言，都改为明确条件等待/逐 meta 检查；最终实际 smoke PASS。

## F. SEO / Security

页面在现有 admin layout 下，自己的 loader 也调用受 session 保护的 admin API；无需依赖父 loader 顺序来保护 Draft。GET/HTML/single-fetch 匿名访问无法读取数据；demo POST 需要既有 CSRF。默认 flag false 的管理员读返回 404，没有任何读取自动 seed。

Preview HTML 和 API 均 `noindex, nofollow` / `no-store`。没有公开 nav、pages、sitemap、Agent/MCP ability 或 RSS/public API 注册；真实出口测试确认没有 Preview slug、URL 或 Draft-only 根据。现有 Published reader 安全边界及事务隔离没有修改。

## G. Git Safety

开始前保存 **849 个** tracked/nonignored untracked 原路径、MISSING 状态、HEAD/index/.env hash 与 8 个计划内接入文件的精确备份。

| 对照 | 结果 |
|---|---|
| 原路径 | 841 个字节不变；8 个计划内局部接入修改；丢失 0；意外修改 0 |
| 既有日本化/Phase 0.5/0.6 | 原内容与原 untracked 文件保留；原 harness/Brand/Tokyo/Prompts/字体不变。`.env.example` 只追加 flag，`AGENTS.md` 只追加新永久规则 |
| Phase 1 Domain | catalog/publication 全不变；package/server/module test 的 Preview 接入有 before diff |
| 已发布 migration | **66 个全部 hash 不变** |
| HEAD / branch | `9848e936106db037d99a304887c36aad3fd0fad4` / 原 `codex/ai-signal-jp` 保留 |
| index | SHA256 `647cea9c84a71ae8002dc0bf17f59b2c704cdeedaf98c6b161415c9ffd1f4ccf` 不变 |
| `.env` | hash 不变；未输出生产凭证 |
| 外部依赖 | 既有 version/resolved/integrity 改动 0；只同步 workspace 关系 |

没有 reset、clean、checkout/restore 覆盖、删旧日本化工作、恢复 SC 字体、stage、commit、merge 或 push。保留前后 hash、`phase11-only.diff`、完整日志与截图。这里只重启了通过 PID/command line 核对的本轮 Preview 进程，未停止其他项目服务。

## H. New Baseline / Limitations / Rulings

后续阶段回归基线：本轮 **754 total / 746 PASS / 0 FAIL / 0 CANCELLED / 8 原 skips**；Web **38/38**；typecheck/build PASS。`phase11-baseline.json` 保存全部名称/状态、旧基线对照和验收证据指针。Phase 1 原 748 项全部保留；既有 module 边界测试按本阶段授权允许 admin Preview，继续禁止 public/task 出口。

已作出的实施裁定及代价：

1. 原 dirty branch 原地局部接入，用 hash/backups/diff 代替新 commit 或 clean-HEAD worktree；这样能保留已有日本化。代价：后续提交仍需分离旧工作与本轮文件。
2. 原生 PS7/Node runner 与 ignored ledger/evidence 持久保留；不运行 POSIX helper、不删除证据。代价：验收证据存于本机。
3. 用户详细 Phase 1.1 请求作为绑定 spec，直接持续执行，不增加重复的计划审批菜单。代价：模块内页面与演示设计选择在本报告中供检查。
4. 按现有 React Router single-fetch redirect 协议断言 202 内的 302；代价：框架将来变更协议时需要同步测试。
5. Seed/demo 对 NODE_ENV=production 也拒绝，即使另一个环境名是 preview；代价：专用本机 Preview 采用 development 环境运行已有 built SSR。
6. Web fixture 的 DB 生命周期由模块测试进程负责；代价：多一个仅测试使用的 helper，保持原 Web HTTP-only 边界。
7. 专用 Preview DB URL 不接受任何 query 参数，以堵住客户端连接覆盖；代价：此本机工具不能在 URL 中配置 query 选项。
8. 审查的 Declined to judge 项裁定：Phase 2/生产发布保持未授权边界；只审查本次使用的既有认证/Domain 边界，不重审所有历史代码；合成事实不能作为真实产品或价格信息。代价：本 Preview 不等同于 Product Admin、生产 readiness 或真实产品事实核验。

Known limitations：只为当前单个示范产品提供固定名字切换；没有真实产品 seed、任意编辑、发布动作、Review Queue 或 Phase 2 功能。未进行生产部署/迁移；原 8 个 Windows signal skips 留给现有 Linux CI。没有评分/事实抽取校准。Preview 数据时间、价格与 Evidence 均为明确合成示例。CUA/远程浏览器 connector 的本机工具问题仍存在，但本阶段真实浏览器验收已用现有本机工具完成。

## I. Phase 2 Gate

**READY**。

理由：提供真实 Domain-backed 可查看 Preview 与 Hub；9 类要求由 API/SSR/生产默认保护测试覆盖；真实 browser 交互与截图完成；审查 Important 已关闭；完整 suite、Web、typecheck、build、Tokyo/Brand 和原工作树保护均通过。该结论只表示后续 Phase 2 可以以本轮基线开始开发。

**本阶段结束，停止。没有自动进入 Phase 2。**
