# AIFIND Phase 8 — Launch Readiness + Real Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, with TDD and one fresh whole-change reviewer. Steps use checkbox syntax. User instructions override skill suggestions to commit, delete evidence, redesign or ask for another execution authorization.

**Goal:** Close the retention and semantic-dedupe engineering blockers, build a source-backed non-production launch corpus, and prove a clean migration/publication/backup/recovery rehearsal without deploying.

**Architecture:** Extend the existing AIFIND module, its Monitor/Observation/Candidate contracts and shared Product/Editorial readers. Source policy is an operator review record, not a legal opinion. A read-only launch preflight and deterministic file-only release bundle describe both engineering readiness and unresolved owner/operations blockers.

**Tech Stack:** Existing Node 24, PostgreSQL 17, Fastify, React Router SSR, pg-boss, Sharp and local pg client tools. No installation or new service.

**Spec:** User attachment, preserved in `.data/phase8-20261007-40ca55fd/user-spec.md`; `docs/AIFIND_MASTER_SPEC.md`; accepted Phase 7 report and baseline.

## Global Constraints

- Execute 8A → 8B → 8C → 8D in order; no real external Monitor before 8A closes, and no production Detector throughout Phase 8.
- Production DB connections/writes, deploy, DNS, Affiliate, Sponsored, Newsletter, accounts, Best, new model/search/CMS pipelines = 0.
- Preserve 1035 DB and 89 Web test names/status/reasons; eight Windows SKIP reasons stay identical. New feature behavior may supersede the explicitly identified Phase 4 duplicate characterization assertion, documented transparently.
- No reset/clean/checkout/restore/stage/commit/push; original 1031 existing files backed up, 78 migrations hashed; start at 0082 and never rewrite 0062–0081.
- `COLLECT_ENABLED`, `MODEL_CALLS_ENABLED`, `FEISHU_*_ENABLED`, `INDEXNOW_SUBMIT_ENABLED`, `AIFIND_DETECTOR_ENABLED` stay false in local normal runtime. Tests use only local test doubles, with external network disabled.
- Frontend only HTTP; public reads remain shared coherent Published Readers; no Draft/Observation/private metadata leakage.
- No fabricated facts, FX, ratings, users, hands-on, real-human approval, legal permission, operator identity or successful production deployment.
- Domain `unknown` retains its meaning. Price `unknown` is not `free`; `custom` is separate.
- Explicit staging import only, loopback `*_test/*_ci/*_preview`, production Catalog guard unchanged.
- Source research uses normally accessible primary official sources, short necessary quotes/hash/retrieval times. Access denial stays unknown; no bypass/Jina fallback to circumvent restrictions.
- Staging publication actions are documented operator simulations; `owner_approved` requires actual user evidence. Missing owner approval means Content Gate NOT READY.
- No production policy approval inferred from automatic source validation. Missing identity/policy decisions are preflight BLOCK, not fabricated placeholders disguised as final copy.
- Preserve Phase 0–7 Preview Hub; Phase 8 admin Preview requires authentication, noindex and private/no-store. Keep all test logs and backups as evidence.

## Review Focus

1. A queued Monitor or URL edit must not bypass revoked policy; enforce at DB, Domain and worker fetch boundary, including direct SQL and changed URL tests.
2. A prune while detection is in progress must not destroy input or audit; serialize on Observation and allow only terminal processing or expired short retention, preserving bounded immutable contexts before prune.
3. Unicode quote locators, legacy evidence and pruned replays must retain correct code-point context and hashes; never validate old quotes against empty text.
4. Dedupe after approval/rejection or concurrent different hashes must preserve all evidence, keep base-version boundaries and not resurrect rejected status; applied is deliberately outside active suppression.
5. Bundle/preflight must reject disguised synthetic/secret/path data, detect missing assets, and never label owner review or infrastructure rehearsal as real production approval.

---

### Task 1: 8A — Source Policy and Observation Retention

**Files:** Create `modules/aifind/migrations/0082_aifind_source_retention.sql`, `detector/source-policy.ts`, `detector/retention.ts`, `tests/launch-retention.test.ts`. Modify `detector/contracts.ts`, `monitors.ts`, `observations.ts`, `jobs.ts`, `fetch.ts`, `routes.ts`, `catalog/evidence.ts`, `changes/candidates.ts`, `admin/contracts.ts`, `web/monitors.tsx`, `web/review-detail.tsx`, `server.ts`, local fake fixtures and migration registration tests. Append deployment notes.

