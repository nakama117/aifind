# AIFIND Phase 8 — Launch Readiness + Real Content Staging

报告日期：2026-10-07（Asia/Tokyo）。本轮工程实施、研究和验收证据均来自当前仓库及本轮执行。未连接、修改或导入 Production DB；未部署、改 DNS、开启真实采集或付费模型。尚未授权 Phase 9。

Preview：[Launch Readiness](http://localhost:3900/admin/aifind/preview/launch-readiness)。公开 staging：[首页](http://localhost:3900/) / [Products](http://localhost:3900/products)。API 为本机 3901；与原有 3800/3801 分离。管理员密码仅在本地私有文件 `.data/phase8-20261007-40ca55fd/launch-login.txt`，本报告、日志摘要和 release bundle 均不打印密码。

## A. Phase 7 acceptance baseline

- 原接收基线：数据库 1035 total / 1027 PASS / 0 FAIL / 0 CANCELLED / 8 Windows SKIP；Web 89/89。
- 本阶段开始重新执行 `baseline-full`：1035 / 1027 PASS / 0 FAIL / 0 CANCELLED / 8 SKIP，时间 2026-10-06T18:32:48.599Z → 2026-10-06T18:35:33.303Z。该次真实执行不依赖旧日志。
- 最终旧测试 multiset 的名称、状态、嵌套 depth、SKIP 原因与 Phase 7 全部相同。源基线和最终本轮对比见 `phase7-accepted-baseline.json` / `reviewfix-accepted-baseline.json`；审查前的第一份本轮基线也保留。旧 Phase 0–7 的实现和 Preview 路径保留。

## B. Retention policy

沿用现有 SOURCE_KINDS，新增两种受控策略：`evidence_only` 与 `short_excerpt`。后者工程默认 30 天，可配置 1–365 天；此默认值不代表法律结论。

`evidence_only` 在可终结处理状态后由现有每日 retention hook 删除完整 source_text；不是声称函数结束瞬间同步删除。`short_excerpt` 在 retrievedAt + excerptDays 截止后清除暂存输入。未完成处理的 observed/model_disabled/budget_blocked/error/receipt_unknown 不因过期丢失输入，期限超出计数进入运维。未完成 input 没有绝对自动销毁保证，必须处理或人工处置后再 prune。

长期保留 URL、publisher、retrievedAt、publishedAt、原完整 contentHash、必要 Evidence quote、前后各至多 160 个 Unicode code point 的 context、原 locator、retained input hash 和 Candidate/处理元数据。quote 最长 500 code points。不存在全文镜像公开出口。

## C. Source policy

Monitor 新增 unreviewed/approved/blocked、审查者/时间/理由、retention class、days、automated-fetch / Jina permission。只有 approved 且 automated fetch allowed 才能 enabled=true；DB CHECK/trigger、Domain、worker 实际 transport 前重新读取策略共同约束，适用于所有环境。队列中曾经 enabled 的任务不能越过撤权。更换 URL 原子撤销审批、关闭 Monitor 并增加 revision。

全部 12 个真实来源当前 unreviewed、disabled、fetch=false、Jina=false。本机证明中仅自作 `.invalid` test-double 资料有明确 rehearsal 审批，仍不可 fetch；没有外部 HTTP 或真实 Detector 模型请求。robots/条款/引用用途/短期留存许可仍需要运营者逐源审核，机器审批不等于法律合规。

## D. Observation pruning

仅新增 forward migration `0082_aifind_source_retention.sql`，旧 78 个 migration 哈希保持原样。未审查 legacy enabled Monitors 安全暂停；Evidence context 在删文本前保存并不可普通修改/删除。Observation 一次性 prune 不改变 full hash、取得时间、Candidate proposal 或 Published facts；重复 prune 不重复更新时间。直接 SQL 不能重新填回被删输入或删除不可变历史。

RET01–RET15 在真实测试 DB PASS；Unicode、存储审查 context、未完成输入、URL 撤权、queued fetch 拒绝均有回归。最终审查另补 RF01–RF05，实际 deferred robots/page 撤权、SQL NULL 拒绝和检测过程中 prune/重复 worker 竞争都从 FAIL→PASS。仅追加0084，0082/0083也保持原hash；执行锁使用独立短生命周期 PostgreSQL session，跨 provider 等待持有，结束/连接中断释放，与prune SQL guard使用同一锁，避免原始输入/模型结果在处理中丢失。

实际 staging 的两条确定性私有 rehearsal Observation 已 prune，Supporting Evidence 和 review 页面仍可读。这两条不进入 release corpus。

## E. Semantic Candidate dedupe

新增 `0083_aifind_candidate_semantics.sql` 和独立 semanticKey；0075 与旧 proposalKey 保留，不改写旧 proposal identity。semanticKey 白名单字段为 Product、base Published version、Candidate type、target key、target ref、typed proposed semantic value；不包含来源 hash、retrievedAt、quote 或 verification provenance。

同 base 且 detected/pending_review/approved 的同语义 Candidate 被复用，新 Evidence 仍独立保存，并在同一 Product 锁下 link。不同 value/target/base 保持不同；并发两 worker 不产生两个 active item；retry 不重复 link。不提升 status/confidence、不创建 Product Draft。

rejected 旧状态不复活，新的 changed-hash observation 可以产生新的待审项。applied 不属于 active suppression，新的发布基线不会被旧项吞掉。旧 NULL semanticKey 历史可按归一语义匹配，不重写或删除已有 duplicate 历史。

SD01–SD13 PASS。旧命名的 Phase 4 carryover B characterization 测试保留名称，断言从两个 active Candidates 改成现在明确要求的一个 Candidate/两份 Evidence；这是本阶段授权的业务变化。

## F. Supporting Evidence

一对多不可变 Candidate→Evidence relation 包含 linkedAt；主 Evidence 身份保持原样。受保护 Review Detail 和 Phase 8 Preview 同时展示 Primary/Supporting source URL、取得时间、原 contentHash、quote/context/locator。公开 Reader/API/RSS/MCP 没有新增 Candidate 或 Draft 出口。

实际 rehearsal：1 pending Candidate、2 Observations、2 Supporting Evidence，原文本消失后仍能审阅。未把两份 Evidence 自动当作两次独立信任背书。

## G. Real launch Product corpus

真实来源候选共 **12**，全部 source_material / owner_review_required。逐个官方 Product/Pricing/Docs dossier 和 Product pack 在 `site/launch/2026-10-07-corpus.json`；核心 Evidence 共 36。页面和 Domain 实际 eligible/listed 数为 12。

| Product / Slug | 官方来源（实际手动研究） | JP | Price types | Review |
|---|---|---|---|---|
| ChatGPT / `chatgpt` | [Product](https://chatgpt.com/overview/) · [Pricing](https://chatgpt.com/pricing/) · [Docs](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries) | available | free / unknown | owner_review_required |
| Claude / `claude` | [Product](https://claude.com/product/overview) · [Pricing](https://claude.com/pricing) · [Docs](https://support.claude.com/en/articles/8114491-get-started-with-claude) | unknown | free / unknown | owner_review_required |
| Gemini / `gemini` | [Product](https://gemini.google/overview/) · [Pricing](https://gemini.google/subscriptions/) · [Docs](https://support.google.com/gemini/answer/13575153?hl=ja) | available | unknown | owner_review_required |
| Gemini Notebook / `gemini-notebook` | [Product](https://notebook.google/) · [Pricing](https://gemini.google/subscriptions/) · [Docs](https://support.google.com/gemininotebook/answer/16206563?hl=ja) | unknown | unknown | owner_review_required |
| Perplexity / `perplexity` | [Product](https://www.perplexity.ai/) · [Pricing](https://www.perplexity.ai/help-center/en/collections/18799292-subscription-plans-billing) · [Docs](https://www.perplexity.ai/help-center/en/articles/10352155-what-is-perplexity) | unknown | unknown | owner_review_required |
| Cursor / `cursor` | [Product](https://cursor.com/) · [Pricing](https://cursor.com/pricing) · [Docs](https://cursor.com/docs) | unknown | free / custom / unknown | owner_review_required |
| GitHub Copilot / `github-copilot` | [Product](https://github.com/features/copilot) · [Pricing](https://github.com/features/copilot/plans) · [Docs](https://docs.github.com/en/copilot/get-started/about-github-copilot) | unknown | free / unknown | owner_review_required |
| Adobe Firefly / `adobe-firefly` | [Product](https://www.adobe.com/products/firefly.html) · [Pricing](https://www.adobe.com/products/firefly/plans.html) · [Docs](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/adobe-firefly-overview.html) | unknown | unknown | owner_review_required |
| Runway / `runway` | [Product](https://runway.com/) · [Pricing](https://runway.com/pricing) · [Docs](https://help.runwayml.com/hc/en-us) | unknown | free / unknown | owner_review_required |
| ElevenLabs / `elevenlabs` | [Product](https://elevenlabs.io/) · [Pricing](https://elevenlabs.io/pricing) · [Docs](https://elevenlabs.io/docs/overview/intro) | unknown | free / unknown | owner_review_required |
| Notion AI / `notion-ai` | [Product](https://www.notion.com/product/ai) · [Pricing](https://www.notion.com/pricing) · [Docs](https://www.notion.com/help/guides/category/ai) | unknown | unknown | owner_review_required |
| Dify / `dify` | [Product](https://dify.ai/) · [Pricing](https://dify.ai/pricing) · [Docs](https://docs.dify.ai/en/home) | unknown | free / unknown | owner_review_required |

日本语 Input / Output / UI 都保持 unknown；日语官网或市场页面不等于已验证 UI 质量。已核实 Free 的产品有 7，Cursor Enterprise 为 custom，所有未核实 paid price 都 amount=null / unknown；不做 FX、评分、虚构使用者数量。Capability 仅为有文档依据的 partial 能力，不冒充实际质量测试；未核实平台保持 unknown，不能当 unavailable。

仅使用常规可访问官方网页，没有付费 OpenAI API、Jina fallback、代理绕限、登录或验证码突破。Perplexity 文档 `10352155-what-is-perplexity` 的实际 search/research 证据提供 lastVerifiedAt；不是 updated_at 替代。Perplexity pricing collection 当前正常可访问，但没有据此造价格。Gemini Notebook 与旧 NotebookLM 的名称/契约映射是 Owner 公开前确认项。

Source hash 明确仅为 **minimal_review_excerpt** 的 SHA-256，全文 source hash 未取得则为 unknown；不声称保存或验证了整页。两条 product homepage 提取受限，计 WARN；相应文档可访问并用于受支持的事实。

## H. Real editorial corpus

全部为 official_sources，实际 staging Published 各 2 篇，Owner 事实审核与本机操作发布演练分开。没有 hands_on mode 或 TestRecord。

| Type | 标题 | 当前公开 staging 路径 | Evidence scope |
|---|---|---|---|
| category | 画像・動画・音声制作のAI候補 | /categories/creative-ai-tools | official_sources / 无 TestRecord |
| category | 資料の調査と整理に使うAI候補 | /categories/research-tools | official_sources / 无 TestRecord |
| comparison | 文章の下書きに ChatGPT と Claude をどう選ぶ？ | /compare/chatgpt-vs-claude-writing | official_sources / 无 TestRecord |
| comparison | 開発支援に Cursor と GitHub Copilot をどう選ぶ？ | /compare/cursor-vs-github-copilot | official_sources / 无 TestRecord |
| guide | Cursor で最初のコード変更をレビューする手順 | /howto/cursor-review-first-change-current | official_sources / 无 TestRecord |
| guide | Gemini Notebook で資料を整理する前の確認手順 | /howto/gemini-notebook-source-check | official_sources / 无 TestRecord |

包含目的、适用/不适用、不可比条件/限制、使用步骤、输入要求和结果目标。Guide 的图片为自己创建的 SOURCE→CHECK→REVIEW→SHARE 原创流程图，caption 明示本机演练、不是产品屏幕或实测。Binary 通过现有 Asset Domain 清洗为 WebP，rights/privacy 明确审查。Currency/价格/JP/日语 unknown 没有变成编辑断言。

## I. Owner review status

Owner-reviewed Product **0/12**。Machine schema 验证、source dossier 研究、local Publish 均不构成 Owner approval。`site/launch/owner-review.json` 的运营者/联系渠道/正式 URL 仍为空、policiesReviewed=false、productApprovals=[]；尚未收到用户确认。每个 dossier 记录 unknownFields、openQuestions、source time、reviewStatus，具体保留问题可在 Preview 逐个展开。

## J. Public policy pages

新增日文 `/editorial-policy`：事实与编辑判断、官方资料与真实实测、unknown、验证日期/重测、短引用/原链、纠错；明确目前无 Affiliate/Sponsored 功能。`/contact` 链接既有反馈入口，SITE.contactEmail 有值时使用实际配置。

现有 About/Terms/Privacy 不被擅自当作已批准正式法律文案；Terms/Privacy 草案和缺少运营者/联系邮箱/正式 URL 仍存在公开前 blocker。Contact 明示信息未定，不伪造身份、地址、邮箱或法律结论。本站 URL 仍取 SITE_URL，不硬编码 aifind.jp。

## K. Launch preflight

`node scripts/aifind-launch-preflight.ts` 只读，未 seed/migrate/import/fetch/publish。实际 staging CLI 时间 2026-10-06T20:22:40.997Z，退出码 **2** 是发现 BLOCK 的预期结果；不是 suite 测试失败。Admin API/SSR 读取同一个真实 preflight，noindex/no-store，未登录 API401 / 页面登录跳转。不进入 sitemap 或公开导航/RSS/MCP/public business API。

| Check | Result | 实际依据 |
|---|---|---|
| runtime.node | PASS | 24.14.0 |
| runtime.siteUrl | PASS | http://localhost:3900 |
| runtime.database | PASS | database configured: true |
| runtime.dataDir | PASS | persistent data directory present: true |
| runtime.credentials | PASS | admin credential configured: true |
| runtime.productionSecrets | PASS | non-production; production secret validation not applicable |
| safety.preview | PASS | synthetic Preview feature flag must be disabled |
| safety.synthetic | PASS | 0 candidate public records with synthetic markers |
| safety.import | PASS | production Catalog import guard |
| safety.external | PASS | explicitly enabled external flags: none; no external/model request from preflight |
| content.minimum | PASS | Products 12, eligible 12; Compare 2, Category 2, Guide 2 |
| content.owner | BLOCK | 12 Products require actual Owner factual review |
| content.operator | BLOCK | operator identity/contact/production URL decisions configured: false |
| content.policies | BLOCK | terms/privacy/contact policy approval: false |
| content.retest | PASS | 0 published editorials require retest |
| evidence.missing | PASS | 0 missing verification or public readiness facts |
| evidence.stale | PASS | 0 Products not verified within 30 days |
| evidence.urls | WARN | 2 limited/unavailable official sources; no network request during preflight |
| assets.files | PASS | 0 files missing or hash mismatched |
| assets.review | PASS | 0 assets require rights/privacy review |
| sources.policy | BLOCK | unreviewed 12; blocked+enabled 0; collection readiness only |
| operations.backup | BLOCK | last backup evidence valid: false |
| operations.backupConfig | BLOCK | object store backup configuration: false |
| operations.restore | PASS | paired DB/uploads restore rehearsal proven: true |
| operations.worker | PASS | worker heartbeat within three minutes: true |
| operations.receipts | PASS | unknown 0; pending 0 |
| operations.jobs | WARN | 2 failed runs in past 24 hours |

Gate 根据不同维度独立输出。无真实 external flag 打开是 PASS，不把刻意关闭的采集/模型当作部署失败。生产 auth secret 只在生产配置检查；本机不输出 secret 值。Snapshot 为只读真实当前状态，Preview GET 没有外部请求。

## L. Release bundle

目录：`D:/Projects/aihot/.data/phase8-20261007-40ca55fd/runtime/launch-bundle`。Manifest SHA-256：`c590b2807b323275052738da8887f12162e807bf39b5666afcbad113da2d7061`。

9 个 payload + manifest：Product pack、Editorial manifest、Content review dossier、Source policy、Preflight、test baseline hashes、81 个完整 migration 记录、Asset manifest、1 个处理后 WebP。每项 byte length/SHA-256 可在 Preview 和 manifest 核对。两次构建逐字节一致，exclusive 输出不覆盖旧包。审查前原包9532efd3…完整保留在bundle-pre-review，最终包采用0084和新测试hash。最终基线SHA256 e15a048dbee5ff913a5328c75b79ef6bbbeb0759c51ea9fbd9274b1df463a25b。Owner approved=0，purpose 明示 non-production candidate。

使用真实当前 Published Editorial 而非私有 Draft：当前 Guide canonical 与媒体引用均已收录。Symbolic Product slug 在未来已授权导入时必须绑定该环境真正的 Published version ID；媒体先通过现有上传/rights/privacy 审查，再显式映射 asset ID。此次没有生产 importer、新授权参数或自动 import。

私有 Claude Draft、演习 Observation/Candidate/Evidence、自作 test-double URL、任何 DATABASE_URL/password/API key/cookie/.env 均不进入 release。Recursive synthetic / credentials、URL user-info、service account key、prefixed environment secret、path traversal/symlink、missing/mismatched/referenced asset 防线有真实回归。冻结 preflight 是本机快照，不是生产批准书。

## M. Production-like rehearsal

最初新建 `aifind_phase8_40ca55fd_launch_preview`（loopback 55432），先确认空库，再从零应用当时全部80个migration。Product importer 先只生成 Draft；独立显式 operator simulation 使用既有审核/publish/visibility Domain 发布12产品，再把slug bind成真实Published IDs建6 Editorial Draft/Published。未使用原Phase7 synthetic DB。启动脚本没有自动seed。

最终新增0084后，另建全空 `aifind_phase8_40ca55fd_fresh84_preview` 从零应用当前 **81** 个migration，再验证12 Draft/0 Published→独立显式Publish→12 eligible/2 Compare/2 Category/2 Guide/0付费回执。`fresh84-rehearsal-proof.json` 是修复后当前版本的真正空库重建证据。既有launch staging只追加0084，前后Product/Editorial/Asset/Evidence/Candidate数据hash相同；真实核验自有PID后安全重启，原密码、旧receipt保留，新run独立记录，启动seed=0。

保留启动时 NODE_OPTIONS 的 Windows 路径首次失败日志；改用 file:///… 后在本阶段自己的空库继续，未 reset 任何现有库。SSR fixture 曾因顶层 Backend import 在 DATABASE_URL 切换前初始化导致本阶段测试 template 污染；改为 env-before-dynamic-import 并先断言 current_database()，改用全新 verified_test template。旧污染库保留证据，未碰生产或前期 Preview。

实际 normal worker 运行 heartbeat/既有任务；网络 MockAgent 拒绝全部非本机 HTTP。全部六个 external/model 阀 false。模型测试只 local fake，staging 的确定性 detector adapter 不创建付费 receipt。没有自动升级阈值、评分或新 Pipeline。

## N. Backup / restore

本轮实际使用已安装 PostgreSQL17 client 的 pg_dump/pg_restore 和既有 backup + tar：

- Dump：`aifind-phase8-40ca55fd-launch-preview-202610062020.dump`；SHA256 `45ef6b5707137e0f523d1aaee0070db1e2b86c619937db87cd6d254978362079`。
- uploads archive：`aifind-phase8-40ca55fd-launch-preview-files-202610062020.tar.gz`；SHA256 `7d8b7df5188716766f108a41bc3e9ade9a0cdbdf1a24f829f269b83da142724b`。
- 最终新增空独立 `aifind_phase8_40ca55fd_reviewfix_recovery_test` + 独立 reviewfix-restored-files 数据目录；实际恢复 **10/10 PASS**，HTTP **20/20 PASS**，既有 site/MCP smoke **30/30 PASS**。初次审查前恢复库/包也保留，没有复用或覆盖。
- 产品/Evidence、2 Compare、2 Category、2 Guide、处理后 Asset hash、旧 slug 301、私有 Draft 隔离和 Supporting Evidence 全部恢复可读。
- 负例：同 DB 但不恢复 uploads，带图 Guide not_found / not public-ready，另外无图 Guide 仍可读；没有用 DB-only 恢复冒充完整恢复。
- Object store 未配置、实际 uploaded=false；既有 runBackup 正确报告本地包已生成但未上传。因此 **生产自动备份/远端灾备仍 BLOCK**。临时恢复 API/Web 3910/3911 已停止，原 3900/3901 与 3800/3801 保留。

回滚/重建约定：未来正式操作前先取同时间点 DB dump+uploads 并验证 SHA，保留当前版本与 migration manifest；失败时停止写入，将**配对**快照恢复到另一空安全库和另一目录，验证 public eligibility/media/slug/Evidence 后才考虑经授权切换。新迁移只 forward，不降级或改写已发 migration，不用旧备份整批覆盖当前工作树。本轮没有生产升级前备份或生产切换演练。

## O. Observability

复用 Runs/Settings：实际 worker heartbeat 新鲜；最近24h failed jobs=0、unknown receipts=0、pending receipts=0；budget 表各服务 used=0（包括 OpenAI）；pending Candidate=1 且保留最早创建时间；source failures=0、expired unfinished input=0。该 Candidate 仅为私有 rehearsal。

Assets rows=1/files=1/orphanRows=0/orphanFiles=0。**GC 未实现**，仅显示可观测计数，没有随意删旧媒体或历史。backup 上传失败和 paired restore 成功分别展示，不能互相掩盖。

## P. Chrome launch acceptance

实际安装、可见 Chrome 154.0.8037.95（headless=false），桌面1366×900/手机390×844，最终 L01–L25 **25/25 PASS**；page errors=0、console errors=0、被阻止 external request=0。首轮5项失败来自 smoke 对既有路由/页面文案/lazy image 的错误预期，保留首轮证据后按真实契约修正 harness；没有修改业务断言或 Product readiness 来讨好 smoke。

| ID | 实际检查 | Result |
|---|---|---|
| L01 | Home real Product and Editorial content, Japanese desktop | PASS |
| L02 | Products directory contains twelve eligible real products | PASS |
| L03 | Product detail shows independent Japanese fields, unknown price and Evidence | PASS |
| L04 | Existing JP and free filters show only confirmed matches | PASS |
| L05 | Compare list exposes two actual published candidates | PASS |
| L06 | Compare detail displays official_sources with no invented Test Record | PASS |
| L07 | Category shows selection basis and unknown facts without ranking | PASS |
| L08 | How-to list contains two real Guides | PASS |
| L09 | Guide steps, result target, price and self-created diagram are truthful | PASS |
| L10 | Related Guide, Compare and Category links share current real Products | PASS |
| L11 | Sitemap index and module children expose no Draft or Preview | PASS |
| L12 | robots references env-driven sitemap and excludes Admin | PASS |
| L13 | Canonical and OG use SITE_URL on real Product and Guide | PASS |
| L14 | Every launch public page is free of synthetic markers and fabricated hands-on | PASS |
| L15 | Private Draft stays out of public response and preflight facts | PASS |
| L16 | Published Asset is readable sanitized WebP without broken images | PASS |
| L17 | 390px Home has normal navigation and no whole-page overflow | PASS |
| L18 | 390px Product preserves unknown/free semantics without overflow | PASS |
| L19 | 390px Compare is readable with official-source explanation | PASS |
| L20 | 390px Guide steps and image fit with no whole-page overflow | PASS |
| L21 | Anonymous browser cannot read Admin Preview or private API | PASS |
| L22 | Preflight truthfully shows four gates, Owner and operations blockers | PASS |
| L23 | New Product Published sets needs_retest without rewriting Guide steps; accepted references restored | PASS |
| L24 | Source Policy is clearly unreviewed/disabled for real sources | PASS |
| L25 | Pruned Review detail preserves two independent Supporting Evidence records | PASS |

最终修复并重新冻结后只读可见 Chrome **5/5 PASS**：管理员登录/noindex、真实 API/no-store、12 dossiers/日文/宽度、真实bundle SHA-256、零页面错误/外部请求；日志 `reviewfix-after-bundle-browser.json`。L01–L25也在重启后全部真实重跑。内置CUA bridge因sandbox helper初始化失败为 **UNRUN**；没有将其当作浏览器PASS。Codex内置Preview tab open为queued，用户可用上述URL手动登录；Chrome截图是真实本轮结果。

人工截图检查：日文没有乱码；字段层次和 unknown 标识可读；公开内容无私有 Draft；官方资料范围与非实测声明清楚；unknown 价格未显示免费；桌面/手机无整页水平溢出。移动底部既有导航较密，未在本阶段进行视觉重设计。

## Q. Screenshots

最终修复后真实Chrome八张必需截图在 `.data/phase8-20261007-40ca55fd/reviewfix-chrome-screenshots/`；先前截图也保留：

- launch-home-desktop.png
- launch-home-mobile.png
- launch-products-desktop.png
- launch-product-detail.png
- launch-compare.png
- launch-category.png
- launch-howto.png
- launch-preflight.png

最终冻结后补充：`reviewfix-accepted-screenshots/launch-preflight.png` 与 `reviewfix-accepted-screenshots/launch-bundle.png`（包含实际manifest hash）。截图均为本阶段本机真实数据，没有HTML假结果或生成图替代页面截图。

## R. Regression

| 本轮命令/检查 | Result | Total / PASS / FAIL / CANCELLED / SKIP |
|---|---|---|
| npm run typecheck | PASS | exit0 |
| DATABASE_URL=…_reviewfix_test npm test | PASS | 1113 / 1105 / 0 / 0 / 8 |
| npm run build -w @aihot/web | PASS | exit0 |
| node --test apps/web/tests/*.test.ts | PASS | 94 / 94 / 0 / 0 / 0 |
| node scripts/smoke.ts --base http://localhost:3900 | PASS | 30/30 |
| Visible Chrome L01–L25 | PASS | 25/25 |
| Visible Chrome post-bundle read-only | PASS | 5/5 |
| Real paired DB+uploads restore | PASS | 10/10 |
| Post-restore HTTP | PASS | 20/20 |
| Post-restore site/MCP | PASS | 30/30 |
| Local preflight CLI | EXPECTED BLOCK | exit2；Content/Operations/Phase9 NOT READY |
| CUA bridge UI initialization | UNRUN | helper_unknown_error；没有影响已完成真实 Chrome 验收 |
| Production deploy/import/model/detector | UNRUN / NOT EXECUTED | 用户 STOP RULE |

真实 DB 最终时间 2026-10-06T20:13:21.071Z → 2026-10-06T20:16:22.302Z；安全库及每项 false 阀在 run meta。Web 2026-10-06T20:13:17.854Z → 2026-10-06T20:14:46.374Z。Tokyo/品牌和旧 Phase0–7 测试都包含在未变动的1035个测试内，逐项旧基线比对通过。

新增 DB 78 项：RET15、SD13、LC14、LP12、RB13、HTTP4、RF7；新增SSR5。没有新增skip、删除失败测试、放宽timeout或降低关键断言。旧migration/module路由精确数量断言更新为新增3个forward migrations/2公开政策页面/1受保护Preview所对应的精确值；旧af_表数量依然严格33。

开发中失败记录保留，未冒充接受结果：after-dedupe-full 为迁移精确数量和未读 linked_at；implementation-full 16 FAIL/1 CANCEL 与 implementation-web5 FAIL 为 fixture env 初始化污染；isolated-full 1 FAIL 为旧模块精确路由数。根因分别修正，最后重新执行完整套件0 FAIL/0 CANCEL。TDD RED 的 failure 是先观察缺陷的证据，不能误计入当前 baseline。

8个原 Windows SKIP（原因不变；Linux CI 行为本机未额外运行）：

| Test | 原 Skip 原因 |
|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |

### 一次最终代码审查

唯一一次独立只读全改动审查由 gpt-6-astra 完成：Critical=0，Important=3，Minor=1，初始结论 With fixes。随后按真实用户影响把正常 Preview 重启 EEXIST 重新归为 Important；全部4项进入同一次 TDD 修复，不再派第二名 reviewer。

| Finding | 最小修复 | RED → GREEN 及最终证据 |
|---|---|---|
| robots/page 等待期间撤权还能继续 source/Jina 请求 | 每一次实际 source/Jina 外部阶段前重新加载 policy/revision | RF01/RF02：本地 fake source/Jina 旧实现实际多发1请求；修复后0额外请求 |
| unresolved/ambiguous/invalid 的检测重试可被并发 prune | 跨 provider await 的 session execution lock；每日 prune与0084直接SQL guard取得同一锁；连接关闭自动释放 | RF04：旧实现处理中 text 变空；RF05：旧并发结果丢失；修复后只执行1次adapter，保存detected/Evidence，结束后可prune |
| SQL CHECK 接受 NULL reviewer/reason | 0084 forward migration 明确 non-NULL + nonblank，既有0082/0083不改 | RF03：旧SQL缺少应有拒绝；修复后approved/blocked的NULL/blank组合全部拒绝 |
| Preview receipt wx 导致停止后不能重启 | 已停进程核验、同一密码复用、每run immutable历史receipt；保留旧记录后更新current pointer；仍活PID拒绝启动 | RF06/RF07 + 真实3900/3901安全重启；前后数据hash相同、原密码/receipt保留 |

review-fix-red：7 FAIL；review-fix-green：7/7 PASS。最终完整 reviewfix-full1：1113 total / 1105 PASS / 0 FAIL / 0 CANCELLED / 8原SKIP；reviewfix-web1：94/94；typecheck/build exit0；真实重跑Chrome25/25。符合一次修复 pass 的验证要求；无未修 Critical/Important、无 deferred minor（原Minor已重归并修复）。这不构成 Production 或 Owner 批准。

Reviewer明确没有独立外部事实/法律核验、生产/objectstore操作或Owner审批；没有扩展applied/rejected范围，没有把旧dirty工作和缺失SC字体混进Phase8 diff，也没有声称1000条/日batch通过生产规模容量验证。每个 declined 项及其后果均在 progress.md 的 Ruling 中保留，最终报告保留人工 blocker。


全部执行判断（Rulings，按原顺序，含误判代价；并非隐藏同意或自动批准）：

- Ruling: native inline execution, plan-first, no new design/approval/commit/worktree or evidence cleanup — user's explicit no-redesign/write-plan-then-implement/Git-safety instructions override generic skill handoffs — cost if wrong: plan errors caught by TDD and one final fresh review, no per-task reviewers.
- Ruling: policy gate applies to ALL enabled Monitors, not an environment escape — strongest DB/domain enforcement; local fake fixtures will explicitly approve only their fake sources — cost if wrong: existing monitored-source registrations need review before re-enablement.
- Ruling: applied Candidates are outside active semantic suppression; rejected rows stay immutable and a new changed-hash observation can create a new pending item — spec only requires detected/pending_review/approved and no silent resurrection — cost if wrong: additional manual re-review after apply/rejection, documented explicitly.
- Ruling: no Owner approval inferred; missing contact/identity/policy/facts remain BLOCK — user explicitly separates machine validation and Owner review — cost if wrong: production handoff cannot be READY until real approvals arrive.
- Ruling: keep this phase's ledger/logs/backups in ignored .data rather than deleting generic skill scratch or making commits — user forbids stage/commit/push and requires reproducible evidence — cost if wrong: local evidence uses disk space.
- Task 3: Ruling: Editorial templates bind symbolic Product slugs only after explicit safe staging Product publish — existing Editorial references require real Published version IDs — cost if wrong: no DB Editorial Draft exists before simulation, but file candidates and subsequent DB Draft/Publish are both proven.
- Final: Ruling: regrade restart EEXIST from Minor to Important — a permanently required Preview should be safely restartable after stopping; stopped receipts must be preserved rather than blocking basic access — cost if wrong: a small launcher-only history helper and two tests, no Product/production behavior expansion.
- Final: Ruling: append 0084 for review hardening, never rewrite locally applied 0082/0083 — forward-only policy applies to the now-existing staging and frozen evidence as well — cost if wrong: one extra migration and refreshed exact counts/bundle rather than fewer SQL edits.
- Final: Ruling: source facts/legal permission remain outside reviewer confirmation — reviewer had no external calls; manual dossier research is not Owner/rights approval — cost if wrong: Content/Source gates wait for actual human checks.
- Final: Ruling: production/object-store/Owner actions remain unexecuted — user explicitly forbids Phase9 and real external actions — cost if wrong: Operations stays NOT READY even though local recovery succeeds.
- Final: Ruling: applied/rejected semantic expansion stands as already ledgered — immutable history with new changed-hash pending review matches authorized active range — cost if wrong: extra manual review outside active suppression.
- Final: Ruling: reviewer excludes pre-existing dirty work and missing fonts using before-files — phase-only scope protects old localization rather than judging its HEAD delta — cost if wrong: unrelated legacy issues remain outside this review.
- Final: Ruling: do not expand retention throughput architecture without workload evidence — bounded1000/day capacity is not independently proven at production scale — cost if wrong: operators must monitor backlog and revisit capacity with real volume.
- Final: Ruling: use a dedicated short-lived PostgreSQL session for each Observation execution lock — providers need their existing SQL pool while awaiting responses, so reserving all pool connections would risk deadlock; connection closure releases the lock without a new persisted lease/schema — cost if wrong: one additional connection per active execution; production capacity requires real-volume observation.
- Final: Ruling: retain the exact pre-review frozen bundle in bundle-pre-review and create a new exclusive current candidate after repair — old evidence and hashes must remain reproducible while current migration/test hashes change — cost if wrong: extra local bundle copy/disk space; no old source/log deletion or production action.

Deferred minors：无；正常重启项按用户实际影响重新分级为Important并已修复。

## S. Git Safety

HEAD 保持 `9848e936106db037d99a304887c36aad3fd0fad4`，branch codex/ai-signal-jp；index/.env 哈希不变。开始时1034路径中1031个存在文件已逐字节备份，3个旧SC字体文件原本缺失并保持缺失。当前审计无 lost/unexpected，78个旧 migration 未改。

最终报告封存后重新核对的证据为 `.data/phase8-20261007-40ca55fd/accepted-git-safety.json` 与 `accepted-phase8-only.diff`。此前 review/final 审计保留，不覆盖旧记录。

本阶段必要修改的 27 个既有文件是基于现有日本化和 Phase0–7 工作的增量，全部保留 before backup 和 phase-only.diff。不是宣称这27个文件字节未变；其余旧文件保持原样。没有 reset/clean/checkout/restore 整批覆盖、stage、commit、push、旧工作清理或 Production 操作。

实际修改/新增清单（含报告）：

- docs/deploy.md
- modules/aifind/admin/contracts.ts
- modules/aifind/catalog/evidence.ts
- modules/aifind/changes/candidates.ts
- modules/aifind/detector/contracts.ts
- modules/aifind/detector/detect.ts
- modules/aifind/detector/fetch.ts
- modules/aifind/detector/jobs.ts
- modules/aifind/detector/monitors.ts
- modules/aifind/detector/observations.ts
- modules/aifind/detector/routes.ts
- modules/aifind/module.ts
- modules/aifind/preview/contracts.ts
- modules/aifind/preview/routes.ts
- modules/aifind/server.ts
- modules/aifind/tests/admin-migrations.test.ts
- modules/aifind/tests/detector-jobs.test.ts
- modules/aifind/tests/detector-paid.test.ts
- modules/aifind/tests/detector-recovery.test.ts
- modules/aifind/tests/detector-retention.test.ts
- modules/aifind/tests/detector-storage.test.ts
- modules/aifind/tests/migrations.test.ts
- modules/aifind/tests/module.test.ts
- modules/aifind/web.tsx
- modules/aifind/web/monitors.tsx
- modules/aifind/web/preview-hub.tsx
- modules/aifind/web/review-detail.tsx
- apps/web/tests/aifind-launch.test.ts
- docs/superpowers/plans/2026-10-07-aifind-phase8-launch-readiness-real-content-report.md
- docs/superpowers/plans/2026-10-07-aifind-phase8-launch-readiness-real-content.md
- modules/aifind/changes/semantics.ts
- modules/aifind/detector/execution.ts
- modules/aifind/detector/retention.ts
- modules/aifind/detector/source-policy.ts
- modules/aifind/launch/bundle.ts
- modules/aifind/launch/contracts.ts
- modules/aifind/launch/corpus.ts
- modules/aifind/launch/preflight.ts
- modules/aifind/launch/routes.ts
- modules/aifind/launch/staging.ts
- modules/aifind/migrations/0082_aifind_source_retention.sql
- modules/aifind/migrations/0083_aifind_candidate_semantics.sql
- modules/aifind/migrations/0084_aifind_review_boundaries.sql
- modules/aifind/tests/launch-bundle.test.ts
- modules/aifind/tests/launch-content.test.ts
- modules/aifind/tests/launch-http.test.ts
- modules/aifind/tests/launch-preflight.test.ts
- modules/aifind/tests/launch-retention.test.ts
- modules/aifind/tests/launch-review-fixes.test.ts
- modules/aifind/tests/launch-semantic.test.ts
- modules/aifind/tests/launch-web-fixture.ts
- modules/aifind/tests/monitor-fixtures.ts
- modules/aifind/web/contact.tsx
- modules/aifind/web/editorial-policy.tsx
- modules/aifind/web/launch-preview.tsx
- scripts/aifind-launch-preflight.ts
- scripts/build-aifind-launch-bundle.ts
- scripts/lib/aifind-launch-runtime.ts
- scripts/serve-aifind-launch-preview.ts
- scripts/stage-aifind-launch.ts
- site/launch/2026-10-07-corpus.json
- site/launch/owner-review.json
- site/pages/editorial-policy.md

源码分工：0082/source-policy/retention 保存审计并约束 fetch；0083/semantics/candidates/detect/review 保留新 Evidence 并去重；launch/*、四个受限 CLI 与 Preview 给真实候选包/只读验收；public policy 页面给正式公开前可核验文案；其余测试和精确架构断言保证旧基线不退化。

## T. Remaining blockers / known limitations

1. Owner 尚未事实核验/批准12个 dossier（包括 NotebookLM→Gemini Notebook 名称和契约、JP/日语/平台/paid 条件），cannot claim owner reviewed。日本语人工 Gold 样本校准及真实性实测不在本轮完成范围。
2. 运营者名称、公开联系方式、正式 SITE_URL 未定；Terms/Privacy 草案及公开政策需要 Owner 确认。已提出一次信息请求，未推断默认批准。
3. 12个来源未完成 robots/条款/短引用及 retention/fetch/Jina 许可审查，均停用；外部采集 gate 的工程机制关闭，运营来源许可 blocker **尚未真正关闭**。
4. Object store 配置、生产远端备份成功回执及实际生产环境恢复演练缺失；本机配对恢复 PASS 不等于 production disaster recovery READY。
5. Source hash 仅 minimal excerpt，不保存全文；两 homepage提取受限；完整 source hash unknown。未完成检测的原输入在处理结束前不会仅因TTL自动销毁，超期需要运维处理。
6. Media GC 未实现；仅 orphan 可观测，旧资产/历史不删除。8个POSIX行为 Windows SKIP保留，Linux CI 本轮 UNRUN。
7. 默认 Production Catalog guard 仍拒绝；bundle 不是生产导入授权或自动 remap 工具。Phase9 需另行明确批准导入/部署/逐项开阀，不能用 local simulation 代替。
8. 所有本阶段截图/数据仍是 local staging，公开政策/实验数据不是正式生产。没有发 Newsletter、接 Affiliate、做额外CMS/微服务/付费模型任务。

## U. Gate Matrix / STOP

| Gate | Result | 依据 |
|---|---|---|
| Engineering Gate | READY | 最终审查发现已全部 TDD 修复，完整套件复跑、Domain/Preview/Chrome/配对恢复均通过；证据见 R |
| Content Gate | NOT READY | Owner reviewed=0/12，公开运营信息/政策审批待定 |
| Operations Gate | NOT READY | Source permission12项未审批，远端备份和生产配置缺失 |
| Phase 9 Gate | NOT READY | Content/Operations blocker未关闭，尚无Phase9授权 |
| Production Launch | NOT EXECUTED | 本轮明确禁止生产连接/导入/部署/开阀 |

### 用户要求的18项明确回答

| # | 问题 | Answer |
|---|---|---|
| 1 | Production external collection blocker真正关闭？ | 工程 policy/retention gate 已实现并测试；运营许可 blocker 未关闭，12真实Monitor停用。 |
| 2 | 原始 text 保留多久？ | evidence_only 处理可终结后由每日hook prune；short_excerpt 默认30天可配置1–365；未完成输入保留并报超期。 |
| 3 | Prune后可人工审查？ | 可以，原hash/时间/quote/160codepoint前后context/locator以及Supporting Evidence仍可读。 |
| 4 | 同语义不同hash多个Review Candidate？ | 同Product/base/type/target/value且active范围内复用一个；rejected不复活，applied和新base不吞新项。 |
| 5 | 新Evidence保留？ | 是，每条Observation独立Evidence和immutable relation，不静默丢弃。 |
| 6 | Production Monitor只能approved？ | 是，且fetch allowed；DB/Domain/实际worker边界均验证，URL变更撤权。 |
| 7 | 真实Product数？ | 12个真实source_material候选；仅local staging显式发布。 |
| 8 | Owner reviewed数？ | 0，不把机器验证/local publish当成Owner审核。 |
| 9 | release混入synthetic Product？ | 无；recursive检查+实际公开数据smoke均通过，私有rehearsal项排除。 |
| 10 | 伪造hands-on/TestRecord？ | 无；6 Editorial都是official_sources。原创流程图不是产品截图/实测。 |
| 11 | Bundle含secret？ | 无；字段/值/credential URL/服务密钥检测均通过，.env/DSN/login/cookie未复制。 |
| 12 | Fresh DB从零重建？ | 是，最终全新空库81migrations→12 Draft/0 Published→单独operator Publish演练→12产品/6编辑内容公开读验收。 |
| 13 | DB+Asset完整恢复？ | 本机真实配对恢复PASS；只有DB的带图Guide失败关闭；objectstore未配置仍是blocker。 |
| 14 | Public policy仍placeholder？ | 是，Terms/Privacy草案、运营者/邮箱/正式URL未定；新EditorialPolicy有真实规范，未伪造批准。 |
| 15 | Production importer默认拒绝？ | 是，现有guard不变，没有force-production或隐藏开关。 |
| 16 | 连接/写Production DB？ | 否，所有写入仅本阶段loopback *_test/*_preview安全库。 |
| 17 | 开Production Detector？ | 否，COLLECT/MODEL/AIFIND_DETECTOR/FEISHU/INDEXNOW全false。 |
| 18 | Phase9人工动作？ | Owner逐项审dossier；运营者/邮箱/正式URL/法律文案确认；Source permissions；objectstore与灾备；另行批准production授权设计、部署/导入和逐项开阀。 |

停止于Phase8；不自动进入Phase9。
