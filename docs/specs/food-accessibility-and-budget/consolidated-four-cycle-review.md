# FOOD-RECON-001 — Reconciliation of Four Entropia Studies

**Status:** draft consolidated conclusion.
**Date:** 2026-10-25.
**Decision owner:** Entropia operator.
**Decisions D-01…D-06:** not approved at the time of the study; later architecturally selected in [FOOD-ADR-001](./architecture-contract.md).
**Decision on changing physics:** NOT APPROVED.
**Execution:** this document does not authorize implementation.
**Source HEAD:** `b896714afc0473454256aa796acf3fe65a1e12aa`.
**Comparison source commit:** `afad92b84c9b547802a5a785588ba112a1a05331`.
**Specification:** [specification.md](./specification.md).
**Plan:** [execution-plan.md](./execution-plan.md).
**Original language:** Russian.
**Publication:** PROHIBITED until the English translation is complete and approved.

## 1. Purpose

Use this document as the input package for the next developer.

Read the specification as the source of approved requirements.

Read this document as the source of research findings and operator questions.

Do not treat a proposal in this document as an approved decision.

Do not modify sources until permission for implementation is received.

Do not change the physics rules as part of the food budget change.

Preserve the ability to place food inside impassable anomalies.

Preserve compatibility of the future `ActionSelectionPolicy` with the evolution of behavior.

## 2. Source Registry and Limits of Evidence

All four primary reports are located in the local directory `.tmp/food-four-cycle/`.

The `.tmp/` directory is excluded from Git.

Do not assume these reports are available after cloning the public repository.

Use this document as a self-contained description of the main findings.

Re-run the experiments from the scripts if the primary reports are unavailable.

| ID | Study | Local file | SHA256 |
|---|---|---|---|
| S1 | DeepSeek: food accessibility | `.tmp/food-four-cycle/01-deepseek-reachability.md` | `f843a5861ec6a73f9b7ea575f18acc09132a7341c874388af0f32c354188bfb9` |
| S2 | Gemini: food budget | `.tmp/food-four-cycle/02-gemini-budget.md` | `6540615d0bbb1691432fd0a29b410a95c57a90266ef75bed515adbf984f62724` |
| S3 | DeepSeek: budget audit | `.tmp/food-four-cycle/03-deepseek-budget-audit.md` | `d45feac494fe20f2fe1ef22435ddb51c0d299fa9510fe9893d4ed3d062b85b77` |
| S4 | Gemini: accessibility audit | `.tmp/food-four-cycle/04-gemini-reachability-audit.md` | `9a97c10e96d6f5e4d1add78ca1dbb48c6dead4cf9d429eeeee24b8537d8bd839` |

The repeat audit of S3 used scripts from `.tmp/food-four-cycle/03-audit-harness/`.

Use `CONFIRMED` for a fact backed by source code and a reproduced experiment.

Use `SOURCE_CONFIRMED` for a fact verified by reading the source code.

Use `EXPERIMENT_REPORTED` for an agent's result without our independent run.

Use `CONTRADICTED` for a refuted claim.

Use `UNVERIFIED` for a hypothesis without sufficient measurements.

Use `PROPOSAL` only for a recommendation without operator permission.

Do not equate an analytical time estimate with a time measurement.

## 3. Decision for the Developer Before Work Begins

**Outcome:** the four cycles are useful, but their initial recommendations cannot be accepted unconditionally.

**P0:** food target selection does not account for reachability.

**P0:** inaccessible food consumes the global `maxFood` limit.

**P0:** the current steering does not execute a geometric detour route.

**P0:** when `maxFood` is reduced, an old world may lose the ability to spawn new food.

**P0:** at a scale other than 1, the toroidal bite geometry uses the wrong world size.

**P1:** the current load script does not fill the food budget to the maximum.

**P1:** the M6-A09 check blocks changes to genome files even without a change in genetic semantics.

**P1:** import may discard food before the initial energy balance is restored.

Keep D-01…D-06 open until a direct operator decision.

## 4. Verified Findings and Refutations

### 4.1. Food Target Selection

