# AIFIND Phase 4 — Product Resolver + Change Detector：实施与验收报告

日期：2026-10-06。仓库：`D:\Projects\aihot`。

**Phase 4 Gate = READY。Phase 5 Gate = READY。本轮在 Phase 4 停止，不开始 Phase 5。**

本报告只使用本轮实际执行证据。最终冻结验证为 `*-acceptance.log` / `*-acceptance-meta.json`，最终浏览器证据为 `chrome-acceptance/`；不以中间运行或历史截图作为最终结果。

证据目录：`D:\Projects\aihot\.data\phase4-20261006-9dbb2964`。实施计划：`docs/superpowers/plans/2026-10-06-aifind-phase4-product-resolver-change-detector.md`。完整逐测试基线：`phase4-acceptance-baseline.json`。文件前后 hash、备份和最终差异：`git-before.json`、`before/`、`git-safety.json`、`phase4-only.diff`。

## A. Architecture

最终路径：

```text
Registered Source Monitor
  → aifind.observe worker
  → immutable Source Observation
  → deterministic Resolver / optional allowlisted model Resolver
  → Published Domain Reader snapshot
  → aifind.detect worker + strict semantic validation
  → Evidence + Candidate(detected) + audit
  → Candidate(pending_review)
  → Human Approve
  → Human Apply → Draft
  → separate Human Publish
  → existing Published Reader → Public Product
```

PostgreSQL 仍是唯一事实存储；队列复用现有 pg-boss。Product Domain 仍是唯一产品事实模型。Observation 是来源输入和处理历史，Candidate 是待人工审核提案，两者都不替代 Product facts。

Web 只通过 HTTP 读取 API，没有数据库、provider 或密钥依赖。公开 Product 页面、公共 DTO、SEO、导航继续使用原有 Published Reader，本轮没有新增公开 Detector API、RSS、MCP 或 Search 出口。GET 页面不运行 Resolver/Detector/provider。管理员 Run Now 和 Preview action 仅入队并记录审计，实际处理在 worker。

新增代码主要位于 `modules/aifind/resolver/`、`detector/`、`preview/` 和 `web/`。框架仅在现有 Jina wrapper 中增加可选的持久 logical identity；不加入 Redis、其他搜索引擎、CMS、微服务或新前端框架。

## B. Schema

唯一新增 migration：`modules/aifind/migrations/0075_aifind_observations.sql`。没有改写此前 71 个 migration。0074 → 0075 的真实数据库升级测试保留旧 Product、Published、Draft、Evidence 和 Candidate 的值。

### 新表及全部字段

| Table | Columns | 约束及索引 |
|---|---|---|
| `af_source_monitors` | `id`, `product_id`, `url`, `source_kind`, `publisher`, `identity_hint`, `vendor_hint`, `enabled`, `allow_jina`, `cadence_minutes`, `revision`, `next_check_at`, `last_check_at`, `last_success_at`, `last_changed_at`, `last_content_hash`, `last_error`, `created_at`, `updated_at` | id PK；可空 product FK RESTRICT；HTTP(S) URL ≤2000；source kind 使用既有 8 类；publisher 1–200；hint ≤200；enabled/allow_jina 默认 false；cadence 默认1440、范围60–43200；revision>0；hash 为64位小写hex；error≤1000。`af_monitors_due(next_check_at,id) WHERE enabled`、`af_monitors_product(product_id,id)`。 |
| `af_source_observations` | `id`, `monitor_id`, `product_id`, `monitor_revision`, `url`, `source_kind`, `publisher`, `identity_hint`, `vendor_hint`, `retrieved_at`, `published_at`, `http_status`, `fetch_outcome`, `content_hash`, `input_hash`, `source_text`, `etag`, `last_modified`, `state`, `reason`, `base_version_id`, `resolution`, `candidate_ids`, `unsupported`, `receipt_ids`, `created_at` | id PK；monitor/product/base version FK RESTRICT；revision>0；HTTP status 100–599；input/content hash 64hex；excerpt≤12000；reason≤1000；resolution 为 resolved/ambiguous/unresolved 对象；数组默认空。成功输入须2xx、非空文本、hash；非成功输入须空文本且无content hash。`af_observations_monitor(monitor_id,retrieved_at DESC,id)`。 |
| `af_observation_runs` | `id`, `observation_id`, `state`, `reason`, `base_version_id`, `resolver_version`, `detector_version`, `prompt_version`, `resolution`, `candidate_ids`, `unsupported`, `receipt_ids`, `created_at` | id PK；Observation/base version FK RESTRICT；reason≤1000；append-only 处理记录。 |

Observation state 的 DB allowlist：`observed`、`unchanged`、`fetch_failed`、`unresolved`、`ambiguous`、`model_disabled`、`detected`、`no_changes`、`invalid`、`stale`、`error`、`budget_blocked`、`receipt_unknown`。Run 记录保存每次处理结果；没有把 unsupported 输入转成新的 Product 属性。

### 扩展既有表

