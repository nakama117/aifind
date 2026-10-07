# AIFIND Phase 5 — Product Discovery + Catalog Bootstrap Report

日期：2026-10-06。仓库：`D:/Projects/aihot`。**Phase 5 Gate = READY；Phase 6 Gate = READY。本阶段结束，未启动 Phase 6。**

结论仅针对工程验收：已建立真实 PostgreSQL / Domain / API / SSR Discovery，以及 Evidence-first、Draft-only 的 Catalog Pack 导入。没有录入真实运营产品、修改生产数据或执行外部采集。

执行前已读取项目规则、架构/定制文档、Master Spec、Phase 3/4 报告和涉及的真实模块；先保存 dirty baseline，再保存实施计划。实施计划见 [Phase 5 Plan](/D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase5-product-discovery-catalog-bootstrap.md)。

## A. Architecture

公开读取继续沿用现有目录和 modular monolith：

```text
Browser / URL query
→ React Router SSR loader
→ HTTP Site API /api/site/aifind/products
→ AIFIND Product Public Projection
→ PostgreSQL current Published + listed + public-ready snapshot
```

Web loader 不读数据库，不导入后端 Product Reader。Reader 在只读 Repeatable Read 事务中完成筛选、总数、排序、分页和公开投影。没有新增第二个 catalog、浏览器全量过滤、模型搜索或 Search Engine。

```text
Curated Catalog Pack (transport only)
→ strict Zod validator / conflict inspection
→ guarded local CLI or authenticated Preview action
→ Read Committed transaction + existing Product Domain APIs
→ private Product + Draft / Evidence / disabled Monitor
→ separate Human Review + Publish + visibility
```

Pack JSON 不成为运行时 Public Source of Truth；公开结果始终来自数据库。

## B. Query Contract

| Parameter | 层与限制 | 语义 |
|---|---|---|
| `q` | Web / API，默认空；规范化后最多 200 个 JS 字符，拒绝 NUL | trim → NFKC → lower；字面子串搜索 |
| `capability` | 现有受控 capability enum | 仅 `supportLevel=full` |
| `platform` | 现有受控 platform enum | 仅 `status=available` |
| `japan` | 仅 `available` | JP 市场明确 available |
| `japanese` | 仅 `usable` | ja input=full AND output=full；UI 单独展示 |
| `free` | 仅字符串 `true` | active plan + 当前有效 free price |
| `sort` | `recently_verified` / `recently_published` / `name` | 默认 recently_verified |
| `page` | Web，整数 1–10000 | 每页 24，筛选后分页；改变条件从第一页提交 |
| `limit` | API，整数 1–100；默认 20 | Web loader 固定为 24；首页固定为 6 |
| `offset` | API，整数 0–1000000；默认 0 | Web 根据 page 计算 |

多个条件使用 AND。API strict contract 拒绝未知键/非法枚举；Web 拒绝重复参数、非法 page，并去除 GET 表单中的空选项。排序来自 allowlist，不把用户字符串插入 ORDER BY。结果返回 filtered `total`、`hasMore` 和规范化 query。

回归已锁定：`ﬃ` / `㍿` 的 NFKC 扩展不能使第一次校验通过、下游再解析失败；NUL 不能进入 PostgreSQL 查询。真实 Site API 与 SSR 对非法输入返回 400；合法规范化结果可重复解析。

## C. Search

PostgreSQL `position` 字面匹配四类字段：Product canonical name、**当前 Published** display name、Vendor name、已注册的 normalized aliases。不是 fuzzy / AI / embedding 搜索，也不搜索 Draft summary/name。

SQL 在 `listed + current Published + af_public_version_ready` 范围内检索。Alias 属于现有 Product Identity；没有把 Draft 字段、private/unlisted、Candidate、Observation 或 Monitor 加入公开 DTO。Vendor 搜索返回对应产品，不新增 Vendor directory。

已实际测量查询计划，见 [final-query-plans.json](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/final-query-plans.json)：当时的独立合成数据库为 37 个 Product、34 个 listed。base COUNT / 分页执行约 1.312 / 2.220ms；完整组合条件约 1.943 / 2.853ms，组合 Reader 约 25.15ms。这里只证明当前小样本足够，没有宣称规模化性能。没有增加搜索索引；0076 仅建立导入元数据的必要主键/唯一约束。