| ID | Observation | Status | Basis |
|---|---|---|---|
| E01 | `BehaviorSystem` selects the nearest food without checking the route. | SOURCE_CONFIRMED | `src/simulation/systems/Behavior.system.ts:70–104,131–134`; S1 `2.2` |
| E02 | `CollisionSystem` restricts movement through zone spheres. | SOURCE_CONFIRMED | `src/simulation/systems/Collision.system.ts:98–159`; S1 `2.3` |
| E03 | Food spawning is permitted in an oasis. | SOURCE_CONFIRMED | `src/simulation/services/Spawn.service.ts:262–272,426–434`; S1 `2.3` |
| E04 | `isColliding` uses a size of 600 instead of the actual `worldSize`. | CONFIRMED | `src/simulation/systems/Collision.system.ts:322–326`; `collision-geometry-smoke.json` |
| E05 | The proposed D-01-B detour does not control the organism's actual movement. | EXPERIMENT_REPORTED | S4 `3.1,3.4`; `Behavior.system.ts:79–83` |
| E06 | A detour in the plane of three collinear points is not uniquely defined. | SOURCE_CONFIRMED | S4 `3.2`; three-dimensional space geometry |
| E07 | Multi-sphere obstacles admit routes outside any single chosen plane. | SOURCE_CONFIRMED | S4 `3.3,3.5` |
| E08 | A direct path with a check of the open bite region is simpler than D-01-B. | PROPOSAL | S4 `14.1` |

The S4 counterexample uses an obstacle centered at `(130,300,300)` with radius 20.

The food is at `(156,300,300)` or `(160,300,300)`.

S4 reports no bites over 400 ticks under these conditions.

`deflectObstacle` uses the repulsion zone `R_obs + r_org + 25`.

`steer` normalizes the repulsion force.

Study S4 gives a repulsion weight of 12 and a target-seeking weight of 3.5.

Do not declare food `REACHABLE` solely on the basis of the existence of a geometric arc.

Do not introduce D-01-B without a mechanism for executing a `Waypoint`.

Do not declare `BLOCKED` when there is no direct path unless a detour has been excluded.

### 4.2. Food and Bite Geometry

| ID | Observation | Status | Basis |
|---|---|---|---|
| E09 | The initial food radius is 2. | SOURCE_CONFIRMED | `src/config/rendering.constants.ts:243` |
| E10 | S2 states a food radius of 1.5. | CONTRADICTED | S2 `4.2`; S3 `3.2`; E09 |
| E11 | The boundary of the unreachable core of a single sphere of radius 90 is 88. | SOURCE_CONFIRMED | `R_oasis - FOOD_RADIUS = 90 - 2` |
| E12 | After the first bite of food with energy 60, the radius is 1.625. | SOURCE_CONFIRMED | `src/simulation/Entity.ts:114–137`; S3 `3.2` |
| E13 | At a distance of 89.25 from the oasis center, the food can be fully eaten. | EXPERIMENT_REPORTED | S3 `3.2`, experiment E9 |
| E14 | `FoodCollisionRegion` and `isColliding` use a strict comparison of the distance with the sum of the radii. | SOURCE_CONFIRMED | `specification.md` `2.1`; `Collision.system.ts:322–326` |

For a single sphere, use the boundary `d <= R_oasis - r_food` only when the world geometry matches.

Do not carry over the numeric boundaries of S2 without recomputing from radius 2.

Do not treat all food inside an oasis as completely inedible.

Apply the actual radius of the specific food object when checking a bite.

Do not mix the food budget classification with the reachability for a specific organism.

### 4.3. Budget, Resource, and Import

