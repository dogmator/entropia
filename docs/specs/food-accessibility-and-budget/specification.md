# SPEC-FOOD-001 — Food Accessibility and Food Budget

**Status:** requirements approved 2026-10-25.
**Implementation:** not started.
**Decisions D-01…D-06:** architecturally selected in [FOOD-ADR-001](./architecture-contract.md) after three operator responses.
**Implementation permission:** not received.
**Version:** 1.3-local; risk-verification draft of 2026-10-25.
**Plan:** [execution-plan.md](./execution-plan.md).

**Publication:** PROHIBITED until the English translation is approved.

## 1. Purpose and Boundaries

Ensure consumption of accessible food in the presence of inaccessible food.

Preserve the placement of food inside an impassable anomaly.

Preserve the impassability of the anomaly.

Preserve `maxFood` as the global limit on food objects.

Separate food target selection from the food budget.

Preserve the possibility of future extension to Ecological Utility Evolution.

Do not change physics without a separate decision.

Do not implement Utility AI as part of the fix.

## 1.1. Documentation Language Before Publication

Keep the local Russian specification as the working original.

Translate the specification into English before public publication.

Translate the execution plan into English before public publication.

Translate the technical reports before their public publication.

Verify the identity of IDs, formulas, invariants, and criteria in the translation.

Obtain a separate operator approval of the English translation.

Do not perform a push or PR until the language barrier is met.

Do not treat approval of the Russian specification as permission to publish.

## 2. Unified Terms

| Term | Meaning |
|---|---|
| `Food` | A food object with a finite energy reserve. |
| `Anomaly` | A spherical region restricting organism movement. |
| `Obstacle` | An impassable spherical `Obstacle` entity or an impassable `Anomaly` zone. |
| `PathClearance` | The minimum clearance between the organism's center and the obstacle surface. |
| `FoodCollisionRegion` | The set of organism-center positions that intersect the food surface per FOOD-I08. |
| `AccessibilityResult` | The result `REACHABLE`, `BLOCKED`, or `UNKNOWN`. |
| `ReachableFood` | Food with the result `REACHABLE` for a specific organism. |
| `TrappedFood` | Food in the region approved by decision D-02. The classification does not depend on the organism. |
| `FoodCapacity` | The maximum number of food objects in the entire world. The value is set by `maxFood`. |
| `FoodAccessibilityPolicy` | The rule for checking the accessibility of a food target for an organism. |
| `FoodBudgetPolicy` | The rule for admitting new food under the active limits. |
| `ActionSelectionPolicy` | The contract for an organism's action selection. |
| `Ecological Utility Evolution` | A prospective Utility AI model with heritable parameters and natural selection. |

`ReachableFood` depends on the organism.

`TrappedFood` relates to food placement.

Do not use `ReachableFood` to count the global food budget.

Do not treat food's membership in an anomaly as a completed check of the individual path.

Use the term `Obstacle` in all requirements about changing obstacles.

Do not treat `UNKNOWN` as confirmation of accessibility.

### 2.1. Accessibility Contract

Check the path of the organism's center taking into account `PathClearance` and the actual `worldSize`.

Use `FoodCollisionRegion` as the terminal region of an admissible path.

Define `FoodCollisionRegion` via `toroidalDistanceSq < (organism.radius + food.radius)^2`.

Use the same strict operator `<` as `CollisionSystem.isColliding()`.

Verify the consistency of `FoodCollisionRegion` and FOOD-I08 at every supported scale.

Do not declare the consistency check successful when the geometry diverges.

Treat world sizes `0.5` and `2` as blocked until the physics is fixed.

Obtain separate permission to change `CollisionSystem.isColliding()`.

Record the discovered discrepancy in the FOOD-T08 report.

Preserve the actual bite check per FOOD-I08.

Do not treat reaching the region as an automatic bite.

Apply a single toroidal metric for target selection and path checking.

Treat the `BLOCKED` result as grounds for excluding a food target.

Treat the `UNKNOWN` result as grounds for excluding a food target.

Define `REACHABLE` as the existence of an admissible path to the food collision region.

Require the absence of obstacle intersection along the admissible path.

Account for the organism radius along the path.

Treat a path as admissible only by the approved D-01 rule.