## D. Filters

| Filter | 匹配 | 排除 / 未推断 |
|---|---|---|
| capability | full | partial / none / unknown |
| platform | available | unavailable / unknown |
| Japan | JP available | restricted / waitlist / unavailable / unknown |
| Japanese usable | ja input full 且 output full | 任一 partial / none / unknown；不要求 Japanese UI full |
| free | active plan，priceType=free，Tokyo 业务日期落在有效日期区间 | inactive、过期、未来、custom、unknown；不从金额 0 推断免费 |

每个条件先进入 SQL predicate，再 COUNT / LIMIT / OFFSET。即使 offset 超过结果尾部，total 仍是筛选总数。卡片保留日本利用状态、独立日语 input/output/UI、确认过的免费计划和事实 `lastVerifiedAt`，补充 full capability 标签。unknown 保持未确认，没有包装成免费或可用。

## E. Sorting / URL State

- 默认 recently_verified：只取 Published 的 definite facts、有效 Evidence 关联的 verifiedAt；NULL 最后。
- verified 排序后以 Published 时间 DESC NULLS LAST、slug、id 稳定打破相同值。
- recently_published：Published 时间、slug、id；name：规范化 Published display name、slug、id。
- 首页同样用明确的 recently_verified 规则，不使用 slug LIMIT 6 当推荐。

查询状态来自 URL 和 SSR loader。刷新、分享、条件清除和保留参数的分页已实测。Chrome 曾复现原生 GET 表单的 history 恢复问题：URL/结果回退，但编辑过的控件值留下。已最小替换为项目现有 React Router `Form method=get`，仍用规范化 query 作为 key；最终 C07/C08 通过。

## F. SEO

| URL | Robots | Canonical |
|---|---|---|
| `/products` | indexable | `/products` |
| bare `/products?page=2` | 沿用可索引目录分页 | 自身 page=2 |
| 搜索 / filter / 显式 sort 组合 | noindex,follow（HTML 与 header） | `/products` |
| Product detail | Phase 3 规则保持 | 原 detail canonical |
| unlisted detail | Phase 3 noindex 保持 | 原 detail canonical |
| admin Preview | admin-only、no-store、noindex,nofollow | 不作为公开 SEO 入口 |

sitemap 不加入查询组合或 admin URL，private/unlisted 和未 Publish 的 bootstrap 不进入 Product sitemap。没有新增 Category SEO 页。Production URL 继续来自 SITE_URL，没有写入固定生产域名。为实测 base index，**本机 Phase 5 discovery runtime** 设置 SITE_PREVIEW=false；admin Preview 自身仍 noindex，其他旧 Preview runtime 分支未改此行为。

## G. Homepage

保留原 News 主体，在原 Product 区块增加真实搜索入口、6 个 capability shortcuts（text/coding/image_generation/research/audio/agent）、`AIを探す` CTA，以及最多 6 个最近确认的 Published listed 产品。区块名为 `最近確認されたAI`，不声称流行度、排名或 No.1。没有修改首页既有 News 导航/筛选的评分机制。

## H. Catalog Bootstrap

`schemaVersion=1`；受控 packId/revision/dataKind，Vendor slug、Product slug、Evidence key、planKey、price key、Monitor key。包含 aliases、Draft metadata、market/language/platform/capability facts、plan/prices 和可选 disabled Monitors。未知字段、非法 enum、重复 key、alias 碰撞、非整数 minor amount、无效 URL、重复 basePriceId 均被拒绝。

每个 definite fact 必须引用有效 Evidence key 并给 verifiedAt；Evidence 包含 URL、source kind、publisher、retrievedAt 等，而不是拿 Pack 文件本身充当来源。unknown 可以保留，绝不从缺证据推断免费。传输格式不接收已有数据库 Evidence ID，写入时通过 Domain Evidence identity 映射。

新增迁移 [0076_aifind_catalog_imports.sql](/D:/Projects/aihot/modules/aifind/migrations/0076_aifind_catalog_imports.sql)：

- `af_catalog_imports`：pack/revision + normalized payload hash + Product/Draft receipt。
- `af_catalog_evidence`：稳定 Evidence material identity hash → Domain Evidence ID。