| ID | Observation | Status | Basis |
|---|---|---|---|
| E15 | Regular spawning stops when `food.size >= maxFood`. | SOURCE_CONFIRMED | `src/simulation/engine/TickLoop.service.ts:198–206` |
| E16 | `ResourceStock` receives admission after the food position is selected. | SOURCE_CONFIRMED | `Spawn.service.ts`; `TickLoop.service.ts`; S2 `5.3` |
| E17 | The initial world construction does not create food at tick 0. | SOURCE_CONFIRMED | S2 `2.1`; `Engine.ts`; `EnvironmentBuilder.builder.ts` |
| E18 | There are regular spawning, emergency spawning, and snapshot import. | SOURCE_CONFIRMED | `TickLoop.service.ts:185–206`; `Persistence.service.ts:471–496` |
| E19 | On import, some food may disappear without an entry in `energyRemoved`. | SOURCE_CONFIRMED | `Persistence.service.ts:475–501`; S3 `7.2` |
| E20 | `ResourceStock` is not debited twice on the current regular path. | EXPERIMENT_REPORTED | S3 `6.1`, experiment E6 |
| E21 | `ResourceStock.zoneAt` uses a non-toroidal position classification. | SOURCE_CONFIRMED | `ResourceStock.service.ts:59–72`; S3 F20 |
| E22 | S2 uses an incorrect range for the user-facing `maxFood`. | CONTRADICTED | S3 F10; `GeneralSettings.tsx:36` |
| E23 | In the UI, `maxFood` is set in the range 50–2000 with a step of 50. | SOURCE_CONFIRMED | `src/ui/components/settings/GeneralSettings.tsx:36` |
| E24 | `maxFood` can become invalid via a non-UI path. | CONFIRMED | `03-audit-harness/audit-fractional.mjs`; separate run |
| E25 | The existing `m0-measure.mjs` measures 400 organisms without initially populating food. | SOURCE_CONFIRMED | `m0-measure.mjs`; S4 `10.1` |

On import, verify each food object before applying the budget policy.

Do not treat a closed energy ledger as proof of the absence of losses on import.

Check the budget policy before calling `ResourceStock.admitFoodAt`.

Do not spend `ResourceStock` when the food budget rejects.

Do not fix `ResourceStock.zoneAt` without separate agreement.

### 4.4. Experimental Results

| ID | Experiment | Result | Status |
|---|---|---|---|
| X01 | Oasis; seed 1/4242/3735928559; tick 1200; `maxFood=400` | 170 / 174 / 189 objects inside. | EXPERIMENT_REPORTED, S2 and S3 |
| X02 | 5% quota; M-1; seed 3735928559; tick 2100 | 324 prey / 65 predators. | EXPERIMENT_REPORTED, S3 `14` |
| X03 | 10% quota; M-1; same seed and tick | 99 prey / 132 predators. | EXPERIMENT_REPORTED, S3 `14` |
| X04 | Removal of inaccessible food after tick 600 | Outer spawns 95 → 222; prey 4 → 50. | EXPERIMENT_REPORTED, S3 `8` |
| X05 | Moving food outward instead of removing it | Prey reach 125 in the stated control scenario. | EXPERIMENT_REPORTED, S3 `8` |
| X06 | `maxFood=100` with 115 objects inside | 0 new spawns over 1000 ticks. | EXPERIMENT_REPORTED, S3 `4.2` |
| X07 | M-1 on three seeds | S2 results reproduced by S3 down to the unit. | Cross-check |
| X08 | M-2 under the same conditions | S2 results not reproduced by S3. | CONTRADICTED |
| X09 | Collisions at scales 0.5 / 1 / 2 | Actual false / true / false; expected true / true / true. | CONFIRMED |
| X10 | Load with a full food budget | S4 reports `targetSelectionMsP95` rising 11.15 → 14.25 ms. | EXPERIMENT_REPORTED |
| X11 | Load with a full food budget | S4 reports `workerTickMsP95` rising 14.76 → 18.09 ms. | EXPERIMENT_REPORTED |

Do not draw conclusions about robustness across all seeds from three experimental seeds.

Do not use X10 and X11 as universal performance limits.

Repeat the performance profile on the same hardware for the original and the new code.

## 5. Principal Contradictions Among the Four Studies

| ID | Initial proposal | Refutation or limitation | Consolidated conclusion |
|---|---|---|---|
| C01 | S1: D-01-B ensures reachability past a single sphere. | S4: the current steering ignores `Waypoint`. | Do not choose D-01-B for M1/M2 without navigation. |
| C02 | S2: food radius 1.5. | S3: the code uses radius 2. | Recompute the D-02 geometry. |
| C03 | S2: M-2 delivers the stated figures. | S3: an independent implementation did not reproduce the figures. | Do not accept M-2 without a precise contract. |
| C04 | S2: D-04-A is sufficient for old worlds. | S3: overflow blocks spawning for 1000 ticks. | A separate overflow contract is needed. |
| C05 | S2: D-06-A passes M6-A09 without exceptions. | S3: `Spawn` and `TickLoop` are part of `genomeInventory`. | A special permission for mixed files is required. |
| C06 | S2: a stateless budget is compatible with O(1). | S3: a full recount of food has O(N) cost. | Measure the recount before choosing a cache. |
| C07 | S1: checking the geometric detour is sufficient. | S4: the executor moves toward the direct target. | Separate geometry from executability. |
| C08 | S4: a direct corridor provides a cheap check. | The 0.2–0.4 ms cost has not been measured for a finished implementation. | Treat the cost as a hypothesis. |
| C09 | The current specification requires FOOD-T08 at three scales. | E04 proves a physics defect at two scales. | Isolate a separate blocking defect. |