| Table | 新 columns / constraints |
|---|---|
| `af_evidence` | `observation_id` FK RESTRICT；`evidence_quote` 1–500字符；`locator_start`、`locator_end`。`af_evidence_locator` 要求手工 Evidence 全部为空，或 Observation/quote/合法坐标成组存在。 |
| `af_product_change_candidates` | `observation_id` FK RESTRICT；`source_url`、`resolver_method`、`resolver_version`、`detector_version`、`prompt_version`；`resolver_receipt_id`、`detector_receipt_id` 为 bigint receipts FK RESTRICT；`proposal_key` 为 UNIQUE 64hex；`af_detector_provenance` 要求 detector 来源具有完整 provenance。 |

新增 `af_guard_observation` / `af_observation_guard`：Observation 输入不可更新、历史不可删除；仅处理状态、原因、base、resolution、Candidate/unsupported/receipt 列可更新。`af_observation_run_immutable` 复用现有 immutable guard，拒绝 Run 更新/删除。

新增 `af_guard_detector_candidate_insert` / `af_detector_candidate_insert`：detector Candidate 插入状态只能是 detected，必须引用已存在且与 Observation 的 URL、hash、retrievedAt、原文 substring 一致的 Evidence；禁止自动填写 verifiedAt/lifecycleVerifiedAt。原0071的 immutable proposal、合法状态转换、审核历史仍有效。

所有明确 FK 均 RESTRICT；UNIQUE proposal_key 是跨重试去重的数据库约束。没有新增 Draft/Published 旁路表。类型、FK、状态、唯一性、不可变历史、升级与重复安装在本轮真实数据库测试中通过。

## C. Resolver

1. 用 NFKC 归一化 canonical name / registered alias，做确定性 identity 匹配；不把 Vendor 当作 Product，不因同一 host 就认定产品。
2. Vendor 只用于缩小已有重名 identity 集合。已注册 product 关系、exact official URL 与正文中的已知 canonical/alias 都参与独立核对；配置 hint 不能掩盖正文明确提到的另一个 Product。
3. Copilot 等共享 alias 返回 ambiguous 候选集合；unknown identity 返回 unresolved，不创建产品或别名。配置关系、hint、正文之间的明确冲突设置 hardConflict，模型不能覆盖。
4. 可选 model path 仅在安全阀开启且已有可供选择的非硬冲突候选集合时执行。响应必须是 strict schema；只能选 candidateIds 内的 Product，ambiguous/unresolved 必须 productId=null。越界响应保留 receipt 并被拒绝。
5. 复用 `chatJson`、既有 model preset、receipts 与 budget，不直接使用外部 SDK。版本为 `aifind-resolver-v1` / `aifind-resolver-p1`。

证据：`resolver.test.ts`、`detector-jobs.test.ts`、`detector-recovery.test.ts`。包括 canonical、日文NFKC alias、vendor/host-only unresolved、重名Copilot、unknown/API混合身份、hint/body矛盾、model越界。实际 localhost fake model 的同一响应重跑只产生一次 provider transport；未使用真实模型校准。

## D. Detector

### Monitor、采集与变化识别

Monitor 记录已注册 URL、source kind、publisher、product/hints、频率和禁用状态。新增 Source Monitor 管理入口支持列表、创建、启用/停用、Run Now、状态和 Review 跳转；API还支持带 expectedRevision 的局部配置修改。局部 PATCH 不重置未传入的 product/hint/开关/频率字段。

`aifind.observe` 与 `aifind.detect` 为不同的模块队列，采用既有 recordRun / enqueue / audit。普通观察/检测只有 `COLLECT_ENABLED=true` **且** `AIFIND_DETECTOR_ENABLED=true` 才执行；两者默认 false。定时入口每15分钟检查到期 Monitor，复用现有 worker 的 Asia/Tokyo 调度。MODEL_CALLS_ENABLED 是独立安全阀。

免费路径复用 guardedFetch，限制协议、DNS/内网、响应大小和超时；检查 robots，拒绝绕过403、404、登录、paywall、CAPTCHA与重定向。robots不可访问的403/5xx保守拒绝，robots404按无robots处理。提取移除 script/style/nav/header/footer/form；免费响应上限1MiB、20s，正文保留最多12000字符。

contentHash 基于截断前的完整已提取文本；因此 excerpt 之外的变化也能检测。inputHash 同时区分 Monitor revision 等输入语义。相同文本的重复观察记录 unchanged，不创建 Candidate、不调用模型、不刷新事实确认时间。Monitor revision 变化可生成新 Observation，旧输入/历史保留。

### 提案与语义校验

Detector 输出只允许既有7类：market、language、platform、capability、plan、price、lifecycle。target key/ref 必须存在并属于对应 Product / Published version；禁止模型自行指定 EvidenceID、rowID、verifiedAt 或新增属性。整个输出 batch 先校验后写入，不部分接受包含无效提案的 batch。

每条提案要求原文连续引文和准确 locator。结构化引文须逐字段证明 proposedValue，价格还须证明 plan。普通非价格 prose 不能完整证明受控事实时，保留 unsupported 原因、state=no_changes、零Evidence/零Candidate；不猜测平台/市场/语言状态。

价格 prose 仅支持明确的 ISO currency + 完整金额 token、相符 plan/market/unit、月或年周期及 fixed/from 语义；通过现有 parseAmountMinor 转换整数 minor units。JPY12400 不会被误认作2400；from不能变fixed；qualified/negative/含不支持有效期等内容不自动解析。结构化路径区分 free/fixed/custom/unknown；缺失价格永远不推断free。US不变JP，rolling out不变available，证据没有说到的事实不补全。

