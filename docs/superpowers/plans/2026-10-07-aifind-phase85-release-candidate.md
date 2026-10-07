# AIFIND Phase 8.5 Release Candidate Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with TDD and one fresh final review. User scope takes precedence: no stage/commit/push, no cleanup, no production actions, no new Preview phase.

**Goal:** Deliver a deployable non-production AIFIND Release Candidate with the existing 12 real Products and 2 Compare / 2 Category / 2 official_sources Guide pages.

**Architecture:** Reuse the current Product/Editorial publication workflow and publication Readers. Change existing launch readiness semantics for explicitly disabled collection and source-backed content. Site identity/policies stay in site/; normal admin readiness remains protected. A new loopback candidate database and ordinary API/web/worker runtime use no Preview fixtures or startup import.

**Tech Stack:** Existing Node 24, Fastify, React Router, PostgreSQL 17 and pg-boss; no added dependencies or migrations.

**Spec:** User attachment copied intact to `.data/phase85-20261007-28f87d2e/user-spec.md` (1442 lines).

## Global Constraints

- Operator display name `AIFIND編集部`; editorial project, no invented legal identity, address or email.
- Contact `/contact` → existing `/feedback`; exercise the real form and receipt.
- Source-backed deterministic facts may publish without per-Product Owner approval; unknown remains legal and distinct from negative/free.
- Normal runtime: `AIFIND_PREVIEW_ENABLED=false`, `COLLECT_ENABLED=false`, `MODEL_CALLS_ENABLED=false`, `AIFIND_DETECTOR_ENABLED=false`, Feishu/IndexNow false, all Product Monitors disabled.
- Source review deferred only when OFF is explicit and no Monitor or collection valve is enabled. Unexpected enablement, synthetic content, unsupported facts, missing Evidence/assets/admin/backup stay blocking.
- Preserve Phase 8's 1113 DB / 94 Web test names, statuses and skip reasons; no assertion weakening, skips, timeouts, resets or cleanup.
- New loopback `aifind_phase85_28f87d2e_launch_candidate_test`; never use old Preview databases or Production. Public candidate URL `http://localhost:4000`; API4001.
- Freeze all current migrations and assets; no secrets, exclusive bundle output, keep Phase 8 evidence unchanged.
- Local paired backup/restore required; absent remote disaster recovery is Operations PARTIAL, a Phase 9 prerequisite. Production Deploy NOT EXECUTED.

## Review Focus

1. OFF plus a single unexpectedly enabled valve/Monitor must BLOCK rather than defer permission (Task1).
2. Official-looking but inaccessible, mismatched or contradictory definite-fact Evidence must not earn readiness; unknown must remain permitted (Task1).
3. A changed staged Draft must not be auto-published as if it matched the frozen pack (Task3).
4. Normal admin readiness must work without Preview transport, while anonymous private API access remains denied and noindex/no-store (Task2).
5. Local backup proof cannot imply uploaded/remote production recovery; missing paired assets fails closed (Task1/4).

### Task 1: Source-backed content and explicit launch-mode readiness

**Files:** modify `modules/aifind/launch/corpus.ts`, `preflight.ts`, `site/launch/owner-review.json`; add `modules/aifind/tests/launch-candidate.test.ts`; retain old collection readiness checks and add explicit OFF cases.

**Interfaces:** `sourceBackedReadinessIssues(input: unknown): string[]`; extend `LaunchSnapshot` with publication/collection mode, source-backed issue count, enabled Monitor count and genuine local backup proof; `evaluateLaunchGates(snapshot: LaunchSnapshot)` returns engineering/content/releaseCandidate/operations/productionDeploy plus existing informational gates.

- [x] Write RC01–RC09 tests: safe OFF deferral, each unexpected valve and enabled Monitor blocking, source-backed owner-independent readiness, inaccessible/cross-Product/contradictory source evidence, unknown acceptance, weak admin blocking, local-versus-remote recovery.
- [x] Run the new tests and record expected failing assertions before implementation.
- [x] Implement minimal pure validation/evaluation. Actual preflight reads real published aggregates and current site launch decisions, performs no HTTP/model calls, never treats Draft as public.
- [x] Run new/affected tests and full suite; preserve legacy test names and meaningful strictness. Record only authorized assertion semantic changes.

