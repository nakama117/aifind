# Codex 公开公告监控

模块目录：`modules/codex-monitor/`。公开页面使用日文；管理界面使用中文；确定的时刻以绝对时间保存、JST（Asia/Tokyo）显示。原文只给日期而未说明时区时保留原文日期并明确标注，不伪装成 JST。数据属于公开额度重置公告，不是用户个人 Codex 剩余额度。

## 已恢复的功能

- `/codex-reset`：官方公告、实施状态、确认依据、来源时间和原文、JST 月历及日期筛选、最近 90 天已确认事件统计、重置间隔中位数、原文明示的实际实施时间分布。确认帖时间不能代替到账时间。
- 状态分开显示“实施予定 / 实施中 / 确认済み / 予定時刻経過・未確認”。时间经过不能自动确认完成，推测也不计入已确认统计。
- 来源与短摘要、确认/进展/上下文记录随事件展示；公开只提供必要短引文，不提供全文转载。采集的完整纯文本修订仅后台可见。
- 中文后台 `/admin/monitor`：JSON 文件导入、日文内容和时间编辑、来源编辑、人工确认、撤回与恢复。所有写入有管理员身份、CSRF、并发版本检查和审计记录。
- 撤回从同一公开读取层移除事件、日历、统计、来源动态、Agent Markdown 和 MCP 数据。管理员可以查看已撤回记录。
- 免费 [OpenAI Status JSON](https://status.openai.com/api/v2/incidents.json) 的 Codex 服务事件刷新；状态源最后尝试/成功时间分开显示，失败保留旧数据并明确标注。该端点于 2026-10-04 核对为公开 JSON。它不是额度重置公告源。
- 前台每 60 秒在可见状态下检查本站版本；变化后重新读取。页面读取不触发采集或模型请求。
- 官方帮助页 / 博客 feed 的免费采集、可选 Tibo / OpenAI / OpenAIDevs X 采集、来源修订持久化、OpenAI 独立声明识别、公告/进展/确认/修正/撤回、人工复核与重试。一个原文中的直接重置与保存型重置分别建立记录。

## 自动采集与安全开关

默认来源为两篇已核验的官方帮助页、`https://openai.com/news/rss.xml`，以及默认停用的 `thsottiaux` X 账号。后台“重置公告自动采集”可配置 `official_page`、`official_feed` 与 `x_search`；只接受 OpenAI 官方 HTTPS 页面（不含服务状态站、凭据或查询参数）和三个列明的 X 账号。博客 feed 最多检查最新 40 个条目，只读取其中提及 Codex 的官方文章；不是历史全站爬取。

只有 `COLLECT_ENABLED=true` **且** `CODEX_MONITOR_ENABLED=true` 时公告 worker 才每 10 分钟运行。模型还须 `MODEL_CALLS_ENABLED=true`，使用后台模型步骤 `codexMonitor` / 环境变量 `CODEX_MONITOR_MODEL`，本站默认 `gpt-6-luna`。代码拒绝非 OpenAI 模型；所有模型请求由 `chatJson` 进入共享回执和 OpenAI 月度 USD 熔断（默认 $8）。采集成功但模型关闭时只保存待处理资料，不生成事件。后台“排队采集并识别”仅入 worker 队列，API 请求本身不调用模型。

X 使用既有 SocialData 适配器与服务预算/回执，凭据为服务端 `SOCIALDATA_API_KEY`（可选 `SOCIALDATA_BASE_URL`）。X 需要单独供应商费用，不属于 OpenAI $8 模型预算；未购买、未配置、未真实调用。默认 X 来源 `enabled:false`，不会因为已有其他采集凭据就自动启用。启用但缺凭据时明确显示 `missing_credentials`。搜索保存分页积压和游标，错误作者不能推进可信账号游标；短回复读取最多两级原帖上下文，付费上下文也复用回执。尚有分页积压时不提前解释其后来的确认帖。

公开投影分别显示公告最近尝试、来源读取成功、声明处理、设置范围全部处理时间和待处理/复核数；它们与 OpenAI Status 的时间完全分开。全部处理只表示已配置且启用的来源没有积压与待复核，不意味着 X 全覆盖、过往全历史或个人额度已观测。原站 34 日左右的历史及 X 独有公告并未借中文二手摘要补造。

OpenAI Status 仍只受 `COLLECT_ENABLED=true` 控制；事故恢复不能产生重置确认。网页读取不会触发上述任意外部请求。

## 自动识别的证据边界与复核

- `0061_codex_monitor_collection.sql` 新增私有来源修订与处理状态，并给事件增加 `managed_by`。原有 `0058` 不改。页面响应最多 2 MiB；正文最多 60,000 字符，保留纯文本与来源哈希；单次模型最多处理 24,000 字符，超长原文进入人工复核，不截断后假装完成。
- 修改时间和相对更新时间不能当原始发布时间；未知发布日期保持 `null`。来源观察时间只写 `observedAt` / 公开 `verifiedAt`。没有任何事件日期时不放入日历；只有公开日期的记录按告知公开日摆放，明示不等于实际实施日。实施日期未知的确认不进入 90 日统计，精确时刻未知的确认不进入间隔和时间分布。
- 模型提示词把正文、回复、引文及已有事件文字明确当作不可信资料。输出为独立声明，普通周期限额/保存型重置机制说明、问题、假设、未来承诺、障碍恢复不会当成完成。原文引文必须逐字来自当前正文；确认句中的未来/机制措辞会被拒绝。相对时刻不按惯例猜测，自动精确时间只接受原文明示的带时区 ISO 时间；明确完整日期单独保存，时区未知保持 `unspecified`。
- 未明确关联的更正/撤回、非可信短回复、模型提出的疑点、已有人工记录、同类型同日期疑似重复都进入复核。原文消失、HTTP 失败或句子删除不会自动撤回既有事件。原文明确撤回时有来源修订和审计，事件立即从公开投影各出口消失。
- 后台可查看原文修订、识别 JSON、处理原因与回执编号，修正后“审核应用”或填写原因忽略；失败项可重试。审核仍校验原文引文、日期和事件关联；不能用审核按钮批准无依据的精确时间。人工编辑/审核后转为人工管理，自动任务不会覆盖或恢复已撤回记录。
- 撤回/人工管理保护在服务端依来源、已应用修订和事件证据检查，不依赖模型返回旧 ID。模型省略关联 ID 或同页文字更新时，同一次或无法消歧的声明转复核；同页明确不同日期的新事件仍可收录。精确时间先按 UTC 归一后比较，换时区表示不会变成新事件；日期精度混合及跨日窗口按可能重叠保守处理。既有事件上下文保留撤回/人工管理标记，这些管理字段不进入公开投影。
- 识别的 `summaryJa` 与公开来源 `textJa` 同为最多 1,000 字符。已得到有效识别结果但最终事件格式不合法（例如逆序时间窗、来源数量超限）时保留结果与回执并进入人工复核，后续文档继续处理；不会重复使用同一回执失败而持续堵住队列。

## 一次性免费官方来源验收

默认命令只展示计划，不访问网络或数据库；CLI 不读取 `.env`、不自动开启安全阀、不会运行 X：

```powershell
node modules/codex-monitor/scripts/scan-announcements.ts
```

授权运行的父进程须已设置 `CODEX_MONITOR_ENABLED=true`、`COLLECT_ENABLED=true` 并显式选定数据库。仅采集免费官方页面，**不调用模型**：

```powershell
node modules/codex-monitor/scripts/scan-announcements.ts --apply --database postgres://postgres@127.0.0.1:55432/aisignal_launch --mode collect
```

核查后台原文后，若模型安全阀与现有 OpenAI 凭据/预算已由操作者授权配置，可仅处理已保存的官方来源（不再抓页面）：

```powershell
node modules/codex-monitor/scripts/scan-announcements.ts --apply --database postgres://postgres@127.0.0.1:55432/aisignal_launch --mode process --limit 1
```

`--mode run` 合并两步；三个模式均强制 `officialOnly:true`，不会触发 X 或为其支付费用。CLI 每次最多识别 `--limit` 条来源修订，默认 1、可选 1–20；周期 worker 每轮最多 20 条。仅使用已启用的官方来源，省略 `--apply` 保持 dry-run，省略 `--database` 拒绝执行。输出失败计数非零时退出码为 1，安全阀关闭时如实报告 skipped。CLI 和周期 worker 共用 PostgreSQL 会话锁。

2026-10-04 13:04 UTC，主任务在授权的 `aisignal_launch` 执行一次 `--mode collect`：`stored=0, failed=3`，两篇帮助页和官方 RSS 均明确返回 `source_http_403`。没有调用模型、X 或付费社交 API，没有绕过访问限制。证据在本地 `.data/verification/codex-official-collect.log`（不提交）。因此实际来源连通验收为 **PARTIAL**：链路与失败状态可运行，但免费公告源尚未从该运行环境成功采集，不能称为已接通的实时重置监控。此前手动核验的三条真实官方历史仍可读取；自动识别链路仅由本地假服务验证，未执行真实付费验收。

## 人工导入与修正

1. 打开官方原文，核实发布时间、涉及的 Codex 产品和计划、预告或完成措辞，以及是否只是服务恢复。
2. 写简短的日文标题、摘要和来源摘要；保留原文链接及必要短引文。适用对象未说清楚时 `scopeJa: null`。
3. 在 `/admin/monitor` 导入 JSON 文件或粘贴 JSON。一个批次最多 100 件，同 ID 拒绝覆盖；整个批次在一个事务内写入。
4. 事件修改在下方 JSON 编辑器完成，并填写变更原因。`reason` 只进内部审计，不在公开投影中输出。来源错挂时在相应事件编辑中修正 `sources`；不要把未确认来源改成完结确认。
5. 撤回后立即从所有新读取的公开出口消失；恢复也须填写原因。当前打开的前台会在下次本站版本检查时刷新。

以下是**字段格式说明**，不是历史事件；所有占位文字与时间必须先用实际原文核实并替换，不要直接导入：

```json
{
  "events": [{
    "id": "replace-with-reviewed-id",
    "type": "direct_reset",
    "titleJa": "【実際の告知に基づく日本語タイトル】",
    "summaryJa": "【実際の原文に基づく短い要約】",
    "scopeJa": null,
    "status": "announced",
    "inProgress": false,
    "reportedAt": "【原文の公開時刻。ISO 8601・時区必須】",
    "schedule": null,
    "confirmedAt": null,
    "occurredOn": null,
    "confirmationBasis": null,
    "evidenceJa": null,
    "sources": [{
      "id": "replace-with-source-id",
      "author": "【実際の発信者】",
      "publishedAt": "【原文の公開時刻。ISO 8601・時区必須】",
      "url": "【公式原文の HTTPS URL】",
      "textJa": "【短い日本語要約】",
      "originalExcerpt": "【必要最小限の原文引用】",
      "stage": "announcement"
    }]
  }],
  "reason": "人工核验的范围和理由"
}
```

`type`：`direct_reset` 或 `reset_credit`。`sources[].stage`：`announcement`、`progress`、`confirmation`、`context`。需要时间窗口时，`schedule` 使用 `{ "precision": "exact|window|day", "from": "带时区的 ISO 时间", "through": "带时区的 ISO 时间", "labelJa": "日文时间说明" }`。

确认完成时：`status: "confirmed"`、`inProgress: false`，填写 `confirmationBasis` 和日文公开依据 `evidenceJa`，已知的实际 `confirmedAt` 或 `occurredOn` 才填写；不知道实际日期/时刻时保持两者为 `null`，不能拿确认帖时刻代替。`source_post` 要求至少一个 `stage: "confirmation"` 的官方来源；`receipt_review` 仅表示运营者核对了使用记录，前台明示不能据此推断所有用户均到账。不要上传账户截图、登录信息、余额或可识别个人的数据。

原文没有精确发布时间时，`reportedAt` 和 `sources[].publishedAt` 保留 `null`，通过 `sources[].verifiedAt` 单独记录本网站实际核验时间。原文只给事件日期且时区不明时，设置 `occurredOnTimezone: "unspecified"`；否则日期默认按 JST 理解。既不能把核验时间当发布日期，也不能将日期补成凌晨或中午。精确间隔和小时分布仅使用确知的 `confirmedAt`。

## 已核验的官方历史与导入工具

`modules/codex-monitor/data/official-history.json` 是可直接导入的真实官方记录，不是演示数据。2026-10-04T10:57:24Z 核对了 [Astra 使用与重置说明](https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex) 和 [Codex 计划及保存型重置说明](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)：

| 原文事件日期 | 类型 | 可证实的事实 |
|---|---|---|
| 2026-09-03 | 保存型重置 | 满足条件的既有 Plus、Pro、Business 用户获得该日提供的保存型重置 |
| 2026-09-04 | 保存型重置 | 同类符合条件用户获得该日的另一份保存型重置 |
| 2026-09-07 | 自动重置 | 官方以已实施措辞记载符合条件的 Plus、Pro、Business 利用枠已自动刷新；不增加保存型重置 |

三条事件的精确时刻和日期时区均未披露；帮助页只显示相对更新时间，不能用来推算原始发布日期。导入数据保留这些空值，并公开 `verifiedAt`。这些是官方文件对实施的确认，不是本网站对各用户余额的独立观测，也不代表今后还会再次提供。

默认命令只验证本地 JSON 并报告 SHA-256，不连接数据库：

```powershell
node modules/codex-monitor/scripts/import-official-history.ts
```

明确选定目标后才能导入；不读取 `.env`，不调用模型，不自动迁移，也不覆盖同 ID 记录：

```powershell
node modules/codex-monitor/scripts/import-official-history.ts --apply --database postgres://postgres@127.0.0.1:55432/aisignal_launch
```

日期精度更新只改 JSON 契约，不需要改 `0058` 或新增 DDL。旧有精确时间记录仍可读取。

只读探测官方免费状态源（不写数据库）可运行：

```powershell
node modules/codex-monitor/scripts/probe-official-status.ts --out modules/codex-monitor/data/official-status-probe.json
```

2026-10-04T11:03:40.396Z 的探测为 HTTP 200、JSON schema PASS，共 25 条服务事件，其中 3 条提及 Codex。验证元数据保存在 `official-status-probe.json`，不保存整份原文。实际状态数据刷新仍经原来的管理员/worker 入口和采集安全阀。

## 接入与公开读取

三份清单分别导入：

| 清单 | 导出 |
|---|---|
| `site/modules/index.ts` | `codexMonitorModule` from `@aihot/codex-monitor/module` |
| `site/modules/server.ts` | `codexMonitorServer` from `@aihot/codex-monitor/server` |
| `site/modules/web.ts` | `codexMonitorWeb` from `@aihot/codex-monitor/web` |

`site/package.json` 加 `@aihot/codex-monitor: "*"`；Docker 的依赖阶段复制本模块 `package.json`。解析页面复用仓库已安装的 `cheerio@1.2.0`；自动识别使用既有 OpenAI 模型配置与凭据，不创建或返回密钥。

公开出口统一读取 `modules/codex-monitor/backend/publication.ts`，不直接读取后台审计信息。模块只维护独立公告数据，不把文章绕过核心 publication 层。

| 地址 | 说明 |
|---|---|
| `/api/v1/codex-resets` | 完整公开快照，schemaVersion 2、Asia/Tokyo |
| `/api/v1/codex-resets/recent` | 近 7 天更新及未确认公告 |
| `/api/v1/codex-resets/version` | 本站快照版本 |
| `/api/site/codex-reset?date=YYYY-MM-DD` | 页面数据与日本日期筛选 |
| `/api/site/codex-reset/day?date=YYYY-MM-DD` | 选定日期事件 |
| `/api/site/codex-reset/version` | 前台版本探针 |
| `/api/v1/agent/codex-resets` | 日文 Agent Markdown |
| MCP `<站点前缀>_get_codex_resets` | 相同事实、相同不确定性说明 |
| `/api/admin/monitor` | 管理数据，需管理员会话 |
| `/api/admin/monitor/import` | POST 导入批次 |
| `/api/admin/monitor/events/:id` | PATCH 编辑/撤回/恢复；需 version 和 reason |
| `/api/admin/monitor/refresh` | POST 请求免费官方状态刷新；采集安全阀仍生效 |
| `/api/admin/monitor/sources` | PUT 来源配置；需 version 和 reason，不能写密钥或运行安全阀 |
| `/api/admin/monitor/scan` | POST 排队公告采集/识别；模型在 worker 执行 |
| `/api/admin/monitor/documents/:id/review` | POST 审核应用、忽略或重试失败；需 version 和 reason |

迁移 `0058_codex_monitor.sql` 仅创建 `codex_monitor_events` 和 `codex_monitor_state`，不修改已有数据，不导入旧站数据库或伪造样例。
新增 `0061_codex_monitor_collection.sql` 创建私有来源修订表并标记事件管理权，既有记录默认人工管理；不覆盖或删除原有事件。两个迁移均已由根集成应用，不再编辑其内容。

## 验证

独立数据库使用 `aisignal_monitor_test`；项目测试启动器为每个文件再建隔离副本。

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aisignal_monitor_test'
$env:MODEL_CALLS_ENABLED = 'false'
$env:COLLECT_ENABLED = 'false'
node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test --test-concurrency=1 --test-timeout=120000 'modules/codex-monitor/tests/*.test.ts'
```

本次 17 项模块测试通过。测试覆盖日本时间跨日、不确定性、证据拒绝、批次导入不覆盖、并发冲突、来源引用、撤回同步、统计、官方状态失败保留、匿名/管理员相同投影、管理员/CSRF、安全阀、免费页面修订去重、多独立声明、缺 X 凭据、X 可信作者游标与短回复上下文、共享回执完成、$8 月预算前置阻断、人工管理保护、审核及未知时刻不覆盖已有精确证据。复核新增用例覆盖撤回后无目标 ID 再采集、同页不同新日期、同瞬间不同 UTC offset、摘要长度边界、最终事件校验失败转复核并继续后续文档。网络测试均只连本地假服务；CLI dry-run 不连接数据库。全站 typecheck、构建、浏览器和 smoke 验收由根集成流程执行。
