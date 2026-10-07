# Phase 3 execution ledger

Binding design: Product Owner's full Phase 3 request. Plan: `docs/superpowers/plans/2026-10-06-aifind-phase3-public-products.md`.
Evidence: `.data/phase3-20261006-d802943d/`.

## Rulings, in chronological order

1. Execute the already-authorized binding Phase 3 design after saving the plan, without another design-approval or execution-menu pause. Cost: routine implementation choices are recorded here and remain reviewable in the plan/report.
2. Use Windows-native files/Node tooling instead of POSIX skill ledger/worktree helpers; preserve the shared dirty checkout and all earlier previews. Cost: record and verify scoped backups/hashes/diff ourselves. No staging, committing or merging this user's unfinished work.
3. Keep listed Preview pages protected from indexing by the existing environment-wide SITE_PREVIEW override; independently test normal listed indexability in non-preview SSR tests. Cost: the synthetic local demo is intentionally nonindexable; production listed semantics are proved in tests.
4. Fresh-context review declined to judge excluded Resolver/Detector/Compare/Category/How-to/Affiliate/Public API v1. Ruling: defer to their separately authorized phases. Cost: no delivery or acceptance claims for that work.
5. Review declined to judge production deployment/import/operations. Ruling: keep this phase local; no production DB or deployment action. Cost: production acceptance remains a later explicit task.
6. Browser control plugin twice failed its Windows sandbox helper; use already-installed Playwright with actual visible Chrome and loopback-only network instead. Cost: retain tool failure history plus actual Chrome requests/screenshots; no installation.
7. Append 0074 for the review's slug isolation guard instead of rewriting 0073 already applied to our own local Preview. Cost: one extra forward migration, no new table or previous migration edits.

## Task progress and RED → GREEN evidence

Plan saved before implementation. Existing migration maximum: 0071.

T1 GREEN: t1-red.log (10 intentional feature failures); t1-green.log diagnosed Node strip-only parameter property incompatibility; changed to ordinary field assignment; t1-green-2.log 10/10 PASS. Public summary clone/immutability, actual fact readiness, private publication, stale identity token and permanent first public time verified.

T2 RED: t2-red.log 5/5 fail because slug history does not exist/old slug reuse succeeds. Namespace locking is necessary because PostgreSQL unique indexes do not span the current/history tables; test uses competing real transactions. New migration 0073 keeps this increment separate from 0072.

T2 GREEN: t2-green-2.log 5/5 PASS (first attempt diagnosed test calling a Tx-required identity command without its transaction).
T3 RED/GREEN: t3-red.log 1 PASS/8 expected feature FAIL; t3-green.log 9/9 PASS, real Fastify + real DB + OG renderer. Allowlist/current-version isolation, fresh withdrawal, map/index and admin CSRF exercised.
T5 RED/GREEN: public-preview.test.ts, t5-red.log 2 missing-feature FAIL → t5-green.log 2/2 PASS; opt-in/production guard and preserve-edits seed verified. Done before SSR so its real DB fixture is available.
T4 RED/GREEN: t4-red.log 1/9 PASS (routes absent); t4-green.log diagnosed React Router uses loaderData for metadata → t4-green-2.log 9/9 PASS with full SEO/render/isolation behaviors.
Incremental full regression: 819 DB tests, 809 PASS/2 FAIL/8 existing SKIP; migration inventory hardcodes require 0072/73 and retained-data checks must exclude only the newly nullable summary. Web 52 tests, 44 PASS/8 FAIL: old HTTP test doubles lacked the new product home API, plus the authorized stricter homepage cache policy. No skip/delete or broadened correctness assertions; fixture updates and explicit no-store assertions added. Retain independent absolute-deadline helper checks and other pages' live shared-cache tests.

T6 pre-review: full-pre-review.log 819/811 PASS/0 FAIL/8 original SKIP; web-full-pre-review.log 52/52 PASS. Fresh typecheck/build PASS.
T7 first Chrome attempt C01–C14 PASS then C15 harness label locator timeout (Field uses a visual label, not an associated label). Preserve attempt in chrome-attempt1; correct locator to observed dialog textbox. Second actual Chrome run C01–C18 PASS, zero page errors/external requests.
T8 single fresh-context reviewer: 0 Critical, 2 Important, 1 Minor. No Draft/internal data leak. Important fixes use real stale RR tests (review-slug-red.log 5 PASS/3 expected FAIL) and real Published-to-SSR price-period tests (review-free-red.log 1 PASS/2 expected FAIL). Single consolidated fix pass appends RC slug-claim guard and derives current free-plan assertion in the public projection using Tokyo dates; cards consume that API fact. Minor long vendor/publisher wrapping fixed with simple existing CSS utilities. No deferred Minor items.

Final acceptance: review-domain-green.log 22/22 PASS; typecheck-final/build-final PASS; full-final.log 827 total/819 PASS/0 FAIL/0 CANCELLED/8 old SKIP; web-full-final.log 55/55 PASS. Every Phase 2 baseline DB test (793) and Web test (43) retains its exact name/depth/status/skip reason. 34 new DB tests and 12 new Web tests pass.
Final Chrome 154.0.8037.95 visible browser C01–C18 PASS after final code/build/0074 migration; desktop 1440×1000 and mobile 375×812 captured and visually inspected. No page errors or external requests. smoke-final.log all 30 routes/MCP checks PASS. Actual admin saved Draft summary, USD125.45 and Japanese UI partial; read-only confirmation proves Published remains USD20/UI unknown. Detail/list/home/sitemap/JSON-LD stayed unchanged.
Phase 3 Gate achieved; final report and before/after path/migration/index/env hashes recorded. Stop before Phase 4.
