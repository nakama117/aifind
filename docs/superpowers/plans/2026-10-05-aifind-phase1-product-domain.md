# AIFIND Phase 1 — Product Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 用户已要求「先自检，然后执行」；本会话原地执行，保护当前脏工作树。步骤以复选框记录，详细 RED/GREEN 日志保存在本轮独立 `.data/phase1-*`。

**Goal:** 在 PostgreSQL 中建立独立、可追溯的产品领域，保证草稿编辑不影响已发布产品，不添加任何公开产品出口或 Admin UI。

**Architecture:** 新增 `modules/aifind` 工作区，通过 `site/modules/server.ts` 注册无 HTTP/任务/页面插口的 server module。Vendor/Product 是稳定身份；可变事实属于 ProductVersion，发布读取统一经过模块 `publication/products.ts`，聚合由 catalog 实现。所有修改只作用于 draft；发布事务锁定 product/version、验证证据、替换当前发布版并复用 audit_log。框架无需扩展。

**Tech Stack:** 当前 Node 24.14.0、TypeScript 7.0.2、postgres 3.4.9、Zod 4.6.5、PostgreSQL 17；复用 `@aihot/backend/db`、`newUuid()` 和 `audit()`，不新增 ORM 或运行时依赖版本。

**Spec:** 用户 Phase 1 附件的 0–47 节是本阶段直接规格；`docs/AIFIND_MASTER_SPEC.md` 第 7–10、12、16–18 节提供长期约束。当前用户的细化版本模型和 integer minor units 优先于主规格较早的 EAV/decimal 示例。

## Global Constraints

- 仅 Product Domain；没有 Admin/Review Queue、公开 `/products` 或产品 API、Resolver/Detector、编辑内容、Compare 或其他后续功能。
- PostgreSQL 是唯一事实库；全部新表 `af_`，专属迁移新增在 `modules/aifind/migrations/`。
- 不改任何既有 migration；当前最大编号经 `rg --files` 核验为 0061，新迁移从 0062 开始。
- 不改品牌、导航、日报 08:00、评分/门槛、Japan sources、旧模块；不恢复三个已删除 SC 字体。
- 不 reset/clean/checkout/restore，不 stage/commit；保存 dirty baseline 和本阶段独立 diff，保持 HEAD/index。用户已有工作是实施起点，不可用 HEAD 替换。
- 不加载真实 .env、不改生产或已有内容库；测试只用 `127.0.0.1:55432/*_test` 与 harness 独立克隆。
- 父进程 COLLECT_ENABLED / MODEL_CALLS_ENABLED / FEISHU_CONTENT_PUSH_ENABLED / FEISHU_INTERNAL_ENABLED / INDEXNOW_SUBMIT_ENABLED 全 false；保留 Phase 0.6 本地 fake service 安全 harness。
- 测试临时 PATH 使用已有 `.data/pg17-client/pgsql/bin` 的 PostgreSQL 17.11；不安装或升级。
- Web 只读 HTTP；本阶段不注册 public route，因此无需修改核心 publication 层。后续公开出口必须经核心 publication 接入这一已发布投影。

## Review Focus

1. 直接 SQL / 并发编辑可能绕过 domain：数据库禁止编辑已发布/已 superseded 的事实，父 version 锁将事实写入与发布串行化；测试直接 SQL 拒绝与并发 publish。
2. 把其他产品的 version/plan/price 传入：domain 必须检验完整 ownership，外键禁止孤儿；测试 A/B 交叉写入、发布。
3. 已发布读取在发布切换中跨多个 SELECT：用 repeatable-read read-only 快照聚合，单次结果只含一个版本；克隆每类事实和价格，测试无共享可变行。
4. 缺少的 Android / 能力记录、空币种、0、超出 JS 精确整数范围：缺省未知；fixed/from 要正整数+币种；free 恰为 0；unknown/custom 恰为 null；拒绝小数及不安全整数。
5. 有核验时间但事实还是 unknown，或者草稿刚改标题：lastVerifiedAt 只取当前已发布的明确且有证据的事实核验时间，不取 updated_at、draft 或 unknown 的时间。

## 实际仓库核验与接入决策

