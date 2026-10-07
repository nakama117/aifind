# AIFIND Phase 2 — Product Admin + Review Queue 验收报告

日期：2026-10-06。绑定规格：本轮用户 Phase 2 附件 0–51；长期约束：AIFIND Master Spec。工作目录：D:/Projects/aihot。实施计划先于代码保存。

**Phase 3 Gate：READY。** 本轮仅完成 Phase 2；未开始 Phase 3。Gate基于本轮实际 DB/HTTP/SSR/Chrome、旧基线逐项保留及Git核验，不代表生产部署已经执行。

证据目录：D:/Projects/aihot/.data/phase2-20261006-1026c6。日志、JSON、before备份、截图均本机保留，不提交.data或密钥。

## A. Architecture

继续现有 Node24/npm workspaces/Fastify API/React Router Web/PostgreSQL/module 架构。Web loader和所有表单只通过HTTP访问受保护Admin API，不直接导入数据库或后端repository。前端只复用浏览器安全contracts/纯展示/金额转换。新业务在modules/aifind，通用UI仅ReasonDialog可选copy。

Admin read使用Repeatable Read只读快照，返回真实identity/currentPublished/currentDraft/revision/base/history/关联Evidence及字段问题。Dashboard为真实counts和缺证据/确认时间/Vendor的Data Health。产品列表支持all/published/draft/needs_review/no_published、字面名称ILIKE搜索、50+1有界分页。Vendor/Evidence同样q/page查询；已选择项跨查询保留。

Admin mutation复用adminHandler、session、CSRF、audit。RC事务按Product→Version锁序检查token，所有事实/Plan/Price写推进Draft revision，覆盖旧Domain/Preview写入。Published表单只读；身份为独立共享Identity，版本事实编辑必须clone/createDraft后进行。Product slug在明确Catalog事务内可修改并校验唯一、提示未来URL；Vendor slug保持稳定。

Review Candidate受控market/language/platform/capability/plan/price/lifecycle union，不是任意SQL/JSON path。实际source仅manual，detector/import和detected只保留enum。pending_review→approved/rejected；approved→applied；rejected/applied历史不能删除。Apply锁Product→Candidate→Draft，重验当前Published base、Draft lineage和目标语义；无Draft时调用原clone，所有setter/status/audit在同一事务。Apply不调用publish；重复返回原appliedVersionId，无第二份事实/审计。

Publish单独危险区与确认框，调用Phase1原publishProductVersion。缺Evidence/verifiedAt及fixed/from缺billingPeriod均给出具体字段422。unknown允许没有证明；金额字符串→BigInt数字→有界安全整数minor units，未确认价格保持NULL。Evidence只人工metadata追加，修正新建记录再换Draft引用，Published旧证据不可变；无网页抓取或模型调用。

## B. Files

实际修改17个原文件；新增31个实现/测试/计划文件，另新增本报告及执行ledger，共50个项目文件。计划中的preview-web-fixture.ts最终复用原文件而无需修改，package/lockfile/依赖未变。完整清单如下，未将较早的日本化/Phase1/1.1脏文件算成本轮新增。

