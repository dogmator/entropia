# PLAN-FOOD-001 — Execution Plan for SPEC-FOOD-001

**Status:** draft of the corrected plan for local agreement.
**Decisions D-01…D-06:** architecturally selected in [FOOD-ADR-001](./architecture-contract.md).
**Implementation permission AUTH-01:** not received.
**Implementation:** not started.
**Review-comment verification:** [review-verification.md](./review-verification.md).
**Date:** 2026-10-25.
**Specification:** [specification.md](./specification.md).

**Publication:** PROHIBITED until the English translation is complete and approved.

## 1. Execution Conditions

Work only in `~/projects/entropia`.

Do not create additional Git worktrees.

Do not modify existing uncommitted files without analysis.

Do not begin implementation without separate permission.

Separate food target selection from the food budget.

Do not change physics without separate agreement.

Show changes before committing.

Request permission before every commit.

Do not perform push, PR, or merge without separate permission.

Translate all published documents into English.

Verify the English translation before publication.

Obtain the operator's permission to publish after the translation is verified.

## 2. Stage Plan

The current architectural choice D-01…D-06 is defined in [FOOD-ADR-001](./architecture-contract.md).

M0 remains unexecuted; approval of the architecture is not evidence of M0.

| Stage | Entry conditions | Result | Objective completion criterion | Status |
|---|---|---|---|---|
| M0 | Requirements of SPEC-FOOD-001. | Baseline evidence and decision proposals. | Measurements, baseline, and six decision records are saved. | Not started |
| D-01 | M0 evidence. | Path criterion approved. | Owner, approval date, and criteria are specified. | Architecturally selected; AUTH-01 and M0 required |
| M1 | M0 complete; D-01 approved. | Accessibility contract and regression tests. | The old defect is reproduced; the contract is verified by tests. | Blocked by M0 and AUTH-01 |
| M2 | M1 complete; D-01 approved. | Food target selection fixed. | FOOD-T01…FOOD-T04 and FOOD-T08 pass. | Blocked by M1 |
| D-02, D-03, D-04, D-06 | M0 evidence; M2 results if needed. | Budget and migration approved. | Each decision contains a value, owner, and date. | Architecturally selected; AUTH-01, AUTH-03, and M0 required |
| M3 | D-02, D-03, D-04, D-06 approved. | `FoodBudgetPolicy` contract and its tests. | Formulas and import are verified without changing the target-selection mechanism. | Blocked by M0 and AUTH-01/03 |
| M4 | M3 complete. | Food budget implemented. | FOOD-T05…FOOD-T07 and FOOD-T12 pass. | Blocked by M3 |
| D-05 | Baseline M0 measurements. | Worker regression limit approved. | Thresholds and measurement conditions are recorded. | Architecturally selected; M0 baseline mandatory |
| M5 | M2 and M4 complete; D-05 approved. | Determinism and performance acceptance. | FOOD-T09…FOOD-T11, metrics P04/P05, and `check:strict` pass. | Blocked by M0, M2, and M4 |
| M6 | M5 complete. | Automated and manual architectural review. | All checks in Section 7 have PASS status. | Blocked by M5 |
| M7 | M6 complete. | Change package for the operator. | The operator reviewed the full diff and explicitly permitted a specific commit. | Blocked by M6 |

Execute M0 before implementation begins. Verify the selected D-03 quota with the M0 measurements.

Do not start M1 before D-01.

Do not start M2 before D-01.

Do not start M3 before D-03.

Do not start M3 before D-02, D-04, and D-06.

Do not start M5 before D-05.

Do not change physics within M2.

Do not implement Utility AI within M6.

## 3. M0 — Actions and Baseline Evidence

### 3.1. M0 Actions

