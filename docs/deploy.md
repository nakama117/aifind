# 部署

> AI Signal JP 请先按 [本项目运营手册](operations-zh.md) 部署。以下保留上游架构和迁移说明；本站默认整站受限访问、全部来源停用、所有安全阀关闭。

### 2026-10-04 本地预览内容更新

本工作区的 `aisignal_preview` 已在备份后删除旧版 8 篇虚构样例、关联事件与 3 份样例报表，替换为 8 篇真实官方新闻的日文摘要。备份在本地 `.data/preview-before-real-news-20261004.dump`，不进入部署包。生产数据库不受影响。旧包的其他预览库建议使用新的本地 `*_preview` 库启动新版，避免混入旧样例。默认生产种子仍仅导入停用的候选来源，不导入这批预览内容。

## 用 Docker（推荐）

需要一台装了 Docker（带 Compose）的机器。云服务器建议至少 2 核、4 GB 内存，构建镜像时要用到。

```bash
git clone https://github.com/KKKKhazix/AIHOT.git myhot
cd myhot
node scripts/init-env.ts
```

`init-env.ts` 会生成 `.env`，填好随机密钥和管理员密码，已有值保持不变，不向控制台打印密码。机器上没有 Node 的话，把 `.env.example` 复制成 `.env`，自己填 `ADMIN_PASSWORD`（至少 12 位）、`SESSION_SECRET`、`IMG_PROXY_SIGN_SECRET`、`POSTGRES_PASSWORD`（各用 `openssl rand -hex 32` 生成）和 `OPENAI_API_KEY`（安全编辑输入）。

启动前检查 `.env` 的 `SITE_URL`：本机试用保留 `http://localhost:3000`；部署到服务器时改成读者实际访问的地址。例如通过服务器 IP 访问时（把示例 IP 换成自己的）：

```dotenv
SITE_URL=http://192.0.2.10:3000
```

RSS、分享链接、站点地图和 Agent Markdown 中的绝对链接都使用这个值，不会随浏览器访问的地址自动改变。使用域名和 HTTPS 时按下方「配域名和 HTTPS」设置。

配置完成后启动：

```bash
docker compose up -d --build
```

默认端口只绑定回环地址，服务器通过受限 Caddy HTTPS 访问。后台在 `/admin`。第一次启动仅导入停用的候选信源，不会自动采集或生成内容。

`docker compose` 会起五个容器：`db`（PostgreSQL 17）、`setup`（每次启动先跑数据库迁移和种子数据，然后退出）、`api`、`worker`（抓取、模型处理、定时任务）、`web`（网页）。`web` 只接收网站地址、API 地址等网页配置，通过 HTTP 读取 API；数据库、模型和管理员密钥，以及数据卷，只交给后端容器。

### 在中国大陆的服务器上

- 构建时 npm 走国内镜像：`docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com`，然后 `docker compose up -d`。
- 拉取 Docker 镜像慢，先给 Docker 配置镜像加速。
- 海外信源抓不到时，在 `.env` 里设置 `EGRESS_PROXY_URL`：抓信源和图片时走这个代理，调用模型接口不走。
- 对外提供网站服务需要先完成 ICP 备案，备案号填在 `site/site.ts` 的 `icp`。

### 配域名和 HTTPS

先把域名解析到服务器，然后在 `.env` 里设置：

```bash
SITE_URL=https://example.com
SITE_DOMAIN=example.com
PORT=127.0.0.1:3000        # 3000 端口只给本机的 Caddy 用，不直接对外
TRUST_PROXY=true           # 访客地址从 Caddy 转来的请求头里读
```

再用带 HTTPS 的方式启动，Caddy 会自动申请和续期证书：

```bash
docker compose --profile https up -d --build
```

