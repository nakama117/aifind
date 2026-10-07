# AIFIND Phase 7 — How-to / Guide + Media / Test Evidence
报告日期：2026-10-07（Asia/Shanghai）。最终汇总时间：2026-10-06T17:29:17.465Z。
**Phase 7 Gate = READY。Phase 8 Gate = READY（技术交接门槛），本轮已停止，未开始 Phase 8。**
本轮提供可运行的 How-to engine 和明显标记的 local synthetic Preview；没有真实可发布的产品教程。Production Product added = 0（本轮新增为零；沿用已验收真实 Catalog 零导入状态，未连接生产复查）。
权威需求：用户附件全文已保存为 [user-spec.md](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/user-spec.md>)；实施前计划为 [docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media.md](</D:/Projects/aihot/docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media.md>)。本文所有 PASS 来自本轮新执行。

## A. Architecture

继续使用 Node 24、Fastify、PostgreSQL、React Router SSR、已安装 Sharp 和既有 module/admin 路由。Guide 扩展 Phase 6 Editorial Document/Revision，复用 Domain、Admin action、expectedRevision、audit、Publish/Withdraw/Restore 和永久 slug claim。前端通过 HTTP 访问 Site/Admin API；Product 与 Editorial 公开读取继续进入 publication 的 coherent read-only snapshot。
当前 Published Product 与历史 reference facts 均由真实 Product Domain Reader 投影；Guide 不保存 Product facts/金额副本。Asset 二进制在持久数据目录，DB 保存身份、哈希、审核及 revision 关系。没有新增 CMS、缓存服务、微服务或依赖安装。

## B. Schema / migrations

| Migration | 新增/修改 | 不变量 |
|---|---|---|
| [modules/aifind/migrations/0080_aifind_guides.sql](</D:/Projects/aihot/modules/aifind/migrations/0080_aifind_guides.sql>) | guide doc_type；af_guides / af_guide_products / af_guide_test_records；扩展原 revision 发布 guard | Product/reference/Plan 归属，Draft 可编辑，Published/历史关系不可变；主产品及模式门禁 |
| [modules/aifind/migrations/0081_aifind_editorial_assets.sql](</D:/Projects/aihot/modules/aifind/migrations/0081_aifind_editorial_assets.sql>) | af_editorial_assets / af_editorial_revision_assets；二进制身份 guard；Asset 发布 guard | 权利及隐私均需审查，caption/alt 必须存在；Published relation 不可变；FK RESTRICT |

原 76 个 migration SHA-256 全部不变。0080/0081 追加在当前 0079 之后，未修改已发布迁移。真实空库迁移、重跑、旧链保留及约束由完整套件验证；原迁移注册测试仅更新精确数量/路由集合。

## C. Editorial Core reuse

createEditorial、saveEditorialDraft、createEditorialDraft、publishEditorial、withdrawEditorial、restoreEditorial、readEditorialAdmin 共用原 Document 行锁、revision 冲突和 audit。仅增加 guide 分支、结构化表读写和图片关系同步；没有第二套 Document/CMS。保存只影响 Draft；Admin Preview 只显示已保存内容；Human Publish 后才切换公开 revision。
原 Comparison/Category 的 12 个 Web 回归及所有 Phase 6 名称/状态保留。Restore 创建新 Draft，保留旧 Published，复用原 Asset ID 和二进制。

## D. Guide Domain

沿用 common title/excerpt/bodyMd/SEO。Guide 包含 mode、task、taskResultMd、prerequisitesMd、materialsMd、stepsMd、resultMd、failuresMd、limitationsMd、costNotesMd、alternativesMd。发布至少 1、最多 3 个不同 Product，恰好 1 个 primary，optional alternative/prerequisite。
当前 Product 必须 listed、Published、public-ready。引用记录 Product ID、历史 Published version ID 和 optional Plan/Price 引用；归属与版本有效性由 Domain/SQL 校验。正文、结构化字段、Product fact 和 Test Record 语义分离。

## E. official_sources / hands_on

official_sources 明确显示“公式資料に基づく解説 · AIFINDによる実測ではありません”；公开 DTO 不发出 Test Record/testedAt。hands_on 显示实测记录及其条件，主产品必须有完整 bound Test Record；不是仅切换 label。
所有本地示例及 Test Record 均有 [PREVIEW]/[SYNTHETIC]，说明没有使用实在产品、没有测量产品性能。没有 LLM 自动生成教程或伪造真实测评。

## F. Test Records

采用 user spec 允许的 Guide-specific 小记录，复用既有 TestRecordSchema。记录绑定 Guide revision + Product + reference Published version + referenced Plan；包含 task、environment/procedure/result/limitations、testedAt、reviewer、optional repeatCount/errorCriteria。
testedAt 为有时区的独立实测时间，Preview 显示 2026/10/06 10:00 JST，并验证不等于 publication time。Product/version/Plan 修改会清空旧记录；旧记录不能保持同一 testedAt 偷换版本。新参照与新记录先保存新 Guide Draft，再 Human Publish。
已有 Comparison Test Records 不改变。数据库直接写、错误归属、缺字段、旧 record 搬移和 UI 引用切换均有覆盖。

