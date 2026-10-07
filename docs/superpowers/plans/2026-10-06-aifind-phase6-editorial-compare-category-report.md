# AIFIND Phase 6 — Editorial Core + Compare / Curated Category

Phase 6 Gate: **READY**。Phase 7 Gate: **READY（前置工程条件已满足，未开始，等待下一条授权）**。

本报告依据本轮实际仓库、隔离 PostgreSQL、最终构建及可见 Chrome 执行结果。最终证据前缀为 `final2` / `chrome-final2`；早期失败及审查前日志保留，不能替代最终结果。未开发 How-to、Guide CMS、Best、Affiliate、Sponsored、Newsletter 或 Production Catalog/Monitor。

证据目录：[Phase 6 evidence](D:/Projects/aihot/.data/phase6-20261006-281ca693)。完整用户规格已逐行读取并保存在 [user-spec.md](D:/Projects/aihot/.data/phase6-20261006-281ca693/user-spec.md)。执行计划：[implementation plan](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase6-editorial-compare-category.md)。

## A. Architecture

沿用 Node 24、Fastify、PostgreSQL 和 React Router SSR 的现有 module 体系，仅在 AIFIND module 内新增最小 Editorial Core。只有 `comparison` / `category` 两种类型。Web 只通过 HTTP 调用 Admin / Site API；数据库、Domain、Markdown 安全投影和 OG 渲染留在后端。

读取链路为 Editorial Published revision → 一次 Repeatable Read / read-only snapshot → 当前 Product Published 批量 Reader → 严格 public DTO → Site API → SSR。写入复用现有 Read Committed admin transaction、审计及管理员鉴权，不增加模型、采集或自动发布能力。

## B. Schema

只追加三份 module migration，未修改本阶段前的 73 份 migration，也未修改已应用的 0077/0078：

| Migration | 实际作用 |
|---|---|
| [0077](D:/Projects/aihot/modules/aifind/migrations/0077_aifind_editorial.sql) | 8 张 Editorial 表、typed relations、Test Records、所有权 FK、唯一位置/Product、发布验证、历史不可变与永久 slug claim |
| [0078](D:/Projects/aihot/modules/aifind/migrations/0078_aifind_editorial_integrity.sql) | 明确两条指针 FK 的 ON DELETE RESTRICT；Revision INSERT 必须从 Draft 开始 |
| [0079](D:/Projects/aihot/modules/aifind/migrations/0079_aifind_editorial_draft_identity.sql) | Document INSERT 必须从空 Draft identity 开始，堵住延迟 FK 可构成 Published→Draft 指针的发布绕过 |

新增表：`af_editorial_documents`、`af_editorial_revisions`、`af_editorial_slug_claims`、`af_comparisons`、`af_comparison_products`、`af_comparison_test_records`、`af_categories`、`af_category_products`。没有 Product schema 变更、万能内容 JSON 或复制价格/市场/语言/平台/能力事实的列。

## C. Editorial Core

公共部分仅管理 title、slug、excerpt、body Markdown、SEO title/description、revision、编辑者/操作理由及发布时点。专属字段分别进入 Comparison / Category Domain。历史 Published 内容和关系受数据库保护；所有公开 Reader 另外要求指针确实对应同一 Document 的 Published revision。

复用现有 Markdown parser/sanitizer，增加通用 `authoredMarkdownBody`，保留原调用行为。新增入口关闭作者 raw HTML / 图片媒体：脚本、iframe、事件属性、javascript/data 链接、MDX 执行均不可进入可执行页面。没有新依赖或完整 CMS。

## D. Revision / Publish / Restore

Create → Draft；Save 修改当前 Draft 并递增 document revision；Publish 只发布保存过的 Draft，必须显式人工确认和操作理由。旧 Published revision 不覆盖。Withdraw 关闭公开出口，保留历史。Restore 复制某个历史 Published 为新的 Draft revision，不直接恢复公开状态，也不改变旧 Published。

所有现有 identity 操作带 `expectedRevision`；文档行锁加 stale Conflict 防止两个编辑者互相覆盖。Publish 按稳定 ID 顺序锁定选定 Products。实际并发回归证明同一 revision 的两个 Save 只有一个提交，另一个冲突；HTTP 将冲突映射为 409。审计记录包含 actor、reason、操作、状态及 revision pointers，不进入公开 DTO。

## E. Comparison Domain

人工编辑 question、purpose、methodology、verdict、goodFor、notFor、incomparable conditions、limitations。Publish 要求 2–3 个不同的 Product，均为当前 listed / Published / public-ready。引用保存 Product ID、历史 Published version ID、展示位置，以及可选 tested Plan key / Price reference；数据库检查参照版、Plan、Price 的所属关系。