已经有 Nginx 的话，不用 Caddy，把站点反向代理到 `http://127.0.0.1:3000`，带上 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`，并在 `.env` 里设 `TRUST_PROXY=true`。`SITE_URL` 一定要写成读者实际访问的地址：生成的链接、RSS、分享图和 MCP 都用它。

MCP 默认接受 `SITE_URL` 的主机以及 `localhost`、`127.0.0.1`、`[::1]`。额外主机用 `MCP_ALLOWED_HOSTS` 配置，以逗号分隔，例如 `extra.example:8443,[2001:db8::1]`。主机名不区分大小写，IPv6 必须加方括号；可带 0–65535 的十进制端口，匹配时忽略端口。包含路径、用户信息或非法端口的配置不会生效。`127.1` 等别名需要明确列入；此配置只影响 Host 校验，不扩大浏览器 Origin 许可。

### 更新

先按下节备份数据库。构建完成后停止旧服务，再运行迁移和新版服务：

```bash
git pull
docker compose build
docker compose stop api worker web
docker compose run --rm setup && docker compose up -d
```

迁移成功后再启动服务；迁移失败时先查看错误，不要继续启动。使用 HTTPS 配置的站点继续保留 `--profile https`。旧的 API 和 worker 要在迁移前停下：迁移可能删表删列，旧代码还在跑会出错；正常关闭 worker 会等进行中的付费调用收尾（最长三分多钟）。非 Docker 部署也按“备份、构建、停止 API/worker/web、迁移（`scripts/migrate.ts`）、种子数据（`scripts/seed.ts`）、启动”的顺序更新。

#### 站点文件搬进 `site/`（2026 年 10 月）

公开接口没有变化，版本仍是 4.0.0。

- **站点自己的文件从 `industry/` 搬到了 `site/`**：`site.ts`、`models.ts`、`brand/`、`pages/`、`public/`、`changelog.json`。`industry/` 只留行业知识：`taxonomy.ts`、`topics.json`、`sources.json`、`prompts/`、`selection.ts`。自己改过这些文件的，合并时把改动挪到 `site/` 下的同名文件。
- **`site.ts` 多了几项**，都可以不填：`SITE.github`、`SITE.llmsIntro`、`SITE.rootIcons`，`POLICY.terms.license`、`POLICY.terms.headers`，`ABOUT.termsAnchor`（二维码卡片可以写 `alias`），以及 `ACCESS`、`ADMIN`、`DEPLOYMENT`、`FEED_COPY`、`PUBLIC_CATEGORIES`，说明见 [把它改成你的行业](customize.md)。
- **`DEPLOYMENT.requiredSecrets`** 是生产 API 启动时额外检查的凭据清单，默认空；基本会话、图片签名和管理员登录校验仍然生效。只有你的部署要求某个可选集成必须配置时才填写。
- **只属于你这个站的功能可以做成模块**：放进 `modules/<名字>/`，在 `site/modules/` 的清单里启用，见 [架构](architecture.md) 的“模块”。框架本身不带模块。
- **Agent 接入页默认打开 MCP**，页面列出 MCP、RSS 和 API 三种接入方式。Agent Markdown 接口仍在 `/api/v1/agent`，可从页面下方“Agent 使用说明”进入。
- **图片代理可以设流量上限**：`IMGPROXY_UPSTREAM_MB_PER_MINUTE`、`IMGPROXY_UPSTREAM_GB_PER_DAY`（或 `site.ts` 的 `DEPLOYMENT.imageUpstreamBudget`），默认不设。
- **修复**：同样的数据每次给出同样的字节（排序遇到并列时补上唯一的次序，API 和 RSS 的 ETag 不再无故变化）；网页转给 api 的请求不再带上逐跳头，`Connection: close` 不再让下一个 POST 失败；`llms.txt` 的接入方式按实际数，不再写成四种。

#### 升级到公开接口 4.0.0

- **模型榜、Codex 重置监控和主题页的大事记不再是框架的一部分**，只留在 AIHOT 上。页面（`/leaderboard`、`/codex-reset`）、接口（`/api/v1/codex-resets`、`/api/v1/codex-resets/recent`、`/api/v1/agent/codex-resets`）和 MCP 工具 `<前缀>_get_codex_resets` 都去掉了，MCP 和 `/openapi-v1.json` 的版本号升到 4.0.0。迁移 `0053` 删掉它们的表（`lb_*`、`monitor_*`、`fx_rates`）和设置，定时任务及其执行队列在 worker 启动时自动撤掉，后台运行记录继续保留；要留这些数据的，升级前先备份。公司主题页的标志改成公司名的首字母。
- **行业包有几处变化**，自己改过 `industry/` 的站，合并时对照新文件补上：
  - `site.ts` 多了 `topicsTitle`、`feedbackExample`、`keywords`、`since`、`interfaceVersion`、`POLICY`（使用规则和隐私说明两页的名字与简介、X 帖子算不算全文）、`ABOUT.description`、`ABOUT.sourcesFallback`、`AGENT`、`REPORTS`、`ALERTS`、`SOURCE_DEFAULTS`、`COMMUNITY_FEEDS`、`CARDS`；作者块的两张二维码卡片加了 `kind`，`ABOUT.copyright` 改成反馈页链接前后的两段。
  - 新增 `models.ts`：具名的模型和每一步默认用哪个，原来写在代码里。
  - 网页左上角的标志从 `apps/web/app/components/Logo.tsx` 搬到 `industry/brand/Logo.tsx`。
  - 新增 `public/`：`robots.txt`、`manifest.webmanifest` 原来在代码里生成，OpenAPI 说明原来在 `reference/`，现在都是这里的文件。原来填了 `contactEmail` 就会生成的 `/.well-known/security.txt`，现在要自己放一份 `public/.well-known/security.txt`。
  - 删掉了 `features.ts`、`chronicle.ts` 和 `chronicles/`；`topics.json` 里的 `orgNames`、`leaderboardProvider`、`chronicleTerms` 不再使用，可以删掉。
  - `taxonomy.ts` 的类别可以写 `feedLabel`（分类 RSS 标题里的名字，示例站用“AI 模型”这样的说法）和 `publicAs`；`ENTITIES` 加了几家公司。
- **推送接口的限流可以设置**：`/api/ingest/items` 每个客户端每分钟最多推几次由 `INGEST_RATE_LIMIT` 决定，`docker compose` 默认 10，和以前一样；不用 Docker 时默认不限，前面没有代理限流的话在 `.env` 里设上。
- **不再使用的环境变量**：`ARTIFICIAL_ANALYSIS_API_KEY`、`MONITOR_MODEL`，可以从 `.env` 删掉。

#### 升级到公开接口 3.0.0

- **安全阀默认关**：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED` 只有写成 `true` 才打开，没写就是关。用 `scripts/init-env.ts` 生成的 `.env` 已经有这两行；自己写的 `.env` 没有的话要补上，否则升级后不再采集、不再调用模型。
- **周报月报接口换了形状**：`/api/v1/weeklies`、`/api/v1/monthlies` 的列表和每一期都带 `periodStart`、`periodEnd`，正文改成 `sections[]`（每栏 `label`、`summary`、`items`），不再有 `title`、`themes`，列表的 `limit` 最多 60。读这两个接口的程序要跟着改；MCP 和 `/openapi-v1.json` 的版本号随之升到 3.0.0。
- **精选的机器出口每条新闻一条**：API 的 `mode=selected`、同步接口和精选 RSS 里，同一条新闻只留代表报道，其他报道以 `remove` 出现在同步的变更里（`mode=all` 里还在）。升级前已经入选的旧报道不会被重新整理，等这条新闻再有报道发布时才归并。
- **精选要等去重确认**：分数够了的资料，要等归组确认它不是精选里已有新闻的重复、带来了新信息，才进精选；确认之前只在“全部动态”。归组用的模型回答不合格式时会停在那里，后台“运行”页能看到。
- **一手只看分级**：`T1` 就是一手，`first_party` 不再单独设置；以前单独标成一手的 `T1_5`、`T2` 信源不再算一手，要算就改成 `T1`。
- **行业包多了几项**：`taxonomy.ts` 新增 `RELEASE`、`PLAIN_TERMS`，评论类的类别标 `commentary: true`，`ENTITIES` 可以写 `otherNames`，`CATEGORY_BY_ITEM_TYPE` 不再使用。已经换成别的行业的站，合并时对照 [把它改成你的行业](customize.md) 补上。
- **主题只读 `industry/topics.json`**：迁移会删掉数据库里的 `topics` 表。只改过数据库、没改文件的主题，升级前先写进文件。公司主题只看 `entityId`，`related` 不再使用。
- **日报不再调用模型**：日报按规则编排，周报月报从日报汇编，模型只写总述和栏目导读；已经出过的各期不重写。
- **提示词有改动**：`industry/prompts/` 里的 `structure.md`、`group-*.md`、`story-digest.md`、`report-period.md` 换成了新的写法，`report-daily-lead.md` 删掉了，新加了 `report-period-sections.md`。改过这些提示词的，对照着把自己的改动搬过去。
- **删掉的脚本**：`scripts/delete-sources.ts`、`scripts/regroup-events.ts`、`scripts/enqueue-analysis.ts`。不要的信源在后台暂停；单篇的重新评估、重新归组在后台内容页。
- **3.x 的 `/agent` 默认打开 Agent Markdown**，MCP 的接入说明在 `/agent?tab=mcp`；当前接入页见上方“站点文件搬进 `site/`”。
- **飞书内容群只推 `T1`、`T1_5` 信源的精选。**