通过校验后，在单事务中创建 Evidence → detected Candidate → detected audit → pending_review → pending audit，并保存处理结果和完成已接收 receipt。Snapshot 使用只读 Repeatable Read；写入使用 Read Committed，提交前复核 Published及Monitor revision。版本为 `aifind-detector-v1` / `aifind-detector-p1`。

### 恢复与来源能力范围

模型关闭、预算阻断、临时错误后的相同 input，可在之后的观察 job 中重新处理原 Observation，保持原逻辑 receipt。unknown paid outcome 必须等待现有 Recovery 明确 release，不能用新 Run Now 绕开。有效、无变化、无效或不支持结果均有处理记录。

本轮实现 registered URL 的 HTML/text 路径与受控可选 Jina fallback，没有自动接入全部 RSS/X/新闻来源、批量解析每类自然语言事实。这些边界见 O。

## E. Human Review Boundary

Detector executor 仅调用 Observation、Reader、Evidence、Candidate 和 audit 路径；不调用 Draft mutation、approve、Apply 或 Publish。真实执行后的 Candidate 为 pending_review，Draft不存在且Published逐值未变。该边界是应用调用/状态机和事务约束，没有额外声称建立了独立 worker DB role 权限。

人工 Review 页面复用 Phase2功能，增加 detector provenance、Current/Proposed、source quote、locator、hash、retrievedAt和receipt版本字段。Approve 必须是管理员/CSRF保护、带理由的操作；Apply是另一个操作，仅创建或修改Draft。发布仍在原Product Admin中另行确认。

最终 Chrome 主示例：Human Approve + Apply 后，Published V1=JPY2400，Draft V2=JPY2800，真实 Public Product仍显示JPY2400。Detector原proposal的verifiedAt保持null；Apply将人工reviewedAt赋给Draft事实。没有将retrievedAt当作人工确认。

## F. Idempotency

稳定 proposal key 包含Product、base version、源内容hash、版本和规范化语义，不含随机EvidenceID/取得时间；JSON属性顺序不改变key。数据库UNIQUE key与Product/Observation lock共同控制重复/并发。相同值相对于当前Published不产生无意义新提案。

`K07-K10 / X03 concurrent and ten repeated runs create one immutable Candidate and Evidence`：真实并发及10次重复通过，最终只有一个Candidate/Evidence。`K08 Evidence/Candidate/audit rollback is retry-safe after interruption`：中断回滚无部分事实、重试成功。

P05/C06浏览器实际操作了两个不同机制：先重复同一Source得到unchanged；再按“同じ Observation を再実行（P05）”将原Observation `8e184465-6019-4a9b-a6c9-6c7e379ac55d` 重新入detectQueue，job `c3dd02e8-eb17-479d-9ef6-82063168b86b`，Candidate总数不变。此按钮只接受已注册合成Preview的原完成输入，HTTP不能提交任意ObservationID。

真实localhost模型receipt在业务事务回滚后保留received response；重试复用它，没有第二次paid transport。新Monitor revision使用新input，历史保留；语义/base/hash相同仍由proposal key控制重复。

## G. Concurrency

提交前按固定顺序锁Product再锁Observation，并重新比较currentPublishedVersion与工作开始时base、Monitor revision。Published在检测期间变化则保存stale Observation、零Evidence/零Candidate，不提交旧base提案。

P06真实Preview按钮“検出を待機（P06）”只让synthetic adapter等待管理员在原Product Admin做Human Publish，最多90秒，不在Detector内写Draft/Publish。C12中人工Publish使旧V1→V2后，Observation `2e9d0bce-9a99-48e7-ada8-4fb7ca0b1b19` 为stale、Candidate 0，并在页面可见。等待超时保留error、无提案。

另一个已生成旧base Candidate `d97bb025-9349-4884-a41a-3f77afc3e3f9`，在Published变化后Approve/Apply测试得到Apply409，页面显示基准已变。主示例不受这个独立stale Product影响。

`X02 Draft conflict prevents Detector Apply from overwriting human work` 验证人工Draft字段变化导致冲突；并发Approve/重复Apply沿用现有状态机、事实和audit不重复。`detector.test.ts`、`detector-routes.test.ts`和Chrome C12覆盖这些路径。

## H. Evidence

追溯链：Candidate → Evidence → immutable Observation → Monitor。Review可读source kind、publisher、source URL、retrievedAt、content hash、连续quote/locator、base、Resolver/Detector/prompt版本及receipt IDs；合成Preview明确标识，没有假冒真实来源。

locator在输出阶段为JavaScript UTF-16位置；入库前转换为PostgreSQL substring使用的Unicode字符坐标。含日文及quote之前emoji的回归测试通过，DB trigger实际比对原文substring，不只检查非空。

自动取得时间不是人工verifiedAt。原Evidence与proposal保持不可变；Human Apply后的Draft fact verifiedAt取reviewedAt，Published lastVerifiedAt直到独立Publish前仍为V1的人工事实确认值。无变化hash、失败fetch、retrieval或Detector完成时间不提升Public freshness。

当前公开Product没有literal dateModified字段；本轮没有凭空新增它。既有Product sitemap lastmod取PublishedAt，Product lastVerifiedAt来自Reader的事实确认语义；这些公开文件保持原字节，未引入Observation时钟。Public DTO/HTML不泄漏Draft、Candidate、Observation、audit或receipt内部字段。