**Comparison 不复制 Product facts。** `official_sources` 明确显示“公式情報に基づく比較 · 実測していません”。`hands_on` 必须为每个 Product 填完整人工 Test Record。没有 winner、自动 score、排名或伪造推荐评级。

## F. Dynamic Facts

当前表展示 JP availability、Japanese input/output/UI、platforms、controlled capabilities、plans/native-currency prices、lifecycle、Current Published、语义正确的 Last Verified 和 Evidence 链接。unknown 与 unavailable 不同；free、fixed、custom、unknown 不混同，不做币种换算。

实际 Chrome 与 DB/SSR 测试：Mizu Image 的 Product Draft 把 JPY 2,000 改为 2,500，Compare 仍显示 2,000；人工 Product Publish V2 后，Compare 显示 2,500/current v2，历史 reference 仍为 v1。Candidate、Approved Apply-to-Draft 和普通 Draft 均不会提前改变公开表。

单篇 detail 的源代码查询结构：19 个批量 SELECT（slug 1、Editorial relation 6、Product gate 1、Product relation 10、reference 1），加 BEGIN/COMMIT。这是源码计数，不是 runtime query counter；不随 2/3/5 个 Products 增加逐 Product HTTP 或查询循环。目录/相关内容也按所选 IDs 批量读，未引入缓存系统。

最终测量在 36 个 synthetic Products /3 个 Editorial 的本机 Preview 上，每类 warm reader 20 次，包含 Markdown 投影：

| Reader | Products | p50 | p95 | EXPLAIN resolver execution | EXPLAIN current-fact gate execution |
|---|---:|---:|---:|---:|---:|
| Comparison | 3 | 5.39 ms | 8.09 ms | 0.025 ms | 0.699 ms |
| Category | 5 | 3.84 ms | 5.73 ms | 0.027 ms | 0.933 ms |