Do not resolve a disagreement by choosing the agent's more confident wording.

Require a reproducible test for each disputed behavior.

## 6. Mandatory Semantic Contract

### 6.1. Separation of Domain Concepts

`AnomalyFood` — the proposed name of the budget category of food inside the region per D-02.

`TrappedFood` — the name of the budget category in the current specification.

`ReachableFood` — the individual result of a path check for a specific organism.

`GeometricAccessibility` — the existence of a valid geometric path.

`MovementFeasibility` — the ability of the current movement model to execute the path.

`FoodCollisionRegion` — the region of positions permitting collision with the food.

Do not rename `TrappedFood` without approval of D-02.

Use `AnomalyFood` only as a proposal for a terminology change.

Do not derive `ReachableFood` from membership in a budget category.

Do not call a geometric detour successful without proven execution.

### 6.2. Possible Accessibility Results

`REACHABLE` is permitted only for a target with a verified execution route.

`BLOCKED` is permitted only when the absence of a valid route is proven.

`UNKNOWN` applies when the proof of the path or its execution is incomplete.

`UNKNOWN` and `BLOCKED` are equally excluded from selection of the current food target.

Preserve distinct reasons for these results for the future Utility AI.

Do not create a new global intelligence manager.

Do not change the genome format at the nutrition-fix stage.

## 7. Decision Package D-01…D-06

The recommendations in this section do not change the status of the decisions.

A separate operator action is required to approve each recommendation.

### 7.1. D-01 — Food Target Accessibility

| Option | Composition | Risk | Assessment |
|---|---|---|---|
| A | Direct path only. | False `BLOCKED` behind an obstacle. | Do not accept without correct `UNKNOWN` semantics. |
| A+ | Direct corridor to the open part of the bite region. | Possible error due to actual steering. | Preferred pilot. |
| B | Direct path and a detour around one sphere. | `Waypoint` is not executed. | Not recommended for the current physics. |
| C | Bounded pathfinding. | Additional cost and complexity. | Defer. |

**PROPOSAL D-01:** use A+ as the basis for M1/M2.

Check the openness of the bite region with the actual food radius.

Check the direct corridor against all significant obstacles.

Account for the repulsion force of an ordinary `Obstacle`.

Return `UNKNOWN` when a detour exists without an available execution mechanism.

Return `BLOCKED` only when overlap of the bite region is proven.

Do not change steering when implementing the first contract.

**Blocker:** S4 did not prove the full sufficiency of A+ for every movement state.

**Operator decision:** ___

**Approval criterion:** an executable criterion for `REACHABLE` is recorded.

### 7.2. D-02 — Food Budget Category

| Option | Rule | Risk |
|---|---|---|
| A | Food center inside the `ZoneType.OASIS` sphere. | Some fully edible edge food is counted as a budget category. |
| B | Food center inside the core `R_oasis - r_food`. | A partially edible remainder may occupy the outer budget. |
| C | Sphere with an additional buffer. | Excessive reservation of the inner budget. |

**PROPOSAL D-02:** use A for the experimental budget.

Treat this as a placement category, not as individual inaccessibility.

Define the behavior for multiple `OASIS` spheres.

Define the behavior for ordinary `Obstacle` entities.

Define the handling of sphere intersections and toroidal boundaries.

Use a single classifier for spawning and accounting.

Do not use the former numeric boundaries of 88.5.

**Operator decision:** ___

**Approval criterion:** all classification regions are enumerated.

### 7.3. D-03 — Food Budget

| Option | At `maxFood=400` | Risk | Assessment |
|---|---|---|---|
| A / M-1 | `C_trapped=20`; `C_outer=380`. | Less food inside the oasis. | Preferred pilot. |
| B / M-1 | `C_trapped=40`; `C_outer=360`. | More trapped energy. | Alternative. |
| C / M-2 | Position re-selection when the budget is full. | Non-reproducible contract. | Do not accept. |
| D / M-3 | Borrowing capacity. | Violation of the approved independent reserve. | Do not accept. |