## I. Receipts / Budget

模型路径：`modules/aifind/detector/model.ts` → 既有 `chatJson` → receipts/budget；subject为Observation、prompt版本明确。页面/管理员API只入队，不直接付费。

Jina路径：空的JS-rendered免费来源 + Monitor.allowJina=true → 既有 `fetchReader` paid wrapper；拒绝被robots/登录/paywall/403/404等阻断的页面。现有wrapper新增可选logicalIdentity并保存redacted identity，其他既有Jina callers行为保留。

| 验证 | 本轮结果 |
|---|---|
| MODEL_CALLS_ENABLED=false实际adapter | 无provider transport、无新receipt；PASS。 |
| 实际localhost model越界响应/重复处理 | 响应拒绝但receipt保留；重复复用，只有一次provider请求；PASS。 |
| 零预算，model与Jina | provider调用前阻断，fake hits=0；PASS。 |
| 模型unknown paid outcome | Observation/receipt保留，重复不盲重发；PASS。 |
| Jina收到响应 | Observation持有receipt，业务事务成功后complete；PASS。 |
| Jina socket failure + 新Run Now | 两次不同enqueue仍只有一次provider transport；unknown阻断新logical key；PASS。 |
| 现有Recovery显式release后重试 | 复用同receipt且attempt2完成；不是新receipt绕过；PASS。 |
| receipt已received但Evidence/Candidate事务回滚 | savedresponse保留、复用、无第二次paid transport；PASS。 |
| source prompt injection | 输入仅作为数据，严格字段/受控URL/无Draft或Publish/无免费推断；PASS。 |

测试文件：`detector-jobs.test.ts`、`detector-paid.test.ts`、`detector-recovery.test.ts`。使用真实adapter+本地fake HTTP/故障transport/真实测试PostgreSQL，非仅stub掉receipt层。真实外部OpenAI/X/Jina/Feishu/IndexNow一律未调用，未改变生产安全阀。

## J. Preview

最终运行在独立local DB `aifind_phase4_acceptance_preview`，web3500、API3501；旧Phase1.1/2/3的3200/3300/3400环境保留。最终runtime：`D:\Projects\aihot\.data\aifind-detector-preview\runtime.json`，seedOnStartup=false、externalActions=false。运行保持供用户查看。

| 页面 | 实际URL |
|---|---|
| Preview Hub | http://localhost:3500/admin/aifind/preview |
| Phase4 Preview | http://localhost:3500/admin/aifind/preview/change-detector |
| Review Queue | http://localhost:3500/admin/aifind/review |
| 主Candidate | http://localhost:3500/admin/aifind/review/0943d307-cc92-4d77-ac15-39cfc59e9ab9 |
| 主Product Admin | http://localhost:3500/admin/aifind/products/048e7873-e519-4a73-ad19-785ca0ad7ae9 |
| 主Product public隔离证明 | http://localhost:3500/products/aifind-preview-detector-main |
| stale Product Admin | http://localhost:3500/admin/aifind/products/b786df73-b309-4552-a9e9-3b4816484b0f |
| 旧base Candidate | http://localhost:3500/admin/aifind/review/d97bb025-9349-4884-a41a-3f77afc3e3f9 |

本地管理员随机密码只保存在 `D:\Projects\aihot\.data\aifind-detector-preview\login.txt`，不在报告或日志输出明文，不修改.env。

### Seed及启动机制

显式CLI `node scripts/seed-aifind-detector-preview.ts` 调用真实Domain APIs初始化四个 `[PREVIEW]` synthetic产品、Published V1和四个禁用Monitor，另有两个共享Copilot alias；不预建检测Candidate。合成价格不是实际产品报价。只有主Product通过既有visibility API在专用local Preview DB中listed，用于Public Reader隔离验证。

写操作要求AIFIND_PREVIEW_ENABLED=true、非production、loopback PostgreSQL且DB名以_preview/_test/_ci结尾、连接URL不能含database override参数。Prod无论flag都不能seed/action；default flag无seed/action。已有完整seed返回原IDs；部分seed/slug冲突拒绝并要求另建专用DB，不覆盖旧产品。

启动仍是 `node scripts/serve-aifind-preview.ts`，需设置AIFIND_PREVIEW_RUNTIME=detector、WEB_PORT=3500、API_PORT=3501、AIFIND_PREVIEW_ENABLED=true和专用local_preview DATABASE_URL；读取已seed DB，不seed。spawn API/Web/合成worker，清除继承secrets、web环境不传DB/密码/密钥；所有外部安全阀保持false。合成worker只消费固定registered fixture，不运行真实external采集/paid模型/定时采集。

| Preview验收点 | 最终真实展示 |
|---|---|
| P01 | main唯一identity resolved，ProductID可查；重复Source后仍保留上次resolved结果。 |
| P02 | Copilot ambiguous，2个候选，零Candidate。 |
| P03 | Observation retrievedAt JST、hash、state、Candidate count；同Source显示unchanged。 |
| P04 | 实际worker创建价格Candidate，Current2400/Proposed2800。 |
| P05 | 原Observation实际重新入队，Candidate数量不增加。 |
| P06 | 检测提交前人工Publish后stale/0Candidate；旧Candidate Apply409另行可见。 |
| P07 | Existing Review Detail可读source=detector、base、版本、receipt和Evidence。 |
| P08 | 明确Human Approve/Apply，仅Draft改变。 |
| P09 | 同页PublishedV1/DraftV2分栏，PublicV1不变。 |