**Interfaces:**
- `reviewSourcePolicy(id: string, input: unknown, actor: string): Promise<Monitor>` validates revision and audited status/retention/fetch flags.
- `assertMonitorPolicy(m: Monitor): void` requires approved+automated-fetch allowed before any real queued/manual fetch; Jina additionally requires Jina policy permission.
- `pruneObservations(now: Date): Promise<Record<string, unknown>>` registers as `ServerModule.retention`, no scheduler.
- `CandidateDetail` gains private bounded evidence context; original Evidence and proposal fields unchanged.

- [ ] Write RET01–RET12 against real DB: unreviewed/blocked enable rejected, approved allowed, evidence_only processed text pruned, short_excerpt deadline before/after, original full contentHash preserved, quote/context/locator preserved, Candidate review readable, Published facts deep-equal, retry idempotent, arbitrary UPDATE/DELETE denied.
- [ ] Add direct SQL enable/prune guard, URL edit revocation, in-progress prune refusal, Unicode and legacy upgrade tests. Example: `assert.equal(pruned.text, ''); assert.equal(pruned.contentHash, originalHash); assert.equal(detail.detectorEvidence.quote, quote)`.
- [ ] Run targeted tests; Expected RED on absent policy/retention behavior, not external requests.
- [ ] Implement policy fields using existing SOURCE_KINDS; unreviewed/approved/blocked, reviewedAt/by/reason, evidence_only/short_excerpt, 30-day engineering default configurable per source (1–365).
- [ ] Apply approval gate to all enabled Monitors, including non-production, so DB cannot bypass it via environment. Preserve local fake tests with explicitly audited fixture-only policy actions.
- [ ] Append migration: safely pause legacy unreviewed Monitors, snapshot retention metadata/deadline/prunedAt, permit only one-way verified prune. Backfill and protect immutable necessary quote/context records; do not alter evidence quote, candidate proposal, full hash, original retrieval/fetch metadata or Published.
- [ ] New evidence context stores quote+bounded 160-code-point before/after+original locator+input/full hashes. `evidence_only` prunes completed/unchanged/failed/stale processing; unfinished input remains until processing completes, with age visible. `short_excerpt` expires at retrievedAt+configured days, but unfinished processing is reported instead of destroyed.
- [ ] Existing dailyRetention hook calls AIFIND prune. Retried prune updates no already-pruned rows. DB-only forward mutation never reopens ordinary input editing or Evidence/history deletion.
- [ ] Run Task 1 tests and affected existing tests; Expected PASS. Ledger actual commands and migration SHA preservation.

### Task 2: 8B — Semantic Candidate Dedupe and Supporting Evidence

**Files:** Create `modules/aifind/migrations/0083_aifind_candidate_semantics.sql`, `changes/semantics.ts`, `tests/launch-semantic.test.ts`. Modify `detector/detect.ts`, Candidate read/contracts and Review Detail. Retain old `proposalKey` function and 0075 unchanged.

**Interfaces:**
- `semanticKey(input: {productId; baseVersionId; candidateType; targetKey; targetRef; proposedValue}): string`, SHA-256 of stable normalized semantic value excluding evidence/verification provenance.
- `linkCandidateEvidence(db: Tx, candidateId: string, evidenceId: string): Promise<void>` immutable idempotent supporting relation.
- Review Detail returns primary and supporting Evidence with independent Observation URLs/retrievedAt/contentHash/context.

