# AIFIND Phase 4 — Product Resolver + Change Detector

**实施日期：2026-10-06。** 用户本轮粘贴的 Phase 4 要求为执行依据。完成后停止，不进入 Phase 5。

## 已核验架构与保护基线

已完整读取 AGENTS、README、architecture、customize、deploy、Master Spec、Phase 0/0.5/0.6/1/2/3 报告和本轮要求。实际代码是 Node 24 / PostgreSQL / pg-boss / Fastify / React Router 的现有模块体系；前端只通过 HTTP 读后端，公开 Product Reader 独立于管理员 Reader。

Phase 3 基线：完整数据库测试 827（819 PASS、0 FAIL、0 CANCELLED、8 原有 Windows SKIPPED），Web 55 PASS。执行前最高迁移 0074。当前 `codex/ai-signal-jp` 工作树有既有日本化和 Phase 1–3 修改，925 个 Git 已知路径、922 个现存文件已逐文件备份；3 个既有 SC 字体删除保持删除。71 个已有迁移不改。证据目录 `.data/phase4-20261006-9dbb2964/`，`git-before.json` 保存 HEAD、index、env 与所有路径哈希。

现有 Candidate pipeline：`changes/candidates.ts` 创建/审核，`changes/apply.ts` 只 Apply 到 Draft，`catalog/publish.ts` 为独立人工 Publish。状态已有 detected、pending_review、approved、rejected、applied；提案不可改，历史不可删。事务使用 Read Committed，公开快照使用 Repeatable Read。保留所有现有状态和冲突检查。

## 目标链路与边界

Admin registered Source → observe queue → immutable Observation → deterministic-first Resolver → current Published → detect queue → schema/semantic/Evidence validation → Evidence + detected Candidate + provenance + audit → pending_review → Human Approve/Reject → Human Apply Draft → separate Human Publish → Public Reader。

Detector 不导入 Draft 创建、事实 setter、Apply 或 Publish。模型不是事实来源；不允许生成 URL、SQL 或任意字段驱动数据库。

## 契约与生命周期

- Resolver 输入为 Observation 的受控 identity hints、来源关系、短文本和候选产品目录；输出 resolved / ambiguous / unresolved、候选集合、method/version 和可选 receipt。NFKC alias/canonical 精确匹配优先；vendor 或 host 单独不能 resolve。只有管理员登记的 product-source 关系能绑定 URL；冲突 identity 保持 ambiguous。可选模型只能从允许集合选 ID，调用前检查 MODEL_CALLS_ENABLED，通过 chatJson/modelFor/receipts。
- Detector 输入为 Observation、唯一 resolved Product、当前 Published snapshot。输出只接受 7 个现有 Candidate 类型和现有 Domain schema，外加短 quote/locator、unsupported/notes。verifiedAt 固定为空，不能由模型或抓取时间指定。严格校验货币整数 minor units、period/plan/market/unit、原文 quote、controlled keys 与 targetRef ownership；信息不足不生成待审提案。
- Evidence 创建在提案事务中，复用 af_evidence，追加不可变 Observation/quote/locator 关联。retrievedAt 是来源抓取时间；人工 Approve 的 reviewedAt 在 Apply 时写入 Detector Draft fact verifiedAt，Published unchanged。手工 Candidate 保持原有输入时间语义。
- Observation 保存结果、HTTP 状态、hash/ETag/Last-Modified、输入 revision/hash、有限短文本、处理结果/错误。只保存必要材料，不保存完整页面。相同内容记录 unchanged，不调用模型、不改变 lastVerifiedAt/dateModified。

## Schema / 幂等 / 并发

仅新增 `modules/aifind/migrations/0075_aifind_observations.sql`：Monitor、Observation、处理 provenance；Candidate 追加 Observation、source、resolver/detector/prompt version、receipts、稳定 proposal key；Evidence 追加 Observation/quote/locator。FK、check、不可变历史 trigger、唯一 proposal key 均在数据库落实。

Proposal key = product/base/type/key/ref/semantic value/content hash/resolver version/detector version/prompt version 的稳定哈希。不把抓取时间、随机 evidence ID 放入语义 key。事务锁 Product 后再检查 Published base；stale 记录到 Observation，不产生 active pending。Evidence/Candidate/provenance/audit/promotion 和已收到模型 receipt 的完成一同提交；失败回滚后可复用回执。并发重复靠唯一键/产品锁完成。既有 Draft target conflict 和 Apply retry 继续复用。

## 任务与测试顺序

### Task 1 — Resolver 与受控契约

Files: `resolver/contracts.ts`、`resolver/resolve.ts`、`detector/contracts.ts`、`detector/validate.ts`、`tests/resolver.test.ts`。

先写失败测试并实际运行（Expected: 功能缺失导致 FAIL），再实现纯 deterministic resolver、受控输出、稳定版本、optional model adapter。R01–R08；恶意 instruction 只作为文本，集合外 ID 拒绝。Produces: typed ResolverResult / validated proposals。消费者是 Task 3；不创建实体。

### Task 2 — Monitor / Observation 存储与迁移