### 管理员会话与配置变更

会话绑定迁移排在 `0041`。此前已试用会话绑定迁移的数据库可直接升级，已有列和绑定会被保留，无需手动修改迁移记录。

会话绑定登录方式、登录时的管理员凭据或飞书身份。升级到会话绑定版本后，未绑定的旧会话需要重新登录。修改管理员密码、飞书管理员名单或会话密钥后，应重启所有 API 进程，使它们加载相同的新配置；只编辑配置文件不代表正在运行的进程已生效，混用旧代码或旧配置的进程不能提供统一撤权。

有效配置改变后，密码会话不再接受旧密码的授权，飞书会话按登录时实际取得的 union ID 或邮箱检查当前名单（两者任一仍获授权即可）。停用飞书登录应用或更换应用 ID 会使飞书会话失效；只轮换同一应用的 secret 不会使仍获授权的飞书会话退出。轮换或移除 SESSION_SECRET 会使两种会话都失效。

鉴权时确认失效的会话会被删除，恢复旧配置也不会让它复活。系统不记录全局凭据变更历史：某次配置变化若从未被进程加载，或在恢复前从未被会话检查观察到，不能据此追溯撤销会话。

### 备份

在 `.env` 里配置 `DB_BACKUP_STORE_*`（任何 S3 兼容的对象存储），每天日本时间 04:10 自动备份到那里。一次完整备份包含同一时间戳的数据库 `.dump` 和文件 `aihot-files-*.tar.gz`：文件包保留 `uploads/` 以及仍存本地的 `feedback-screenshots/`，不包含图片缓存或本地备份目录。已经转发到飞书的图片只保留数据库中的外部引用，文件包不保存飞书上的图片。

