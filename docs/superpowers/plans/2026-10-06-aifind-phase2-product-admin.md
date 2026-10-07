# AIFIND Phase 2 — Product Admin + Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans，原地、逐任务 TDD；本轮用户已授权完整实施，不增加计划批准门。保持已有 dirty worktree，结束后停止，不进入 Phase 3。

**Goal:** 管理员通过真实网页维护产品身份、Draft 事实/套餐/价格/证据、发布版本，并人工审核受控 Candidate；Apply 只写 Draft。

**Architecture:** 延用 modules/aifind、React Router adminPages、Fastify adminHandler、现有 CSRF / useAdminAction / ReasonDialog / audit(db:tx)。Web 只通过 HTTP；Catalog 的既有原语增加可组合事务参数，Admin/review 在同一 Read Committed 事务内校验 revision/base/ownership、调用 Domain 并审计。Published reader 和数据库历史不变约束保留。

**Tech Stack:** 现有 Node 24 / React Router SSR / Fastify / PostgreSQL 17 / postgres / Zod；不安装依赖或系统工具。

**Spec:** 用户 Phase 2 附件（2026-10-06，0–51 节）是绑定规格；Master Spec 为长期约束。已完整读取 AGENTS、README、architecture/customize/deploy、Master Spec、Phase 0/05/06、Phase 1 plan/report、Phase 1.1 report，并核实真实 Catalog/auth/CSRF/audit/module/UI。

## Global Constraints

- 只开发 Product Admin / Review Queue / 实际 Admin Preview；无 public products / SEO、Detector / Resolver、编辑 CMS、Compare、商业、搜索重构或新服务。
- Candidate `pending_review → approved/rejected → applied`，Apply ≠ Publish；覆盖 Master Spec 较早的批准即发布示例，不自动改线上事实。
- 当前迁移最大编号经实际文件核实为 0069；仅追加 module 0070/0071，66 个旧迁移逐 hash 保留。
- 不 reset/clean/checkout/restore、stage/commit、merge/push；原分支 codex/ai-signal-jp、HEAD/index 不变。865 个原路径完整 hash 在 `.data/phase2-20261006-1026c6/git-before.json`。
- 不加载真实 .env、不连接 aisignal_launch 或生产库；安全测试入口 `127.0.0.1:55432/aifind_phase2_test`，每文件独立 `_test` 副本。
- 父进程所有采集/模型/Feishu/IndexNow 阀 false；保留 Phase 0.6 loopback-only fake-model harness，测试 PATH 只复用已有 PG17.11 client。
- Preview 明显 [PREVIEW]，仅显式 CLI 写入 localhost 专用 `_preview/_test/_ci` DB；flag 默认 false，production 一律拒绝 seed；API 启动不 seed。
- Admin-only、no-store、noindex，所有单独 loader 也读受保护 API；无公共导航/sitemap/RSS/MCP/public API 注册。

## Review Focus

1. stale Draft覆盖；
2. stale Candidate覆盖新Published；
3. unknown被UI误转换为false；
4. price float精度；
5. Candidate Apply意外直接写Published。

每类同时有真实 DB/API 测试及 Chrome 验收；最终一次 fresh-context 全范围源码审查进一步检查这些边界。

## Exact file map