- 三个既有模块通过 `site/modules` 的地址/server/web 三清单接入；无对应插口时不登记那份清单。本阶段仅 server 清单新增一项，地址/web 清单保持。
- `scripts/migrate.ts` 扫描 core 和所有 module migrations，按文件名全局排序，逐文件事务 + schema_migrations，未启用模块也会被扫描。
- `packages/backend/src/db.ts` 的 int8/numeric parser 返回 Number，因此价格使用 bigint 并限定 `0..9007199254740991`，输入用 safe integer 校验；不做浮点美元转换，也不改共享 parser。
- `newUuid()` 已存在，旧模块常用 text ID；新表用 text + 现有 UUID helper，FK 同类型。时间用 timestamptz，价格生效区间用 date。
- `tests/databases.ts` 先迁移模板，每文件独立克隆；根 `npm test` 自动匹配 `modules/*/tests/*.test.ts`；modules tsconfig 会从顶层入口递归检查新目录。
- `tests/architecture.test.ts` 已检查框架/前端边界、模块互不导入、数据库列使用；新模块另补边界测试，不弱化既有规则。
- Phase 0.6 已确认 Windows 基线 694/686/0/0/8，Web 33/33。后续比较逐 test name 和 skip 条件，而不只比较总数。

## Exact file map

| 文件 | 职责 |
|---|---|
| `modules/aifind/package.json` | 新工作区，仅 backend/contracts/Zod 同版本；显式 exports |
| `modules/aifind/server.ts` | name-only ServerModule；不注册 HTTP、cron、队列 |
| `modules/aifind/contracts.ts` | 浏览器可共享的 DTO、受控枚举与输入 schemas；不导入 backend/DB |
| `modules/aifind/catalog/identity.ts` | Vendor/Product/Alias 创建读取；Vendor display fields 更新，slug 不提供更新入口 |
| `modules/aifind/catalog/normalize.ts` | Alias NFKC、lowercase、trim、whitespace collapse；不 fuzzy resolve |
| `modules/aifind/catalog/versions.ts` | 创建初始 draft、克隆 published、修改 draft，ownership/锁 |
| `modules/aifind/catalog/evidence.ts` | HTTP/S metadata 与短说明写入读取，append-only domain |
| `modules/aifind/catalog/facts.ts` | 市场、独立语言维度、平台和能力 draft upsert |
| `modules/aifind/catalog/pricing.ts` | Plan 与 Price 独立、draft-only、整数和 ownership 校验 |
| `modules/aifind/catalog/read.ts` | 私有聚合：批量读各事实并组成严格 DTO；可信核验时间计算 |
| `modules/aifind/catalog/publish.ts` | evidence validation、发布原子事务、audit |
| `modules/aifind/publication/products.ts` | 显式 getPublishedProductBySlug / listPublishedProducts；绝不调用 draft reader |
| `modules/aifind/tests/module.test.ts` | 注册、没有公开出口、框架不反向导入、contracts 无 DB |
| `modules/aifind/tests/identity.test.ts` | P01–P03 与身份验证 |
| `modules/aifind/tests/versions.test.ts` | P04–P07、draft unique/ownership、克隆隔离 |
| `modules/aifind/tests/evidence.test.ts` | URL/metadata/hash/短说明验证 |
| `modules/aifind/tests/facts.test.ts` | P08–P12、受控词汇/证据、缺省 unknown |
| `modules/aifind/tests/pricing.test.ts` | P13–P17、DB 约束、Plan/Price ownership |
| `modules/aifind/tests/publication.test.ts` | P18–P24、publish rollback/concurrency、lastVerifiedAt |
| `modules/aifind/tests/migrations.test.ts` | 空库共存/幂等、FK、删除/孤儿、SQL immutability |
| `modules/aifind/tests/fixtures.ts` | 合成数据、测试辅助；不加入 seed |
| `modules/aifind/migrations/0062_aifind_identity.sql` | Vendor/Product/Alias |
| `modules/aifind/migrations/0063_aifind_versions.sql` | Version、unique、draft mutation lock function |
| `modules/aifind/migrations/0064_aifind_evidence.sql` | Evidence 与 lifecycle 的 evidence/verified 字段 |
| `modules/aifind/migrations/0065_aifind_markets_languages_platforms.sql` | 3 类事实、枚举/unique、draft 写保护 |
| `modules/aifind/migrations/0066_aifind_capabilities.sql` | 受控 capability、draft 写保护 |
| `modules/aifind/migrations/0067_aifind_plans_prices.sql` | Plan/Price、金额约束、draft 写保护 |
| `modules/aifind/migrations/0068_aifind_publication_guards.sql` | 发布证据 gate、版本/证据不变约束 |
| `site/package.json`、`site/modules/server.ts` | 局部追加新包和 server 登记，保留原三模块 |
| `Dockerfile` | 追加新模块 package COPY，保留原构建 |
| `package-lock.json` | 离线、无升级更新 workspace 元数据；检查现有依赖版本/完整性不变 |
| 本计划与 `2026-10-05-aifind-phase1-product-domain-report.md` | 执行依据与 A–L 验收报告 |