- [ ] Save the source commit SHA.
- [ ] Save the source simulation configuration.
- [ ] Reproduce the local food target blocking on seed `1`.
- [ ] Reproduce the local food target blocking on seed `4242`.
- [ ] Measure the amount of food inside the oasis on seed `1`.
- [ ] Measure the amount of food inside the oasis on seed `4242`.
- [ ] Measure the amount of food inside the oasis on seed `3735928559`.
- [ ] Measure the amount of food outside the oasis on these seeds.
- [ ] Measure the `maxFood` fill level.
- [ ] Measure the food appearance rate.
- [ ] Measure the actual number of successful bites.
- [ ] Measure `targetSelectionMs` before changing code.
- [ ] Measure `workerTickMs` before changing code.
- [ ] Verify the external measurement method without changing sources.
- [ ] Verify that the file `BaselineFingerprint.test.ts` exists.
- [ ] Verify the six `RECORDED` values against the sources.
- [ ] Verify that the scripts `depcruise`, `check:dead-code`, `check:strict` exist.
- [ ] Verify the source of `maxOrganisms` for scale 1.
- [ ] Save the verification result in `review-verification.json`.
- [ ] Run `m0-measure.mjs`.
- [ ] Verify the absence of a self-driven loop in `engine.start()`.
- [ ] Verify the absence of registration in `spawnOrganism()`.
- [ ] Verify the absence of `getNearby()` inside `scanNeighbors()`.
- [ ] Verify the accuracy of `selectionCalls` relative to the number of living prey.
- [ ] Verify a nonzero number of samples for both metrics.
- [ ] Verify that p50 and p95 are finite.
- [ ] Save the probe result separately from the baseline.
- [ ] Save the baseline fingerprints per Section 6.
- [ ] Prepare experimental variants of `C_trapped` and `C_outer`.
- [ ] Save the results of each variant in JSONL.
- [ ] Fill in six separate decision records D-01…D-06.
- [ ] Pass the decision proposals to the operator.

### 3.2. Measurement Method Without Changing Sources

Use the external script `m0-measure.mjs` from the specification directory.

Run the script via Node.js from the repository root.

Load the source modules via the Vite SSR API `ssrLoadModule`.

Create a `SimulationEngine` with a fixed seed.

Measure `targetSelectionMs` via temporary wrappers of the `BehaviorSystem.scanNeighbors` instance and `GridManager.getNearby`.

Account only for `getNearby` calls from organism behavior.

Sum the neighbor-query time and the `scanNeighbors` time for `prey` organisms.

Measure `workerTickMs` around the synchronous call of `engine.update()`.

Do not include browser Worker message passing in `workerTickMs`.

Label the method `measurementMethod=ssr-instrumentation`.

Apply identical instrumentation to the baseline and the candidate.

Repeat measurements after execution warm-up.

Verify that each metric has a nonzero number of samples.

Save p50 and p95 in JSONL.

Do not interpret `workerTickMs` as browser Worker latency.

Do not modify source files for M0.

### 3.3. Objective Output of M0

Save a JSONL record for each experiment conducted.

Verify the presence of three seeds in the baseline measurements.

Verify the presence of `targetSelectionMs` and `workerTickMs`.

Verify `measurementMethod=ssr-instrumentation`.

Verify `selectionCallsMatchedPreyPerTick=true`.

Verify `startAdvancedTick=false`.

Verify `spawnOrganismRegistered=false`.

Verify `scanNeighborsCallsGetNearby=false`.

Verify the presence of `hardwareId` in the probe measurement report.

Verify a nonzero number of samples for both metrics.

Verify the validity of the p50 and p95 fields.

Verify that the baseline file exists.

Verify the six `RECORDED` values.

Verify that the three commands exist in `package.json`.

Verify `MAX_TOTAL_ORGANISMS=400` for scale 1.

Run `node docs/specs/food-accessibility-and-budget/verify-review.mjs preflight`.

Run `node docs/specs/food-accessibility-and-budget/m0-measure.mjs 4242 12 3`.

Verify `status=PASS` from `verify-review.mjs`.

Verify `measurementMethod=ssr-instrumentation`.

Do not treat the probe as full completion of M0.

Verify the presence of six decision proposals in the specification registry.

Verify the presence of an owner and registration date for each decision.

Verify the status "Not approved" for all decisions without operator permission.

Do not treat approval of D-01…D-06 as a condition for completing M0.

Use an external diagnostic script for M0 if needed.

Do not change sources when preparing the M0 measurements without separate permission.

### 3.4. Historical List of Decisions Before FOOD-ADR-001

D-01 defines the accessibility criterion before M1.

D-02 defines the `TrappedFood` classification before M3.

D-03 sets the numeric limit after the M0 measurements.

D-04 defines the handling of old worlds before M3.