| 文件 | 职责 |
|---|---|
| 新 `modules/aifind/admin/contracts.ts` | 浏览器安全的 Admin request/response、Draft 保存、revision、价格十进制字符串转换、差异、候选受控 union |
| 新 `modules/aifind/admin/errors.ts` | NotFound / invalid input / 发布字段错误；使用原 Conflict |
| 新 `modules/aifind/admin/read.ts` | Dashboard、带界限分页/筛选/名称搜索的产品列表、详情/历史/Evidence/validation；同一只读快照 |
| 新 `modules/aifind/admin/products.ts` | 身份/厂商/别名、Draft 创建/保存、Evidence 追加、调用 publish 原语；每次人工修改 audit |
| 新 `modules/aifind/admin/routes.ts` | 唯一 Admin API adapter；所有接口 adminHandler+noindex；404/409/400/422 区分 |
| 新 `modules/aifind/changes/candidates.ts` | 人工提案、只读列表/详情、批准/拒绝状态机与审计 |
| 新 `modules/aifind/changes/targets.ts` | 受控类型到现有 Catalog schema/setter 的映射、语义值/目标冲突判断；无任意 SQL/path |
| 新 `modules/aifind/changes/apply.ts` | product→candidate→version 锁序，base/目标检查、clone+apply+标记+audit 原子事务和幂等 |
| 新 `modules/aifind/migrations/0070_aifind_admin_revisions.sql` | version revision/base FK、price clone lineage、所有 Draft 写的 revision triggers；受控 Product slug 编辑 |
| 新 `modules/aifind/migrations/0071_aifind_review_candidates.sql` | typed Candidate 字段、FK、合法状态和 metadata 约束、索引、不可变提案/状态 guard |
| 改 `catalog/{versions,facts,pricing,identity,evidence,publish}.ts` | 既有函数可接收外部 tx；clone 记录 lineage；publish 可校验 expected revision；身份编辑原语 |
| 改 `catalog/read.ts` | 私有 VersionRow 新字段（公开 DTO 形状保留） |
| 新 `web/{admin-common,dashboard,products,product-detail,draft-editor,identity-editor,evidence-editor,review,review-detail,candidate-editor,product-view}.tsx` | 实际日文 Admin UI、表单、字段证明、两栏、diff、history、确认框；仅 HTTP/安全 contracts |
| 改 `web/product-preview.tsx` | 抽取现有 State/At/Price/Snapshot 到共享 product-view；旧 Preview 行为保留 |
| 改 `module.ts/server.ts/web.tsx` | 五条 adminPages / admin API ownership / 后台导航；保留 Phase 1.1 路由 |
| 改 `preview/routes.ts` | Hub 两个真实 Phase 2 入口 |
| 新 `preview/admin-seed.ts` | 独立 A/B 合成产品、pending/approved 提案；幂等重复保留管理员修改 |
| 改 `scripts/seed-aifind-preview.ts` | 显式追加 Phase 2 数据；不改 serve 启动 seed 规则 |
| 改 `apps/web/app/features/admin/ui.tsx` | ReasonDialog 可选通用日文 copy；原默认中文不变，不硬编码 AIFIND |
| 新 `modules/aifind/tests/{admin-products,review-queue,admin-routes,admin-migrations}.test.ts` | A01–A24 的真实数据库/API/并发/回滚/迁移测试 |
| 新 `modules/aifind/tests/admin-fixtures.ts` | 测试辅助，禁止生产使用 |
| 改 `tests/module.test.ts`（module 内） | 按新授权声明 admin routes，继续禁止公共/任务出口 |
| 复用 `tests/preview-web-fixture.ts`（module 内，无修改） | 原真实 Domain API fixture 已覆盖 built SSR；Phase 2测试通过HTTP创建提案，DB生命周期仍在后端进程 |
| 新 `apps/web/tests/aifind-admin.test.ts` | built SSR/HTTP 认证/noindex/差异/状态/价格/Hub 测试，不导入数据库 |
| 本计划、`2026-10-06-aifind-phase2-product-admin-report.md` | 执行与完整 A–P 报告 |

如果执行发现需要一个模块内辅助文件，在 ledger / 报告逐项记录；不增加未用抽象或通用框架依赖。

## Admin routes

`/admin/aifind` Dashboard；`/admin/aifind/products` 列表/新建；`/admin/aifind/products/:id` 详情；`/admin/aifind/review` 队列/人工提案；`/admin/aifind/review/:id` 差异审核。
保留 `/admin/aifind/preview` 和 `/admin/aifind/preview/product-domain`。后台导航有 Dashboard / Products / Review / Preview，公共导航不变。