| 类型 | 文件 | 原因/职责 |
|---|---|---|
| 修改 | [modules/aifind/catalog/versions.ts](D:/Projects/aihot/modules/aifind/catalog/versions.ts) | 可组合事务；clone 记录 base/price lineage；统一 stale 日文。 |
| 修改 | [modules/aifind/catalog/facts.ts](D:/Projects/aihot/modules/aifind/catalog/facts.ts) | 原事实 setter 可接收外层事务，Apply/多字段保存不另开事务。 |
| 修改 | [modules/aifind/catalog/pricing.ts](D:/Projects/aihot/modules/aifind/catalog/pricing.ts) | 原 Plan/Price setter 可接收外层事务。 |
| 修改 | [modules/aifind/catalog/identity.ts](D:/Projects/aihot/modules/aifind/catalog/identity.ts) | 身份原语可组合事务，Product slug 受控编辑；Vendor 时间 token 保持单调和原空更新语义。 |
| 修改 | [modules/aifind/catalog/evidence.ts](D:/Projects/aihot/modules/aifind/catalog/evidence.ts) | 追加 Evidence 可使用外层事务；原 immutable 保留。 |
| 修改 | [modules/aifind/catalog/publish.ts](D:/Projects/aihot/modules/aifind/catalog/publish.ts) | 复用原 RC publish，外层事务/expectedRevision 选项；原审计/DB guards 保留。 |
| 修改 | [modules/aifind/catalog/read.ts](D:/Projects/aihot/modules/aifind/catalog/read.ts) | 私有 VersionRow 读 revision/base；公开 Published DTO 形状不变。 |
| 修改 | [modules/aifind/web/product-preview.tsx](D:/Projects/aihot/modules/aifind/web/product-preview.tsx) | 原 Phase 1.1 展示改用共享视图；原验证继续通过。 |
| 修改 | [modules/aifind/module.ts](D:/Projects/aihot/modules/aifind/module.ts) | 声明五条实际 adminPages/API ownership；公开 pages/tasks/exports 保持空。 |
| 修改 | [modules/aifind/server.ts](D:/Projects/aihot/modules/aifind/server.ts) | 在原 Preview 上注册 Admin API。 |
| 修改 | [modules/aifind/web.tsx](D:/Projects/aihot/modules/aifind/web.tsx) | module 后台导航/页面映射；不注册公共导航。 |
| 修改 | [modules/aifind/preview/routes.ts](D:/Projects/aihot/modules/aifind/preview/routes.ts) | Hub 增加实际 Product Admin / Review Queue 入口。 |
| 修改 | [scripts/seed-aifind-preview.ts](D:/Projects/aihot/scripts/seed-aifind-preview.ts) | 原 Phase 1.1 seed 加 Phase 2 fixture，仍只显式 CLI 调用。 |
| 修改 | [apps/web/app/features/admin/ui.tsx](D:/Projects/aihot/apps/web/app/features/admin/ui.tsx) | 既有 ReasonDialog 可选 copy，默认中文不变，无 AIFIND 硬编码。 |
| 修改 | [modules/aifind/tests/module.test.ts](D:/Projects/aihot/modules/aifind/tests/module.test.ts) | 保留原测试名；按本轮授权核对新增 Admin，仍禁止公开/worker 注册。 |
| 修改 | [modules/aifind/tests/migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/migrations.test.ts) | 保留原八迁移检查并增新两项计数；stale RR 明确接受 PostgreSQL 40001 提前拒绝。 |
| 修改 | [scripts/serve-aifind-preview.ts](D:/Projects/aihot/scripts/serve-aifind-preview.ts) | 复用安全服务方式，用 admin runtime 分开 Phase 2 目录；默认原 Phase 1.1 路径不变。 |
| 新增 | [modules/aifind/admin/contracts.ts](D:/Projects/aihot/modules/aifind/admin/contracts.ts) | Admin 强类型输入/DTO、revision、整数 minor-unit 价格、受控 Candidate union、完整已有价格提案、计费周期、lookup 分页。 |
| 新增 | [modules/aifind/admin/errors.ts](D:/Projects/aihot/modules/aifind/admin/errors.ts) | 400/404/422、字段级缺证据/确认时间/计费周期日文问题。 |
| 新增 | [modules/aifind/admin/products.ts](D:/Projects/aihot/modules/aifind/admin/products.ts) | 身份、Vendor、别名、Draft/Evidence 服务；锁内 revision 检查，原 audit 和 publish 原语。 |
| 新增 | [modules/aifind/admin/read.ts](D:/Projects/aihot/modules/aifind/admin/read.ts) | 真实 RR 只读 Dashboard/list/detail/history/验证；有界名称搜索、Vendor/Evidence lookup。 |
| 新增 | [modules/aifind/admin/routes.ts](D:/Projects/aihot/modules/aifind/admin/routes.ts) | 20 个受现有 adminHandler/CSRF 保护的 HTTP 接口和标准 problem 响应。 |
| 新增 | [modules/aifind/changes/apply.ts](D:/Projects/aihot/modules/aifind/changes/apply.ts) | base/lineage/目标检查；原子 clone+Draft apply+applied+audit，重复幂等。 |
| 新增 | [modules/aifind/changes/candidates.ts](D:/Projects/aihot/modules/aifind/changes/candidates.ts) | manual typed 提案、列表/详情、合法批准/拒绝、audit。 |
| 新增 | [modules/aifind/changes/targets.ts](D:/Projects/aihot/modules/aifind/changes/targets.ts) | 七种受控目标/语义冲突比较、Draft setter 映射、Price lineage。 |
| 新增 | [modules/aifind/web/admin-common.tsx](D:/Projects/aihot/modules/aifind/web/admin-common.tsx) | noindex/no-store、日文确认/状态/根据控件、真实语义 diff。 |
| 新增 | [modules/aifind/web/candidate-editor.tsx](D:/Projects/aihot/modules/aifind/web/candidate-editor.tsx) | 七种 manual 表单；已有价格完整初始化；真实产品选择/证据查询。 |
| 新增 | [modules/aifind/web/dashboard.tsx](D:/Projects/aihot/modules/aifind/web/dashboard.tsx) | Products/Queue/Data Health 真数据。 |
| 新增 | [modules/aifind/web/draft-editor.tsx](D:/Projects/aihot/modules/aifind/web/draft-editor.tsx) | 显式状态、结构化事实、Plan/Price/证据、整数金额和 revision 保存。 |
| 新增 | [modules/aifind/web/evidence-editor.tsx](D:/Projects/aihot/modules/aifind/web/evidence-editor.tsx) | 人工 HTTP/S metadata 追加/阅读，纠错以新记录和 Draft 引用实现。 |
| 新增 | [modules/aifind/web/identity-editor.tsx](D:/Projects/aihot/modules/aifind/web/identity-editor.tsx) | Identity/slug 警示、Vendor 创建/修改/查询选择、别名。 |
| 新增 | [modules/aifind/web/lookup-select.tsx](D:/Projects/aihot/modules/aifind/web/lookup-select.tsx) | 模块内小型 q/page HTTP 选择器，选中项跨搜索/分页保留。 |
| 新增 | [modules/aifind/web/product-detail.tsx](D:/Projects/aihot/modules/aifind/web/product-detail.tsx) | Published 只读/Draft 表单、身份/证据、diff/历史、独立 publish 危险区/422。 |
| 新增 | [modules/aifind/web/product-view.tsx](D:/Projects/aihot/modules/aifind/web/product-view.tsx) | 复用原 Preview 纯展示，未知/否定不同；价格语义、JST 时间、lastVerifiedAt。 |
| 新增 | [modules/aifind/web/products.tsx](D:/Projects/aihot/modules/aifind/web/products.tsx) | 分页/筛选/搜索列表、实际新建身份、有界 Vendor 选择。 |
| 新增 | [modules/aifind/web/review-detail.tsx](D:/Projects/aihot/modules/aifind/web/review-detail.tsx) | Current/Proposed/Base/Draft/证据/冲突；批准/拒绝/Apply 分离。 |
| 新增 | [modules/aifind/web/review.tsx](D:/Projects/aihot/modules/aifind/web/review.tsx) | 真实 Queue 状态筛选/分页/Current/Proposed/Evidence/人工创建。 |
| 新增 | [modules/aifind/tests/admin-fixtures.ts](D:/Projects/aihot/modules/aifind/tests/admin-fixtures.ts) | 真实 DB 测试辅助，无生产入口。 |
| 新增 | [modules/aifind/tests/admin-migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-migrations.test.ts) | 从真实旧 0069 链升级，旧身份/Published/Draft/price lineage 保留。 |
| 新增 | [modules/aifind/tests/admin-preview.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-preview.test.ts) | 3 项默认/production/startup 不 seed、合成 fixture、重复 seed 不覆盖。 |
| 新增 | [modules/aifind/tests/admin-products.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-products.test.ts) | 18 项 Admin/价格/lookup/并发/审计/回滚回归。 |
| 新增 | [modules/aifind/tests/admin-routes.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-routes.test.ts) | 5 项覆盖所有 20 接口认证、13 mutation CSRF、标准错误及公开边界。 |
| 新增 | [modules/aifind/tests/review-queue.test.ts](D:/Projects/aihot/modules/aifind/tests/review-queue.test.ts) | 12 项受控提案、状态机、目标冲突、幂等/rollback/Published 隔离。 |
| 新增 | [modules/aifind/preview/admin-seed.ts](D:/Projects/aihot/modules/aifind/preview/admin-seed.ts) | 显式安全 A/B/候选 fixture；重复 seed 保留编辑、发布及审计状态。 |
| 新增 | [modules/aifind/migrations/0070_aifind_admin_revisions.sql](D:/Projects/aihot/modules/aifind/migrations/0070_aifind_admin_revisions.sql) | version revision/base、price lineage、Draft/identity revision triggers、受控 Product slug guard。 |
| 新增 | [modules/aifind/migrations/0071_aifind_review_candidates.sql](D:/Projects/aihot/modules/aifind/migrations/0071_aifind_review_candidates.sql) | Candidate 表、FK/索引、状态/时间/不可变提案/历史 guard。 |
| 新增 | [apps/web/tests/aifind-admin.test.ts](D:/Projects/aihot/apps/web/tests/aifind-admin.test.ts) | 5 项真实 built SSR+API+隔离 DB 的认证/noindex/DTO/隔离/unknown/price/Hub 测试。 |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase2-product-admin.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase2-product-admin.md) | 编码前实施计划、契约/文件/测试/Preview Gate 和执行闭合。 |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase2-product-admin-report.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase2-product-admin-report.md) | 本轮 A–P 完整验收报告。 |
| 新增 | [.superpowers/sdd/2026-10-06-aifind-phase2-product-admin/progress.md](D:/Projects/aihot/.superpowers/sdd/2026-10-06-aifind-phase2-product-admin/progress.md) | 执行 ledger、TDD/审查裁定及成本，不删除未提交记录。 |

