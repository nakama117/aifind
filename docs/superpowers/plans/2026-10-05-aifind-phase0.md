# AIFIND Phase 0 核验与后续实施计划

> **For agentic workers:** 后续实施按阶段使用 superpowers:executing-plans；此文仅完成 Phase 0，不授权执行任何实现任务。复选框只表示待办，不表示本轮已开发。

**Goal:** 以当前仓库、未提交工作和本机只读数据库为依据，明确 AIFIND 的真实起点、差距、保护范围与分阶段验收。

**Architecture:** 保留 TypeScript / React Router SSR / Fastify / PostgreSQL / pg-boss 模块化单体。后续站点专属功能优先放入一个拟新增 modules/aifind 工作区，通过现有模块注册与公共读取出口接入；框架通用缺口只做有明确行为验收的最小扩展。

**Tech Stack:** 本机 Node 24.14.0、npm 11.9.0、PowerShell 7.6.5；锁文件中的 Fastify 5.12.5、postgres 3.4.9、pg-boss 12.34.0、React 19.3.0、React Router 8.4.0、TypeScript 7.0.2。本机内容库 PostgreSQL 17.10；Docker 定义 PostgreSQL 17。

**Spec:** [AIFIND_MASTER_SPEC.md](../../AIFIND_MASTER_SPEC.md)，v1.0.0，2026-10-05；执行边界以用户本轮 Phase 0 指令和当前 AGENTS.md 为准。

## Global Constraints

- 本轮只核验和计划；不开发 Product DB、Compare、How-to、Affiliate 或任何 Phase 1 功能。
- 不 reset/clean，不覆盖既有改动，不升级或安装依赖，不写/运行迁移，不启用采集、模型、推送、发信，不访问生产数据库，不部署。
- 保留 web/api/worker 三个进程和单一 PostgreSQL；不新增 WordPress、Headless CMS、Next.js、Redis、Elasticsearch 或微服务。
- 所有 PowerShell 命令使用 pwsh.exe -NoLogo -NoProfile -Command；已先核验 PowerShell 7.6.5。
- 前端仅经 HTTP 读取 API；模型仅在 worker 中运行；付费请求复用回执和预算熔断。
- 安全阀只有 true 才启用。此次核验命令显式关闭 COLLECT_ENABLED、MODEL_CALLS_ENABLED、FEISHU_CONTENT_PUSH_ENABLED、FEISHU_INTERNAL_ENABLED、INDEXNOW_SUBMIT_ENABLED。
- 公开读取从 packages/backend/src/publication 统一接入；新模块不得自创更宽松的可见性规则；后台/预览必须 no-store。
- 后续新迁移追加编号；已存在、已应用迁移不修改；删数据需另行明确更新说明与授权边界。
- 保留原文语言、机器字段、稳定分类 key 与兼容 API；不能把所有 *_zh/zh 命名机械改成 ja。
- 未知不等于不支持；未知价格不等于免费；厂商、产品、模型、套餐、市场、渠道、语言能力分别建模。
- 使用 Markdown 和受控事实引用，不执行 MDX；草稿指针与发布指针独立；事实更新不能伪造实测/推荐结论更新。
- 阶段顺序固定为用户指定的 11 阶段，优先级高于 Master Spec 中较早的排期示例。
- 仅新增此核验报告；本轮不修改现有代码、配置、Master Spec、迁移或数据。

## Review Focus

1. 东京 00:00–08:59 的人工核验日期与仅日期来源：当天不能被误拒；未知原时区不得静默补成 JST。归属准备项 R1、Phase 1/4。
2. 新产品/教程草稿被编辑或撤回：SSR、JSON、Markdown、MCP、搜索、sitemap、相关推荐都不能读到未发布修订。归属 Phase 1/3/5/10。
3. 管理员开着旧页面、相同任务重复投递或应用中途失败：409、幂等、事务与回执必须一致；不能部分写入或重复付费。归属 Phase 2/4/9。
4. Web/App/API、JP/其他市场、年付/月付混合：不得串用套餐和价格；null 与 0、unknown 与 false 分别显示。归属 Phase 1/3/6。
5. 一个产品价格变化或旧公告重抓：动态事实更新，编辑结论标待复核，tested_at/dateModified 不被抓取时间刷新。归属 Phase 4/5/6/7。

---

## 1. 核验结论与证据边界

**Phase 0 核验已完成；AIFIND 实施准备为 PARTIAL。** 当前是已有较多日本化、运营和三个模块恢复改动的 AI Signal JP 新闻站，尚未成为 Master Spec 中的 AIFIND 产品事实与编辑内容平台。

本次完整读取了 AGENTS.md、README.md、docs/architecture.md、docs/customize.md、docs/deploy.md、docs/AIFIND_MASTER_SPEC.md；另按问题读取实际注册代码、时间/报表/编辑链、公共读取、认证、搜索、SEO、信源、提示词、迁移、测试及已有日本化/上线核验文档。历史日志只用于理解旧工作，不作为本轮通过证明。

比较基线是本地上游来源提交 9848e936106db037d99a304887c36aad3fd0fad4 与当前工作树；没有 fetch 或核实 GitHub 最新提交。因此“已完成的上游差异”指本地已知基线，不能解读为与远端最新版本的差异。

Master Spec 中的历史目录 D:\Projects\AI-Radar-Japan-v01\upstream\AIHOT-9848…、历史 HEAD 6c3ea650…、模块仅有占位等观察，不能套用到本次仓库。本次真实根目录、HEAD、完整模块及本机数据库见下文；本轮不回写或删除 Master Spec 的历史记录。

未联网检查品牌/域名/商标、信源最新条款、联盟资格、模型最新可用性或云端部署；没有访问生产数据库。此文对这些事项只列待确认门禁，不宣称已经获准或上线。

## 2. Git 与既有工作保护

| 项目 | 本轮实际结果 |
| --- | --- |
| 仓库根 | D:\Projects\aihot |
| 分支 | codex/ai-signal-jp |
| HEAD | 9848e936106db037d99a304887c36aad3fd0fad4 |
| origin | https://github.com/KKKKhazix/AIHOT.git |
| 本地 main / origin/main | 85a550f；未刷新远端 |
| 已跟踪改动 | 215 个：212 修改、3 删除 |
| 未跟踪文件 | 267 个；其中 modules 174、docs 47、tests 18 |
| 已暂存改动 | 0 |
| 已跟踪 diff 汇总 | 2225 行新增、2146 行删除；包含文本与二进制品牌改动 |
| 被记录的既有路径 | 805 个 tracked/untracked 非忽略路径，包含被删除文件的 MISSING 状态 |
| 原始索引 SHA-256 | 647cea9c84a71ae8002dc0bf17f59b2c704cdeedaf98c6b161415c9ffd1f4ccf |

Git 所有者检查使用单条命令的 safe.directory=D:/Projects/aihot，未改全局 Git 配置。没有 stage、commit、checkout、restore、reset 或 clean。

以下均属于已有工作，后续不得用上游文件、旧快照或整目录替换覆盖：