## Admin API contracts

全部前缀 `/api/admin/aifind`，session + 非 GET/HEAD CSRF，JSON camelCase。名字/URL/枚举/所有权/列表界限在共享 schema 及 Domain 验证。

| Method / suffix | Request → Response |
|---|---|
| GET `/dashboard` | 无 → product/review/dataHealth 真实 counts |
| GET `/products` | `q` ≤100、filter all/published/draft/needs_review/no_published、page≥1 → rows/page/hasMore，50 条一页 |
| POST `/products` | ProductSchema + reason → identity（尚未发布） |
| GET `/products/:id` | → identity/identityRevision/vendor/aliases/published/draft/draftRevision/baseVersionId/history/evidence/publishIssues/diff |
| PATCH `/products/:id/identity` | expectedRevision + canonicalName/vendorId/slug/reason → identity；slug 唯一且提示未来 URL |
| POST `/products/:id/aliases` | AliasSchema + reason → alias |
| POST `/products/:id/draft` | reason → clone 当前 Published，或 initial unknown Draft；已有 Draft 409 |
| PATCH `/products/:id/draft/:versionId` | expectedRevision、可选 version/markets/languages/platforms/capabilities/plans（prices 嵌套）、reason → 最新 Draft/revision |
| POST `/products/:id/draft/:versionId/publish` | expectedRevision + reason → publishProductVersion 的 Published DTO；字段 validation 不满足 422 |
| GET/POST `/vendors` | 列表 / VendorSchema+reason → vendor |
| PATCH `/vendors/:id` | expectedUpdatedAt + VendorUpdateSchema + reason → vendor，保留 Vendor 稳定 slug |
| GET/POST `/evidence` | bounded 列表 / EvidenceSchema+reason → metadata；修正以新记录替换引用，原证据永久保留 |
| GET/POST `/candidates` | status/q/page / typed manual proposal + baseVersionId/evidenceId/reason → Candidate |
| GET `/candidates/:id` | → base/current/proposed/draft 语义值、来源、status、Evidence、apply 冲突上下文 |
| POST `/candidates/:id/approve`、`/reject` | reason → legal transition，非法 409 |
| POST `/candidates/:id/apply` | reason → applied/draftId/alreadyApplied；重复不写第二次 |

400 invalid request（含 price/domain shape、非法引用）；401 anonymous；403 CSRF；404 不存在；409 revision/base/field/state/unique 冲突；422 发布字段证明不完整；500 未知故障。沿用既有 problem 响应格式/request ID，无 stack 输出。

## Candidate data model / state machine

`af_product_change_candidates`：id、product_id、base_version_id、candidate_type、target_key、nullable target_ref、proposed_value jsonb、evidence_id、source_type、status、created_at、reviewed_at/by、applied_at、applied_version_id、review_reason。base/product 组合 FK 保证归属；proposed_value 是经过 Catalog schemas 的 typed 值，不能任意 column/JSON path。

类型 market/language/platform/capability/plan/price/lifecycle，source manual/detector/import（API 本轮只接受 manual）。状态 `detected` 仅保留 enum；真实创建是 pending_review。pending 可 approved/rejected；approved 可 applied；rejected/applied 终态。Approve、Reject、Apply 均 service 控制并 audit；数据库同时约束状态/时间搭配和提案不可变。

market/keyJP、language/keyja、platform/keyweb、capability受控key、plan/稳定planKey、price/planKey+published price ID（null 表新增价格）、lifecycle 固定key。价格 clone 用 private base_price_id 对应，避免靠易变金额/位置猜测 ID。已有 Draft 的新价格候选比较整组基准价格，变动即冲突；其他类型比较对应语义目标，包括 proof，不自动 merge。

## Optimistic concurrency strategy

