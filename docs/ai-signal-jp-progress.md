# AI Signal JP 实施进度

当前完整版本交付与验收记录见 [verification-launch-20261004.md](verification-launch-20261004.md)，运营和部署入口见 [operations-zh.md](operations-zh.md)。用户已扩展为完整功能、真实上线内容量和部署包；生产尚未上线。原8篇预览记录保留于 [verification-20261004.md](verification-20261004.md)。下列是历史环境决策，以最新交付记录为准。

## 初始环境决策（历史记录）

- Shared interfaces: Japanese validators/prompts/public copy and fixtures must change together; UTC DB timestamps remain unchanged.
- Shared interfaces: model parameters/receipt identity/budget errors and tests must change together; two score attempt tags remain independent.
- Shared interfaces: source ownership and event heat deduplication share identifiers; source enablement requires review.
- Ruling: use this newly cloned, dedicated checkout on `codex/ai-signal-jp`, not an additional worktree — the user explicitly chose the empty project root; no pre-existing user changes are present.
- Ruling: use Git's OpenSSL backend with certificate verification and per-command safe.directory — Schannel credential acquisition fails in the sandbox. The normal shell launcher then fails during sandbox refresh; approved escalated shell execution is used for project work.
- Launch gates remain pending until their real evidence exists; no API account, domain or human labels have been supplied.

## 初始基线（历史记录）

- Base cloned and checked out at the pinned commit. Dependency installation started. Node 24.14.0 / PowerShell 7.6.5 available; Docker/PostgreSQL not found in checked locations; WSL enumeration denied by host.
