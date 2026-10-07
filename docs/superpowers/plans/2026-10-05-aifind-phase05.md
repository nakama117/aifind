# AIFIND Phase 0.5 — Baseline Hardening / Brand Cutover

日期：2026-10-05。范围：仅本次 Phase 0.5；未开始 Phase 1。

**结论：代码范围内修正已完成；整体验收为 PARTIAL。** 新增回归、typecheck、Web build/tests、smoke 均 PASS；完整数据库套件 FAIL，不能宣称全部验收通过或已可生产上线。

本轮先读取 AGENTS.md、architecture/customize、Master Spec 与 Phase 0 报告，按当前脏工作树修改。采用 Superpowers 的系统化调试、先失败后修复及完成前核验流程。以下均为本轮新结果；历史验收 JSON/Phase 0 文档没有重写。

## A. 修改摘要

31 个现有文件局部修改；新增 7 个测试文件与本报告。没有新增数据库 migration、业务表、依赖或服务。

| 范围 | 实际修改文件 | 原因与行为 |
|---|---|---|
| 品牌配置 | [site/site.ts](D:/Projects/aihot/site/site.ts)、[site/brand/Logo.tsx](D:/Projects/aihot/site/brand/Logo.tsx) | 名称、日文读音、两条标语、组织名称与 crawler identity；Wordmark 读取 SITE.name；取消公开页脚的 AIHOT 框架名称。复用既有独立图形、颜色与字体。 |
| 品牌文本与历史 | [site/pages/terms.md](D:/Projects/aihot/site/pages/terms.md)、[site/pages/privacy.md](D:/Projects/aihot/site/pages/privacy.md)、[site/changelog.json](D:/Projects/aihot/site/changelog.json)、[README.md](D:/Projects/aihot/README.md) | 条款/隐私只替换品牌；追加本次更名记录，保留旧发布记录；README 只改当前项目标题。 |
| 公开元数据 | [apps/api/src/routes/mcp.ts](D:/Projects/aihot/apps/api/src/routes/mcp.ts)、[site/public/openapi-v1.json](D:/Projects/aihot/site/public/openapi-v1.json) | MCP 增加 SITE.name 显示标题，保留协议 name/工具前缀；OpenAPI 给 5 处 publishedAt 补充精度限制说明，字段与类型不变。 |
| 模型榜 Tokyo 业务日期 | [modules/model-leaderboard/backend/admin.ts](D:/Projects/aihot/modules/model-leaderboard/backend/admin.ts) | 共享日期校验使用 tokyoDate(new Date())，价格/上下文/汇率三入口一起修复；没有新增固定 +9 小时拼接。 |
| 模型榜品牌与日期显示 | [modules/model-leaderboard/backend/agent.ts](D:/Projects/aihot/modules/model-leaderboard/backend/agent.ts)、[modules/model-leaderboard/server.ts](D:/Projects/aihot/modules/model-leaderboard/server.ts)、[modules/model-leaderboard/web/page.tsx](D:/Projects/aihot/modules/model-leaderboard/web/page.tsx)、[modules/model-leaderboard/web/format.ts](D:/Projects/aihot/modules/model-leaderboard/web/format.ts)、[modules/model-leaderboard/verification/check-publication.mjs](D:/Projects/aihot/modules/model-leaderboard/verification/check-publication.mjs) | 去掉模块文案中的过渡品牌；出典公开日、评测日、上下文核验日按日展示，集计与抓取确认保留时分；调整当前核验脚本，历史 JSON 证据不改。页面归入 More 的 tab。 |
| 次级导航 | [modules/model-leaderboard/web.tsx](D:/Projects/aihot/modules/model-leaderboard/web.tsx)、[modules/codex-monitor/web.tsx](D:/Projects/aihot/modules/codex-monitor/web.tsx) | 模块合并到现有侧栏「データ」区；删除模型榜的手机一级 tab 配置，保留 routes/admin/tools/Agent 与所有数据。 |
| Prompt 与 whitelist | [industry/prompts/content-understanding.md](D:/Projects/aihot/industry/prompts/content-understanding.md)、[industry/prompts/rules-self-contained-title.md](D:/Projects/aihot/industry/prompts/rules-self-contained-title.md)、[packages/backend/src/editorial/writing.ts](D:/Projects/aihot/packages/backend/src/editorial/writing.ts) | JSON 和标题输出示例换成日语；理解 prompt 使用现有 ENTITY_TAGS 模板填充，与结构化 prompt 一致。不改评分体系、数字或实体目录。 |
| 新闻详情与机器正文日期 | [apps/web/app/lib/format.ts](D:/Projects/aihot/apps/web/app/lib/format.ts)、[apps/web/app/routes/item.tsx](D:/Projects/aihot/apps/web/app/routes/item.tsx)、[packages/backend/src/publication/agent.ts](D:/Projects/aihot/packages/backend/src/publication/agent.ts)、[packages/backend/src/publication/detail.ts](D:/Projects/aihot/packages/backend/src/publication/detail.ts) | 无精度记录的 news 来源日期保守显示为自然日，去掉伪小时/相对小时；预览、详情、HTML time、NewsArticle JSON-LD、Agent 与 Markdown 一起处理。 |
| 其他新闻日期出口 | [apps/web/app/features/feed/Timeline.tsx](D:/Projects/aihot/apps/web/app/features/feed/Timeline.tsx)、[apps/web/app/features/feed/FeedItem.tsx](D:/Projects/aihot/apps/web/app/features/feed/FeedItem.tsx)、[apps/web/app/features/feed/DayList.tsx](D:/Projects/aihot/apps/web/app/features/feed/DayList.tsx)、[apps/web/app/features/feed/ReadingGroup.tsx](D:/Projects/aihot/apps/web/app/features/feed/ReadingGroup.tsx)、[apps/web/app/routes/story.tsx](D:/Projects/aihot/apps/web/app/routes/story.tsx)、[apps/web/app/routes/starred.tsx](D:/Projects/aihot/apps/web/app/routes/starred.tsx) | 回填/不确定分组锚点标为「日付のみ」；相关报道、事件源日期和收藏来源日期按日显示。实时收录时间、摘要生成时间等实际时刻保留精度。 |
| 本机启动提示 | [scripts/preview.ts](D:/Projects/aihot/scripts/preview.ts)、[scripts/serve-local.ts](D:/Projects/aihot/scripts/serve-local.ts) | 控制台名称读取 SITE.name，保持原安全启动行为。 |