- af_product_versions 增加 `revision bigint`（safe integer）和 `base_version_id`。Draft 内容更新、任何 market/language/platform/capability/plan/price INSERT/UPDATE/DELETE 都在 DB trigger 推进父 revision，涵盖原 Domain 和旧 Preview demo。
- Admin save/publish 在 product→version 行锁下比较 expectedRevision；不一致返回 409 与日语：`この下書きは別の操作で更新されています。最新の内容を再読み込みしてください。`
- 保存所有选中字段是一个事务；多字段写使 revision 多次递增也是合法 token，返回最终值。异常回滚内容、token、audit。
- identity 有独立 revision；Vendor 用锁内 expectedUpdatedAt。Product slug 仅在 Catalog 明确、事务内、针对该 Product 的 local setting 下允许更新；默认直接 SQL stable-slug guard 和 Vendor 不变规则保留，原 P01/P02 继续执行。Phase 3 再强化 slug/redirect 策略。
- Apply 锁定 Product/Candidate/当前 Draft；当前 Published id ≠ base →409。已有 Draft 必须 lineage 相同且目标语义和 base 相同；否则409。不自动重定位或合并。没有 Draft 则调用 clone 原语，同事务 setter + applied + audit。
- applied 重试只返回原 appliedVersionId；不再次写事实/clone/审计。不会为避免冲突读取旧 RR 写快照。

## Draft editing / Review Queue model

Published 左栏只读；右栏 Draft 表单，显式状态 select。版本基础信息和所有受控事实、Plan/Price/proof 可保存。未知永远不转 boolean；JPY 整数，USD/EUR/GBP 最多两位十进制，字符串→BigInt→经上限校验后的整数 minor units，不 parseFloat/乘浮点。free 0，fixed/from 正整数+币种，custom/unknown null。

身份独立表单，别名追加，Vendor 选择/创建/显示字段编辑。Evidence 人工填 HTTP/S metadata，添加后进入下拉；不 fetch。更正创建新 Evidence，替换 Draft 引用，Published 引用保留。缺 proof 的明确事实能存 Draft，详情/Publish 显示每个问题字段；真正发布在单独危险区用现有 ReasonDialog 确认。

Queue 有 pending/approved/rejected/applied 筛选和名称搜索；人工提案是受控表单，不提供任意 JSON 编辑器。详情显示当前/基准/建议值与证据。批准与应用分开；应用成功链接 Draft。拒绝不改 Product；过期和目标冲突明确提示重新人工审核。

Dashboard 展示当前真实 counts / 缺证据明确 Draft facts / 无 vendor / 无 Published。未定义 stale 运营期限，不临时发明计时规则。

## Test mapping / tasks

| ID | test file | 断言 / 会捕获的错误 |
|---|---|---|
| A01/A02/A03 | admin-routes.test.ts | anonymous所有读写401、所有写缺CSRF403、无Draft泄漏；新接口遗漏包装会失败 |
| A04 | admin-products/admin-routes | 真数据列表、分页/筛选/名称查询、无secret/internal行；错误filter会失败 |
| A05/A06 | admin-products | clone 真实所有事实、修改Draft Published深度相等 |
| A07 | admin-products/admin-routes | 同revision双save一成功一409；旧Domain/Preview写也使token失效 |
| A08/A09/A10 | admin-products/admin-routes | specific missingproof 422，unknown允许，Domain audit/DB gate 实际生效 |
| A11 | admin-products | 发布阶段DB故障注入全回滚；沿用全部Phase1 atomic/isolation回归 |
| A12/A13 | admin-products + builtWeb | 19.99 USD→1999，0.29→29，MAX_SAFE，超精度拒绝，4种金额/文字分开 |
| A14/A15 | review-queue | pending→approve/reject，rejected不能apply、不能随意状态跳转 |
| A16/A17/A18/A19 | review-queue | approved clone/apply，二次/并发apply price只一行，Published完整不变 |
| A20/A21 | review-queue/admin-routes | 新Published后旧base409；Draft目标已改409，其他目标改动不误冲突；无自动merge |
| A22 | admin-products/review | 创建/编辑/证据/approve/reject/apply/publish的真实audit；audit故障事务回滚 |
| A23/A24 | admin-routes + builtWeb | 五页面匿名redirect/noindex/no-store，实际sitemap/public/RSS/MCP无Admin/Draft |