本轮工作分离证据：[phase2-owned-files.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-owned-files.json)、[phase2-only.diff](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-only.diff)；审查当时快照为[phase2-reviewed.diff](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-reviewed.diff)及[review-package-at-review.md](D:/Projects/aihot/.data/phase2-20261006-1026c6/review-package-at-review.md)。本机runner/browser/backup文件均在ignored.data中，完整目录保留，未纳入Git或生产运行。

## C. Migrations

实际开始前最大编号0069。只追加模块0070/0071：

| Migration | 作用 | SHA256 |
|---|---|---|
| 0070_aifind_admin_revisions.sql | Draft/Identity revision、base FK、price lineage/backfill、所有事实写触发token、Product slug受控例外 | 73805ee03efa37cbd1a501ac0421986ae9281c57a1530cad3c96cac8d0b6ebbf |
| 0071_aifind_review_candidates.sql | af_product_change_candidates、受控enum/FK、状态/元数据/不可变history约束、队列索引 | 3501574ae2c00cd1d3af5e40bf656d74d77bf88ec7e0110bfcf70d79fdabd1cd |

**PASS：**本轮完整suite实际执行“empty isolated database migrates all core/modules, then rerun applies nothing”，及“Phase 2 upgrades the existing 0069 chain without losing identities, Published, Draft or price lineage”。旧0069链先建真实旧数据、升级后核对身份/Published/Draft/价格lineage、再迁移不重放。旧Published guards/public DTO继续受原P系列测试验证。

旧66个迁移逐SHA保留，总数由66→68，0062–0069未改。实现时为重放这两个尚未发布的新migration，仅重建本人空且无活跃连接的_test模板；未重写任何已发布migration，未接触生产库。

## D. Admin Routes

| URL | 用途 |
|---|---|
| /admin/aifind | Dashboard |
| /admin/aifind/products | 产品列表/筛选/分页/新建 |
| /admin/aifind/products/:id | Identity、只读Published、Draft事实/Plan/Price/Evidence、diff/history/publish |
| /admin/aifind/review | Queue及受控manual Candidate创建 |
| /admin/aifind/review/:id | Current/Proposed/Base/Draft/Evidence与审核/Apply |
| /admin/aifind/preview | 既有Hub，增加实际Phase2入口 |
| /admin/aifind/preview/product-domain | 原Phase1.1 Preview保留 |

遵循现有module adminPages及admin navigation，没有另造假的Phase2 Preview，也没有公共/products/:slug。

## E. API Contracts

全部前缀/api/admin/aifind，camelCase JSON；所有读写需admin，13个mutation必须CSRF，所有响应no-store/noindex。reason为1–500字，revision为1..MAX_SAFE_INTEGER。列表q≤100、page≥1，50行一页及hasMore。

