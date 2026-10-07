# AIFIND Phase 7 How-to / Guide + Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans in this session; tasks follow RED → GREEN → verification. One fresh-context final review.
**Goal:** Add a human-edited task Guide with Product version references, honest test modes and rights/privacy-reviewed image evidence, using the existing Editorial Core.
**Architecture:** Extend comparison/category/guide in the existing Document/Revision system. Read Guide and Asset visibility through the existing AIFIND Published snapshot composition; React Router accesses HTTP only.
**Tech Stack:** Existing Node 24, TypeScript, Zod, Fastify, PostgreSQL 17, React Router SSR and installed Sharp. No installation/upgrade.
**Spec:** The user's full 106-section Phase 7 request, preserved at `.data/phase7-20261006-c3913c41/user-spec.md`; `docs/AIFIND_MASTER_SPEC.md` §5.4 and current Phase 5/6 reports.

## Global constraints

- Preserve dirty files, missing SC fonts, index and .env. Baseline has 1005 existing files and 76 migrations. No reset/clean/checkout/restore/stage/commit/push.
- Highest observed migration is 0079. Append 0080 and later only; do not rewrite published migrations.
- No production DB, catalog import, monitor, external collection, paid model, Feishu, IndexNow or Codex CLI launch.
- COLLECT_ENABLED=false, MODEL_CALLS_ENABLED=false, FEISHU_*_ENABLED=false, INDEXNOW_SUBMIT_ENABLED=false, AIFIND_DETECTOR_ENABLED=false.
- No new CMS/Document engine, no HowTo structured-data claims, fake ratings, FX, remote image embedding, MDX, SVG/video/audio uploads.
- Local Preview uses explicitly seeded, own loopback *_preview DB; all Guide fixtures remain Draft until separate browser human Publish.
- Preserve all 956 DB and 75 Web test names/status/reasons. Preserve 8 original Windows skip reasons verbatim.
- Date of this plan/report is actual Asia/Shanghai date when saved. Stop after Phase 7; Phase 8 is not authorized.

## Design decisions from actual source review

| Area | Decision |
|---|---|
| Editorial reuse | Reuse create/save/draft/preview/publish/withdraw/restore, document row lock, expectedRevision and audit. Only add the guide union branch and typed relations. |
| Guide fields | mode, task, taskResultMd, prerequisitesMd, materialsMd, stepsMd, resultMd, failuresMd, limitationsMd, costNotesMd, alternativesMd; common title/excerpt/SEO remain Revision. |
| Products | 1–3 distinct Products, exactly 1 primary; alternatives/prerequisites optional. Persist Product ID + historical Published reference ID, optional referenced Plan/Price IDs. No fact/price copying. |
| Test records | Small guide-specific records (option B); reuse existing TestRecordSchema and Markdown safety. A primary hands_on relation requires a record explicitly bound to the same Product/version/Plan; optional other records get identical binding. Avoid altering existing Comparison records. |
| Reference/current | Batch read current listed/public-ready Products and historical Published reference projections in the same read-only snapshot. Show current facts separately from historical version and reference Plan prices. |
| Retest | On read, primary current Published != saved reference sets needsRetest; no step/result rewrite. Draft/Candidate/Apply changes do not count. New human-published revision with new reference/record can clear it. |
| Assets | Assets have immutable binary identity and reviewed metadata; typed Revision relations contain role/position/captionJa/altJa. Upload creates a private Asset; saved Draft attachment is audited; reordering/caption changes only on Draft. |
| Validation | Reuse existing feedback bounds: 5 MiB upload cap, 60M decoded-pixel cap; sniff PNG/JPEG/WebP, strict Sharp decode, reject corrupt/animated/extension-MIME mismatch/unsafe names; auto-orient and bounded 2400px dimensions; metadata-free WebP output. |
| Original | Do not retain original binary. Preserve original SHA-256, processed SHA-256 and original MIME internally for provenance. This avoids backing up raw personal metadata; full original recovery is unavailable and explicitly documented. |
| Storage | Deterministic processed SHA under config.dataDir/uploads/aifind-editorial; existing runBackup tar recursively includes uploads. No generic backup redesign unless actual test shows missing coverage. |
| Rights/privacy | Default unreviewed. Separate authenticated CSRF review action records rightsBasis/reviewer/date and explicit privacy reviewer/date with audit. Gate publish AND public readiness. Internal review notes/storage/uploader never enter public DTO. |
| Public assets | Asset ID → DB → controlled digest key → persistent root. Public only when at least one complete eligible Published Guide references it; no-store; missing file/clearance withdraws Guide from all exits. Admin Draft rendition is authenticated. |
| Restore/retention | Copy immutable Asset references with new Revision, never binary; no deletion of assets used by any historical revision. Orphan row/file GC is explicit later backlog. |
| Admin | Reuse list/detail/reason dialog/history; add Guide-specific editor and asset fields instead of cloning the entire CMS. Product/version/Plan changes clear affected Test Record. |
| Public/SEO | /howto and /howto/:slug with HTTP SSR; title/excerpt/task, ordered sections, figures, evidence, related Products/Compare/Category, current/reference facts, test dates; SITE_URL canonical and controlled OG; existing Editorial sitemap + permanent direct 301 history. |
| Navigation/home | Add 使い方; preserve previous navigation; small AIを使う section only when eligible guides exist. Product reciprocal links include eligible Guides. |
| Preview | Hub Available and /admin/aifind/preview/howto-guide; official, synthetic hands_on, retest, Draft-only and withdraw scenarios P01–P26; local own ports 3800/3801, no worker/startup seed. |
| Browser | Visible installed Chrome in isolated project profile; localhost-only request guard; C01–C30, 1366×900 and 390×844, actual keyboard/focus/overflow checks, six required screenshots. |

