# AIFIND Phase 3 — Public Product Pages + SEO

> Binding scope: the Product Owner's Phase 3 request, saved verbatim in `.data/phase3-20261006-d802943d/binding-user-spec.md`. Implementation starts only after saving this plan. Phase 4 is excluded.

## Goal and boundaries

Expose only ready, current Published product versions at `/products` and `/products/:slug`, with Japanese SSR pages, conservative SEO, permanent slug redirects, visibility controls and a real browser Preview. Retain every existing Phase 0–2 modification, module and preview. No Resolver, Compare, Category/Best, How-to, affiliate, search redesign, accounts, new CMS/framework/service or production writes.

## Architecture

Browser → React Router SSR → internal HTTP `/api/site/aifind/products` → AIFIND public reader through a generic `packages/backend/src/publication/` snapshot boundary → current Published version in PostgreSQL.

Public readers construct a separate explicit field allowlist. They never return the full admin/domain snapshot, aliases, internal IDs, evidence notes, candidates, audit or Draft fields. Admin continues to use its protected existing reader and RC mutation transactions. Public snapshot transactions remain read-only Repeatable Read.

Use existing module routes/navigation and Japanese fonts/brand configuration. Framework changes are limited to reusable home-part and sitemap-index sockets; no framework import or hardcoding of AIFIND. No new public API v1/MCP/RSS contract.

## Public state and schema

Append migrations `modules/aifind/migrations/0072_aifind_public_pages.sql` and `0073_aifind_slug_history.sql`; do not edit migrations 0062–0071 or core migrations. Separate migrations keep the two TDD increments independently reproducible. Final review adds forward migration `0074_aifind_slug_claim_isolation.sql` so stale RR write snapshots cannot bypass the shared slug namespace, without rewriting already-applied 0073.

- `af_products.public_visibility`: `private` (default), `unlisted`, `listed`.
- `af_products.first_public_at`: first successful public transition, permanent across withdrawal/republication.
- `af_product_versions.summary_ja`: nullable human-edited plain text; clone/update/version immutability follow existing Draft rules. Existing products stay private; no backfill invents summaries.
- `af_product_slug_redirects`: immutable product ID + globally unique old slug + creation time. Before a product is ever public, renaming creates no history. Afterward, every old slug is reserved, including while withdrawn. Current and historical namespaces must not collide; serialize competing slug claims at the database boundary. Historical lookups join product ID to its current slug, never redirect chains. Private historical URLs return 404.

Readiness checks current Published, valid display name/official HTTP(S) URL, nonempty summary, actual JP and ja fact rows, credible domain lastVerifiedAt and all publication fact constraints. Unknown values in actual JP/ja records are allowed. The same checks reject publication of an incomplete replacement version for an already public product; private products retain existing publication semantics. Public reads fail closed if readiness is later lost.

## Exact implementation areas

1. Domain: `contracts.ts`, `catalog/read.ts`, `catalog/versions.ts`, `catalog/publish.ts`, new `catalog/public-settings.ts`, migration 0072 and new database tests.
2. Public reader: new `public-contracts.ts`, `publication/public-products.ts`, `publication/sitemap.ts`; generic new `packages/backend/src/publication/snapshot.ts`.
3. HTTP/OG: new `public/routes.ts`, module server registration and API-owned paths. Reuse existing Japanese OG renderer through its package export; no external assets. All product responses, including absence, redirects and OG, are `no-store`.
4. Sitemap: add a generic `ServerModule.sitemap.files` socket and `/sitemap-index.xml`; keep existing news `/sitemap.xml` behavior. Product map is separate, uncached, listed/current/ready only with Published publishedAt lastmod. `robots.txt` points to the index. No products enter the news map's stale cache.
5. Web: new module public directory/detail/components/home part; existing generic `WebModule.home` HTTP-fed slot and `routes/home.tsx`; existing `module.ts`, `web.tsx` register public routes/nav. Home shows up to six listed cards, hides an empty part and uses no-store when module data is present.
6. Admin: add a small visibility/readiness panel and protected CSRF/revision/audit action; add summary_ja Draft editing and diff. Existing Publish and Review Queue boundaries remain unchanged.
7. Preview: explicit new `preview/public-seed.ts` and `scripts/seed-aifind-public-preview.ts`; extend the existing safe launcher with an isolated public runtime. Four clearly synthetic products: listed + different Draft, unlisted, private, listed with multiple old slugs. Dedicated loopback `aifind_phase3_preview`, ports 3400/3401 after availability checks. Never seed on startup or in production. Register public preview links in the simple Hub.
8. Minimal documentation: synchronize only Master Spec's obsolete candidate direct-publish paragraph with accepted Phase 2 behavior; final report/new baseline evidence.