## G. Product reference / current facts

页面分开展示“現在の Published”与“手順の参照版”。当前 facts 动态取最新 Published；reference 保持原版本和原日期、原 Plan/Price facts。JPY/USD 等原始币种不转换；free/fixed/custom/unknown 和 available/unavailable/unknown 保持既有 Product 语义。
Guide 明确注明费用未确认不表示免费。Reference/current 读取在同一快照批量执行，Product Draft、Candidate、Apply Draft 不进入公开结果。

## H. needs_retest

primary 当前 Published version ID 与 Guide reference ID 不同即 needsRetest=true；alternative 更新不误报主步骤已失效。显示日文 warning 与 current v2/reference v1。读取变化不会写回 steps/result/Test Record。
Domain/Web/Chrome 均证明 Product Draft 不改变公开 Guide；Human Product Publish 后 facts 更新、reference 保留、步骤/结果 byte-identical。只有合适的新 Guide revision/reference/Test Record + Human Publish 才清除 retest。

## I. Assets / storage

仅 PNG/JPEG/静态 WebP；扩展名/MIME/magic 一致、完整解码、5 MiB、60M decoded pixels、最大 2400px、不放大、auto-orient、默认清除元数据，再编码 WebP。拒绝 HTML/SVG、动画、伪扩展、损坏、超大、pixel bomb、unsafe filename/path traversal。
处理后文件固定 `config.dataDir/uploads/aifind-editorial/<processedSHA256>.webp`；当前本机目录为 `D:/Projects/aihot/.data/aifind-guide-preview/uploads/aifind-editorial`。同处理后哈希共享物理文件，Asset 身份与权限独立。
原始上传二进制不保留，只留 original SHA-256；上传失败事务可能留下 private orphan，不删除别的并发上传正在复用的文件。原图不可恢复是明确设计取舍。

## J. Rights / privacy review

默认 rightsBasis=unreviewed、rights/ privacy reviewedAt=null。独立受保护 CSRF review action 要求明确 basis/note、rightsReviewed 与 privacyReviewed；actor/时间由服务器记录，audit 保存变更。勾选不会默认通过；未勾选保存会撤销相应审核并立即影响公开资格。
上传、attach/update/detach/reorder、审核都记录操作理由；公开 DTO 不包含 rights note、privacy reviewer、storageKey/uploader。100 张之外的当前附件通过 bounded admin batch IDs 读取，Restore 的旧图也始终有审查控件。

## K. Public asset isolation

Admin Draft rendition `/api/admin/aifind/assets/:id/file` 必须登录，noindex/no-store；public `/api/site/aifind/assets/:id` 只在至少一个完整 eligible Published Guide 引用该 Asset ID 时可访问。
公开返回 sanitized WebP、nosniff、no-store。资格包含 Guide state/current Published、全部 Product 依赖、rights/privacy、caption/alt、实际文件/哈希。任一依赖失效，detail/list/home/related/sitemap/old slug/OG/asset 全部 fail-closed。
Withdraw 后若此 Asset 只有该 Guide 的公开引用，立即 404；若另一个仍 eligible 的 Published Guide 合法引用相同 Asset ID，则可继续公开。共享 SHA 文件不会替代按 ID 的资格检查。没有原文件或存储目录匿名路由。

## L. Backup / recovery

复用现有 runBackup 的 DB dump + uploads 文件包，无备份系统重构。[docs/deploy.md](</D:/Projects/aihot/docs/deploy.md>) 已补充 Guide paired restore 和“不直接开放 uploads”的说明。
完整套件中 2 个真实 pg_dump/tar/pg_restore 回归通过；额外本机 browser3 备份和独立 recovery_test 恢复 5/5 通过：[final-local-backup-restore.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-local-backup-restore.json>)。
Dump：[aifind-phase7-c3913c41-browser3-preview-202610061722.dump](</D:/Projects/aihot/.data/aifind-guide-preview/backups/aifind-phase7-c3913c41-browser3-preview-202610061722.dump>)；文件包：[aifind-phase7-c3913c41-browser3-preview-files-202610061722.tar.gz](</D:/Projects/aihot/.data/aifind-guide-preview/backups/aifind-phase7-c3913c41-browser3-preview-files-202610061722.tar.gz>)。两者 SHA-256 与完整 manifest 见证据，required WebP 确实在 archive 内。
恢复 DB＋文件后真实 Published Reader 返回 Guide revision 3、正确 Asset ID 与 processed hash；同一 restored DB 指向空文件目录时真实 Reader 返回 not_found。DB-only 不算完整恢复。
pg client tools 复用现有 .data/pg17-client，未安装系统软件；本轮没有生产/S3 对象上传，uploaded=false 是明确的 local-only 设置，非恢复失败。

## M. Admin

