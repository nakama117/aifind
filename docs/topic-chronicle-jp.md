# 主题大事记（日文）

`modules/topic-chronicle/` 将公开上游提交 `cc66cce` 的主题大事记恢复为站点模块。实现及原版回归用例沿用仓库 MIT 许可证；前台使用日文与日本时间。历史档案和管理功能属于本模块，不修改行业分类、评分门槛或新闻流水线。

## 读者入口与原版行为

- 公司主题 `/topics/openai` 等：横向时间轴，早期在左、近期在右，首次打开停在近期；模型在上轨，产品和企业动向在下轨。可用键盘或滑动查看早期记录。
- 技术领域、内容形式 `/topics/agent`、`/topics/model-releases` 等：按月倒序的纵向时间轴，先显示 5 个事件，可展开更早事件。
- 自动事件仅从统一 publication 层的已公开精选中选取。发生时间优先，其次取同一事实的最早公开日期；报道发现时间不会把旧事件改写成新发布。近 12 个月、每月名额、公司归属、事件合并、评分门槛、多来源覆盖排序及搜索摘要仍按原版规则执行。日文增加对预告、教程、托管平台上架、促销等非发布内容的识别。
- 主题索引缓存期间，所显示新闻仍逐条重读公开状态、标题和主题归属。撤稿从时间轴和摘要消失。历史节点可独立保留来源链接；可选 `item` 关联只有当前 publication 确认该文章仍在本主题时才显示。
- 历史档案每次生成主题页面数据时读当前启用状态；撤下不会回退到随代码附带的旧档案。页面/API 的现有 HTTP 缓存窗口仍由框架控制。

## 历史资料范围

上游公开 Git 提交没有附带 `industry/chronicles/*.json`，因此不能恢复未公开的旧站历史数据库。本模块附带的是 **2026-10-04 编纂并核查的 12 个企业/机构主题、50 个节点**：OpenAI、Anthropic、Google、DeepSeek、Qwen、Meta、Microsoft、NVIDIA、Sakana AI、Preferred Networks、GENIAC、理研 AIP。每个主题 4–5 条，日期范围从 2016-04-14 到 2026-09-30；只列经过核对的重要节点，不代表完整沿革。资料不会冒充本站当年的实时报道，也不会写入新闻表或占用精选席位。

每条为独立撰写的日文短摘要，来源限于机构官方公告、官方仓库或作者提交的研究论文。研究预览、限定提供、一般提供及尚未发生的计划分别表述。无法核实具体日的记录只保留年月。

### 来源与日期证据

下表所有节点的核验日期均为 **2026-10-04**。“日期”是页面上的事件日期；“日期依据”解释来源发布日期与事件日期不一致的情况。两篇 METI 原文对直接抓取返回 403，内容采用官方搜索索引及同机构的项目/新闻列表、NEDO 公告交叉核对；没有把 HTTP 成功当作内容已核实，也没有把抓取失败记为链接失效。