Define `BLOCKED` as the proven absence of an admissible path.

Define `UNKNOWN` as the absence of proof for both results.

Specify in D-01 the set of admissible routes.

Do not treat this criterion as finally approved before D-01.

Specify in D-01 the admissible routes and the path-existence criterion.

Specify in D-01 the `PathClearance` rule for an organism of a specific radius.

Specify in D-01 the behavior when no route exists.

Do not change the movement rules when defining accessibility.

## 3. Basis

In `Behavior.system.ts`, the organism selects the nearest food without checking accessibility.

In `TickLoop.service.ts`, spawning stops when `food.size >= maxFood`.

In `Spawn.service.ts`, the oasis permits food placement inside the sphere.

In `Collision.system.ts`, the sphere remains impassable.

Control experiments with seeds `1` and `4242` confirmed a local blocking of accessible food selection.

A distant organism continued to feed.

In three natural runs at tick 1200, between 170 and 189 of 400 food objects were inside the oasis.

| Seed | Scale | `ResourceStock` mode | Tick | Total food | Inside oasis | Outside oasis |
|---|---:|---|---:|---:|---:|---:|
| `1` | 1 | off | 1200 | 400 | 170 | 230 |
| `4242` | 1 | off | 1200 | 400 | 174 | 226 |
| `3735928559` | 1 | off | 1200 | 400 | 189 | 211 |

Configuration: default `SimulationEngine` settings; `maxFood=400`.

Classification in the measurements: the food center is inside the `oasis_center` sphere of radius 90.

Do not treat these measurements as verification of the future D-02 classification.

The measurements were obtained from local runs before the fix.

A permanent file with the primary measurements was not created in the previous study.

Repeat the measurements in M0 with preservation of the evidence.

Removal of trapped food increased the total energy absorption in paired experiments.

A global disabling of the bite mechanism has not been confirmed.

## 4. Behavior Requirements

### 4.1. Food Target Selection

| ID | Requirement |
|---|---|
| FOOD-R01 | Check the accessibility of the food target under consideration. |
| FOOD-R02 | Exclude inaccessible food from the candidates. |
| FOOD-R03 | Keep inaccessible food in the world. |
| FOOD-R04 | Re-evaluate the target on the first tick after a change in the organism's position or an `Obstacle`. |
| FOOD-R05 | Select accessible food when nearer inaccessible food exists. |
| FOOD-R06 | Keep target selection independent for each organism. |
| FOOD-R07 | Stop pursuing the target on the current tick on a `BLOCKED` or `UNKNOWN` result. |
| FOOD-R08 | Preserve the bite mechanism absent a proven reason to change it. |

Do not use distance to food as the sole accessibility criterion.

Use the actual `worldSize` in geometric computations.

Treat the permissible delay of FOOD-R04 as one simulation tick.

Apply an `Obstacle` change before the target re-evaluation of the next tick.

Do not retain a stale target after the next tick.

Apply decision D-01 before starting M1.

Do not start M2 before approval of D-01.

### 4.1.1. Rules for FOOD-R07

Reset the current target on a `BLOCKED` result.

Reset the current target on an `UNKNOWN` result.

Reset the current target on removal of the food object.

Select the next accessible target on the same tick.

Set `IDLE` when no accessible food target exists.

Do not retain the pursuit force of the former target after the reset.

### 4.2. Food Budget

| ID | Requirement |
|---|---|
| FOOD-B01 | Preserve the global hard limit `maxFood`. |
| FOOD-B02 | Reserve part of `maxFood` for food outside the `TrappedFood` regions approved by D-02. |
| FOOD-B03 | Limit `TrappedFood` per the D-02 classification within `maxFood`. |
| FOOD-B04 | Preserve the ability to place food inside an anomaly. |
| FOOD-B05 | Preserve the budget after world export and import. |
| FOOD-B06 | Determine the budget sizes experimentally. |
| FOOD-B07 | Apply the D-02 classification and a single admission rule to all spawn strategies. |
| FOOD-B08 | Define the handling of old worlds with an exceeded budget before migration. |

Do not guarantee outer spawning when the outer budget is full.

Do not assign numeric quotas without decision D-03.

Do not delete existing food automatically without decision D-04.

### 4.2.1. Limit Balance