如类型/聚合辅助需要另一个文件，在执行记录说明实际文件；不创建未使用空目录。

## Migration design

关系：Vendor ← Product ← Alias / Version；Version ← Market / Language / Platform / Capability / Plan；Plan ← Price；Evidence 被所有明确事实及 lifecycle 引用。

- 所有 FK 使用 RESTRICT / 默认 NO ACTION；无 blanket cascade，不提供 hard-delete 产品或 evidence 的 domain API。测试依靠 clone DB 生命周期。
- Slug 非空受控格式且 unique；数据库限制 slug 不可更新；显示名称可改。
- `(product_id, version_no)` unique；partial unique `WHERE status='draft'` 和 `WHERE status='published'`；版本状态与 published_at/superseded_at 配对约束。
- 版本事实 PK/unique 属于 `product_version_id`；计划 key 在版本内 unique；Price 只能 FK 到所属 Plan，domain 校验 product/version/plan chain。
- Market 初始 allowlist JP/US（有效 ISO 3166-1），Language ja/en，Currency JPY/USD/EUR/GBP；受控扩展需新迁移+contract，不把 schema 固定到 JP。Vendor country 同 allowlist。
- Availability unknown/available/unavailable/waitlist/restricted；语言/capability unknown/none/partial/full；platform unknown/available/unavailable。Plan active_status unknown/active/inactive。
- `amount_minor bigint`，上限 JS safe integer；free=0，fixed/from>0 且 currency 非空，unknown/custom=NULL；不使用 Float/DOUBLE PRECISION，不从金额字符串解析 Float。
- lifecycle 也保存 evidence_id/verified_at；明确事实可先存在 draft，publish gate 拒绝缺少 evidence 或 verified_at；unknown 不要求证据。
- published/superseded version 以及其事实不可修改/删除；唯一允许 published→superseded 改 status 和 superseded_at。Evidence 不可原地更新，以新增记录保留历史引用。
- 发布服务先完成 domain 验证；数据库 gate 同样拦截直接 SQL 不可信发布；发布与事实修改使用同一父 version 行锁。

## Interfaces

输入 schemas 接受 unknown，校验后产生强类型；DTO 使用 camelCase，内部 SQL rows 私有 snake_case。

| 文件 | 主要接口 |
|---|---|
| identity | `createVendor(input): Promise<Vendor>` / `updateVendor(id,input): Promise<Vendor>` / `getVendor(id): Promise<Vendor|null>`；`createProduct(input): Promise<ProductIdentity>`；`addProductAlias(productId,input)` / `listProductAliases(productId)` |
| normalize | `normalizeAlias(value: string): string` |
| versions | `createProductDraft(productId,input,createdBy?:string|null)`；`clonePublishedProduct(productId,createdBy?:string|null)`；`updateProductDraft(productId,versionId,input)`；`getDraftProduct(productId): Promise<DraftProduct|null>`；`editDraft(productId,versionId,fn(tx))` 仅模块内部 |
| evidence | `createEvidence(input): Promise<Evidence>`；`getEvidence(id): Promise<Evidence|null>` |
| facts | `setProductMarket(productId,versionId,input)`、`setProductLanguageSupport(...)`、`setProductPlatform(...)`、`setProductCapability(...)` |
| pricing | `saveProductPlan(productId,versionId,input): Promise<ProductPlan>`；`saveProductPrice(productId,versionId,planId,input): Promise<ProductPrice>`（input.id 可更新该 Plan 的 draft price） |
| read | `readProducts(db,identityVersionRows)` 批量聚合；`validatePublishedFacts(product)`；draft/public 显式 projection，不返回 createdBy 等内部字段给 public |
| publication | `getPublishedProductBySlug(slug): Promise<PublishedProduct|null>`；`listPublishedProducts({limit?:number,offset?:number}={}): Promise<PublishedProduct[]>`，limit 1–100、offset≥0；repeatable-read read-only transaction |
| publish | `publishProductVersion(productId,versionId,actor,reason): Promise<PublishedProduct>`；锁定身份/版本、所有权、draft-only、证据检查、旧 superseded/新 published、同事务 audit；不加 outbox 或无消费者队列 |

