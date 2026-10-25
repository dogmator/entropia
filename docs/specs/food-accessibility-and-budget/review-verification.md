# SPEC-FOOD-001 Risk Verification — 2026-10-25

**State:** verification of documentation and diagnostic tools completed.

**M0 acceptance:** not performed.

**M6 acceptance:** not performed.

**Publication:** blocked until the English translation is complete.

**Verified source commit:** `afad92b84c9b547802a5a785588ba112a1a05331`.

## Structural Verification

**Number of requirement IDs:** 61.

The absence of duplicate IDs was verified.

The meaning of the requirements was not verified automatically.

Semantics are verified by tests and manual architectural review.

**Verified commands:** `depcruise`, `check:dead-code`, `check:strict`.

**Source:** `src/simulation/__tests__/BaselineFingerprint.test.ts`.

**RECORDED:** six values matched the source commit.

**Early baseline ticks:** `100` and `300`.

The later ticks `600`, `1200`, and `2100` have no approved RECORDED values.

## M0 Method Verification

**Method:** `ssr-instrumentation`.

**Seed:** `4242`.

**Measurement ticks:** 12.

**Warm-up ticks:** 3.

**hardwareId:** `d8d7c2383531639c`.

**Number of target selection calls:** 4740.

**Call frequency:** true.

**targetSelectionMs p50:** 8.101 ms.

**targetSelectionMs p95:** 10.094 ms.

**workerTickMs p50:** 10.878 ms.

**workerTickMs p95:** 12.888 ms.

`engine.start()` did not start a self-driven loop.

`spawnOrganism()` did not add an organism automatically.

`scanNeighbors()` did not call `getNearby()`.

The measurements do not include browser Worker message exchange.

The probe run does not replace the M0 measurements.

## Comparison of Genome File SHA256 Values

**Files checked:** 15.

**Discrepancies relative to the source commit:** 1.

**Existing discrepancy:** `src/simulation/engine/EngineProxy.ts`.

The discrepancy was not created by the current task.

Do not assume that all genome files are unchanged.

Do not assert M6-A09 without resolving this discrepancy.

## Verification of New File Content

**Positive scenario:** PASS.

**Negative scenario:** FAIL.

**Expected negative result:** FAIL.

The test untracked file contained `UtilityAI`.

The check found the prohibited marker.

The test file was deleted.

The test manifest was not approved by the operator.

## Geometry Consistency

**Result:** `CONFIRMED_GEOMETRY_DEFECT`.

At scale `1`, the comparison matched.

At scale `0.5`, the comparison did not match.

At scale `2`, the comparison did not match.

FOOD-T08 cannot be accepted until a separate decision on changing physics.

## Reproduction

```bash
node docs/specs/food-accessibility-and-budget/verify-review.mjs preflight
node docs/specs/food-accessibility-and-budget/verify-review.mjs genome-sha256 afad92b84c9b547802a5a785588ba112a1a05331
node docs/specs/food-accessibility-and-budget/m0-measure.mjs 4242 12 3
node docs/specs/food-accessibility-and-budget/collision-geometry-check.mjs
```

The genome-sha256 result is currently expected to contain one discrepancy.

## Evidence Files

[ID and RECORDED verification](./review-verification.json).

[Measurement verification](./measurement-method-smoke.json).

[SHA256 comparison](./genome-sha256.json).

[New-file verification](./scope-guard-smoke.json).

[Geometry verification](./collision-geometry-smoke.json).

[List of controlled files](./scope-policy.json).

All D-01…D-06 remain unapproved.

No commit or publication was performed.