### Task 2: Public identity, factual launch policies, homepage and normal admin readiness

**Files:** modify `site/site.ts`, `site/pages/terms.md`, `privacy.md`, `modules/aifind/web/contact.tsx`, `home-products.tsx`, `web.tsx`, `module.ts`, `launch/routes.ts`; add `web/policy-footer.tsx`, `web/launch-readiness.tsx`; reuse the existing readiness display and old Preview routes.

**Interfaces:** normal `/admin/aifind/launch-readiness` → `/api/admin/aifind/launch-readiness`; no Preview API dependency. Existing `adminGet` and `adminHandler` boundaries remain unchanged.

- [x] Write real HTTP/SSR tests for normal admin auth/noindex/no-store, factual contact/operator copy, all five Footer links and data-driven home sections; watch relevant cases fail.
- [x] Set weak editorial identity and current-function Terms/Privacy, contact form entry, existing home sections without engineering labels. No legal advice claim or unverified retention promise.
- [x] Run affected HTTP/Web tests and typecheck. Manually review policy wording against real feedback/auth/log implementation.

### Task 3: Authorized real candidate publication and freeze metadata

**Files:** add `scripts/serve-aifind-launch-candidate.ts`; extend `launch/staging.ts`, `launch/bundle.ts`, `scripts/stage-aifind-launch.ts`; update the existing corpus, retain historical alias and original phase evidence; add candidate publication/bundle tests.

**Interfaces:** `publishLaunchCandidate(input: unknown, actor: string, reason: string)` is a separate audited non-production workflow, requiring validated source-backed pack and unchanged staged Drafts. Existing simulation entrypoint remains for prior tests/history. Bundle optional typed launch metadata records OFF, operator and contact path without secrets.

- [x] Verify Notebook identity from current official Google documentation and the old help URL redirect; refresh affected provenance and Alias without guessing Japanese/UI/prices.
- [x] Write tests for real publication, post-import Draft edit rejection, production/non-loopback rejection, exact 12 count, typed launch metadata and secret/synthetic refusal. Watch fail, then minimally implement.
- [x] Reuse normal process startup with explicit candidate-only guard; no startup migrate/seed/import/publish. Disable every real external action and exclude secrets from web environment.
- [x] Freeze real current public Editorial/Asset references and migrations after final tests; verify repeated byte-identical output and all hashes. Original phase bundles remain intact.

### Task 4: Fresh candidate, public Chrome, recovery and final closure

**Files:** scoped operator helpers/logs under this phase's ignored `.data` directory; update `docs/deploy.md`; save `2026-10-07-aifind-phase85-release-candidate-report.md`.

- [x] Create the new empty loopback candidate database, migrate all81, import12 real Product Drafts, validate, separately publish Products and 2+2+2 Editorials through Domain actions. Import only existing real official-source Japanese news with original dates/provenance; no synthetic records, fabricated analysis or new collection pipeline.
- [x] Start normal4000/4001 runtime with all flagsfalse. Real browser public LC01–LC25, admin checks, functioning contact submission, canonical/sitemap/robots, desktop/mobile screenshots; no Preview route as primary acceptance.
- [x] Run content smoke for exact counts and no public synthetic/Draft/private/fake-ratings/hands-on/broken-assets leakage, standard site/MCP smoke.
- [x] Create actual pg_dump + uploads archive and restore both into a second new safe database/directory; test DB-only missing-asset failure boundary; do not invent remote-upload success.
- [x] Run `npm run typecheck`, `npm test`, Web build and Web tests. Compare Phase8 test multiset including all8 original skips; keep initial timeout and two isolation results in evidence.
- [x] Perform one fresh independent whole-phase review; Critical/Important fixes each RED→GREEN in one pass and complete suite rerun. No second reviewer or unrelated refactor.
- [x] Seal current bundle and Git before/after audit; report all five gates, required counts/states/results/SHA/deployment prerequisites. STOP; no Phase9/production/commit/cleanup.

## Before evidence and progress

CurrentHEAD `9848e936106db037d99a304887c36aad3fd0fad4`, branch `codex/ai-signal-jp`;1070 paths/1067 existing files copied before edits;81 migrations hashed. Three old SC files were already absent and remain absent. Progress and decisions: `.data/phase85-20261007-28f87d2e/progress.md`.