PublishedProduct 包含 identity/vendor/aliases/version/markets/languages/platforms/capabilities/plans（含 prices）/evidence/lastVerifiedAt。缺少平台/能力默认未知；ja、JP 未建事实时读作 unknown；不将缺记录当否定。lastVerifiedAt 取明确、证据齐全的当前发布事实 verified_at 最大值；unknown/draft/updated_at 不参与。

## Test mapping P01–P24

| ID | 文件 | 手工期望 |
|---|---|---|
| P01 | identity.test.ts | 重复 vendor slug 被 DB unique 拒绝；改显示名 slug 保留 |
| P02 | identity.test.ts | 不同 vendor 仍不能重复 product slug |
| P03 | identity.test.ts | ` Ｃｌａｕｄｅ　ＣＯＤＥ `→`claude code`，日语/旧名原样显示 |
| P04 | versions.test.ts | draft-only slug published reader=null |
| P05 | versions.test.ts | v1 published + v2 draft，仅读 v1 |
| P06 | versions/publication.test.ts | 克隆改价格/市场/语言/平台/能力后线上 DTO 完全相同 |
| P07 | versions.test.ts | 第二 current published SQL unique 拒绝 |
| P08 | facts.test.ts | JP unknown 与 US unavailable 分别保留 |
| P09 | facts.test.ts | ja full/full/none 合法 |
| P10 | facts.test.ts | 无 android 证据，读取 unknown |
| P11 | facts.test.ts | text unknown，coding none 区分 |
| P12 | facts.test.ts | 任意 capability key domain/DB 均拒绝 |
| P13 | pricing.test.ts | free 恰为 0，free 2000 拒绝 |
| P14 | pricing.test.ts | unknown 恰为 null，unknown 0 拒绝 |
| P15 | pricing.test.ts | custom 恰为 null，custom 0 拒绝 |
| P16 | pricing.test.ts | fixed 无币种/无金额拒绝 |
| P17 | pricing.test.ts | 1999 minor units 精确往返；拒绝小数/不安全整数；DB bigint |
| P18 | publication.test.ts | price free/fixed/from/custom 缺 evidence 或时间禁止 published |
| P19 | publication.test.ts | available/unavailable/waitlist/restricted 缺证据或时间禁止 published |
| P20 | publication.test.ts | all unknown 无 evidence 可发布 |
| P21 | publication.test.ts | list/detail 永不返回 draft，DTO 不含 createdBy |
| P22 | publication.test.ts | publish 原版 superseded，新 draft published，audit 原子提交 |
| P23 | publication.test.ts | 验证失败与更新中途注入失败，旧 published 不变 |
| P24 | publication.test.ts | 时间取可信事实，忽略未来 unknown 核验/草稿/updated_at |

## Step-by-step TDD tasks

### Task 1: Module skeleton

**Files:** module.test.ts、package.json、server.ts；site/package.json、site/modules/server.ts、Dockerfile、lock。
**Interfaces:** name-only ServerModule；exports backend 与 contracts。

- [x] Write test `module installs without registering product routes or tasks`；按既有运行注册行为检查无新公开地址，框架无具体模块 import。
- [x] Run targeted test，Expected: FAIL，AIFIND server 未建立。
- [x] 最小 module package/server 和 site 登记；离线更新 lock/工作区链接，不变任何现有版本。
- [x] Run targeted test，Expected: PASS；保存 RED/GREEN。