| Method / suffix | Request → Response / action |
|---|---|
| GET /dashboard | 无→products/review/dataHealth真实counts |
| GET /products | q/filter/page→rows/page/hasMore |
| POST /products | canonicalName/slug/vendorId?/reason→ProductIdentity，未自动发布 |
| GET /products/:id | →identity/identityRevision/vendor/vendors/aliases/published/draft/draftRevision/baseVersionId/history/evidence/publishIssues |
| PATCH /products/:id/identity | expectedRevision/name/slug/vendorId/reason→identity；旧token/重复slug409 |
| POST /products/:id/aliases | alias/aliasType/locale?/reason→alias |
| POST /products/:id/draft | reason→currentPublished clone或initialDraft/revision；已有Draft409 |
| PATCH /products/:id/draft/:versionId | expectedRevision/reason/version?/typed facts?/plans-with-prices?→Draft+新revision，全事务 |
| POST /products/:id/draft/:versionId/publish | expectedRevision/reason→Published DTO；字段问题422，旧token409 |
| GET /vendors | q/page→rows/page/hasMore；有界名称/slug查询 |
| POST /vendors | VendorSchema+reason→Vendor |
| PATCH /vendors/:id | expectedUpdatedAt/nonempty editable fields/reason→Vendor；旧token409，slug不编辑 |
| GET /evidence | q/page→rows/page/hasMore；title/URL/publisher查询 |
| POST /evidence | HTTP/S URL/sourceKind/publisher?/title?/publishedAt?/retrievedAt/evidenceNote?/reason→新Evidence |
| GET /candidates | status/q/page→rows(含Current/Proposed/证据/冲突)/page/hasMore |
| POST /candidates | productId/baseVersionId/candidateType/targetKey/targetRef?/typed proposedValue/evidenceId/sourceType=manual/reason→pending_review Candidate |
| GET /candidates/:id | →CandidateDetail含base/current/draft语义值及conflict |
| POST /candidates/:id/approve | reason→approved及reviewedAt/by，不写Product事实 |
| POST /candidates/:id/reject | reason→rejected及审计，不删历史，不改Product/Draft |
| POST /candidates/:id/apply | reason→candidateId/status=applied/draftVersionId/alreadyApplied；只写Draft，重复无额外写 |

400输入/typed值/引用错误；401未认证；403CSRF/无权；404不存在；409并发/base/目标/state/唯一冲突；422不能发布；500真正未知错误。沿用既有problem/code/detail/requestId，未将所有错误压成500。GET Vendor/Evidence是本轮新API的分页envelope；Product detail已引用的旧Vendor/Evidence仍合并回选项。

价格：free amountMinor=0；fixed/from需currency/正整数amountMinor/非none billingPeriod；custom/unknown amountMinor=NULL。无浮点乘法。已有price提案从Published完整复制region/unit/validFrom/validTo及其他可编辑字段，不因只改金额删除元数据。

## F. A01–A24

下表均由本轮实际完整DB suite与built SSR/Chrome证明，非静态页面或旧日志抽样。

| ID | 要求 | 结果 | 实际证据 |
|---|---|---|---|
| A01 | 匿名不能读 Product Admin | PASS | admin-routes.test.ts + built SSR：所有接口401、页面302/loader202，无 Draft泄漏。 |
| A02 | 匿名不能读 Review Queue | PASS | 同上，Queue/Detail/人工创建等 API 均受 adminHandler。 |
| A03 | 所有 mutation 要 CSRF | PASS | admin-routes.test.ts：13个 mutation 缺token403；真实cookie/token成功、actor入audit。 |
| A04 | 列表是真实受保护数据 | PASS | admin-products.test.ts：分页/5种筛选/名称搜索；SSR真实Identity/versions，不输出secret。 |
| A05 | Draft 正确 clone | PASS | admin-products.test.ts + 原 Catalog clone 回归；base_version_id与当前Published一致。 |
| A06 | Draft 编辑不改 Published | PASS | admin-products.test.ts + B03：整体 Published DTO deepEqual。 |
| A07 | 旧 Draft token →409 | PASS | admin-products/admin-routes + B14：旧token/旧Domain写/direct SQL均失效，winner保留。 |
| A08 | 明确事实无 Evidence 不发布 | PASS | admin-products/admin-routes + B07：422精确字段，Published不变。 |
| A09 | unknown 可以无 Evidence | PASS | admin-products.test.ts：未知事实/价格发布，不造 verifiedAt。 |
| A10 | Publish 使用 Domain primitive | PASS | admin/products.ts调用原publishProductVersion；真实Domain audit/DB gate回归。 |
| A11 | Publish 原子化 | PASS | admin-products.test.ts：发布阶段注入DB故障，Published/Draft/revision/audit一起回滚；原P19–24继续通过。 |
| A12 | 金额 minor-unit 精度 | PASS | admin-products.test.ts：19.99→1999、0.29→29、JPY无小数、MAX_SAFE、超精度/越界拒绝，数据库整数核对。 |
| A13 | 五种 Price 不混淆 | PASS | admin-products + SSR + B05：free0、fixed/from正整数、custom/unknownNULL，未知不免费。 |
| A14 | Candidate 合法状态转换 | PASS | review-queue.test.ts：typed/manual、pending→approved/rejected；非法转换和直接SQL跳转拒绝。 |
| A15 | Rejected 不可 Apply | PASS | review-queue.test.ts + B10：409，Product/Draft完全不变，历史保留。 |
| A16 | Approved 可 Apply | PASS | review-queue.test.ts + B11：无Draft时clone并应用；存在兼容Draft时保留无关修改。 |
| A17 | 重复 Apply 不重复事实 | PASS | review-queue.test.ts：重复/并发价格Apply只一份事实和一条apply审计；B13整DTO/revision不变。 |
| A18 | Apply 只写 Draft | PASS | review-queue.test.ts：七种typed setter均只写Draft；B11返回draftVersionId。 |
| A19 | Apply 不改 Published | PASS | review-queue.test.ts + B11/R01：整个Published reader结果deepEqual，非只比较status。 |
| A20 | 过期 base →409 | PASS | review-queue/admin-routes + B12：当前Published≠base则409且Product/Draft/candidate无写入。 |
| A21 | 冲突不自动 merge | PASS | review-queue.test.ts：lineage或目标/price已变409；只允许目标未变的兼容Draft。 |
| A22 | 关键 mutation 进入原 Audit | PASS | admin-products/review-queue：create/Draftedit/Evidence/approve/reject/apply/publish原audit actor+reason；audit故障全回滚。 |
| A23 | Admin noindex | PASS | admin-routes + built SSR + 最终Chrome：meta、X-Robots-Tag、Cache-Control no-store，包括独立loader。 |
| A24 | Admin/Preview不进sitemap | PASS | module/admin-routes/SSR/原Preview边界 + 最终Chrome：无公共导航/sitemap/RSS/MCP/public Product API。 |