Denote `C=maxFood` as the global limit.

Denote `C_trapped` as the limit of the `TrappedFood` category per D-02.

Apply D-02 to FOOD-B02, FOOD-B03, FOOD-B07, and FOOD-B08.

Denote `C_outer` as the limit of food outside `TrappedFood` per D-02.

Ensure `C_trapped + C_outer = C`.

Ensure `N_trapped <= C_trapped` under regular food admission.

Ensure `N_outer <= C_outer` under regular food admission.

Ensure `N_trapped + N_outer <= C` under regular food admission.

Define the integer rounding of the limits in D-03.

Recompute both limits when `maxFood` changes.

Verify both limits after a `maxFood` change.

Verify that the limits are integers when `maxFood` is odd.

Define the parameters `C_trapped` and `C_outer` in D-03.

Apply decision D-04 to existing worlds with a violated balance.

Do not transfer free capacity between budgets before a separate decision.

### 4.2.2. Spawn Strategies for FOOD-B07

Apply `FoodBudgetPolicy` to `FoodSpawnStrategy.RANDOM`.

Apply `FoodBudgetPolicy` to `FoodSpawnStrategy.UNIFORM`.

Apply `FoodBudgetPolicy` to `FoodSpawnStrategy.CLUSTERED`.

Apply `FoodBudgetPolicy` to `FoodSpawnStrategy.OASIS_PREFERRED`.

Check the budget before charging `ResourceStock` units.

Do not spend `ResourceStock` when `FoodBudgetPolicy` rejects.

Preserve compatibility with the optional `ResourceStock`.

### 4.3. Invariants

| ID | Invariant |
|---|---|
| FOOD-I01 | Inaccessible food does not block another organism's bite of accessible food. |
| FOOD-I02 | Food inside an impassable anomaly is permitted. |
| FOOD-I03 | The impassability of the anomaly is preserved. |
| FOOD-I04 | Total admission does not exceed `maxFood`. |
| FOOD-I05 | Target selection does not change the global food budget. |
| FOOD-I06 | The food budget does not substitute for target selection. |
| FOOD-I07 | An organism's target selection does not change another organism's target. |
| FOOD-I08 | A bite requires collision with the food. |

## 5. SOLID, DRY, and Architecture

| ID | Principle | Requirement |
|---|---|---|
| FOOD-A01 | SRP | Separate the accessibility check from action selection. |
| FOOD-A02 | SRP | Separate the food budget from organism behavior. |
| FOOD-A03 | OCP | Ensure the action selection algorithm can be replaced without changing physics. |
| FOOD-A04 | LSP | Use a single behavioral contract for every implementation. |
| FOOD-A05 | ISP | Separate observation, action selection, and action execution. |
| FOOD-A06 | DIP | Plug in the behavioral strategy through a minimal contract. |
| FOOD-A07 | DRY | Use a single geometric accessibility rule. |
| FOOD-A08 | DRY | Use a single food admission rule. |
| FOOD-A09 | Isolation | Store mutable behavioral state separately for each organism. |
| FOOD-A10 | Evolution | Provide for heritable behavioral parameters in the future genome. |
| FOOD-A11 | Persistence | Provide for versioning of future genome parameters. |
| FOOD-A12 | Performance | Use a spatial index for food candidates. |
| FOOD-A13 | Semantics | Separate target accessibility from the budget classification. |
| FOOD-A14 | Testing | Use shared contract tests for behavioral strategies. |

Observe the dependency directions from `CONTRIBUTING.md`.

Do not add a global mutable target cache.

Do not couple `SpawnService` to the state of an individual organism.

Do not create a universal AI Framework.

Do not add an interface without a required contract.

Do not modify the genome in the current fix.

### 5.1. Intelligence Extension

Preserve the boundary `Observation → ActionSelectionPolicy → Action → Execution`.

Preserve the current heuristic as the initial selection implementation.

Provide for plugging in Utility AI via `ActionSelectionPolicy`.

Provide for heritable parameters of hunger, risk, group behavior, and reproduction.

Preserve the possibility of mutation of these parameters.

Preserve natural selection through survival and reproduction.

Do not introduce memory, learning, and communication in the current fix.

Do not introduce neuroevolution in the current fix.