相同 Pack 的正常 retry 复用；相同 key/revision 的不同 payload、人工修改的 Draft、未给 Published base/revision、Identity/Vendor 变更、历史 slug 占用等报告 conflict，不覆盖。已有 Product 的新 alias 被拒绝，以防 Identity alias 直接影响 Published search；已注册相同 alias 可以引用。已有 Published 的价格更新必须正确指定 basePriceId，使用克隆后的价格 lineage，不追加同一组件的重复价格。

导入重新在事务内检查，锁住 Product 父记录，序列化跨 Pack 的共享身份导入。Vendor/Evidence 可以复用；只创建 private Product/Draft、Domain facts 和 **disabled** Monitor。整个 Pack 原子提交；最终 receipt 失败的数据库故障注入证明所有写入回滚，随后 retry 成功。并发相同 Pack 测试通过。

CLI：[import-aifind-product-pack.ts](/D:/Projects/aihot/scripts/import-aifind-product-pack.ts)。示例（pwsh 7，显式 local DSN，CLI 不自动加载 `.env`）：

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aifind_phase5_f735ab81_marked_preview'
$env:NODE_ENV = 'development'
$env:AIHOT_ENVIRONMENT = 'preview'
node scripts/import-aifind-product-pack.ts --file .data/phase5-20261006-f735ab81/marked-cli-dry-run-pack.json --dry-run
```

真实 CLI 验收：dry-run PASS，生产环境拒绝 PASS，前后 Product37/Version38/Vendor3/Evidence36/receipt2/Monitor2 完全相同，zero writes PASS。见 [marked-cli-acceptance.json](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/marked-cli-acceptance.json)。默认仅允许非 production、loopback、无 DSN query override 的 `_test/_ci/_preview`；本阶段没有生产 import 开关或生产执行。

## I. Human Publish Boundary

Importer 不调用 Publish / visibility API，不产生 Published，也不将新产品设置为 listed。Bootstrap Preview 的 P17 使用真正 importer：新 Product 的 Published=null、Draft=draft、visibility=private。P18 再执行得到 same。C19 打开真实 Product Admin；C20 公开搜索 0、detail404、Site API total0。

已有 Published 的 import 单独克隆 Draft，保留原 Published 和公开结果；手编辑 Draft 不覆盖。通过 Domain/Admin 的后续人工 Publish 和 visibility 才可能进入公开目录。

**Synthetic seed 与 importer 区分**：显式 seed 为浏览器验收，在 importer 返回后另外模拟人手 Publish 和 visibility。这是 local/test fixture 初始化，不是 importer 的业务能力。没有自动 seed/自动 Publish 的生产或启动路径。

## J. Phase 4 Carry-over / Review

详见 [Carry-over ADR](/D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase5-detector-carryovers.md)。

**Observation retention**：真实路径仍保留最多 12,000 JS 字符的 immutable source_text。测试证明完整输入 hash 与保留 excerpt hash 各自可追溯，Evidence quote / code-point locator 对应保留文本，历史 UPDATE/DELETE 不可用。12k 是采集输入上限，不是 TTL；存储上限和不可变性不构成版权许可。未来 hash + 长期 Evidence quote/locator + 有期限 excerpt 可降低原文保留量，但 hash 不能还原审计文本，必须设计前向迁移和可长期验证的 quote，而非随意删除。当前未改变 retention，生产采集前需要 Owner 决定权利与期限。

**Semantic Candidate dedupe**：真实 characterization 证明无关 footer 改变导致 contentHash 改变，会产生两个 active pending Candidates，目标/语义值相同、各自 Evidence/proposalKey 不同。按用户允许，交付 ADR/backlog，未贸然改 Phase 4 proposalKey。后续应基于相同 Product、当前 Published base、target 和 proposed semantic value 抑制第二个 Human Review item，同时保留新的 Observation/Evidence；不能跨 base 去重或修改不可变旧提案。

仅进行一次新的全范围只读审查（实际 dirty-before snapshot → pre-review-only.diff）。Assessment：With fixes；无 Critical。三个意见已修复：query Unicode/NUL、iOS/Android 正向 fixture、seed 中断误报完成。回归先红后绿；最后 Chrome 额外发现的 history Form 问题也已修复并验证。

审查者 declined-to-judge 的每项处理：

| 项目 | 处理 |
|---|---|
| 实现 semantic Candidate dedupe | 用户允许 ADR / characterization，明确延期；没有宣称已去重 |
| 删除 Observation excerpt | 等待 Owner retention/rights/audit 决定；未删除历史数据 |
| Production import/publication、ranking、Category SEO、Compare、Phase 6 | 超出本阶段授权，未执行 |

执行记录在 [progress.md](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/progress.md)。

## K. Preview

- [Phase 5 admin Preview](http://localhost:3600/admin/aifind/preview/product-discovery)
- [Preview Hub](http://localhost:3600/admin/aifind/preview)
- [Public Discovery](http://localhost:3600/products)
- [Homepage](http://localhost:3600/)

Hub 注册 Phase 5 Available；复用现有管理员认证、CSRF、no-store、noindex 和 route conventions。匿名 HTML 重定向 login、API401、无 CSRF 写操作403、关闭 Preview flag 后 admin API404。admin Preview 未进入公开导航/sitemap；不会绕过 Published Reader。

当前只用本轮新建的 `aifind_phase5_f735ab81_marked_preview`。明确 seed 命令 [seed-aifind-discovery-preview.ts](/D:/Projects/aihot/scripts/seed-aifind-discovery-preview.ts)，须 local disposable DSN、非生产与 `AIFIND_PREVIEW_ENABLED=true`。普通启动和页面读取不 seed。重复 seed 不覆盖人工工作；不完整 Publish/visibility/Draft setup 明确报错，要求新 disposable database。

36 个 `[PREVIEW] [SYNTHETIC]` 产品：34 listed、1 private、1 unlisted；3 Vendor、aliases、不同 verified 日期、JP/Japanese/price 各状态、web/iOS/Android/Windows、coding/research/image/video/text/agent/API。包含 available / unavailable / unknown mobile platform、过期 free、inactive free 和 unknown/custom/fixed 示例。初始 Published36，Secret Sakura Draft 与 Published 分离。Chrome 的独立 bootstrap import 增加第37个 private Draft-only Product，不自动发布。

P01–P15 为真实 Discovery 链接，P16–P23 为 guarded importer/admin/public 检查。所有卡片通过真实 Reader → API → SSR 输出。数据不代表真实产品；没有真实产品 onboarding，也没有生产数据变动。

本机临时登录信息位于 [login.txt](/D:/Projects/aihot/.data/aifind-discovery-preview/login.txt)，未打印密码或写入 Git；重启生成新临时密码。runtime 仅 loopback 3600/3601，没有 worker，seedOnStartup=false，externalActions=false。

## L. Chrome C01–C20

**真实 installed Chrome 154.0.8037.95，headless=false；桌面1366×900、移动视口390×844。** 复用已安装 Playwright / Chrome，没有下载浏览器或系统软件。CUA bridge 初始化失败后使用可见 Chrome 的本地工程验收脚本；不把 bridge 失败宣称为通过。

最终实际执行：2026-10-06 13:15:46–13:16:11 UTC，见 [chrome-marked-c01-c20.json](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-c01-c20.json)。

| Case | Result | 实际观察 |
|---|---|---|
| C01 Hub | PASS | 匿名 login → 本机登录 → Hub Phase5 → admin Preview |
| C02 desktop directory | PASS | 34 total、首屏24、label、无横向溢出 |
| C03 name search | PASS | Sakura Writer 单一结果 |
| C04 alias search | PASS | さくらライター → Sakura Published，无 Secret Draft |
| C05 capability | PASS | coding25，首24 |
| C06 combined | PASS | coding + web + JP + Japanese usable + current free =24 |
| C07 refresh | PASS | URL/勾选/select/结果一致 |
| C08 Back/Forward | PASS | 返回25条件、前进24条件，控件同步恢复 |
| C09 clear | PASS | 回 base、34 total、条件清空 |
| C10 zero results | PASS | 0 与日语说明 |
| C11 sort | PASS | name 稳定；verified 首项 Sample34 |
| C12 pagination | PASS | coding24+1，无重复，参数保持 |
| C13 homepage | PASS | 6 cards / 6 shortcuts，真实搜索与 research 链接 |
| C14 mobile | PASS | 390×844、日文正常、无横向溢出 |
| C15 mobile filters | PASS | iOS → Kumo；Android → Yoru；键盘焦点、按钮可用 |
| C16 isolation | PASS | Draft/private/unlisted 搜索0；private detail404、unlisted detail noindex |
| C17 filtered SEO | PASS | header/meta noindex,follow；canonical base；sitemap无查询/admin |
| C18 base SEO | PASS | base无noindex；bare page2 self-canonical |
| C19 bootstrap | PASS | 真实 dry-run new → import Draft → repeat same → Product Admin |
| C20 before Publish | PASS | Publishedなし / draft / private；search0、detail404、Site API0 |

页面 JS errors=0，受 route guard 阻止的外部请求=0。Japanese UI 无替换字符/明显乱码；控件和结果层次清楚，移动布局与按钮检查通过；Public UI 不把未确认展示成免费。移动验收是桌面 Chrome 视口模拟，不声称真机测试。

## M. Screenshots

以下为最后一轮实际 Chrome 截图，均已打开做视觉检查（1366×900 / 390×844）：

| Screenshot | 绝对路径 |
|---|---|
| Product desktop | [product-discovery-desktop.png](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-screenshots/product-discovery-desktop.png) |
| Product mobile | [product-discovery-mobile.png](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-screenshots/product-discovery-mobile.png) |
| Home desktop | [homepage-discovery-desktop.png](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-screenshots/homepage-discovery-desktop.png) |
| Home mobile | [homepage-discovery-mobile.png](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-screenshots/homepage-discovery-mobile.png) |
| Bootstrap Admin | [catalog-bootstrap-admin.png](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/chrome-marked-screenshots/catalog-bootstrap-admin.png) |

## N. Regression

仅以下 **最后一次源码修改之后的新执行** 用于 Gate，不用旧 Phase 4 日志代替：

| Check | Status | Result / UTC completion | Evidence |
|---|---|---|---|
| npm run typecheck | PASS | 13:13:53 | final3-typecheck.log / meta |
| npm test | PASS | 901 total、893 PASS、0 FAIL、0 CANCELLED、8 SKIPPED；13:16:29 | final3-full.log / meta |
| npm run build -w @aihot/web | PASS | 13:14:54 | final3-build.log / meta |
| node --test apps/web/tests/*.test.ts | PASS | 64/64、0 FAIL/CANCELLED/SKIPPED；13:18:08 | final3-web.log / meta |
| node scripts/smoke.ts --base http://localhost:3600 | PASS | 30/30；13:17:56 | final3-smoke.log / meta |
| Chrome C01–C20 | PASS | 20/20，13:16:11 | chrome-marked-c01-c20.json |
| real CLI dry-run / production rejection | PASS | zero writes，13:17:56 | marked-cli-acceptance.json |
| Linux CI / POSIX-only checks | UNRUN locally | 原有8项在Windows SKIPPED | 下表，不宣称本轮Linux执行 |

测试 DSN：`postgres://postgres@127.0.0.1:55432/aifind_phase5_f735ab81_closure_test`，沿用 `tests/databases.ts` 每文件独立复制数据库；没有改生产或清空旧数据。复用现有 `.data/pg17-client/pgsql/bin` tools，没有安装。父进程和 Preview 的 COLLECT/MODEL/FEISHU/INDEXNOW/DETECTOR 开关关闭；已有 test setup 只为本地 fake model 打开进程内许可，并用 MockAgent 禁止外部连接、清除真实 key；生产安全阀未降低。