恢复时同时取回这一对文件：使用与数据库版本兼容的 `pg_restore` 将 `.dump` 恢复到空数据库，再把文件包解压到数据目录根目录（Docker 中为 `/data`，非 Docker 使用 `AIHOT_DATA_DIR`，默认 `.data`），保留包内的子目录结构，并确保运行进程可读取这些文件。只恢复数据库不能找回仍由 `local:` 引用的反馈截图；旧备份中没有包含的文件也无法凭数据库引用恢复。

AIFIND Guide 的处理后图片也存放在同一个数据目录的 `uploads/aifind-editorial/` 下，随现有文件包一起备份。数据库保留图片的身份、哈希、审查状态和 revision 引用，原始上传二进制不保留，仅留原始 SHA-256。恢复 Guide 图片必须同时恢复 `.dump` 与文件包；只恢复数据库不算完整恢复。文件缺失或处理后哈希不一致时，Guide 发布检查和公开读取会拒绝该图片及关联 Guide。不要把 `uploads/` 直接映射成匿名静态目录；图片通过受发布资格约束的 Site API 提供。

下面的手动导出只包含数据库，不包含上述附件目录：

```bash
docker compose exec -T db pg_dump -U aihot aihot | gzip > myhot-$(date +%F).sql.gz
```

数据都在三个 Docker 卷里：`db`（数据库）、`data`（上传的图片、图片缓存、本地备份）、`caddy`（证书）。`docker compose down` 不会删除它们；`docker compose down -v` 会。

