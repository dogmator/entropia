# FOOD-ADR-001 — Entropia Minimal Ecological Contract

**Date:** 2026-10-25.
**Status:** ARCHITECTURE_SELECTED. This document does not authorize implementation.
**Basis:** three operator decisions in the 2026-10-25 conversation.
**Delegation limit:** architecture D-01…D-06; not modification of source code or publication.
**Source branch:** `dogma/laughing-goodall-mm3c44`.
**Source HEAD at preparation:** `41b09a349c508f5edfe7307f747d0a33b3aa6669`.
**Prior analysis:** [consolidated-four-cycle-review.md](./consolidated-four-cycle-review.md).
**Base specification:** [specification.md](./specification.md).
**Plan:** [execution-plan.md](./execution-plan.md).
**Public publication:** prohibited until the English translation is complete and approved.

## 1. Three Approved Operator Principles

| ID | Operator decision | Consequence |
|---|---|---|
| OP-01 | Self-regulating ecosystem. | Resources regenerate naturally; extinction is possible. |
| OP-02 | Scientifically grounded minimum. | Bounded stock, regeneration, budgets; no artificial food relocation. |
| OP-03 | Continuity of worlds. | Preserve organisms, genomes, energy, and history when rules change. |

Do not add artificial population rescue.

Do not create food without an active regeneration rule in scientific mode.

Do not remove, move, or transform food covertly.

Do not reset the world to apply a new budget.

Preserve the possibility of natural extinction and environmental recovery.

Do not introduce P2P, migrant exchange, or distributed consensus at this stage.

Ensure determinism of the local world as the foundation for a future network.

## 2. Minimal Implementation Scope

**Included:** selection of an accessible food target.

**Included:** control of the number of new food objects by zone.

**Included:** verifiable world restoration and configuration changes.

**Included:** deterministic tests and load metrics.

**Not included:** Utility AI, A*, a global navigator, or genetic changes.

**Not included:** decomposition, migration of substances between zones, and a new save schema.

**Not included:** automatic correction of population size.

**Not included:** automatic relocation of food or redistribution of energy.

**Not included:** changes to physics as part of the food budget.

## 3. Approved Architectural Decisions D-01…D-06

### D-01 — Food Accessibility: Direct Executable Corridor

**Architect's choice:** A+ without building a detour route.

Check the direct toroidal corridor from the organism to the `FoodCollisionRegion`.

Use the actual `worldSize`.

Account for the organism's radius along the corridor.

Account for `Obstacle` obstacles and impassable `Anomaly` entities.

Account for the active repulsion zone of an `Obstacle`.

Return `REACHABLE` only when the corridor is geometrically free and executability by the current steering is confirmed.

Return `BLOCKED` when complete inaccessibility of the bite region is proven.

Return `UNKNOWN` when a detour is possible without implementing navigation.

Return `UNKNOWN` when executability of the direct corridor is unconfirmed.

Exclude `BLOCKED` and `UNKNOWN` from food targets on the current tick.

Do not remove food because of a `BLOCKED` or `UNKNOWN` result.

Do not mix this result with the global budget category.

Re-evaluate the current target on every tick.

Reset an inaccessible target before computing the movement force.

Keep the selection state independent for each organism.

Resolve distance ties by stable food ID.

Do not run pathfinding around spheres in the MVP.

Do not claim that the absence of a direct path means the absence of any route at all.

**Verification:** tests with obstacles, an oasis, the toroidal seam, and independent organisms.

**Limitation:** accessibility at scales `0.5` and `2` cannot be finally accepted before PHY-01.

**Limitation:** a correct geometric test alone does not guarantee that steering will execute.

### D-02 — Food Budget Category: Placement, Not Reachability

**Architect's choice:** option A, geometric category of the oasis region.

Count as `BudgetInnerFood` any food whose center lies inside the impassable `ZoneType.OASIS` sphere.

Use the strict distance `d < R_oasis`.

Use the toroidal distance with the actual `worldSize`.

Count as `BudgetOuterFood` all other valid food.