实际 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` 及全部样本：[query evidence](D:/Projects/aihot/.data/phase6-20261006-281ca693/editorial-query-final2-evidence.json)。EXPLAIN 覆盖两条 gate query，并非全部 19 条；上述数据不代表 production 或大规模性能。

## G. Test Records

每 Product 的记录包括 task、environment、procedure、result、limitations、testedAt（时区必填）、reviewer；repeatCount / errorCriteria 可选。其 Product、revision 归属及 Published 后不可变由 DB 约束。

审查发现并实际复现：旧编辑器更换 Product 或 reference version 会继续勾选并沿用原 Test Record。已增加 reference-change state transition：仅在对象/版本实际改变时，清空 Test Record、tested Plan/Price，并提示重新实测/填写；不变选择不会破坏已有记录。

真实可见 Chrome RED 两项失败 → GREEN 两项 PASS。GREEN 逐项验证表单勾选被取消、真实 PATCH payload 保存 null、hands-on Publish 返回 422、旧 Published 不变，最后 Restore 为新 Draft。[actual editor regression](D:/Projects/aihot/.data/phase6-20261006-281ca693/reference-browser-green.json)。这证明记录不会被表单自动搬移，不证明人工输入内容的真实性。

## H. needs_retest

Comparison 任一 current Published version ID 与保存的 reference ID 不同，即在读取时计算 `needs_retest=true`；不存入另一套事实、不自动改 verdict、不自动改 body，也不因正常 V2 更新而自动下架。页面明确区分 current facts 与参考版。

测试证明 Product V2 后 verdict 与 Editorial Published revision 保持不变，reference v1 仍显示，警示出现。更改 reference version 不能沿用旧实测记录来冒充重新测试。Category 仅显示中性“製品情報更新あり”，不假称实测结论已经更新。

## I. Category Domain

独立人工策划的用途/问题页：question、intro/body、selection criteria、limits；3–5 个选定 Products，各自 fit、not-for、selection note 与 reference version。事实仍实时来自 Product Domain。顺序仅供展示，页面明确“掲載順は順位ではありません”。不由 capability 自动生成，不是 Discovery filter 的别名，没有自动 Best/Ranking。

## J. Public Routes

| 页面/出口 | 实际行为 |
|---|---|
| `/compare` | 真正 eligible Published 比较目录、摘要/Product/mode/参考或测试日期/公开日期 |
| `/compare/:slug` | SSR current facts + 独立 reference/Test Records + 人工结论 |
| `/categories` | 自然“用途から探す”目录，便于进入已策划用途页，简单新增入口 |
| `/categories/:slug` | SSR curated criteria / fit / not-for / facts |
| `/api/site/aifind/compare[/:slug]`、`categories[/:slug]` | 供 Web 读取的 Published Site API，fresh/no-store |
| `/api/site/aifind/home` | 真 Product + eligible Comparison/Category 聚合，不生成内容 |
| Product detail related links | 同一 snapshot 内的 reciprocal links；空结果不添加无用旧 DTO 字段 |

导航增加“AIを比べる”“用途から探す”，保留 News/Discovery 与旧模块。首页只显示实际 eligible 内容；空集合隐藏区块。未新增 v1/RSS/MCP 的 Editorial 能力。

**整篇依赖失效：**任何必选 Product 变成 private/unlisted/not-ready，整个 Editorial detail、目录、首页、相关内容、旧 slug redirect、OG、sitemap 都立即不再公开。不会删掉部分列后继续泄露其结论。

## K. SEO / Sitemap / Slug History

canonical / og:url / OG image URL 由 SITE_URL 与当前 Published slug 构成，未硬编码 `aifind.jp`。公开 eligible 页面正常可索引；admin/Preview noindex、nofollow、no-store，不进入 sitemap。Structured Data 使用 WebPage，不伪造 Review / AggregateRating。

永久 `(doc_type,slug)` claim 禁止重用历史公开 slug；旧 slug 直接 301 到当前 Published slug，无链式跳转；Draft slug 404。撤回或依赖失效时，旧 slug 也 404。Restore 不释放 claim。

独立 fresh `/sitemap-aifind-editorial.xml` 注册到现有 sitemap index；只列当前 eligible URL，不纳入旧 slug、Draft、admin 或 Discovery 查询参数。公开日期与参照版公开日/实测日分开标示。

## L. Admin

真实 typed form 路由：`/admin/aifind/compare[/:id]`、`/admin/aifind/categories[/:id]`。沿用现有 admin layout、登录、CSRF、ReasonDialog、错误提示与 noindex/no-store。提供真实 Product / Published history selector、编辑/排序/Test Records、保存済み Preview、Published/Draft 独立区域、revision/slug 历史与人工 Publish/Withdraw/Restore。

Preview 明确只显示已保存输入，facts 来自当前 Published Products。没有匿名 Draft 端点、任意 JSON 编辑器或模型生成/自动 Publish 按钮。

## M. Preview

入口：[Phase 6 Preview](http://localhost:3700/admin/aifind/preview/compare-category)；[Preview Hub](http://localhost:3700/admin/aifind/preview)。可见安装版 Chrome 已打开到管理员 Preview。

直接公开示范：[Compare](http://localhost:3700/compare/aifind-preview-editorial-compare-current)、[Category](http://localhost:3700/categories/aifind-preview-editorial-category)。全部为明显标记 `[PREVIEW] [SYNTHETIC]` 的合成内容，不使用真实厂商加虚假价格伪装测评。

显式 seed：[seed script](D:/Projects/aihot/scripts/seed-aifind-editorial-preview.ts)。复用既有 Phase 5 36-Product synthetic pack，在**新的自有** `aifind_phase6_281ca693_accepted_preview` 上创建官方信息比较、hands-on 显示示例、curated category 共 3 个 Editorial Draft；不会 seed 后自动 Publish。Chrome 通过真实理由弹窗独立发布。追加 UI 回归后，hands-on 还保留一个 Restore 得到的新 Draft，旧公开内容不变。

seed 必须满足非 production、localhost、`*_test/_ci/_preview`、显式 `AIFIND_PREVIEW_ENABLED=true`；默认 false。启动/GET 不 seed，production import rejection 不变。只有 own3700/3701 的进程在验证 PID、parent 与绝对 command path 后重启；Phase1–5 的3200–3600、旧 DB 与数据未操作。诊断 marked/final Preview DB 也保留。

当前临时登录信息保存在本机 [login file](D:/Projects/aihot/.data/aifind-editorial-preview/login.txt)，未输出密码，未提交文件；重启会生成新的本机密码。无 worker，所有外部安全阀 false。读页面不会触发模型。

P01–P24 在真实 Preview 提供项目与 Domain/Admin/Public links，静态场景名称不伪装执行 PASS：

| Preview 场景 | 本轮实际执行证据 |
|---|---|
| P01–P04 Draft/Preview/Human Publish/Public Compare | Chrome C02–C07 + Domain/HTTP/SSR |
| P05–P10 current facts/reference/V2/table/verdict/retest | C08–C10 + publication/SSR V2 tests |
| P11–P12 official/hands-on/Test Records | C11–C12 + gates + reference-browser-green |
| P13–P16 Category Draft/count/Publish/page | C13–C15 + Category Domain |
| P17–P18 Draft isolation/Restore | C16 + Domain/SSR historical isolation |
| P19 slug history | C17 + repeated renames/domain claim conflicts |
| P20 private/unlisted | C18 + all public-exit isolation tests |
| P21–P22 Withdraw/sitemap removal | C19–C20 + Domain/Site/SSR |
| P23 Product related link | C21 |
| P24 mobile comparison | C23：真实键盘左右箭头 + scoped scroll + screenshot |

## N. Chrome C01–C25

最终在安装的 **Chrome 154.0.8037.95**、`headless=false`、独立项目临时 profile、1366×900 /390×844 执行。Browser route guard 阻止非 loopback 请求；最终无 pageErrors、无 external requests。CUA 初始化失败后复用现有 bundled Playwright；未安装浏览器/CLI，未改用户 Chrome profile。

完整：[chrome-final2-c01-c25.json](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-c01-c25.json)。

| Case | 验收 | Result |
|---|---|---|
| C01 | 实际登录、Hub/Phase6/noindex/真实 Domain | PASS |
| C02 | Compare Admin 列表和创建控件 | PASS |
| C03 | 保存真实 typed Draft/revision | PASS |
| C04 | 保存済み Preview/current facts；未 Publish 404 | PASS |
| C05 | ReasonDialog + CSRF 人工 Publish | PASS |
| C06 | 真实目录/自然导航/参考日期 | PASS |
| C07 | SSR/canonical/安全人写 Markdown | PASS |
| C08 | 3 Products/current/reference/unknown/原币价格 | PASS |
| C09 | Product Draft 不影响公开；Publish V2 动态更新 | PASS |
| C10 | verdict 与 Editorial revision 不随 V2 改变 | PASS |
| C11 | official_sources 明确非实测 | PASS |
| C12 | 人工 hands-on Publish/每 Product 合成 Test Record | PASS |
| C13 | Category Admin/5 Products/criteria/fit | PASS |
| C14 | Category 人工 Publish | PASS |
| C15 | Category 公共语义/free/fixed/custom/unknown | PASS |
| C16 | Editorial Draft/Restore 不改变 Published | PASS |
| C17 | Draft slug 404；发布 rename 后旧301/current canonical | PASS |
| C18 | private/unlisted 整篇失效，所有 discovery exits 去除 | PASS |
| C19 | Withdraw 去除所有出口；Restore 仍需 Publish | PASS |
| C20 | fresh current-only sitemap/index | PASS |
| C21 | Product ↔ Comparison/Category 真链接 | PASS |
| C22 | 桌面日语、Evidence、verdict，无页面溢出 | PASS |
| C23 | 手机表格内部滚动，实际 ArrowRight/ArrowLeft、焦点 | PASS |
| C24 | 手机 Category/fit/prices，无页面溢出 | PASS |
| C25 | 新匿名 Chrome context 无 Draft/Admin/Preview；管理员可访问 | PASS |

早期日志保留：首轮按钮名误用“ログイン”导致25项连锁失败；第二轮23PASS/2FAIL来自 sitemap XML声明 `?` 误断言和导航未等待 DOM。修正 harness 后一轮25PASS；审查修复完成后，再用全新自有 Preview DB 执行上述最终25PASS，包含真正键盘操作。额外 reference UI GREEN 为2/2；从未把早期失败日志称为最终通过。

## O. Screenshots

以下全部为最终构建的真实可见 Chrome 截图，文件已存在并逐张读取像素检查，不是生成的效果图：

| 内容 | Screenshot |
|---|---|
| Compare desktop | [compare-detail-desktop.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-detail-desktop.png) |
| Compare mobile/focusable table | [compare-detail-mobile.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-detail-mobile.png) |
| Category desktop | [category-detail-desktop.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/category-detail-desktop.png) |
| Category mobile | [category-detail-mobile.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/category-detail-mobile.png) |
| 保存済み Draft Admin Preview | [compare-admin-preview.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-admin-preview.png) |
| needs_retest/current-vs-reference | [compare-needs-retest.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-needs-retest.png) |
| 原币价格/Current Published/Last Verified | [compare-prices-desktop.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-prices-desktop.png) |
| Evidence URL/source kind | [compare-evidence-desktop.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/compare-evidence-desktop.png) |
| 手机 fit/not-for/selection note | [category-fit-mobile.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/category-fit-mobile.png) |
| 当前真实 Preview Hub | [preview-hub-desktop.png](D:/Projects/aihot/.data/phase6-20261006-281ca693/chrome-final2-screenshots/preview-hub-desktop.png) |

截图为聚焦 viewport；浏览器矩阵另检查 viewport 外的价格、结论、Evidence/版本字段。日语无明显乱码、unknown 与 unavailable 可区分、免费与未知/询价不混同；桌面表列清晰，手机内部横滚且键盘焦点可见，整页无横向溢出。没有增加未经实测的 sticky header。

## P. Regression

最终所有源码修复后实际执行，时间为 UTC：

| Command / check | 本轮最终结果 | 时间 / evidence |
|---|---|---|
| `npm run typecheck` | PASS | 15:21:12–15:21:18；final2-typecheck-meta.json |
| `DATABASE_URL=...aifind_phase6_281ca693_isolated_test npm test` | **956 total /948 PASS /0 FAIL /0 CANCELLED /8原有SKIP** | 15:23:05–15:25:34；final2-full-meta.json |
| `npm run build -w @aihot/web` | PASS | 15:21:18–15:21:20；final2-build-meta.json |
| `node --test apps/web/tests/*.test.ts` | **75/75 PASS /0 FAIL /0 SKIP** | 15:26:57–15:27:05；final2-web-meta.json |
| `node scripts/smoke.ts --base http://localhost:3700` | **30/30 PASS** | 15:27:05；final2-smoke-meta.json |
| Editorial live HTTP smoke | **12/12 PASS** | editorial-final2-smoke.json；读取前后 receipts=0 /attempts=0 /observations=0，products36/documents3不变 |
| Chrome C01–C25 | **25/25 PASS** | chrome-final2-c01-c25.json |
| 真实 Editor 记录绑定回归 | **2/2 PASS** | reference-browser-green.json |
| Linux CI /真实生产内容实测/生产部署 | **UNRUN** | 不以 Windows 原测试的“covered by Linux CI”标签冒充本轮 Linux 执行结果 |

新的可信基线：[phase6-final2-baseline.json](D:/Projects/aihot/.data/phase6-20261006-281ca693/phase6-final2-baseline.json)。包含所有 DB/Web name/status/reason、命令/时间、日志与截图 hash、Chrome cases；应以此而非审查前的951/73结果作为后续 regression baseline。

[逐项 baseline comparison](D:/Projects/aihot/.data/phase6-20261006-281ca693/final2-baseline-preservation.json)：Phase5 的 **901 DB /64 Web 全部保留**，名称、状态、reason 及 depth 相同；missing/changed=0。新增 **55 DB /11 Web 全部 PASS**，新增 unexplained SKIP=0。Tokyo/brand 和所有既有阶段回归包含在保留的完整套件中。

保留的8个 SKIP名称及**原样 reason**见上述 JSON：2个备份 packing POSIX shell fixture，1个 unreadable directory POSIX symlink-loop fixture，5个 POSIX SIGTERM；不是本轮新增，也没有 skip/删除/放宽断言掩盖失败。

TDD/失败收束证据：

- Domain25：先缺失实现的RED，再GREEN；publication11、Admin HTTP3、Markdown/publicHTTP6、Preview2、built SSR先RED再GREEN。
- 首轮full948中2FAIL：FK默认NO ACTION不符合既有RESTRICT测试、slug claimed_at未被读取；用0078及真实Admin历史显示修复，旧断言未放宽。
- 首轮Web73中8FAIL：三处旧fake API没有新的真实home聚合响应；仅补齐fixture，原测试名称/断言不变。
- final reviewer指出2Important；review-domain-red为8total/3PASS/5FAIL，其中raw INSERT实际成功构成缺陷，4项reference state缺少实现；review-domain-green含原migration/upgrade为17/17PASS。
- actual reference-browser-red2两种变更都错误保留Record → GREEN2/2；review-web-red日期/键盘2FAIL → 最终75/75。
- 一次Web RED启动被自动审批审查超时拒绝（无风险判断）；按许可重试一次后实际执行，无权限/安全设置变更。

## Q. Git Safety

执行前备份970个既有文件（Git路径973，包括3个原本缺失的SC字体文件），保存HEAD、branch、index、`.env`及73份migration hash。HEAD仍为 `9848e936106db037d99a304887c36aad3fd0fad4`，branch仍为 `codex/ai-signal-jp`。

953个既有文件字节未变；17个明确的整合/fixture文件仅作本阶段变更，完整 diff 对照执行前真实脏工作树，而非仅对照HEAD。现有 tracked/untracked 工作保留，未恢复SC字体、未删旧模块或数据、未 reset/clean/checkout/restore，未修改index/`.env`，未 stage/commit/push。仅增加本阶段文件及ignored证据。全部历史migration保持原hash；0077/78已执行后也没有重写，问题用0079前向修复。

最终安全凭据及完整文件/改动说明见本节后附表；原备份、审查前及最终diff均保留。Production DSN/数据库未连接、未写入；Production Product新增=0。以前Phase的Preview进程/数据库保留。


### 全部新增/修改文件

共17个既有文件修改、35个新增文件（含计划和本报告），合计52。`.data`备份/日志/工具/Chrome profile与截图为ignored证据，不在此源码清单中，也未提交。

| Change | File | Why |
|---|---|---|
| 修改 | [apps/web/tests/aifind-baseline-runtime.test.ts](D:/Projects/aihot/apps/web/tests/aifind-baseline-runtime.test.ts) | 旧 fake API补齐 empty home DTO，原断言/名称不变 |
| 修改 | [apps/web/tests/seo-runtime.test.ts](D:/Projects/aihot/apps/web/tests/seo-runtime.test.ts) | 旧 SEO fake API补齐 empty home DTO，原断言/名称不变 |
| 修改 | [modules/aifind/module.ts](D:/Projects/aihot/modules/aifind/module.ts) | 注册现有体系下的 Editorial/admin/Preview 页面与 API proxy 路径 |
| 修改 | [modules/aifind/preview/routes.ts](D:/Projects/aihot/modules/aifind/preview/routes.ts) | 注册 Phase6 Available 与 admin-only flag-guarded Preview GET |
| 修改 | [modules/aifind/public-contracts.ts](D:/Projects/aihot/modules/aifind/public-contracts.ts) | Product DTO 仅增加非空 related Editorial links |
| 修改 | [modules/aifind/publication/public-products.ts](D:/Projects/aihot/modules/aifind/publication/public-products.ts) | 复用事实投影，新增一批 current Products 及同 snapshot related links |
| 修改 | [modules/aifind/server.ts](D:/Projects/aihot/modules/aifind/server.ts) | 注册 Admin/Site/OG 路由及独立 sitemap 文件 |
| 修改 | [modules/aifind/tests/admin-migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/admin-migrations.test.ts) | 仅追加 forward migration 数量期望，保留原升级断言 |
| 修改 | [modules/aifind/tests/migrations.test.ts](D:/Projects/aihot/modules/aifind/tests/migrations.test.ts) | 仅追加 migration/table 数量期望，保留 FK/immutability/RC 原断言 |
| 修改 | [modules/aifind/tests/module.test.ts](D:/Projects/aihot/modules/aifind/tests/module.test.ts) | 精确新增 route 注册期望，保留旧 route/test 名称 |
| 修改 | [modules/aifind/web.tsx](D:/Projects/aihot/modules/aifind/web.tsx) | 自然公共导航与后台 Compare/Category 入口 |
| 修改 | [modules/aifind/web/admin-common.tsx](D:/Projects/aihot/modules/aifind/web/admin-common.tsx) | 复用 AdminNav 加入比较/用途管理链接 |
| 修改 | [modules/aifind/web/home-products.tsx](D:/Projects/aihot/modules/aifind/web/home-products.tsx) | 保留 Product 首页区域，增加真实 eligible Editorial links |
| 修改 | [modules/aifind/web/public-product.tsx](D:/Projects/aihot/modules/aifind/web/public-product.tsx) | 显示来自 Reader 的真实 related Comparison/Category |
| 修改 | [scripts/serve-aifind-preview.ts](D:/Projects/aihot/scripts/serve-aifind-preview.ts) | 新增 editorial runtime 分支；无 worker/seed-on-startup |
| 修改 | [apps/web/tests/cache.test.ts](D:/Projects/aihot/apps/web/tests/cache.test.ts) | 旧 cache fake API补齐 no-store home DTO，原断言/名称不变 |
| 修改 | [packages/backend/src/content/markdown.ts](D:/Projects/aihot/packages/backend/src/content/markdown.ts) | 通用 authored Markdown 入口，沿用 parser/sanitizer，原调用不变 |
| 新增 | [apps/web/tests/aifind-editorial.test.ts](D:/Projects/aihot/apps/web/tests/aifind-editorial.test.ts) | 真实built SSR全链路11项，包括安全/SEO/V2/恢复/日期/键盘结构 |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase6-editorial-compare-category.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase6-editorial-compare-category.md) | 用户完整授权范围与TDD实施计划 |
| 新增 | [modules/aifind/editorial/contracts.ts](D:/Projects/aihot/modules/aifind/editorial/contracts.ts) | strict typed Editorial/reference/TestRecord/action contracts |
| 新增 | [modules/aifind/editorial/documents.ts](D:/Projects/aihot/modules/aifind/editorial/documents.ts) | 人工 Draft/Save/Publish/Withdraw/Restore/concurrency/audit |
| 新增 | [modules/aifind/editorial/public-contracts.ts](D:/Projects/aihot/modules/aifind/editorial/public-contracts.ts) | 排除内部字段的 Public projection DTO |
| 新增 | [modules/aifind/editorial/read.ts](D:/Projects/aihot/modules/aifind/editorial/read.ts) | batched revision、Admin 历史与 Published Product choices |
| 新增 | [modules/aifind/editorial/routes.ts](D:/Projects/aihot/modules/aifind/editorial/routes.ts) | 复用 auth/CSRF 的真实 Admin CRUD/Preview/action HTTP |
| 新增 | [modules/aifind/editorial/validation.ts](D:/Projects/aihot/modules/aifind/editorial/validation.ts) | 数量、当前 Product readiness、完整文案/每 Product TestRecord gates |
| 新增 | [modules/aifind/migrations/0077_aifind_editorial.sql](D:/Projects/aihot/modules/aifind/migrations/0077_aifind_editorial.sql) | 8张 typed Editorial表、所有权及历史/发布约束 |
| 新增 | [modules/aifind/migrations/0078_aifind_editorial_integrity.sql](D:/Projects/aihot/modules/aifind/migrations/0078_aifind_editorial_integrity.sql) | 前向修复 FK RESTRICT 与 Revision INSERT gate |
| 新增 | [modules/aifind/migrations/0079_aifind_editorial_draft_identity.sql](D:/Projects/aihot/modules/aifind/migrations/0079_aifind_editorial_draft_identity.sql) | 前向修复 Document INSERT 延迟FK绕过 |
| 新增 | [modules/aifind/preview/editorial-seed.ts](D:/Projects/aihot/modules/aifind/preview/editorial-seed.ts) | 显式 local synthetic seed；Editorial仅Draft、不自动Publish |
| 新增 | [modules/aifind/preview/editorial-service.ts](D:/Projects/aihot/modules/aifind/preview/editorial-service.ts) | 读取真实Domain/Reader，提供P01–P24场景 |
| 新增 | [modules/aifind/public/editorial-routes.ts](D:/Projects/aihot/modules/aifind/public/editorial-routes.ts) | fresh Published Site API/home/sitemap/controlled OG |
| 新增 | [modules/aifind/publication/editorial.ts](D:/Projects/aihot/modules/aifind/publication/editorial.ts) | 同 snapshot 当前事实/历史参照/整篇 eligibility/retest/slug |
| 新增 | [modules/aifind/tests/editorial-fixtures.ts](D:/Projects/aihot/modules/aifind/tests/editorial-fixtures.ts) | 真实Product Domain fixture及合成人工文案/记录 |
| 新增 | [modules/aifind/tests/editorial-hardening.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-hardening.test.ts) | SQL INSERT bypass、slug日期、实际并发Save回归 |
| 新增 | [modules/aifind/tests/editorial-http.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-http.test.ts) | 真实Admin auth/CSRF/actions/422/409/Preview |
| 新增 | [modules/aifind/tests/editorial-markdown.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-markdown.test.ts) | 安全Markdown及实用语法回归 |
| 新增 | [modules/aifind/tests/editorial-preview.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-preview.test.ts) | default/production guards、GET/startup无seed、真实Draft fixture |
| 新增 | [modules/aifind/tests/editorial-public-http.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-public-http.test.ts) | Site/home/sitemap/OG/related及v1/RSS/MCP隔离 |
| 新增 | [modules/aifind/tests/editorial-publication.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-publication.test.ts) | 动态V2/retst/Candidate/Draft/整篇隔离/withdraw |
| 新增 | [modules/aifind/tests/editorial-selection.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial-selection.test.ts) | Product/version变化清除测试绑定与不变选择保留回归 |
| 新增 | [modules/aifind/tests/editorial-web-fixture.ts](D:/Projects/aihot/modules/aifind/tests/editorial-web-fixture.ts) | 专属临时*_test真实API/DB seed和清理fixture |
| 新增 | [modules/aifind/tests/editorial.test.ts](D:/Projects/aihot/modules/aifind/tests/editorial.test.ts) | Domain/revisions/publish/restore/reference/type/slug回归 |
| 新增 | [modules/aifind/web/editorial-detail.tsx](D:/Projects/aihot/modules/aifind/web/editorial-detail.tsx) | 独立Published/Draft/保存済みPreview/历史/理由弹窗 |
| 新增 | [modules/aifind/web/editorial-editor.tsx](D:/Projects/aihot/modules/aifind/web/editorial-editor.tsx) | typed Japanese editor、关系选择、TestRecord字段与清除提示 |
| 新增 | [modules/aifind/web/editorial-list.tsx](D:/Projects/aihot/modules/aifind/web/editorial-list.tsx) | 真实比较/用途Admin列表与Draft创建 |
| 新增 | [modules/aifind/web/editorial-preview.tsx](D:/Projects/aihot/modules/aifind/web/editorial-preview.tsx) | 受保护的真实Phase6 Preview |
| 新增 | [modules/aifind/web/editorial-selection.ts](D:/Projects/aihot/modules/aifind/web/editorial-selection.ts) | 实际更换Product/version时清除旧测试绑定；no-op保留 |
| 新增 | [modules/aifind/web/editorial-view.tsx](D:/Projects/aihot/modules/aifind/web/editorial-view.tsx) | dynamic事实表/Category/Records/日期/键盘region |
| 新增 | [modules/aifind/web/public-editorial-list.tsx](D:/Projects/aihot/modules/aifind/web/public-editorial-list.tsx) | 真实Published自然目录 |
| 新增 | [modules/aifind/web/public-editorial.tsx](D:/Projects/aihot/modules/aifind/web/public-editorial.tsx) | HTTP-only SSR详情、canonical/OG/WebPage/301/404 |
| 新增 | [scripts/seed-aifind-editorial-preview.ts](D:/Projects/aihot/scripts/seed-aifind-editorial-preview.ts) | 受环境/flag/DB后缀限制的显式 seed CLI |
| 新增 | [docs/superpowers/plans/2026-10-06-aifind-phase6-editorial-compare-category-report.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-06-aifind-phase6-editorial-compare-category-report.md) | 本轮A–R验收报告、最终基线与所有文件清单 |

安全凭据：[final-git.json](D:/Projects/aihot/.data/phase6-20261006-281ca693/final-git.json)、[final-only.diff](D:/Projects/aihot/.data/phase6-20261006-281ca693/final-only.diff)、[git-safety.json](D:/Projects/aihot/.data/phase6-20261006-281ca693/git-safety.json)。

## R. Carry-over / Known Limitations

1. **Compare/Category engine ready ≠ AIFIND already has real published comparison content.** 本轮全为synthetic/local；真实内容的事实核验、实测真实性、编辑审核、Product数量与Evidence需后续人工工作。forms只能验证完整性/所属关系，不能证明某人实际做过实验。
2. **Production external collection MUST NOT be enabled until retention/rights policy is explicitly decided.** Observation保留上限不是授权或retention政策；本轮未改保留策略、未开Production Monitor。
3. Phase4 semantic Candidate dedupe仍是已记录backlog；未改proposalKey、未合并/删除历史Observations/Candidates。Production Catalog import rejection不解除；真实Production Product新增仍0。
4. 已有日本化Gold人工100样本评分校准、日期精度等既有未授权事项不在本阶段解决，也未声称解决。评分权重/threshold、Sources/Prompt业务路线未改变。
5. 大规模目录/查询压力和Linux CI本轮UNRUN；当前Admin列表/Product choice及Public列表有既有/明确上限。这里只报告合成规模的测量，不引入缓存或新搜索服务。
6. CUA初始化环境故障没有被修复；真正安装版Chrome验收已由已有Playwright完成，不把CUA当作PASS或安装新系统工具。
7. 内容处于临时local Preview，仅127.0.0.1服务；关闭runtime后URL不可用。密码与临时DB不属于Production配置。

一次完整只读审查的2项Important已在一次最小修复 pass内处理。唯一Minor（目录参考日期）因用户规格§31明确要求而补齐；不存在留下未处理的可选Minor。审查的declined-to-judge逐项收束：未执行SQL由root RED/GREEN补证；未独立跑Browser/keyboard由实际最终Chrome/按键补证；真实性/production/大规模性能继续UNRUN；审查环境无法读用户目录skill不影响root已读的工作流规则。完整决定与成本见 [progress ledger](D:/Projects/aihot/.data/phase6-20261006-281ca693/progress.md)。未派第二次review或额外实现agent。

关键问题回答：facts不复制；V2更新当前表；verdict不变；needs_retest出现；Candidate/Draft不影响公开；private/unlisted不泄露整篇；Category不自动生成；无Best/Ranking；hands-on需要每Product人工Test Record；Draft Editorial不进公开出口；旧slug直接301 current（撤回/失效后404）。

**STOP：本阶段完成，不自动开始 Phase 7。**