- [ ] Write SD01–SD12 real DB tests: different hashes same semantic produce one pending Candidate; both Observations/Evidence survive; Review displays both; changed value/target/base create distinct Candidate; rejected history remains rejected; parallel workers produce one active item; retry links once; Draft/Published deep-equal.
- [ ] Add approved suppression and applied non-suppression test; no automatic confidence/approval promotion.
- [ ] Run RED tests before implementing.
- [ ] Append nullable independent semanticKey for new detector Candidates, plus immutable Candidate→Evidence relation and unique active index. Legacy duplicate history stays immutable; suppression can find legacy rows via normalized semantic values without rewriting their proposal identity.
- [ ] Under existing Product lock, create new immutable Evidence first, then reuse matching detected/pending_review/approved Candidate. Exact proposal retry remains old contract. Rejected/applied histories are not changed; new evidence can create a new pending item, explicitly shown/tested.
- [ ] Surface primary/supporting context in existing protected Review Detail; no public endpoint.
- [ ] Update the old named characterization test to the now-required one-Candidate/two-Evidence assertion, documenting its intentionally superseded behavior; preserve its name/status in baseline comparison.
- [ ] Run Task 2 and Detector/Review regressions; Expected PASS.

### Task 3: 8C — Source-backed Real Launch Corpus

**Files:** Create `modules/aifind/launch/contracts.ts`, `corpus.ts`, `staging.ts`, `tests/launch-content.test.ts`, `scripts/stage-aifind-launch.ts`, plus file-only dossier/catalog/editorial/review manifests under this phase's ignored evidence directory.

**Interfaces:**
- `validateLaunchCorpus(input: unknown): LaunchCorpus` consumes existing CatalogPackSchema, official source dossier and strict editorial schemas.
- `stageLaunchCorpus(input: unknown, actor: string): Promise<LaunchStagingResult>` delegates guarded Draft-only Product Catalog import and Editorial creation; no hidden production bypass.
- Explicit separate `rehearseLaunchPublication` uses existing review/publish/visibility actions with documented machine operator simulation; never changes owner review status.

- [ ] After 8A/8B PASS, research 12 actual products covering writing/research/coding/image/video/audio/productivity/agents, using official product/pricing/docs and Japanese source if accessible.
- [ ] Record accessible source URL/title/kind, minimal quote, fetched/examined representation SHA, retrievedAt and limitations; unavailable/denied evidence never becomes asserted pricing/language/JP availability.
- [ ] Prepare 12–20-item `source_material` Catalog pack and per-product review manifest: facts, unknowns, verifiedAt semantics, sources, questions and `owner_review_required`. No synthetic markers or owner-approved claims.
- [ ] Prepare 2 Comparison, 2 Category, 2 Guide Drafts using only these Products, all official_sources, no TestRecord or fake hands_on. Preserve dynamic fact/reference separation.
- [ ] Write LC01–LC12: >=12 real candidates, no markers, safe official URLs, Domain schemas, every definite fact Evidence, unknown stays unknown, no FX/rating/users invention, exact editorial minima and no hands_on records. Run RED before corpus validator/import code.
- [ ] Create a brand-new loopback launch staging DB, migrate, import Product Drafts only, verify no startup seed and production guard rejection; publication is a separate explicit simulation stage.
- [ ] Run content and isolation tests; Expected PASS. Human factual review remains a separate blocker unless user actually approves the concrete dossiers.

### Task 4: 8D — Read-only Preflight, Deterministic Bundle and Admin Preview

**Files:** Create `launch/preflight.ts`, `bundle.ts`, `routes.ts`, `tests/launch-preflight.test.ts`, `tests/launch-bundle.test.ts`, `web/launch-preview.tsx`, `scripts/aifind-launch-preflight.ts`, `scripts/build-aifind-launch-bundle.ts`, `site/pages/editorial-policy.md`, and public policy module route. Modify Preview Hub/module/server/web route registration and append deploy/handoff documentation.

**Interfaces:**
- `readLaunchPreflight(options): Promise<LaunchPreflight>` is read-only; outputs PASS/WARN/BLOCK per named Runtime/Safety/Content/Evidence/Assets/Sources/Operations check and four independent Gates.
- `buildLaunchBundle(input, directory): Promise<ReleaseManifest>` writes deterministic whitelisted JSON files with SHA-256 and exclusive creation; never copies .env or credentials.
- `/admin/aifind/preview/launch-readiness` → authenticated Site/Admin HTTP reads; noindex/no-store. Real corpus counts/review, retention/source policy, semantic evidence, manifest hashes, recovery/observability and Phase9 blockers.

