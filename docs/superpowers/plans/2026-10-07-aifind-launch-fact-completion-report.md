# AIFIND Launch Fact Completion Sweep — Final Report

完成时间：2026-10-07T05:23:50.875Z。这是现有 Release Candidate 的事实补齐收尾，不是新功能 Phase。正常站点：[http://localhost:4000/](http://localhost:4000/)，Notebook：[产品详情](http://localhost:4000/products/gemini-notebook)。没有新 Preview，AIFIND_PREVIEW_ENABLED=false；未部署 Production，未扩大 Catalog。

## A. Result / Gate

**Launch Fact Completeness Gate = READY**。12 产品均完成主动官方资料检索；受控事实 unknown 从 **274 → 54**，共补齐 **220** 项；114 Evidence。剩余 54 项逐字段记录了实际检查的官方来源、检查时间和具体原因，0 未研究/时间不足类理由。首页 6 张卡片的 Japan、Japanese Input、Output、UI、Free state 均为 non-unknown，Gemini Notebook 卡片存在。Adobe Firefly 的日语输出仍 unknown，所以保留目录/详情访问并不进入此首页模块。

sourceBackedIssueCount=0、factCompletenessIssueCount=0；新包已冻结，正常网站 Chrome PASS。Engineering / Content / Release Candidate 为 READY；**Operations=PARTIAL，Phase 9=NOT READY，Production=NOT EXECUTED**，不能将本轮事实完成解读为生产上线许可。

## B. Twelve-product matrix

対応/full、一部対応/partial、非対応/none；可/available。明确不支持与 unknown 分开。Free state 的 free 是永久免费层，trial 是有限试用；不做 FX。

| Product | JP | JA input | JA output | JA UI | Free | Web | iOS | Android | Remaining unknown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | 可 | 対応 | 対応 | 対応 | free | 可 | 可 | 可 | 5 |
| Claude | 可 | 対応 | 対応 | 対応 | free | 可 | 可 | 可 | 3 |
| Gemini | 可 | 対応 | 対応 | 対応 | free | 可 | 可 | 可 | 3 |
| Gemini Notebook | 可 | 対応 | 対応 | 対応 | free | 可 | 可 | 可 | 6 |
| Perplexity | 可 | 対応 | 対応 | 一部対応 | free | 可 | 可 | 可 | 1 |
| Cursor | 可 | 一部対応 | 一部対応 | 一部対応 | free | 可 | 可 | 不可 | 1 |
| GitHub Copilot | 可 | 一部対応 | 一部対応 | 一部対応 | free | 可 | 可 | 可 | 3 |
| Adobe Firefly | 可 | 対応 | 未確認 | 対応 | free | 可 | 可 | 可 | 8 |
| Runway | 可 | 一部対応 | 一部対応 | 非対応 | free | 可 | 可 | 可 | 7 |
| ElevenLabs | 可 | 対応 | 対応 | 一部対応 | free | 可 | 可 | 可 | 7 |
| Notion AI | 可 | 対応 | 対応 | 対応 | trial | 可 | 可 | 可 | 3 |
| Dify | 可 | 一部対応 | 一部対応 | 対応 | free | 可 | 未確認 | 未確認 | 7 |

| Product | Before unknown | After unknown | Remaining fields |
| --- | --- | --- | --- |
| ChatGPT | 19 | 5 | platform:linux, platform:browser_extension, capability:video_generation, capability:api, price:go:0:priceType |
| Claude | 20 | 3 | capability:image_generation, capability:video_generation, capability:api |
| Gemini | 24 | 3 | platform:linux, platform:browser_extension, capability:api |
| Gemini Notebook | 25 | 6 | platform:windows, platform:macos, platform:linux, platform:browser_extension, capability:coding, capability:agent |
| Perplexity | 25 | 1 | platform:linux |
| Cursor | 23 | 1 | platform:browser_extension |
| GitHub Copilot | 23 | 3 | platform:browser_extension, capability:image_generation, capability:video_generation |
| Adobe Firefly | 22 | 8 | language:ja:outputSupport, platform:windows, platform:macos, platform:linux, platform:browser_extension, capability:text, capability:coding, capability:research |
| Runway | 24 | 7 | platform:windows, platform:macos, platform:linux, platform:browser_extension, capability:coding, capability:search, capability:research |
| ElevenLabs | 23 | 7 | platform:windows, platform:macos, platform:linux, platform:browser_extension, capability:coding, capability:search, capability:research |
| Notion AI | 23 | 3 | platform:browser_extension, capability:video_generation, capability:api |
| Dify | 23 | 7 | platform:ios, platform:android, platform:windows, platform:macos, platform:linux, platform:browser_extension, capability:video_generation |

unknown 统计覆盖现有 lifecycle、JP、JA 三项、七个平台、全部十个 CAPABILITY_KEYS、free state 及每个 plan 的受控状态/未知 priceType；免费与 custom 价格合法的 null 金额/币种不当作未知价格。全部原字段、价格、平台和官方 source 清单保存在 [accepted-fact-inventory.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-fact-inventory.json)，且逐产品核对 Published Reader 与最新 corpus 一致。

## C. High-value corrections

- Gemini Notebook 当前官方名称/NotebookLM former_name；JP、日语输入/输出/UI、Web/iOS/Android、free 均已确认。历史别名搜索仍只返回同一产品，不创建重复 Product。产品、国家、语言、移动端、计划和改名官方来源见下方完整清单。
- 日本語三项独立记录。Runway UI 明确 English-only，因此显示 none；Dify 语言能力依赖连接模型，保持 partial；不会把“支持日本语”扩展为全部三项 full。
- Notion AI 为 trial，不把宿主工作区 Free 当作永久免费 AI；ChatGPT Go 价格在公开资料不能取得实际金额时保留 unknown。
- Firefly Pro Plus/Premium：标准 JPY 6,600/31,680 与首年 JPY 4,617/22,162 分开；初次购买、18+、日本适用、12 个月契约、2026-07-09～2026-10-12 购买窗口、原价自动续约。窗口不是已购买契约终止日。Pro Plus 标准价行遗留的“条件未确认”文字已 RED→GREEN 修正。[官方资料](https://www.adobe.com/jp/offer-terms/ff-full-special-offer.html)
- ElevenLabs Starter/Creator/Pro/Scale/Business 年付 USD 60/220/990/2,990/9,900，按官方明确“正常月价×10个月”计算精确年额，不用 Creator 初月促销推算；Creator 日本 iOS JPY 3,500/月、35,000/年与 Web USD 分列。[官方资料](https://elevenlabs.io/pricing)，[官方资料](https://apps.apple.com/jp/app/elevenlabs-ai-voice-generator/id6743162587)
- Firefly creative Agent 和素材 semantic search 为 partial：Beta 桌面 Web/18+及方案资格；搜索限自有素材，English semantic/其他语言 filename 语义分开。ElevenLabs 的图像理解只归于有权限读取 Slack 附件的 Agents，保持 partial，不扩大为通用能力。[官方资料](https://elevenlabs.io/docs/eleven-agents/customization/integrations/slack)。该页本轮只读 HTTP200 证据为 [slack-official-read.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/slack-official-read.json)。
- 全部 summaryJa 按已确认核心用途重写；未知平台和能力放入默认折叠区，不自动写成 unavailable。

## D. Actual changes

| File | Why |
| --- | --- |
| [apps/web/tests/aifind-launch.test.ts](D:/Projects/aihot/apps/web/tests/aifind-launch.test.ts) | 保留旧用例名称，调整其真实 Launch Corpus 条件；不把旧的不可确认首页 fixture 当成合格卡片。 |
| [apps/web/tests/aifind-public.test.ts](D:/Projects/aihot/apps/web/tests/aifind-public.test.ts) | 新增三项 Web 行为回归；校正旧首页 fixture 的核心字段，不放宽隔离断言。 |
| [modules/aifind/public-contracts.ts](D:/Projects/aihot/modules/aifind/public-contracts.ts) | 公开 DTO 增加可选 freePlanState；free/trial/paid/custom/unknown 各自保留语义。 |
| [modules/aifind/publication/public-products.ts](D:/Projects/aihot/modules/aifind/publication/public-products.ts) | 首页只取五项核心事实均已知的 Published；免费审核绑定同一 Published 的日期、证据和当前 Plan/Price fingerprint，过期免费价格不兜底为 free。 |
| [modules/aifind/public/editorial-routes.ts](D:/Projects/aihot/modules/aifind/public/editorial-routes.ts) | 首页和公开 Editorial 使用相同合格产品读取；避免返回不满足核心事实 Gate 的卡片。 |
| [modules/aifind/web/public-view.tsx](D:/Projects/aihot/modules/aifind/web/public-view.tsx) | 卡片免费/试用文案区分，并显示独立日本语输入、输出、UI。 |
| [modules/aifind/web/public-product.tsx](D:/Projects/aihot/modules/aifind/web/public-product.tsx) | 未知平台及能力折叠为次要信息；试用与免费区分，保留原币种、计费期间和限定说明。 |
| [modules/aifind/launch/contracts.ts](D:/Projects/aihot/modules/aifind/launch/contracts.ts) | dossier 增加事实审核与逐字段 unknown 原因，以及同产品官方补充来源；没有 Product schema 迁移。 |
| [modules/aifind/launch/corpus.ts](D:/Projects/aihot/modules/aifind/launch/corpus.ts) | 事实审核与既有 Evidence 值绑定同时核验；官方补充来源受同一 dossier 约束。 |
| [modules/aifind/launch/preflight.ts](D:/Projects/aihot/modules/aifind/launch/preflight.ts) | 增加 content.factCompleteness 和独立 launchFactCompleteness Gate；其 READY 必须同时通过 sourceBacked 与最低内容数量。 |
| [modules/aifind/launch/bundle.ts](D:/Projects/aihot/modules/aifind/launch/bundle.ts) | 事实不完整则拒绝冻结；保留真实密钥检测并避免官方 URL 中 ask-questions 的误报。 |
| [modules/aifind/tests/launch-candidate.test.ts](D:/Projects/aihot/modules/aifind/tests/launch-candidate.test.ts) | 保留旧案例，更新真实核心字段/试用事实的预期。 |
| [modules/aifind/tests/launch-bundle.test.ts](D:/Projects/aihot/modules/aifind/tests/launch-bundle.test.ts) | 新增 FCB01/02：事实缺失阻断冻结、合法官方 URL 与真实密钥区分。 |
| [modules/aifind/tests/launch-content.test.ts](D:/Projects/aihot/modules/aifind/tests/launch-content.test.ts) | 保留原内容验收，采用本轮实际事实状态。 |
| [modules/aifind/tests/public-web-fixture.ts](D:/Projects/aihot/modules/aifind/tests/public-web-fixture.ts) | 只补齐原有合格 Published fixture 的核心字段，保持 Draft 与 unknown 不泄漏。 |
| [site/launch/2026-10-07-corpus.json](D:/Projects/aihot/site/launch/2026-10-07-corpus.json) | SSOT revision 5，固定十二产品、114 Evidence、54 精确 unknown 审核；含原币种价格、former_name、条件与自然日语 Summary。 |
| [modules/aifind/launch/facts.ts](D:/Projects/aihot/modules/aifind/launch/facts.ts) | 新增最小事实审核 helper，控制字段清单、商业事实指纹、逐项审核理由；不创建新 Product 业务模块。 |
| [modules/aifind/tests/launch-facts.test.ts](D:/Projects/aihot/modules/aifind/tests/launch-facts.test.ts) | 新增 FC01–FC09：首页、Published/Draft、免费/试用/价格有效期、精确 unknown 审核、Gate、Firefly 条件、ElevenLabs 年付与能力限制。 |

新增计划 [2026-10-07-aifind-launch-fact-completion-plan.md](D:/Projects/aihot/docs/superpowers/plans/2026-10-07-aifind-launch-fact-completion-plan.md) 和本报告；其他运行脚本、日志、截图、备份、哈希仅位于 ignored .data/launch-fact-sweep-20261007-36c9af37，不改 .env，不提交密钥。未新增 migration、数据库表、Product 能力、复杂插件或基础设施。

## E. Publication and historical isolation

| Product slug | Before | Current Published | lastVerifiedAt (UTC) | History |
| --- | --- | --- | --- | --- |
| chatgpt | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| claude | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| gemini | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| perplexity | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| cursor | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| github-copilot | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| adobe-firefly | v1 | v4 | 2026-10-07T04:45:55.386Z | 旧事实保留；新 Draft 有明确 Published base |
| runway | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| elevenlabs | v1 | v3 | 2026-10-07T04:42:40.392Z | 旧事实保留；新 Draft 有明确 Published base |
| notion-ai | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| dify | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |
| gemini-notebook | v1 | v2 | 2026-10-07T04:12:10.470Z | 旧事实保留；新 Draft 有明确 Published base |

12 产品从明确 v1 Published 创建新 Draft 后授权发布 v2；一次最终审核修正再将 Firefly/ElevenLabs 从明确 v2 发布 v3；Chrome 旧说明修正仅将 Firefly 从明确 v3 发布 v4。最初六篇 Editorial 通过新 Draft/reference revision 发布，后面两次各重核/发布一篇相关 Category。Compare/Category/Guide 现均 2 篇，0 needs_retest、0 productInfoUpdated，实际 Guide 图和 8 条原新闻时间保留。

商业事实替换只作用于新 mutable Draft，锁定 Product/Draft 和 current Published base，并单独记录 operator audit；每次发布前证明 Published 未变。没有原地重写已 Published 历史；15 个 superseded 产品快照事实逐项相等。lastVerifiedAt 来自 Domain 已确认事实的聚合，不用 updated_at。记录：[fact-publication.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/fact-publication.json)、[review-fix-publication.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/review-fix-publication.json)、[price-clarity-publication.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/price-clarity-publication.json)、[content-smoke-accepted.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/content-smoke-accepted.json)。

## F. Fresh verification and accepted baseline

| Check | Result | Actual result | Evidence |
| --- | --- | --- | --- |
| typecheck | PASS | 全部 workspace | [accepted-types.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-types.log) |
| Web build | PASS | @aihot/web | [accepted-build.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-build.log) |
| npm test | PASS | 1160 total / 1152 PASS / 0 FAIL / 0 CANCELLED / 8 SKIP | [accepted-final-full.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-final-full.log) |
| Web tests | PASS | 101/101 PASS | [accepted-web.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-web.log) |
| site smoke | PASS | 全部检查通过，含原公开出口/MCP | [accepted-site.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/accepted-site.log) |
| launch content smoke | PASS | 8 组 / 20 正常页面 / 15 旧版本事实 / 8 原始新闻日期 | [content-smoke-accepted.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/content-smoke-accepted.json) |
| Chrome 主验收 | PASS | 40/40，LC01–LC25 原案例及 15 个事实案例 | [chrome-accepted-lc01-lc25.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-accepted-lc01-lc25.json) |
| Chrome 价格/Evidence 补充 | PASS | 4/4，正常 Chrome 154.0.8037.95 | [chrome-price-accepted-evidence.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-price-accepted-evidence.json) |
| 本机配对备份恢复 | PASS | 12/12；独立 recovery_test，真实 8820 字节图片；仅 DB 恢复时媒体 Guide fail closed | [candidate-backup-restore-accepted.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/candidate-backup-restore-accepted.json) |
| 冻结重复构建 | PASS | 同一输入的两个新目录逐文件字节一致 | [final-bundle-proof.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-bundle-proof.json) |
| 生产部署 / 远程恢复 / 真实模型输出测试 | UNRUN | 本轮授权范围外；未请求真实账号或付费服务 | [final-preflight.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-preflight.json) |

旧 Phase 8.5 基线的 **1149 个数据库测试、98 个 Web 测试** 名称、层级、状态及 SKIP 理由逐项按多重集合完整保留；新数据库测试 11 项及新 Web 测试 3 项均 PASS。不是仅比较总数。未来以 [final-accepted-baseline.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-accepted-baseline.json) 为本候选 regression baseline；记录原代码文件哈希及所有新执行证据，SHA256 `449c4dad5e4ea947f453cf1c80b66a2d8a4762de899da0f6e270c9a864c82de2`。[phase85-accepted-baseline.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/phase85-accepted-baseline.json) 保留原样。

### Eight original skips (unchanged)

| Test | Reason |
| --- | --- |
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |

本轮 RED 日志并非最终失败：旧首页/core Gate、试用、缺失 unknown audit、冻结门槛、价格有效期、最终审核四项与 Chrome 残留说明均先复现再修复；最终套件是上述最新 accepted-final-full，不使用修正前 full-suite-final/closure-full 代替结果。

### The 23-failure test-template incident

closure-full 当轮为 1160 total /1129 PASS /23 FAIL /0 CANCELLED /8 SKIP。根因是我运行定向 node --test 时遗漏项目数据库 preload，把 12 个合成 fixture 留在 aifind_fact_36c9af37_test 模板；npm test 的 globalSetup 只 migrate、不清空模板，然后每文件复制其数据。12 产品都关联 synthetic.example/product，既破坏空库前提，也使 Detector 正确报 identity ambiguous。Release Candidate 数据库与模板数据库分离，正式候选仍 0 synthetic。

以下全部 23 FAIL 归类 TEST_CONFIGURATION；使用全新空模板和 tests/databases.ts 后九个文件连续两次 52/52 PASS，完整干净套件随后 1152 PASS/8 SKIP；最终价格修正后再在 aifind_fact_final_36c9af37_test 重跑完整套件亦 1152 PASS/8 SKIP。没有修改这些业务文件/测试断言、增加 timeout、删测试、加 skip 或降低生产安全阀。

| Test | File | First-layer error | Category | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| Phase 2 preview fixture never seeds by default or in production, including module/API startup imports | modules/aifind/tests/admin-preview.test.ts:16:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Phase 2 seed provides marked A Published+Draft, B Published-only and real pending/approved candidates | modules/aifind/tests/admin-preview.test.ts:27:1 | AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value: assert.ok(a.evidence.every(e => e.url.includes("preview.example.invalid"))) generatedMessage: true, code: 'ERR_ASSERTION', actual: false, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| R07/B04 actual model adapters short-circuit with MODEL_CALLS_ENABLED=false and create no receipt | modules/aifind/tests/detector-jobs.test.ts:37:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'ambiguous' - 'model_disabled' generatedMessage: true, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| K01-K06 Evidence-first detector starts detected, promotes only validated pending, and cannot edit or publish Domain | modules/aifind/tests/detector.test.ts:28:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'ambiguous' - 'detected' generatedMessage: true, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| K07-K10 / X03 concurrent and ten repeated runs create one immutable Candidate and Evidence | modules/aifind/tests/detector.test.ts:42:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1 generatedMessage: true, code: 'ERR_ASSERTION', actual: 0, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| T01-T05 / X04-X05 Human approve time is applied to Draft; Published and public freshness remain V1 until separate Publish | modules/aifind/tests/detector.test.ts:54:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1 generatedMessage: true, code: 'ERR_ASSERTION', actual: 0, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| X01 Published changes during detector work: retain stale observation, create no pending Candidate | modules/aifind/tests/detector.test.ts:70:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'ambiguous' - 'stale' generatedMessage: true, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| X02 Draft conflict prevents Detector Apply from overwriting human work | modules/aifind/tests/detector.test.ts:78:1 | Error: UNDEFINED_VALUE: Undefined values are not allowed | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| D03-D05 invalid quote/schema is recorded without Evidence or active proposals | modules/aifind/tests/detector.test.ts:97:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'ambiguous' - 'invalid' generatedMessage: true, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| K08 Evidence/Candidate/audit rollback is retry-safe after interruption | modules/aifind/tests/detector.test.ts:104:1 | AssertionError [ERR_ASSERTION]: Missing expected rejection. generatedMessage: false, code: 'ERR_ASSERTION', actual: undefined, expected: /synthetic interruption/, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Japanese evidence with an emoji before the quote uses correct persisted character coordinates | modules/aifind/tests/detector.test.ts:112:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1 generatedMessage: true, code: 'ERR_ASSERTION', actual: 0, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| A contradictory prose platform quote is retained as unsupported without Evidence or Candidate | modules/aifind/tests/detector.test.ts:118:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'ambiguous' - 'no_changes' generatedMessage: true, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Discovery Preview default/production flag never seeds; authenticated disabled endpoint is 404 | modules/aifind/tests/discovery-preview.test.ts:17:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Preview anonymous reads/actions are rejected, admin writes require CSRF and reads do not seed | modules/aifind/tests/discovery-preview.test.ts:23:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| P01/P13 Preview default and production never seed Products or Editorial, GET does not seed | modules/aifind/tests/editorial-preview.test.ts:13:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Preview defaults and production reject seed; GET never seeds or publishes | modules/aifind/tests/guide-preview.test.ts:13:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Launch Preview and Hub remain read-only with the synthetic Preview flag disabled | modules/aifind/tests/launch-http.test.ts:15:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| RC16 normal Launch Readiness is read-only with Preview disabled and no seed | modules/aifind/tests/launch-http.test.ts:19:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| LP10 clean real staging passes engineering checks; preflight GET is read only | modules/aifind/tests/launch-preflight.test.ts:23:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'NOT READY' - 'READY' generatedMessage: true, code: 'ERR_ASSERTION', | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Preview startup and default flag create no products; disabled reads and writes remain inaccessible | modules/aifind/tests/preview.test.ts:29:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Preview seeds refuse production, nonlocal hosts and ordinary databases, even with the flag enabled | modules/aifind/tests/preview.test.ts:37:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Preview reads real published/draft Domain data and fact verification times without seeding on reads | modules/aifind/tests/preview.test.ts:66:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 12 !== 0 generatedMessage: true, code: 'ERR_ASSERTION', actual: 12, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |
| Draft demo changes only the marked sample, keeps Published identical and repeat seeding preserves edits | modules/aifind/tests/preview.test.ts:91:1 | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 409 !== 200 generatedMessage: true, code: 'ERR_ASSERTION', actual: 409, | TEST_CONFIGURATION | 模板12产品及同URL；隔离1/2均PASS；干净全套PASS | 使用空 *_test 模板和项目逐文件隔离；保留原失败日志 |

逐项原因和原错误见 [test-failure-classification.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/test-failure-classification.json)、[test-template-contamination.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/test-template-contamination.json)、[closure-full.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/closure-full.log)、[template-isolation-1.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/template-isolation-1.log)、[template-isolation-2.log](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/template-isolation-2.log)。该事件没有代码回归，不将 23 个失败隐去。

## G. Chrome / human visual review

真实桌面 Chrome 154.0.8037.95，headless=false；常规 1366×900 和 390px mobile。正常网站 /、/products、全部 12 详情、两个 Compare、两个 Category、两个 Guide、政策/联系页面、RSS/MCP/SEO 原出口及 LC01–LC25 均保持。主验收40 PASS、0 FAIL、0 page/console errors、0外部浏览器请求；补充价格/Evidence 4 PASS。Evidence URL 均 HTTPS、无认证信息，并由产品官方资料读取核验；没有把不存在的链接默判正常。

人工查看实际截图：日语无乱码，Notebook 的三项日本语/JP/移动端/免费层清楚；未知项默认收起；Firefly 初年限定与通常价格均有条件说明且无陈旧未确认句；ElevenLabs 首月/月付/精确年额/JP iOS 原币种分开；Notion 只显示免费试用。未声称对真实产品做 hands-on 测试。

- 首页/Notebook：[fact-home-notebook.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-accepted-screenshots/fact-home-notebook.png)、[fact-gemini-notebook.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-accepted-screenshots/fact-gemini-notebook.png)。
- 目录/12详情/Compare/Category/Guide desktop/mobile：[Chrome screenshots](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-accepted-screenshots)。
- 价格和 Evidence：[Firefly-Pro-Plus.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-price-accepted-screenshots/Firefly-Pro-Plus.png)、[ElevenLabs-Creator.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-price-accepted-screenshots/ElevenLabs-Creator.png)、[Notion-trial.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-price-accepted-screenshots/Notion-trial.png)、[Notebook-Evidence.png](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/chrome-price-accepted-screenshots/Notebook-Evidence.png)。

## H. Frozen release evidence

新包：[New frozen bundle](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/runtime/launch-bundle)；重复构建：[Independent repeat](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-bundle-repeat)。Manifest SHA256 `1b4ca6c31711cf9bec8787f44ebc6cb57bcbe99c7c0ba941db15e2db132f8e34`。10 个条目含真实 8820-byte asset，81 migration manifest，12 products、2/2/2 Editorial、114 Evidence、精确54 unknown audit、政策 OFF/source-backed、当前 preflight 与 fresh test hashes。全部新目录 exclusive 创建，重复包逐文件字节一致；0 owner_approved 冒认、private Draft/auth/Candidates/Observations/TestRecord 不进入冻结公开内容。旧三个冻结目录完整保留。

本轮本机配对 dump/files 实际恢复到 aifind_fact_36c9af37_accepted_recovery_test；12 产品、2/2/2 Editorial、价格/Evidence/lastVerifiedAt、原日期和 NotebookLM 别名一致，media SHA匹配；只恢复 DB 时缺失媒体 Guide 被阻断。远程上传/远程恢复没有执行。冻结后 [final-preflight.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-preflight.json) 再读真实候选与新包有效性，factCompletenessIssueCount=0。

## I. Known limitations / decisions still outside this task

- 54 个真正 remaining unknown 完整列于下节；没有按缺省推断 unavailable。Firefly JA output 和 ChatGPT Go 实际售价尤其保留限制；Firefly因此不进首页最近确认模块。
- Source Policies 12 个 unreviewed 且全部 OFF，launch collection OFF，0 enabled Monitor；没有代替 Owner 批准采集。Production importer 默认拒绝。
- Operations PARTIAL：远程 backup/upload/remote restore 未配置及 UNRUN；Production secrets 和真实生产运行未验收；Phase 9 NOT READY。
- 本地报告任务 WARN 必须区分时间增量：旧 Phase8.5 冻结快照为6次失败、本任务开始前已8次、最终14次，其中本轮新增6条，全为 unchanged reports.compose 对 daily:2026-10-07 / weekly:2026-W40 / monthly:2026-09 缺输入的失败/重试，0付费回执。该计数不是旧值不变，也不是测试失败；没有清除记录、造日报数据或改报告系统。[candidate-report-runs.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/candidate-report-runs.json)、[operations-warning-comparison.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/operations-warning-comparison.json)。
- 当前价格、地区和功能是官方资料核验，不是实际购买、真实账号地区测试、真实模型输出验证；没有发生 OpenAI/X/Jina/Feishu/IndexNow 调用。当前所有 provider live budgets used=0。
- 八个 Windows 平台相关 SKIP 原样保留，POSIX 行为仍需 Linux CI；本轮没有冒认已执行 Linux。

## J. Git safety

开始前保存1080条tracked/untracked路径、1077个已有文件字节；1064条路径未变，16个旧文件仅作上述范围内修改，2个新代码文件加计划/报告。每个旧文件备份仍匹配原SHA；HEAD `9848e936106db037d99a304887c36aad3fd0fad4`、branch、index、.env、81 migration 和旧三个 bundle 哈希未变。原本已缺的三个SC字体保持已缺状态，没有恢复。未 reset/clean/checkout覆盖/restore批量覆盖、删除旧工作、改已发布migration、stage/commit/push/merge 或连接生产库。

报告前实际验证 [pre-report-git-safety.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/pre-report-git-safety.json)；报告写入后的最终验证为 [final-git-safety.json](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-git-safety.json)。保留分支 codex/ai-signal-jp 和工作树 D:/Projects/aihot。

## K. Independent final review / Rulings I made

唯一一次新鲜只读独立审核：Critical0 / Important4 / Minor0。四项 Important 均先 RED 再 GREEN：独立 Fact Gate 与来源/数量一致性、Firefly Offer 条件、ElevenLabs Annual、Firefly Agent/Search 条件。父任务之后进行了新的全套、Chrome、真实备份恢复、冻结和 preflight，没有第二次 review。Chrome 额外发现的旧价格句子也 FC07 RED→GREEN，最终全套再次通过。记录 [final-review.md](D:/Projects/aihot/.data/launch-fact-sweep-20261007-36c9af37/final-review.md)。

- Ruling: no task commits or workspace deletion — the user requires preservation of substantial pre-existing tracked/untracked work and frozen evidence; task artifacts remain available, without staging unrelated work — cost if wrong: manual scoped commit/cleanup remains for the owner.
- Ruling: independent review uses pre-task byte backups rather than Git HEAD as the baseline — HEAD does not contain the previously accepted dirty localization and Phase 1–8.5 implementation — cost if wrong: changes predating this request remain outside this task's review.
- Final: Ruling: reviewer did not inspect the final corpus, publication, bundle/report or complete test runs after repair — completion depends on parent fresh verification of each, rather than old PASS artifacts — cost if wrong: an unverified release candidate could be mislabeled READY.
- Final: Ruling: reviewer did not repeat database/Chrome/restore writes — the parent runs fresh complete checks and records hashes after the fix pass; a second review would duplicate this single-review workflow — cost if wrong: reviewer coverage is limited to its original review input.
- Final: Ruling: real account entitlements, region behavior and model output were not exercised — official source evidence supports these facts; no hands-on claim and no paid provider/real account request is authorized — cost if wrong: account-specific restrictions need subsequent explicit testing.
- Final: Ruling: Firefly Japanese output remains unknown — Speech language list lacks Japanese and Assistant optimization language is not a separate guarantee of generated Japanese text/speech; new FAQ is in its audit — cost if wrong: a usable output feature and its homepage eligibility would remain understated until explicit evidence is found.
- Final: Ruling: ElevenLabs Slack web-tool timeout is not an HTTP failure — parent direct read-only HTTP returned 200 and permission text says the agent can read image/PDF attachments; retain partial image understanding with source evidence — cost if wrong: that conditional capability would need correction if the official contract changes.

Deferred minors：none。

## L. Every remaining unknown — complete per-field audit

每个产品的 S 编号只指该产品实际 dossier 中可读取的官方来源；checkedAt 为 UTC，UI lastVerifiedAt 以日本时间显示。以下完整54项，不抽样。没有来源冲突时不臆造冲突；没有明确支持或否定就保留 unknown，已明确的其他平台照常 available。

### ChatGPT — 5 unknown

- S1 — official_product / product — [官方资料](https://chatgpt.com/)
- S2 — official_pricing / pricing — [官方资料](https://chatgpt.com/pricing/)
- S3 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries)
- S4 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/8357869-how-to-change-your-language-setting-in-chatgpt)
- S5 — official_docs / docs — [官方资料](https://help.openai.com/ja-jp/articles/9260256)
- S6 — official_product / product — [官方资料](https://chatgpt.com/download/)
- S7 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus)
- S8 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers)
- S9 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/8792828-chatgpt-business-overview)
- S10 — official_docs / docs — [官方资料](https://help.openai.com/en/articles/11989085-what-is-chatgpt-go)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:linux | S1, S3, S6 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for ChatGPT. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S6 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for ChatGPT. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:video_generation | S1, S3, S2, S5 | 2026-10-07T04:12:10.470Z | The current ChatGPT feature and pricing pages do not explicitly establish video generation inside this application. Sora has separate product documentation and cannot be silently equated with ChatGPT. |
| capability:api | S1, S3, S2, S5 | 2026-10-07T04:12:10.470Z | The official ChatGPT pricing and plan help explicitly separate OpenAI API billing. These sources do not establish a ChatGPT-specific inference API within the catalogued application; a vendor API is not treated as the same Product. |
| price:go:0:priceType | S2, S10, S3 | 2026-10-07T04:12:10.470Z | The current Go help refers to region-dependent pricing on the pricing page. The accessible public pricing text does not expose the current monetary amount; neither a global amount nor a Japan checkout price can be established. |

### Claude — 3 unknown

- S1 — official_product / product — [官方资料](https://claude.com/)
- S2 — official_pricing / pricing — [官方资料](https://claude.com/pricing)
- S3 — official_docs / docs — [官方资料](https://support.claude.com/en/articles/8461763-where-can-i-access-claude)
- S4 — official_docs / docs — [官方资料](https://support.claude.com/en/articles/10769299-how-to-use-claude-in-your-preferred-language)
- S5 — official_product / product — [官方资料](https://claude.com/download)
- S6 — official_docs / docs — [官方资料](https://code.claude.com/docs/en/desktop-linux)
- S7 — official_docs / docs — [官方资料](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)
- S8 — official_docs / docs — [官方资料](https://support.claude.com/en/articles/11101966-use-voice-mode)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| capability:image_generation | S1, S3, S2 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled image_generation capability. They do not explicitly establish this specific feature within Claude; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:video_generation | S1, S3, S2 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled video_generation capability. They do not explicitly establish this specific feature within Claude; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:api | S1, S3, S2 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled api capability. They do not explicitly establish this specific feature within Claude; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### Gemini — 3 unknown

- S1 — official_product / product — [官方资料](https://gemini.google/)
- S2 — official_pricing / pricing — [官方资料](https://gemini.google/jp/subscriptions/?hl=ja)
- S3 — official_docs / docs — [官方资料](https://support.google.com/gemini/answer/13575153?hl=en)
- S4 — official_docs / docs — [官方资料](https://support.google.com/gemini/answer/14579026?hl=en-GB)
- S5 — official_product / product — [官方资料](https://gemini.google/desktop/)
- S6 — official_blog / docs — [官方资料](https://blog.google/intl/en-africa/products/explore-get-answers/bard-becomes-gemini-try-ultra-10-and-a-new-mobile-app-today/)
- S7 — official_docs / docs — [官方资料](https://support.google.com/gemini/answer/17140089?hl=ja)
- S8 — official_docs / docs — [官方资料](https://support.google.com/gemini/answer/14579026?co=GENIE.Platform%3DiOS&hl=en)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:linux | S1, S3, S4, S5, S8, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Gemini. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S4, S5, S8, S7 | 2026-10-07T04:12:10.470Z | Official Chrome help describes built-in Gemini integration, with account and rollout restrictions. It does not establish a separately installable Gemini browser extension; built-in browser support is not a native extension. |
| capability:api | S1, S3, S2 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled api capability. They do not explicitly establish this specific feature within Gemini; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### Gemini Notebook — 6 unknown

- S1 — official_product / product — [官方资料](https://workspace.google.com/intl/ja/products/gemini-notebook/)
- S2 — official_pricing / pricing — [官方资料](https://gemini.google/jp/subscriptions/?hl=ja)
- S3 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16164461?co=GENIE.Platform%3DDesktop&hl=en)
- S4 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16261963?hl=ja)
- S5 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16215270?co=GENIE.Platform%3DDesktop&hl=en)
- S6 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16296687?co=GENIE.Platform%3DiOS&hl=ja)
- S7 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16296687?co=GENIE.Platform%3DAndroid&hl=en)
- S8 — official_docs / docs — [官方资料](https://support.google.com/gemininotebook/answer/16213268?hl=ja)
- S9 — official_blog / docs — [官方资料](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/)
- S10 — official_docs / docs — [官方资料](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:windows | S1, S3, S6, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone windows application/extension for Gemini Notebook. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:macos | S1, S3, S6, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone macos application/extension for Gemini Notebook. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:linux | S1, S3, S6, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Gemini Notebook. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S6, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for Gemini Notebook. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:coding | S1, S3, S8, S10 | 2026-10-07T04:12:10.470Z | The reviewed Notebook source and feature documentation cover grounded reports and research, but do not explicitly establish a code-editing or code-execution feature in the standalone Product. |
| capability:agent | S1, S3, S8, S10 | 2026-10-07T04:12:10.470Z | The reviewed Notebook product, help and notebook-management API document research and artifact generation. They do not establish autonomous external tool execution as a Notebook capability; Gemini Apps automation is a distinct surface. |

### Perplexity — 1 unknown

- S1 — official_product / product — [官方资料](https://www.perplexity.ai/hub)
- S2 — official_pricing / pricing — [官方资料](https://www.perplexity.ai/hub/pricing?p=enterprise)
- S3 — official_docs / docs — [官方资料](https://www.perplexity.ai/ja/hub/blog/getting-started-with-perplexity)
- S4 — official_product / product — [官方资料](https://apps.apple.com/jp/app/perplexity-ask-anything/id1668000334)
- S5 — official_product / product — [官方资料](https://www.perplexity.ai/ja/hub/products/computer-for-windows)
- S6 — official_product / product — [官方资料](https://www.perplexity.ai/ja/personal-computer)
- S7 — official_docs / docs — [官方资料](https://www.perplexity.ai/help-center/en/articles/10352986-enterprise-pricing-and-billing-frequently-asked-questions)
- S8 — official_docs / docs — [官方资料](https://www.perplexity.ai/help-center/en/articles/11680686-perplexity-max)
- S9 — official_blog / docs — [官方资料](https://www.perplexity.ai/en-GB/changelog/role-based-access-controls-api-credentials-and-brain-for-max)
- S10 — official_blog / docs — [官方资料](https://www.perplexity.ai/en-GB/changelog/automations-inline-visualizations-and-gpt-6-1-sol)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:linux | S1, S3 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Perplexity. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |

### Cursor — 1 unknown

- S1 — official_product / product — [官方资料](https://cursor.com/ja)
- S2 — official_pricing / pricing — [官方资料](https://cursor.com/pricing)
- S3 — official_docs / docs — [官方资料](https://prod.cursor.com/help/account-and-billing/pricing)
- S4 — official_product / product — [官方资料](https://cursor.com/download)
- S5 — official_docs / docs — [官方资料](https://forum.cursor.com/t/please-add-the-multi-language-settings-feature/159824)
- S6 — official_docs / docs — [官方资料](https://forum.cursor.com/t/agent-responds-in-japanese-when-i-ask-questions-in-chinese/160068/7)
- S7 — official_blog / docs — [官方资料](https://cursor.com/changelog/2-4)
- S8 — official_docs / docs — [官方资料](https://cursor.com/docs/api/origin)
- S9 — official_docs / docs — [官方资料](https://cursor.com/docs/rules)
- S10 — official_product / product — [官方资料](https://apps.apple.com/jp/app/cursor/id6767085653)
- S11 — official_docs / docs — [官方资料](https://forum.cursor.com/t/cursor-android-mobile-app/165496)
- S12 — official_docs / docs — [官方资料](https://github.com/runwayml/runway-mcp-plugin)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:browser_extension | S1, S3, S4, S10, S11 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for Cursor. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |

### GitHub Copilot — 3 unknown

- S1 — official_product / product — [官方资料](https://github.com/features/copilot)
- S2 — official_pricing / pricing — [官方资料](https://docs.github.com/en/copilot/get-started/plans)
- S3 — official_docs / docs — [官方资料](https://docs.github.com/en/get-started/using-github/github-mobile)
- S4 — official_product / product — [官方资料](https://github.com/features/ai/github-app)
- S5 — official_blog / docs — [官方资料](https://github.blog/jp/2024-01-09-github-copilot-chat-now-generally-available-for-organizations-and-individuals/)
- S6 — official_docs / docs — [官方资料](https://docs.github.com/en/copilot/customizing-copilot/adding-personal-custom-instructions-for-github-copilot)
- S7 — official_docs / docs — [官方资料](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/chat-with-copilot/chat-in-ide)
- S8 — official_docs / docs — [官方资料](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/image-input)
- S9 — official_docs / docs — [官方资料](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:browser_extension | S1, S3, S4 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for GitHub Copilot. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:image_generation | S1, S3, S7, S8 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled image_generation capability. They do not explicitly establish this specific feature within GitHub Copilot; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:video_generation | S1, S3, S7, S8 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled video_generation capability. They do not explicitly establish this specific feature within GitHub Copilot; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### Adobe Firefly — 8 unknown

- S1 — official_product / product — [官方资料](https://www.adobe.com/jp/products/firefly.html)
- S2 — official_pricing / pricing — [官方资料](https://www.adobe.com/jp/products/firefly/plans.html)
- S3 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/get-started/learn-the-basics/technical-requirements.html)
- S4 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/mobile/get-set-up/learn-the-basics/technical-requirements.html)
- S5 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/get-started/learn-the-basics/adobe-firefly-faq.html)
- S6 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/work-with-audio-and-video/work-with-audio/supported-languages-in-generate-speech.html)
- S7 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/work-with-audio-and-video/work-with-audio/generate-speech-using-partner-models.html)
- S8 — official_docs / docs — [官方资料](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/)
- S9 — official_terms / pricing — [官方资料](https://www.adobe.com/jp/offer-terms/ff-full-special-offer.html)
- S10 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/firefly-ai-assistant/firefly-ai-assistant-overview.html)
- S11 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/firefly-ai-assistant/ai-assistant-faq.html)
- S12 — official_docs / docs — [官方资料](https://helpx.adobe.com/jp/firefly/web/access-your-files/search-assets-using-semantic-search.html)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| language:ja:outputSupport | S3, S6, S7, S5, S11 | 2026-10-07T04:45:55.386Z | Firefly Speech does not list Japanese. The Assistant FAQ describes optimized Japanese use for a limited creative conversation, but does not explicitly guarantee Japanese generated text or speech output. Partner-model help also does not state Japanese output within Firefly. Japanese prompt input and UI are separate confirmed facts. |
| platform:windows | S1, S3, S4 | 2026-10-07T04:45:55.386Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone windows application/extension for Adobe Firefly. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:macos | S1, S3, S4 | 2026-10-07T04:45:55.386Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone macos application/extension for Adobe Firefly. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:linux | S1, S3, S4 | 2026-10-07T04:45:55.386Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Adobe Firefly. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S4 | 2026-10-07T04:45:55.386Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for Adobe Firefly. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:text | S1, S3, S2, S5, S8 | 2026-10-07T04:45:55.386Z | Official product and feature/help sources were checked for the controlled text capability. They do not explicitly establish this specific feature within Adobe Firefly; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:coding | S1, S3, S2, S5, S8 | 2026-10-07T04:45:55.386Z | Official product and feature/help sources were checked for the controlled coding capability. They do not explicitly establish this specific feature within Adobe Firefly; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:research | S1, S3, S2, S5, S8 | 2026-10-07T04:45:55.386Z | Official product and feature/help sources were checked for the controlled research capability. They do not explicitly establish this specific feature within Adobe Firefly; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### Runway — 7 unknown

- S1 — official_product / product — [官方资料](https://runway.com/)
- S2 — official_pricing / pricing — [官方资料](https://runway.com/pricing)
- S3 — official_docs / docs — [官方资料](https://help.runwayml.com/hc/en-us/articles/24342920074131-What-languages-can-I-prompt-in)
- S4 — official_blog / docs — [官方资料](https://runway.com/news/runway-is-coming-to-japan)
- S5 — official_docs / docs — [官方资料](https://help.runwayml.com/hc/en-us/articles/15913840746003-Mobile-device-compatibility)
- S6 — official_docs / docs — [官方资料](https://help.runwayml.com/hc/en-us/articles/52807980690323-Creating-with-Ad-Localization)
- S7 — official_docs / docs — [官方资料](https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent)
- S8 — official_docs / docs — [官方资料](https://docs.dev.runwayml.com/)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:windows | S1, S3, S5 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone windows application/extension for Runway. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:macos | S1, S3, S5 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone macos application/extension for Runway. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:linux | S1, S3, S5 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Runway. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S5 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for Runway. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:coding | S1, S3, S2, S8 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled coding capability. They do not explicitly establish this specific feature within Runway; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:search | S1, S3, S2, S8 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled search capability. They do not explicitly establish this specific feature within Runway; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:research | S1, S3, S2, S8 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled research capability. They do not explicitly establish this specific feature within Runway; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### ElevenLabs — 7 unknown

- S1 — official_product / product — [官方资料](https://elevenlabs.io/ja)
- S2 — official_pricing / pricing — [官方资料](https://elevenlabs.io/pricing)
- S3 — official_docs / docs — [官方资料](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- S4 — official_docs / docs — [官方资料](https://elevenlabs.io/docs/ja/help-center/other/does-eleven-labs-have-an-official-app)
- S5 — official_product / product — [官方资料](https://apps.apple.com/jp/app/elevenlabs-ai-voice-generator/id6743162587)
- S6 — official_docs / docs — [官方资料](https://elevenlabs.io/docs/eleven-creative/playground/image-video)
- S7 — official_docs / docs — [官方资料](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- S8 — official_docs / docs — [官方资料](https://elevenlabs.io/docs/eleven-agents/customization/integrations/slack)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:windows | S1, S3, S4 | 2026-10-07T04:42:40.392Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone windows application/extension for ElevenLabs. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:macos | S1, S3, S4 | 2026-10-07T04:42:40.392Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone macos application/extension for ElevenLabs. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:linux | S1, S3, S4 | 2026-10-07T04:42:40.392Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for ElevenLabs. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S4 | 2026-10-07T04:42:40.392Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for ElevenLabs. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:coding | S1, S3, S6 | 2026-10-07T04:42:40.392Z | Official product and feature/help sources were checked for the controlled coding capability. They do not explicitly establish this specific feature within ElevenLabs; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:search | S1, S3, S6 | 2026-10-07T04:42:40.392Z | Official product and feature/help sources were checked for the controlled search capability. They do not explicitly establish this specific feature within ElevenLabs; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:research | S1, S3, S6 | 2026-10-07T04:42:40.392Z | Official product and feature/help sources were checked for the controlled research capability. They do not explicitly establish this specific feature within ElevenLabs; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |

### Notion AI — 3 unknown

- S1 — official_product / product — [官方资料](https://www.notion.com/ja/product/ai)
- S2 — official_pricing / pricing — [官方资料](https://www.notion.com/ja/pricing)
- S3 — official_docs / docs — [官方资料](https://www.notion.com/ja/help/notion-ai-faqs)
- S4 — official_docs / docs — [官方资料](https://www.notion.com/ja/help/change-your-language)
- S5 — official_product / product — [官方资料](https://www.notion.com/en-gb/product/ai/use-cases/translate-your-content)
- S6 — official_docs / docs — [官方资料](https://www.notion.com/help/category/notion-ai)
- S7 — official_docs / docs — [官方资料](https://www.notion.com/help/notion-for-desktop)
- S8 — official_docs / docs — [官方资料](https://www.notion.com/en-gb/help/notion-for-mobile)
- S9 — official_docs / docs — [官方资料](https://www.notion.com/ja/help/web-clipper)
- S10 — official_product / product — [官方资料](https://www.notion.com/startups)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:browser_extension | S1, S3, S7, S8, S9 | 2026-10-07T04:12:10.470Z | Official Web Clipper help describes saving pages into Notion and opening the workspace. It does not establish Notion AI execution inside the browser extension; availability of a host-product clipper is not proof of an AI extension. |
| capability:video_generation | S1, S3 | 2026-10-07T04:12:10.470Z | Official product and feature/help sources were checked for the controlled video_generation capability. They do not explicitly establish this specific feature within Notion AI; unrelated vendor products, generic model abilities and unverified third-party extensions are not attributed to it. |
| capability:api | S1, S3 | 2026-10-07T04:12:10.470Z | Official Notion AI and developer documentation distinguish content/worker integration from AI inference. They do not establish a public Notion AI inference API; the general Notion content API cannot be assumed to offer this Product capability. |

### Dify — 7 unknown

- S1 — official_product / product — [官方资料](https://dify.ai/ja)
- S2 — official_pricing / pricing — [官方资料](https://dify.ai/ja/pricing/dify-cloud)
- S3 — official_docs / docs — [官方资料](https://docs.dify.ai/en/quick-start)
- S4 — official_docs / docs — [官方资料](https://github.com/langgenius/dify/blob/main/web/i18n-config/README.md)
- S5 — official_docs / docs — [官方资料](https://docs.dify.ai/en/cloud/use-dify/nodes/llm)
- S6 — official_docs / docs — [官方资料](https://docs.dify.ai/en/cloud/use-dify/nodes/code)
- S7 — official_pricing / pricing — [官方资料](https://dify.ai/pricing)
- S8 — official_docs / docs — [官方资料](https://github.com/langgenius/dify/blob/main/api/controllers/web/audio.py)
- S9 — official_docs / docs — [官方资料](https://github.com/langgenius/dify-official-plugins/blob/main/tools/openai/README.md)

| Field | Official sources checked | checkedAt (UTC) | reasonStillUnknown |
| --- | --- | --- | --- |
| platform:ios | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone ios application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:android | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone android application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:windows | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone windows application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:macos | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone macos application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:linux | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone linux application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| platform:browser_extension | S1, S3, S7 | 2026-10-07T04:12:10.470Z | Official product, download and help sources document the available surfaces, but do not explicitly confirm or deny a standalone browser_extension application/extension for Dify. Web/PWA, CLI and host-product integrations are not silently treated as that native surface. |
| capability:video_generation | S1, S3, S5, S6, S9, S8 | 2026-10-07T04:12:10.470Z | Official Dify core workflow, model and pricing documentation do not establish a built-in video generator. Deploying a third-party tool workflow is not proof of universal video generation. |

**最终：Launch Fact Completeness Gate READY。仅本地 Release Candidate 收尾完成；停止，不部署 Production，不自动进入 Phase 9。**
