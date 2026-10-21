# ADR-0001: Branch Protection and Quality Gates

## Status

Accepted (2026-10-12)

## Context

The project is developed with cloud agents (Codex, Claude).
Local husky hooks are not reliable: agents work in clean containers where hooks
may not be installed, and they can be bypassed (`--no-verify`). A technically
unbypassable gate is needed for merges into `main`.

## Decision

Use GitHub Branch Protection for the `main` branch:

- `required_checks`: `["Verification"]`
- `required_approvals`: 0
- `required_conversation_resolution`: true
- `enforce_admins`: false (admin bypass, audited)
- `allow_force_pushes`: false
- `allow_deletions`: false
- `required_linear_history`: false (merge commits are kept)

Husky is used for fast local feedback, not as a gate:
`pre-commit` runs `lint-staged`, and `pre-push` runs `pnpm run check`.

## Consequences

- A merge into `main` without green required checks is technically impossible.
- Cloud agents must open pull requests (through the API); a direct push to `main` is blocked.
- The pull request history is kept (merge commit), and the granular commits of a pull request remain in the history.
- `enforce_admins: false` leaves an emergency bypass for the owner, which GitHub audits.
- `check:strict` is not yet a required check (existing debt). After that debt is cleared, it is promoted to required (see `docs/reports/2026-10-12-quality-gates.md`).

## Note (2026-10-20)

The hygiene report of PR #58 states that ruleset `17666581` targets `refs/heads/mian`, which is a typo for `main`. It also states that classic branch protection on `main` requires the `Verification` check, with strict status checks and resolved conversations, and that `enforce_admins` is false. The session that wrote this note had no tool to read repository settings, so these statements are recorded as reported and were not re-verified. An owner should re-read the settings before relying on the Decision above.
