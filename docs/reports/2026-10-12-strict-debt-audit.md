# Strict Debt Audit — 2026-10-12

Baseline: `main` @ merge of PR #50. Repo is on a strict TypeScript baseline; the
only disabled strict flag is `exactOptionalPropertyTypes`.

## Summary

| Tool | Errors | Warnings |
|---|---|---|
| ESLint (`eslint src/`, strengthened rules) | 13 | 0 |
| TypeScript (`exactOptionalPropertyTypes: true`) | 5 | — |
| knip | 18 (3 files, 2 devDeps, 4 exports, 9 types) | — |

> Updated after PR-B (`refactor/logger-cleanup`, Logger group): the 13 Logger-related
> `exactOptionalPropertyTypes` errors are fixed (18 → 5) and the `logger` unused export is gone
> (knip 19 → 18). Remaining strict errors are non-Logger groups:
> `BufferManager.manager.ts:55`, `workerSnapshot.ts:41` (`RenderBuffers.sharedBuffer`) and
> `simulation.worker.ts:149/176/225` (`WorkerResponse.stack`).

## ESLint — by rule

| Rule | Count |
|---|---|
| `simple-import-sort/imports` | 8 |
| `@typescript-eslint/switch-exhaustiveness-check` | 3 |
| `sonarjs/no-duplicate-string` | 2 |

Newly enforced in this change: `@typescript-eslint/ban-ts-comment` (error),
`no-warning-comments` (warn, terms `todo`/`fixme`/`xxx`), `sonarjs/no-duplicate-string`
threshold lowered 5 → 3. `@typescript-eslint/no-explicit-any` was already `error`.

## Top files by ESLint findings

| File | Errors | Warnings |
|---|---|---|
| `src/simulation/simulation.worker.ts` | 3 | 0 |
| `src/ui/utils/__tests__/OrganismStateFormatters.test.ts` | 1 | 0 |
| `src/ui/components/settings/PerformanceSettings.tsx` | 1 | 0 |
| `src/ui/components/settings/GeneralSettings.tsx` | 1 | 0 |
| `src/ui/components/settings/AdvancedSettings.tsx` | 1 | 0 |
| `src/ui/components/diagnostics/LogsTab.tsx` | 1 | 0 |
| `src/ui/components/SimulationControls.tsx` | 1 | 0 |
| `src/ui/components/SceneContainer.tsx` | 1 | 0 |
| `src/ui/components/ErrorBoundary.tsx` | 1 | 0 |
| `src/ui/components/DiagnosticsModal.tsx` | 1 | 0 |
| `src/simulation/services/__tests__/SpawnService.anomaly.test.ts` | 1 | 0 |

`switch-exhaustiveness-check` (all in `simulation.worker.ts`, lines 275/288/306):
worker command dispatch switches do not handle every member of the command union.

## TypeScript — `exactOptionalPropertyTypes` (5 errors after PR-B)

| Code | Count | Typical cause |
|---|---|---|
| TS2375 | 3 | object literal with `undefined` values assigned to `ErrorResponse` / `RenderBuffers` optional field |
| TS2345 | 2 | argument of type `... \| undefined` not assignable (optional property) |

Concentration (remaining): `src/simulation/simulation.worker.ts` (`WorkerResponse.stack`),
`src/simulation/services/BufferManager.manager.ts` + `src/simulation/workerSnapshot.ts`
(`RenderBuffers.sharedBuffer`). These belong to the worker/buffers groups, not Logger.

Resolved by PR-B (Logger group): the 13 Logger-related errors in `Logger.service.ts`,
`logger/Logger.ts` (now deleted), `PerformanceMonitor.service.ts`, `scripts/log-server.ts`
and `Logger.test.ts` — root cause was optional payload fields (`source?`/`data?`) receiving
explicit `undefined`.

The other strict flags (`noUnusedLocals`, `noUnusedParameters`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`)
are already enabled in `tsconfig.json` and currently pass — they are not separate debt.

## knip

| Category | Count | Items |
|---|---|---|
| Unused files | 3 | `src/simulation/index.ts`, `src/simulation/services/index.ts`, `src/simulation/systems/index.ts` |
| Unused devDependencies | 2 | `jscpd`, `ts-node` |
| Unused exports | 4 | `isPrey`, `isPredator`, `isEntity`, `ParticleSystem` |
| Unused exported types | 9 | `PerformanceThresholds`, `Translations`, `ICameraData`, `EngineEventData`, `PopulationSnapshot`, `SimulationEventCallback`, `RenderFrame`, `GeneticTree`, `ParticleEffect` |

## Recommended cleanup order

1. ESLint: `simple-import-sort` + `import-sort` (mechanical, `--fix`) — 1 iteration.
2. ESLint: `sonarjs/no-duplicate-string` (define constants) — 1 iteration.
3. ESLint: `switch-exhaustiveness-check` in `simulation.worker.ts` (behavior-sensitive; add default/never guard).
4. TS: enable `exactOptionalPropertyTypes`; fix Logger/Performance payload types — 1–2 iterations.
   *(Logger group done in PR-B: 18 → 5; remaining worker/buffers errors tracked separately.)*
5. knip: remove/adjust unused files/exports/deps — after the above.
   *(Logger `logger` export removed in PR-B: 19 → 18.)*
6. Finally: promote `check:strict` to a required Branch Protection check.

> Note: `check` (enforced in CI) intentionally does not run ESLint; these findings
> live in `check:strict`. See `2026-10-12-quality-gates.md`.