D-05 sets the Worker time threshold before M5.

D-06 defines the persistence contract before M3.

Owner of each decision: Entropia operator.

Registration date of each decision: 2026-10-25.

Approval date of each decision: not specified.

Historical status of each decision: NOT APPROVED.

Current status: architecturally selected in [FOOD-ADR-001](./architecture-contract.md).

There is no permission to change code.

## 4. M1–M2 — Food Target Selection

### 4.1. Entry Conditions

Verify approval of D-01 before starting M1.

Verify the presence of M0 evidence.

### 4.2. Actions

- [ ] Add a test with accessible food nearby.
- [ ] Add a test with nearer inaccessible food.
- [ ] Add a test with two distant organisms.
- [ ] Add a test without accessible food.
- [ ] Add a test of an obstacle changing between ticks.
- [ ] Add a test of removal of the selected food.
- [ ] Verify the geometry for scale `0.5`.
- [ ] Verify the geometry for scale `1`.
- [ ] Verify the geometry for scale `2`.
- [ ] Define the `FoodAccessibilityPolicy` contract per decision D-01.
- [ ] Add a regression test for FOOD-R07.
- [ ] Add the FOOD-D02 check.
- [ ] Add the FOOD-D03 check.
- [ ] Wire `FoodAccessibilityPolicy` into target selection.
- [ ] Preserve the independence of `CollisionSystem`.
- [ ] Wire in a test `ActionSelectionPolicy`.
- [ ] Compare energy absorption before and after the change.

### 4.3. Acceptance

Confirm the selection of an accessible target on the re-evaluation tick.

Confirm the reset of an inaccessible target on the same tick.

Confirm food consumption by an independent organism.

Confirm stable selection on equal scores.

Confirm FOOD-T01…FOOD-T04.

Confirm FOOD-T08.

Compare `FoodCollisionRegion` and `CollisionSystem.isColliding()`.

Run `node docs/specs/food-accessibility-and-budget/collision-geometry-check.mjs`.

Save the result in `collision-geometry-smoke.json`.

Verify the `<` operator in both checks.

Record the difference in world size at scales `0.5` and `2`.

Do not accept FOOD-T08 when there is a discrepancy.

Agree on the physics fix separately.

## 5. M3–M4 — Food Budget

### 5.1. Entry Conditions

Verify approval of D-02 before starting M3.

Verify approval of D-03 before starting M3.

Verify approval of D-04 before starting M3.

Verify approval of D-06 before starting M3.

Use the M0 measurement results.

Do not defer obtaining D-03 to M3.

### 5.2. Actions

- [ ] Implement the `FoodBudgetPolicy` contract.
- [ ] Verify the equation `C_trapped + C_outer = maxFood`.
- [ ] Verify the recomputation of limits after increasing `maxFood`.
- [ ] Verify the recomputation of limits after decreasing `maxFood`.
- [ ] Verify rounding with an odd `maxFood`.
- [ ] Verify the boundary values `maxFood=0` and `maxFood=1`.
- [ ] Verify migration on decreasing `maxFood` per D-04.
- [ ] Add a test of the upper limit `C_trapped`.
- [ ] Add a test of the outer budget `C_outer`.
- [ ] Add a test of the total limit `maxFood`.
- [ ] Wire in `FoodSpawnStrategy.RANDOM`.
- [ ] Wire in `FoodSpawnStrategy.UNIFORM`.
- [ ] Wire in `FoodSpawnStrategy.CLUSTERED`.
- [ ] Wire in `FoodSpawnStrategy.OASIS_PREFERRED`.
- [ ] Preserve the ability to place food inside an anomaly.
- [ ] Add a check that budget rejection occurs before `ResourceStock` is charged.
- [ ] Verify the mode with `ResourceStock` disabled.
- [ ] Verify export and import.
- [ ] Apply the approved D-04 rule.
- [ ] Verify the absence of hidden food removal.

### 5.3. Acceptance

Confirm `N_trapped <= C_trapped` under regular admission.

Confirm `N_outer <= C_outer` under regular admission.

Confirm `N_trapped + N_outer <= maxFood` under regular admission.

Confirm the correctness of the limits after a `maxFood` change.

Confirm the rounding rule from D-03.

Confirm the D-02 classification in the presence of `Obstacle`.