所有Preview HTML/loader/API均管理员保护、noindex/no-store；POST需要CSRF和理由；不进sitemap、公开导航、RSS/MCP/public API。前述主Product公共页面只是已明确listed的synthetic Published数据，整个SITE_PREVIEW本地站noindex，不公开任何Detector内部数据。

## K. Chrome

真实installed Chrome **154.0.8037.95**，headless=false，viewport1440×1000。使用已有Playwright驱动可见Chrome，未安装/下载浏览器。CUA bridge两次启动kernel退出，bridge自身未能完成；随后真实Chrome替代完成浏览器Gate，不能将bridge失败报成PASS。

最终执行2026-10-06 11:28:08–11:28:37 UTC；最终只读截图核对11:30:46–11:30:50 UTC。证据：`chrome-acceptance/chrome-smoke.json`、`acceptance-proof.json`和截图。service worker阻断、非loopback请求全部拒绝，实际blockedExternalRequests=[]、pageErrors=[]。

| Check | Result | 本轮实际证据 |
|---|---|---|
| C01 | PASS | Hub包含Phase4 Available入口。 |
| C02 | PASS | 真实API/Reader、synthetic PublishedV1、检测前无预建Candidate。 |
| C03 | PASS | main ProductID=048e7873-e519-4a73-ad19-785ca0ad7ae9，method=identity。 |
| C04 | PASS | Copilot既有两个alias命中ambiguous、零Candidate。 |
| C05 | PASS | JP/JPY2400→2800/月/user，真实quote，自动verifiedAt=null。 |
| C06 | PASS | 重复Source为unchanged；同原Observation重新入detectQueue，无新Candidate。 |
| C07 | PASS | Existing Review Detail显示detector、base、版本、receipt字段和quote。 |
| C08 | PASS | Chrome实际Approval modal提交明确人工理由。 |
| C09 | PASS | Chrome Apply仅创建DraftV2，PublishedV1未变。 |
| C10 | PASS | Apply后真实Public Product DOM仍JPY2400，无Draft2800。 |
| C11 | PASS | PublishedV1/2400与DraftV2/2800真实Reader分栏，JST人工确认时间可读。 |
| C12 | PASS | stale Product的独立Chrome Human Publish；旧Candidate Apply409；提交前等待Observation=stale、Candidate0。 |
| C13 | PASS | 新匿名Chrome context跳转login，独立admin API401，不能读Draft。 |
| C14 | PASS | HTML meta/header noindex、no-store，sitemap排除Preview。 |
| C15 | PASS | 真实公共HTML/DOM/HTTP DTO不含Detector/Review内部数据。 |

中间首次浏览器运行的C14遇到既有两枚robots meta，harness strict selector报错；改为检查所有robots meta均noindex，不改应用SEO断言。最终上述15项在新专用Preview DB完整重跑PASS，不借用首次或旧Phase截图。

## L. Screenshots

本轮最终截图绝对路径：

1. `D:\Projects\aihot\.data\phase4-20261006-9dbb2964\chrome-acceptance\change-detector-preview-desktop.png`
2. `D:\Projects\aihot\.data\phase4-20261006-9dbb2964\chrome-acceptance\review-detector-candidate-desktop.png`

两张均已实际读取像素核验：日文无明显乱码/替换字符，标题/字段/价格层次可辨，Current/Proposed与Published/Draft分栏清楚，Evidence链接/引用/取得与人工确认时间可读，stale Candidate0可见。1440px常规桌面宽度无横向溢出；收尾截图不依赖短暂toast。原后台中文sidebar/login文案保持原样，不扩大为后台语言重设计。

## M. Regression

### 最终冻结后的真实执行

环境：PowerShell7.6.5、Node24.14、本地PostgreSQL17.10；PATH复用已有PG17.11 client tools，没有安装系统软件。数据库安全后缀为 `_test`：`postgres://postgres@127.0.0.1:55432/aifind_phase4_closure_test`。最终Preview单独使用 `_preview` DB，未写生产DB。

父测试环境COLLECT_ENABLED、MODEL_CALLS_ENABLED、FEISHU_CONTENT_PUSH_ENABLED、FEISHU_INTERNAL_ENABLED、INDEXNOW_SUBMIT_ENABLED、AIFIND_DETECTOR_ENABLED全部false；测试setup遵守现有设计，仅对loopback fake service在测试内显式开model/collect，以MockAgent/network限制禁止真实外部请求。没有弱化生产阀。