新基线：[phase5-final-baseline.json](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/phase5-final-baseline.json)，包含全部901/64名称、状态、skip理由、命令、时间和日志/截图 SHA256。**Phase 4 数据库870/870、Web57/57 的名称/状态/理由完整保留，没有改名、删除或新增 skip；新增数据库31、Web7。** Tokyo/Brand 和 Phase 0–4 用例仍在其中通过。

| 原有 SKIPPED Test | 原因（与 Phase 4 相同） |
|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows 不投递 POSIX SIGTERM |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM |

覆盖映射：S01–S10 / F01–F12 在 discovery.test.ts；I01–I15 加 atomic rollback/concurrency/lineage/历史slug 在 catalog-pack.test.ts；P01–P23、flag/auth/seed恢复在 discovery-preview.test.ts；两个 carry-over characterization 在 detector-retention.test.ts；SEO01–SEO08/SSR/home/实际数据库/API隔离在7个新增 Web tests。Chrome C08 回归脚本保存在本轮 evidence 目录并实际先失败后通过。

诊断过程中的失败日志保留：早期完整套件3个失败是新增迁移/模块入口后的精确期望值未更新，已修正数量和列表，未删除/放宽断言；测试和浏览器脚本的初始化、表名、定位、渲染等待问题见执行 ledger。最终结果均为 fresh successful runs；没有以 skip 掩盖失败。

