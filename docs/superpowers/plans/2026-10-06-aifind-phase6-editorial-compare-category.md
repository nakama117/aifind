# AIFIND Phase 6 — Editorial Core + Compare / Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver human-published comparisons and curated use-case pages over the existing Product facts, with isolated Drafts, genuine Preview and browser evidence.

**Architecture:** Add the minimal Editorial domain inside the existing AIFIND module. Revisions store prose and typed Product/version relations, never Product facts. Public projection composes the selected Published editorial revision and a batched current Product projection in one read-only Repeatable Read snapshot; admin writes use Read Committed, optimistic document revision and audit.

**Tech Stack:** Existing Node 24.14, TypeScript, PostgreSQL 17, Fastify, React Router SSR, strict Zod, existing safe Markdown renderer. No dependency installation.

**Spec:** User's complete Phase 6 request, preserved verbatim in `.data/phase6-20261006-281ca693/user-spec.md`; `docs/AIFIND_MASTER_SPEC.md`. This Phase's narrower request overrides the Master Spec's deferred Guide/Best/asset/commercial proposals.

## Global constraints

- Preserve all Phase 0–5 work. Before snapshot: 973 paths / 970 existing files / 73 historical migrations. HEAD and index remain untouched; `.env` and SC font deletions remain untouched.
- Only `comparison` and `category`. No Product schema/Detector/Discovery rewrite, ranking, winner, scores, Best, Guide CMS, affiliate, newsletter or Phase 7.
- New forward migration `0077_aifind_editorial.sql`; historical migrations remain byte-identical.
- Real PostgreSQL → Domain → Site API → SSR. Web never imports DB/backend services.
- Parent/test/Preview external safety valves false; test setup may use only localhost fake services under its existing network guard.
- Explicit disposable local seed only, `_test` / `_ci` / `_preview`, nonproduction, `AIFIND_PREVIEW_ENABLED=true`; no seed on startup/GET, no Production product additions.
- Public required Products all current listed + Published + public-ready. Any ineligible dependency hides the whole editorial document from all public exits immediately, including old-slug redirects and OG.
- Compare 2–3 distinct Products, Category 3–5. Category position is display order, never rank.
- Current facts and saved reference/test versions/date remain visibly distinct. Computed `needs_retest` never rewrites human prose or auto-withdraws a version change alone.
- Preview/admin authenticated, CSRF mutations, noindex/nofollow, private/no-store. No new public API v1, RSS or MCP editorial ability.
- Explicitly stop after Phase 6 report and gates.

## Review focus

1. Multiple slug renames, concurrent claims, restore and withdrawal must not redirect to Drafts or release old published claims.
2. Product visibility/version changes during editorial reads and publication must yield one consistent snapshot and whole-document eligibility.
3. Reference version, tested plan/price ownership and immutable Test Record ownership must reject cross-Product or Draft references.
4. Untrusted Markdown, protocol tricks, raw HTML and admin-only fields must not become executable/public metadata.
5. Mobile 3-Product tables and long synthetic names must scroll inside a keyboard-accessible region without page overflow or unreadable columns.

## File map

New domain: `editorial/contracts.ts`, `editorial/read.ts`, `editorial/documents.ts`, `editorial/validation.ts`, `migrations/0077_aifind_editorial.sql`.
New projections: `publication/editorial.ts`, `editorial/public-contracts.ts`, `editorial/routes.ts`.
New UI: `web/editorial-list.tsx`, `web/editorial-detail.tsx`, `web/editorial-editor.tsx`, `web/editorial-view.tsx`, `web/compare.tsx`, `web/compare-detail.tsx`, `web/categories.tsx`, `web/category-detail.tsx`, `web/compare-category-preview.tsx`.
New fixture: `preview/editorial-seed.ts`, `preview/editorial-service.ts`, `scripts/seed-aifind-editorial-preview.ts`, `tests/editorial-fixtures.ts`, `tests/editorial*.test.ts`, Web SSR test/fixture.
Existing adapters: `module.ts`, `server.ts`, `web.tsx`, `publication/public-products.ts`, `public-contracts.ts`, `public/routes.ts`, `preview/routes.ts`, `web/admin-common.tsx`, `web/public-product.tsx`, `web/home-products.tsx`, `scripts/serve-aifind-preview.ts`, exact migration/route expectation tests. Generic framework changes only if an actual extension gap is proven.