| Command | 本轮UTC时间 | Result | Total | PASS | FAIL | CANCELLED | SKIPPED | Evidence |
|---|---|---|---:|---:|---:|---:|---:|---|
| `npm run typecheck` | 11:24:58–11:25:08 | PASS / exit0 | — | — | — | — | — | typecheck-acceptance.log/meta.json |
| `DATABASE_URL=...aifind_phase4_closure_test npm test` | 11:24:55–11:27:34 | PASS / exit0 | 870 | 862 | 0 | 0 | 8 | suite-acceptance.log/meta.json |
| `npm run build -w @aihot/web` | 11:26:52–11:26:56 | PASS / exit0 | — | — | — | — | — | web-build-acceptance.log/meta.json |
| `node --test apps/web/tests/*.test.ts` | 11:27:10–11:27:18 | PASS / exit0 | 57 | 57 | 0 | 0 | 0 | web-suite-acceptance.log/meta.json |
| `node scripts/smoke.ts --base http://localhost:3500` | 11:30:50–11:30:51 | PASS / exit0 | 30 | 30 | 0 | 0 | 0 | smoke-acceptance.log/meta.json；15 pages+14 HTTP/machine+MCP initialize |
| Real Chrome C01–C15 | 11:28:08–11:28:37 | PASS | 15 | 15 | 0 | 0 | 0 | chrome-acceptance/chrome-smoke.json |

smoke不是node:test runner，meta中的counts=null；30/30来自实际log的30个✓与all checks passed，不将其null当作零测试。所有时间为2026-10-06 UTC；网页时间用JST。

### Phase3基线对照

Phase3真实保存文件 `.data/phase3-20261006-d802943d/phase3-baseline.json` 与最终本轮逐测试名称、状态、reason做精确对照：DB原827全部保留，Web原55全部保留；新增43 DB /2 Web；missingOrChanged=[]，8个SKIP及reason完全相同。Tokyo、今日のAI、AIFIND Brand、原Product Domain/Admin/Public SEO测试继续PASS。

一个预期test名称由 `module installs without registering product routes or tasks` 改为 `module installs scoped public/admin routes and opt-in detector queues without new public abilities`：Phase4明确授权模块队列，原公开路由和数据断言保留，default关闭被测试。migration精确预期由13→14、表13→16；admin从0069后的migration数5→6。没有删除失败测试、放宽业务断言或增加skip。

中间suite-first为856 total /845 PASS /3 FAIL /8 SKIP，3项均为上述旧scope/count预期；已修正并在最终870套件重新PASS，未将它们作为已完成结果。最初receipt FK text/bigint类型错误仅修复尚未成功发布的0075；此前历史migration没有改写。

新baseline保存全部870/57个测试的name/status/reason、log SHA256和Phase3对照：`phase4-acceptance-baseline.json`。suite SHA256=`09c032c22df0789819b07d26072818cf13870b77335577de0944e4b9f0a2fe3b`，Web suite=`8cae7528609f0f628ae9082a796429ac96ad0c336953612d1acda29a3f8a12ea`。

### 8项原有Windows SKIP

| Test | File | 原有reason，本轮相同 |
|---|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | tests/analyze-shutdown.test.ts | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | tests/analyze-shutdown.test.ts | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | tests/analyze-shutdown.test.ts | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | tests/backup-files.test.ts | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | tests/backup-files.test.ts | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | tests/backup.test.ts | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | tests/translate-shutdown.test.ts | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | tests/translate-shutdown.test.ts | POSIX SIGTERM; covered by Linux CI |

上述reason中的Linux CI是既有测试说明，本轮Linux执行为UNRUN，不能声称本轮已在Linux通过。

### 规格覆盖 / TDD / review

| IDs | 测试文件（均modules/aifind/tests/，另注明Web） | 实际断言 |
|---|---|---|
| R01–R05 | resolver.test.ts | canonical、NFKC、vendor/host-only、Copilot重名、unknown及identity矛盾，不造Product。 |
| R06–R08 | detector-jobs.test.ts、detector-recovery.test.ts | 实际local model allowlist/关闭/硬冲突/越界response/同receipt复用。 |
| D01–D02、D12、J06 | detector-storage.test.ts、detector.test.ts | 相同hash不调用adapter、excerpt外变化仍影响hash、fetch错误不变negative facts。 |
| D03–D09 | resolver.test.ts、detector.test.ts | 缺失/伪造proof、quote、schema、ref ownership、currency/decimal/key、价格unknown/free及minor units。 |
| D10–D11 | resolver.test.ts | US/JP与rolling-out/available范围不可扩大。 |
| K01–K06 | detector.test.ts、detector-migrations.test.ts | Evidence-first、detected→pending、provenance immutable、严格schema、worker不写Domain；0074升级旧值保留。 |
| K07–K10、X03 | detector.test.ts、resolver.test.ts | key稳定、10次重复/并发、事务中断无部分写、一次事实/audit。 |
| X01–X02 | detector.test.ts、detector-routes.test.ts | Published提交前变化stale0、人工Draft冲突、Preview等待Human Publish。 |
| X04–X05、T01–T05 | detector.test.ts | Approval/Apply时间语义、幂等、Published/Public隔离、无Observation freshness；最终Human Publish为单独测试动作。 |
| B01–B06 | detector-jobs.test.ts、detector-paid.test.ts | receipts、zero budget、unknown、Jina限制、received/rollback/release恢复；真实localhost provider。 |
| J01–J05 | detector-jobs.test.ts、detector-routes.test.ts | 独立队列、default关闭、API只enqueue、Run记录、CSRF/管理员保护。 |
| P01–P09 | detector-routes.test.ts、apps/web/tests/aifind-detector.test.ts、Chrome | trueDB/API/queue、synthetic seed guard、同Observation重复、stale等待、Published/Draft、noindex/public隔离。 |
| C01–C15 | chrome-acceptance/chrome-smoke.json | 逐项见K，全部本轮真实Chrome PASS。 |