Confirm the independence of the food budget from food target selection.

Confirm FOOD-T05…FOOD-T07.

Confirm FOOD-T12.

## 6. M5 — Evidence, Baseline, and Performance

### 6.1. Entry Conditions

Verify approval of D-05 before starting M5.

Verify completion of M2.

Verify completion of M4.

### 6.2. Baseline Fingerprint

Use `src/simulation/__tests__/BaselineFingerprint.test.ts` as the baseline source.

Use scale `1`.

Use commit `afad92b84c9b547802a5a785588ba112a1a05331` as the verified source of the current baseline.

Verify that the file exists in the source commit.

Verify the `RECORDED` values with the external command `verify-review.mjs preflight`.

The command checks six constants against the source commit.

The command does not execute the baseline tests.

Repeat this check before M5.

Apply `RECORDED` only to ticks `100` and `300`.

Treat ticks `600`, `1200`, and `2100` as observed points.

Save the fingerprints of the later ticks in JSONL without comparing to `RECORDED`.

Do not call the fingerprints of the later ticks an approved baseline.

Disable `ResourceStock`.

Use seeds `4242`, `1`, and `3735928559`.

Use ticks `100` and `300`.

Serialize `engine.exportState()` via `JSON.stringify`.

Exclude the `spawnTime` field via a replacer.

Compute `checksumOf` of the resulting string.

Compare the result with the original `RECORDED`.

| Seed | Tick 100 | Tick 300 |
|---|---|---|
| `4242` | `d33c81bd` | `ce63bed1` |
| `1` | `37f34d1d` | `ef5ec3c7` |
| `3735928559` | `b2ec13f5` | `50f4f152` |

These values are pinned by the existing test.

Do not modify `RECORDED` to make the test pass.

Save a new value under an expected behavior change separately.

Request permission to change the baseline.

### 6.3. Evidence Format

Use JSONL.

Planned path: `docs/specs/food-accessibility-and-budget/evidence/<run-id>.jsonl`.

Save one JSON record per checkpoint.

Specify `runId`, `variant`, `seed`, `commit`, `tick`.

Specify `config`, `worldSize`, `resourceStockEnabled`.

Include the key `maxOrganisms` in `config`.

Include the key `maxFood` in `config`.

Include the key `foodSpawnRate` in `config`.

Include the key `worldScale` in `config`.

Include the key `seed` in `config`.

Include the key `resourceStock` in `config`.

Include the key `foodStrategy` in `config`.

Include the key `organismStrategy` in `config`.

Verify the absence of missing `config` keys.

Store the value `null` only for a non-applicable key.

Specify `foodTotal`, `foodTrapped`, `foodOuter`.

Specify `foodSpawnRateObserved` and `foodSpawnRateFormula`.

Compute `foodSpawnRateObserved=spawnAccepted / sampledTicks`.

Count successful food creation events for `spawnAccepted`.

Store `sampledTicks` as the number of measured ticks.

Do not use `config.foodSpawnRate` in place of the measured rate.

Store the formula `spawnAccepted / sampledTicks` in every JSONL.

Specify `biteCount`, `energyAbsorbed`, `spawnAccepted`, `spawnDenied`.

Specify `targetSelectionMsP50` and `targetSelectionMsP95`.

Specify `workerTickMsP50` and `workerTickMsP95`.

Specify `fingerprint` for the control tick.

Specify `measurementMethod` and `hardwareId` for timing measurements.

Form `hardwareId` as the SHA256 of the platform, architecture, CPU, and Node.js version.

Store the first 16 hexadecimal characters of the SHA256.

Do not write the host name into `hardwareId`.

Do not store fabricated values in the absence of measurements.

Use `null` for a non-applicable metric.

Example record structure:

```json
{"runId":"example","variant":"baseline","seed":4242,"commit":"afad92b84c9b547802a5a785588ba112a1a05331","tick":100,"config":{"maxOrganisms":400,"maxFood":400,"foodSpawnRate":0.8,"worldScale":1,"seed":4242,"resourceStock":false,"foodStrategy":"oasis_preferred","organismStrategy":"ecological"},"worldSize":600,"resourceStockEnabled":false,"foodTotal":null,"foodTrapped":null,"foodOuter":null,"biteCount":null,"energyAbsorbed":null,"spawnAccepted":null,"spawnDenied":null,"sampledTicks":null,"foodSpawnRateObserved":null,"foodSpawnRateFormula":"spawnAccepted / sampledTicks","targetSelectionMsP50":null,"targetSelectionMsP95":null,"workerTickMsP50":null,"workerTickMsP95":null,"fingerprint":"d33c81bd","measurementMethod":"unmeasured","hardwareId":null}
```