新增回归文件：

- [modules/model-leaderboard/tests/admin-tokyo-date.test.ts](D:/Projects/aihot/modules/model-leaderboard/tests/admin-tokyo-date.test.ts)
- [modules/model-leaderboard/tests/date-display.test.ts](D:/Projects/aihot/modules/model-leaderboard/tests/date-display.test.ts)
- [tests/today-editorial-window.test.ts](D:/Projects/aihot/tests/today-editorial-window.test.ts)
- [tests/aifind-brand.test.ts](D:/Projects/aihot/tests/aifind-brand.test.ts)
- [tests/japanese-prompt-contract.test.ts](D:/Projects/aihot/tests/japanese-prompt-contract.test.ts)
- [tests/source-date-presentation.test.ts](D:/Projects/aihot/tests/source-date-presentation.test.ts)
- [apps/web/tests/aifind-baseline-runtime.test.ts](D:/Projects/aihot/apps/web/tests/aifind-baseline-runtime.test.ts)

相对于本轮开始时的真实文件内容，而非 Git HEAD 的独立差异见 [phase05-only.diff](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/phase05-only.diff)。既有日本化工作被纳入基线并保留。

## B. 测试结果

本轮数据库连接限定为 `postgres://postgres@127.0.0.1:55432/aifind_phase05_test` 及测试 harness 创建的独立 `*_test` 克隆。没有连接或修改现有内容库/生产库。

测试启动环境强制 COLLECT_ENABLED=false、MODEL_CALLS_ENABLED=false、FEISHU_*_ENABLED=false、INDEXNOW_SUBMIT_ENABLED=false。本机 .env 的这些值也只做了允许清单核验，全部为 false，文件原有字节未修改。未安装工具或开启真实外部采集、模型、推送、IndexNow；没有启动 worker。