## 6. Determinism

| ID | Requirement |
|---|---|
| FOOD-D01 | Use the random number generator of the specific world instance. |
| FOOD-D02 | Re-evaluate the target once per tick for a living organism. |
| FOOD-D03 | Select the minimum score; resolve ties by stable food ID. |
| FOOD-D04 | Preserve behavior across export and import. |
| FOOD-D05 | Compare identical seeds and initial states. |
| FOOD-D06 | Analyze changes in baseline fingerprints before approval. |

Do not use browser time for target selection.

### 6.1. Score for FOOD-D03

Consider only food with the result `REACHABLE`.

Compute the score as `score=toroidalDistanceSq(organism.position, food.position, worldSize)`.

Select the smallest `score`.

Use the lexicographic order of the full `Food.id` when `score` is equal.

Apply this order independently of the traversal order of the spatial index.

Do not use random selection when scores are equal.

### 6.2. Re-evaluation FOOD-D02

Check the selected target before computing the pursuit force on every tick.

Recompute `score` on every tick.

Apply obstacle changes on the next tick.

Do not retain a target after the death or removal of the food object.

## 7. Performance

| ID | Requirement |
|---|---|
| FOOD-P01 | Use a spatial index when searching for food. |
| FOOD-P02 | Exclude full enumeration of food by every organism on every tick. |
| FOOD-P03 | Define cache invalidation rules before introducing a cache. |
| FOOD-P04 | Measure target selection time at the maximum population. |
| FOOD-P05 | Compare Worker time before and after the change. |

Approve the regression threshold before acceptance.

### 7.1. Caching Contract FOOD-P03

Do not use an accessibility result cache in the first variant.

Add a cache only after measuring FOOD-P04.

Include the organism ID and food ID in the cache key.

Include the organism position and radius in the cache key.

Include the food position and the actual `worldSize` in the cache key.

Include the obstacle geometry version in the cache key.

Invalidate the cache when the organism's position or radius changes.

Invalidate the cache when the food changes.

Invalidate the cache when obstacles change.

Invalidate the cache on world import or reset.

Do not reuse a result after any key component changes.

### 7.2. Metrics FOOD-P04 and FOOD-P05

Measure `targetSelectionMs` separately from `workerTickMs`.

Measure both metrics at `maxOrganisms` and the approved `maxFood`.

Store p50 and p95 of each metric.

Compare values with the baseline on the same hardware.

Apply D-05 to `targetSelectionMsP95`.

Apply D-05 to `workerTickMsP95`.

Do not accept FOOD-P04 without a separate `targetSelectionMsP95` threshold.

Do not accept FOOD-P05 without a separate `workerTickMsP95` threshold.

## 8. Acceptance Scenarios

| ID | Scenario | Expected result |
|---|---|---|
| FOOD-T01 | Accessible food nearby. | The organism consumes the food. |
| FOOD-T02 | Inaccessible food is nearer. | The organism selects accessible food. |
| FOOD-T03 | All food is inaccessible. | The organism does not pursue inaccessible food. |
| FOOD-T04 | Two distant organisms. | One's feeding does not depend on the other's target. |
| FOOD-T05 | The `TrappedFood` limit is full. | The outer reserve remains available. |
| FOOD-T06 | `maxFood` is full. | The global limit is not exceeded. |
| FOOD-T07 | World export and import. | The budget rules are preserved. |
| FOOD-T08 | World scales `0.5`, `1`, `2`. | The actual `worldSize` is used. |
| FOOD-T09 | Long run. | Spawning is possible with a free outer reserve. |
| FOOD-T10 | Repeated seed. | Results are reproduced. |
| FOOD-T11 | Test `ActionSelectionPolicy`. | The strategy returns a predefined target ID; physics executes the passed action without change. |
| FOOD-T12 | `ResourceStock` enabled. | Budget rejection does not spend units; a permitted spawn preserves cost accounting. |

Record the seed, configuration, tick, food objects, energy, and number of successful bites.

### 8.1. Verification of FOOD-T11

Create a test `ActionSelectionPolicy` with a fixed target `food_out`.

Verify that the target receives the ID `food_out`.

Verify the identical execution result of one action by the current and the test strategy.