## G. B01–B14

真实已安装Chrome 154.0.8037.95，现有Playwright 1.62.1，headless=false；独立browser context，1440×1000。初始B01–B14实际UI操作时间2026-10-06T03:36:38.141Z→2026-10-06T03:37:06.605Z。原工具CUA Windows sandbox kernel启动失败，改用本机既有工具，无安装。

| ID | 结果 | 实际动作/断言 | 截图/证据 |
|---|---|---|---|
| B01 | PASS | 真实列表名称/Vendor/版本/Last Verified正常。 | [b01-products.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b01-products.png) |
| B02 | PASS | Published左只读、Draft右表单，桌面两栏及日文可读。 | [b02-product-columns.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b02-product-columns.png) |
| B03 | PASS | ja UI unknown→full，保存只改Draft，Published整DTO相等。 | [b03-draft-language.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b03-draft-language.png) |
| B04 | PASS | unknown和unavailable的文字、computed color不同；language unknown/none两个选项。 | DOM/样式证据在browser-smoke-results.json |
| B05 | PASS | free/fixed/custom/unknown各独立文字；fixed USD19.99；unknown无免费/0円。 | [b05-price-semantics.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b05-price-semantics.png) |
| B06 | PASS | 真实UI新增HTTP/S Evidence metadata并关联Draft，URL/kind/verifiedAt可读，无网页抓取。 | [b06-evidence.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b06-evidence.png) |
| B07 | PASS | 移除明确语言事实Evidence，Publish实际HTTP422指出input/output/ui。 | [b07-publish-validation.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b07-publish-validation.png) |
| B08 | PASS | 补证后发布v2、旧v1superseded、无Draft；刷新一致。 | [b08-published-history.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b08-published-history.png) |
| B09 | PASS | Pending的Current unknown/Proposed available、Evidence均可见。 | [b09-review-current-proposed.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b09-review-current-proposed.png) |
| B10 | PASS | Reject后Product/Draft整DTO不变，candidate rejected保留。 | [b10-rejected.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b10-rejected.png) |
| B11 | PASS | 真实UI创建20.99→2099 manual price，Approve→Apply到新Draft，Published整DTO不变。 | [b11-applied-draft-only.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b11-applied-draft-only.png) |
| B12 | PASS | 旧base v1遇到新Published v2，HTTP409，Product整DTO不变。 | [b12-stale-candidate-409.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b12-stale-candidate-409.png) |
| B13 | PASS | 再次Apply alreadyApplied=true，价格数仍2且Draft/revision/整体DTO不变。 | [b13-repeat-apply.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b13-repeat-apply.png) |
| B14 | PASS | 两个真实页面revision16；A保存到47，B旧保存HTTP409；winner保留，Published相等。 | [b14-stale-draft-409.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/b14-stale-draft-409.png) |

审查后另在独立随机_test DB用真实Chrome执行R01/R02/R03（R02分产品+Evidence/Vendor）：全PASS。R01 amount-only完整metadata保留+Published deepEqual；R02选择第51个以后Product/第201个以后Vendor/Evidence，分页/查询及选中项跨查询保留；R03缺计费周期UI拒绝保存且服务器Draft不变。证据[review-browser-results.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/review-browser-results.json)，测试结束仅删除本次随机测试库，3300的A/B数据没有重置。

最终最新3300服务另六页只读Chrome复验全PASS，时间2026-10-06T04:14:06.457Z→2026-10-06T04:14:13.491Z，日文无替换字符、无横向溢出、Published无输入控件、Draft两栏、Evidence/价格可读，pageerror=0、externalRequests=0。人工检查B02/B05/B09/B14及最终Dashboard/价格字段截图。复用的通用后台外壳仍保留其原有中文；AIFIND业务内容/状态/确认/冲突提示为日文。

Chrome补验脚本最初的失败为登录页h1定位、嵌套summary定位及最终只读脚本错误的winner字符串；已保留失败JSON并改正定位/预期，未改产品断言、未增timeout、最终每项实际重跑通过，不以checkpoint跳过项冒充新验收。最终证据[final-browser-results.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/final-browser-results.json)。

## H. Concurrency Proof

Draft：B14两个真实页面同读revision16。A保存后revision47；B提交expectedRevision16实际HTTP409，requestId=536ac0e0-4445-444c-91e8-2ab24750e82f，detail：

> この下書きは別の操作で更新されています。最新の内容を再読み込みしてください。