## Review focus

1. Uploaded file is MIME-spoofed, oversized, corrupt or rotated/metadata-bearing: reject unsafe input; expose only bounded sanitized bytes.
2. Asset file goes missing or Product/rights eligibility changes after publish: detail, directory, related/home, sitemap, old slug, OG and asset endpoint all cease publication.
3. Concurrent Save/upload/review or stale editor: preserve saved Revision and Published bytes; 409 on stale document write; immutable historical relations.
4. Product/version/Plan switches: old Test Record must not move to a new reference implicitly in UI or Domain.
5. Backup contains DB without assets: never claim complete recovery; actually restore owned test DB plus sanitized directory and verify Guide/image.

## Task 1 — Guide Domain and DB integrity

**Files:** new modules/aifind/editorial/guide.ts and migration 0080_aifind_guides_assets.sql; extend editorial/contracts.ts, documents.ts, read.ts, validation.ts.
**Consumes:** existing adminTransaction, TestRecordSchema, Product refs and immutable Revision guards.
**Produces:** GuideContent branch, typed guide relation/test records, write/read Guide helpers and server-side publish issues.
- [x] Write guide-fixtures.ts and guide-domain.test.ts covering G01–G10, H01–H13, M01–M08; test actual shared Domain/SQL, with comparisons/categories still working.
- [x] Run guarded isolated node --test before implementation; record RED for missing guide type/table/behavior.
- [x] Add guide CHECK with forward migration, typed relations, ownership/Plan reference checks, immutable records and DB publish core gates.
- [x] Add Guide union/shared Test Record schema and read/write/validate branch, preserving previous behavior.
- [x] Run focused tests → GREEN. Keep source diff, no commit.

## Task 2 — Persistent sanitized Assets and revision relations

**Files:** new editorial/assets.ts and editorial/asset-routes.ts; migration from Task 1; new guide-assets.test.ts and guide-backup.test.ts.
**Consumes:** config.dataDir, Sharp, shared authenticated Admin handler, Draft Revision lock and backup.runBackup.
**Produces:** uploadGuideAsset(input, actor), reviewGuideAsset(id,input,actor), asset availability/read helpers, protected Admin/public rendition routes.
- [x] Tests first: A01–A20, AR01–AR08, B01–B05, zero byte and unsafe filename; metadata/rotation decode, dedup, digest, dimensions, review gate, Draft/withdraw/private isolation, backup+recovery.
- [x] Run RED and record actual failures.
- [x] Persist validated rendition before DB row, immutable key and original hash; cleanup newly unreferenced failed output best-effort without deleting an existing dedup file.
- [x] Add controlled asset review and authenticated read routes, audit create/review and Revision attach/detach; default review is not automatically passed.
- [x] Run focused tests → GREEN with local-only backup fixtures; no production upload.

## Task 3 — Published Guide Reader, Site API and dependency removal