### Task 2: Identity

**Files:** identity.test.ts、identity.ts、normalize.ts、contracts.ts、0062。
**Interfaces:** Vendor/ProductIdentity/Alias 与 identity 接口如上。

- [x] 写 P01/P02/P03，另测非法 slug、HTTP/S URL、别名歧义允许跨产品、vendor name 更新保留 slug。
- [x] 运行 Expected: FAIL，身份能力/表未建立。
- [x] 新迁移与最小 CRUD、共享 normalization；slug 更新入口不提供，数据库拒绝直接改 slug。
- [x] 迁移后运行 Expected: PASS；SQL FK/unique 真正执行。

### Task 3: Version isolation

**Files:** versions.test.ts、versions.ts、read.ts、publication/products.ts、contracts.ts、0063。
**Interfaces:** draft 创建/读取、published detail 初始 identity/version 投影；后续任务扩展 facts。

- [x] 写 P04–P07、一个 draft 限制、versionNo 递增、跨产品拒绝、已发布版本不得直接编辑。
- [x] 运行 Expected: FAIL，版本表/接口未建立。
- [x] 新版本迁移与锁/状态约束，最小 create/clone/update 和严格 published predicate。
- [x] 运行 Expected: PASS；准备后续事实克隆扩展，不提前建事实表。

### Task 4: Evidence

**Files:** evidence.test.ts、evidence.ts、contracts.ts、0064。
**Interfaces:** Evidence metadata，版本 lifecycle 的 evidence/verified 字段。

- [x] 写 URL 拒绝 javascript、短说明长度/哈希格式、metadata 往返、跨版本 evidence 可引用。
- [x] 运行 Expected: FAIL，证据表/接口未建立。
- [x] 新迁移+最小证据写读，生命周期核验字段加入 DTO，不存全文。
- [x] 运行 Expected: PASS。

### Task 5: Market / Japanese / Platform

**Files:** facts.test.ts、facts.ts、read.ts、versions.ts、contracts.ts、0065。
**Interfaces:** 3 个 draft setters，aggregate+clone 按 version 深复制。

- [x] 写 P08/P09/P10、非法 market/language/platform、克隆不共享行、SQL 已发布事实不可改。
- [x] 运行 Expected: FAIL，字段能力未建立。
- [x] 新迁移、draft upsert、聚合缺省 unknown、事实 clone；publish evidence gate 留 Task 9。
- [x] 运行 Expected: PASS。

### Task 6: Capabilities

**Files:** facts.test.ts、facts.ts、contracts.ts、read.ts、versions.ts、0066。
**Interfaces:** controlled capability setter+aggregate+clone。

- [x] 写 P11/P12，Expected RED；支持 unknown/none/full 而不接受任意 key。
- [x] 实现 capability 新迁移、验证、复制与读取。
- [x] 运行 Expected: PASS。

### Task 7: Plans / Pricing

**Files:** pricing.test.ts、pricing.ts、contracts.ts、read.ts、versions.ts、0067。
**Interfaces:** Plan/Price DTO、draft save、版本 clone 重建 Plan/Price IDs。

- [x] 写 P13–P17，另测 plan/price 跨产品所有权、JP/US 月/年费用独立、有效期倒置拒绝、小数/不安全 integer 拒绝。
- [x] 运行 Expected: FAIL，计划/价格能力未建立。
- [x] 新迁移、整数 schema 与 draft 写入；SQL price shape CHECK，clone 每个 plan 的 prices 到新 plan。
- [x] 运行 Expected: PASS，人工核对 bigint/schema、1999 精确往返。

### Task 8: Complete aggregate published reader

**Files:** publication.test.ts、read.ts、publication/products.ts、contracts.ts。
**Interfaces:** 完整 PublishedProduct、bounded list/detail、DraftProduct 另一个接口。

- [x] 写 P06/P21/P24 聚合、所有 facts/evidence、pagination、内部 createdBy 不外露；Expected RED。
- [x] 批量 version-scoped queries，同一只读 snapshot，严格 allowlist DTO，lastVerifiedAt 仅可信明确事实。
- [x] 运行 Expected: PASS；未来 Web 不必自行拼事实。