Do not use the organism radius in budget classification.

Do not use the individual `REACHABLE` result for the budget.

Count food inside multiple oases once.

Treat an ordinary `Obstacle` as a movement obstacle, but not as a separate budget reserve category.

Do not permit spawning inside an ordinary `Obstacle`.

Do not classify other zones as inner without a separate extension of the contract.

Preserve the previously permitted spawning inside an oasis.

Do not call `BudgetInnerFood` completely inedible food.

Map `BudgetInnerFood` to the historical name `TrappedFood` only in the budget context.

**Verification:** sphere boundary, sphere intersection, toroidal seam, food inside and outside.

### D-03 — Quotas: Model M-1 with Hard Separation

**Architect's choice:** pilot quota 5% / 95%.

Define `C = maxFood`.

Verify that `C` is finite, an integer, and non-negative before applying it.

Define `C_inner = floor(0.05 * C)`.

Define `C_outer = C - C_inner`.

For `C=400`, use `C_inner=20` and `C_outer=380`.

For `C=50`, use `C_inner=2` and `C_outer=48`.

For `C=0`, use zero quotas.

For `0<C<20`, use `C_inner=0`.

Prohibit regular addition of food when the budget of its category is full.

Prohibit adding food when `N_total >= C`.

Do not transfer unused quota between categories.

Do not relocate already existing food.

Do not re-select the spawn location after a budget rejection.

Preserve the original RNG consumption order for a single spawn attempt.

Reject the attempt before debiting `ResourceStock`.

Do not increment successful-spawn counters on budget rejection.

Apply the rule to all four `FoodSpawnStrategy` values.

Recompute quotas upon an approved change of `maxFood`.

Treat 5% as a controlled starting parameter.

Do not claim scientific optimality of the quota without long-term experiments.

**Verification:** 50, 100, 400, 2000; odd values via the API; full and partially full budget.

### D-04 — Continuity of Old Worlds and Limit Reduction

**Architect's choice:** preservation of existing objects; managed budget debt.

When loading a saved world, preserve existing food objects.

Define budget debt separately for the inner and outer categories.

Allow an initial excess over the new quota as `LegacyOverQuota`.

Do not use `LegacyOverQuota` as permission for new objects in an overfull category.

Allow regular spawning in the other category only when that category has free quota and the total `C` has free capacity.

Do not violate the total limit `C` in order to restore outer spawning.

Do not delete `LegacyOverQuota` automatically.

Do not move `LegacyOverQuota` outward.

Do not trigger rescue mechanisms to compensate for `LegacyOverQuota`.

Reject a reduction of `maxFood` if the current `N_total` exceeds the new total limit.

Reject a reduction of `maxFood` if it puts any category into a new quota excess.

Do not reset the current world when a configuration change is rejected.

Return a diagnostic reason for the rejection.

On import, allow a pre-existing quota excess.

Do not treat import as grounds for resetting history, genome, and accumulated energy.

Verify the full content of a snapshot before applying it to a running world.

Do not discard food objects on import without an explicit rejection of the entire import.

Leave the running world unchanged when the snapshot is incompatible.

Account for the current food-filtering defect in `Persistence.service.ts`.

Do not claim full compatibility until a regression test for this defect exists.

**Explicit trade-off:** the old state may temporarily violate the new quota.

**Explicit trade-off:** when `maxFood` is full, new spawning is impossible without natural freeing of capacity.

**Verification:** 115 inner food at `maxFood=100`; import of an old world; rejection of a parameter change.

### D-05 — Separate Performance Constraints

**Architect's choice:** starting acceptance limit `targetSelectionMsP95 <= baseline * 1.25`.

**Architect's choice:** starting acceptance limit `workerTickMsP95 <= baseline * 1.15`.

Measure both metrics separately.

Use the same `hardwareId` for comparison.

Use three independent runs.

Use 15 warm-up ticks and 60 measured ticks.

Use the median of the three p95 values.

Measure the natural spawn profile.