## O. Git Safety / Files

工作树起点已有大量历史工作：305 个 porcelain entries（219 tracked modified、3 deleted、83 untracked entries），HEAD `9848e936106db037d99a304887c36aad3fd0fad4`，branch `codex/ai-signal-jp`。首次备份952个实际文件/955路径/72个旧 migrations，写入 [git-before.json](/D:/Projects/aihot/.data/phase5-20261006-f735ab81/git-before.json) 和 `before/`。

以下是**相对于该 dirty-before snapshot**的 Phase 5 文件清单，不是相对于 HEAD；原 untracked 模块文件也被备份保护。

| File | Change | Why |
|---|---|---|
| [detector/monitors.ts](/D:/Projects/aihot/modules/aifind/detector/monitors.ts) | existing | 让 disabled Monitor creation 加入 Pack 原子事务 |
| [module.ts](/D:/Projects/aihot/modules/aifind/module.ts) | existing | Phase5 admin Preview route |
| [preview/routes.ts](/D:/Projects/aihot/modules/aifind/preview/routes.ts) | existing | guarded read/actions + Hub entry |
| [public-contracts.ts](/D:/Projects/aihot/modules/aifind/public-contracts.ts) | existing | filtered total/query contract |
| [public/routes.ts](/D:/Projects/aihot/modules/aifind/public/routes.ts) | existing | strict API query validation |
| [publication/public-products.ts](/D:/Projects/aihot/modules/aifind/publication/public-products.ts) | existing | SQL discovery/filter/count/sort |
| [tests/admin-migrations.test.ts](/D:/Projects/aihot/modules/aifind/tests/admin-migrations.test.ts) | existing | 精确验证0076升级后数量、数据保留 |
| [tests/migrations.test.ts](/D:/Projects/aihot/modules/aifind/tests/migrations.test.ts) | existing | 精确新增metadata表/迁移断言 |
| [tests/module.test.ts](/D:/Projects/aihot/modules/aifind/tests/module.test.ts) | existing | 新Preview入口，旧任务断言保留 |
| [tests/public-web-fixture.ts](/D:/Projects/aihot/modules/aifind/tests/public-web-fixture.ts) | existing | 隔离真实 discovery SSR fixture |
| [web/home-products.tsx](/D:/Projects/aihot/modules/aifind/web/home-products.tsx) | existing | 首页搜索/shortcuts/verified cards |
| [web/public-products.tsx](/D:/Projects/aihot/modules/aifind/web/public-products.tsx) | existing | GET Form / URL controls / pagination / SEO |
| [web/public-view.tsx](/D:/Projects/aihot/modules/aifind/web/public-view.tsx) | existing | capability与日语input/output卡片 |
| [serve-aifind-preview.ts](/D:/Projects/aihot/scripts/serve-aifind-preview.ts) | existing | 独立 discovery runtime、local index验收 |
| [aifind-discovery.test.ts](/D:/Projects/aihot/apps/web/tests/aifind-discovery.test.ts) | new | 7项真实Web/API/DB/SEO测试 |
| [Phase5 Plan](/D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase5-product-discovery-catalog-bootstrap.md) | new | 实施前计划 |
| [Carry-over ADR](/D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase5-detector-carryovers.md) | new | retention / semantic dedupe结论 |
| [本报告](/D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase5-product-discovery-catalog-bootstrap-report.md) | new | A–P交付及验收 |
| [catalog-pack/contracts.ts](/D:/Projects/aihot/modules/aifind/catalog-pack/contracts.ts) | new | 严格传输schema / Evidence / money |
| [catalog-pack/import.ts](/D:/Projects/aihot/modules/aifind/catalog-pack/import.ts) | new | 原子Draft-only/import inspection |
| [discovery/contracts.ts](/D:/Projects/aihot/modules/aifind/discovery/contracts.ts) | new | Query/controlled labels |
| [0076_aifind_catalog_imports.sql](/D:/Projects/aihot/modules/aifind/migrations/0076_aifind_catalog_imports.sql) | new | 追加import receipt/Evidence metadata |
| [preview/discovery-pack.ts](/D:/Projects/aihot/modules/aifind/preview/discovery-pack.ts) | new | 明确marked synthetic transport fixtures |
| [preview/discovery-seed.ts](/D:/Projects/aihot/modules/aifind/preview/discovery-seed.ts) | new | 显式local seed / completion guard |
| [preview/discovery-service.ts](/D:/Projects/aihot/modules/aifind/preview/discovery-service.ts) | new | 真实Reader/Admin/Pack inspection |
| [tests/catalog-pack.test.ts](/D:/Projects/aihot/modules/aifind/tests/catalog-pack.test.ts) | new | 11项import业务边界测试 |
| [tests/detector-retention.test.ts](/D:/Projects/aihot/modules/aifind/tests/detector-retention.test.ts) | new | 两项Phase4 characterization |
| [tests/discovery-preview.test.ts](/D:/Projects/aihot/modules/aifind/tests/discovery-preview.test.ts) | new | 7项Preview/API/auth/seed测试 |
| [tests/discovery.test.ts](/D:/Projects/aihot/modules/aifind/tests/discovery.test.ts) | new | 11项SQL/Unicode/语义测试 |
| [web/discovery-preview.tsx](/D:/Projects/aihot/modules/aifind/web/discovery-preview.tsx) | new | P01–P23实际管理Preview |
| [import-aifind-product-pack.ts](/D:/Projects/aihot/scripts/import-aifind-product-pack.ts) | new | guarded CLI |
| [seed-aifind-discovery-preview.ts](/D:/Projects/aihot/scripts/seed-aifind-discovery-preview.ts) | new | explicit fixture CLI |

