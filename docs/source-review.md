# 首批来源核验

核验日期：2026-10-04。HTTP 检查使用独立标识 AISignalJPBot/1.0；只读访问，没有绕过登录、验证码或付费墙。配置在 `industry/sources.json`，每小时检查、首次回填最多 8 条、全文展示与全文分发均关闭。来源名称和链接必须保留。

**当前十二源均保持停用。** 技术检查通过仅说明可以解析，不等于取得内容再利用许可。已发现的限制与尚未明确的许可范围列在下表；确认摘要生成、公开分发及传给模型处理的使用条件后，运营者逐源启用。不得将模型、代码仓库或 API 服务的许可证当成新闻正文的许可证。

| 来源 | 采集核验 | 使用条件核验与下一步 |
|---|---|---|
| OpenAI | 官方 RSS 200，1,245 条 | [政策入口](https://openai.com/policies/)；RSS 可读取，但未确认摘要自动生成和公开分发的独立许可。保持停用。 |
| Anthropic | 新闻 HTML 200，15 条 | [条款入口](https://www.anthropic.com/legal/commercial-terms)主要针对服务，不能据此认定新闻内容可再利用。保持停用。 |
| Google DeepMind | 官方 RSS 200，100 条 | [Google 条款](https://policies.google.com/terms)；未确认对该新闻订阅内容的明确再利用范围。保持停用。 |
| Hugging Face | 官方 RSS 200，873 条 | [服务条款](https://huggingface.co/terms-of-service)；不同作者和仓库的许可不相同，未确认博客通用许可。保持停用。 |
| Microsoft Research | 官方 RSS 200，10 条 | [版权说明](https://www.microsoft.com/en-us/legal/intellectualproperty/copyright)；不能将产品或代码许可扩大到新闻正文。保持停用。 |
| NVIDIA | 官方 RSS 200，18 条 | [网站条款](https://www.nvidia.com/en-us/about-nvidia/terms-of-service/)；未确认自动摘要及公开分发许可范围。保持停用。 |
| AWS ML | 官方 RSS 200，20 条 | [网站条款](https://aws.amazon.com/terms/)；需要区分个人访问与本站自动摘要分发。保持停用。 |
| GitHub AI | 官方 RSS 200，10 条 | [GitHub 条款](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)；代码仓库开放不等于博客正文开放。保持停用。 |
| Sakana AI | 官方博客 HTML 200，标题链接可解析 | 博客页未找到明确内容再利用条款；Sakana Chat/API 条款不作为博客授权。保持停用。 |
| Preferred Networks | 官方日文新闻 HTML 200，6 条本站新闻链接 | 外部 PR TIMES 链接排除；站内未确认通用摘要再利用许可。保持停用。 |
| GENIAC | 官方 HTML 200，3 条新闻卡片 | robots 请求返回 403，未通过采集使用条件核验；不自动套用其他政府网站的许可。保持停用。 |
| RIKEN AIP | 官方新闻列表 HTML 200，10 条 | [AIP 条款](https://aip.riken.jp/policy/?lang=ja)禁止未经许可的转用、转载和改编；链接原则上允许。摘要处理需单独确认，保持停用。 |

ITmedia 未配置：[RSS 条款](https://corp.itmedia.co.jp/media/rss_condition/)对摘录、改编和翻译有限制。

热度计数使用 `owner_entity_id`，相同机构的不同语言来源沿用同一 ID。GitHub 与 Microsoft Research 在此配置中同属 `microsoft`，AWS 为 `amazon`；以后新增英文/日文版本不得创建第二个来源主体。技术核验仅针对以上 URL 与当日页面，源站改版后须重新验证。

启用步骤：保存条款 URL、核验日期、允许的处理范围及依据；检查 robots 和列表解析；先做少量受限环境采集，核对原文与日文摘要；最后在后台启用。来源的全文许可始终独立于摘要采集开关。

## 本轮限定规模的本地内容准备

用户随后明确要求真实文章和上线前内容量。本轮手动限定为 OpenAI 40、DeepMind 30、Hugging Face 35、Anthropic 15、Sakana 20、PFN 6，共 146 篇，经真实 OpenAI 流水线形成日文短摘要；没有改变全部来源的停用状态，没有开放公网或原文全文。默认新来源首次回填仍为 8 条；本地首批导入使用单独的明确上限。

实际处理修复了 Sakana 省略外层 HTML 时正文解析失败、Sakana/PFN 新闻卡片无法取得邻接日期的问题。首批146篇的原始日期均已取得，并与实际发现、模型处理和补编时间分开保存。PFN 外部 PR TIMES 链接仍排除。Hugging Face 的客座博客作者不能按托管域名自动归为 Hugging Face 研发成果，相关提示词与首批稿件已修订。

本地采集与复核成功不改变上表的公开使用条件状态；持续采集和外部发布前仍需逐源落实允许范围。