**PROPOSAL D-03:** trial a hard 5% quota.

Use `C=floor(maxFood)` only after verifying a finite non-negative value.

Compute `C_trapped=floor(0.05*C)`.

Compute `C_outer=C-C_trapped`.

Prohibit transfer of free capacity between budgets in the pilot.

Verify the `maxFood` value before computing the limits.

Verify dynamic changes to `maxFood`.

Account for the absence of an inner quota at `C<20`.

Do not treat 5% as a proven optimum for all seeds.

Test horizons from 5000 ticks on all four spawn strategies.

**Operator decision:** ___

**Approval criterion:** quotas, rounding, and the small-world rule are specified.

### 7.4. D-04 — Old Worlds and Limit Reduction

**Confirmed conflict:** an old world may contain more food than the new `maxFood`.

When `N_trapped >= maxFood`, the available outer budget may remain without spawning.

It is impossible to simultaneously guarantee preservation of all objects, a new hard limit, and immediate outer spawning.

| Option | Rule | Risk |
|---|---|---|
| A | Preserve food; prohibit new objects on overflow. | Possible prolonged spawn stoppage. |
| A+ | Preserve food; do not allow a dangerous reduction of `maxFood`. | A configuration-change contract is required. |
| B | Deterministically remove excess food. | Loss of energy and changes to snapshots. |
| C | Reject an incompatible import. | Violation of backward compatibility. |

**PROPOSAL D-04:** use A+ for the active world.

Define the behavior when loading an old snapshot with an exceeded limit.

Do not delete existing food automatically.

Do not reject an old snapshot without a compatibility decision.

Separate the violation of the existing state from the rules for admitting new food.

Agree on how to display the reason for rejecting a `maxFood` change.

**Operator decision:** ___

**Approval criterion:** the active world, import, and overflow are defined.

### 7.5. D-05 — Performance

**PROPOSAL D-05:** use two independent thresholds as candidate values.

| Metric | Proposed limit | Status |
|---|---:|---|
| `targetSelectionMsP95` | Regression of no more than 25%. | PROPOSAL |
| `workerTickMsP95` | Regression of no more than 15%. | PROPOSAL |

Perform three runs of each test profile.

Use 15 warm-up ticks.

Measure 60 ticks after warm-up.

Compare results on the same `hardwareId`.

Measure the ordinary spawn profile.

Measure a separate profile at `food.size=400`.

Verify the number of living organisms before each tick.

Record p50 and p95 for both metrics.

Do not use the current `m0-measure.mjs` as proof of peak load.

Do not accept thresholds without measurements of the full food load.

**Operator decision:** ___

**Approval criterion:** both metrics, the test bench, repetitions, and thresholds are approved.

### 7.6. D-06 — State Persistence

| Option | Rule | Risk |
|---|---|---|
| A | Compute the budget from the configuration and world state. | O(N) cost of a full recount. |
| B | Add a serialized budget block. | A second source of truth and schema migration. |

**PROPOSAL D-06:** use A as the logical model.

Do not store duplicate quotas in the snapshot.

Do not declare the food recount an O(1) operation.

Measure the recount cost at `maxFood=400` and `maxFood=3200`.

Use a cache only after a separate measurement.

Invalidate the cache on import, removal, addition, and geometry change.

Invalidate the cache on a `maxFood` change.

Verify preservation of the genetic state on import.

Do not modify `Persistence.service.ts` without separate M6-A09 agreement.

**Operator decision:** ___

**Approval criterion:** the source of truth and the recount contract are defined.

## 8. Independent Blocking Issues

### 8.1. PHY-01 — Toroidal Collision Geometry

`CollisionSystem.isColliding()` uses a default world-size argument.

At `scale=0.5`, the expected collision does not match the actual one.

At `scale=2`, the expected collision does not match the actual one.

The `FOOD-T08` scenario remains blocked.

Do not fix `PHY-01` within the food budget task.

Request permission for a separate physics change.

### 8.2. IMP-01 — Food Losses on Import

`PersistenceService.importState` filters food before computing the initial energy balance.

Compare the energy content of the snapshot before and after import.

Verify that a warning is emitted for discarded objects.