Do not treat the example as a measurement.

### 6.4. Performance Methodology

Measure `targetSelectionMs` separately from `workerTickMs`.

Use the maximum population `maxOrganisms`.

Use `maxOrganisms=400` at scale `1`.

Obtain the value from `MAX_TOTAL_ORGANISMS` in `src/config/population.constants.ts`.

Verify the recomputation of the value via `src/config/world.config.ts`.

Verify `engine.config.maxOrganisms === 400` before measurement.

Verify the actual number of organisms during the load measurement.

Verify `engine.config.maxFood === 400` during the load measurement.

Use an identical configuration before and after the change.

Measure p50 and p95 for each metric.

Record the hardware and execution mode.

Record the number of repetitions.

Apply a separate D-05 threshold to `targetSelectionMsP95`.

Apply a separate D-05 threshold to `workerTickMsP95`.

Do not use a single threshold for both metrics without a separate decision.

Do not declare PASS without an approved D-05 threshold.

### 6.5. Runs

Use seeds `1`, `4242`, and `3735928559`.

Check tick `20`.

Check tick `100`.

Check tick `600`.

Check tick `1200`.

Check tick `2100`.

Repeat each seed.

Compare paired runs with the same initial state.

- [ ] Verify FOOD-T09…FOOD-T11.
- [ ] Verify export and import.
- [ ] Compare the baseline fingerprints.
- [ ] Run `pnpm run check:strict`.
- [ ] Perform the browser smoke test.
- [ ] Measure `targetSelectionMs` for FOOD-P04.
- [ ] Measure `workerTickMs` for FOOD-P05.
- [ ] Save the JSONL.
- [ ] Apply the approved D-05.

## 7. M6 — Verifiable SOLID, DRY, and Extension Criteria

### 7.1. Automated Checks

| ID | Criterion | Automated check | PASS condition |
|---|---|---|---|
| M6-A01 | Architectural layers. | `pnpm run depcruise`. | No dependency violations. |
| M6-A02 | Types and contracts. | `pnpm run typecheck`. | Exit code 0. |
| M6-A03 | Source quality. | `pnpm run lint`. | Exit code 0. |
| M6-A04 | No superfluous exports. | `pnpm run check:dead-code`. | Exit code 0. |
| M6-A05 | Interchangeability of strategies. | Vitest contract for two implementations of `ActionSelectionPolicy`. | Identical action shape. |
| M6-A06 | Separate organism state. | Vitest contract with two organisms. | No writes to another's state. |
| M6-A07 | Single budget. | Vitest contract of all four `FoodSpawnStrategy` values. | Identical budget decision for the same category. |
| M6-A08 | Single geometry. | Vitest contract at scales `0.5`, `1`, `2`. | Identical accessibility rule. |
| M6-A09 | Genome immutability. | `verify-review.mjs scope <baseline-ref> <dirty-manifest>`. | All protected files and genetic lines are unchanged. |
| M6-A10 | Limit on change composition. | `verify-review.mjs scope <baseline-ref> <dirty-manifest>`. | Only paths from `scope-policy.json` are changed. |
| M6-A11 | Full acceptance. | `pnpm run check:strict`. | Exit code 0. |

Define `<baseline-ref>` as the commit SHA before implementation.

Use `afad92b84c9b547802a5a785588ba112a1a05331` for the current state.

Save the SHA256 of all preceding uncommitted files before M1.

Save the list in `review-baseline-dirty.json`.

Obtain the operator's permission to exclude these files from the scope check.

Do not exclude a file if the saved SHA256 does not match.

Save the results of each test in the M6 log.

Use `scope-policy.json` as the single source of permitted files.

Use `verify-review.mjs scope` to check changed files.

Prohibit new modules outside `allowedExact` and `allowedPatterns`.