Measure the profile with `food.size=400` and `maxOrganisms=400`.

Verify the actual collection sizes before measurement.

Do not use the former `m0-measure.mjs` as a full load baseline without populating food.

Verify instrumentation correctness after each behavior modification.

Do not accept the work if either of the two thresholds is exceeded.

Do not raise thresholds automatically.

Store numeric values in JSONL together with the configuration and the source SHA.

**Condition:** execution of M5 requires an actual baseline on the agreed profile.

### D-06 — Derived Budget Without a New Snapshot Schema

**Architect's choice:** D-06-A; `maxFood` and zone geometry remain the sources of the rules.

Do not add a `foodBudget` field to the snapshot.

Restore quotas from `config.maxFood` and the world zones.

Determine current occupancy from food objects.

Determine `LegacyOverQuota` from occupancy and active quotas.

Do not serialize duplicate occupancy counters as a second source of truth.

Do not declare a full occupancy recount to be an O(1) operation.

Measure the O(N) cost before introducing a cache.

Invalidate the derived cache after import, spawn, removal, and zone changes.

Invalidate the derived cache after a change of `maxFood`.

Preserve the original snapshot format absent a justified migration.

Preserve the immutability of genetic serialization.

**Verification:** export, import, simulation continuation, re-export, and match of the control state.

## 4. PHY-01 — Consistency of Toroidal Distances

**Architectural choice:** use the actual `worldSize` in all physical collision checks.

**Permission to change code:** SEPARATE PERMISSION NOT RECEIVED.

Prepare a separate minimal diff of `Collision.system.ts`.

Use a single toroidal computation with the world value from the simulation instance.

Do not change the laws of motion, radii, or energy together with this fix.

Verify scales `0.5`, `1`, and `2`.

Verify the presence and absence of false collisions across the seam.

Verify the old baseline fingerprints at scale 1.

Do not accept FOOD-T08 before PHY-01 is fixed.

## 5. M6-01 — Admission to Mixed Files

**Architectural choice:** permit only targeted changes that preserve genetic semantics.

**Permission to change code:** SEPARATE PERMISSION NOT RECEIVED.

Treat `Spawn.service.ts` and `TickLoop.service.ts` as necessary candidates for the budget.

Treat `Persistence.service.ts` as a candidate for import compatibility verification.

Do not change `Genome`, inheritance, mutation, or genetic serialization.

Compare the SHA256 of all `genomeInventory` files before and after.

Present the full diff of mixed files to the operator.

Do not bypass M6-A09 by excluding files from the list.

Permit an exception only as an explicitly approved decision with evidence.

## 6. Scientific Constraints of the MVP

### 6.1. Energy and Regeneration

Use the existing `ResourceStock` as a bounded regeneration model.

Do not automatically enable emergency spawning while `ResourceStock` is active.

Do not permit `ResourceStock` expenditure beyond the available stock.

Do not change the `ResourceStock` mode of an old world without a migration decision.

Preserve the old mode with `ResourceStock` disabled for reproducibility of old runs.

Record the existing failsafe that spawns food without `ResourceStock` as a compatibility mode.

Do not call this failsafe a physically closed cycle.

Do not turn emergency spawning into a population rescue mechanism.

Do not add corpse decomposition or inter-zone exchange of substances now.

### 6.2. Determinism and Independent Worlds

Verify identity of control states under the same seed.

Verify that continuation after saving yields the same result.

Do not use system time for target selection or spawning.

Do not introduce inter-world interaction without a separate project.

Preserve the local independence of each world.

Defer P2P, consensus, and synchronization to a separate architectural phase.

## 7. Acceptance Invariants