Preserve the evidence of the energy change.

Do not change the snapshot migration without the D-04 and D-06 decisions.

### 8.3. RES-01 — Toroidal Classification in `ResourceStock`

`ResourceStock.zoneAt` uses Euclidean distance.

The environment geometry uses a toroidal world.

Record the zone discrepancy at the toroidal boundary.

Do not treat this as part of the approved budget implementation.

### 8.4. TICK-01 — Emergency Spawning

`TickLoop.applyFailsafe` resets `zeroFoodTicks` after a spawn attempt.

The attempt may fail to create a food object.

Verify the counter reset on budget rejection.

Do not change the failsafe without separate confirmation of the defect.

### 8.5. M6-01 — `genomeInventory` Constraints

`Spawn.service.ts`, `TickLoop.service.ts`, and `Engine.ts` are in the `genomeInventory` list.

A change to the SHA256 of these files blocks the current M6-A09.

This constraint applies even when genetic semantics are preserved.

Request a separate permission to modify the mixed files.

Verify the full diff of each permitted mixed file.

Verify the absence of changes to the genome and genome serialization.

Do not weaken the M6-A09 check covertly.

## 9. Workflow for the Next Developer

### G0 — Source Evidence

1. Verify HEAD and the working directory.
2. Read SPEC-FOOD-001.
3. Read PLAN-FOOD-001.
4. Verify the source of each significant finding.
5. Re-run the food selection regression scenario.
6. Re-run the budget overflow control scenario.
7. Verify `PHY-01`.
8. Verify the baseline format.
9. Record the initial set of metrics.
10. Present the discrepancies to the operator.

Do not modify sources in G0.

### G1 — Operator Decisions

1. Obtain the D-01 decision.
2. Obtain the D-02 decision.
3. Obtain the D-03 decision.
4. Obtain the D-04 decision.
5. Obtain the D-05 decision.
6. Obtain the D-06 decision.
7. Obtain a separate decision on PHY-01.
8. Obtain permission to modify mixed files.

Do not start M1 before the D-01 decision.

Do not start M3 before the D-02, D-03, D-04, and D-06 decisions.

Do not accept M5 before the D-05 decision.

Do not accept FOOD-T08 while PHY-01 is open.

### G2 — Minimal Implementation

1. Create a minimal `FoodAccessibilityPolicy` contract.
2. Add accessibility regression tests.
3. Implement the approved D-01 option.
4. Verify FOOD-T01…FOOD-T04.
5. Create a minimal `FoodBudgetPolicy` contract.
6. Add D-02 classification tests.
7. Implement the approved D-03 option.
8. Implement the approved D-04 overflow handling.
9. Verify `ResourceStock`.
10. Verify export and import.
11. Verify determinism.

Do not create a universal AI Framework.

Do not implement Utility AI at stage G2.

Do not change physics as a side effect of the budget.

### G3 — Architectural and Load Acceptance

1. Verify SOLID.
2. Verify DRY.
3. Verify isolation of organism state.
4. Verify replaceability of `ActionSelectionPolicy`.
5. Verify `targetSelectionMsP95`.
6. Verify `workerTickMsP95`.
7. Run `pnpm run check:strict`.
8. Perform a browser smoke test.
9. Verify `scope-policy.json`.
10. Verify all SHA256 values of `genomeInventory`.
11. Present the full diff to the operator.

Do not change baseline fingerprints without analysis.

Do not declare the change passed while blockers remain open.

## 10. Acceptance Evidence Matrix

| Check | Required fact | Basis for rejection |
|---|---|---|
| FOOD-T01 | Accessible food is consumed. | No bite occurs. |
| FOOD-T02 | Nearer inaccessible food is not selected. | The organism pursues an inaccessible target. |
| FOOD-T03 | The inaccessible target is reset. | The target is retained after the check. |
| FOOD-T04 | Another organism continues feeding. | Feeding depends on another's target. |
| FOOD-T05 | The outer budget retains capacity. | Inner food uses the outer reserve. |
| FOOD-T06 | New spawning does not exceed `maxFood`. | An excess object is admitted. |
| FOOD-T07 | The budget is preserved after import. | The admission policy changes. |
| FOOD-T08 | Geometry is correct at scales 0.5, 1, 2. | PHY-01 remains open. |
| FOOD-T09 | Outer spawning is possible with a free budget. | Old excess blocks spawning without an approved rule. |
| FOOD-T10 | The same seed reproduces the result. | Unexplained difference. |
| FOOD-T11 | A test strategy plugs in without changing physics. | A change to `CollisionSystem` is required. |
| FOOD-T12 | `ResourceStock` is not spent on budget rejection. | `zoneStocks` decreases or `unitsSpent` grows. |
| PERF-01 | Comparable profiles of ordinary and full food load. | The food object counts do not match. |
| GEN-01 | Protected genetic semantics are unchanged. | Unapproved diff of a mixed file. |
| IMP-01 | The energy change on import is explained. | Hidden loss without an operator decision. |