复用 Admin list/detail/history/reason dialogs；`/admin/aifind/howto[/:id]` 支持 create/save/reload/saved Preview/publish/withdraw/restore/stale409。输入区独立展示 Product reference/Test Record、图片上传/角色/排序/caption/alt/审查。
最终独立审查提出两个 Important、无 Critical/Minor：①延迟上传覆盖期间的图片修改；②latest100 后旧附件失去审查。均先真实 Chrome RED，再最小修复和 GREEN。
①函数式最新状态追加，保留 caption/alt/role/排序/移除，重新检查 30 件上限。②最近复用列表保留 100 条，另按当前附件 ID 批量读取详情，鉴权/UUID/最大30项门禁不降低。
实际 Chrome FIX01–FIX04 `0 PASS / 4 FAIL → 4 PASS / 0 FAIL`；Published 仍与 before deep-equal。证据：[review-browser-red.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/review-browser-red.json>)、[review-browser-green.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/review-browser-green.json>)。

## N. Public Routes / Site API

| 出口 | 行为 |
|---|---|
| /howto | 可索引真实 eligible Guide 目录 |
| /howto/:slug | SSR task→条件/环境→素材→步骤/图片→结果/记录→失败/限界/费用→代替→current/reference facts→sources→可用相关内容 |
| /api/site/aifind/howto[/:slug] | 真实 shared Reader DTO，不使用 mock HTML |
| /api/site/aifind/assets/:id | 只返回 eligible sanitized rendition |
| /api/admin/aifind/assets[?ids=...] | 受保护 recent100 或 bounded attached IDs 元数据；上传、审查及文件读取受原 Admin 规范约束 |
| /api/site/aifind/home / Product detail | 只显示真实 Published Guide；无 eligible Guides 时视觉模块不显示 |

新增自然导航“使い方”。真实截图发现既有 phone TabBar 仅支持 4/5 列，在现有 8 个 tabs 时堆叠。仅改通用按实际数量 grid 分栏及标签行高；没有硬编码品牌或改变旧导航名单。390px 实测 8 个入口都在 bar 内，宽度至少44px，Guide active 清楚。
旧 public v1/RSS/MCP/OpenAPI 保持原边界，无 Guide Draft/Asset 内部信息。

## O. SEO / slug / sitemap

Published Guide 与目录可索引；canonical/OG 使用 SITE_URL，当前本机 origin `http://localhost:3800`，不硬编码生产域名。Guide JSON-LD 仅 WebPage/BreadcrumbList；没有伪 HowTo、Review、AggregateRating 或 ratings。
沿用 permanent claims；改 slug 后旧 URL 单跳 301 到当前 canonical。资格失效时旧 URL 先 404，不泄漏重定向。Draft/Withdrawn/private/unlisted/not-ready/asset invalid 都不进 sitemap。Admin/Preview noindex,nofollow/no-store，不进 sitemap、公开导航、RSS/MCP/public API。
当前 `/howto/aifind-preview-guide-browser` → `/howto/aifind-preview-guide-browser-current` 为实测 301。

## P. Preview