| ID | PASS criterion |
|---|---|
| AC-01 | An accessible target is selected instead of the nearest inaccessible one. |
| AC-02 | Inaccessible food remains in the world and retains its original energy. |
| AC-03 | Food in an oasis is permitted; an ordinary `Obstacle` remains impassable. |
| AC-04 | New food does not violate the active quotas and the total limit. |
| AC-05 | A budget rejection does not consume `ResourceStock`. |
| AC-06 | Existing food objects are not deleted by the budget migration. |
| AC-07 | An incompatible snapshot does not replace the running world. |
| AC-08 | Import preserves genomes, energy, and history. |
| AC-09 | Deterministic control runs match. |
| AC-10 | FOOD-T08 passes at three scales after PHY-01. |
| AC-11 | `targetSelectionMsP95` passes D-05. |
| AC-12 | `workerTickMsP95` passes D-05. |
| AC-13 | M6 confirms the absence of changes to genetic semantics. |
| AC-14 | `pnpm run check:strict` and the browser smoke test pass. |

Do not substitute tests of the original physics with tests of the target-selection policy.

Do not update reference fingerprints merely to obtain a PASS.

Document every intentional baseline deviation.

## 8. Minimal Implementation Sequence

| Stage | Work | Required blocker |
|---|---|---|
| M0 | Re-verify the baseline, both loads, import, and anomalies. | Permission for research involving file changes is required. |
| M1 | `FoodAccessibilityPolicy` contract and regression tests. | Implementation permission. |
| M2 | Wire the path check into target selection. | M1 PASS; mixed files — only with admission. |
| PHY | Fix the toroidal geometry as a separate change. | Separate PHY-01 permission. |
| M3 | `FoodBudgetPolicy` contract and migration tests. | M6-01 permission for mixed files. |
| M4 | Wire the limits into the four spawn strategies. | M3 PASS; import and `ResourceStock` verified. |
| M5 | Measure the two metrics and determinism. | D-05; both load profiles. |
| M6 | Verify SOLID/DRY, SHA256, tests, and smoke. | All previous blockers lifted. |
| M7 | Show the diff and record the agreed changes. | Separate permission for each commit. |

Do not combine the PHY-01 fix with the budget implementation in a single commit.

Do not start M1 or M3 before the reproducible conditions of M0 are complete.

Do not start production publication before all criteria are verified.

## 9. Permissions Not Yet Granted

| ID | Action | Status |
|---|---|---|
| AUTH-01 | Modify sources and tests for M1–M4 under this contract. | NOT AUTHORIZED |
| AUTH-02 | Fix `Collision.system.ts` and physical distances per PHY-01. | NOT AUTHORIZED |
| AUTH-03 | Modify mixed files from `genomeInventory` without changing genetic semantics. | NOT AUTHORIZED |
| AUTH-04 | Prepare a separate commit after reviewing the exact diff. | NOT AUTHORIZED |
| AUTH-05 | Perform push/PR/merge and deployment. | NOT AUTHORIZED |

The operator delegated the choice of architecture D-01…D-06.

The operator did not give separate permission to modify sources in the answers OP-01…OP-03.

The operator did not give permission to change the PHY-01 physics.

The operator did not give permission for the M6-01 mixed files.

Do not treat approval of this contract as permission to perform AUTH-01…AUTH-05.

## 10. Local Repository Blockers

The existing uncommitted interface and diagnostics changes do not belong to this contract.

Do not add them to the food-system commit without separate review.

The current `check:strict` fails on the saved `.mjs` scripts.

The `check:tooling` check also sees research `.mjs` files in the local `.tmp/`.

Fix the tooling violation in a separate authorized change before publication.

Do not disable the check in order to get CI to pass.

Translate all published documents into English before pushing to the public repository.

Keep the Russian working originals locally.

## 11. History and Precedence

This contract formalizes the three operator decisions of 2026-10-25.

Architecture D-01…D-06 was selected within the delegated authority.

The document [consolidated-four-cycle-review.md](./consolidated-four-cycle-review.md) remains the primary research conclusion.

The `NOT APPROVED` statuses previously stated in SPEC-FOOD-001 and PLAN-FOOD-001 are outdated only for D-01…D-06.

Do not alter historical research quotations retroactively.

In case of a discrepancy between the draft and this document for D-01…D-06, apply this contract.

Execution of M0…M7 remains closed pending separate permissions.
