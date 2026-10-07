# AI Signal JP implementation

Accepted specification: the user's 2026-10-04 implementation request in this chat. Base: `9848e936106db037d99a304887c36aad3fd0fad4`.

1. Establish the pinned upstream baseline and local test runtime.
2. Japanese public UI, editorial prompts/validators, Tokyo calendar, stable public contracts.
3. OpenAI GPT-6 Luna and text-embedding-3-small; receipts, usage estimates and billing pause.
4. Twelve official source candidates, rights review, summary-only publication and independent branding.
5. Reproducible deployment, backups/restore, evaluation preparation, operational documentation.
6. Run required checks and browser acceptance, obtain independent whole-change review, record launch gates.

Public release requires real account setup, confirmed domain/contact/policies, 100 human-labelled samples (70 calibration/30 holdout), 27/30 usable Japanese outputs with no critical factual errors, and a real 72-hour restricted production observation. These must not be represented as passed by synthetic fixtures.

## Interfaces and acceptance

- Public `title`/`summary`, category keys, RSS, `/api/v1/`, MCP remain stable; content language becomes Japanese.
- Legacy internal `_zh` columns hold target-language text; translation language is `ja`.
- UTC storage, Asia/Tokyo display and report periods. No changes to published migrations.
- OpenAI Chat Completions uses `max_completion_tokens`, `reasoning_effort: none`; all paid calls use receipts, retries and budget controls.
- Normal rate limits back off; billing exhaustion pauses generation without taking published content offline.
- Tests first for behavior; typecheck, database tests, web build/tests, smoke, desktop/mobile verification.

## Review focus

Language false positives, Tokyo midnight boundaries, quota errors and restart recovery, receipt identity and dual scoring, source/fulltext permissions, secret isolation, backup restoration, incomplete release gates.
