# SDD ledger — plan: docs/launch-readiness-plan.md

Spec: user implementation plan plus explicit requests for complete original feature coverage and launch-scale real news. Scope includes model leaderboard, Codex reset monitoring, topic chronicles. Do not repeat completed eight-article preview work.

Pre-flight: News pipeline and module restoration meet at the site's module registry, package lock, Dockerfile, and publication hooks. Parent owns all shared integration files. Workers own disjoint module trees and migrations 0057/0058/0059; no shared test database.

Ruling: Restore publicly available upstream implementations from cc66cce instead of inventing replacements — these features were removed only from the later export — cost if wrong: rework compatibility, without claiming parity with private production data.

Ruling: Use Default project dedicated key after the user's explicit authorization — supersedes the earlier independent-project-only request — cost if wrong: usage shares a platform project, so this application retains its own $8 monthly stop; no shared-project budget changes.

Task 1: secure key configuration complete. Official picker, destination confirmation, creation, and local encrypted delivery completed. No plaintext key in logs. Actual paid model availability pending.

Task 2: module restoration in progress. Workers: restore_leaderboard (0057), restore_codex_monitor (0058), restore_topic_chronicle (0059). Parent: source verification, real pipeline, content preparation, integration and full verification.

Task 1 runtime: GPT-6 Luna connection confirmed through receipt 1, Japanese JSON returned, estimated $0.000008. A restarted operational check reused receipt 1 without a second charge.

Real pipeline: 146 bounded candidates manually collected from six official source listings, all source automatic switches still disabled. First five analysed: four usable Japanese summaries, one source without sufficient body/excerpt withheld. Model scores are real independent pairs.

Fix: Missing optional Jina key must not prevent processing the publisher's existing RSS excerpt after an unreadable article page. extraction-optional-reader test RED (missing key) -> GREEN; extraction consistency suite 7/7.

Fix: Explicit EMBEDDING_* values pointing at OpenAI were incorrectly accounted as another provider. Explicit-embedding test RED (service=embedding) -> GREEN (OpenAI cost and monthly stop); OpenAI provider suite 7/7. No real embedding requests escaped the budget: preparation disabled all non-OpenAI provider budgets and exposed the problem before a call.

Ruling: Module-owned public entities use one module publication/read layer, while all news articles still use the core publication layer — keeps the framework independent of installed modules and prevents competing raw article reads — cost if wrong: move the module reader interface into the core without changing public behavior.

Launch gates pending: real model pipeline and >=100 usable real news entries; real module data; quality review; final browser/tests; deployable content bundle; Linux Docker check; real 72-hour restricted run; domain/contact/terms confirmation.

Final local delivery 2026-10-04: real pipeline finished 146 articles / 86 selected, all dates known, all grouping complete. Six bounded official sources. 43 daily / 13 weekly / 4 monthly retrospective reports, explicitly dated as compilations. Ten editorial corrections. AI audit covers current hashes of all 146: 139 supported plus seven source-adjudicated false positives/wording issues; human acceptance remains null.

Modules finished: leaderboard 14 metrics / 6 providers / 1915 scores / 522 scored models / all five boards published; Codex three official resets and three status incidents; chronicle four companies/seven sourced historical nodes plus current publication data. Public history restored from cc66cce, no private-production parity claim.

Final fixes followed RED -> GREEN: Japanese source dates and omitted HTML document extraction; asynchronous topic projection; report withdrawal prose; Japanese quote validation; chronicle admin route; retrospective scheduler start and selected metrics. Full suite 639 tests, 631 pass/0 fail/8 Windows skip. Web 27/27, typecheck/build/smoke pass. Browser 34 pages + five interactions and six populated-report pages + nine public exits pass. Final review additionally found initial Postgres socket readiness; Compose healthcheck now waits for TCP, consistent with official image semantics.

Private content dump restored into a new local database; 71 tables matched snapshot row counts and content digests, ten restored public endpoints pass. Admin users/sessions excluded; known-secret and pattern scans pass. Original DB retained. Estimated OpenAI total $0.259005; $8 monthly guard unchanged, hourly request quota restored to 600. Worker stopped idle, no pending paid calls/jobs; existing preview remains read-only.

Still pending: source/benchmark redistribution conditions; 100 human gold labels and 30 independent acceptance; domain/operator/contact/terms; Linux Docker/CI and actual S3 cloud restore; real 72h restricted run. No cloud purchase, DNS changes or public deployment performed.

Completion/admin/SEO turn 2026-10-04: added default paginated content management, composable Japanese/title/URL/state/source/selected filters, protected SEO diagnostics, public Google/Bing verification tags, preview X-Robots-Tag, released-only sitemap and article/report JSON-LD images. TDD regressions observed RED then GREEN. Leaderboard now has authenticated Chinese source/price/context/fx/candidate administration and explicit automatic-publication opt-in. EQ free sources genuinely refreshed: 16 metrics / 2195 scores / 610 scored models; total board 80 models, all five optimal, shadow candidate explicitly published through admin validation. Chronicle now 12 entities / 50 officially sourced nodes; historical cutoff no longer hides current publication items.

Codex automatic collection/recognition is implemented with official-only CLI, optional disabled X, source revision receipts, budget, review and withdrawal protection. Actual free official scan returned three HTTP 403 responses, 0 documents; no model or X calls made. Preserve PARTIAL external connectivity. Independent review found three P2s: leaderboard CLI default publication, Codex withdrawn-event new-ID resurrection (including different UTC offsets), and invalid final event blocking later source revisions. All reproduced RED, fixed GREEN and independently closed. No remaining P1/P2 in reviewed increment.

Final integration: complete typecheck PASS; database suite 672 tests / 664 PASS / 0 FAIL / 8 Windows SKIP, exit 0; Web 29/29 PASS; build and final smoke PASS; 27 new real-browser admin/public/SEO checks PASS. New snapshot restored into aisignal_restore_completion_20261004 with 72 table counts/digests matching and ten public APIs passing without paid requests. Admin/auth data excluded and secret scans PASS. New dump SHA256 a914533df303d5e8b6375ed20479d74c6372a3a2131e2ca07486443bf5f7e2eb. Latest operator manual and boundaries: docs/admin-and-seo-zh.md and docs/verification-completion-20261004.md. Source/content archives regenerated with integrity manifests. Real content remains 146 / 86 selected, reports 60, estimated OpenAI total $0.259005. Preview restarted with final code; worker and external/model valves remain off. No new schema after already applied 0060/0061.
