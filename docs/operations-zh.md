# AI Signal JP 运营和部署手册

当前交付范围是本地预览与部署包，尚未公开上线。上游基线为 `9848e936106db037d99a304887c36aad3fd0fad4`；保留 MIT 许可证和上游署名。后台为中文，前台与生成目标语言为日文。

日常登录、筛选文章、改稿、撤稿、信源、费用与 SEO 配置，见 [后台内容管理与 SEO 操作手册](admin-and-seo-zh.md)。

## 本地预览

本工作区已经准备 Node 24、依赖和独立 PostgreSQL 17。完整候选版地址为 `http://127.0.0.1:3100`，内容数据库为 `aisignal_launch`，PostgreSQL 监听 `127.0.0.1:55432`。实际 OpenAI 流水线处理六个官方来源，保留日文短摘要、原文链接、原始日期、真实双次评分和费用回执，具体数量见 [完整交付记录](verification-launch-20261004.md)。

初始的 8 篇免密钥预览仍保存在单独的 `aisignal_preview`，不覆盖完整内容库。历史导入不伪造热度、发现时间或历史配信记录；历史报表带「補編」标识与真实生成时间。AI逐条复核与运营者的100条人工评测分开记录。

重新启动（在 `D:\Projects\aihot`，使用 PowerShell 7）：

```powershell
# 本工作区的专用数据库。已运行时不必重复启动。
& .data/postgres-runtime/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe -D .data/pg17 -l .data/pg17/server.log -o "-h 127.0.0.1 -p 55432" start
npm run build -w @aihot/web
node scripts/serve-local.ts --database postgres://postgres@127.0.0.1:55432/aisignal_launch
```

如果换一台电脑，先准备 Node 24.11+、PostgreSQL 17、`npm ci`，然后运行 `node scripts/init-env.ts`、向新的空库恢复内容快照，再运行上述构建和启动命令。便携 PostgreSQL 只在本工作区 `.data` 中，不包含在源码部署包内。生产使用 Compose 的数据库。

`serve-local.ts` 只接受本机已有库，不导入示例、不做迁移，强制关闭采集、模型调用和推送，绑定回环地址，不启动 worker。Ctrl+C 停止 API 和 Web。后台入口 `/admin/login`，密码在本地 `.env` 的 `ADMIN_PASSWORD` 中，请在本地编辑器查看，不要粘贴到聊天。Web 子进程不接收模型密钥或数据库凭据。

## 服务器准备与首次部署

默认候选为 AWS Lightsail 东京、Linux、2 vCPU / 4 GB / 80 GB / IPv4。计划中的 $24/月仅为预算基准，实际购买时核验套餐、税费和汇率；总预算超过人民币 300 元/月时先调整方案。当前没有购买服务器。

1. 准备 Linux、Docker 和 Compose v2；防火墙只开放 80/443，SSH 限自己的管理 IP。分配静态 IP，域名解析到该 IP。不要开放 5432、3000、3001。
2. 将源码部署包解压到独立目录，例如 `/opt/ai-signal-jp`。将独立内容 `.dump` 和对应 `.sha256` 通过私密传输放在站点静态目录之外；不要上传本机 `.env`、整个 `.data` 或旧的8篇预览库。
3. 在可信本地终端运行 `node scripts/init-env.ts`，或复制 `.env.example` 后用安全编辑器填写随机密钥。脚本会保留已有值、补齐空的认证密钥，不向控制台输出密码。生产设置 `SITE_URL=https://新域名`、`SITE_DOMAIN=新域名`、`TRUST_PROXY=true`、`SITE_PREVIEW=false`。数据库密码建议使用初始化脚本生成的十六进制值。
4. 用户已明确授权在 Default project 创建本项目专用密钥，本地真实调用已通过。通过安全配置将本项目密钥写入服务器 `.env`，保持 `OPENAI_MONTHLY_BUDGET_USD=8`。本站80%告警与月预算由应用执行；**未修改共享 Default project 的平台预算，不能声称平台 $8 硬额度已设置**。不要把密钥写进命令参数、Git或聊天。
5. 在服务器交互执行 `docker run --rm -it caddy:2-alpine caddy hash-password`，自行输入试运行口令；将得到的哈希以**单引号**包裹保存为 `PREVIEW_PASSWORD_HASH='$2a$…'`，避免 Compose 插值。保留 `CADDY_CONFIG=./deploy/Caddyfile.restricted`，设置 `PREVIEW_USER`。这层鉴权覆盖网页、RSS、API、MCP 和静态文件；管理员登录仍需自己的密码。
6. `chmod 600 .env`。要保留首批文章，先按下一段将内容快照导入新空库，再执行 `bash deploy/deploy.sh`。脚本构建镜像、迁移数据库、导入停用的来源、启动服务并做内部冒烟检查。没有默认数据库密码。检查外部 HTTPS：未带口令应为 401，带口令应能正常访问，响应包含 `X-Robots-Tag: noindex, nofollow`。