## Task 1: Editorial storage and human revision lifecycle

**Interfaces:** `createEditorial(input, actor)`, `saveEditorialDraft(id,input,actor)`, `createEditorialDraft(id,input,actor)`, `publishEditorial(id,input,actor)`, `withdrawEditorial(id,input,actor)`, `restoreEditorial(id,input,actor)` return `EditorialAdminDetail`. `readEditorialAdmin(id)` and `listEditorialAdmin(type)` read only. All after-create actions require `expectedRevision` + reason.

- [x] Write `editorial.test.ts` for E01–E10, SL01–SL06, Compare C01–C18, CAT01–CAT12, using existing real Product fixtures. Explicit assertions: stale revision Conflict, untouched Published revision after save/restore, immutable historical body/relations/Test Records, rejected cardinality/duplicates/ineligible Products/ref ownership, persistent slug claims, zero fake fact fields.
- [x] Run safely isolated targeted tests via the project's database global-setup/import; RED expected because Editorial tables/API are absent, not because fixture service/network is broken.
- [x] Implement 8 module-owned tables: documents, revisions, slug claims, comparison revisions/products, per-Product comparison Test Records, category revisions/products. Typed columns and FK/UNIQUE/CHECK/immutable guards; no catch-all Product facts JSON.
- [x] Implement Draft writes, Publish gates, Restore as a new Draft revision, Withdraw and auditing. Publish locks required Product parents in stable ID order and document; claim old/current slugs atomically. `hands_on` requires a complete human Test Record for every compared Product; synthetic records marked separately in Preview.
- [x] Run targeted suite GREEN. Expected no fails/cancelled/skips. Record RED/GREEN logs and own before-relative snapshot; no Git stage/commit.

## Task 2: Coherent public projection and dynamic facts

**Consumes:** Task 1 stored relations and revision state. **Produces:** `readEditorialSnapshot(db,...)`, `resolvePublicEditorial(type,slug)`, `listPublicEditorial(type)`, `relatedPublicEditorial(db,productId)` and sitemap entries; strict public DTO never contains Draft/admin/audit/internal provenance.

- [x] Write `editorial-publication.test.ts` for R01–R09 and cross-exit isolation: Candidate/Applied Draft don't change facts; Product Publish V2 changes table, saved V1 refs and old verdict remain; private/unlisted Product hides complete document; withdrawal excludes all exits; rename resolution directly current Published slug.
- [x] Run RED for missing projection; implement exported existing Product projection helper and batched current-public Products helper inside the existing publication layer. No per-Product HTTP/query loop.
- [x] Compose public prose, reference metadata, current PublicProduct facts and computed mismatch/retest. Category keeps recommendations and may show a neutral information-update notice.
- [x] Include Product-related comparisons/categories from the same snapshot; keep empty old Product DTO behavior compatible. Directory returns bounded real eligible summaries; no fabricated combinations.
- [x] Run GREEN and measure read query count/EXPLAIN/latency on synthetic data. No cache, new search service or performance claim beyond measured scale.

## Task 3: Admin routes and usable typed editorial forms

**Consumes:** Task 1 commands/detail DTO; Task 2 admin-preview projection over saved Draft and current Published Products. **Produces:** authenticated `/api/admin/aifind/editorial/*`, Compare/Category admin UI.

- [x] Write real injected-HTTP tests E11/E12, malformed 400/not-found404/stale409/publish422 and auth/CSRF/no-store/noindex for every action; genuine saved Draft Preview.
- [x] Run RED; register through existing module/admin handler. Supply bounded Product/version selector using real Product Domain; no anonymous Draft endpoints.
- [x] Implement `/admin/aifind/compare` and `/categories` type-specific list/create, detail/edit/reorder/records/Preview/human Publish/Withdraw/Restore. Product/version relation editor and human prose fields, not one JSON textarea. Clear Published/Draft revision markers and action reason dialogs.
- [x] Run route/domain tests GREEN. Preserve all old admin routes and tests.