| 页面 | 真实 URL |
|---|---|
| Preview Hub | [/admin/aifind/preview](http://localhost:3800/admin/aifind/preview) |
| Phase7 Preview | [/admin/aifind/preview/howto-guide](http://localhost:3800/admin/aifind/preview/howto-guide) |
| Guide Admin | [/admin/aifind/howto](http://localhost:3800/admin/aifind/howto) |
| Public directory | [/howto](http://localhost:3800/howto) |
| Published synthetic official Guide | [/howto/aifind-preview-guide-browser-current](http://localhost:3800/howto/aifind-preview-guide-browser-current) |
| Published synthetic hands_on Guide | [/howto/aifind-preview-guide-hands-on](http://localhost:3800/howto/aifind-preview-guide-hands-on) |

当前 own runtime DB `aifind_phase7_c3913c41_browser3_preview`，web3800/API3801，无 worker。登录密码只在本机 [login.txt](</D:/Projects/aihot/.data/aifind-guide-preview/login.txt>)；报告不打印密钥或密码。
Seed：[scripts/seed-aifind-guide-preview.ts](</D:/Projects/aihot/scripts/seed-aifind-guide-preview.ts>) → [modules/aifind/preview/guide-seed.ts](</D:/Projects/aihot/modules/aifind/preview/guide-seed.ts>)。必须显式 AIFIND_PREVIEW_ENABLED=true、nonproduction、loopback *_preview/_test/_ci，无连接 query；default/production 拒绝。CLI 明确创建 4 个 Guide Draft 和自制图，审核仍 pending；GET/startup 不 seed、不发布。
本轮 Published fixture 仅由可见 Chrome 的显式 Publish 操作创建。Seed 包含 official/hands-on/retest/draft-only；Hub Available，P01–P26 为检查项而非伪造 PASS。实际结果下表来自本轮测试/Chrome/恢复：

| ID | 检查 | 结果 | 证据 |
|---|---|---|---|
| P01 | Guide Draft | PASS | C03/Domain G03 |
| P02 | Admin Preview | PASS | C06/Web |
| P03 | official_sources label | PASS | C06/M02 |
| P04 | Human Publish | PASS | C12/G05 |
| P05 | /howto | PASS | C13 |
| P06 | /howto/:slug | PASS | C14 |
| P07 | current facts | PASS | C14/C22 |
| P08 | reference version | PASS | C22/R07 |
| P09 | Product Draft no effect | PASS | C21/R02 |
| P10 | Publish→needs_retest | PASS | C22 |
| P11 | steps unchanged | PASS | C23/R09 |
| P12 | hands_on Test Record | PASS | C18/C19/M03–M04 |
| P13 | testedAt visible | PASS | C20 |
| P14 | upload | PASS | C07 |
| P15 | sanitized rendition | PASS | C16/A13 |
| P16 | original not public | PASS | C17 |
| P17 | Draft asset denied | PASS | C11/C30 |
| P18 | rights review | PASS | C09 |
| P19 | privacy review | PASS | C10 |
| P20 | Restore asset refs | PASS | C24/AR06–AR07 |
| P21 | slug history | PASS | C25 |
| P22 | Product dependency invalid | PASS | C26 |
| P23 | Withdraw | PASS | C27 |
| P24 | sitemap removal | PASS | C28 |
| P25 | Product related Guide | PASS | Web related test / domain publication |
| P26 | backup contains Asset | PASS | B03 / final local recovery |

## Q. Chrome C01–C30

真实可见 installed Chrome 154.0.8037.95，1366×900 / 390×844，isolated project profile，headless=false。来自已有 bundled Playwright runtime，无安装；最初 browser connector 初始化失败后使用已存在 runtime。所有网页 request 仅允许 localhost/127.0.0.1，blockedExternalRequests=0、pageErrors=0。C14 实测 Tab 到“本文へ移動”，solid2px focus；C29 八 tab 均可见，图片/table/code 局部限制，无整页横向溢出。
最终 [chrome-final-c01-c30.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-c01-c30.json>)：30 PASS / 0 FAIL。

| ID | 实测项 | 结果 | URL |
|---|---|---|---|
| C01 | Preview Hub shows Phase7, login and protected 26-case Preview | PASS | http://localhost:3800/admin/aifind/preview/howto-guide |
| C02 | Guide Admin lists real Drafts and creation fields | PASS | http://localhost:3800/admin/aifind/howto |
| C03 | Create a new Guide Draft through the browser form | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C04 | Save typed sections and Product reference through real editor | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C05 | Stale save is rejected with 409 and saved Draft unchanged | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C06 | official_sources saved Preview uses real Product facts and explicit non-test label | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C07 | Upload a self-created PNG through multipart browser UI | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C08 | Private thumbnail, role, caption and alt are saved as revision Asset relations | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C09 | Explicit rights review leaves privacy gate closed | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C10 | Explicit privacy review clears both gates and records dates | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C11 | Before human Publish public Guide and sanitized asset are both 404 | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C12 | Human Publish uses saved Draft, reason dialog and CSRF | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C13 | /howto directory and natural navigation show real eligible Guide | PASS | http://localhost:3800/howto |
| C14 | Public detail renders Japanese Product facts and source evidence | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C15 | Structured steps, code and table stay readable | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C16 | Published image is a sanitized WebP with caption, alt and no-store | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C17 | Original binary and direct storage paths are not public | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C18 | hands_on Guide is explicitly published then visible | PASS | http://localhost:3800/howto/aifind-preview-guide-hands-on |
| C19 | Synthetic Test Record identifies task, environment and reviewer without real product claims | PASS | http://localhost:3800/howto/aifind-preview-guide-hands-on |
| C20 | testedAt is visible and independent of publication time | PASS | http://localhost:3800/howto/aifind-preview-guide-hands-on |
| C21 | Creating and saving Product Draft through Admin leaves public Guide unchanged | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C22 | Product Human Publish visibly sets needs_retest and preserves historical facts | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C23 | Product Publish never rewrites authored steps or results | PASS | http://localhost:3800/howto/aifind-preview-guide-browser |
| C24 | Restore creates a new Draft and copies Asset reference without binary duplication | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C25 | Changed slug produces one direct 301 to current canonical | PASS | http://localhost:3800/howto/aifind-preview-guide-browser-current |
| C26 | unlisted Product hides Guide, asset, related links and sitemap; re-list restores eligibility | PASS | http://localhost:3800/admin/aifind/products/499a907a-87cf-4f37-b351-27a3c1c33190 |
| C27 | Withdraw removes Guide and public asset while preserving history | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C28 | Withdraw removes sitemap, old slug, home and Product-related Guide | PASS | http://localhost:3800/admin/aifind/howto/c890a8fd-b5f7-44a4-b6b0-d0b4785431dd |
| C29 | 390px mobile Japanese Guide has no whole-page overflow, semantic prices and local code/table scroll | PASS | http://localhost:3800/howto/aifind-preview-guide-hands-on |
| C30 | Anonymous visible Chrome cannot access Admin, Saved Draft Preview or Draft assets | PASS | http://localhost:3800/admin/aifind/preview/howto-guide |

早期 Chrome-first14/30：测试脚本漏填保存后重置的理由，Publish 正确被审查 gate 拒绝；修正已有 UI selector 后 Chrome-second30/30。Chrome-third 首次请求早于 API ready，日志明确 ECONNREFUSED；只读确认4个Draft未改变后，验收脚本先检查API200/SSR302，再最终30/30。全部原日志/截图保留，没有拿旧30/30代替最终结果。
四个审查回归另有真实延迟请求、caption/alt/role修改、detach、101新图片和旧关系 Restore；[review-browser-green.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/review-browser-green.json>) 4/4 PASS。

## R. Screenshots

| 文件 | 实际路径 |
|---|---|
| howto-admin-preview.png | [howto-admin-preview.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-admin-preview.png>) |
| howto-asset-review.png | [howto-asset-review.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-asset-review.png>) |
| howto-detail-desktop.png | [howto-detail-desktop.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-detail-desktop.png>) |
| howto-hands-on.png | [howto-hands-on.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-hands-on.png>) |
| howto-needs-retest.png | [howto-needs-retest.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-needs-retest.png>) |
| howto-detail-mobile.png | [howto-detail-mobile.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-detail-mobile.png>) |
| howto-steps-mobile.png | [howto-steps-mobile.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-steps-mobile.png>) |
| howto-image-mobile.png | [howto-image-mobile.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-image-mobile.png>) |
| howto-facts-mobile.png | [howto-facts-mobile.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-facts-mobile.png>) |
| howto-test-record-mobile.png | [howto-test-record-mobile.png](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-screenshots/howto-test-record-mobile.png>) |

已作为真实像素逐项查看必需六张及 mobile image/facts/Test Record 截图。Japanese 无明显乱码；task/条件/步骤清楚；official_sources 不暗示实测；current v2 / reference v1 与 needs_retest 分开；图有 alt/caption；费用“未确认”不等于免费；桌面正常，390px 无整页 overflow，8tab 完整。

## S. Performance

实际 [final-guide-smoke-performance.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-guide-smoke-performance.json>)，每项10次 warm samples，记录原 SQL 文本/connection/queryCount/latency，值参数未记录。每次 Guide Reader 只有一个 BEGIN REPEATABLE READ READ ONLY；current/reference Product 各 fact family 用批量 IN 读取，没有每 Product 新开 snapshot。
本轮仅测本机 synthetic 1/2 Product，不是生产容量结论；最多3 Product由Domain/SQL验证。1-product含图片多一资产查询，2-product无图片；query数不随Product逐个增长。

| Reader | Products | Queries（含BEGIN/COMMIT） | Median ms | P95 ms |
|---|---|---|---|---|
| aifind-preview-guide-browser-current | 1 | 38 | 10.65 | 14.09 |
| aifind-preview-guide-hands-on | 2 | 37 | 7.70 | 10.91 |

| HTTP | Median ms | P95 ms | Bytes |
|---|---|---|---|
| /howto/aifind-preview-guide-browser-current | 73.46 | 100.98 | 58773 |
| /howto/aifind-preview-guide-hands-on | 101.86 | 116.11 | 79478 |
| /api/site/aifind/howto/aifind-preview-guide-browser-current | 24.13 | 26.73 | 9641 |

安全 read before/after 完全相同：receipts=0、receipt_attempts=0、observations=0；本机 synthetic Products36/Documents8 是复用既有 Preview seed 的结果，非生产真实产品新增。

## T. Regression

| 检查 | 结果 | 本轮证据 |
|---|---|---|
| npm run typecheck | PASS | [accepted-typecheck-meta.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/accepted-typecheck-meta.json>) |
| 安全 *_test npm test | 1035 total /1027 PASS /0 FAIL /0 CANCELLED /8 old SKIP | [final-full-meta.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-full-meta.json>) |
| npm run build -w @aihot/web | PASS | [final2-build-meta.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final2-build-meta.json>) |
| node --test apps/web/tests/*.test.ts | 89/89 PASS /0 FAIL /0 CANCELLED /0 SKIP | [final-web-meta.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-web-meta.json>) |
| Site smoke | 30/30 PASS | [final-site-smoke-meta.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-site-smoke-meta.json>) |
| Guide smoke | 19/19 PASS | [final-guide-smoke-performance.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-guide-smoke-performance.json>) |
| real Chrome C01–C30 | 30/30 PASS | [chrome-final-c01-c30.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/chrome-final-c01-c30.json>) |
| Chrome review regressions | 4/4 PASS | [review-browser-green.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/review-browser-green.json>) |
| real local backup/recovery | 5/5 PASS + full suite B tests2/2 | [final-local-backup-restore.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-local-backup-restore.json>) |

完整 DB 使用 `/aifind_phase7_c3913c41_isolated_test`，loopback55432；所有常态安全阀 false，测试假服务只连 localhost，并使用既有 MockAgent 禁止外部网络。没有真实 OpenAI/X/Jina/Feishu/IndexNow 调用。
与 Phase6 [phase6-final2-baseline.json](</D:/Projects/aihot/.data/phase6-20261006-281ca693/phase6-final2-baseline.json>) 精确 multiset 对比：956/956 DB 和75/75 Web的 test name/depth/status/reason保留；新增79 DB和14 Web均PASS。[final-baseline-preservation.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-baseline-preservation.json>) 内 missingOrChanged=[]，8 SKIP逐字一致；Tokyo、AIFIND Brand和既有Published隔离等旧测试均保留通过。

| 保留 SKIP 测试 | 原环境 reason（逐字不变） |
|---|---|
| SIGTERM during the final paid writing call still commits the complete analysis and publication | Windows terminates processes instead of delivering POSIX SIGTERM; covered by Linux CI |
| SIGTERM during successful first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| SIGTERM during failed first score drains slower structure and leaves a retryable job | POSIX SIGTERM; covered by Linux CI |
| packing retries once and a successful retry preserves the screenshot | POSIX shell executable fixture; covered by Linux CI |
| persistent packing failure still sends the database and reports incomplete backup | POSIX shell executable fixture; covered by Linux CI |
| an unreadable upload directory cannot become a successful empty backup | POSIX symlink-loop fixture; covered by Linux CI |
| SIGTERM finishes the sent normal batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |
| SIGTERM finishes the sent misaligned batch and resumes from its receipt | POSIX SIGTERM; covered by Linux CI |

中间完整 runs 也保留：full-first 的3个旧精确注册断言更新；full-second 有1个原迁移测试 timeout，隔离两次分别2425/2437ms通过，full-third及final-full正常，无增加timeout。Web早期auth redirect断言修正为精确既有302→/api/auth/login?return=，没有改auth实现或放宽断言。失败来源和解决过程见 [progress.md](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/progress.md>)。
下一阶段权威 baseline：[phase7-accepted-baseline.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/phase7-accepted-baseline.json>)（1035DB/89Web，含names/status/reasons/log/screenshot SHA及此次真实备份恢复）。

## U. Git Safety

开始于 `9848e936106db037d99a304887c36aad3fd0fad4`，branch `codex/ai-signal-jp`；HEAD和branch未移动、index/.env字节不变。修改前1008paths中1005文件全部备份，3个SCfont旧缺失仍缺失；没有删除现有文件，也没有恢复SC字体。
当前相对于本轮before：28个既有文件按范围追加/扩展、26个新文件（包含本报告），其余977个现有文件 byte-identical。原tracked/untracked已有工作未被Git批量覆盖；本文只列Phase7增量。
禁止命令全部未使用：reset --hard、clean、checkout/restore覆盖、stage/commit/push。没有安装依赖、未改lockfile、未动生产DB。只停止本轮1/2 Preview进程，所有旧阶段服务保留；最终3800Preview仍可访问。
证据：[git-before.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/git-before.json>)、[final-source-git-safety.json](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-source-git-safety.json>)、[final-source-phase7-only.diff](</D:/Projects/aihot/.data/phase7-20261006-c3913c41/final-source-phase7-only.diff>)；报告写后再生成最终 hash核验 final-git-safety.json/phase7-only.diff。

| 动作 | 文件 | 原因 |
|---|---|---|
| 修改 | [apps/web/app/components/shell/TabBar.tsx](</D:/Projects/aihot/apps/web/app/components/shell/TabBar.tsx>) | 修复任意配置tab数的手机分栏，无品牌硬编码 |
| 修改 | [docs/deploy.md](</D:/Projects/aihot/docs/deploy.md>) | 补充Guide的DB+图片成对恢复 |
| 修改 | [modules/aifind/editorial/contracts.ts](</D:/Projects/aihot/modules/aifind/editorial/contracts.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/editorial/documents.ts](</D:/Projects/aihot/modules/aifind/editorial/documents.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/editorial/public-contracts.ts](</D:/Projects/aihot/modules/aifind/editorial/public-contracts.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/editorial/read.ts](</D:/Projects/aihot/modules/aifind/editorial/read.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/editorial/routes.ts](</D:/Projects/aihot/modules/aifind/editorial/routes.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/editorial/validation.ts](</D:/Projects/aihot/modules/aifind/editorial/validation.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 修改 | [modules/aifind/module.ts](</D:/Projects/aihot/modules/aifind/module.ts>) | 模块路由/API/nav注册 |
| 修改 | [modules/aifind/preview/routes.ts](</D:/Projects/aihot/modules/aifind/preview/routes.ts>) | 显式安全合成Preview及真实Hub/Reader |
| 修改 | [modules/aifind/public/editorial-routes.ts](</D:/Projects/aihot/modules/aifind/public/editorial-routes.ts>) | Phase7范围内复用/扩展 |
| 修改 | [modules/aifind/publication/editorial.ts](</D:/Projects/aihot/modules/aifind/publication/editorial.ts>) | 真实current/reference facts和严格Public资格统一读取 |
| 修改 | [modules/aifind/publication/public-products.ts](</D:/Projects/aihot/modules/aifind/publication/public-products.ts>) | 真实current/reference facts和严格Public资格统一读取 |
| 修改 | [modules/aifind/server.ts](</D:/Projects/aihot/modules/aifind/server.ts>) | 模块路由/API/nav注册 |
| 修改 | [modules/aifind/tests/admin-migrations.test.ts](</D:/Projects/aihot/modules/aifind/tests/admin-migrations.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 修改 | [modules/aifind/tests/migrations.test.ts](</D:/Projects/aihot/modules/aifind/tests/migrations.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 修改 | [modules/aifind/tests/module.test.ts](</D:/Projects/aihot/modules/aifind/tests/module.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 修改 | [modules/aifind/web.tsx](</D:/Projects/aihot/modules/aifind/web.tsx>) | 模块路由/API/nav注册 |
| 修改 | [modules/aifind/web/admin-common.tsx](</D:/Projects/aihot/modules/aifind/web/admin-common.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/editorial-detail.tsx](</D:/Projects/aihot/modules/aifind/web/editorial-detail.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/editorial-editor.tsx](</D:/Projects/aihot/modules/aifind/web/editorial-editor.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/editorial-list.tsx](</D:/Projects/aihot/modules/aifind/web/editorial-list.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/editorial-view.tsx](</D:/Projects/aihot/modules/aifind/web/editorial-view.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/home-products.tsx](</D:/Projects/aihot/modules/aifind/web/home-products.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/public-editorial-list.tsx](</D:/Projects/aihot/modules/aifind/web/public-editorial-list.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/public-editorial.tsx](</D:/Projects/aihot/modules/aifind/web/public-editorial.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [modules/aifind/web/public-product.tsx](</D:/Projects/aihot/modules/aifind/web/public-product.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 修改 | [scripts/serve-aifind-preview.ts](</D:/Projects/aihot/scripts/serve-aifind-preview.ts>) | guide本机runtime分支；无worker/auto seed |
| 新增 | [apps/web/tests/aifind-guide-assets.test.ts](</D:/Projects/aihot/apps/web/tests/aifind-guide-assets.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [apps/web/tests/aifind-guide.test.ts](</D:/Projects/aihot/apps/web/tests/aifind-guide.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media.md](</D:/Projects/aihot/docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media.md>) | 先行实施计划/实际验收报告 |
| 新增 | [modules/aifind/editorial/asset-routes.ts](</D:/Projects/aihot/modules/aifind/editorial/asset-routes.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 新增 | [modules/aifind/editorial/assets.ts](</D:/Projects/aihot/modules/aifind/editorial/assets.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 新增 | [modules/aifind/editorial/guides.ts](</D:/Projects/aihot/modules/aifind/editorial/guides.ts>) | 扩展既有EditorialCore、Guide、Asset/审核/安全API |
| 新增 | [modules/aifind/migrations/0080_aifind_guides.sql](</D:/Projects/aihot/modules/aifind/migrations/0080_aifind_guides.sql>) | 追加Guide/Asset完整性和发布约束 |
| 新增 | [modules/aifind/migrations/0081_aifind_editorial_assets.sql](</D:/Projects/aihot/modules/aifind/migrations/0081_aifind_editorial_assets.sql>) | 追加Guide/Asset完整性和发布约束 |
| 新增 | [modules/aifind/preview/guide-seed.ts](</D:/Projects/aihot/modules/aifind/preview/guide-seed.ts>) | 显式安全合成Preview及真实Hub/Reader |
| 新增 | [modules/aifind/preview/guide-service.ts](</D:/Projects/aihot/modules/aifind/preview/guide-service.ts>) | 显式安全合成Preview及真实Hub/Reader |
| 新增 | [modules/aifind/tests/guide-assets.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-assets.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-backup.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-backup.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-domain.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-domain.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-fixtures.ts](</D:/Projects/aihot/modules/aifind/tests/guide-fixtures.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-http.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-http.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-preview.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-preview.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-publication.test.ts](</D:/Projects/aihot/modules/aifind/tests/guide-publication.test.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/tests/guide-web-fixture.ts](</D:/Projects/aihot/modules/aifind/tests/guide-web-fixture.ts>) | 真实Domain/HTTP/SSR/安全或恢复回归与fixture |
| 新增 | [modules/aifind/web/guide-assets.ts](</D:/Projects/aihot/modules/aifind/web/guide-assets.ts>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [modules/aifind/web/guide-editor.tsx](</D:/Projects/aihot/modules/aifind/web/guide-editor.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [modules/aifind/web/guide-preview.tsx](</D:/Projects/aihot/modules/aifind/web/guide-preview.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [modules/aifind/web/guide-view.tsx](</D:/Projects/aihot/modules/aifind/web/guide-view.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [modules/aifind/web/public-guide.tsx](</D:/Projects/aihot/modules/aifind/web/public-guide.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [modules/aifind/web/public-guides.tsx](</D:/Projects/aihot/modules/aifind/web/public-guides.tsx>) | Guide Admin/SSR UI、真实HTTP、语义展示及并发修复 |
| 新增 | [scripts/seed-aifind-guide-preview.ts](</D:/Projects/aihot/scripts/seed-aifind-guide-preview.ts>) | 显式安全合成Preview及真实Hub/Reader |
| 新增 | [docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media-report.md](</D:/Projects/aihot/docs/superpowers/plans/2026-10-07-aifind-phase7-howto-guide-media-report.md>) | 先行实施计划/实际验收报告 |

## V. Known Limitations / carry-over

- Production external collection MUST NOT be enabled until retention/rights policy is explicitly decided. Phase4 retention/rights没有因Guide assets而解决。
- Phase4 semantic candidate dedupe 仍是backlog，proposal key/Detector未顺手改动。
- How-to engine ready ≠ AIFIND已有真实可发布教程。所有Preview实测记录都是系统fixture；真实产品测评、资料权利、步骤校验仍需人工生产。
- 原始上传二进制不保留；只能恢复sanitized rendition与原SHA。Private orphan/历史二进制GC及完整媒体库未实施，磁盘保留策略以后另定。
- 具体rights/privacy声明由人审查，程序只强制状态/audit/gates，不能保证人工判断绝对正确。
- Compare/Category页面反向展示Guide属于可选项未做；Guide→Compare/Category及Product→Guide已具备真实Published关系读取。
- 本轮备份验证为local真实dump/tar/restore及原fake-store测试，没有真实S3生产上传或生产压测。
- 8个Windows SKIP为原POSIX平台行为，保留精确原因，Linux CI继续负责；没有新unexplained SKIP。
- Preview startup不是就绪信号；浏览器验收使用API200/SSR302health前置检查。无auto seed/auto publish。

### 审查中明确保留的四项范围决定
1. Production采集、真实Catalog导入、Phase8继续关闭，因用户明确排除；若重新打开会越过授权及未解决的production政策。
2. Compare/Category反向Guide链接按spec59为optional而延期；代价是那两个页面的反向发现入口仍缺少。
3. 通用媒体库及复杂orphan GC按scope延期；代价是历史/private文件可能持续占磁盘。
4. Rights/privacy事实归人工，系统执行明确审核及发布门槛；代价是错误人工声明仍可能错误放行。没有deferred Minor审查项。

## 直接回答18项

| # | 问题 | 回答与证据 |
|---|---|---|
| 1 | 复用Phase6 Editorial Core？ | 是，shared Document/Revision与全部admin/domain动作；C节/G01–G10 |
| 2 | Product facts复制进Guide？ | 否，仅Product/ref/Plan/Price引用；真实Reader动态投影；G节 |
| 3 | official_sources明确不是实测？ | 是，显式日语label且无public testedAt/TestRecord；C06 |
| 4 | hands_on必须Test Record？ | 是，完整primary bound record必需；M03/M04/C19 |
| 5 | testedAt独立？ | 是，独立timezone timestamp，C20与publishedAt不等 |
| 6 | Product Draft影响公开Guide？ | 否，C21及R02/Web deep equal |
| 7 | Product Publish后needs_retest？ | 是，primary新Published与reference不同；C22 |
| 8 | steps/result不自动改写？ | 是，C23/R09–R10字节保持 |
| 9 | Draft screenshot匿名可访问？ | 否，C11/C30，admin401/public404；另一个已合法Published引用共享Asset除外 |
| 10 | Public screenshot sanitized？ | 是，bounded metadata-free WebP，C16与哈希检查 |
| 11 | 原始上传公开？ | 否，原binary未保存，原路径/哈希伪路由404；C17 |
| 12 | 未rights/privacy审核可Publish？ | 否，C09的privacy未审422及Domain/DB gates |
| 13 | Withdraw后截图继续公开？ | 本轮唯一公开Guide引用撤回后404；若其他eligible Published Guide引用同Asset，则继续可见是设计；C27/K节 |
| 14 | Restore复用二进制？ | 是，复制Asset关系/ID，不复制binary；C24/AR06–AR07 |
| 15 | Backup包含必要Asset？ | 是，真实tar entries+恢复Reader found+哈希；L节/P26 |
| 16 | private/unlisted让Guide所有出口消失？ | 是，whole-document依赖gate；C26/SEO/Public tests |
| 17 | 存在LLM生成教程？ | 否，手工明确synthetic fixture；Preview receipts/attempts=0 |
| 18 | 触碰Production DB？ | 否，只本轮loopback *_test/*_preview及拥有的临时恢复库；U节 |

## Gate / Stop
**Phase 7 = READY；Phase 8技术Gate = READY。** Editorial/Guide/Media/Public/Preview/Chrome/Regression全部有本轮证据；最终两个Important已RED→GREEN关闭，零Critical、零新增unexplained SKIP。
本轮不启用production collection、不建立真实Catalog、不开始Affiliate/Newsletter/Search/Account/Watchlist等Phase8+工作。

