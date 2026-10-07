# AIFIND Phase 8.5 — Release Candidate Report

验收日期：2026-10-07（Asia/Tokyo）。本轮实际执行；旧 Phase 8 日志只用于基线对照，不代替本轮结果。

收尾状态：**COMPLETE**。独立复核的一项 Important 已修复；修复后完整验证和 Git 安全审计通过。以下结果来自本轮实际执行。

## A. Launch Gates

| Gate | 当前实际结果 | 依据 |
|---|---|---|
| Engineering | READY | 本轮 typecheck、完整 DB suite、Web build/tests、标准 smoke；原1113 DB/94 Web 名称、状态、深度、SKIP原因全部保留 |
| Content | READY | 12真实 Product、2 Compare、2 Category、2 official_sources Guide；source-backed issues0、synthetic/private/Draft公开泄漏0 |
| Release Candidate | READY | 新空库、正常 runtime、Preview=false、公开政策与真实联系表单、canonical/sitemap/mobile、Chrome、有效冻结包、本机配对恢复 |
| Operations | PARTIAL | 本机真实备份及配对恢复 PASS；远端对象存储上传与远端恢复未执行 |
| Production Deploy | NOT EXECUTED | 未连接、修改、导入或部署生产；未切 DNS；Phase 9 未开始 |

旧字段 `phase9=NOT READY` 继续存在于 readiness，代表远端运营前提尚未完成，并不冒充 Phase 9 已授权。

## B. 可直接查看的正常站点