最终Draft保留“[PREVIEW] Browser concurrent winner”和revision47；B的旧内容未覆盖。单测还证明原Catalog、Plan/Price、direct SQL和原Preview操作都会推进token；外层事务异常同时回滚事实/token/audit。

Candidate：A旧proposal绑定Published v1(4762f8b5-2ab6-46a4-a8d5-f2ffe79ab1d3)，A发布v2(0dc59d0d-e967-444b-9f5a-77bf20b6c492)后再Apply实际HTTP409，requestId=fff59b9a-7d16-413f-b416-8ef550aa6c4e，detail“基準 Published は更新されています。提案を再確認してください。”；Product/Draft整DTO不变，Candidate仍approved。

已有Draft则额外核对base_version_id和目标语义；目标变更或price lineage不符409，无自动merge。无关字段修改被保留。证据[browser-smoke-results.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/browser-smoke-results.json) B12/B14和完整suite A07/A20/A21。

## I. Candidate Safety Proof

B11真实网页创建manual price 20.99 USD→2099 minor，Approve和Apply是两个独立动作。Apply返回Draft 8cc8f828-281a-4fd2-ad07-7e1257a633f0，Published reader前后整个DTO deepEqual。B13二次Apply alreadyApplied=true，价格仍2项、Draft/revision整DTO不变。

单测覆盖七类Candidate、无Draft clone、兼容已有Draft、旧base/目标冲突、并发/重复Apply、跨Product引用拒绝。注入apply audit失败时，clone/Draft facts/candidate applied状态一并回滚。changes/apply没有publish调用或直接Published事实UPDATE；现有DB Published guards仍通过。R01实际已有价格改金额也保留JP/per seat/有效期，Published deepEqual。

## J. Publish Proof

B07明确日语support事实失去Evidence时HTTP422，列出language:ja:input/output/ui，Published不变。B08补齐证据后调用原publishProductVersion：A Draft v2→Published，新Published id=0dc59d0d-e967-444b-9f5a-77bf20b6c492；旧v1→superseded、相同事务发布时间；Draft消失，刷新及重启后一致。

A11真实DB在发布阶段注入失败，版本切换和audit全部回滚；P19–24等原并发/事务边界测试保留并通过。Read-only RR用于读取，所有publish写明确RC；旧RR快照在新revision trigger或旧DB publication gate被拒绝，不能发布新提交的无证据事实。

## K. Security

**PASS：**新20 Admin API全部未登录401；13个写动作缺CSRF403，cookie+真实token调用成功。五条HTML及独立single-fetch loader要求认证，不泄漏Draft。后台/Preview meta及X-Robots-Tag noindex,nofollow、Cache-Control no-store；sitemap/公开导航/RSS/MCP/public API没有Admin/Candidate/Draft注册。公开Published reader边界/DTO未放宽。

Preview seed先guard再任何query：flag默认false；仅显式local/dev/test CLI；Production不论flag一律拒绝；远程host/普通DB拒绝；serve/API/module启动不seed。当前安全服务绑定127.0.0.1:3300/3301，数据库aifind_phase2_preview，seedOnStartup=false、externalActions=false、无worker。

当前运行时凭据仅在[本机管理员登录文件](D:/Projects/aihot/.data/aifind-admin-preview/login.txt)，不在本报告/日志输出密码，未提交.env、密钥或.data。真实采集/模型/Feishu/IndexNow所有阀关闭。完整自动测试保留Phase0.6 localhost fake-model harness，测试内允许fake且MockAgent禁止真实外网，未降低生产安全阀。独立Chrome修复验收的API也全部五阀false并装loopback-only网络guard。

## L. Full Regression

最终均为审查修复后的本轮执行；没有把Phase0.5/0.6/1/1.1旧日志当本轮结果。

