# Repository Hygiene and Quality Baseline — 2026-10-20

Scope: the P0/P1/P2 hygiene pass described in the task brief. Simulation behaviour is unchanged except where a change is listed under *Behavioural changes*.

Branch: `claude/tender-galileo-7mw4bs`, based on `origin/main` (`7ce2c6b`). Commit `f3d5007` (seed applied before initial population) was not in `main`. It was integrated as `53475bb` with no conflicts.

## Verdict

**NOT READY FOR REFACTORING.**

The mandated gates now pass from a clean clone on Node 22.22.0 (see *Before / after*). Three blockers remain:

1. **Branch protection is not effective on `main`** (P0, owner action). The ruleset named `main` targets `refs/heads/mian`, a typo. Its only rules are deletion and non-fast-forward. There are no required checks and no PR requirement. See *Open items*.
2. **Critical and high advisories remain in the dev toolchain** (4 critical, 43 high). The fix requires a major Vitest upgrade, which is outside this pass.
3. **The simulation RNG is one module-level stream.** Two engines in one realm interfere. Refactoring the simulation core cannot be verified against a reproducible baseline until this is fixed. The limitation is pinned by a test (`Determinism.test.ts`).

Refactoring of UI, tooling, and rendering can start now. Simulation-core refactoring should wait for blockers 1 and 3.

## Before / after

Before is `origin/main` at `7ce2c6b`, measured in a clean checkout with the frozen lockfile. After is the branch head, measured in a fresh clone of the branch on Node 22.22.0.

| Check | Before | After |
|---|---|---|
| `pnpm run check` | PASS | PASS |
| `pnpm run check:strict` | FAIL (lint, knip, tooling) | PASS (clean clone) |
| `pnpm run check:tooling` | FAIL, 2 violations (`.dependency-cruiser.mjs`, `postcss.config.mjs`) | PASS, 2 documented exceptions |
| TypeScript, `exactOptionalPropertyTypes: false` | PASS | PASS |
| TypeScript, `exactOptionalPropertyTypes: true` | not enabled (5 errors when enabled) | PASS |
| ESLint | FAIL, 14 errors, 3 warnings | PASS, 0 errors, 0 warnings |
| knip | FAIL, 18 findings (3 files, 2 devDeps, 4 exports, 9 types) | PASS, 0 findings |
| dependency-cruiser | PASS | PASS |
| Unit tests | 188 pass (26 files) | 259 pass (36 files) |
| Coverage (lines / branches / functions / statements) | 48.15 / 78.69 / 58.40 / 48.15 | 53.27 / 80.93 / 63.23 / 53.27 |
| Coverage thresholds (44 / 54 / 74 / 44) | PASS, not enforced in `check:strict` | PASS, enforced in `check:strict` |
| Production build | PASS | PASS |
| Smoke (Playwright, isolated) | FAIL, 1 failed + 9 not run (HMR socket refused on 3000; browser not found without path) | PASS, 10/10 with `SMOKE_CHROMIUM_PATH` |
| Production dependency audit (high+) | not gated | PASS (`audit:prod`, 2 moderate in `fflate`) |
| Dev dependency advisories | 77 (4 critical, 46 high, 26 moderate, 1 low) | 70 (4 critical, 43 high, 22 moderate, 1 low) |
| Branch protection (`main`) | not effective | not effective (see *Open items*) |

Dev advisories fell by 7 (high 46 → 43, moderate 26 → 22) after the `vite` and `ws` bumps. The remaining ones are listed under *Open items*.

## Fixes by priority

### P0 — local infrastructure security

- **Diagnostic server** (`scripts/log-server.ts`, `log-server-policy.ts`, `log-payload.ts`).
  - Listens on `127.0.0.1` by default. Non-loopback hosts are refused unless `LOG_SERVER_ALLOW_REMOTE=1` and `LOG_SERVER_TOKEN` are both set. The token is checked in constant time on every handshake.
  - Foreign `Origin` values get HTTP 403. Only `localhost`, `127.0.0.1`, and `[::1]` over http(s) are accepted.
  - Frames are capped at 100 000 bytes, and clients at 8.
  - An invalid `LOG_SERVER_PORT` stops the server.
  - The "Address" banner is printed on the `listening` event. It used to be printed before the socket was bound.
  - Integration tests run the real process. Against the previous server, 5 of 7 fail.
- **Smoke harness** (`scripts/smoke-harness.ts`, `tests/smoke/log-transport.spec.ts`).
  - `killPort()` is removed.
  - Only processes started by the harness are stopped, each in its own process group.
  - Dedicated ports are checked before use. A busy port fails the run. Nothing is freed by force.
  - Cleanup runs at the end of the run and on exit, SIGINT, and SIGTERM.
  - Output goes to `test-results/smoke/`. The tracked `docs/cycles/...` report is written only with `SMOKE_REPORT_PATH`.
  - Regression tests run on real processes: a busy port is not touched, a foreign process survives `stopAllOwned`, and SIGTERM escalates to SIGKILL.