Files: migration 0075、`detector/monitors.ts`、`detector/observations.ts`、`tests/detector-storage.test.ts`。

先写真实 PostgreSQL 行为测试，Expected RED，再实现最小存储。Monitor 注册审计、disabled 默认、revision、cadence、状态；Observation append-only 输入和保留处理历史。新库全量迁移与从 0074 升级；唯一 key、FK、immutability、deleted history、bad input 约束。Produces: typed DB records，Task 3/4/5 consume。

### Task 3 — Detection / Evidence / Candidate 事务

Files: `detector/detect.ts`、`detector/model.ts`、`changes/candidates.ts`、`changes/apply.ts`、admin Candidate DTO、`tests/detector.test.ts`。

先定位/写回归 RED，再实现已有 schema 二次校验、Evidence-first、detected→pending promotion、幂等事务和 stale protection。D01–D12、K01–K10、X01–X05、T01–T05。真实数据库：synthetic Published V1→Candidate→人工 approve/apply Draft V2→Public V1；另一个测试单独人工 Publish→Public V2。Human review 时刻只用于 Detector Apply，不改 manual 流程。

### Task 4 — 网络、队列、回执与预算

Files: `detector/fetch.ts`、`detector/jobs.ts`、`server.ts`、`.env.example`、必要时已有 Jina wrapper 的兼容可选 receipt identity、`tests/detector-jobs.test.ts` / local fake provider tests。

observe/detect 两个 module-owned queue，Run Now 仅 enqueue，worker recordRun；Asia/Tokyo schedule 只在 COLLECT_ENABLED 和 AIFIND_DETECTOR_ENABLED 同为 true 执行。免费 guardedFetch+bounded extraction；检查 robots/access，403/404/login/anti-bot 不付费绕过。Jina 只显式 opt-in 且必要时经过现有预算/receipt。MODEL false 返回 skipped，不请求；unknown receipt 维持现有 Recovery，不自动重发。B01–B06、J01–J06、SSRF、预算/unknown/transaction retry。

### Task 5 — 最小 Admin 与真实 Preview

Files: `detector/routes.ts`、`preview/detector-seed.ts`、`preview/detector-service.ts`、`web/monitors.tsx`、`web/change-detector-preview.tsx`、`web/review-detail.tsx`、`web/preview-hub.tsx`、`module.ts`、`web.tsx`、Preview scripts、HTTP/Web tests。

先写 auth/CSRF/noindex/queue-only/public isolation 测试 RED。Monitor list/add/toggle/status/run，现有 Review 增加 Detector provenance。简单 Hub card，Preview `/admin/aifind/preview/change-detector`。仅显式 local/dev/test seed，拒绝生产，独立数据库/端口；通过真实队列 Worker 执行 synthetic fixture，不开外部安全阀、不自动 Publish。P01–P09、admin-only/noindex/no sitemap/no public leakage。

### Task 6 — Regression、Chrome、独立 Review、报告

重新执行 typecheck、完整安全 `_test` npm test、Web build/tests、scripts/smoke；对比 Phase 3 827 + 55 逐项旧测试 status/reason。预期无新增 FAIL/CANCELLED/ unexplained SKIP。

独立 `aifind_phase4_preview`，拟端口 3500/3501，不触碰 3200/3300/3400 的旧实例。Chrome visible 1440px 桌面，C01–C15 实际登录/审批/Apply，public 保持 V1；保存指定截图，查看像素。Preview 与生产 flag 默认 false；不启动整个采集 worker。新鲜完整变更 reviewer，处理重要发现后重新全量验证。

报告保存 `2026-10-06-aifind-phase4-product-resolver-change-detector-report.md`，包含用户 A–O、每个矩阵 ID 的证据、真实数量、所有实际修改路径、剩余限制、Git Safety、Phase 4/5 Gate。没有真实验证不得标 PASS。

## Review Focus

查看模型 malformed JSON / 越权 ID、已登记 source 与正文身份冲突、robots 重定向和 SSRF、报价语义不完整、部分 output 无效时的原子性、收到模型响应之后数据库失败、并发 Published 切换、任意 Draft 冲突、SQL trigger 能否绕过 initial detected、Preview seed production guard、公开 DTO 和 sitemap 不泄露内部字段。测试不能只验证 fixture 自己。

## 明确 non-goals

无 Compare、Category/Best、How-to、Affiliate、Newsletter、Search、Account、Watchlist；无新 CMS/框架/cache/微服务/自动 Publish；无大名单、生产 seed/数据改动、系统软件安装、全页面版权归档、宽松 product_attributes KV。

## Git Safety 与执行约定

当前已有用户授权的 dirty feature branch，保留现有 worktree；新 HEAD worktree 会丢失尚未提交的已验收模块，因此不用它替代当前工作。不 reset/clean/checkout/restore、stage/commit/push。不提交 `.data`/secret，不恢复 SC 字体。每次修改仅匹配目标内容；结束比较 before 哈希、index/env/71 迁移、旧 Preview 存储，输出本阶段独立 diff。证据、备份、ledger 保留，不清理。
