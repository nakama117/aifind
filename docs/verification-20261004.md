# AI Signal JP 交付与验证记录

这是第一阶段8篇真实预览的历史记录。当前扩展版本、专用 Default project 密钥与完整内容交付，以 [最新记录](verification-launch-20261004.md) 为准。

日期：2026-10-04。范围：按用户最后要求，先完成**本地预览与部署包**。生产未上线。工作目录 `D:\Projects\aihot`，分支 `codex/ai-signal-jp`，上游基线 `9848e936106db037d99a304887c36aad3fd0fad4`。

## 实现

- 日文前台、导航、分类、主题、SEO、分享图、Noto Sans JP 字体和独立信号图标；中文后台保留。
- 日文生成提示词，生成标题允许汉字和假名，原文语言与正文免译采用严格日文判断。内部 `_zh` 和公开兼容字段保留，新增迁移设置翻译语言 `ja`。
- 展示、来源日期解析、日报与周月报边界、定时任务统一 Asia/Tokyo；数据库仍存 UTC。
- OpenAI GPT-6 Luna / text-embedding-3-small 默认模型，兼容参数、双次独立评分、可恢复回执、token 费用估算、80% 告警、持久费用暂停。文章和归组均可在解除暂停后继续。
- 12 个首批来源技术验证及使用条件记录；未完成权利核验的保持停用，ITmedia 不接入，全文和全文翻译默认关闭。
- 隔离的本机 `_preview` 数据库；迁移前和导入前均拒绝非预览资料，8 篇经官方原文核对的真实新闻日文摘要；无虚构评分、事件或报表，采集与模型开关强制关闭，无 worker。
- Compose 私有数据库、回环 Web 端口、Caddy 受限试运行配置，部署、手动备份、隔离恢复脚本与中文运营手册。
- 100 条真实来源标题/URL 的待标注候选清单（70/30），未填写人工金标或质量判定。

## 验证证据

本地原始日志保存在 `.data/verification/`（不随部署包分发）。Node 24.14.0，PowerShell 7.6.5，专用 PostgreSQL 17；使用实际 PG17 的 pg_dump/pg_restore 完成备份恢复测试。

| 检查 | 状态与证据 |
|---|---|
| 上游基线 | 类型、Web 构建、Web 27/27 通过；初始数据库问题来自 Windows 路径、POSIX 信号和缺少 PG 客户端，均有记录 |
| 最终类型检查 | PASS，`typecheck-real-news.log` |
| 数据库全套 | PASS，523 项中 515 通过、0 失败、8 个 Windows 限制项跳过；`full-real-news.log` |
| 定向审查修复 | PASS，费用暂停恢复 7/7，归组恢复/语言/预览库保护 15/15 |
| Web 构建及测试 | PASS，`web-build-real-news.log`、27/27，`web-tests-real-news.log` |
| 页面与接口冒烟 | PASS，`smoke-preview.log`；网页、RSS、公开 API、OG、图标、MCP initialize 全通过 |
| 浏览器桌面/手机 | PASS，1440×1000、390×844 共 22 页面，0 脚本异常、0 横向溢出；`browser-preview.json` |
| 浏览器交互 | PASS，日文搜索提交、空结果、收藏跨导航保留、搜索繁忙状态、缺失文章；`browser-interactions.json` |
| 真实预览内容 | PASS，8 篇逐条核对全量精选快照、RSS、手机详情页中的摘要/原文链接/发布时间；`real-news-outlets.json`；零评分、零虚构文章、零模型请求、零启用来源，`preview-isolation.json` |
| 部署与恢复脚本 | Bash 语法 PASS；真实 Docker/Caddy/S3 执行 UNRUN |
| 独立代码复核 | PASS（本地预览与部署包范围）；已修首次费用拒绝与归组恢复、短帖语言、迁移前检查、恢复服务 readiness；复核未发现剩余重要问题 |

真实文章替换亦经独立只读复核，无重要问题。`preview-news.test.ts` 先在旧虚构种子上因缺少真实官方文章失败，再在新导入上通过；覆盖原始时间、当前导入时间、重复导入以及不伪造评分/模型分析/历史报表。普通 `/api/v1/items` 仍按上游滚动 7 日窗口返回近期内容，全部历史精选可通过 `/api/v1/selected/snapshot` 读取。

Windows 的 8 个显式跳过项：5 个 POSIX SIGTERM 优雅退出测试、2 个 shell tar 故障注入测试、1 个需要符号链接权限的测试。Linux CI 保留这些测试，不能把 Windows 通过等同于 Linux CI 通过。为 Windows PID 在同一测试套件内复用导致的数据库重名，测试数据库名增加随机后缀；这不改变生产数据库命名。

## 尚未完成的公开上线条件

- **UNRUN**：Linux Docker/CI、实际域名 HTTPS、S3 异地上传及云端恢复、连续 72 小时受限采集与运行。
- **PENDING**：运营者联系方式、正式域名、条款与隐私页确认、来源处理许可。
- **PENDING**：独立 OpenAI 项目及平台 $8 硬额度/80% 提醒。本地配置的连接器密钥实际属于 Default project，不能声称独立项目已创建。
- **PENDING**：100 条人工标注、按事件隔离的 70/30 划分、30 条独立输出的日文/事实/归并验收。候选清单没有代替人工签核。

当前工作区是为此任务新建的专用克隆，直接在此分支实现，没有另外创建 worktree；没有覆盖用户旧修改。源码未推送至上游，`.env`、密钥、数据库和运行时均不进入部署包。包内 `RELEASE-MANIFEST.json` 记录每个交付文件的 SHA-256；外部 `.sha256` 校验整个 ZIP。

预览截图：[桌面首页](preview/desktop-home.png)、[手机首页](preview/mobile-home.png)、[手机日报](preview/mobile-daily.png)。首页使用真实官方新闻摘要，日报为尚未生成的空状态；自动更新关闭。真实内容清单及时间依据在 `site/preview-news.json`，不包含全文。重新生成源码包：`python deploy/package-release.py`；需 Python 3 和 Git，打包当前文件而非仅打包 HEAD。