| 主题 | 日期 | 节点及一手来源 | 日期依据 |
|---|---|---|---|
| openai | 2022-11-30 | [ChatGPTの研究プレビューを公開](https://openai.com/index/chatgpt/) | 官方原文的公表日。 |
| openai | 2023-03-14 | [GPT-4を発表](https://openai.com/index/gpt-4/) | 官方原文的公表日。 |
| openai | 2024-05-13 | [GPT-4oを発表](https://openai.com/index/hello-gpt-4o/) | 官方原文的公表日。 |
| openai | 2025-08-07 | [GPT-5を発表](https://openai.com/index/introducing-gpt-5/) | 官方原文的公表日。 |
| openai | 2026-09-29 | [GPT-6.1 Solの提供を開始](https://openai.com/index/introducing-gpt-6-1-sol/) | 公告未标日；[官方 API 更新日志](https://developers.openai.com/api/docs/changelog)的 2026-09-29 条目确认提供日。 |
| anthropic | 2023-03-14 | [ClaudeとClaude Instantを発表](https://www.anthropic.com/news/introducing-claude) | 官方原文的公表日。 |
| anthropic | 2024-03-04 | [Claude 3シリーズを発表](https://www.anthropic.com/news/claude-3-family) | 官方原文的公表日。 |
| anthropic | 2025-05-22 | [Claude 4とClaude Codeの一般提供を発表](https://www.anthropic.com/news/claude-4) | 官方原文的公表日。 |
| anthropic | 2026-09-22 | [Claude Opus 5.5を発表](https://www.anthropic.com/claude-opus-5-5) | 官方原文的公表日。 |
| google | 2023-12-06 | [Gemini 1.0を発表](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/) | 官方原文的公表日。 |
| google | 2024-12-11 | [Gemini 2.0を発表](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/google-gemini-ai-update-december-2024/) | 官方原文的公表日。 |
| google | 2025-03-25 | [Gemini 2.5 Proの実験版を公開](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-model-thinking-updates-march-2025/) | 官方原文的公表日。 |
| google | 2026-09-30 | [Gemini 4 Argonを発表、限定提供を開始](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/) | 官方原文的公表日。 |
| deepseek | 2024-05-06 | [DeepSeek-V2を公開](https://github.com/deepseek-ai/DeepSeek-V2) | 官方仓库 README 的 2024/05/06 发布记录。 |
| deepseek | 2024-12-26 | [DeepSeek-V3をAPIに導入](https://api-docs.deepseek.com/updates/#date-2024-12-26) | 官方更新日志的 2024/12/26 条目。 |
| deepseek | 2025-01-20 | [推論モデルDeepSeek-R1を公開](https://api-docs.deepseek.com/news/news250120/) | 公告及[官方更新日志](https://api-docs.deepseek.com/updates/#date-2025-01-20)的 2025/01/20 条目。 |
| deepseek | 2026-09-10 | [DeepSeek-V4.1-Flashを公開](https://api-docs.deepseek.com/updates/#date-2026-09-10) | 官方更新日志的 2026/09/10 条目。 |
| qwen | 2023-08-03 | [Qwen-7Bを公開](https://github.com/QwenLM/Qwen) | 官方仓库发布表的 23.08.03 条目。 |
| qwen | 2024-09-19 | [Qwen2.5モデル群を公開](https://qwenlm.github.io/blog/qwen2.5/) | 官方原文的公表日。 |
| qwen | 2025-04-29 | [Qwen3の重みを公開](https://qwenlm.github.io/blog/qwen3/) | 官方原文的公表日。 |
| qwen | 2026-08-12 | [Qwen3.8-2.4T-A95Bを公開](https://github.com/QwenLM/Qwen3.8) | 官方仓库 News 的 2026.8.12 条目。 |
| meta | 2023-02-24 | [研究用言語モデルLLaMAを発表](https://ai.meta.com/blog/large-language-model-llama-meta-ai/) | 官方原文的公表日。 |
| meta | 2023-07-18 | [Llama 2を公開](https://ai.meta.com/blog/llama-2/) | 官方原文的公表日。 |
| meta | 2024-04-18 | [Llama 3を公開](https://ai.meta.com/blog/meta-llama-3/) | 官方原文的公表日。 |
| meta | 2025-04-05 | [Llama 4 ScoutとMaverickを公開](https://ai.meta.com/blog/llama-4-multimodal-intelligence/) | 官方原文的公表日。 |
| meta | 2026-09-08 | [個人向けAIエージェントMuseを発表](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/) | 官方原文的公表日。 |
| microsoft | 2023-02-07 | [AIを組み込んだBingとEdgeを発表](https://blogs.microsoft.com/blog/2023/02/07/reinventing-search-with-a-new-ai-powered-microsoft-bing-and-edge-your-copilot-for-the-web/) | 官方原文的公表日。 |
| microsoft | 2023-03-16 | [Microsoft 365 Copilotを発表](https://blogs.microsoft.com/blog/2023/03/16/introducing-microsoft-365-copilot-your-copilot-for-work/) | 官方原文的公表日。 |
| microsoft | 2024-05-20 | [Copilot+ PCを発表](https://blogs.microsoft.com/blog/2024/05/20/introducing-copilot-pcs/) | 官方原文的公表日。 |
| microsoft | 2026-03-30 | [Copilot CoworkをFrontierで提供](https://www.microsoft.com/en-us/copilot/blog/2026/03/30/copilot-cowork-now-available-in-frontier/) | 官方原文的公表日。 |
| nvidia | 2022-03-22 | [HopperとH100 GPUを発表](https://nvidianews.nvidia.com/news/nvidia-announces-hopper-architecture-the-next-generation-of-accelerated-computing) | 官方原文的公表日。 |
| nvidia | 2024-03-18 | [Blackwellプラットフォームを発表](https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing) | 官方原文的公表日。 |
| nvidia | 2025-01-06 | [物理AI向けCosmosを公開](https://nvidianews.nvidia.com/news/nvidia-launches-cosmos-world-foundation-model-platform-to-accelerate-physical-ai-development) | 官方原文的公表日。 |
| nvidia | 2026-01-05 | [6種類のチップを統合するRubinを発表](https://nvidianews.nvidia.com/news/rubin-platform-ai-supercomputer) | 官方原文的公表日。 |
| sakana-ai | 2024-03-21 | [進化的モデルマージを発表](https://sakana.ai/evolutionary-model-merge/) | 初次公告日；不采用文首后加的 2025-01-28 更新日。 |
| sakana-ai | 2024-08-13 | [The AI Scientistを発表](https://sakana.ai/ai-scientist/) | 官方原文的公表日。 |
| sakana-ai | 2025-03-12 | [AI生成論文のワークショップ査読通過を報告](https://sakana.ai/ai-scientist-first-publication/) | 原公告日；是 ICLR 工作坊的协作实验，不是主会录用；不采用 4 月更新日。 |
| sakana-ai | 2026-06-19 | [Sakana Fuguの技術報告を公開](https://arxiv.org/abs/2606.21228) | 作者提交 arXiv v1 的日期；[公司产品页](https://sakana.ai/fugu/)确认系统归属。节点为论文公开，不推断产品上线日。 |
| preferred-networks | 2023-09-28 | [日本語・英語モデルPLaMo-13Bを公開](https://www.preferred.jp/ja/blog/tech/llm-plamo) | 官方原文的公表日。 |
| preferred-networks | 2024-10-10 | [PLaMo-100Bの技術報告を公開](https://arxiv.org/abs/2410.07563) | Preferred Elements 作者的 arXiv v1 提交日；不作为商业服务上线日。 |
| preferred-networks | 2025-09-05 | [PLaMo 2の技術報告を公開](https://arxiv.org/abs/2509.04897) | Preferred Networks 作者的 arXiv v1 提交日；不作为商业服务上线日。 |
| preferred-networks | 2026-06-22 | [PLaMo 3.0 Primeを正式リリース](https://www.preferred.jp/ja/blog/tech/plamo-3-0-prime-release) | 官方原文的公表日。 |
| geniac | 2024-02-02 | [生成AI開発支援GENIACが始動](https://www.meti.go.jp/press/2023/02/20240202003/20240202003.html) | 官方原文的公表日。 |
| geniac | 2025-06-09 | [第2期の開発成果を報告](https://geniac.meti.go.jp/geniac_magazine/resultsreport_2.html) | 报道发布于 2025-07-10，正文明确活动发生于 2025-06-09。 |
| geniac | 2026-06-04 | [第4期の基盤モデル開発16テーマを採択](https://www.meti.go.jp/press/2026/06/20260604003/20260604003.html) | 官方原文公表日；16 件及日期由原文检索内容和 [NEDO 同日公告](https://www.nedo.go.jp/koubo/CD3_100421.html)交叉确认。原文直接抓取返回 403。 |
| geniac | 2026-07-02 | [データエコシステムの研究開発9件を採択](https://www.meti.go.jp/press/2026/07/20260702001/20260702001.html) | 公表日及 9 件由[经济产业省新闻分类页](https://www.meti.go.jp/press/category_03.html)及[项目页](https://www.meti.go.jp/policy/mono_info_service/joho/post5g/index.html)确认；原文直接抓取返回 403。 |
| riken-aip | 2016-04-14 | [理研AIPを設立](https://www.riken.jp/pr/news/2017/20170310_1/index.html) | 2017-03-10 官方公告回述的设立日。 |
| riken-aip | 2017-03-10 | [東芝・NEC・富士通との連携センター設置を発表](https://www.riken.jp/pr/news/2017/20170310_1/index.html) | 官方公表日；内容说明 3 月 9 日决定、4 月 1 日计划设立，不把计划当成已发生事实。 |
| riken-aip | 2018-04 | [AI研究用計算機RAIDENを増強](https://aip.riken.jp/pressrelease/raiden180420/?lang=ja) | 原文发表于 2018-04-20，只说明当年 4 月投入运行，保留年月精度。 |
| riken-aip | 2026-04 | [研究体制を3グループへ再編](https://aip.riken.jp/about-aip/?lang=ja) | 机构介绍正文明确从 2026 年 4 月重组；未列具体日或页面更新日，保留年月精度。 |

## 管理与导入

管理员打开 `/admin/topic-chronicle`。点击现有条目的“编辑 JSON”，填写修改原因，再导入并公开；也可直接撤下或重新公开一份档案。所有写操作复用管理员会话和 CSRF 校验，并在同一事务写入审计日志。操作不会调用模型或外部网络。

```json
{
  "topic": "openai",
  "compiledOn": "2026-10-04",
  "through": "2022-11",
  "events": [
    {
      "date": "2022-11-30",
      "kind": "product",
      "title": "ChatGPTの研究プレビューを公開",
      "summary": "対話型AIを研究プレビューとして一般に公開した。",
      "source": "OpenAI",
      "url": "https://openai.com/index/chatgpt/",
      "major": true
    }
  ]
}
```

`topic` 必须是现有公司主题。`date` 保留来源精度，支持年、年月或完整日期；完整日期检查实际日历。`through` 只标记资料收录到的月份，不限制自动新闻的显示；`compiledOn` 是实际编纂日。每条必须带出典名和无认证信息的 HTTPS 原文地址。`kind` 为 `model`、`product`、`research`、`company` 或 `industry`。`item` 可选，关联同一事件的当前站内文章 ID；当该文章仍在 publication 层公开且属于本主题时，横向时间轴按文章 ID、事实 ID 或故事 ID 合并自动节点。关联撤稿或移出本主题后，不再显示站内链接，也不会压掉其他公开事件。没有明确关联时保留两条，避免凭标题猜测误合并。来源明确允许前不导入全文。一次最多 1000 个短节点。

管理 API：`GET /api/admin/topic-chronicle`，`POST /api/admin/topic-chronicle/import`（`document`、`reason`），`POST /api/admin/topic-chronicle/:slug/visibility`（`enabled`、`reason`）。公开页面继续使用框架的 `GET /api/site/topics/:slug`，数据位于 `modules["topic-chronicle"]`。

## 集成与迁移

三清单分别导入：

- `@aihot/topic-chronicle` → `topicChronicle`
- `@aihot/topic-chronicle/server` → `topicChronicleServer`
- `@aihot/topic-chronicle/web` → `topicChronicleWeb`

`site/package.json` 依赖 `@aihot/topic-chronicle: "*"`；Docker 增加模块 package.json 的 COPY。模块只使用仓库现有依赖。执行正常迁移会应用 `modules/topic-chronicle/migrations/0059_topic_chronicle.sql`，新增模块表 `topic_chronicles`；不删除任何已有数据。首次运行可直接读取随代码附带的历史档案。管理员导入与撤下保存于数据库，后续更新附带 JSON 不覆盖这些决定。本次扩充没有写入运行数据库；若数据库里已存在旧版同名档案，需管理员逐主题导入 `data/histories.json` 中的对象，或由部署步骤调用同一 `saveHistory` 流程并记录原因。撤下状态也应由管理员明确决定是否重新公开。

后端通用 `loadTopicPage` 必须等待模块 `part()` 的异步结果，否则 JSON 会出现 Promise 的空对象；相应行为测试覆盖真实主题页面和 HTTP 返回。

## 验证

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aisignal_chronicle_test'
$env:COLLECT_ENABLED = 'false'
$env:MODEL_CALLS_ENABLED = 'false'
node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test 'modules/topic-chronicle/tests/*.test.ts'
```

测试使用独立测试库及每文件副本，不读取真实密钥，不访问外部服务。覆盖原版选择回归、日文筛选、原始日期、出典校验、导入与审计、鉴权/CSRF、历史撤下、新闻撤稿、多来源排序、稀疏档案与同月新事件共存，以及明确关联的重复事件合并。根代理另行完成全项目 typecheck、后端测试、web build、网页测试和本地浏览器验收。

2026-10-04 最终模块验收：上述模块测试 **41/41 PASS**；`node node_modules/typescript/bin/tsc -p modules --pretty false` **PASS（退出码 0）**。测试输出有框架现有的 Fastify `FSTDEP023` 弃用警告，无模块测试失败。

50 条数据逐一通过现有 `parseHistory` 校验，并检查主题及同日同链接不重复。独立 HTTP 连通性检查见 `modules/topic-chronicle/data/source-check.json`：48 个去重地址中 35 个返回 200、8 个返回 403、5 个连接失败，因此自动直连检查为 **PARTIAL**。内容及日期已经通过上表官方资料核查；直连受限没有被改记为 PASS。全项目测试曾启动后依主任务要求中止，完整项目验收由主任务统一完成。