首次新库在运行 `deploy/deploy.sh` 之前执行 `bash deploy/import-launch-content.sh /private/path/ai-signal-jp-content-20261004.dump`。它先核对散列，只允许空库，拒绝覆盖已有表。快照排除本地管理员和会话，保留真实内容、来源游标、榜单、监控、大事记、报表与费用回执，避免重启后重复付费。随后执行 `bash deploy/deploy.sh`。

所有来源默认停用，`COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`，所以恢复后可以浏览已有真实新闻，但不会自动生成新稿。完成来源核验、评测与账号预算后，通过后台逐源启用，再修改两项开关并重启 API/worker。来源采集最短间隔 60 分钟；模型只在 worker 中调用，读者访问不计模型费用。榜单更新还需要 `LEADERBOARD_REFRESH_ENABLED=true`。

## 费用、模型和质量

默认所有生成阶段 `gpt-6-luna`；向量 `text-embedding-3-small`。两个评分调用保留独立 attempt 身份，不合并为一次调用。正常 429 限流按上游退避重试；额度/余额错误写入 `provider_pauses` 并阻止新的付费请求，重启后仍有效。已记录的成功回执可以重用，已发布页面继续可读。

本地 `OPENAI_MONTHLY_BUDGET_USD=8` 按 UTC 自然月汇总本库所有 OpenAI attempts，包括向量和重试，80% 时在后台运行告警中提示。费用是按 token 和登记单价**估算**的，未知用量、并发在途请求和其他数据库中的调用可能未计入，不能替代平台硬额度。平台可能短暂延迟熔断，必须保留预算余量。没有配置通知目的地时，提醒仅出现在后台，不会擅自发送邮件或飞书消息。

充值或调整配额后，先确认平台状态，再由管理员手动解除相应暂停；例如在本项目数据库执行 `DELETE FROM provider_pauses WHERE service='openai';`。不要循环清除暂停，也不要为了重试清空回执。后台有每日请求次数预算，与金额预算同时生效。

人工标注准备见 [日文评测](evaluation-ja.md)。当前 100 条候选记录不等于 100 条已人工标注，也没有 27/30 日文质量验收成绩。未通过前保持公开自动发布关闭。

## 内容与来源

候选来源、解析验证和权利核验记录见 [source-review.md](source-review.md)。GitHub AI 与 Microsoft Research 同归 `microsoft`；同一机构的不同语言版本不得当成独立来源增加热度。ITmedia 未配置。候选 RSS 可访问不代表允许摘要改编，核验未完成的来源继续停用。

保留 `site_fulltext=false`、`syndicate_fulltext=false`，默认仅日文短摘要和原文链接。来源明确许可前不启用全文或全文翻译。`*_zh`、`bodyMode=zh` 是上游兼容字段名，本站语义为日文目标文本；翻译表语言使用 `ja`。0055、0056 是新增迁移，不改已发布迁移，不删除历史 `zh` 翻译。

所有显示和报表边界用日本时间，数据库保存 UTC。日报每日 08:00，周报周一 10:00，月报每月 1 日 10:30。日报按规则编排，不调用模型；周月报从日报汇编，模型失败时仍可使用有出处的规则汇编，后台保留错误记录。

## 每日备份与恢复

使用独立地区或账号的私有 S3 桶，开启加密和“阻止公共访问”。为服务器创建仅能向该桶 `daily/*`、`weekly/*`、`monthly/*` 写入的权限；恢复账号另授只读权限，不给网站删除备份的权限。不要将备份通过公共网站提供。

配置 `DB_BACKUP_STORE_SECRET_ID/SECRET_KEY/BUCKET/REGION/DOMAIN`。AWS 的 DOMAIN 为 `桶名.s3.区域.amazonaws.com`；必须填写，未填时上游默认的是 COS 域名。密钥属于服务端配置。安装桶生命周期 `deploy/s3-lifecycle.json`：日备份 7 天、周备份 28 天，上游额外月备份 35 天；删除由对象存储生命周期执行，通常有延迟。日备份每天日本时间 04:10，周日另存一份周备份。