**Files:** editorial/public-contracts.ts, publication/editorial.ts, public/editorial-routes.ts, publication/public-products.ts, module.ts, server.ts; new publication/guide.ts as needed.
**Consumes:** Guide structured content, Product batch Reader, Asset validation and Published snapshot.
**Produces:** PublicGuide union and strict Asset DTO; same list/resolve/sitemap/related functions support guide; /api/site/aifind/howto[/:slug], /api/site/aifind/assets/:id.
- [x] Write guide-publication.test.ts: R01–R11, public DTO exclusion, all Product and Asset invalidation exits, source/hands labels/data, slug and SEO01–SEO10.
- [x] Run RED. Include real current/reference price semantics with literal free/fixed/custom/unknown and original currency.
- [x] Batch current + historical facts; never expose draft IDs/storage/review notes; project needsRetest and unchanged editorial steps/results.
- [x] Extend current sitemap and safe OG; whole Guide fail-closed before redirect/related and asset access.
- [x] Run focused suite → GREEN; measure actual query count and warm latency later.

## Task 4 — Reused Admin, public SSR and synthetic Preview

**Files:** existing web/editorial-editor.tsx, detail/list/view/public-*; new web/guide-editor.tsx, guide-view.tsx, guide-preview.tsx; preview/guide-seed.ts and guide-service.ts; preview/routes.ts; web.tsx/admin-common.tsx/home-products.tsx/public-product.tsx; scripts/seed-aifind-guide-preview.ts; scripts/serve-aifind-preview.ts.
**Consumes:** real Admin/Site API only, shared HTTP actions/reason dialogs and rendered safe Markdown.
**Produces:** Guide editing/upload/review/attachment/reorder, saved authenticated Preview, indexed Published SSR, P01–P26 fixtures and links.
- [x] Write Admin auth/CSRF HTTP and built Web tests before adding endpoints/UI; record RED.
- [x] Add natural Guide type/path selectors; component reuse retains Comparison/Category editor state behavior.
- [x] Add controlled upload (no image-generation tooling), reviewed thumbnails/rights/privacy fields, typed relation editor, Product/version/Plan change-clearing.
- [x] Build /howto SSR with the requested ordered sections, figure alt/caption, bounded pictures and local table/code overflow; ordinary WebPage/BreadcrumbList only.
- [x] Extend explicit Preview seed with obvious synthetic Guide/image and no automatic publish or startup seed. Default/production seed must reject.
- [x] Run HTTP/Web and build → GREEN.

## Task 5 — Regression, real Chrome and phase closure

**Files:** evidence under this phase's .data directory; actual-date report in docs/superpowers/plans.
**Consumes:** completed code and Phase 6 final2 baseline.
**Produces:** fresh exact baseline, C01–C30, P01–P26 evidence, six screenshots, report A–V and Phase 7/8 Gate.
- [x] Run npm run typecheck, full safe npm test, Web build/tests, site30 smoke and Guide smoke, exact names/status/reasons comparison.
- [x] Explicitly seed a new own *_preview DB; serve loopback 3800/3801 with no worker/no external credentials.
- [x] Perform all actual C01–C30 human workflow steps in installed visible Chrome; keep intermediate failures and final results separately.
- [x] Capture/read six screenshots; verify Japanese text, mode, facts/references, test timestamps, pictures, focus and 390px overflow.
- [x] Real local backup/restore acceptance and measured queries/latency; zero model receipt/attempt deltas.
- [x] One fresh final reviewer using the approved skill; fix direct Critical/Important findings with RED→GREEN then relevant full verification.
- [x] Compare all initial files/index/env/76 migration hashes; report only Phase 7 changes; all unchanged historical work remains.
- [x] Save actual-date A–V report with exact 18-question answers, limitations and production retention blocker; READY only when all required gates have evidence; stop before Phase 8.

## Execution authorization and self-review

The user supplied a detailed implementation specification and explicitly directed plan-first then implementation in this task. This plan records native execution in the existing feature branch without another authorization round. Architecture alternatives are settled narrowly: B guide-specific records reuse existing validation; original hash only; structured image gallery avoids new Markdown syntax. The five review focus items are assigned to real tests above. Preview publishing is confined to explicit synthetic own local data.

Baseline evidence: `.data/phase7-20261006-c3913c41/git-before.json`. Phase 6 exact test baseline: `.data/phase6-20261006-281ca693/phase6-final2-baseline.json`.

Completed 2026-10-07: all5 tasks evidenced in .data/phase7-20261006-c3913c41/progress.md and the Phase7 report. Actual Guide/Asset migrations are0080_aifind_guides.sql and0081_aifind_editorial_assets.sql; Guide read/write helper is editorial/guides.ts. No commits or Phase8 work.