### Task 1: Catalog composability and Product Admin services

**Files:** admin/contracts/errors/read/products、0070、catalog 局部修改、admin-products.test.ts / admin-fixtures.ts。
**Interfaces:** `readAdminProduct(id)`, `saveAdminDraft(productId,versionId,input,actor)`, `createAdminDraft`, `publishAdminDraft`；expectedRevision 外层事务与 Catalog tx 参数。
- [x] 写 A04–A13/A22、直接 SQL/旧 Domain 修改 token、并发、slug、minor单位、失败 rollback 断言。
- [x] 运行 targeted，Expected: RED 功能未实现，保留日志。
- [x] 最小 contracts、forward migration、Catalog tx 接口和真实 services；原 public DTO 和 guards 保留。
- [x] targeted+原Catalog回归 GREEN；修失败用 systematic-debugging。保存日志/ledger，不提交旧工作。

### Task 2: Candidate state machine / atomic apply

**Files:** changes 三文件、0071、review-queue.test.ts。
**Interfaces:** `createCandidate`, `reviewCandidate`, `readCandidate`, `listCandidates`, `applyCandidate`；强类型 proposal、base/target语义。
- [x] 写 A14–A21/A22、noDraft/已有Draft、target冲突、price lineage、重复/并发、apply/audit故障 rollback。
- [x] targeted Expected: RED；再实现最小 service/数据库约束，绝不调用 publish。
- [x] targeted及完整后端 suite Expected: 0 FAIL/0 CANCELLED，原754项保留。

### Task 3: Protected HTTP adapter and migration closure

**Files:** admin/routes、module/server、admin-routes/admin-migrations、module.test.ts 局部授权更新。
**Interfaces:** 上述 API 表，所有独立 handler adminHandler；标准 problems。
- [x] 先 HTTP RED：A01–03/A07/A08/A20/A23/A24，真实 session/CSRF、不存在/非法/冲突/验证状态。
- [x] 添加唯一 API adapter，Domain 原语+transactionaudit；无公共注册。
- [x] 实际空 `_test` 库 migrate→再 migrate 幂等；从既有0069链升级验证新列/旧数据保留。Expected: PASS。

### Task 4: Actual Japanese Admin UI

**Files:** web 11 文件、现有Preview共享视图、web.tsx、generic ReasonDialog 可选copy、built SSR测试与后端fixture。
**Interfaces:** HTTP loaders、useAdminAction；共享browser-safecontracts、puredecimal转换/semanticdiff。
- [x] 新 built SSR测试先 RED（路由/实际数据尚未存在），覆盖 auth、noindex、version隔离、unknown/price、Hub。
- [x] 实现列表/新建/身份/Vendor/别名/Draft事实/Evidence/PlanPrice/validation/publish/history/diff/Queue人工提案/审核应用。
- [x] built SSR及旧38Web tests Expected: GREEN；typecheck/build PASS。表单确认/409 与Tokyo显示使用现有helper。

### Task 5: Preview fixtures, Chrome acceptance and final closure