各主要实现先执行RED再GREEN；证据保留task1至task5、paid-hash-red、evidence-unicode-red等log。单次独立read-only最终review指出5个Important、0Critical：hint掩盖正文Product、金额substring/fixed-from、无结构化平台quote、同输入临时失败未恢复、Jina unknown可被新enqueue绕过。review-red-fresh实际29项20PASS/9FAIL锁定；完成最小修正后重跑并包含在最终全套。

额外Monitor partial-default bug先RED再修复，避免PATCH清空关系或重置开关。最后按规格核对P05/P06时，分别先复现Preview缺少原Observation重入队及提交前stale入口的失败，再补Preview-only路径，真实DB/Web/Chrome重新验收。没有进行第二次review或声称reviewer复审批准；最终结论基于修复测试、全套验证和浏览器证据。

## N. Git Safety

开始前branch=`codex/ai-signal-jp`，HEAD=`9848e936106db037d99a304887c36aad3fd0fad4`。dirty工作树不是干净Git HEAD；所有旧tracked/untracked先按实际文件保存before备份+SHA256，再按before对比Phase4-only变化。

| 项目 | Phase开始 | Phase结束 |
|---|---:|---:|
| `git status --short -z` tracked modified | 218 | 219 |
| 原tracked deletion | 3 | 3 |
| untracked entries（Git目录折叠口径） | 80 | 83 |
| status entries总数 | 301 | 305 |
| Git-known实际paths（含未跟踪文件展开） | 925 | 955 |
| 实际存在paths | 922 | 952 |

上述两种计数口径不可混用：新增module/docs文件大多位于早已untracked的目录中，所以status不会逐文件新增48项。Phase4相对于before **修改18个旧文件、新增30个文件，共48个**，lost=[]。904个其他旧存在文件字节相同；3个旧删除仍删除；全部71个旧migration hash相同；HEAD/branch/index/.env不变。最终机器证据=`git-safety.json`。

既有Japanese work没有用Git HEAD替换：AGENTS/README、site品牌/Logo、taxonomy/prompts/sources、Tokyo helpers/worker、公开API/SEO/nav、JP字体、旧Phase计划/报告及Phase1–3代码保持原before内容，只有下列明确18个文件按任务追加变更。已删除的SC字体及LICENSE没有恢复。旧model榜/Codex/主题代码数据未删。

没有reset、clean、checkout覆盖、restore整批覆盖、stage、commit、push或清理旧工作树。没有修改production aisignal_launch；测试仅*_test，Browser seed仅新local*_preview。旧3200/3300/3400及其DB/Preview目录未修改。本轮自己生成的两个中间Phase4 Preview DB保留，没有drop/reset；仅核实PID/端口/命令/DB归属后重启本轮Phase4 runtime。

### 修改的18个旧文件

| File | Why |
|---|---|
| .env.example | 明确AIFIND_DETECTOR_ENABLED=false opt-in阀。 |
| modules/aifind/admin/contracts.ts | 私有Review DTO追加detector provenance。 |
| modules/aifind/admin/routes.ts | 复用管理员/CSRF/noindex wrapper供Detector路由。 |
| modules/aifind/catalog/evidence.ts | 可选Observation quote/locator持久化，手工Evidence兼容。 |
| modules/aifind/changes/apply.ts | detector人工review时间进入Draft，保持手工路径与Publish隔离。 |
| modules/aifind/changes/candidates.ts | 私有Candidate读取/创建保留detector provenance。 |
| modules/aifind/module.ts | 注册模块独立队列及受阀控制的Tokyo schedule。 |
| modules/aifind/preview/routes.ts | 简单Hub追加Phase4 Available。 |
| modules/aifind/server.ts | 注册私有Monitor/Observation/Preview API。 |
| modules/aifind/tests/admin-migrations.test.ts | 更新新增0075精确数量预期，保留旧数据断言。 |
| modules/aifind/tests/migrations.test.ts | 精确迁移/表数量与新增schema约束。 |
| modules/aifind/tests/module.test.ts | 关闭默认阀的独立队列契约，不新增public能力。 |
| modules/aifind/tests/preview-web-fixture.ts | 真实SSR测试可消费合成worker队列。 |
| modules/aifind/web.tsx | 注册Admin Monitor/Preview路由与私有入口。 |
| modules/aifind/web/admin-common.tsx | 共用Admin Source Monitor跳转。 |
| modules/aifind/web/review-detail.tsx | 私有detector provenance/Evidence/时间字段。 |
| packages/backend/src/providers/jina.ts | 可选durable logicalIdentity，unknown Recovery不能被新enqueue绕过；保留旧caller。 |
| scripts/serve-aifind-preview.ts | 增加detector runtime分支、合成worker及独立本地输出目录；不startup seed。 |

### 新增的30个文件

