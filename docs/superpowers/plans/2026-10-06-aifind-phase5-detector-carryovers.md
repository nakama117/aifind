# Phase 5 — Phase 4 carryover decisions

Status: documented and characterized; no Detector semantics/migrations changed in Phase 5.

## A · Observation retention

Actual code: `detector/observations.ts:recordObservation` keeps the first 12,000 JavaScript code units of successful source text and SHA-256 of the complete normalized fetch text. Migration 0075 caps PostgreSQL source_text at 12,000 characters, protects source inputs from UPDATE and all history from DELETE, and relates immutable Evidence quote + Unicode code-point locator to the retained text. Detector `detect.ts` writes those references before Candidate review. Existing operations cleanup does not name these tables.

Purpose: human review, quote verification, resolver/detector replay and receipt/candidate audit need the original retained input. A hash alone cannot recover or demonstrate the quoted passage; a live URL may change. Retrieved time is not human verifiedAt. The full-source hash identifies content beyond the retained prefix but is not a hash of that persisted prefix; tests explicitly preserve this distinction.

Risk: 12k units is a technical input limit, not a copyright license, a byte bound, or a retention policy. Up to roughly 48k UTF-8 bytes plus indexes/TOAST/rows per successful Observation; repeated unchanged observations also retain inputs. Actual cost depends on compression and volume. No source right/permission ledger or approved numeric TTL has been supplied. Do not silently treat an official page as permission to republish full text; current public Product DTO exposes only Evidence metadata/URL, not Observation text or internal quotes.

Decision: keep current protected audit evidence in this phase. No arbitrary sweep/DELETE or speculative new storage subsystem. Before production collection, the owner should select a source-permission and retention policy. Recommended later design: short, permission-governed raw-input retention; permanent bounded exact quote + locator context / source URL / retrievedAt / full hash / provenance; replay limitations explicitly recorded. It requires a forward migration that distinguishes retained/pruned input, permits authorized pruning without destroying Evidence validation, and makes audit ownership explicit. Hash+quote-only loses whole-document re-resolution; that tradeoff needs approval. Backup retention must use the same approved policy. This known limitation does not block the synthetic Phase 5 engineering gate.

## B · Semantic duplicate Candidate ADR

Actual behavior: Phase 4 `proposalKey` includes product, Published base, full contentHash, normalized target/value and resolver/detector/prompt versions. A source footer change yields a different hash; `processObservation` checks exact proposal_key and current Published value, not another active Candidate's semantic value. The new real-DB characterization test demonstrates two `pending_review` Candidates with identical values and different evidence/keys from Footer A vs B. Same hash retries remain correctly idempotent.

Decision: preserve Phase 4 proposal/audit identity in Phase 5, as allowed by the requested carryover scope. Do not rewrite published migration 0075 or collapse old Candidate history.

Follow-up design: under the existing product write lock, compare `(productId, baseVersionId, candidateType, targetKey, targetRef, normalized semantic proposedValue)` among active `detected/pending_review/approved` Candidates. Suppress a new duplicate review item but retain the new immutable Observation and Evidence and an explicit association to the original Candidate. Do not compare against `rejected/applied` indiscriminately: a rejected claim may need new evidence/re-review, and a newly Published base is a distinct review context. Resolver/detector version changes may warrant re-evaluation; existing provenance must remain visible. Implement with a forward migration only after association/review semantics are decided. Test simultaneous different hashes, genuine value differences, different bases, rejection/reopen, approval/apply and source provenance. No threshold/timeout increase, no loss of Evidence, no auto-approval.

Current acceptance: the behavior is characterized, not claimed fixed. Backlog remains explicit and does not authorize Phase 6 work.