Prohibit new Utility AI modules.

Read the content of each new untracked file.

Check the content of untracked files for prohibited Utility AI markers.

Save `untrackedScanned` in the scope report.

Do not equate a file-name match with a content check.

### 7.1.1. Genome Files

Check all `genomeInventory` paths from `scope-policy.json`.

Compare the SHA256 of each genome file with the source commit.

Save `genome-sha256.json` with the comparison result.

Run `verify-review.mjs genome-sha256 <baseline-ref>`.

Save the list `baselineSha256`, `currentSha256`, and `status`.

Verify the integrity of each genome file.

Verify the diff of each changed genome file.

Verify changes to lines with the markers `genome`, `genetic`, `mutat`, `reproduc`, and `inherit`.

Do not limit the check to the file `src/types.ts`.

Genome file registry:

- `src/types.ts`
- `src/config/genetics.constants.ts`
- `src/config/reproduction.constants.ts`
- `src/simulation/Entity.ts`
- `src/simulation/MathUtils.utils.ts`
- `src/simulation/systems/Reproduction.system.ts`
- `src/simulation/services/Persistence.service.ts`
- `src/simulation/engine/Engine.ts`
- `src/simulation/engine/EngineProxy.ts`
- `src/simulation/engine/EntityQuery.service.ts`
- `src/simulation/interfaces/IPersistableEngine.ts`
- `src/simulation/interfaces/ISimulationEngine.ts`
- `src/simulation/WorkerMessages.ts`
- `src/simulation/services/Spawn.service.ts`
- `src/simulation/engine/TickLoop.service.ts`

Apply a full change lock to `genomeStrict`.

Check mixed files automatically by changed genetic lines.

Check mixed files manually by the full diff.

Treat a change in the SHA256 of `Persistence.service.ts` as a cause of the M6-A09 block.

Treat a change in the SHA256 of `Spawn.service.ts` as a cause of the M6-A09 block.

Treat a change in the SHA256 of `TickLoop.service.ts` as a cause of the M6-A09 block.

Request separate permission for changes to mixed genome files.

Do not treat the absence of genetic words in the diff as sufficient evidence.

Record the result of the manual analysis in the change package.

Do not treat a string check as proof of complete semantic immutability.

### 7.1.2. List of Permitted Files

Use `allowedExact` for fixed paths.

Use `allowedPatterns` for tests with restricted names.

Permit changes to `Behavior.system.ts` for food target selection.

Permit changes to `Spawn.service.ts` and `TickLoop.service.ts` for the food budget.

Permit changes to `Persistence.service.ts` for the food budget only after separate agreement.

Verify the genetic serialization of `Persistence.service.ts` before the change.

Verify the genetic serialization of `Persistence.service.ts` after the change.

Verify the SHA256 of `Persistence.service.ts` before the change.

Verify the SHA256 of `Persistence.service.ts` after the change.

Treat a SHA256 change as an obstacle to M6-A09 until separate permission is granted.

Permit new `FoodAccessibility`, `FoodBudget`, and `ActionSelection` contracts.

Reject files outside `scope-policy.json`.

Request separate permission to extend `scope-policy.json`.

Verify the absence of new Utility AI modules in the script report.

Save the JSON report of `verify-review.mjs scope`.

Save the manual verification result for mixed files.

Do not treat text search as the sole evidence of the absence of Utility AI.

### 7.2. Manual Review

Verify the single responsibility of each changed component.

Verify the absence of duplication of the geometric rule.

Verify the absence of duplication of the food budget.

Verify the absence of coupling between `SpawnService` and `ActionSelectionPolicy`.

Verify the absence of coupling between `CollisionSystem` and `FoodBudgetPolicy`.

Verify the absence of changes to the genetic factory.

Verify the contract of future heritable parameters without implementing them.

Do not accept M6 if an automated check fails.

## 8. Acceptance Evidence Matrix