| 项目 | 状态 | 本轮结果/证据 |
|---|---|---|
| 新增后端/格式回归 | PASS | 18/18；[最终回归日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/green-targeted-complete.log) |
| npm run typecheck | PASS | contracts/backend/api/worker/tests/modules/web 全部通过；[日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/typecheck-final-state.log) |
| DATABASE_URL=..._test npm test | **FAIL** | 690 项：591 PASS、87 FAIL、4 CANCELLED、8 SKIPPED；[完整日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/full-database-tests-complete.log) |
| npm run build -w @aihot/web | PASS | 最终前端状态构建通过；[日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/web-build-final-state.log) |
| node --test apps/web/tests/*.test.ts | PASS | 33/33，包括真实 built SSR；[日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/web-tests-final-state.log) |
| node scripts/smoke.ts --base http://localhost:3000 | PASS | 标准 30 项全部通过；[日志](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/smoke.log) |
| 三个旧模块的可访问性 | PASS | /leaderboard、/leaderboard/rules、/leaderboard/sources、/codex-reset、/topics 均 HTTP 200；[隔离 smoke 证据](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/smoke-evidence.json) |
| OG 实图 | PASS | 实际 PNG 已目视核验名称、日文读音、两条标语及 JP 字体；[图](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/og-site.png) |
| 生产发布、真实采集/模型/推送、真实 cron 触发 | UNRUN | 本阶段未执行 |
| 100 条人工 Gold 评分校准 | UNRUN | 留待独立工作，没有用自动测试冒充校准 |
| 旧真实内容库上的历史榜单验收 | UNRUN | 不拿旧 JSON 当本轮结果，也不访问既有内容库重跑历史外部抓取 |

全量套件的明确失败原因包括：

- 多个分析、分组、embedding、翻译与回执测试在进入本地假模型之前被 MODEL_CALLS_ENABLED=false 拒绝；日志直接记录 `Model calls are disabled`。原 tests/setup.ts 默认允许本地假模型，本轮没有改变你的全关阀约束或绕过后端安全阀。
- 8 个 backup-files 测试报 `spawn pg_dump ENOENT`；backup 测试也先落在缺失 dump 工具的失败上。当前命令环境找不到 pg_dump/pg_restore；已运行的 embedded PostgreSQL 目录也不包含这两个客户端工具。没有下载或安装替代运行时。
- 还有间接断言失败、超时、取消和跳过。没有逐项消除，不能把全部失败都假设成可忽略的旧问题。

完整失败清单：[database-failure-summary-complete.json](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/database-failure-summary-complete.json)。最终数据库轮次覆盖最终后端与日期 formatter；随后仅收窄了几个前端出典/核验日期的展示参数，并再次完整执行 typecheck、Web build/tests 和 smoke。

Smoke 使用每次新建的随机 *_test 库，运行后删除该自有临时库、停止临时 API/Web。没有 worker，回执=0、启用信源=0、文章=0。它验证路由和出口，不能代替有真实榜单数据的生产验收。

## C. Tokyo 边界与日报/首页语义

旧缺陷先由实际后台 HTTP 请求锁定：[修改前证据](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/red-confirmed.log)。00:00、08:59:59 和次日午夜错误返回 400；09:00 等 UTC 同日情况原来通过。随后共享校验改为项目已有 tokyoDate helper，[修改后 18 项证据](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/green-targeted-complete.log)。

以下 6 组时刻分别对价格、上下文、FX 检查：Tokyo 当天接受、Tokyo 明天拒绝。每组涵盖 3 个真实后台入口。

| UTC instant | Tokyo clock | 接受 asOf | 拒绝 asOf |
|---|---|---|---|
| 2026-10-04T14:59:59Z | 10/04 23:59:59 | 2026-10-04 | 2026-10-05 |
| 2026-10-04T15:00:00Z | 10/05 00:00:00 | 2026-10-05 | 2026-10-06 |
| 2026-10-04T23:59:59Z | 10/05 08:59:59 | 2026-10-05 | 2026-10-06 |
| 2026-10-05T00:00:00Z | 10/05 09:00:00 | 2026-10-05 | 2026-10-06 |
| 2026-10-05T14:59:59Z | 10/05 23:59:59 | 2026-10-05 | 2026-10-06 |
| 2026-10-05T15:00:00Z | 10/06 00:00:00 | 2026-10-06 | 2026-10-07 |

测试进程 TZ=UTC，答案为手写日历值，不是用被测 helper 生成期望值。没有新加固定 +9 小时字符串补丁。

日报窗口仍为 **[前一天 08:00 JST，当天 08:00 JST)**，未改 composeDaily/report 系统。首页实际读取 /api/site/timeline，不读取日报；当前首页标签仍是「おすすめ」，本阶段没有新建另一套「今日のAI」业务。

实际 API 回归证明：当天 00:00、04:00、07:30 的已发布内容在 JST 07:59:59、08:00、09:00 均出现；Tokyo 自然日计数=3，前一天计数=1，未来内容被排除。日报 dueDaily 在 08:00 切换日期，新闻列表不随之漏掉凌晨内容。因此首页无需改读取实现。

## D. Brand Cutover 与旧模块

公开身份为 **AIFIND（アイファインド）**。主标语：**いま使えるAIが、見つかる。**；补充说明：**AIを知る、比べる、使いこなす。**

下列当前出口已切换或由 SITE 配置自动继承：

- navbar/Wordmark 与 aria 标签、首页 title、description、OG title/site_name。
- 实际 OG 分享图、报告/海报的配置名称与标语。
- Organization/WebSite/Dataset JSON-LD、各页面通过 pageMeta/titled 生成的品牌标题。
- manifest name/short_name/description；RSS feed 的站点名称、描述与链接。
- OpenAPI info、llms.txt 标题/介绍、Agent Markdown、MCP 显示 title 与说明。
- 关于页、条款/隐私品牌名称、模型榜方法文案/Agent/MCP 模块说明、本机启动提示、追加的当前更新记录。
- crawler identity 为 AIFINDBot/1.0；本轮没有真实抓取验证该 User-Agent。

域名继续来自 SITE_URL。用两个独立测试域名及 localhost 验证生成链接，没有在代码中设 aifind.jp。没有使用 AIHOT 的公开名称或 Logo；README 的上游/MIT 归属说明保留。

保留兼容技术标识：MCP 协议 name/工具前缀 aisignaljp、v1 JSON 的 `aihot` 兼容键、@aihot 工作区名、历史数据库名称、*_zh/titleZh 字段。没有因品牌切换破坏已有客户端。历史 changelog 的旧名称与已保存验收 JSON 保留为历史，不作为当前品牌出口。

模型榜和 Codex 进入侧栏「データ」及 /more；模型榜手机一级 tab 删除，其页面归属 More。主题大事记原本为主题详情嵌入区块，没有独立一级模块 tab；原展示、主题入口、admin 与数据保持。新闻引擎的主题目录本阶段未重构。

## E. Known limitations 与待决定事项

1. **整体数据库验收未全绿。** 模型阀全关与原假模型测试默认逻辑存在冲突；缺失备份客户端工具；其余断言/超时需后续独立诊断。不能声称框架所有行为或生产备份恢复已通过。
2. **日期精度尚未入库。** 真实路径为 web-list 的 parseLooseDate/fromHtml/fetchDetail → collectSource → materials/upsert/decideTimeline → publication → 公开页面。ISO 日期示例 2026-10-05 被归一到 UTC 午夜；日本文字日期示例 2026年10月5日按默认 +09:00 归一到 JST 午夜。web 日期原文本/精度没有完整保留下来，不能从旧 timestamp 恢复可靠的时分。
3. 本阶段没有重构 parser、回填旧数据或引入 precision schema。news 来源日、旧事件来源日及模型榜出典/核验日采用保守日显示，即使部分原来源本来有精确时间也暂时收窄；实际收录、集计、抓取确认等可确认时刻仍保留时分。排序与兼容 API/RSS 原 ISO 值仍可能是近似；llms 与 OpenAPI 已明确说明这一点。
4. 模型榜 Arena/VALS/TapTap/Mercor 抓取器还把日期转成 UTC 午夜用于保存，旧数据未重写；网页已不把它伪装成 JST 09:00 的精确出典时间。对应 formatter 先失败后修复：[RED](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/red-leaderboard-date.log)。
5. **未进行 100 条人工 Gold 校准。** taxonomy/已有 Japanese aliases 未扩大；理解与结构化 whitelist 已统一且 alias 回归通过。评分五轴、权重、噪声抑制结构、selection threshold 均未改变。
6. 生产部署、真实日程触发、真实内容/榜单数据验收、正式域名及条款运营者确认仍未在本轮完成。条款与隐私仍保留原草案状态；只更换品牌。
7. Product domain/Admin/Review Queue、公用产品页/SEO、Resolver、Editorial/How-to、Compare、Category/Best、Affiliate、Newsletter、Search、Account/Watchlist/Retention，以及新 CMS/框架/服务均未开始。

品牌和导航选择已有你的确认，没有新的必需品牌决定。若下一轮要求全量测试全部通过，需要先确定如何在「真实运行安全阀全部关闭」约束下安全执行本地假模型测试，并准备可用的 pg_dump/pg_restore；本轮没有擅自改变这个约束、安装工具或扩大测试套件修复范围。

## F. Git Safety

本轮开始保存 806 个 tracked/非 ignored untracked 路径的逐文件 SHA-256、完整 483 条工作树状态、HEAD 与 index hash；修改前为每个改动文件复制当前真实内容。不是以 Git HEAD 或上游旧版覆盖。

本阶段没有 reset --hard、clean、checkout/restore 覆盖、整批恢复、stage/commit、重写迁移、删模块或恢复 SC 字体。

最终复核以 [before-manifest.json](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/before-manifest.json)、[git-safety.json](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/git-safety.json)、[逐文件差异](D:/Projects/aihot/.data/phase05-20261005T173427-249f5541/phase05-only.diff) 为准：

- 31 个原有文件是本阶段局部改动；其修改前备份均与初始 hash 一致。其余 **775 个原有路径字节状态不变**。
- 原有文件丢失数 **0**；所有原有非 ignored untracked 路径保留。
- .env、package-lock、selection/评分 prompt、taxonomy、Sources、Phase 0 报告、Master Spec、JP 字体、SC 字体删除状态及全部 migrations 均保持。
- HEAD 保持 9848e936106db037d99a304887c36aad3fd0fad4；index hash 未变；旧 changelog 发布条目完整保留。
- 新增范围仅 7 个回归测试文件与本报告；ignored .data 里新增本阶段独立备份、日志和临时 smoke 证据，未替换既有内容快照。
- 本阶段已停止，没有自动启动 Phase 1。