### 看日志

```bash
docker compose logs -f --tail 100 api worker web
```

后台的“运行”页能看到每个定时任务最近的结果，“信源”页能看到每个信源的抓取状况。

## 花多少钱

- **模型**：每条新资料先预筛一次；过了预筛的再评两次分、做一次结构化、写一次标题摘要，然后归组（有相近的报道时才调用），另外还有事件综述、周报月报的总述和精选的全文翻译。日报按规则编排，不调用模型。我们用示范信源在本地试跑，第一次导入的 152 条资料一共用了大约 930 次模型调用。之后每天用多少，取决于你的信源每天更新多少条。后台“模型与评测”页能看到每一步的调用次数和输入输出 token 数。
- **付费采集**（X、公众号、Jina）：按请求计费，默认不启用，填了 key 才会用。
- 所有付费服务都有每分钟、每小时、每天的调用上限（后台“设置 → 付费请求上限”），超过就暂停，不会一夜之间刷爆账单。填 0 表示立即停用这个服务。

## 不用 Docker

### AIFIND Phase 8：候选包与本机 launch 演练

Phase 8 不执行生产部署。`site/launch/2026-10-07-corpus.json` 是官方资料候选，不含 Owner 承认；`site/launch/owner-review.json` 的空项是上线 blocker，不得自动补为已审核。

在全新本机 `*_test` / `*_ci` / `*_preview` 库，先显式运行 `scripts/migrate.ts`，再运行 `node scripts/stage-aifind-launch.ts site/launch/2026-10-07-corpus.json`：仅导入 Draft。需要演练时另加 `--publish-simulation`，使用既有带审计的 Publish / Visibility，仍不是 Owner 事实批准。Production、远端、非安全后缀和 URL override 参数继续被原 Catalog Guard 拒绝；没有 force/Production import 选项。启动、GET 和 Preflight 不 seed、不 import、不 Publish。

`node scripts/aifind-launch-preflight.ts` 只读实际数据，输出 PASS / WARN / BLOCK；有 BLOCK 时退出码 2。它不连接外部资料或模型。管理员可在 `/admin/aifind/preview/launch-readiness` 查看同一 Reader；合成 Preview 开关关闭也可读取此页面及 Hub，原合成示例仍受开关保护。页面 noindex/no-store，不进入公开导航、sitemap、RSS、MCP 和公共业务 API。

`node scripts/build-aifind-launch-bundle.ts <input.json> <不存在的新目录>` 为 file-only 构建。显式 input 必须包含 corpus、完整当前 migration SHA 列表、Source policy、Preflight、测试 baseline hashes 和已审查 Asset manifest。每个引用 Asset 都必须包含且文件 hash 一致。输出 manifest、Product pack、Editorial manifest、Asset 文件/manifest、migration list、Source policy、review manifest、preflight 和 baseline hashes；不包含环境文件、凭据、原始 Observation 文本或管理员会话。重复同一 input 字节一致，已存在目录不覆盖。该包是不可变 candidate，未解决 Content/Operations blocker 前不是可自动上线的生产包。

恢复必须配对 `.dump` 与相同时间戳的 uploads `.tar.gz`，先恢复到另一个全新安全库和数据目录，再检查 Product、Compare、Category、Guide、Evidence、旧 slug 重定向及 Asset。DB-only 恢复会因媒体缺失隐藏关联 Guide；不得当作成功。失败回滚采用迁移前成对备份到另一个库恢复并回切经过人工批准的配置，不倒改 0062–0083、不原地降级 migration。恢复演练不等于生产恢复批准。

只读 observability 复用已有 Runs/Settings：worker heartbeat、失败任务、unknown/pending receipts、预算、备份、Candidate age、Source failures、未完成的过期输入及 orphan rows/files；本阶段不自动 GC。正常本机演练所有真实采集/模型/推送/IndexNow/Detector 阀保持 false。Production 联系信息、正式 URL、条款隐私审批、Source 取得权限和对象存储/恢复证据须由运营者另行落实。