Do not add Utility AI to verify FOOD-T11.

### 8.2. Verification of FOOD-T12

Verify that `unitsSpent` is unchanged on food budget rejection.

Verify that `zoneStocks` is unchanged on food budget rejection.

Verify that `zoneStocks` decreases by `RESOURCE_STOCK_UNITS_PER_FOOD` on a permitted spawn.

Verify that `unitsSpent` increases by `RESOURCE_STOCK_UNITS_PER_FOOD` on a permitted spawn.

Verify the separate mode with `ResourceStock` disabled.

Verify the restoration of `zoneStocks` after export and import.

Separate unit, integration, and browser tests.

Run `pnpm run check:strict` before proposing a commit with code.

## 9. Historical Decision Registry Before Architectural Delegation

**Current contract:** [FOOD-ADR-001](./architecture-contract.md).

This section preserves the status of the decisions at the time of the initial study.

Do not use the historical statuses in the table to determine the current admission to M1–M5.

**Historical status of each decision:** NOT APPROVED.

**Current status of D-01…D-06:** architecturally selected under FOOD-ADR-001.

**Current status of AUTH-01…AUTH-05:** not authorized.

**Owner of each decision:** Entropia operator.

**Registration date of each decision:** 2026-10-25.

**Approval date of each decision:** absent.

| ID | Decision subject | Owner | Registration date | Approval date | Status | Blocks |
|---|---|---|---|---|---|---|
| D-01 | Path-existence criterion. | Operator | 2026-10-25 | — | Not approved | Start of M1 and M2 |
| D-02 | `TrappedFood` classification regions. | Operator | 2026-10-25 | — | Not approved | Start of M3 |
| D-03 | Numeric budgets and rounding rule. | Operator | 2026-10-25 | — | Not approved | Start of M3 |
| D-04 | Saved worlds with an exceeded budget. | Operator | 2026-10-25 | — | Not approved | Start of M3 |
| D-05 | Permissible regression of `targetSelectionMs` and `workerTickMs`. | Operator | 2026-10-25 | — | Not approved | Start of M5 |
| D-06 | Budget serialization and restoration. | Operator | 2026-10-25 | — | Not approved | Start of M3 |

### 9.1. D-01 — Path-Existence Criterion

Define the admissible route: a straight segment or a path around an obstacle.

Define the `PathClearance` requirement taking the organism radius into account.

Define the `REACHABLE` criterion for the chosen route.

Define the `BLOCKED` criterion for the chosen route.

Define the admissibility of `UNKNOWN` under limited computation time.

Approve a single criterion before M1.

### 9.2. D-02 — Food Budget Classification

List the types of impassable anomalies for `TrappedFood`.

Define the rule for intersecting anomalies.

Define the rule for an ordinary `Obstacle`.

Apply the D-02 classification to all checks FOOD-B02…FOOD-B08.

Approve the classification before M3.

### 9.3. D-03 — Food Budget Parameters

Obtain the M0 measurements before adopting D-03.

Define `C_trapped` within `maxFood`.

Define `C_outer` as `maxFood - C_trapped`.

Define the rounding when `maxFood` changes.

Define the mode of free capacity between budgets.

Approve the values before M3.

### 9.4. D-04 — Migration

Define the behavior of an old world with an exceeded `C_trapped`.

Do not delete existing food without an operator decision.

Approve the rule before M3.

### 9.5. D-05 — Performance

Obtain the baseline measurements of `targetSelectionMs` and `workerTickMs` in M0.

Define the maximum regression of `targetSelectionMsP95` in percent.

Define the maximum regression of `workerTickMsP95` in percent.

Define the test bench conditions and the number of repetitions.

Approve the values before M5.

### 9.6. D-06 — State Persistence

Define the source of the food budget parameters.

Define the behavior for an old save without budget parameters.

Define the parameter validation rule on import.

Approve the contract before M3.

## 10. Authority

The specification records the approved requirements.

The specification does not approve the open decisions D-01…D-06.

The specification does not permit modification of sources.

The specification does not permit modification of the genome.

The specification does not permit implementation of Utility AI.

Show changes to the operator before every commit.

Request permission before every commit.

Do not perform push, PR, or merge without separate permission.

See [execution-plan.md](./execution-plan.md).