| 检查 | 结果 | 实际结果/时间（UTC） | 本轮日志 |
|---|---|---|---|
| npm run typecheck | PASS | exit0；2026-10-06T04:02:51.252Z→2026-10-06T04:02:55.903Z | [typecheck-review-fixes.log](D:/Projects/aihot/.data/phase2-20261006-1026c6/typecheck-review-fixes.log) |
| DATABASE_URL=.../aifind_phase2_test npm test | PASS | 793 total / 785 PASS / 0 FAIL / 0 CANCELLED / 8 SKIPPED；2026-10-06T04:05:56.783Z→2026-10-06T04:08:14.351Z | [full-db-post-review.log](D:/Projects/aihot/.data/phase2-20261006-1026c6/full-db-post-review.log) |
| npm run build -w @aihot/web | PASS | exit0；2026-10-06T04:04:41.553Z→2026-10-06T04:04:44.184Z | [build-post-review.log](D:/Projects/aihot/.data/phase2-20261006-1026c6/build-post-review.log) |
| node --test apps/web/tests/*.test.ts | PASS | 43 total / 43 PASS / 0 FAIL / 0 CANCELLED / 0 SKIPPED；2026-10-06T04:05:56.235Z→2026-10-06T04:07:15.413Z | [web-post-review.log](D:/Projects/aihot/.data/phase2-20261006-1026c6/web-post-review.log) |
| node scripts/smoke.ts --base http://localhost:3300 | PASS | all checks passed / exit0，含public页面/API/RSS/MCP/manifest/OG；2026-10-06T04:13:15.863Z→2026-10-06T04:13:17.481Z | [smoke-post-review.log](D:/Projects/aihot/.data/phase2-20261006-1026c6/smoke-post-review.log) |
| A01–A24 / B01–B14 | PASS | 24条自动矩阵、14条真实Chrome场景；审查补验R01/R02/R03及最新六页也PASS | 上述表/JSON |
| Linux POSIX场景 | UNRUN | 本机Windows，保留原8 SKIP及理由；没有新增skip | 下表 |

测试父进程localhost:55432，DB名字以_test结尾；每文件独立安全副本。复用已存在.data/pg17-client/pgsql/bin PostgreSQL17.11 client，未安装系统软件。typecheck/build/Web/smoke同样五阀false，不加载真实.env或credentials。

逐名称+status+skip reason对照Phase1.1 baseline：**754/754保留、missingOrChanged=[]**；Web **38/38保留、webMissingOrChanged=[]**。新增39个DB测试，新增5个Web测试，无删除/改名/新增skip。[phase2-baseline.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-baseline.json)是后续Phase3回归基线，内含793项名称/状态和完整元数据。Tokyo午夜/08:59/09:00/UTC跨日、08:00日报与Today隔离、AIFIND品牌/Manifest/MCP相关原测试均仍通过；没有另改时间或品牌逻辑。

原8 SKIP逐项保留：

| Test | 原理由（未改变） |
|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |

TDD和审查闭合：初始Admin/Candidate/HTTP/Web/seed缺功能RED→GREEN；审查3问题新增测试实际RED2=27PASS/3FAIL→GREEN=35/35；最终完整793/785/0/0/8。中间full-db-initial785、review-candidate790只作过程证据，最终基线使用post-review793。

一次fresh-context全范围gpt-6-astra源码审查：0 Critical、3 Important、0 Minor。三个Important均已接受并一次TDD修复pass，不递归审查。

| 审查问题 | 修复 | 回归 |
|---|---|---|
| 已有价格提案抹去region/unit/validity | contracts完整复制+Candidate UI全字段；amount-only保留其余值 | review-queue新test、R01真实Approve/Apply Published相等 |
| Product>50及Vendor/Evidence>200无法选择 | bounded q/page API、小型共享LookupSelect、保留已选/已引用记录 | admin-products205/55真实记录、R02 Chrome选择/持久Vendor归属 |
| fixed/from无计费周期可保存/发布 | shared AdminPriceSchema、Candidate/Draft检查、legacy Draft publish逐字段422和UI提示 | fixed/from none拒绝、month/year/usage/one_time接受、R03UI不发PATCH/服务器不变 |

## M. Preview

本机实际Admin已保留运行，访问前按现有登录页认证；密码只见本机登录文件。Prod默认不生成示范数据。

- Dashboard：[http://localhost:3300/admin/aifind](http://localhost:3300/admin/aifind)
- Product list：[http://localhost:3300/admin/aifind/products](http://localhost:3300/admin/aifind/products)
- Product B（当前Published v1 + Draft v2）：[http://localhost:3300/admin/aifind/products/d0e266f0-998b-436a-abc2-13b301f853df](http://localhost:3300/admin/aifind/products/d0e266f0-998b-436a-abc2-13b301f853df)
- Product A（已验收Publish v2 / v1 superseded）：[http://localhost:3300/admin/aifind/products/f499f8e1-03e8-4062-99b3-4fca3c4885fe](http://localhost:3300/admin/aifind/products/f499f8e1-03e8-4062-99b3-4fca3c4885fe)
- Review Queue（全部状态）：[http://localhost:3300/admin/aifind/review?status=all](http://localhost:3300/admin/aifind/review?status=all)
- Applied Candidate：[http://localhost:3300/admin/aifind/review/db32e375-fdd6-4157-951f-5a384aa3f210](http://localhost:3300/admin/aifind/review/db32e375-fdd6-4157-951f-5a384aa3f210)
- Preview Hub：[http://localhost:3300/admin/aifind/preview](http://localhost:3300/admin/aifind/preview)
- 原Product Domain Preview：[http://localhost:3300/admin/aifind/preview/product-domain](http://localhost:3300/admin/aifind/preview/product-domain)

最新页面截图全部为实际Chrome，绝对路径：

| 页面 | Screenshot path |
|---|---|
| http://localhost:3300/admin/aifind | [phase2-dashboard-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-dashboard-final.png) |
| http://localhost:3300/admin/aifind/products | [phase2-products-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-products-final.png) |
| http://localhost:3300/admin/aifind/products/d0e266f0-998b-436a-abc2-13b301f853df | [phase2-product-detail-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-product-detail-final.png) |
| http://localhost:3300/admin/aifind/review?status=all | [phase2-review-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-review-final.png) |
| http://localhost:3300/admin/aifind/review/db32e375-fdd6-4157-951f-5a384aa3f210 | [phase2-candidate-detail-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-candidate-detail-final.png) |
| http://localhost:3300/admin/aifind/preview | [phase2-preview-hub-final.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/phase2-preview-hub-final.png) |

修复补验截图：[r02-searchable-pickers.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/r02-searchable-pickers.png)、[r01-complete-existing-price.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/r01-complete-existing-price.png)、[r03-required-billing-period.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/r03-required-billing-period.png)、[r02-older-vendor-assigned.png](D:/Projects/aihot/.data/phase2-20261006-1026c6/r02-older-vendor-assigned.png)。B01–B14截图见G完整表，409和422原始problem也已保留。

Seed机制：显式执行scripts/seed-aifind-preview.ts，先保留原Phase1.1产品，再调用module preview/admin-seed.ts创建明显[PREVIEW] A pub+Draft/B pubonly、pending/approved Candidate。当前3300库内3个合成产品；浏览器验收后A已发布v2、B有Apply后的Draft，Queue为0 pending/2 approved/1 rejected/1 applied，这是实际操作后的状态，未重新seed覆盖。重复seed测试证明后续Draft修改/发布/审核历史被保留；不会为截图恢复旧数据。相对启动配置只需显式AIFIND_PREVIEW_ENABLED=true及专用本地_preview DB；default/production/startup不seed。

Phase2 runtime用.data/aifind-admin-preview，原Phase1.1 3200/3201、数据库/密码/runtime路径保留。最终仅核验PID+命令后重启自己3300的三个node进程，未停止其他项目/PG或旧Preview；runtime.json记录seedOnStartup=false，没有启动Product seed。

## N. Git Safety

Before 2026-10-06T02:26:07.638Z记录865个tracked/untracked原路径及SHA。最终**848路径完全未变，17个本轮范围内原文件修改均有逐SHA一致的before备份**。lost=[]、unexpectedChanges=[]、backupMismatches=[]、unexpectedNew=[]，旧66 migrations hashMismatch=[]。已有日本化、Phase0/05/06/1/1.1报告、SC字体替换、site品牌等未覆盖；Phase1/1.1关键代码只在上述17范围内增量组合，其余旧工作hash不变。

| 项目 | Before / After |
|---|---|
| HEAD | 9848e936106db037d99a304887c36aad3fd0fad4 / 相同 |
| Branch | codex/ai-signal-jp / 相同 |
| index SHA256 | 647cea9c84a71ae8002dc0bf17f59b2c704cdeedaf98c6b161415c9ffd1f4ccf / 相同 |
| .env SHA256 | 1d03b4a5c9ae0f14c0eb9ef515b37f13b62c6ddb4df27f4e482ab40d85d6352a / 相同（未读取/输出秘密） |
| 已有migration | 66个逐hash相同；新0070/71追加为68 |

没有reset/clean/checkout/restore覆盖、整批替换、删除旧文件/测试、恢复SC字体、stage/commit、merge/push或生产DB连接。所有DB写仅明确安全_test副本或本机专用_preview合成数据。Git安全证据[git-before.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/git-before.json)、[git-safety.json](D:/Projects/aihot/.data/phase2-20261006-1026c6/git-safety.json)、[git-status-before.txt](D:/Projects/aihot/.data/phase2-20261006-1026c6/git-status-before.txt)、[git-status-after.txt](D:/Projects/aihot/.data/phase2-20261006-1026c6/git-status-after.txt)及before目录；当前所有旧修改仍留原工作树。

执行裁定及成本（完整ledger保留）：

| 裁定 | 效果 | 代价 |
|---|---|---|
| 保持现有dirty branch/HEAD/index，before hash/diff替代commit范围 | 不覆盖旧日本化/Phase1/1.1工作 | 仍未提交，后续需按phase-only diff拆分 |
| PS7/Node runner/ledger替代POSIX helper，保留本机证据 | Windows运行及Git安全规则成立 | 证据依赖本机.data/ledger |
| 按最新附件Apply-to-Draft后单独Publish及minor-unit契约 | 不采用Master较早“批准即发布”示例 | 较早示例不描述本轮行为 |
| Product slug仅Catalog事务local guard特例 | 满足Identity编辑，默认SQL/Vendor stable slug guard保留 | Phase3需确定公开URL/redirect策略 |
| Dashboard和Candidate迁移在各自RED后共同闭合 | Dashboard真实Queue统计 | 初始服务阶段共享表依赖 |
| 旧stale RR测试仅新增精确40001/concurrent update拒绝路径 | revision trigger可提前拒绝，断言仍禁止发布 | 拒绝可来自两层DB安全机制 |
| 旧迁移计数明确保留原8并加新2 | forward extension，零旧SQL改动 | 测试期望数随本轮授权扩展 |
| Phase2采用独立runtime目录 | 不覆盖旧Preview密码/runtime | 一个仅本地helper的runtime选择参数 |
| Reviewer declined：public/SEO/Detector/Resolver/extraction不评 | 按用户Phase2范围保留边界 | 仍为未来能力 |
| Reviewer declined：未定义stale-age运营阈值 | Dashboard只报实际缺证据/时间，不编造过期规则 | 尚无基于年龄的stale计数 |
| Reviewer declined：production现场执行未评 | 生产数据未动，只有guard tests | 本轮不验证生产部署 |
| 保留有界lookup，增加搜索/分页而非无界拉取 | 消除50/200选择障碍 | 小型module UI及显式查询点击 |
| finishing采用保留原分支/工作树 | 用户要求保护dirty工作的收尾 | 不进行提交、合并、PR或工作树清理 |

## O. Known Limitations

仅列预期后续能力：尚无公开Product/SEO/URL redirects；尚无Detector/Resolver/自动AI抽取或产品官网抓取；尚无Compare/Category/Best/How-to CMS/Affiliate/Newsletter/public search/账号/Watchlist；没有真实生产产品批量seed或生产部署。stale-age运营期限需后续定义。没有新增CMS/WordPress/Next.js/Redis/搜索服务或微服务。

本轮三个Important问题已修复并验证，没有将新增回归放入Known Limitation，没有删除/skip失败测试或放宽金额/隔离断言。

## P. Phase 3 Gate

**READY**

原因：实际Product Admin可维护Identity/Draft/事实/Plan/Price/Evidence并发布；Review Queue可typed manual审核/拒绝/Apply到Draft；stale Draft及Candidate409、幂等/审计/回滚/Published隔离均有真实证据；A01–24/B01–14全PASS；独立审查的3个Important完成TDD及Chrome补验；完整suite793/785/0/0/8、Web43/43、typecheck/build/smoke通过，旧754/38和8skip理由全部保留，Git Safety成立。

Phase3以后应以本报告和phase2-baseline.json为regression baseline。当前Preview已可直接浏览。本轮停止，不自动开发或上线Phase3。