| 保护范围 | 当前已存在工作 / 为什么必须保留 |
| --- | --- |
| site/site.ts、site/brand/**、site/pages/**、site/public/openapi-v1.json、site/changelog.json | AI Signal JP 品牌、日语公开文案、报头与图标、条款草稿、Tokyo API 说明；转 AIFIND 必须做受控后续修改 |
| industry/taxonomy.ts、topics.json、sources.json、prompts/** | 日语分类/标签/实体、42 个主题、12 个关闭状态的信源、28 个提示词修改；不能回退到上游示例行业 |
| packages/contracts/src/time.ts、language.ts；editorial/**、reports/**、events/**、publication/** 的既有改动 | JST、日语正文识别、报告日历、自然日和公开出口行为 |
| apps/web/**、apps/api/src/og/**、assets/og-fonts/** | 日语页面、SEO/后台内容改进、OG 日文字体与品牌图；三项旧 SC 字体删除也属于现有改动，不自动恢复 |
| site/models.ts、providers/{llm,receipts,embeddings,openai-cost}.ts、operations/** | 模型默认值、双评分、OpenAI 计费/预算暂停与恢复、备份/告警；不能绕过或删掉 |
| database/migrations/0055_provider_billing_pause.sql、0056_japanese_translation_default.sql | 已存在且本机已经应用的迁移；不是本轮可重新设计的空白文件 |
| modules/model-leaderboard/** | 完整排行榜算法/读取/后台/采集/素材/测试；并非空模块，占 0057/0060 迁移 |
| modules/codex-monitor/** | 完整重置监控、历史、官方采集候选、后台/测试；占 0058/0061 迁移 |
| modules/topic-chronicle/** | 主题大事记、数据、模块页、后台/测试；占 0059 迁移 |
| site/modules/{index,server,web}.ts、site/package.json、package-lock.json、Dockerfile | 三个既有模块的真实注册、依赖及打包清单；不按旧文档删回空清单 |
| .env.example、docker-compose.yml、deploy/**、scripts/{serve-local,preview*,seed-preview,compose-retrospective,backup-now}.ts | 隔离预览、部署、备份、导入与补编流程；不在 Phase 0 执行 |
| evaluation/candidates.*、docs/AIFIND_MASTER_SPEC.md、docs/*-jp*.md、docs/verification/**、.superpowers/** | 样本、既有计划与核验记录；未跟踪不等于可删除 |

被删除的三个已跟踪路径是 assets/og-fonts/LICENSE、noto-sans-sc-400.ttf、noto-sans-sc-700.ttf；替代 JP 字体和 OFL 文件已存在，不能因“恢复缺失文件”而取消此改动。

忽略路径不在上述 805 项 Git 清单中：.env/.env.*、.data/、node_modules/、apps/web/build/、apps/web/.react-router/。它们也不得被清理、重新播种或旧数据覆盖。此次未读取秘密值；类型检查可能刷新忽略的 React Router 类型生成物。没有改写本机内容库。

完整的 482 条原有工作树状态列在附录，供后续精确对照；所有条目均应视为“需要保留并理解”的工作，不能只保护此表中的重点。

## 3. 当前系统架构

### 3.1 进程与职责

| 层 / 实际路径 | 当前职责 |
| --- | --- |
| apps/web | React Router SSR + React 公开站/后台页面；通过 HTTP 调用 API；不直接读库、不持有模型秘密 |
| apps/api | Fastify；公开 JSON/RSS/Markdown/MCP、媒体/OG、站点文件与后台 API |
| apps/worker | pg-boss 队列、采集/模型/编辑/分组/报表/运维任务；所有 cron 注册指定 Asia/Tokyo |
| packages/backend | 来源与文章、分析、事件事实/故事、出版、报表、认证、审计、付费回执/预算、媒体与运维 |
| packages/contracts | DTO、分类/时间/语言/模块契约 |
| industry | 新闻行业知识、分类、提示词、信源种子与评分门槛 |
| site | 品牌、文案、模型、政策、公开文件、三个模块注册列表 |
| modules | 已注册 model-leaderboard、codex-monitor、topic-chronicle；没有 aifind 模块 |

Node 24 直接运行后端 TypeScript；web 单独构建。部署定义为 web/api/worker、一个 PostgreSQL，加 setup 和可选 Caddy；当前不需要更换框架或拆服务。

### 3.2 已核实的扩展点与限制

- 地址/后台页声明：site/modules/index.ts → apps/web/app/routes.ts。现有通用路由会把模块后台页放入原 admin layout，不必复制路由系统。
- 后端与任务：site/modules/server.ts → ServerModule.http / queues / schedules / models / alerts / retention / admin。
- 前端：site/modules/web.ts → WebModule 页面部件、导航/后台展示。
- SEO/机器出口：ServerModule.sitemap、llms、agent，模块 HTTP/MCP 能力可沿用现有注册。
- EngineHooks 目前只有 articleChanged、sourceRepublished、reportsChanged、requestAnswered、exitServed。articleChanged 是公开状态变化；**没有“资料完成入库/分析后”钩子**。后续 Resolver 不能假设该钩子已存在，也不应在读取页面或公开状态变更事务内付费抽取。
- packages/backend/src/publication/scope.ts 的 listed/selected/seated/evidence 条件建立在 publications p、fact_articles fa 上，只适用于新闻。它不是可直接套在未来 af_products 上的通用 SQL。
- 既有模块各有自己的 publication 读取和发布门。AIFIND 必须从核心 publication 读取层接入新的已发布投影，统一撤回/权限与跨出口规则；不能因已有模块出口而放宽这条项目约束。具体通用接口在 Phase 1/3 小范围设计，不整库重构。
- apps/api/src/routes/admin-auth.ts 的 adminHandler 明确执行会话、401、写请求 CSRF/403、no-store、Zod/400、Conflict/409。模块 API 需主动使用这个包装；“路径名叫 admin”本身不会自动获得保护。
- packages/backend/src/audit.ts 的 audit(...,{db:tx}) 可以和业务事务一起写现有 audit_log。Master Spec 允许复用等价能力，因此不机械另建 af_audit_log。
- scripts/migrate.ts 扫描核心及所有模块目录的 SQL，按全局文件名排序并按事务登记 schema_migrations。即使模块没启用，只要 SQL 文件在扫描目录仍可能被迁移。当前最大编号 0061；0062 只是本轮下一候选号，实施时必须重新核验，不能提前占用或写入。

### 3.3 本机数据库只读证据

连接范围限定 README 描述的 127.0.0.1:55432/aisignal_launch，使用 default_transaction_read_only=on 和 repeatable read read only 事务；服务器返回 readonly=on。未读生产 DSN、未运行 migrate、未访问生产。

| 元数据 | 本轮 SELECT 结果 |
| --- | --- |
| 版本 / 表数 / 已应用迁移 | PostgreSQL 17.10 Windows；public 60 个基础表；schema_migrations 58 条 |
| 最新迁移 | 核心 0055/0056；模块 0057–0061 都已应用 |
| 内容计数 | articles 146，publications 146，analyses 171，reports 60，receipts 1012 |
| 日报 / 周报 / 月报 | 43 / 13 / 4；分别最新 2026-10-04 / 2026-W39 / 2026-09 |
| 信源 | 12 个；enabled、site_fulltext、syndicate_fulltext 全部 false |
| 持久定时配置 | pgboss.schedule 16 条；timezone 全部 Asia/Tokyo |
| AIFIND 领域表 | 没有 af_* 表 |

这些是本机快照计数，不证明真实性审核、正式运营、worker 正在运行或生产健康。持久 cron 中仍有采集/推送类任务名称，也不能仅凭存在就断言已启用；安全阀与 worker 当前运行状态需在实施/上线时分别核验。

重要的真实表映射：

| Master Spec 领域 | 可复用真实表 / 能力 | 仍需新增或限定 |
| --- | --- | --- |
| 原始来源/新闻 | sources、articles、article_revisions、article_discoveries | 不重复新建一套新闻库 |
| 新闻事件关联 | facts、fact_articles、stories、story_* | 当前 facts 是新闻事件事实，不是受控产品功能/套餐/渠道事实 |
| 字段证据 | 原始文章/修订可作为 source_document 参照 | 缺少 af_evidence 所需字段定位、权利状态、字段到证据关联 |
| 产品/厂商/套餐/价格 | lb_models、lb_prices、lb_aliases、fx_rates 仅供模型榜 | 不能冒充 consumer 产品、市场、Web/App/API 套餐与功能事实模型 |
| 草稿/发布修订 | article_revisions、report_revisions、editorial_overrides 有新闻用途 | 缺少产品与人工编辑文档独立 draft/published 指针 |
| 后台安全/审计 | admin_users、admin_sessions、audit_log | 新功能复用包装和事务审计，补自己的权限/状态测试 |
| 付费/运行/预算 | receipts、receipt_attempts、budgets、provider_pauses、job_runs | 新 Detector 复用，不直连模型供应商 |
| 通知/投递 | deliveries、delivery_leases、notify_targets | 当前面向既有推送，不等于 Newsletter 订阅/退订服务 |
| 运维保留 | retention 任务、模块 retention 插口 | 不是读者 watchlist/账号/成本工具 |

## 4. 已完成的日本化与当前真实配置

| 项目 | 已核实状态与依据 |
| --- | --- |
| 品牌 | site/site.ts 为 AI Signal JP；organization 同名；locale=ja-JP；标语 注目のAI動向；mcpPrefix=aisignaljp、crawlerName=AISignalJPBot/1.0 |
| Logo/素材 | site/brand/Logo.tsx 第 9 行字标仍硬编码 AI Signal JP；SVG/图标/日报周报月报报头已有修改；OG 改用 Noto Sans JP |
| 公共文案 | 首页、全部动态、热点、文章、故事、日/周/月报、主题、搜索、收藏、关于、反馈和错误界面已有日语修改；后台和工程文档多处保留中文 |
| 分类 | 6 个稳定 key：ai-models、ai-products、industry、paper、tip、opinion；日语标签/报告分节，7 个内容类型保留 |
| 标签/实体 | 日语类别/主题标签；增加 Sakana AI、PFN/PLaMo、GENIAC、RIKEN AIP、Amazon/AWS；保留中文旧标签与机构别名映射 |
| 主题 | industry/topics.json 有 42 个主题，company/field/genre 三组；这不是产品用途分类目录 |
| Prompts | industry/prompts 下 28 个 Markdown 提示词，全部有日语输出要求；JSON key、枚举、原文引用保持原格式 |
| 评分 | 保留七类内容、五维加权、噪声、安全边界；T1=60、T1_5=65、T2=76，understandFloor=50；未凭感觉改变门槛 |
| 模型配置 | site/models.ts 定义多供应商预设；各默认编辑步骤和 codexMonitor 选 gpt-6-luna。运行时可由环境/后台覆盖；此次未读秘密、未调用模型，不能推断实际供应商可用性 |
| 正文语言 | 新默认语言 ja；Japanese copy 检查、原文语言 metadata 与日语翻译读取已接入；0056 迁移已应用，保留旧 zh 历史记录 |
| API/机器出口 | OpenAPI 日/周/月报说明改为 Tokyo；RSS、Agent Markdown、llms 输出已有日语/Tokyo 更新；ISO Z 时刻保留为标准 UTC 表示 |
| 后台/运营 | 内容列表/编辑、SEO、模型费用暂停、预览隔离、备份/恢复部署脚本与相关测试已有大量工作，不全属于翻译但必须一起保留 |
| 既有模块 | 模型榜、Codex 重置监控、主题大事记完整恢复注册，不能依 Master Spec 历史占位描述删掉 |

保留 titleZh、summaryZh、*_zh、bodyMode=zh 等兼容命名，并不代表当前内容仍输出中文。应按真实语言元数据和渲染判断，不能用字段名得出语言缺陷。

仍有两个提示词一致性风险：content-understanding.md 的示例 JSON 中 titleZh/summaryZh/editorialJudgment 仍为中文；其中硬编码实体白名单没有包含 taxonomy 新增的日本实体。均是静态可见的指令冲突/遗漏，尚未用新人工标注样本验证输出影响，不宣称模型已出错。

evaluation/candidates.jsonl 共有 100 条；本轮检查 human 与 resultReview 没有已填写记录。已有日本化回归并不能证明评分门槛经过日语人工样本校准，不应调整数值直到负责人提供/确认标注和验收标准。

### 4.1 信源清单

| 类型 | 实际种子及本机数据库登记 |
| --- | --- |
| 7 个 RSS | OpenAI News、Google DeepMind、Hugging Face、Microsoft Research、NVIDIA Blog、AWS ML、GitHub AI |
| 5 个网页列表 | Anthropic、Sakana AI、Preferred Networks、GENIAC、RIKEN AIP |
| 启用/全文/公开模式 | 全部 enabled=false、site_fulltext=false、syndicate_fulltext=false，participation_mode=editorial |
| 初始采集设置 | T1、interval 60 分钟、min_initial_backfill 8 |
| 网页原时区 | Anthropic 配置 +00:00；其余四个配置 +09:00 |

种子写入使用 ON CONFLICT DO NOTHING；修改 sources.json 不会覆盖已有后台字段，也不会自动删库内旧信源。这次代码清单与本机登记均为 12 个，但以后必须分别核验。

docs/source-review.md 记录的是既有来源复核，不是本轮最新版权授权证明。抓取成功与允许保存/公开摘要或全文分别判断；必须由负责人确认要监测的来源与使用边界。Master Spec 所需的 20–30 个官方更新/帮助/价格/日本入口仍需后续登记，不能把现有 RSS 当成完整产品价格监控。

## 5. Asia/Tokyo 完整性核验

**核心新闻链已覆盖 JST；全仓库完整覆盖结论为 PARTIAL。**

| 范围 | 本轮判断 | 实际依据 / 限制 |
| --- | --- | --- |
| worker cron | 静态与持久配置 PASS | schedules.ts 注册 boss.schedule 指定 tz:Asia/Tokyo；本机 16 条 schedule 全部同值；未观察真实定时触发 |
| 自然日 | 核心 helper 与新闻列表 PASS | contracts/time.ts 固定 +09，tokyoDate/tokyoMidnight；publication/timeline 使用东京日边界；边界探针通过 |
| 日报 | 核心规则 PASS；不是午夜自然日窗口 | composeDaily 的窗口是 [前一日 08:00,当日 08:00) JST，dueDaily 当日 08:00 生效 |
| 周报/月报 | 核心规则 PASS | ISO 周/自然月标签；周一 10:00 发布上一已完成周，1 日 10:30 发布上一完成月；由日报汇总，保留其 08:00 截止语义 |
| editorial 上下文 | 静态覆盖 PASS | scoreInputTime、input.buildMaterial、writing 的日期上下文使用 Tokyo/+09；实际模型结果未调用验证 |
| API/OpenAPI | 报表说明 PASS；模块文档 PARTIAL | 核心说明 Tokyo；时刻 ISO Z 正确；当前 OpenAPI 未包含已恢复模块 leaderboard/codex 的路径，不能称整个公开接口说明完整 |
| 前端日期 | 常用新闻/报表/热图/后台 PASS；边角 PARTIAL | shared format 指定 Tokyo；Codex DTO 转 JST 后截日期、排行榜格式指定 Tokyo；个别 UTC 日期仍存在 |
| 排行榜后台核验日期 | FAIL，已复现 | admin.ts 第 20 行按 new Date().toISOString().slice(0,10) 限制未来日期；东京 00:00–08:59 拒绝东京当天 |
| 来源仅日期/无时区 | PARTIAL | ISO YYYY-MM-DD 转 UTC 午夜；YYYY/MM/DD 按来源 offset 午夜；无显式 offset 默认 +09；尚不满足保留纯日期/未知原时区的完整语义 |
| 计费月边界 | 明确的不同规则，保留 | openai-cost.ts 用 UTC 自然月，operations-zh.md 已说明；不得未经决策顺手改为 JST |

日期问题的只读复现：
在 2026-10-04T15:00:00Z（东京 10 月 5 日 00:00），调用实际 saveLeaderboardFx 并提交 asOf=2026-10-05，Zod 在进入 SQL 事务前拒绝“不能使用未来的核验日期”。探针使用失效的本地测试 DSN、关闭全部安全阀，未执行数据库写入。受同一 dateSchema 影响的 price/context 日期也应列入后续回归。

来源日期解析的实际结果：

| 输入与来源 offset | parseLooseDate 结果 |
| --- | --- |
| 2026-10-05，+09:00 | 2026-10-05T00:00:00.000Z |
| 2026/10/05，+09:00 | 2026-10-04T15:00:00.000Z |
| 2026-10-05 09:00，无 offset 参数 | 2026-10-05T00:00:00.000Z（默认按 JST） |

前两项保留了本地日标签，但合成时刻不同；后续若用于精确时间排序/日报窗口/产品生效时刻，不能当作来源已明示的 instant。未来字段应区分 date 与 timestamptz/精度；不回填改写历史数据。

低风险 UTC 残留：收藏导出文件名（routes/starred.tsx）和 site/stats.ts 的轮换样本种子按 UTC 日。selectbench 的 UTC run ID 是技术标识；旧函数名 bj 的实现已是 Tokyo。0001_core.sql 的 Shanghai 注释属于历史迁移，不修改。测试里的 +08:00 原始来源输入属于合法测试，不应盲删。

**不能误判：** compose.ts 的 +8 小时表达式代表东京早上 08:00，并非残留北京时间偏移；纯日期的 addDays/ISO 周算法内部使用 UTC 算术也不等于采用 UTC 业务自然日。

## 6. Master Spec 与现状差距矩阵

DONE = 当前已有基础；PARTIAL = 可复用部分但未满足目标；MISSING = 当前没有目标功能；DEFERRED = 按要求后置。

| Master Spec 目标 | 当前实装 | 差距 / 推荐归属 |
| --- | --- | --- |
| AIFIND 品牌、日本定位与政策 | AI Signal JP；日语公开界面；运营者/联系空，terms/privacy 是草稿 | PARTIAL；负责人确认后在 Phase 3 做受控品牌/政策更新，不覆盖旧文案记录 |
| 模块化单体、HTTP 边界、费用安全 | 当前架构符合；回执/预算/CSRF/审计可复用 | DONE 基础；新功能必须补跨出口/事务验收 |
| 全面 JST 与时间语义 | 核心链 Tokyo；后台 UTC 校验、来源 date-only/unknown 仍有风险 | PARTIAL；R1/Phase 1/4，沿用 UTC 计费月既定约定 |
| Vendor/Product/Model/Plan/Channel/Market | 新闻实体和 lb_models 存在；无 af_* 表 | MISSING；Phase 1，不把模型榜扩成所有产品表 |
| typed facts / unknown / 价格组件 | 新闻 facts、榜单 token 价格 | MISSING；Phase 1，decimal、渠道/地区、免费/未知分离 |
| 字段证据、权利、精度与出处定位 | 原始文章/修订存在 | PARTIAL；新增 af_evidence/字段关联，原文库复用，Phase 1/4 |
| 产品不可变修订与独立发布指针 | 新闻/报告修订，非产品修订 | MISSING；Phase 1/2 |
| Product Admin / Review Queue | 现有新闻编辑、审计、模型榜审核 | PARTIAL 基础；Product 管理、差异审核、409/幂等原子应用缺失，Phase 2 |
| Product 公开页、分页、来源与日本条件 | /products 不存在 | MISSING；Phase 3，SSR 和所有公共出口只读发布版 |
| 20–30 优先监测来源 | 12 个关闭的官方新闻种子 | PARTIAL；Phase 4，负责人决定目标来源/许可，不先扩量 |
| Product Resolver / Change Detector | 新闻公司别名、事件分组、模块专项采集 | MISSING；没有受控产品消歧、价格/帮助页变化抽取、字段级候选，Phase 4 |
| 生效/抓取/核验/实测分离与重验提示 | 新闻时间和报告修订有基础 | MISSING 产品语义；Phase 4/5/6，不用重新抓取刷 dateModified |
| Editorial / How-to | 采集新闻 tip/opinion，不是自研实测教程 | MISSING；Phase 5，Markdown、媒体、测试记录、草稿/发布/撤回 |
| Compare | 模型排行榜存在 | MISSING；Phase 6，2–3 产品同任务/版本/套餐对比；不能把榜单等同 Compare |
| Category / Best / alternatives | /topics 与新闻分类存在 | MISSING；Phase 7，用途编辑页与可追溯依据；无测量不伪造排名 |
| Affiliate /go / tracking | 没有目标外链产品模型/路由 | MISSING；Phase 8，项目许可、目的白名单、官方回退、机器人不计点击 |
| Newsletter | 周报网页/RSS、Feishu 推送 | MISSING；Phase 9，外部订阅/退订权威、测试/发送授权、幂等 |
| Search | /all?q= 新闻搜索、LIKE/pg_trgm、主题/实体匹配 | PARTIAL；无 /search、NFKC 产品别名/跨内容排序/日语查询验收，Phase 10 |
| SEO 与全出口撤回 | canonical/JSON-LD/sitemap/预览 noindex 已有 | PARTIAL；新内容路由与修订发布时间缺失，需测分页/撤回与缓存，Phase 3/5/10 |
| 公开缓存 ≤5 分钟，关键价格 ≤60 秒 | 各读取缓存不同；sitemap fresh 5 分钟但可 stale 60 分钟并留 last-good | PARTIAL；不能把 freshMs 当最大撤回时延；Phase 3 定义并实测新内容缓存上限 |
| 媒体资产/授权/alt/实测截图 | 抓取图、renditions/imgproxy/持久目录、备份基础 | PARTIAL；缺编辑资产元数据/权利/脱敏链，Phase 5 |
| 小型发布 outbox | pg-boss/投递记录已有特定用途 | MISSING 产品发布记录；Phase 1/2，发布事务内写，后续只接实际消费者 |
| 备份恢复、公开环境隔离、回归 | 有部署/备份/restore-check/预览门禁和历史日志 | PARTIAL 本轮证据；本轮未重跑 Linux/Docker/S3/完整恢复/生产 smoke |
| Watchlist/读者账户/Selector/成本工具 | 浏览器收藏已有，不是账户或 watchlist | DEFERRED；Phase 11 仅在真实需求与维护能力通过后启用 |
| V1 数量与真实质量闭环 | 没有已审核的 AIFIND 产品/比较/实测教程 | MISSING；阶段完成后再验收 8–12 产品、3 比较、6 教程、3 用途页，合成数据不充当真实内容 |

### 6.1 复用 / 新增 / 最小核心改动

| 类型 | 位置与约束 |
| --- | --- |
| 直接复用 | web SSR、模块 page/adminPage 注册、adminHandler、audit(db:tx)、sql/事务、pg-boss、receipts/budgets/provider pause、原始 sources/articles、媒体基础、SEO helper、Tokyo helper |
| 站点专属新增（目前不存在） | modules/aifind 内 catalog、contracts、changes、editorial、commercial、publication、admin、migrations、tests；分阶段新增，不在 Phase 0 搭架子 |
| 受控接入改动 | site/package.json、site/modules 三清单、Dockerfile/package-lock 工作区登记；只在功能需要时改，保留三个旧模块 |
| 最小通用扩展候选 | packages/backend/src/publication 的非新闻发布读取入口与一致撤回策略；Phase 4 的资料 ready 事件/队列插口；必须先有明确测试与调用方 |
| 不采用 | 复制 news/sources/facts 作为产品库；复制 auth/audit/paid provider；用读请求触发模型；拆服务/再建 CMS；大规模字段重命名 |

## 7. 后续阶段与独立交付边界

以下全为计划，尚未创建所列新路径。现有路径标“接入”；modules/aifind 下路径全部为“拟新增”。每阶段单独形成详细执行计划/审阅结果，不一次性实施整个 Master Spec；每个功能先写有意义的失败测试，再最小实现、运行验收，提交只包含本阶段新改动，禁止 git add -A 纳入已有工作。

### R1. Phase 0 后的准备修复候选（不算本轮实施）

- [ ] 用固定时钟测试复现排行榜 price/context/fx 在 JST 00:00 与 08:59 的当天验证；最小修复共享 dateSchema，不动已有价格、汇率或记录。
- [ ] 在不改变评分结构/门槛的情况下，统一 content-understanding 示例输出语言和日本实体白名单；补提示词静态一致性检查，人工样本验收后才改变生成策略。
- [ ] 明确来源“仅日期 / 已知 offset / 未知时区”的策略，先测试现有解析差异；新产品证据支持精度，不自动重解释或回填旧文章。
- [ ] 核对恢复模块的 OpenAPI/MCP 文档覆盖，补文档/契约回归；保留接口和 mcpPrefix，品牌相关改名另受发布兼容决策约束。

涉及现有文件：modules/model-leaderboard/backend/admin.ts 及 tests/admin.test.ts；industry/prompts/content-understanding.md、industry/taxonomy.ts；packages/backend/src/sources/web-list.ts 与 tests/web-list-date.test.ts；site/public/openapi-v1.json、模块 api/contracts。修复需后续授权，本轮没有改动。

### Phase 1 — Product domain

**范围：** 产品身份、套餐/价格、受控功能事实、证据、不可变修订、草稿/发布指针及原子发布记录；先形成一个合成产品闭环，不增加公共页面/后台 UI。

**文件/模块：** 拟新增 modules/aifind/package.json、catalog/{schema,products,plans,facts,revisions}.ts、contracts/catalog.ts、publication/catalog.ts、migrations/下新编号 SQL、tests/{catalog,product-revisions,product-publication}.test.ts。按实际接入需要新增 module.ts/server.ts；接入 site/package.json、site/modules/{index,server}.ts、Dockerfile、锁文件；核心 publication 只加新公开读取入口。不用预先创建空编辑/商业子模块。

**接口边界：** saveProductDraft(input,actor,expectedRevision) 返回 productId/draftRevisionId；publishProduct(productId,draftRevisionId,actor,expectedRevision) 返回 publishedRevisionId；readPublishedProduct(slug,now) 返回发布 DTO 或 null。DTO 与校验只在新 contracts 定义；金额输出 decimal 字符串；不存在值用带 knowledge_state/price_state 的 null。新闻 source_document 引用真实文章/修订；新表默认 UUID，已有 FK 按原表类型，不硬改旧主键。

- [ ] 先定义并运行 catalog_unknown_is_not_false、price_null_is_not_zero、web_app_prices_are_independent、annual_price_keeps_commitment、draft_does_not_change_public_revision 失败测试。
- [ ] 最小领域和迁移实现；发布时同事务写事实/修订/指针、复用 audit_log、写 af_publish_outbox；不新增未使用表，不重建 af_audit_log。
- [ ] 在新建隔离 *_test 库迁移并运行上面测试，注入中途失败确认全回滚；检查本机/生产旧库未改变。

**验收：** T01/T02/T03/T08/T19/T23/T28；一个合成产品有明确 vendor、plan、market、channel、字段证据，发布后新草稿不会污染公开 DTO。不以 lb_prices 代替套餐模型。

### Phase 2 — Product Admin / Review Queue

**范围：** 人工建立/编辑/预览/发布/撤回产品，人工录入候选的差异、证据、批准并应用/拒绝/冲突；自动 Detector 留给 Phase 4。

**文件/模块：** 拟新增 admin/{products,review-queue}.ts、admin/api.ts、changes/{candidates,apply}.ts、contracts/review.ts、admin/web/{products,product-edit,review-queue}.tsx、tests/{product-admin,review-queue,candidate-apply}.test.ts；接入 module.ts/server.ts/web.tsx 和 site/modules/web.ts，沿用现有 admin layout/adminHandler。

**接口边界：** proposeProductChange(productId,baseRevisionId,allowedPatch,evidence,idempotencyKey) 返回 candidateId/state；applyCandidate(candidateId,baseRevisionId,actor,reason) 返回 appliedRevisionId 或 Conflict；rejectCandidate(...) 写理由并保留证据。状态仅 detected/pending_review/applied/rejected/conflict；无 approved-but-unapplied 长期状态。

- [ ] 先测试 anon=401、缺 CSRF=403、preview no-store、旧 baseRevision=409、重复 apply 只一条变更与审计、中途失败全回滚。
- [ ] 完成最小表单和同事务应用；复用 Phase 1 的发布命令，禁止 UI 绕过事实校验。
- [ ] API 注入测试与浏览器走通一例完整人工候选；旧新闻/榜单/Codex/大事记后台回归。

**验收：** T04/T06/T07/T08/T10/T17/T23；管理员可从证据审阅到原子应用；冲突时线上事实不变，成功后生成修订/变更日志/outbox。

### Phase 3 — Product public pages + SEO

**范围：** /products、/products/:slug、必要导航、来源/时间/价格语义；整合已发布读层、机器出口、sitemap/SEO。负责人确认后同阶段受控调整 AIFIND 品牌及政策，不提前替他写定法律文本。

**文件/模块：** 拟新增 publication/{products,seo}.ts、api/products.ts、web/{products,product}.tsx、contracts/public.ts、tests/{product-public-routes,product-seo,public-scope,product-cache}.test.ts；接入 module.ts/server.ts/web.tsx、packages/backend/src/publication、site/public/openapi-v1.json。按确认范围修改 site/site.ts、site/brand、site/pages、apps/web/app/components/shell/nav.ts；复用 apps/web/app/lib/seo.ts。

**接口边界：** listPublishedProducts(filters,page,now)、readPublishedProduct；只有发布 DTO 能进入 HTTP/SSR/机器出口；draft preview 走受保护后台；撤回后公共读取为空。保留全部旧路由与 /api/v1 格式；/news 别名或导航映射需按一对一旧 URL 兼容，不重定向全部到首页。

- [ ] 先测试 draft/withdrawn 在页面、JSON、Markdown、MCP、sitemap 均不可见；page=2 自 canonical；未知和渠道价格展示。
- [ ] 最小 SSR、产品结构化数据、缓存版本/失效接入；公开最大陈旧 5 分钟、关键价格 60 秒为实际验收上限，覆盖跨进程缓存与 sitemap。
- [ ] SSR HTML/HTTP 注入、移动 320/375px、键盘访问、旧 URL 与 /api/v1 回归；模型阀关闭时页面正常且无费用。

**验收：** T01/T02/T03/T11/T17/T21/T22/T23/T26/T28；真实内容上线前品牌/域名/运营者/政策确认。空产品/草稿不进入 sitemap。

### Phase 4 — Product Resolver / Change Detector

**范围：** 显式别名与消歧、官方价格/帮助/changelog 变化、必要摘录定位、受控候选；从资料处理任务接入，不根据新闻已精选与否决定是否发现变化。

**文件/模块：** 拟新增 changes/{resolver,detector,evidence,jobs,dependencies}.ts、contracts/changes.ts、tests/{resolver,detector,evidence,detector-cost,change-dependencies}.test.ts；复用 sources/articles/receipts；如实需增加 packages/backend/src/modules.ts 通用资料 ready 插口及 sources/collect.ts 或 editorial/analyze.ts 的一个确定调用点。industry/sources.json / 来源登记更新必须经负责人确认；不自动启用采集。

**接口边界：** resolveProduct(material) 返回 resolved / ambiguous / unmatched，不把公司映射当产品唯一证据；detectChanges(materialRevisionId,detectorVersion) 只创建 Phase 2 候选；已发布产品变更发出 revision 依赖通知，未来教程/比较消费者按 Phase 5/6 接入，不提前开发这些页面。

- [ ] 先测试同名 Copilot/母子品牌歧义、未知字段/缺币种/引文定位失败转人工；伪造高 confidence 和资料内命令不能发布。
- [ ] 本地假 HTTP/模型服务验证 SSRF/私网拒绝、同 hash+版本重复不计费；旧公告重抓不刷新原发表/生效/dateModified；来源 date-only 保留精度。
- [ ] 走“资料→证据→候选→Phase 2 审核→事务→新发布版”闭环，失败/冲突不得改事实；模型关闭仍可读站。

**验收：** T04/T05/T06/T07/T08/T09/T13/T19/T20/T23；所有核心字段变化有证据、版本和人工应用；生效日未知为空，不拿抓取日替代。

### Phase 5 — Editorial / How-to

**范围：** 真正人工编辑的 Markdown 草稿/发布/撤回/恢复，实测记录、截图、产品版本/套餐关联、受控动态事实引用和待重验状态。

**文件/模块：** 拟新增 editorial/{documents,revisions,publish,test-records,assets}.ts、contracts/editorial.ts、admin/web/{documents,document-edit}.tsx、publication/documents.ts、web/howto.tsx、tests/{editorial-revisions,editorial-publish,editorial-media,editorial-retest}.test.ts；复用 backend media/{images,prepare,renditions,imgproxy,upstream}.ts、前端 markdown/SEO 和持久媒体备份，不复制另一套存储服务。

**接口边界：** saveDocumentDraft(documentId,baseRevisionId,bodyMd,productRefs,actor)、publishDocument(documentId,draftRevisionId,actor)、readPublishedDocument(slug,now)；testRecord 记录真实 task/environment/plan/version/procedure/result/testedAt/reviewer；事实更新只标 review_state=needs_retest，不改 testedAt。

- [ ] 先测试编辑已发布文档的新草稿公开仍旧版、预览鉴权/no-store、恢复创建新修订；脚本/恶意 SVG/MDX 不执行。
- [ ] 完成实测模板、媒体 rights/alt/hash/脱敏检查及上传、预览、关联和撤回；不让模型伪造实测或自动发布。
- [ ] 浏览器完整完成一个真实教程编辑流程；隔离库验证修订/媒体恢复；跨出口撤回和 mobile/keyboard 回归。

**验收：** T09/T10/T11/T12/T17/T20/T25/T26；事实引用随新已发布事实更新，正文结论保留版本并显示待重验。

### Phase 6 — Compare

**范围：** 2–3 产品在同一任务/环境/套餐条件的比较、动态事实表与独立的编辑结论/实测版本；不改现有模型榜算法。

**文件/模块：** 拟新增 editorial/{comparisons,comparison-revisions}.ts、contracts/compare.ts、publication/comparisons.ts、admin/web/comparison-edit.tsx、web/{compare,comparison}.tsx、tests/{comparisons,comparison-dependencies}.test.ts；复用 Phase 5 文档和测试记录、Phase 1/3 发布事实，不复制价格正文。

- [ ] 先测试年付/月付/渠道不可混用、unknown/未测不转结论、产品变化后表格新版但 verdict 待复核、旧测试版本仍可追溯。
- [ ] 最小管理/SSR/产品关联与 controlled facts 组件；复用草稿与撤回策略。
- [ ] 一份 2–3 产品比较在事实更新、冲突、撤回、移动宽度下走完整流程。

**验收：** T01/T02/T03/T09/T10/T11/T26；事实表与推荐结论分别标时间与依据，不用榜单名次制造实测推荐。

### Phase 7 — Category / Best

**范围：** 有用途定义、适用/不适用条件与明确选择理由的分类/Best/alternatives 内容，不生成空目录或全组合 SEO 页。

**文件/模块：** 拟新增 catalog/categories.ts、editorial/category-pages.ts、publication/categories.ts、web/{categories,category}.tsx、admin/web/category-edit.tsx、tests/{categories,category-seo}.test.ts；复用 Phase 5/6 文档与产品关联。现有 industry 新闻分类 key /topics 继续保留。

- [ ] 先测试空分类不发布、撤回产品从相关列表排除、无测试依据不出虚构分数/排名、分页 canonical 与无价值筛选 noindex。
- [ ] 完成受控用途关联、编辑序与理由、更新提示，不新增假自动评分算法。
- [ ] 验收三份有真实依据的用途页；移动/键盘/跨出口回归。

**验收：** T09/T11/T21/T22/T26；品牌/类型分类不冒充用途分类。

### Phase 8 — Affiliate redirect / tracking

**范围：** 仅接负责人已核验的项目；按项目规则直接链接或 /go/:linkKey；最小匿名事件、披露与官方回退。

**文件/模块：** 拟新增 commercial/{links,redirect,tracking}.ts、contracts/outbound.ts、api/outbound.ts、admin/web/outbound.tsx、tests/{outbound-links,outbound-tracking}.test.ts；对应 af_outbound_links/events 迁移本阶段才增加；政策/披露正文由负责人确认。

- [ ] 先测试 /go?url= 任意目的地址拒绝、HTTPS/凭据/域名白名单、禁 redirect 的项目只给合法直接链接、停用官方回退。
- [ ] 实现 linkKey 查询和最小事件，明确 HEAD/bot/prefetch 不计有效点击，rel=sponsored；不记录邮箱/原始完整查询 URL/长期原始 IP。
- [ ] 注入/浏览器访问及测试流量隔离，审核资格/归因规则/披露后才开生产链接。

**验收：** T14/T15/T16/T28；不存在自动推断联盟资格，不把点击统计当真实转化。

### Phase 9 — Newsletter

**范围：** 外部服务为订阅/确认/退订/投递权威；站内仅编辑 issue、测试、明确发送和可审计回执。不是把现有 Feishu 推送改名。

**文件/模块：** 拟新增 newsletter/{issues,provider,jobs}.ts、contracts/newsletter.ts、admin/web/newsletter.tsx、api/newsletter.ts、web/newsletter.tsx、tests/{newsletter-provider,newsletter-send}.test.ts；复用 pg-boss 和现有回执模式，新增 af_newsletter_issues 及必要发送记录。

- [ ] 先用假 provider 测试 double-opt-in、退订用户不发送、重复 issue/revision 不重发、测试环境仅允许测试收件人。
- [ ] 完成“草稿→审核→测试→负责人明确发送→回执”流程；unsubscribe 状态以 provider 为权威，不自建送达服务。
- [ ] 接入服务前由负责人选择服务/隐私文本/预算；实际发送另获明确授权。

**验收：** T07/T17/T24/T28；无人授权不得发信。

### Phase 10 — Search

**范围：** /search?q= 跨已发布产品、比较、用途、教程、新闻；NFKC 和显式日语别名；PostgreSQL 优先。

**文件/模块：** 拟新增 search/{normalize,query,index}.ts、contracts/search.ts、publication/search.ts、api/search.ts、web/search.tsx、tests/{search-ja,search-publication}.test.ts；按需复用 publication/pool.ts 搜索能力、pg_trgm 和本地索引，不引入外部搜索系统；仅必要新索引用本阶段追加迁移。

**接口边界：** searchPublished(query,filters,page,now)；优先级产品正式名→显式别名→任务/标题→摘要，新闻不得压过明确产品查询；无结果可解释，不用模型伪造命中。

- [ ] 实现前固定不少于 30 条查询及预期相关目标：クロード/Claude/全角名字、議事録、PDF要約、两字符词、别名歧义、新闻同词。
- [ ] 先失败测试再实现 NFKC、实体优先和查询索引；草稿/撤回对象所有结果和摘要立即按发布策略过滤。
- [ ] 跑冻结查询集、短词召回、分页/移动/性能与跨出口撤回验收；保留 /all?q= 旧功能。

**验收：** T11/T18/T21/T22/T26；达到事先定义的查询目标，不能事后改查询集掩盖缺陷。

### Phase 11 — Later retention tools

**范围：** 暂不开发。真实回访、编辑容量与单位维护成本支持后，每次只选 watchlist / reader account / selector / 成本工具中的一个，另写小规格。

**未来文件范围：** 若通过独立立项，可新增 modules/aifind/retention/、相应 contracts/api/web/tests 与模块迁移；复用现有身份/数据边界但读者身份不能复用管理员权限。现有 starred/local-state 数据保留。这里的 retention 与后台数据清理任务不同。

- [ ] 先记录真实需求、预算、隐私/提醒同意与数据保留决定；未通过则不创建任何功能。
- [ ] 对所选一个功能定义最小验收，例如跨账号隔离/删除、提醒撤回与去重、成本输入的币种/周期/渠道。
- [ ] 独立批准后才写失败测试/最小实现；不同时恢复 App、多语言或重型 Adoption DB。

**验收：** 独立规格、隐私和账户隔离、既有收藏回归、预算/副作用关闭测试；不以本 Phase 0 计划视为授权。

## 8. 通用测试、上线与内容验收

### 8.1 本轮实际运行结果

| 检查 | 本轮结果 / 限制 |
| --- | --- |
| PowerShell/Node/npm/锁文件 | PASS；7.6.5 / 24.14.0 / 11.9.0，package-lock v3 与上述实际依赖 |
| npm run typecheck | PASS，退出码 0；包含 contracts/backend/api/worker/tests/modules/web；未 build 生产前端 |
| 4 个不连接数据库的既有测试文件 | PASS，23 tests / 23 pass / 0 fail；japan-localization、web-list-date、local-state、report-ordinals |
| Master Spec 日期探针 | PASS，12 个核心日期/报表断言；UTC 主机环境测试东京午夜/月末/年末/周界、日报08:00/周报10:00/月报10:30 |
| 排行榜日期缺陷探针 | CONFIRMED：实际函数在 JST 当天被 UTC 未来校验拒绝；没有修复，没有 SQL 写入 |
| 本机数据库审计 | PASS 只读 metadata/count SELECT；readonly=on；60 表/58 迁移/无 af_* |
| npm test 完整后端/DB套件 | UNRUN；全局 setup 会创建/迁移隔离库，本轮不执行 |
| npm run build -w @aihot/web 与全套 web tests | UNRUN；避免替换现有 build；只运行上列纯测试，不把旧日志计为本轮通过 |
| server smoke / 实际浏览器 / Linux-Docker-S3恢复 / 真实 cron触发 | UNRUN；本轮未启服务/部署/观察生产 |
| 信源最新许可/模型真实输出/商标/联盟资格 | UNRUN；需负责人和后续核验 |

纯测试命令在 PowerShell 中运行，DATABASE_URL 指向失效的本地端口 1/aifind_phase0_test，TZ=UTC，全部五个安全阀=false，未连接本机内容库：

    node --test tests/japan-localization.test.ts tests/web-list-date.test.ts apps/web/tests/local-state.test.ts apps/web/tests/report-ordinals.test.ts

类型检查与现有测试通过不抵消已复现的日期缺陷，不等于完整系统/生产验收通过。

### 8.2 每个后续实现阶段的最低门

1. 重新核验 Git 状态、当前迁移最大编号、既有修改及本阶段文件范围；不能依赖本文快照覆盖后来变化。
2. 用全新独立 *_test 或 *_ci 数据库先失败测试、最小实现再通过；模型/采集仅本地假服务，推送常关闭。
3. 跑 npm run typecheck；按项目要求跑 npm test、npm run build -w @aihot/web、node --test apps/web/tests/*.test.ts；实际启动后跑 scripts/smoke.ts，报告所有旧/新失败，不能以“非本次引入”忽略。
4. 新页面测试 SSR/公开可见性、CSRF/no-store、东京边界、320/375px 与键盘操作；新领域对旧新闻、报表、榜单、Codex、主题、收藏及 /api/v1 回归。
5. 合成内容标记只留测试库；生产发布门禁止示例事实进入正式内容。真实内容独立做证据/版权/实测审核。
6. 正式上线前在隔离环境完成数据库+媒体恢复、缓存撤回传播、关闭模型可读、关闭采集不外呼的验收；生产启用单独授权，不以阶段计划作授权。

Master Spec T01–T28 全部覆盖映射：Phase 1 T01/02/03/08/19/23/28；Phase 2 T04/06/07/08/10/17；Phase 3 T11/17/21/22/23/26/28；Phase 4 T04/05/06/07/08/09/13/19/20/23；Phase 5 T09/10/11/12/17/20/25/26；Phase 6 T01/02/03/09/10/11/26；Phase 7 T09/11/21/22/26；Phase 8 T14/15/16/28；Phase 9 T07/17/24/28；Phase 10 T11/18/21/22/26。T27 为每个实施阶段的全套回归门；T25/T28 同时为正式发布门。这里是覆盖计划，全部未来 AIFIND 测试仍未实现/未运行。

V1 内容质量门在相关阶段完成后才检查：8–12 个有字段证据的产品、3 个有任务/版本依据的比较、6 篇实际可复现教程、3 份有编辑解释的用途页；不是一启动就自动填充数量。用户任务闭环和一例候选变化闭环均需真实记录。

## 9. 需要负责人本人决定的事项

以下不会阻止此轮报告，也不应阻止以后另获授权的本地合成领域开发，但会阻止对应正式内容/生产操作：

| 决策 | 决策时点 / 影响 |
| --- | --- |
| AIFIND 正式显示名、日文标语、Logo方向、域名/商标及注册资格 | Phase 3 品牌/公开发布前；本轮不将 AI Signal JP 自动改名 |
| 首批产品与用途分类、什么重要/噪声、人工校准样本 | Phase 1 字段范围与 Phase 4 来源/质量验收；沿用已定定位，不再争论重型企业库 |
| 要监测哪些官方价格/帮助/更新/日本入口、可公开/留存的许可 | Phase 4 扩展或启用采集前；不能由 Agent 擅自扩成 20–30 个来源 |
| 当前模型榜、Codex监控、主题大事记继续主导航展示还是降级入口 | Phase 3 导航调整前；无决定先保留行为/数据/URL，不能擅删 |
| 日报是否继续 08:00 截止窗口 | 有意改变报表语义前；默认保留，不把它当成时区未修好 |
| 运营者、联系方式、条款、隐私、编辑政策、商业披露内容 | Phase 3 公开前；当前 contactEmail 等为空，政策草稿须本人确认 |
| 部署目标/区域、费用上限、正式域名与生产启用范围 | 任何部署前；已有部署方案不是本轮新授权 |
| Newsletter服务、分析服务及同意策略、获批联盟计划/跳转规则 | Phase 8/9/分析接入前；发送必须明确授权 |
| 真实产品订阅、测试账号、截图/素材授权及实测时间预算 | Phase 5/6 真实内容前，禁止把合成记录当亲测 |

当前没有阻止 Phase 0 完成的待答问题；进入 Phase 1 必须有新的明确任务授权。技术架构与 11 阶段顺序已确定，不需要重新选择 CMS/数据库或默认多语言。

## 10. 保护验证记录

报告写入前，805 个既有路径按“相对路径 TAB 文件 SHA-256（删除文件为 MISSING）、路径 ordinal 排序、LF 分隔且无末尾 LF”形成摘要：

- 写入前摘要：9d76754e0f56401819e8c56bdbde8ff5550f52327dda7950cf088fc2a8d14ab1
- Git 索引摘要：647cea9c84a71ae8002dc0bf17f59b2c704cdeedaf98c6b161415c9ffd1f4ccf

写入后使用相同规则排除此新报告，805 个既有路径摘要完全一致；Git 索引和 HEAD 未变，原有 482 条工作树状态逐条一致，唯一新增状态为此报告未跟踪文件。保护复核 PASS；不能把本报告写入视为任何旧修改已经提交或可丢弃。

## 附录：本轮开始时的完整既有改动清单

根目录为 D:\Projects\aihot；以下为 git status --porcelain=v1 -uall 的原有 482 条记录，不包含此新报告。M 修改、D 删除、?? 未跟踪，均须保留；不能仅按 Git 已跟踪状态判断重要性。


```text
 M .env.example
 M Dockerfile
 M NOTICE
 M README.md
 M apps/api/src/app.ts
 M apps/api/src/og/poster.ts
 M apps/api/src/og/render.ts
 M apps/api/src/routes/admin.ts
 M apps/api/src/routes/mcp.ts
 M apps/api/src/routes/og.ts
 M apps/web/app/app.css
 M apps/web/app/components/shell/Chrome.tsx
 M apps/web/app/components/shell/PhoneBar.tsx
 M apps/web/app/components/shell/Sidebar.tsx
 M apps/web/app/components/shell/TabBar.tsx
 M apps/web/app/components/shell/ThemeSwitch.tsx
 M apps/web/app/components/shell/nav.ts
 M apps/web/app/components/ui/Badge.tsx
 M apps/web/app/components/ui/Lightbox.tsx
 M apps/web/app/components/ui/OutlineSheet.tsx
 M apps/web/app/components/ui/Score.tsx
 M apps/web/app/components/ui/Sheet.tsx
 M apps/web/app/features/about/SignalRiver.tsx
 M apps/web/app/features/admin/format.ts
 M apps/web/app/features/agent/CodeBlock.tsx
 M apps/web/app/features/agent/panels.tsx
 M apps/web/app/features/agent/parts.tsx
 M apps/web/app/features/changelog/text.tsx
 M apps/web/app/features/copy/CopyPage.tsx
 M apps/web/app/features/feed/DayList.tsx
 M apps/web/app/features/feed/FeedItem.tsx
 M apps/web/app/features/feed/Filters.tsx
 M apps/web/app/features/feed/HotTopics.tsx
 M apps/web/app/features/feed/ReadingGroup.tsx
 M apps/web/app/features/feed/Timeline.tsx
 M apps/web/app/features/feed/parts.tsx
 M apps/web/app/features/hot/Delta.tsx
 M apps/web/app/features/hot/Faces.tsx
 M apps/web/app/features/hot/Sparkline.tsx
 M apps/web/app/features/item/ArticleBody.tsx
 M apps/web/app/features/item/MediaGallery.tsx
 M apps/web/app/features/item/PosterSheet.tsx
 M apps/web/app/features/item/QuotedPost.tsx
 M apps/web/app/features/item/ReaderTools.tsx
 M apps/web/app/features/item/StoryFollowups.tsx
 M apps/web/app/features/item/highlight.ts
 M apps/web/app/features/report/ReportLayout.tsx
 M apps/web/app/features/report/ReportNav.tsx
 M apps/web/app/features/report/ReportPaper.tsx
 M apps/web/app/features/report/format.ts
 M apps/web/app/features/search/SearchOverlay.tsx
 M apps/web/app/features/story/HeatChart.tsx
 M apps/web/app/lib/format.ts
 M apps/web/app/lib/local-state.ts
 M apps/web/app/lib/markdown.ts
 M apps/web/app/lib/seo.ts
 M apps/web/app/root.tsx
 M apps/web/app/routes.ts
 M apps/web/app/routes/about.tsx
 M apps/web/app/routes/admin/content-item.tsx
 M apps/web/app/routes/admin/content.tsx
 M apps/web/app/routes/admin/layout.tsx
 M apps/web/app/routes/agent.tsx
 M apps/web/app/routes/all.tsx
 M apps/web/app/routes/changelog.tsx
 M apps/web/app/routes/daily-archive.tsx
 M apps/web/app/routes/feedback.tsx
 M apps/web/app/routes/home.tsx
 M apps/web/app/routes/hot.tsx
 M apps/web/app/routes/item.tsx
 M apps/web/app/routes/more.tsx
 M apps/web/app/routes/privacy.tsx
 M apps/web/app/routes/report-detail.tsx
 M apps/web/app/routes/report-latest.tsx
 M apps/web/app/routes/search-busy.tsx
 M apps/web/app/routes/starred.tsx
 M apps/web/app/routes/story.tsx
 M apps/web/app/routes/terms.tsx
 M apps/web/app/routes/topic.tsx
 M apps/web/app/routes/topics.tsx
 M apps/web/server.ts
 M apps/web/tests/cache.test.ts
 M apps/web/tests/local-state.test.ts
 M apps/web/tests/report-ordinals.test.ts
 M apps/worker/src/schedules.ts
 D assets/og-fonts/LICENSE
 D assets/og-fonts/noto-sans-sc-400.ttf
 D assets/og-fonts/noto-sans-sc-700.ttf
 M docker-compose.yml
 M docs/customize.md
 M docs/deploy.md
 M industry/prompts/content-understanding.md
 M industry/prompts/group-batch.md
 M industry/prompts/group-definitions.md
 M industry/prompts/group-method.md
 M industry/prompts/group-pair.md
 M industry/prompts/group-signal.md
 M industry/prompts/identity-context.md
 M industry/prompts/prefilter.md
 M industry/prompts/report-period-no-sections.md
 M industry/prompts/report-period-sections.md
 M industry/prompts/report-period.md
 M industry/prompts/rules-answer-first-summary.md
 M industry/prompts/rules-anti-hallucination.md
 M industry/prompts/rules-domain.md
 M industry/prompts/rules-self-contained-title.md
 M industry/prompts/safety.md
 M industry/prompts/selection-score.md
 M industry/prompts/story-digest.md
 M industry/prompts/structure.md
 M industry/prompts/summarize-article-empty.md
 M industry/prompts/summarize-article.md
 M industry/prompts/summarize-long-post-quoted.md
 M industry/prompts/summarize-long-post.md
 M industry/prompts/summarize-short-post-quoted.md
 M industry/prompts/summarize-short-post.md
 M industry/prompts/translate-body.md
 M industry/prompts/translate-post.md
 M industry/prompts/understand.md
 M industry/sources.json
 M industry/taxonomy.ts
 M industry/topics.json
 M package-lock.json
 M packages/backend/src/admin/content.ts
 M packages/backend/src/content/extract.ts
 M packages/backend/src/editorial/analyze.ts
 M packages/backend/src/editorial/input.ts
 M packages/backend/src/editorial/translate.ts
 M packages/backend/src/editorial/writing.ts
 M packages/backend/src/events/consolidate.ts
 M packages/backend/src/events/digest.ts
 M packages/backend/src/events/group.ts
 M packages/backend/src/events/recall.ts
 M packages/backend/src/events/relate.ts
 M packages/backend/src/lib/http-fetch.ts
 M packages/backend/src/media/upstream.ts
 M packages/backend/src/modules.ts
 M packages/backend/src/notify/feishu.ts
 M packages/backend/src/operations/alerts.ts
 M packages/backend/src/operations/backup.ts
 M packages/backend/src/operations/reports.ts
 M packages/backend/src/operations/watch.ts
 M packages/backend/src/providers/embeddings.ts
 M packages/backend/src/providers/llm.ts
 M packages/backend/src/providers/receipts.ts
 M packages/backend/src/publication/agent.ts
 M packages/backend/src/publication/detail.ts
 M packages/backend/src/publication/feeds.ts
 M packages/backend/src/publication/items.ts
 M packages/backend/src/publication/llms.ts
 M packages/backend/src/publication/pool.ts
 M packages/backend/src/publication/publish.ts
 M packages/backend/src/publication/reports.ts
 M packages/backend/src/publication/sitemap.ts
 M packages/backend/src/publication/timeline.ts
 M packages/backend/src/publication/topics.ts
 M packages/backend/src/reports/compose.ts
 M packages/backend/src/reports/edition.ts
 M packages/backend/src/sources/collect.ts
 M packages/backend/src/sources/web-list.ts
 M packages/contracts/src/admin.ts
 M packages/contracts/src/site.ts
 M packages/contracts/src/taxonomy.ts
 M packages/contracts/src/time.ts
 M scripts/init-env.ts
 M scripts/nameplates.ts
 M site/brand/Logo.tsx
 M site/brand/apple-icon.png
 M site/brand/favicon.ico
 M site/brand/icon-192.png
 M site/brand/icon.png
 M site/brand/logo.svg
 M site/brand/nameplates/archive.svg
 M site/brand/nameplates/daily.svg
 M site/brand/nameplates/index.json
 M site/brand/nameplates/monthly.svg
 M site/brand/nameplates/weekly.svg
 M site/changelog.json
 M site/models.ts
 M site/modules/index.ts
 M site/modules/server.ts
 M site/modules/web.ts
 M site/package.json
 M site/pages/privacy.md
 M site/pages/terms.md
 M site/public/openapi-v1.json
 M site/site.ts
 M tests/agent-public.test.ts
 M tests/analyze-consistency.test.ts
 M tests/analyze-kill.test.ts
 M tests/analyze-shutdown.test.ts
 M tests/analyze.test.ts
 M tests/architecture.test.ts
 M tests/backup-files.test.ts
 M tests/backup.test.ts
 M tests/category-corrections.test.ts
 M tests/databases.ts
 M tests/default-model.test.ts
 M tests/events.test.ts
 M tests/grouping-reliability.test.ts
 M tests/listings.test.ts
 M tests/processing-recovery.test.ts
 M tests/publication.test.ts
 M tests/report-candidates.test.ts
 M tests/report-recovery.test.ts
 M tests/reports.test.ts
 M tests/seats.test.ts
 M tests/setup.ts
 M tests/site-routes.test.ts
 M tests/timeline-day-counts.test.ts
 M tests/topics-withdrawal.test.ts
 M tests/topics.test.ts
 M tests/translate-shutdown.test.ts
 M tests/translate.test.ts
 M tests/web-list-date.test.ts
?? .superpowers/sdd/launch-readiness-plan/progress.md
?? apps/web/app/routes/admin/seo.tsx
?? apps/web/tests/seo-runtime.test.ts
?? assets/og-fonts/OFL-NotoSansJP.txt
?? assets/og-fonts/README.md
?? assets/og-fonts/noto-sans-jp-400.ttf
?? assets/og-fonts/noto-sans-jp-700.ttf
?? database/migrations/0055_provider_billing_pause.sql
?? database/migrations/0056_japanese_translation_default.sql
?? deploy/Caddyfile.restricted
?? deploy/deploy.sh
?? deploy/import-launch-content.sh
?? deploy/package-release.py
?? deploy/restore-check.sh
?? deploy/s3-lifecycle.json
?? docs/AIFIND_MASTER_SPEC.md
?? docs/admin-and-seo-zh.md
?? docs/ai-signal-jp-plan.md
?? docs/ai-signal-jp-progress.md
?? docs/codex-monitor-jp.md
?? docs/completion-admin-seo-plan.md
?? docs/evaluation-ja.md
?? docs/launch-readiness-plan.md
?? docs/model-leaderboard-jp.md
?? docs/operations-zh.md
?? docs/preview/completion-admin-content.png
?? docs/preview/completion-admin-seo.png
?? docs/preview/desktop-home.png
?? docs/preview/launch-desktop-daily.png
?? docs/preview/launch-desktop-home.png
?? docs/preview/launch-mobile-home.png
?? docs/preview/launch-mobile-leaderboard.png
?? docs/preview/launch-mobile-monthly.png
?? docs/preview/mobile-daily.png
?? docs/preview/mobile-home.png
?? docs/source-review.md
?? docs/topic-chronicle-jp.md
?? docs/verification-20261004.md
?? docs/verification-completion-20261004.md
?? docs/verification-launch-20261004.md
?? docs/verification/completion-20261004/browser-completion.json
?? docs/verification/completion-20261004/codex-official-collect.log
?? docs/verification/completion-20261004/completion-build.log
?? docs/verification/completion-20261004/completion-full-tests-final.log
?? docs/verification/completion-20261004/completion-smoke-final.log
?? docs/verification/completion-20261004/completion-smoke.log
?? docs/verification/completion-20261004/completion-typecheck-final.log
?? docs/verification/completion-20261004/completion-typecheck.log
?? docs/verification/completion-20261004/completion-web-tests.log
?? docs/verification/completion-20261004/eq-completion.json
?? docs/verification/completion-20261004/independent-review.json
?? docs/verification/completion-20261004/launch-content-restore.json
?? docs/verification/completion-20261004/launch-restored-api.json
?? docs/verification/completion-20261004/local-linux-availability.json
?? docs/verification/completion-20261004/pre-review-fix-full-tests.log
?? docs/verification/launch-20261004/browser-launch.json
?? docs/verification/launch-20261004/browser-reports.json
?? docs/verification/launch-20261004/final-review.md
?? docs/verification/launch-20261004/launch-content-restore.json
?? docs/verification/launch-20261004/launch-content-review-resolution.json
?? docs/verification/launch-20261004/launch-final-state.json
?? docs/verification/launch-20261004/launch-restored-api.json
?? evaluation/candidates.csv
?? evaluation/candidates.jsonl
?? modules/codex-monitor/api/routes.ts
?? modules/codex-monitor/backend/admin.ts
?? modules/codex-monitor/backend/agent.ts
?? modules/codex-monitor/backend/apply-recognition.ts
?? modules/codex-monitor/backend/collect-sources.ts
?? modules/codex-monitor/backend/collection-admin.ts
?? modules/codex-monitor/backend/collection-schema.ts
?? modules/codex-monitor/backend/collection-store.ts
?? modules/codex-monitor/backend/collection.ts
?? modules/codex-monitor/backend/jobs.ts
?? modules/codex-monitor/backend/official-status.ts
?? modules/codex-monitor/backend/presentation.ts
?? modules/codex-monitor/backend/publication.ts
?? modules/codex-monitor/backend/recognize.ts
?? modules/codex-monitor/backend/refresh.ts
?? modules/codex-monitor/backend/schema.ts
?? modules/codex-monitor/contracts.ts
?? modules/codex-monitor/data/official-history.json
?? modules/codex-monitor/data/official-status-probe.json
?? modules/codex-monitor/migrations/0058_codex_monitor.sql
?? modules/codex-monitor/migrations/0061_codex_monitor_collection.sql
?? modules/codex-monitor/module.ts
?? modules/codex-monitor/package.json
?? modules/codex-monitor/scripts/import-official-history.ts
?? modules/codex-monitor/scripts/probe-official-status.ts
?? modules/codex-monitor/scripts/scan-announcements.ts
?? modules/codex-monitor/server.ts
?? modules/codex-monitor/tests/collection.test.ts
?? modules/codex-monitor/tests/history.test.ts
?? modules/codex-monitor/tests/monitor.test.ts
?? modules/codex-monitor/tests/publication.test.ts
?? modules/codex-monitor/tests/routes.test.ts
?? modules/codex-monitor/web.tsx
?? modules/codex-monitor/web/admin.tsx
?? modules/codex-monitor/web/page.tsx
?? modules/codex-monitor/web/style.css
?? modules/model-leaderboard/admin-contracts.ts
?? modules/model-leaderboard/api/admin.ts
?? modules/model-leaderboard/api/routes.ts
?? modules/model-leaderboard/backend/access.ts
?? modules/model-leaderboard/backend/admin.ts
?? modules/model-leaderboard/backend/agent.ts
?? modules/model-leaderboard/backend/directory.ts
?? modules/model-leaderboard/backend/fetch/admission.ts
?? modules/model-leaderboard/backend/fetch/configuration.ts
?? modules/model-leaderboard/backend/fetch/csv.ts
?? modules/model-leaderboard/backend/fetch/github.ts
?? modules/model-leaderboard/backend/fetch/hf.ts
?? modules/model-leaderboard/backend/fetch/identity.ts
?? modules/model-leaderboard/backend/fetch/index.ts
?? modules/model-leaderboard/backend/fetch/rank.ts
?? modules/model-leaderboard/backend/fetch/refresh.ts
?? modules/model-leaderboard/backend/fetch/sources/arena.ts
?? modules/model-leaderboard/backend/fetch/sources/artificial-analysis.ts
?? modules/model-leaderboard/backend/fetch/sources/deepswe.ts
?? modules/model-leaderboard/backend/fetch/sources/epoch.ts
?? modules/model-leaderboard/backend/fetch/sources/eqbench.ts
?? modules/model-leaderboard/backend/fetch/sources/livebench.ts
?? modules/model-leaderboard/backend/fetch/sources/mercor.ts
?? modules/model-leaderboard/backend/fetch/sources/taptap.ts
?? modules/model-leaderboard/backend/fetch/sources/terminal-bench.ts
?? modules/model-leaderboard/backend/fetch/sources/vals.ts
?? modules/model-leaderboard/backend/fetch/store.ts
?? modules/model-leaderboard/backend/fetch/types.ts
?? modules/model-leaderboard/backend/fetch/unzip.ts
?? modules/model-leaderboard/backend/method/calibration.ts
?? modules/model-leaderboard/backend/method/compute-worker.ts
?? modules/model-leaderboard/backend/method/compute.ts
?? modules/model-leaderboard/backend/method/consensus.ts
?? modules/model-leaderboard/backend/method/inputs.ts
?? modules/model-leaderboard/backend/method/kemeny.ts
?? modules/model-leaderboard/backend/method/run.ts
?? modules/model-leaderboard/backend/method/score.ts
?? modules/model-leaderboard/backend/model-weights.json
?? modules/model-leaderboard/backend/prices.ts
?? modules/model-leaderboard/backend/providers.ts
?? modules/model-leaderboard/backend/read.ts
?? modules/model-leaderboard/backend/registry.ts
?? modules/model-leaderboard/backend/source-registry.json
?? modules/model-leaderboard/contracts.ts
?? modules/model-leaderboard/migrations/0057_model_leaderboard.sql
?? modules/model-leaderboard/migrations/0060_model_leaderboard_admin.sql
?? modules/model-leaderboard/module.ts
?? modules/model-leaderboard/package.json
?? modules/model-leaderboard/public/leaderboard-sources/NOTICE.md
?? modules/model-leaderboard/public/leaderboard-sources/agents-last-exam.svg
?? modules/model-leaderboard/public/leaderboard-sources/arena.svg
?? modules/model-leaderboard/public/leaderboard-sources/artificial-analysis-purple-2026.svg
?? modules/model-leaderboard/public/leaderboard-sources/deepswe.svg
?? modules/model-leaderboard/public/leaderboard-sources/epoch.svg
?? modules/model-leaderboard/public/leaderboard-sources/eqbench.svg
?? modules/model-leaderboard/public/leaderboard-sources/livebench.png
?? modules/model-leaderboard/public/leaderboard-sources/llm2014.svg
?? modules/model-leaderboard/public/leaderboard-sources/mercor.svg
?? modules/model-leaderboard/public/leaderboard-sources/rapidata.svg
?? modules/model-leaderboard/public/leaderboard-sources/sierra.png
?? modules/model-leaderboard/public/leaderboard-sources/taptap-maker.svg
?? modules/model-leaderboard/public/leaderboard-sources/vals.svg
?? modules/model-leaderboard/public/model-providers/NOTICE.md
?? modules/model-leaderboard/public/model-providers/anthropic.svg
?? modules/model-leaderboard/public/model-providers/bytedance.svg
?? modules/model-leaderboard/public/model-providers/deepseek.svg
?? modules/model-leaderboard/public/model-providers/google.svg
?? modules/model-leaderboard/public/model-providers/meta.svg
?? modules/model-leaderboard/public/model-providers/minimax.svg
?? modules/model-leaderboard/public/model-providers/mistral.svg
?? modules/model-leaderboard/public/model-providers/moonshot.svg
?? modules/model-leaderboard/public/model-providers/nvidia.svg
?? modules/model-leaderboard/public/model-providers/openai.svg
?? modules/model-leaderboard/public/model-providers/qianwen.svg
?? modules/model-leaderboard/public/model-providers/tencent.svg
?? modules/model-leaderboard/public/model-providers/thinking-machines.png
?? modules/model-leaderboard/public/model-providers/xai.svg
?? modules/model-leaderboard/public/model-providers/xiaomi-mimo.svg
?? modules/model-leaderboard/public/model-providers/z-ai.svg
?? modules/model-leaderboard/scripts/refresh-sources.ts
?? modules/model-leaderboard/scripts/refresh.ts
?? modules/model-leaderboard/seeds/lb-models-2026-10-03.json
?? modules/model-leaderboard/seeds/lb-official-prices-2026-09-26.json
?? modules/model-leaderboard/seeds/lb-official-prices-2026-09-30.json
?? modules/model-leaderboard/server.ts
?? modules/model-leaderboard/taxonomy.ts
?? modules/model-leaderboard/tests/admin.test.ts
?? modules/model-leaderboard/tests/fixtures/refresh-sources-http.ts
?? modules/model-leaderboard/tests/http.test.ts
?? modules/model-leaderboard/tests/leaderboard-admission.test.ts
?? modules/model-leaderboard/tests/leaderboard-fetch-performance.test.ts
?? modules/model-leaderboard/tests/leaderboard-identity.test.ts
?? modules/model-leaderboard/tests/leaderboard-method.test.ts
?? modules/model-leaderboard/tests/leaderboard-read.test.ts
?? modules/model-leaderboard/tests/leaderboard-rules.test.ts
?? modules/model-leaderboard/tests/leaderboard-score.test.ts
?? modules/model-leaderboard/tests/leaderboard-snapshots.test.ts
?? modules/model-leaderboard/tests/leaderboard-worker.test.ts
?? modules/model-leaderboard/tests/metadata.test.ts
?? modules/model-leaderboard/tests/module.test.ts
?? modules/model-leaderboard/tests/presentation.test.ts
?? modules/model-leaderboard/tests/refresh-sources-cli.test.ts
?? modules/model-leaderboard/verification/2026-10-04-admin-tests.txt
?? modules/model-leaderboard/verification/2026-10-04-api.json
?? modules/model-leaderboard/verification/2026-10-04-cli-review-tests.txt
?? modules/model-leaderboard/verification/2026-10-04-live-run.json
?? modules/model-leaderboard/verification/check-publication.mjs
?? modules/model-leaderboard/verification/run-publication.mjs
?? modules/model-leaderboard/web.tsx
?? modules/model-leaderboard/web/admin.tsx
?? modules/model-leaderboard/web/agent.tsx
?? modules/model-leaderboard/web/format.ts
?? modules/model-leaderboard/web/page.tsx
?? modules/model-leaderboard/web/style.css
?? modules/topic-chronicle/api/routes.ts
?? modules/topic-chronicle/backend/history.ts
?? modules/topic-chronicle/backend/publication.ts
?? modules/topic-chronicle/backend/rules.ts
?? modules/topic-chronicle/backend/selection.ts
?? modules/topic-chronicle/backend/store.ts
?? modules/topic-chronicle/backend/terms.ts
?? modules/topic-chronicle/data/histories.json
?? modules/topic-chronicle/data/source-check.json
?? modules/topic-chronicle/migrations/0059_topic_chronicle.sql
?? modules/topic-chronicle/module.ts
?? modules/topic-chronicle/package.json
?? modules/topic-chronicle/server.ts
?? modules/topic-chronicle/tests/history.test.ts
?? modules/topic-chronicle/tests/publication.test.ts
?? modules/topic-chronicle/tests/routes.test.ts
?? modules/topic-chronicle/tests/selection.test.ts
?? modules/topic-chronicle/tests/store.test.ts
?? modules/topic-chronicle/tests/upstream-selection.test.ts
?? modules/topic-chronicle/types.ts
?? modules/topic-chronicle/web.tsx
?? modules/topic-chronicle/web/Chronicle.tsx
?? modules/topic-chronicle/web/admin.tsx
?? modules/topic-chronicle/web/part.tsx
?? packages/backend/src/admin/seo.ts
?? packages/backend/src/providers/openai-cost.ts
?? packages/contracts/src/language.ts
?? packages/contracts/src/seo.ts
?? scripts/backup-now.ts
?? scripts/compose-retrospective.ts
?? scripts/preview-config.ts
?? scripts/preview.ts
?? scripts/seed-preview.ts
?? scripts/serve-local.ts
?? site/preview-news.json
?? tests/admin-content-list.test.ts
?? tests/admin-seo.test.ts
?? tests/extraction-html-document.test.ts
?? tests/extraction-optional-reader.test.ts
?? tests/init-env.test.ts
?? tests/japan-localization.test.ts
?? tests/japan-source-cards.test.ts
?? tests/japan-source-interval.test.ts
?? tests/openai-budget-alerts.test.ts
?? tests/openai-explicit-embedding.test.ts
?? tests/openai-pause-recovery.test.ts
?? tests/openai-provider.test.ts
?? tests/period-withdrawal.test.ts
?? tests/preview-data-guard.test.ts
?? tests/preview-news.test.ts
?? tests/preview-safety.test.ts
?? tests/retrospective-reports.test.ts
?? tests/seo-publication.test.ts
```

