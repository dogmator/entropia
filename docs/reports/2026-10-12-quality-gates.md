# Quality Gates — 2026-10-12

## Current state

### Branch Protection (main)

| Setting | Value |
|---|---|
| Required status checks | `Verification` (strict: up-to-date required) |
| Required approvals | 0 |
| Dismiss stale reviews | true |
| Conversation resolution required | true |
| `enforce_admins` | false (admin bypass allowed, audited) |
| Force pushes | forbidden |
| Branch deletions | forbidden |
| Linear history | not required (merge commits preserved) |

### CI

- `.github/workflows/ci.yml` — job `Verification` runs `pnpm run check` on PR/push to `main`.
- `.github/workflows/deploy.yml` — job `build-and-test` runs `pnpm run check`, then Pages upload/deploy on push to `main`.
- Toolchain pinned per-repo: `packageManager: pnpm@10.34.7`, `.nvmrc` = 22, `engines` node `>=22 <23` / pnpm `>=10 <11`; `pnpm-workspace.yaml` `onlyBuiltDependencies: [esbuild]`.

`pnpm run check` = `typecheck && test --run --coverage && depcruise && build` (no ESLint; coverage thresholds enforced).

### Husky (local feedback, not a gate)

- `pre-commit` → `lint-staged` (`*.{ts,tsx}`: `eslint --fix --max-warnings 0`), fast.
- `pre-push` → `pnpm run check`, full.
- Rationale: cloud agents work in clean containers where local hooks may be absent, so GitHub Branch Protection is the real gate.

### ESLint

Enforced ruleset includes `@typescript-eslint/no-explicit-any` (error), `ban-ts-comment` (error),
`no-warning-comments` (warn), `sonarjs/no-duplicate-string` (threshold 3), plus the
existing strictness/architecture rules. Run via `pnpm run lint` (part of `check:strict`).

### Coverage

- Scoped to `src/**` (`vitest.config.ts`), provider `v8`, reporters `text/json-summary/html`.
- Current: statements/lines **49.26%**, functions **59.81%**, branches **79.29%**.
- Thresholds (baseline −5%): lines 44, statements 44, functions 54, branches 74 — protects against regression without blocking on the existing gap.

## Target state (after cleanup)

- `check:strict` promoted to a required Branch Protection check.
- Coverage 80%.
- Zero ESLint errors/warnings.
- Zero strict TS errors (`exactOptionalPropertyTypes` enabled).

## Roadmap

1. **Stage 1** — clear ESLint debt (import-sort, duplicate strings, worker switch exhaustiveness).
2. **Stage 2** — enable `exactOptionalPropertyTypes`; fix Logger/Performance payload types.
3. **Stage 3** — raise coverage toward 80%.
4. **Stage 4** — make `check:strict` a required check.

See `2026-10-12-strict-debt-audit.md` for the current debt inventory.

## Known limitations (2026-10-12)

- Husky pre-commit blocks commits to legacy files that contain pre-existing lint
  debt (unrelated to the change). Workaround: `--no-verify` with an explicit
  justification in the commit body.
  Long-term fix: clear the strict debt (see the audit) OR scope pre-commit to
  changed regions only (separate PR).