共修改14个原文件、新增18个文件（含本报告），其余938个原有实际文件 SHA256 一致。HEAD、branch、index、`.env` 均保持；72个旧 migrations 全部字节相同，0062–0075 未重写。三个原删除的 SC字体/license仍保持不存在。没有新增缺失/恢复历史文件，没有 reset/clean/checkout/restore、stage/commit/push、安装或生产 DB 操作。

封存检查：`D:/Projects/aihot/.data/phase5-20261006-f735ab81/final-git.json`、`final-only.diff`，对应执行前备份；`.data` 含临时密码、日志、截图和测试 Pack，保持 ignored，不进入提交。

## P. Known Limitations / Gate

1. **真实 Catalog 尚未建立**：36+1都是合成样本；真实品牌/产品清单、事实和 Evidence 必须由 Owner 审核。Production 产品新增数=0。本阶段只交付工程管道，未做真实市场事实背书。
2. **Production import 暂不开放**：CLI明确拒绝 production/nonlocal/非disposableDSN。日后如需要生产导入，另行设计明确人工开启与发布流程；本轮没有执行。
3. **Observation retention / rights 政策未决**：保留现有immutable12k excerpt；需要 Owner 决定合法来源、保留期限与长期 quote 审计方案。
4. **Semantic Candidate dedupe 尚未实现**：已有证据复现并登记ADR，不改旧proposalKey；这是用户明确允许的carry-over延期。
5. **性能证据仅当前小样本**：literal SQL search 足够目前测试catalog；不声称千级/万级上线性能或 popularity 方法论。
6. **Windows POSIX tests仍8 SKIPPED**，原因与基线一致；本轮未执行Linux CI。移动端为Chrome视口验证，未做真实设备验收。
7. **Preview seed恢复采用fail-closed**：异常中断或后来手工改变预期状态时，不自动修补/覆盖，而要求新disposableDB。这避免损失人工工作。

Gate 所需 Discovery、语义/隔离、SEO、Draft-only Bootstrap、真实 Preview、Chrome20/20、完整fresh回归和历史baseline保留全部通过。**Phase 5 Gate=READY；Phase 6 Gate=READY。已停止，等待用户下一条指令。Compare、Category/Best、How-to、Editorial CMS、Affiliate 等未开始。**