### AIFIND Phase 8 数据保留与信源审核

模块迁移 0082 会暂停已有但尚未审核的 Monitor，所有环境都要求先在后台记录 source policy，再单独启用。`approved` 是运营者记录的采集权限审核，不等于法律结论；Jina 还需要单独允许。修改 URL 会撤销审核并停用，已经排队的任务也会重新检查。正常开发的采集、模型、Detector、推送与 IndexNow 安全阀继续关闭。

`evidence_only` 仅保留必要短引用、各最多 160 字符的前后文、原定位和 hash，处理结束后的正文由已有 daily retention 任务单向削减。`short_excerpt` 默认 30 天，可按来源设为 1–365 天。尚未完成的检测输入不会被并发删除；过期未完成数量会作为运营阻塞指标报告，需要处理或结束任务。Evidence、Candidate、Observation 审计与 Published 数据不可删除或改写。生产升级前先备份数据库和 uploads，回滚应恢复到另一个数据库与对应 uploads，不逆改已发布迁移。

0084 追加审批 reviewer/reason 的非 NULL 约束，并将 prune 与真实 Observation 执行区间串行化；0082/0083 不改写。执行锁使用独立短生命周期 PostgreSQL session，覆盖 resolver/model 等待，连接关闭自动释放，避免占住付费回执使用的连接池。prune 遇到执行中的 Observation 跳过；直接 SQL 也不能绕过。每次 robots、source page、Jina 请求前重新检查当前 policy/revision，撤权不允许继续后续请求。

本机 launch launcher 可复用同一安全 `*_preview` 库和已有登录文件；重启前核验并显式停止其 receipt 中的自有进程。仍存活的 PID 会拒绝重启，不自动杀旧进程。每次 run 在 `launch-runs/` 留不可覆盖记录，更新 current runtime pointer 前保留旧 receipt；不自动 seed/migrate/import/publish，也不删除旧日志。会话密钥每次启动更新，管理员需要重新登录。

### AIFIND Phase 8.5：正常入口 Release Candidate

Phase 8 的包、日志和 Owner 待审记录保留为历史证据。Phase 8.5 按用户明确决定，采用 `source_backed` 发布策略：逐项确定事实必须有对应产品的可访问官方 Evidence；不确定项保留 `unknown`，不能表示免费、不可用或已实测。逐产品 Owner 批准不再作为发布 blocker，也不得伪造批准。编辑主体展示为 `AIFIND編集部`，属于编辑项目；联系入口 `/contact` 使用现有 `/feedback` 表单。

每个确定字段及其值还必须匹配该来源 dossier 的 `reviewedFacts`，不能仅凭同一产品的官方 URL 放行。Corpus 和 Published aggregate 使用同一个稳定字段投影（价格使用 planKey及价格上下文，不用数据库 UUID）；国家列表不能支持免费价格或相反的可用性。新事实需先人工核对直接支持的官方来源并更新审核绑定；降为unknown不新增断言。此元数据不替代网页语义人工核验、不代表Owner逐项批准，也不触发模型或采集。

首发 `launchCollectionMode=off`。全部 Product Monitor 保持停用，采集、模型、Detector、Feishu 和 IndexNow 安全阀保持 false；只有这些条件同时成立，Source permission 检查才为 DEFERRED。开启自动采集前必须另行完成 Source permission 审核；一旦任何 Monitor 或阀意外开启，OFF 模式仍 BLOCK。

本机候选必须使用新的 loopback `*_launch_candidate_test` 数据库，不能复用旧 Preview 库。先显式运行 `scripts/migrate.ts` 和 `scripts/stage-aifind-launch.ts <corpus.json>`，只导入 Draft；核对后才显式使用 `--publish-candidate` 走既有 Product/Editorial 审计发布流程。导入后人工改过的 Draft 会拒绝候选自动发布。真实媒体通过 Asset Domain 上传并完成权限/隐私检查。Production、远端、不安全后缀和 URL override 继续被 Catalog Guard 拒绝，没有 force 选项。

