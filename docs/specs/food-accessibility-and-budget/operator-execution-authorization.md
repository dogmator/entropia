# FOOD-EXEC-001 — Conditional execution authorization

**Date:** 2026-10-25.
**Status:** OPERATOR APPROVED WITH GATES; **M0 NOT COMPLETED**.
**Applies to:** `FOOD-ADR-001`, `SPEC-FOOD-001`, `PLAN-FOOD-001`, and the dedicated implementation tracking issue.

This decision supplements the historical approval state recorded in the referenced documents. It does not rewrite their historical status tables or certify completion of any gate.

## Stabilization and Git workflow

1. Preserve all consolidated local changes and prepare an English-language review package in a dedicated branch.
2. Create a PR targeting protected `main` only after publication requirements for the English-language documents are satisfied. **Do not merge until explicit operator review and approval.** Do not push directly to `main`.
3. Delete only local or remote branches whose unique commits are fully preserved in merged `main`. Leave unmerged and independently reviewed branches intact.
4. Verify and record the final source SHA, clean worktree, quality gates and visual acceptance before publication.

## Minimum ecological implementation authorization

1. Record the M0 baseline and reproducibility evidence **after** the stabilization PR has been approved and merged into `main`.
2. On **M0 PASS**, incrementally implement the approved minimum food-accessibility and food-budget architecture through stages M1–M7 in separate reviewable changes.
3. Each stage must satisfy the dependencies and acceptance criteria in `PLAN-FOOD-001`; the operator retains review and merge authority over each implementation PR. No automatic merge or deployment.
4. **PHY-01** collision-physics changes and **M6-01** mixed genetic-scope exceptions still require distinct review and explicit authorization. This approval does not authorize changing genome semantics, unrequested physics, world migration, P2P or distributed consensus.
5. Historical snapshot handling, original Russian research sources, reproducibility evidence, deterministic fingerprints and performance thresholds remain authoritative; never rewrite data merely to obtain a green check.

## Current status

- Architecture D-01…D-06: **selected**, not implemented.
- M0: **not completed**. A passing structural preflight is not M0 evidence by itself.
- Implementation M1–M7: **conditionally authorized**, gated by stabilization merge, M0 acceptance and stage review.
- Stabilization PR merge: **requires separate operator approval**.
- Publication of the English document set: **requires translation approval as recorded in FOOD-ADR-001**.