| File | Why |
|---|---|
| modules/aifind/resolver/contracts.ts | Resolver result / version contract。 |
| modules/aifind/resolver/resolve.ts | 确定性identity及冲突判定。 |
| modules/aifind/detector/contracts.ts | Monitor/Observation/strict Detector schema及版本。 |
| modules/aifind/detector/monitors.ts | Monitor持久化、revision与audit。 |
| modules/aifind/detector/observations.ts | 输入hash、不可变Observation、状态/处理历史。 |
| modules/aifind/detector/fetch.ts | 免费安全采集/robots/有条件Jina。 |
| modules/aifind/detector/model.ts | 既有receipt/budget wrapper的可选模型路径。 |
| modules/aifind/detector/validate.ts | 受控事实/Evidence/价格语义、proposal key。 |
| modules/aifind/detector/detect.ts | Reader snapshot、校验、atomic Evidence/Candidate、stale/receipt恢复。 |
| modules/aifind/detector/jobs.ts | observe/detect独立队列、due schedule、queue-only action。 |
| modules/aifind/detector/routes.ts | 管理员Monitor/Observation/Preview APIs。 |
| modules/aifind/migrations/0075_aifind_observations.sql | append-only schema/constraints/triggers。 |
| modules/aifind/preview/detector-fixtures.ts | 固定合成source/adapter与有限Human Publish等待。 |
| modules/aifind/preview/detector-seed.ts | 显式local/test fixture，经真实Domain APIs初始化。 |
| modules/aifind/preview/detector-service.ts | 真实Reader/Review状态及P05安全重入队。 |
| modules/aifind/web/change-detector-preview.tsx | P01–P09可浏览Preview。 |
| modules/aifind/web/monitors.tsx | 最小Source Monitor管理页。 |
| scripts/seed-aifind-detector-preview.ts | 显式CLI seed，无生产自动调用。 |
| scripts/worker-aifind-detector-preview.ts | 专用合成-only worker。 |
| modules/aifind/tests/resolver.test.ts | Resolver及pure semantic validation回归。 |
| modules/aifind/tests/detector.test.ts | DB执行/审核/幂等/stale/时间/rollback。 |
| modules/aifind/tests/detector-storage.test.ts | Observation/Monitor/hash及partial edit。 |
| modules/aifind/tests/detector-jobs.test.ts | 队列/URL/robots/model adapter/allowlist。 |
| modules/aifind/tests/detector-paid.test.ts | budget/unknown/Jina/rollback/injection。 |
| modules/aifind/tests/detector-recovery.test.ts | 同输入恢复、Monitor revision、hard conflict。 |
| modules/aifind/tests/detector-routes.test.ts | auth/CSRF/seed guard/realqueue/Preview P05–P06。 |
| modules/aifind/tests/detector-migrations.test.ts | 0074升级旧事实逐值保留。 |
| apps/web/tests/aifind-detector.test.ts | 真实SSR/loader/noindex/public隔离。 |
| docs/superpowers/plans/2026-10-06-aifind-phase4-product-resolver-change-detector.md | 实施计划。 |
| docs/superpowers/plans/2026-10-06-aifind-phase4-product-resolver-change-detector-report.md | 本轮验收报告。 |

`.data/`中的local logs、backup、helper、runtime、随机credential、Chrome截图未提交。未修改记忆文件。

## O. Known Limitations

1. 没有自动RSS/X/新闻批量source connector、全站Monitor自动注册或Product自动创建。只有显式registered URL，目录匹配当前上限1000产品；免费source≤1MiB、保存excerpt≤12000字符。Jina仅允许registered rendered-empty来源。
2. 普通非价格prose不自动证明受控事实；可靠结构化literal quote可以表达现有7类，普通价格prose只支持明确ISO currency完整金额/月年/plan/market/unit及fixed/from。货币符号歧义、多费率、税区分、usage细则、有效期、API-model关系或新属性仍需人工modeling，不扩Product schema。
3. unknown不是free/unavailable；本轮没有宣称所有自然语言市场/语言/平台描述均已自动解析，也没有声称生产模型精度已校准。
4. 没有Production Seed或真实provider/外网来源采集。本轮Browser在MODEL_CALLS_ENABLED=false等阀关闭下验证synthetic path；paid/model/network adapter通过真实localhost fake与DB测试。真实OpenAI/X/Jina/Feishu/IndexNow为UNRUN。
5. 登录、paywall、CAPTCHA、robots拒绝、403/404及重定向不绕过；需要人工登记可访问的canonical URL。抓取失败保留失败，不能推断产品停用或日本不可用。
6. Preview seed部分完成/slug碰撞会拒绝覆盖，需要新专用localDB；P06合成等待上限90秒，超时不生成Candidate。这是测试场景，不是自动Publish机制。
7. Source Monitor UI仅最小list/create/toggle/run，更多hint/频率/关系修改由带revision的admin PATCH API支持；没有Dashboard美化或Sources CMS。
8. 原有8项Windows SKIP保留原原因；本轮Linux测试UNRUN。CUA bridge本机启动失败；真实可见Chrome已替代完成15项，不隐瞒工具故障。
9. 当前公开Product没有literal dateModified字段；没有新增它。继续用原PublishedAt sitemap与事实lastVerifiedAt，未使用Observation时间伪装新鲜度。
10. 未开始Phase5、Compare、Category/Best、How-to、Homepage redesign、Search、Affiliate、Newsletter或Retention工具。

**验收结论：本轮零FAIL、零CANCELLED、零新增SKIP；旧827/55测试基线完整保留，Chrome C01–C15全部PASS，Human Review/Published隔离和receipt/budget恢复均有真实本地证据。Phase 4 Gate = READY；Phase 5 Gate = READY；现在停止，等待下一条指令。**