- **Dev server** (`vite.config.ts`). The HMR client port is no longer pinned to 3000. Dev servers on other ports used to point HMR at a closed socket.

### P0/P1 — findings with reproduction

- **Loader race** (`useEngineSync`, `useSimulationLifecycle`). A fixed 500 ms timer hid the loader before the worker reported `initialized`. The viewport then read `engine.worldConfig` and threw `EngineProxy not initialized`, and React recovered only by re-rendering. The fix hides the loader on init completion. The slow-init test fails on the previous code.
- **Worker `setSpeed`** (`simulation.worker.ts`). `setSpeed` with NaN stopped the simulation silently. Non-finite and negative speeds now get an error response and keep the previous factor. Command dispatch is split by typed group, so each switch is exhaustive.
- **Food culling** (`Entities.tsx`, `foodVisuals.ts`). Culling used the instance scale, but the rendered sphere is `RENDER.geometry.food.radius` (2) times that scale. Food near the screen edge could be dropped while still visible. Culling now uses the bounding radius.
- **URL state tests** (`useSimulationSettings.url.test.ts`). The test file re-implemented the parser and checked a copy. It now tests the real `simulationUrlState.ts`, and a camera round-trip test was added.

### P1 — quality gates

- **ESLint.** All 14 errors and 3 warnings are fixed. No rule was disabled globally and no source file was excluded. Generated `coverage/` and Playwright output are ignored. A few targeted, justified line disables remain in the smoke spec (`sonarjs/no-os-command-from-path` for project-local binaries and `git`).
- **TypeScript.** `exactOptionalPropertyTypes` is on. The five errors were fixed by adding `| undefined` to two optional field types. Runtime values and message shapes are unchanged.
- **knip.** 18 findings are now 0. Dead `ParticleSystem` code was removed. Removing it left `OrganismShader.ts` and `ParticlePool` unused, so they were removed too. Barrels with no importers were removed.
- **Tooling.** `check:tooling` passes with explicit, documented exceptions. `.dependency-cruiser.mjs`: dependency-cruiser 17 cannot load a TypeScript config. `postcss.config.mjs`: Vitest's bundled Vite 5 loads a `.ts` PostCSS config through ts-node as CJS, which fails in an ES module package. Both were verified; see `scripts/ensure-typescript-tooling.ts`.
- **CI.** CI and deploy run `check:strict`, which includes coverage thresholds. A new `audit` job fails on high or critical production advisories. Dependabot is configured.

### P1 — reproducibility

- Node is pinned to 22.22.0 in `.nvmrc`. CI reads it instead of the floating `22`.
- The Dockerfile uses `node:22.22.0-slim` and `pnpm@10.34.7`. Docker and CI install with `--frozen-lockfile`.
- Targeted bumps: `vite` 8.0.5 → 8.1.6 and `ws` 8.18.3 → 8.22.0. Both fix advisories relevant to this repo (the Windows `fs.deny` bypass and the `ws` fragment DoS). No other dependency changed.

### P1 — regression protection

| Scenario from the brief | Coverage | Result on previous code |
|---|---|---|
| 1. Same seed gives a reproducible result | `Determinism.test.ts`: same seed identical, different seed different, snapshot continuation identical | Passes. The RNG limitation is pinned and documented. |
| 2. Worker handles and rejects commands | `simulation.worker.test.ts` (11 tests) | `setSpeed(NaN)` test fails: the simulation stalls. |
| 3. Lifecycle: start, stop, reset, re-init | Worker lifecycle tests, snapshot continuation | Passes. |
| 4. Camera state restored from the URL | `useSimulationSettings.url.test.ts`, camera round-trip | Passes against the real module. |
| 5. Food size consistent across model, buffer, render | `FoodSizeConsistency.test.ts`, `foodVisuals.test.ts` | Culling test fails: bounding radius was the instance scale. |
| 6. WebSocket diagnostics errors do not break the app | `Logger.websocket-errors.test.ts` (5 tests) | Passes; the paths were not covered before. |

The coverage threshold was not lowered and the target of 80% was not forced. Coverage rose from 48.15% to 53.27% by covering the critical paths above.

## Behavioural changes

These are the changes a reviewer or operator might notice.

1. **Diagnostic server.** Listens on loopback only, where it used to listen on all interfaces. Foreign origins get 403. Frames over 100 000 bytes close the connection (previously up to ~100 MB). More than 8 clients get 503. An invalid `LOG_SERVER_PORT` stops the server (previously silently fell back to 3011). Requests without an `Origin` header are still accepted, because they come from non-browser tools on loopback.
2. **Worker `setSpeed`.** NaN or negative values get an error response (previously the simulation stalled silently). Valid values behave as before.
3. **Loader.** Hides only after the engine reports initialised. The previous hide-after-500 ms behaviour could show an uninitialised viewport. Fast initialisation looks the same as before.
4. **Food culling.** Food near the screen edge that was previously dropped is now drawn. Rendered size is unchanged.
5. **Dev HMR.** Uses the page's own port. The default setup is unchanged, because Docker maps `3000:3000`.
6. **Smoke harness.** Fails rather than killing a process on a busy port. The report is no longer written to `docs/` by default.
7. **CI.** Runs the stricter `check:strict` on every PR, and adds an audit job. PRs with new lint or knip findings will now fail.
8. **Dependencies.** `vite` 8.1.6 and `ws` 8.22.0. CSS output is the same size before and after the bump (74 508 bytes).
9. **Removed code.** `ParticleSystem`, `OrganismShader.ts`, `ParticlePool`, three barrel files, the `LOADING_DELAY` constant, `Translations`, and unused types. None had a consumer in the repo.
10. **Seed.** `f3d5007` makes a seed passed to the engine constructor reach the RNG. When no seed is passed, behaviour is unchanged.