| ID | Method | Expected result | Required evidence |
|---|---|---|---|
| FOOD-T01 | Integration test | Accessible food is consumed. | Bite, energy, tick, food ID. |
| FOOD-T02 | Contract test | Accessible food is selected. | Target ID; `REACHABLE` result. |
| FOOD-T03 | Contract test | An inaccessible target is reset in the absence of other actions. | `BLOCKED` or `UNKNOWN`; `IDLE` state. |
| FOOD-T04 | Paired integration test | A distant organism consumes food independently. | Energy of both organisms; independent targets. |
| FOOD-T05 | Budget test | At `N_trapped=C_trapped`, outer food is admitted while `C_outer` is free. | Budget remainders; spawn decision. |
| FOOD-T06 | Budget test | At `N_trapped+N_outer=maxFood`, a new object is not admitted. | Object count before and after the attempt. |
| FOOD-T07 | Import test | After restoration, the same budget constraints apply. | Snapshot before export and after import. |
| FOOD-T08 | Geometry test | The actual `worldSize` is used. | Scale, coordinates, result. |
| FOOD-T09 | Long run | Spawning is possible with a free outer budget. | Spawn counters by tick. |
| FOOD-T10 | Repeated seed | Results of identical runs match. | Fingerprints at control ticks. |
| FOOD-T11 | Contract test | The test policy returns `food_out`; execution is identical. | Target ID; physics state after execution. |
| FOOD-T12 | `ResourceStock` test | Budget rejection does not spend units; a permitted spawn accounts for the expenditure. | `zoneStocks`, `unitsSpent`, `RESOURCE_STOCK_UNITS_PER_FOOD`. |

Save the measurement values in the JSONL of Section 6.

Do not mark a test as PASS without actual evidence.

## 9. Separate Physics Defect

Diagnostics revealed a toroidal collision error at a non-standard `worldSize`.

`Collision.system.ts` uses the default world size in `isColliding()`.

Do not fix this error within the food budget.

Agree on the physics change separately.

## 10. Pre-Commit Verification

1. Show the full list of changed files.
2. Show the diff of each proposed file.
3. Show the results of the checks.
4. Show the result of the architectural review.
5. State the exact composition of the proposed commit.
6. Request the operator's permission.
7. Perform the commit after explicit permission.

8. Translate public documentation into English before publication.

9. Verify the translation against the working original.

10. Obtain separate permission for public publication.

Do not include unrelated local changes.

Do not run `git add` before the commit composition is agreed.

Do not treat approval of the requirements as permission to commit.

### 10.1. Change Package Format

Save the full diff in `review/full.patch`.

Use `git diff --binary --full-index` for tracked files.

Use `git diff --no-index --binary /dev/null <file>` for new files.

Save the file names in `review/files.txt`.

Save the SHA256 of each file in `review/checksums.sha256`.

Save the test results in `review/tests.txt`.

Save the operator's decision in `review/approval.md` after approval.

Verify the correspondence between `full.patch` and `files.txt`.

Do not include changes outside the approved composition.

Do not run `git add` when preparing the package.

### 10.2. Self-Verification Commands

Run the structural check of the 61 requirement IDs:

The command checks the number of IDs and the absence of duplicates.

The command does not check the meaning of the requirements.

Verify the semantics of a requirement via the corresponding test FOOD-T01…FOOD-T12.

Conduct manual review of the untestable requirements FOOD-A01…FOOD-A14.

```bash
node docs/specs/food-accessibility-and-budget/verify-review.mjs preflight
```

Save the verification result:

```bash
node docs/specs/food-accessibility-and-budget/verify-review.mjs preflight > docs/specs/food-accessibility-and-budget/review-verification.json
```

Run the change-composition check before M6:

```bash
node docs/specs/food-accessibility-and-budget/verify-review.mjs scope afad92b84c9b547802a5a785588ba112a1a05331 docs/specs/food-accessibility-and-budget/review-baseline-dirty.json
```

Do not claim scope PASS before M6.

Run the SHA256 comparison of all genome files:

```bash
node docs/specs/food-accessibility-and-budget/verify-review.mjs genome-sha256 afad92b84c9b547802a5a785588ba112a1a05331
```

Account for existing uncommitted changes per the agreed manifest.

Do not publish the Russian documentation in the public repository.

## 11. Current State

SPEC-FOOD-001 approves the requirements.

D-01…D-06 are architecturally selected under FOOD-ADR-001; implementation requires AUTH-01.

Implementation is not started.

Next step: agree on AUTH-01 and complete M0.

Before M1, the M0 results and the AUTH-01 permission are required.

See [specification.md](./specification.md).