## SSR and SEO behavior

Directory shows listed products only: name, vendor, summary, JP availability, Japanese UI, known free-plan presence and last verification. No fabricated filters/ratings. Detail displays separate Japanese input/output/UI, controlled platforms/capabilities, lifecycle and exact native-currency prices: free/fixed/from/custom/unknown remain distinct. Evidence shows current-version referenced public title/publisher/source kind/URL, never notes. lastVerifiedAt is domain verification semantics, formatted as a JST date, never updated_at.

Product detail title, bounded summary description, self-canonical and OG use SITE/SITE_URL. Unlisted is `noindex,follow`; listed is indexable outside the deliberately noindex local Preview environment. JSON-LD SoftwareApplication omits ambiguous offers, ratings and reviews. Old slugs issue direct 301 to the current public canonical URL. Withdrawn product URLs and historical slugs immediately return 404, with no-store on API, HTML, OG and sitemap. Homepage is no-store as well; no SWR or CDN purge requirement.

## Execution and TDD checklist

- [x] T1: Write failing domain tests for summary cloning, readiness, visibility and permanent first-public date; append schema and implement minimal domain commands.
- [x] T2: Write failing slug-history/namespace/concurrency tests; implement direct-to-current redirects and preservation rules.
- [x] T3: Write failing real-database reader/HTTP tests for W01–W17, W23–W32, W34–W35; implement allowlist, internal API and fresh sitemap/OG.
- [x] T4: Write failing built-SSR tests for rendering/SEO/home and W18–W22/W33; implement module pages, small admin public controls and generic sockets.
- [x] T5: Write guarded Preview seed tests; seed only new isolated local Preview and register Hub links.
- [x] T6: Run fresh typecheck, full database npm test, web build and complete Web tests; compare every old baseline test name/status (793 DB tests, 43 Web tests; eight established platform skips). Tokyo and brand checks must remain green.
- [x] T7: Real Chrome C01–C18 including actual admin Draft edits and visibility withdrawal, desktop/mobile screenshots, external network blocked. Restore only own Preview visibility for a usable final Preview; retain evidence of each state.
- [x] T8: One fresh-context whole-change review required by Superpowers; resolve important/critical defects with failing tests and rerun affected/full checks. Save final report and immutable new baseline evidence; stop.

W01–W35 and C01–C18 are enumerated in the binding request and will each receive PASS/FAIL/UNRUN plus an evidence location in the report; no sampling.

## Safety and acceptance

Before snapshot: 895 existing files copied with hashes in `.data/phase3-20261006-d802943d/before/`; 68 existing migrations, HEAD, index and .env hashes recorded. All preexisting files not in the explicit change list must remain byte-identical. Retain scoped before/after diff; never reset/clean/restore/stage/commit/push or overwrite another preview runtime. No credentials in reports or Git.

Use already installed PostgreSQL client tools and isolated `_test` databases. All collection/model/Feishu/IndexNow valves stay false; fake services may be loopback only. No worker starts. Browser Preview uses the existing admin password/session/CSRF flow; public pages themselves need no admin session.

Phase 4 Gate can be READY only when all required public state/SEO/isolation/slug/security behaviors, fresh regressions and real browser Preview are verified. Known limitations must concern excluded future work, never a missing Phase 3 requirement. Stop after reporting the gate.