- [首页](http://localhost:4000/)；[Product Catalog](http://localhost:4000/products)；[原有新闻](http://localhost:4000/all)。
- [Compare](http://localhost:4000/compare)；[Category](http://localhost:4000/categories)；[Guide](http://localhost:4000/howto)。
- [正常后台](http://localhost:4000/admin/aifind)；[正常 Launch Readiness](http://localhost:4000/admin/aifind/launch-readiness)。管理员需正常登录，没有 DEV_AUTH_ROLE 绕过。
- [About](http://localhost:4000/about)、[Editorial Policy](http://localhost:4000/editorial-policy)、[Privacy](http://localhost:4000/privacy)、[Terms](http://localhost:4000/terms)、[Contact](http://localhost:4000/contact)。Contact 使用真实 `/feedback` 表单。

本阶段按用户 Phase 8.5 指令，以正常公开路由作为浏览器交付，不新增 Preview Phase。历史 Preview 代码保留；正常候选不 seed、不依赖 Preview API。

候选 DB：`aifind_phase85_28f87d2e_launch_candidate_test`，loopback55432。恢复 DB：`aifind_phase85_28f87d2e_recovery_test`。独立完整测试集群：loopback55433，`aifind_phase85_28f87d2e_regression_test`。均不属于生产。

启动方式：本轮显式建库→81 migrations→导入 Draft→检查→单独审计发布→启动正常4000/4001 API/web/worker。启动和 GET 不 import/seed/publish。`candidate-fresh-database.json` 证明导入前 Product=0。原3900/3901及其他旧阶段进程未重启；仅按 receipt/PID核验重启过本轮候选自身进程。

| Runtime 状态 | 值 |
|---|---|
| publicationPolicy | source_backed |
| launchCollectionMode | off |
| AIFIND_PREVIEW_ENABLED / SITE_PREVIEW | false / false |
| COLLECT_ENABLED / MODEL_CALLS_ENABLED | false / false |
| AIFIND_DETECTOR_ENABLED | false |
| FEISHU_CONTENT_PUSH_ENABLED / FEISHU_INTERNAL_ENABLED | false / false |
| INDEXNOW_SUBMIT_ENABLED | false |
| Product Monitors | 12停用；policy均unreviewed；fetch/Jina permission均false |
| Owner逐Product approvals | 0；没有伪造批准 |
| 真实付费回执 | 0 |

仅显式 OFF 且所有相关阀/Monitor停用时，Source permission 为 DEFERRED。任意一个意外开启仍 BLOCK。生产采集的现有 permission/budget/receipt 安全边界保留。

## C. Real Content

| 内容 | 已发布数量 | 正常 detail 路由 |
|---|---:|---|
| Products | 12 | `/products/:slug` |
| Compare | 2 | `/compare/chatgpt-vs-claude-writing`、`/compare/cursor-vs-github-copilot` |
| Category | 2 | `/categories/research-tools`、`/categories/creative-ai-tools` |
| Guide | 2 | `/howto/gemini-notebook-source-check`、`/howto/cursor-review-first-change` |
| 原有官方来源 Japanese News | 8 | `/all`、`/items/:id`；保留原日期和链接 |
| 已审核真实 Asset | 1 | Domain上传、图像处理、rights/privacy review、公开 Reader读取 |
| synthetic public / private泄漏 / Draft泄漏 | 0 / 0 / 0 | Publication Reader +18实际公开 detail响应 |
| broken asset / fake test records | 0 / 0 | 真实文件读取、SHA及数据库检查 |

12个产品：ChatGPT、Claude、Gemini、Gemini Notebook、Perplexity、Cursor、GitHub Copilot、Adobe Firefly、Runway、ElevenLabs、Notion AI、Dify。没有扩充 Catalog。

产品身份、Vendor、官方URL、summaryJa、lifecycle、JP、Japanese input/output/UI、platforms、capabilities、plans、price states、Evidence、lastVerifiedAt 均通过真实 Domain/Reader。未知继续显示未確認；不会成为免费、不可用或日本语质量保证。当前 Free filter 命中7个有来源证明免费计划存在的产品，不承诺不限量、全部能力免费或商用权免费。所有无精确价格证据的 unknown金额保持null。

本轮只读核对官方产品/pricing/docs/help；具体URL和窄事实记录在 [source-fact-review.md](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/source-fact-review.md)。Google现行官方帮助页面使用 Gemini Notebook，历史 NotebookLM help URL跳转到现行页面；保留 NotebookLM former_name Alias和搜索命中。[Google官方帮助](https://support.google.com/gemininotebook/answer/16164461?hl=en)

Tier A只接受产品对应、可访问官方Evidence及无未解决矛盾的确定事实。22个已审核来源包含59条reviewedFacts，明确绑定字段、值与支持来源；同一产品的国家列表不能证明免费价格，或证明与已审核事实相反的可用性。Corpus和真实Published aggregate共用稳定投影，价格按planKey及完整价格上下文校验，不依赖数据库UUID。Tier B只整理这些事实；unknown组件不新增断言。转录前后Product pack与Editorial JSON hash不变，没有新增事实或Owner批准。

价格、地域、UI或质量不能证明时为unknown。没有新增排名、赢家、rating、用户量或“AIFIND実測”。两个Guide均为official_sources；已审查图片是编辑说明图，不当作产品画面或实测结果。

Owner显示统一 `AIFIND編集部`，作为编辑项目显示名称；未编造法人、地址、代表人或邮箱。Terms/Privacy发效日和说明使用现有CopyPage格式，真实浏览器可见；没有新CMS或框架渲染重构。

## D. Browser Acceptance

使用本机已有可见 Chrome154.0.8037.95（headless=false），1366×900桌面、390×844手机。独立profile；浏览器请求只允许localhost，没有下载/安装浏览器。CUA bridge返回helper_unknown_error，记为UNRUN；真实Chrome实际运行独立PASS。

| Case | 正常公开检查 | 结果 |
|---|---|---|
| LC01 | 首页真实DB模块、Product/Compare/Category/Guide和原有News | PASS |
| LC02 | `/all`及真实新闻detail、原日期、Japanese摘要 | PASS |
| LC03 | Catalog12产品 | PASS |
| LC04 | Product detail、Evidence、Japanese分项、free/unknown区别 | PASS |
| LC05 | NotebookLM alias搜索命中Gemini Notebook | PASS |
| LC06 | JP筛选2、Free筛选7，字段语义无猜测 | PASS |
| LC07–08 | Compare目录及detail | PASS / PASS |
| LC09–10 | Category目录及detail | PASS / PASS |
| LC11–12 | Guide目录及detail、真实媒体 | PASS / PASS |
| LC13–16 | About、Editorial Policy、Privacy、Terms | PASS ×4 |
| LC17 | Contact→feedback，真实201回执 | PASS |
| LC18 | sitemap：12 Product detail、6 Editorial detail+3目录；无admin/Preview/Draft | PASS |
| LC19 | robots公开index边界 | PASS |
| LC20 | canonical/OG使用本轮SITE_URL正常路由 | PASS |
| LC21–25 | 手机home/Product/Compare/Category/Guide，无水平溢出 | PASS ×5 |

修复后再次公开验收 **25/25 PASS**；page errors0、console errors0、外部请求0。日志：[reviewfix-public-lc01-lc25.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-public-lc01-lc25.json)。此前25/25结果也独立保留。

修复及新冻结包后的正常后台 **AM01–AM10 10/10 PASS**：匿名401/登录跳转、真实密码登录、12Published/draft0、Product aggregate、空Review Queue、Compare/Category Admin、Guide Admin、noindex/no-store正常readiness、有效新bundle/restore、来源绑定issues0、停用Monitor和本机联系回执、桌面手机截图、真实News时间语义。page/console errors0。日志：[reviewfix-admin-am01-am10.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-admin-am01-am10.json)。

News：历史pool/timeline保留8条；2026-10-07东京自然日todayCount=0，正式 `/api/v1/items?window=24h` 为0。正常 `/all`仍显示8条历史新闻，不重写成今天。旧日报08:00编辑周期、今日计数Tokyo边界和新闻采集设计未更改。

截图已人工查看：日语无明显乱码，产品层次清晰，未確認价格/支持状态没有冒充免费或不可用；桌面及手机宽度正常。此前Chrome检查已查看Product detail、Guide手机页面。

- [launch-home-desktop.png](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-admin-screenshots/launch-home-desktop.png)
- [launch-home-mobile.png](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-admin-screenshots/launch-home-mobile.png)
- [正常Readiness截图](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-admin-screenshots/candidate-launch-readiness.png)
- 其他Product/Compare/Category/Guide/policy/contact桌面手机截图：[本轮目录](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-public-screenshots)。

首次公开Chrome20/25：四项是脚本caption/feedback201/sitemap数量/default index预期错误；一项是真实policy发效日和intro渲染问题。后者RC30 RED→GREEN后修复既有CopyPage文档格式。首轮Admin9/10是脚本将不支持window参数的历史pool误当24h接口；改用正式v1并明确8历史/0今日语义。失败日志均保留，没有放宽内容、认证或安全断言。

## E. Tests & Baseline

| 本轮执行 | 结果 | 实际证据 |
|---|---|---|
| `npm run typecheck` | PASS | reviewfix-typecheck.log/meta，03:06:10–03:06:16 UTC |
| 完整 `npm test`，专属*_test库 | **1149 total /1141 PASS /0 FAIL /0 CANCELLED /8 SKIPPED /0 TODO** | reviewfix-full.log/meta，03:08:06–03:13:19 UTC |
| `npm run build -w @aihot/web` | PASS | reviewfix-build.log/meta，03:08:09–03:08:13 UTC |
| `node --test apps/web/tests/*.test.ts` | **98/98 PASS，FAIL/CANCELLED/SKIP=0** | reviewfix-web.log/meta，03:08:31–03:09:09 UTC |
| 标准 `node scripts/smoke.ts --base http://localhost:4000` | PASS，含原News/RSS/API/MCP初始化 | reviewfix-site-smoke.log/meta |
| Candidate content smoke | **9/9 PASS** | reviewfix-content-smoke.json |
| Chrome Public / normal Admin | **25/25 /10/10 PASS** | 上述真实Chrome日志 |
| 配对backup/restore | **12/12 PASS** | candidate-backup-restore.json |
| DB-only媒体缺失负例 | PASS：含媒体Guide不可读取 | 同上；可读Guide2→1，不当作配对成功 |
| 修复后已恢复数据只读复核 | PASS；12Published来源绑定issues0，配对/DB-only边界不变 | reviewfix-restored-content.json；未声称再次执行restore |
| 独立复核修复的受影响测试 | **53/53 PASS** | reviewfix-green3.log/meta；RC31–33含3个真实Published子用例 |
| CUA bridge | UNRUN | browser-bridge-unrun.json；已有真实Chrome替代验收 |
| remote backup/restore / Production deploy | UNRUN / NOT EXECUTED | 未配置远端，不编造成功 |

原Phase8 **1113 DB/94 Web**逐项多重集对照：名称、PASS/SKIP状态、嵌套深度和每条SKIP reason完全一致。新增36 DB、4 Web均PASS，没有删除或跳过原测试。授权语义变化只更新旧精确admin路由数组、Organization精确名称和LP10假Admin/OFF fixture；原名称与有意义的安全/只读断言保留。

最终新基线：[reviewfix-accepted-baseline.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-accepted-baseline.json)，SHA256：`c91f70dcd68a6f57e70df97ae03f441287c0fba05e7c40c3595114e6c48c0ab1`。包含全部测试名/状态/reason、原基线对照和修复后日志hash。复核前final-accepted-baseline.json及原Phase8 baseline文件均保留，不覆盖。

八项原有Windows SKIP（原因原文保留，不将“covered by Linux CI”解读为本轮已跑Linux）：

| Test | 原有 reason |
|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |

### 本轮非绿执行与最小修正

- 修改前baseline-full：1113/1104PASS/0FAIL/1CANCEL/8SKIP；取消原迁移测试120000ms。两次隔离8/8PASS，证明单独运行可通过，但不凭此放行完整套件。
- final-full和final-web：旧精确路由数组/Organization预期不含本轮授权正常入口和AIFIND編集部；最小更新精确断言后保留原名，不扩大通配或降低认证边界。
- full2/4/6/7均同一个迁移cleanup取消。full6实际子进程81迁移和再次up-to-date均成功；`finally DROP DATABASE`等待CheckpointStart/Done、ProcSignalBarrier超过120秒。独立新集群full7仍复现，否证“只因为旧共享集群”的初始猜测。
- 两次直接隔离迁移运行遗漏per-file preload，把16fixture Product写进第一测试模板，导致full3的13失败。这是本轮执行脚本错误；保留该库和日志/只读证据 `full3-template-pollution.json`，换新的空regression模板，未清空/重置旧库。之后始终用标准global setup+preload。
- full5因Windows ESM drive URI诊断脚本错误，套件未执行，UNRUN；pathToFileURL修正后full6才实际执行。初始client-bin initdb缺share资源，没有安装软件；复用已有完整embedded17.10，在owned目录/55433新集群验证fsync/full_page_writes/synchronous_commit均on，共享55432不动。
- DC01–03先RED0/3，DROP-only affected GREEN但full8仍CANCEL，未当完成。DC04创建同锁先RED，统一测试fixture CREATE/DROP后affected27/25PASS/2原SKIP；最终原命令full9 **0FAIL/0CANCEL**，原迁移测试23795ms通过。只串行化fixture数据库生命周期DDL；六文件并发、120000ms超时、迁移/发布/恢复所有业务断言保留。
- 使用新鲜完整suite作为基线，不靠反复随机重跑取一次旧日志。等待观测仅覆盖full9前240秒，不能声称监测覆盖最后teardown；suite结束计数来自真正runner。未来Windows17.10环境风险仍披露。
- 一次独立最终复核发现同产品字段/值错配缺口。RC31–33实际RED6项/1PASS/5FAIL；最小来源绑定修复后受影响53/53及完整reviewfix-full **1149/1141PASS/0FAIL/0CANCEL/8原SKIP**。首次元数据脚本前缀匹配Gemini/Notebook错误在写入前拒绝；过早启动的reviewfix-green50/41PASS/9FAIL保留，未当验收。reviewfix-green2的价格反例缺少原schema要求billingPeriod导致52/53；补足合法month上下文，保持严格来源断言，没有放宽断言。

官方17.11 release notes包含ProcSignalBarrier竞态修复；本机17.10日志记录等待checkpointer接受barrier，症状相符，但本轮未证明到同一内部race/未升级服务器。仅采用已经实跑通过的fixture DDL协调；不是生产数据库修复。现有17.11目录只有bin，不混装share/lib、不下载或安装软件。[PostgreSQL17.11官方修复说明](https://www.postgresql.org/docs/17/release-17-11.html)、[官方wait event语义](https://www.postgresql.org/docs/17/monitoring-stats.html)

## F. Frozen Bundle

目录：[runtime/launch-bundle](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/runtime/launch-bundle)。

Release Bundle manifest SHA256：

`38c706553aff0677bd6523ec8a4dafc3d2ad695eeea36f3ee7c545a32f36f55f`

10 payload + manifest：product-pack、editorial-manifest、含59个审核事实绑定的content-review-manifest、asset-manifest及真实WebP、81 migrations完整hash、source-policy-manifest、preflight、修复后test-baseline-hashes、新typed launch-metadata。12/2/2/2、asset1、source_backed/OFF、Preview=false、operator/contact、Production NOT EXECUTED已冻结。

同一input在全新repeat目录第二次构建，所有文件含manifest字节一致；reader.valid=true。无环境文件、密码、API key、管理员session、原Observation正文、private Draft或伪造Owner approval。Builder已存在目录拒绝覆盖，测试证明metadata secret/synthetic边界。

最终证明：[reviewfix-bundle-proof.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/reviewfix-bundle-proof.json)。复核前本轮包`142c…e241`已在验证源/目标都属于本轮workspace及全部hash后，用Move-Item归档至runtime/launch-bundle-pre-review；原文件字节保持，不覆盖旧包。归档证明：reviewfix-prior-bundle-preserved.json。旧Phase8 bundle manifest `c590b2807b323275052738da8887f12162e807bf39b5666afcbad113da2d7061`及每个payload保持原字节。

## G. Actual Backup / Restore

本机已有PG17.11 client临时加入测试PATH，真实runBackup→pg_dump+uploads tar→另一新安全库pg_restore+另一目录tar解压。无Object Store时原runBackup在本机成功后返回“backup made locally but not uploaded”，按事实记录，不修改备份业务代码以假装上传。

| Pair | SHA256 |
|---|---|
| `aifind-phase85-28f87d2e-launch-candidate-test-202610070149.dump` | da23e23a54521593a0187885dbdeebc72d51b9d7d148311682a470cb3e01be48 |
| `aifind-phase85-28f87d2e-launch-candidate-test-files-202610070149.tar.gz` | ae96586071b22e26a004b3841ed535cb785be5a95fb62d5fd41d5a5f46753115 |

恢复12Product+2Compare+2Category+2Guide、81migrations；Evidence/lastVerifiedAt、原News日期、NotebookLM Alias一致。processed Asset SHA `6f40cb4c87e91e52a5d937c33b0ef69bb0a63fc1634a29eff6909ec26607a8b7`匹配。DB-only目录无媒体→含媒体Guide NOT_FOUND，不能报告完整恢复。

Source DB的本机恢复receipt绑定这一对当前文件SHA、来源DB、另一恢复DB及remote=false。Preflight实际查文件/hash，而非仅读取一个“成功”布尔值。**Object upload=false；remote restore未执行**。

## H. 实际新增/修改文件

32个既有文件最小修改，10个新增文件；ignored `.data`是本轮脚本/日志/备份/浏览器证据，不提交。最终audit另附实际路径清单与本阶段独立diff。

| 文件/模块 | 改动原因 |
|---|---|
| site/site.ts | 编辑主体、真实产品/新闻站介绍、SEO/llms文案出口 |
| site/pages/terms.md；site/pages/privacy.md | 按Owner身份与现有功能填写政策、使用既有metadata/intro渲染格式 |
| site/launch/owner-review.json | Owner已决定的弱编辑身份、联系/政策、source_backed、OFF；Product approvals仍空 |
| site/launch/2026-10-07-corpus.json | 当前Notebook官方身份/旧Alias、最小来源证明、事实边界与Guide成本unknown；22来源/59已审核字段值绑定 |
| modules/aifind/launch/contracts.ts | 未解决矛盾标记及来源reviewedFacts审核元数据；无DB schema/migration |
| modules/aifind/launch/corpus.ts | Corpus/Published共享字段/值投影，直接来源绑定；不可访问/矛盾/unsupported/synthetic阻塞 |
| modules/aifind/launch/preflight.ts | INFO/DEFERRED、OFF严格边界、真实本机pair/hash恢复证明、五项gates |
| modules/aifind/launch/routes.ts | 正常admin-only只读readiness API，保留旧入口 |
| modules/aifind/launch/staging.ts | 独立non-production候选发布，导入receipt/revision未改变，逐项先检查再审计Publish |
| modules/aifind/launch/bundle.ts | typed launch-metadata、source-backed校验，旧bundle行为/不可覆盖边界保留 |
| modules/aifind/module.ts；modules/aifind/web.tsx | 正常后台注册/菜单与站点policy Footer |
| modules/aifind/web/contact.tsx | 实际联系表单入口和编辑身份 |
| modules/aifind/web/home-products.tsx | 实际HTTP读数、用途/检索和内容模块，空模块自然隐藏 |
| modules/aifind/web/launch-preview.tsx | 复用readiness display显示独立gates/OFF/source/backup，正常页面不称Simulation |
| **新增** modules/aifind/web/policy-footer.tsx | 简单五项policy/contact Footer |
| **新增** modules/aifind/web/launch-readiness.tsx | 正常admin API页面wrapper |
| scripts/stage-aifind-launch.ts | 显式--publish-candidate，和simulation互斥；不自动发布 |
| scripts/lib/aifind-launch-runtime.ts | 可传正常entryPath、强随机密码、exclusive启动历史/旧receipt保留 |
| **新增** scripts/serve-aifind-launch-candidate.ts | 新候选库/正常runtime guard、localhost/owned路径、全部valvesfalse/strip secrets、不seed |
| modules/aifind/tests/launch-preflight.test.ts | LP10补完整fake Admin/OFF fixture，保持名字及只读/工程断言 |
| modules/aifind/tests/launch-http.test.ts | 正常readiness认证/noindex/no-store/flagfalse测试 |
| modules/aifind/tests/launch-bundle.test.ts | typed metadata和unsafe/secret拒绝测试 |
| modules/aifind/tests/module.test.ts | 原精确注册列表只追加正常readiness route |
| **新增** modules/aifind/tests/launch-candidate.test.ts | source-backed/OFF/证据/未知/credential/真实restore边界；RC31/32同产品字段错配与值反转RED→GREEN |
| **新增** modules/aifind/tests/launch-publication.test.ts | 实际候选发布、变更Draft拒绝、生产/遗漏证据/重复发布拒绝；RC33真实Published来源绑定及unknown |
| **新增** modules/aifind/tests/launch-runtime-candidate.test.ts | 正常entry、启动安全边界/history，flagfalse |
| apps/web/tests/aifind-launch.test.ts | 正常readiness SSR、Footer、home HTTP数据、可见政策日期RC30 |
| apps/web/tests/aifind-baseline-runtime.test.ts | Organization精确AIFIND編集部，WebSite/Dataset原品牌断言保留 |
| **新增** tests/database-cleanup.ts；tests/database-cleanup.test.ts | 仅测试数据库CREATE/DROP DDL协调及安全/锁/并行回归DC01–04 |
| tests/databases.ts；tests/backup-files.test.ts；tests/preview-news.test.ts | 原fixture创建/清理接入同锁，不改内容/恢复/外部禁用断言 |
| modules/aifind/tests/migrations.test.ts；admin-migrations.test.ts；detector-migrations.test.ts；guide-backup.test.ts | 相同测试DDL接入；原migration/升级/Published/Draft/Asset断言不变 |
| docs/deploy.md | 8.5正常运行、source-backed/OFF、配对恢复/远端前提、标准preload与测试DDL说明 |
| **新增** docs/superpowers/plans/2026-10-07-aifind-phase85-release-candidate.md | 授权范围、实施任务与Review Focus |
| **新增** 本报告 | 本轮实际交付/日志/门禁与限制 |

没有新migration、Product/Editorial schema、CMS、Redis、微服务或框架迁移。

## I. Git Safety

开始前HEAD `9848e936106db037d99a304887c36aad3fd0fad4`，branch `codex/ai-signal-jp`；1070路径/1067现存文件逐文件备份+hash，81已发布migration hash。当前原SC字体/License三项本来缺失，未恢复。

本轮只基于这些before文件生成独立diff，未以Git HEAD覆盖大量既有日本化或Phase1–8工作。旧Phase8 bundle所有文件与baseline原字节保留；没有reset/clean/覆盖checkout/restore/stage/commit/push。`.env`、index、HEAD未改。所有此前tracked/untracked工作保留，32指定文件的本轮增量可逐项审查。

关闭审计：[closure-git-safety.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/closure-git-safety.json)：32指定既有文件本轮增量、10新增文件、1038旧路径未改；unexpected0、lost0、migrationChanged0、index/.env/HEAD不变、旧Phase8全部bundle字节和baseline保留。SC三项仍保持原有缺失状态。

报告/计划关闭后的再核验：[final-git-safety.json](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/final-git-safety.json)，独立diff：[final-phase85-only.diff](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/final-phase85-only.diff)。同时校验本轮复核前包已归档且全部hash不变，修复后Product pack与归档包一致；未重写生产或既有发布内容。

## J. Remaining Deployment Prerequisites / Limitations

1. **仅远端灾备造成Operations PARTIAL**：remote Object Store、remote paired backup、remote restore未配置/未执行；本机PASS不等于远端PASS。
2. 正式SITE_URL、HTTPS/DNS、持久化目录/托管、生产认证密钥、生产数据导入与生产验收属于单独授权的Phase9；当前URL为localhost。不把新候选库当生产库。
3. 采集/Detector/模型/Feishu/IndexNow继续OFF。未来开启前先完成Source permission/robots/Jina审核和预算配置；当前未审核不等于获得采集授权。
4. unknown合法但不是已核实事实。当前证据校验包括声明可访问、产品对应、明确矛盾及已审核字段/值/来源绑定，再结合本轮人工官方来源复核；不声称自动自然语言矛盾检测或自动验证任意网页语义。未来事实变化须重新人工核对并更新绑定；本轮法律文案不能冒充法律充分性审查。
5. Japanese质量/模型评分日语校准、独立hands-on、付费精确价格等未完成，不编造；前期人工Gold校准仍另行授权。
6. Windows17.10的底层ProcSignalBarrier问题未升级修复。当前以本轮实际绿suite+仅fixture DDL协调为测试基线；不要推断服务器没有race或原共享集群也已重新验证。未来完整patched PostgreSQL环境须独立验证；不混装或修改旧runtime。
7. 8条历史News是原官方链接摘要数据；本轮无新采集/模型撰写，今日/24h为0。没有日报内容时不造日报；原08:00编辑周期保留。
8. 候选按既有Domain流程逐项审计发布，不是跨所有Product/Editorial的全局事务。若中途失败可留下部分非生产候选发布；应检查审计/revision receipt并显式恢复，不自动重试或声称整批原子性。

本轮没有需要Owner重新决定的产品审批/法人/邮箱问题。远端灾备配置和正式部署资源在Phase9再落实，未执行任何生产行动。

## K. Final Review / Closure

按executing-plans skill执行一次fresh-context只读whole-phase review：/root/phase85_final_review。初评Critical0、Important1、Minor0；Important为同产品来源字段/值错配，已在一次fix pass中RC31–33 RED→GREEN并完成全项目验证。无未修复Critical/Important，无Deferred Minor；未派第二reviewer。记录：[final-review.md](D:/Projects/aihot/.data/phase85-20261007-28f87d2e/final-review.md)。

Reviewer暂不判定的四项已明确裁决：生产/远端/真实付费调用留给Phase9；任意未来网页事实和法律充分性需人工复核；PostgreSQL内核race未声称修复；不新增全局发布事务，披露中断后的部分候选风险。详细执行裁决与成本保存在progress.md及上述limitations，不留无说明UNKNOWN。

Phase 8.5 在以上五项真实门禁下关闭。STOP：不自动Phase9，不连接生产，不切DNS，不开启Detector或付费模型。