Not changed, but worth knowing: `resourceScale` (a user setting) changes only the rendered food size. Bite range and collisions still use the model radius. That may be intended. It is a product decision and is recorded as debt.

## Open items

Each item has evidence. Priority is P0 (blocks merging safely), P1 (blocks refactoring), or P2 (hygiene).

### Blocked

1. **P0 — Branch protection is not effective.** Evidence: `gh api repos/dogmator/entropia/rulesets/17666581` returns `"include": ["refs/heads/mian"]`, with only `deletion` and `non_fast_forward` rules. Classic `branches/main/protection` returns 403 for this token, so it could not be read. Owner action: correct the ref to `refs/heads/main`, add a required status check `Verification` (strict), and require a pull request. No settings were changed in this pass.
2. **P1 — Dev-toolchain advisories.** Evidence: `pnpm audit --json` reports 4 critical and 43 high. Critical sources: `vitest@2.1.9` (needs ≥3.2.6), `tinypool`, `shell-quote`. High sources include `vite@5.4.21`, which Vitest pulls in, and `rollup`, `postcss`, `nanoid`, `picomatch`, `minimatch`, `js-yaml`, `flatted`, `form-data`, `braces`, and `browserslist`. Blocked on a major Vitest upgrade. Production tree: 0 high or critical.
3. **P1 — Two Vite versions in the tree.** Evidence: `pnpm why vite` shows `vite@8.1.6` at the root and `vite@5.4.21` under Vitest 2. Plugins and config may drift. Resolved by the Vitest upgrade.
4. **P1 — Dependency-cruiser and PostCSS configs stay JavaScript.** Evidence: see *Tooling* above. Documented exceptions, not migrations. Re-check when dependency-cruiser or Vitest adds TypeScript config support.
5. **P1 — Browser smoke is not in CI.** Evidence: `@playwright/test@1.64.0` expects `chromium-1248`, but the sandbox has `chromium-1194`. Running in CI needs `playwright install`. The suite passed locally with `SMOKE_CHROMIUM_PATH=/opt/pw-browsers/chromium` (10/10).

### Technical debt

6. **P1 — Global RNG stream** (`src/core/utils/Random.utils.ts`). Two engines in one realm interfere. Pinned by `Determinism.test.ts`. Fix: a per-engine RNG. This is architectural, so it is out of scope here.
7. **P1 — The seed is not reachable from the UI.** Evidence: `grep -rn seed src` shows the worker always constructs `new SimulationEngine(scale)`. A run cannot be replayed from the URL or the UI. Persistence restores the seed from saved state.
8. **P2 — `resourceScale` affects only rendering.** See *Behavioural changes*. Needs a product decision.
9. **P2 — Coverage 53.27%** against a long-term target of 80%. Thresholds kept at 44/54/74/44.
10. **P2 — Vite bundle warning.** Evidence: build reports `three-core` at 737 kB, above the 600 kB limit. The limit is in `vite.config.ts`, and code splitting is not done.
11. **P2 — Dev server binds `0.0.0.0`** (`vite.config.ts`, `SERVER_CONFIG.host`), which exposes the app on the LAN during development. Kept for Docker. Residual risk.
12. **P2 — Diagnostic server has no authentication on loopback.** Origin checks stop browser pages, not local processes. A local process can write to `remote_debug.log`. Residual risk, documented in `docs/DEVELOPMENT.md`.
13. **P2 — Stale tracked smoke report.** `docs/cycles/logger-payloads/smoke-report.md` is a historical artefact from the old run. Left unchanged on purpose.
14. **P2 — Tracked CI action versions** (`actions/checkout@v7`, `pnpm/action-setup@v6`, `setup-node@v7`) are not pinned to commit SHAs. Dependabot will propose updates weekly.

## Verification performed

- Local `pnpm run check:strict` and `pnpm run check`: PASS.
- Fresh clone of the branch, `pnpm install --frozen-lockfile` then `pnpm run check:strict` on Node 22.22.0: PASS.
- `pnpm run audit:prod`: PASS.
- `pnpm run test:smoke` with `SMOKE_CHROMIUM_PATH=/opt/pw-browsers/chromium`: 10/10 PASS. Tracked docs unchanged. No processes left behind.
- GitHub Actions has not run for this branch yet. The clean-clone run is the closest local equivalent.