手动验证：

```bash
docker compose exec -T worker node scripts/backup-now.ts
docker compose logs --tail 100 worker
```

一次成功备份必须同时含匹配时间戳的 `.dump` 和 `-files-.tar.gz`，`backup.last` 记录字节数、SHA-256 和上传结果。文件包保存 `uploads/` 和仍保存在本地的反馈截图，缓存不备份；三个本地副本不是异地备份。

从对象存储私下下载一对文件到**只含这一对备份的目录**，核对 SHA-256 后执行：

```bash
bash deploy/restore-check.sh /absolute/path/to/backup-pair
```

脚本恢复到新命名、无网络的 PostgreSQL 容器和两个新卷，验证迁移表与公开内容表可读，列出附件数，结束时停止容器但保留卷供审查；不覆盖生产库。请进一步对照预期行数与附件、在受限环境启动恢复站点并做页面验收。只信任本站生成且散列已核对的归档。

本机数据库与附件配对恢复已通过自动测试；真实 S3 上传、Linux Docker 恢复和恢复站点验收尚未执行。生产故障恢复前先停止写入并保存当前状态，确认数据时间点，再单独决定切换数据库与数据卷，不能把演示库覆盖到真实库。

本轮首批内容快照另外完成一次真实 PostgreSQL 17 恢复：新库 `aisignal_restore_20261004` 的71张表行数和内容摘要与一致性快照匹配，10个公开读取接口通过。恢复库不包含本地管理员/会话，未覆盖原库。Compose 健康检查使用 TCP，避免误把 Docker 镜像初始化期间临时的 Unix socket 实例当成可恢复目标。

## 更新、抽检和试运行

更新前保存当前镜像标识、源码包 SHA-256、配置备份和一对异地备份。新版本先在新库恢复演练，执行迁移、测试，再停止 worker 等待在途请求结束。Compose 给 worker 210 秒退出时间，不要强杀造成付费回执状态未知。`bash deploy/deploy.sh` 不删除卷；**不要执行 `docker compose down -v`**。

每天抽查新发布内容的原文、数字、人名和链接；检查错误归并、重复报道、日本语气、来源失败和费用告警。撤稿通过后台内容管理执行；页面、API、RSS、报告引用共同读取 publication 层，不可只删页面缓存。

在整站鉴权环境实际连续运行至少 72 小时，记录起止时间、每小时采集、定时报表、费用、任务失败与恢复、备份上传与一次恢复。不能用本地样例或一次冒烟代替 72 小时。评测、条款确认、域名/联系邮箱、API预算、Linux CI、备份恢复全部满足后，才将 `CADDY_CONFIG=./deploy/Caddyfile` 并重新创建 Caddy 开放访问；保持后台鉴权。

## 新增模块与历史补编

- `/leaderboard`：五个综合榜与原始出典、模型详情、方法说明。真实分数与采集时间分开保存；某些第三方评测的再分发条件仍待确认，见 [榜单文档](model-leaderboard-jp.md)。
- `/codex-reset`：有官方依据的重置历史和免费服务状态。没有原始时刻的数据不制造精确时间；服务故障不等于额度重置。后台 `/admin/monitor`。
- 公司/主题页的大事记：官方历史节点和当前公开资讯组成，后台 `/admin/topic-chronicle` 可导入、撤下。
- 历史报表：`node --env-file=.env scripts/compose-retrospective.ts --from 2026-06-01 --to 2026-10-04` 默认只检查。加 `--apply --periods` 才补编日报及已结束的周/月；已有报表保留，不伪造过去的生成时间。周月报调用仍经过回执和预算。

## 常用排查

- 页面空白：检查 `docker compose logs --tail 100 api web`、`/api/health`；来源停用或无符合条件内容时空列表是正常状态。
- 没有新内容：依次检查来源启用、两个安全阀、来源失败、后台运行队列、预算暂停；不要通过清空回执解决。
- 配置改了未生效：重建/重启全部相关 API/worker；修改站点文案与品牌后需要重新构建 Web。
- Linux 验证：仓库 `.github/workflows/check.yml` 包含 PostgreSQL 17、类型检查、完整测试、Web 构建与冒烟。Windows 跳过 8 个依赖 POSIX 信号/权限的测试，Linux 必须执行它们。