- [ ] Write LP01–LP10 and RB01–RB10 before implementation: synthetic/SITE_URL/operator/evidence/asset/source-policy blockers; retest/failed backup/unknown receipt visible; clean staging engineering PASS; deterministic bytes/hash, no secrets, complete migrations, references and policy manifest, missing assets and synthetic refused.
- [ ] Add read-only before/after DB equality, recursive marker scan, malicious bundle path/secret rejection and intentional disabled-external flags tests.
- [ ] Implement preflight with actual current Published Reader eligibility, unknowns/freshness/lastVerified, owner manifests and official URL research receipts; no network requests during preflight GET.
- [ ] Reuse Admin Runs/Settings for heartbeat/failures/unknown receipts/budget/backup. Count pending Candidate age/source failures/orphan asset/file counts; do not delete assets.
- [ ] Add truthful user-facing Editorial Policy: facts vs judgments, official vs actual tests, unknowns, verification dates/retest, no current affiliate links, corrections. Retain missing operator/terms/privacy approvals as explicit BLOCK; don't invent legal decisions.
- [ ] Produce manifest+Product pack+editorial manifest+asset manifest+migrations+source policies+preflight+baseline hashes. Fixed corpus identity/time and stable ordering ensure repeated build byte-identical; whole-bundle index excludes its own hash and hashes every payload.
- [ ] Admin/API/Web tests prove authentication, noindex/no-store, sitemap exclusion and real preflight data; no new public business API.
- [ ] Run Task 4 tests; Expected PASS.

### Task 5: Full Rehearsal, Review, Regression and Phase 9 Handoff

**Files:** Phase-owned evidence scripts/logs/screenshots/DBs and `docs/superpowers/plans/2026-10-07-aifind-phase8-launch-readiness-real-content-report.md`. Extend existing local launcher only if necessary, never existing Preview DB seed.

- [ ] Create fresh staging DB → all migrations → validated real launch pack Draft import → explicitly documented operator publication simulation → public smoke. Preview DB must not reuse earlier synthetic datasets.
- [ ] Use a no-external local worker to prove real heartbeat/queue/alerts state, with all paid/external safety valves false. Never fake a healthy production heartbeat.
- [ ] Real installed visible Chrome L01–L25, desktop/mobile; capture eight required screenshots from actual real launch corpus. Source-policy/supporting-evidence checks use local deterministic observations clearly labeled as rehearsal, excluded from launch bundle.
- [ ] Real pg_dump + uploads tar → separate empty safe DB + separate data directory recovery → public Product/Compare/Category/Guide/Evidence/slug/assets smoke. Include one self-created, explicitly reviewed instructional diagram so media restore/missing-file fail-closed is genuinely exercised without false product screenshot claims.
- [ ] Negative DB-only restore proves asset-bearing Guide not public-ready. Retest visibility uses isolated rehearsal revision/history and restores the accepted candidate state; no secret/fake facts enter bundle.
- [ ] Run typecheck, complete safe DB suite, Web build/tests, Site/Launch/Backup smoke; compare original 1035/89 names/status/reasons exactly; no timeout/skip/assertion weakening to hide failures.
- [ ] One fresh read-only whole-change review; regrade by real user effect, one TDD fix pass for Important/Critical, preserve logs. No repeated implementer/reviewer agents.
- [ ] Freeze candidate bundle, accepted test hashes, migration list and rollback steps. Rollback uses paired pre-migration backup+uploads in another safe DB; never rewrites or downgrades migrations in place.
- [ ] Final Git audit vs all 1031 before-files/78 migrations/index/env/HEAD; publish Preview URL/screenshots/report A–U, all 18 answers and exact gate/blocker matrix. No stage/commit/push or production actions.
- [ ] STOP. No Phase 9 authorization inferred from Phase 8.

## Plan self-review

User sections 0–84 map to Tasks1–5: 6–18→1; 19–28→2; 29–46/67→3; 47–52/55–57/65–70/81→4; 53–54/58–64/71–80/82–84→5. Interfaces share the existing Monitor, CandidateDetail, CatalogPackSchema and Published Readers, never duplicate them. Gate labels separate engineering, factual review, operations and never-executed production launch.

Native inline execution follows the user's explicit “写完再实现” instruction. Missing identity/factual approvals affect final gates rather than stopping authorized non-production work.