### Task 9: Atomic publish primitive and DB publication gate

**Files:** publication.test.ts、publish.ts、read.ts、contracts.ts、0068。
**Interfaces:** publishProductVersion 与可信验证。

- [x] 写 P18/P19/P20/P22/P23、每类明确事实缺 evidence/time、foreign version、并发 publish；注入数据库 trigger 故障确认旧版/audit 都回滚；Expected RED。
- [x] domain publish 实现锁/验证/状态切换/audit，DB 同步 gate；published/superseded 版本/事实不可改，证据 append-only。
- [x] 运行 Expected: PASS；不产生 Admin/API/Review Queue/outbox 消费者。

### Task 10: Migration and full regression closure

**Files:** migrations.test.ts、本阶段报告；核验全部新增/现有文件。
**Interfaces:** 测试基线与下一阶段可依赖 domain。

- [x] 写并运行空库 migrate（不使用已有 template 当空库）、共存/重复 migrate 不再应用、FK 与 RESTRICT/无孤儿测试。
- [x] 保持原安全测试配置，运行 typecheck/full suite/Web build/tests。Expected: 0 FAIL / 0 CANCELLED；原 8 SKIPPED 相同；原 686 tests 仍 PASS。
- [x] 完成一次 fresh-context 只读代码审查；依 Superpowers executing-plans 对重要问题 RED→GREEN 修复并完整回归。
- [x] 核对 baseline 原路径与 Phase 0.5/0.6 hashes、HEAD/index/env、旧 migration；写 A–L 报告及独立 diff。Expected: 既有工作零丢失，旧受保护路径字节不变，只有计划列出接入文件局部追加。
- [x] 停止；Phase 2 Gate 只写 READY/NOT READY，不启动 Phase 2。

## Verification commands

所有命令由 `pwsh.exe -NoLogo -NoProfile -Command` 执行，先核验 PS 7（本轮已完成 7.6.5）。环境：

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aifind_phase1_test'
$env:COLLECT_ENABLED = 'false'
$env:MODEL_CALLS_ENABLED = 'false'
$env:FEISHU_CONTENT_PUSH_ENABLED = 'false'
$env:FEISHU_INTERNAL_ENABLED = 'false'
$env:INDEXNOW_SUBMIT_ENABLED = 'false'
$env:TZ = 'UTC'
$env:PATH = 'D:\Projects\aihot\.data\pg17-client\pgsql\bin;' + $env:PATH
npm.cmd run typecheck
npm.cmd test
npm.cmd run build -w @aihot/web
node --test apps/web/tests/*.test.ts
```

Targeted TDD：`node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test --test-timeout=120000 modules/aifind/tests/<file>.test.ts`；日志+exit+实际 counts 保存在本轮 .data。验证工具 `pg_dump --version`、`pg_restore --version`；不启 worker/外部服务。无新前台无需视觉重设；如安全隔离启动 API/Web 则跑标准 smoke。

## Plan self-review

已逐项对照用户 0–47、AGENTS、实际模块/DB/迁移/test runner、Master Spec 的未知/版本/证据/发布边界、Phase 0.6 门禁。P01–P24 全部有任务和真实数据库测试；publish primitive 明确实现；无旧 migration 改写、没有新 public/Admin 表面，也没有 unused outbox。阶段范围的所有功能由用户已授权，不另设计划批准门。HEAD/index 不提交以便保护旧脏工作；执行记录使用独立 hash/diff/ledger，代替 commit 范围。

## Execution closure

Tasks 1–10 complete. Final evidence: .data/phase1-20261005123410132-3e92fe. Source review found one Important stale Repeatable Read publishing-snapshot bypass, reproduced and fixed with explicit Read Committed publication plus appended 0069. No applied migration rewritten. verification.ts and publish.test.ts isolate shared rules/tests; rulings and costs in final report. Final full suite 748 total / 740 PASS / 0 FAIL / 0 CANCELLED / 8 unchanged skips; all prior 686 PASS retained. Typecheck and Web build/tests PASS; module tests 54/54. Phase 2 Gate READY; stop here.