**Files:** preview/admin-seed、seed CLI/Hub、报告、ignored evidence/ledger/browser脚本。
**Interfaces:** `seedAdminPreview()` 明确非Production手动调用；原Phase1.1 seed继续保留。
- [x] seed guard/重复保留编辑测试先 RED→实现 A pub+Draft/B pubonly/pending+approved 合成fixture。
- [x] 本机专用新 `aifind_phase2_preview` migrate/seed后启动安全loopback API/Web，无worker/外部调用；不改旧Preview库或真实内容。
- [x] 真 Chrome B01–B14全部执行，截图+JSON+HTTP409+Published前后DTO保存，浏览器只放行loopback。
- [x] 一次fresh-contextreview，Important/Critical一个TDD修复pass并完整回归；不递归重审。
- [x] 最终 typecheck/fullDB/build/Web/smoke PASS，旧754 test names/status和原8skip逐项比较；Git旧路径/迁移hash/index/env核验。
- [x] 报告 A–P全部完成，Phase3 Gate READY/NOT READY；保留可看Preview并停止。

## Browser acceptance scenarios

B01真实列表字段；B02 Published/Draft两栏；B03 ja UI unknown→full保存、Published完全不变；B04 unknown与none/unavailable文字+样式不同；B05 free/fixed/custom/unknown区别；B06新增证据并关联、显示URL/kind/verifiedAt；B07明确事实缺proof发布被阻止且指出字段；B08补proof发布、旧superseded新pub无Draft、刷新；B09 pending差异与Evidence；B10 reject Product/Draft不变；B11 approve→apply只变Draft；B12过期base Apply409、无写入；B13已applied重复不dup；B14两个页面旧token409、A不被覆盖。

每项检查实际DOM和HTTP/Domain before/after，保存截图与结果，不把API注入或静态HTML冒充Chrome。常规桌面1440px、无乱码、无横向页溢出、pageerror/externalrequest=0。

## Preview Gate / Verification commands

实际 Admin就是Phase2 Preview；Hub链接Product Admin/Review Queue。管理员密码保留在ignored本机文件，不输出。默认及Production不会auto-seed。

全部执行pwsh.exe -NoLogo -NoProfile -Command。测试父进程 DATABASE_URL=`postgres://postgres@127.0.0.1:55432/aifind_phase2_test`，所有阀false、TZ=UTC、PG17 client PATH、不加载.env。命令：

```text
npm run typecheck
npm test
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
node scripts/smoke.ts --base http://localhost:3300
```

targeted：`node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test --test-timeout=120000 modules/aifind/tests/<file>.test.ts`。
日志/exit/counts/时间为本轮新执行；基线754/746/0/0/8、Web38/38。Gate要求原可运行测试无回归、A01–24/B01–14全部PASS、GitSafety成立；不以未运行Linux的原8 skip冒充失败或新增skip。

## Plan self-review / execution rulings

覆盖附件0–51与Master长期约束；不重复auth/CSRF/audit、不预建后续业务。决定按本轮细化状态机与minor-unit契约执行。继承旧domain+新revision trigger，使包括旧Preview在内的所有事实写失效旧Admintoken。Published DTO不加入Admin lineage/token；新增schema兼容旧读取。
按用户已授权范围连续原地执行；PS7/Node ledger替代POSIX helper和Git commit范围，保留ignored验收证据。代价：后续提交需按before-diff拆分旧工作，证据依赖本机文件。Identity受控slug更改为本轮明确例外，未来公开页阶段需重新确立URL改变策略。

## Execution closure (2026-10-06)

All five tasks complete. Final actual results: typecheck/build exit0; full DB793 total/785PASS/0FAIL/0CANCELLED/8originalSKIP; Web43/43. Old754/38 names/status retained. Real Chrome B01-B14, review-fix R01/R02/R03 and latest six-page readonly smoke PASS. Fresh whole-scope review0Critical/3Important/0Minor; all3 fixed via RED-to-GREEN plus full suite, no re-review. Additional module-only lookup-select.tsx and admin-preview.test.ts are in final file inventory; original preview-web-fixture.ts reused unchanged. Git head/index/env and66oldSQL preserved;17 scoped existing files have exact before backups. Final A-P report: docs/superpowers/plans/2026-10-06-aifind-phase2-product-admin-report.md. Phase3 Gate READY; no Phase3 implementation.