## 11. Reproduction Commands

Run the commands from the repository root.

Check the current version of Node.js and `pnpm` before running.

### 11.1. Specification Check

`node docs/specs/food-accessibility-and-budget/verify-review.mjs preflight`

This command checks the ID structure and base constants.

This command does not check the semantic correctness of the requirements.

### 11.2. Geometry Defect

`node docs/specs/food-accessibility-and-budget/collision-geometry-check.mjs`

Expect confirmation of the defect for scales 0.5 and 2.

### 11.3. Baseline Profile

`node docs/specs/food-accessibility-and-budget/m0-measure.mjs 4242 12 3`

Use this profile only to verify that the measurement method works.

Do not treat it as a test of the full food load.

### 11.4. Independent Budget Experiments

`node .tmp/food-four-cycle/03-audit-harness/audit-experiments.mjs`

`node .tmp/food-four-cycle/03-audit-harness/audit-budget.mjs`

`node .tmp/food-four-cycle/03-audit-harness/audit-outside.mjs`

`node .tmp/food-four-cycle/03-audit-harness/audit-roundtrip.mjs`

`node .tmp/food-four-cycle/03-audit-harness/audit-scale.mjs`

`node .tmp/food-four-cycle/03-audit-harness/audit-fractional.mjs`

Some runs contain 2100 ticks across several seeds.

Do not run heavy runs concurrently with a user simulation.

Save the JSON results next to the experiment report.

Do not modify sources in order to conduct the research.

### 11.5. Genome Check

`node docs/specs/food-accessibility-and-budget/verify-review.mjs genome-sha256 afad92b84c9b547802a5a785588ba112a1a05331`

The current working directory contains a previously modified `EngineProxy.ts`.

Do not treat the existing discrepancy as a result of the food work.

## 12. Historical List of Recommendations Before the Architectural Decision

For the current choice of D-01…D-06, see [FOOD-ADR-001](./architecture-contract.md).

| Decision | Candidate | Required supplement | Status |
|---|---|---|---|
| D-01 | A+ | Verification of the actual executability of the route. | PENDING |
| D-02 | A | Definition of the budget category and multiple zones. | PENDING |
| D-03 | 5%; M-1 | Small worlds, more seeds, long runs. | PENDING |
| D-04 | A+ | Contract for limit reduction and old import. | PENDING |
| D-05 | +25% / +15% | Repeated measurements at `food.size=400`. | PENDING |
| D-06 | A | O(N) cost, cache invalidation, import protection. | PENDING |
| PHY-01 | `worldSize` fix | Separate permission to change physics. | PENDING |
| M6-01 | Permission for mixed files | Analysis of the genetic diff. | PENDING |

The table preserves the historical statuses. Current statuses are defined in FOOD-ADR-001.

Record the date and basis for each statement.

Record specification changes separately from source changes.

## 13. Git and Public Publication Rules

Work in the existing directory `~/projects/entropia`.

Do not create additional worktrees without permission.

Do not include unrelated local changes in a commit.

Present the full diff before every commit.

Request permission before every commit.

Do not perform a push or PR without separate permission.

Translate published documents into English before publication.

Verify that IDs, formulas, and statuses are preserved in the translation.

Obtain operator approval of the translation.

Do not treat this document as grounds for publication.

## 14. Handoff Status

The four studies are complete.

The principal contradictions are consolidated in the registry C01…C09.

The primary documents remain local in `.tmp/`.

At the time the four studies were prepared, D-01…D-06 remained unapproved.

PHY-01 remains open.

The simulation sources were not modified in preparing this conclusion.

Committing this conclusion requires separate operator permission.