## Task 4: SSR Compare, curated Category, navigation and SEO

**Consumes:** public DTOs via HTTP only. **Produces:** `/compare`, `/compare/:slug`, `/categories`, `/categories/:slug`, editorial OG and `/sitemap-aifind-editorial.xml`.

- [x] Write built SSR tests SEO01–SEO10, semantic HTML/current-vs-reference labels, conditional conclusions, safe Markdown/script/protocol denial, price/unknown labels, internal links and no Draft/TestDraft/admin secrets. Run RED.
- [x] Implement SSR fact table using current Product projection, labelled horizontal scroll region and header scopes. Reuse existing Status/price/currency/VerifiedDate components; do not call unknown free or convert currencies.
- [x] Implement Category independent question/criteria/fit/exclusions and related Product links with unranked order. `/categories` is the natural `用途から探す` browse entry, so a directory is justified. Explicit comparison relations only if needed; minimum bidirectional Product relations always delivered.
- [x] Register navigation `AIを比べる`, `用途から探す`; preserve News and Discovery. Add minimal real eligible editorial links to existing home part; empty collections hide the section.
- [x] Use SITE_URL self canonical, direct301 oldslug, existing controlled OG renderer; fresh independent sitemap in existing sitemap index. No Review/AggregateRating schema or arbitrary images. Run GREEN/build.

## Task 5: True Preview, browser P01–P24/C01–C25 and closure

**Consumes:** all prior tasks, Phase 5 synthetic seed. **Produces:** Phase 6 Available hub + `/admin/aifind/preview/compare-category`, new local3700/3701 runtime and screenshots/report.

- [x] Write Preview flag/production/default/no-auto-seed tests and real API fixture checks, run RED.
- [x] Add explicit seed reusing `seedDiscoveryPreview` on a new owned disposable DB. Seed Draft-only comparison, separate hands-on synthetic record example and curated Category; normal startup never seeds or publishes. Browser must perform actual human Publish actions.
- [x] Provide P01–P24 real links/markers/actions. Any demo mutation only fixed registered synthetic entities + auth/CSRF/expected revision/reason + existing Preview write guard. Production impossible.
- [x] Register new runtime branch, keep old runtimes/DB untouched; external valves false/no worker/seedOnStartup=false. Reuse installed visible Chrome and existing browser driver (no installation); reject nonloopback browser requests.
- [x] Perform C01–C25 in installed visible Chrome, capturing real human Publish/edit/withdraw/retest/301/no-leak, desktop/mobile screenshots. Inspect image pixels, Japanese labels/price semantics, keyboard scroll and page layout. Save exact browser matrix/results.
- [x] One fresh whole-scope reviewer, then one TDD correction pass for Critical/Important findings; defer and document minors. Fresh full verification after last source change.
- [x] Run typecheck; `DATABASE_URL=..._test npm test`; Web build/tests; real local smoke. Compare ALL 901 DB /64 Web name+status+skip reasons to Phase 5, no missing/changed old names.
- [x] Save new complete baseline, diff/hash/Git safety, report A–R. Explicitly retain carryovers: semantic dedupe pending; **Production external collection MUST NOT be enabled until retention/rights policy explicitly decided**. Production real products added=0.
- [x] Phase 6 / Phase 7 gates READY or NOT READY based on evidence; stop without starting Phase 7.

## Execution adaptation

User supplied a complete detailed implementation/acceptance specification and explicitly requests execution without revisiting the accepted route. Implement inline under executing-plans, no repeated design/plan permission handoff. Current dirty `codex/ai-signal-jp` tree contains all accepted work, so use full dirty-before backup/diff instead of a HEAD-only worktree; no commits/index mutations. Preserve ignored evidence instead of deleting it. One fresh final reviewer is the sole agent dispatch required by the skill. All decisions and RED/GREEN evidence go in `.data/phase6-20261006-281ca693/progress.md`.