`scripts/serve-aifind-launch-candidate.ts` 只启动已准备的数据，默认 web4000 / API4001；无 startup migrate、seed、import 或 publish。保持 `AIFIND_PREVIEW_ENABLED=false`、`SITE_PREVIEW=false`，使用正常 `/products`、`/compare`、`/categories`、`/howto`。正常后台入口为 `/admin/aifind`；readiness 页面和只读 API 为 `/admin/aifind/launch-readiness`、`/api/admin/aifind/launch-readiness`，继续 admin-only / noindex / no-store。登录密码仅写在本机忽略目录，Web 环境不包含数据库连接串、管理员密码或后端密钥。

Release Candidate 要求实际本机配对备份/恢复成功：现有 `runBackup` 产生同时间戳的 `.dump` 与 uploads `.tar.gz`，使用兼容的 `pg_restore` 和 `tar` 恢复到另一个全新安全库/目录，并检查发布 Reader、Evidence、lastVerifiedAt、原新闻日期、Alias 和图片 SHA。restore 证明须绑定当前这一对备份的 SHA-256、来源与恢复数据库名。缺少文件或不匹配不能放行；无对象存储时，`backup made locally but not uploaded` 仅代表本机备份成功，不能当作远端上传成功。

当前门禁分别报告 Engineering、Content、Release Candidate、Operations、Production Deploy。仅远端对象存储及远端灾备缺失时，Operations 为 PARTIAL，Release Candidate 可 READY；真实本机备份/恢复、Admin、Evidence、媒体和公开隔离仍是 blocker。Production Deploy 必须保持 NOT EXECUTED。

部署前仍需单独落实正式 `SITE_URL`、持久化数据目录、强认证密钥、HTTPS/进程托管、远端对象存储与远端配对恢复。正式生产导入、生产 DB 连接、部署、DNS、Detector 和付费模型均需要用户另行授权的 Phase 9。不要用本机候选包暗示这些操作已批准或执行。

Phase 8.5 在 Windows PostgreSQL17 实际复现了测试数据库生命周期 DDL 的 checkpoint / process-barrier 等待，迁移断言本身已通过；只串行化删库仍会取消。`tests/database-cleanup.ts` 统一串行化测试夹具的 `CREATE DATABASE` / `DROP DATABASE`：连接前校验 loopback `*_test` / `*_ci` 来源、安全目标和模板，使用短生命周期独立连接和同一个 session advisory lock；生产代码不使用此工具。完整套件仍保持六文件并发、120000ms 超时和原有断言，不以 skip 或延长超时处理。

单独运行数据库测试时也须保留完整套件的 `--test-global-setup=tests/databases.ts --import ./tests/databases.ts`。`DATABASE_URL` 指向模板，preload 给测试文件创建独立副本；遗漏它会把 fixture 写入模板，污染后续完整运行。模板只能使用显式创建的本机安全测试库，不能指向候选站点或生产库。

需要 Node.js 24.11 以上和 PostgreSQL 16 或 17。

```bash
npm ci
node scripts/init-env.ts
createdb myhot
```

在 `.env` 里加上：

```bash
DATABASE_URL=postgres://你的用户名@127.0.0.1:5432/myhot
API_BASE_URL=http://127.0.0.1:3001
```

然后：

```bash
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts
npm run build -w @aihot/web

node --env-file=.env apps/api/src/main.ts          # 接口，3001 端口
node --env-file=.env apps/worker/src/main.ts       # 后台任务
cd apps/web && NODE_ENV=production node --env-file=../../.env server.ts   # 网页，3000 端口
```

三个进程要一直运行，生产环境用 systemd 或 pm2 守护。停止 worker 时至少给它 210 秒（systemd 的 `TimeoutStopSec`、pm2 的 `kill_timeout`），让进行中的付费调用收尾；被提前杀掉的调用结果不明，要等至少半小时自动放行后才会重试。

开发时用带热更新的方式：`npm run dev:api`、`npm run dev:worker`、`npm run dev:web`。开发时想免登录进后台，在 `.env` 里设 `DEV_AUTH_ROLE=admin`（生产环境会拒绝启动）。
