# Contributing to Entropia

This document is the single source of truth for development standards, architectural rules, and verification workflows for the Entropia v2.5.0 biological evolution simulator.

## Architectural Layers

Imports must flow downward through these layers. Circular dependencies and upward imports are prohibited.

| # | Layer | Contents | Depends on |
|---|-------|----------|------------|
| 1 | `shared/` | Base types, constants, utilities | nothing |
| 2 | `core/` | EventBus, Logger, PerformanceMonitor | `shared` |
| 3 | `simulation/` | Engine, systems, managers, workers | `core`, `shared` |
| 4 | `ui/` | React components, Three.js, hooks | all layers below |

`dependency-cruiser` is the executable source of truth for layer-import restrictions.

## File Naming Convention

Use responsibility-oriented suffixes for new files where they fit the existing module shape.

| Suffix | Purpose |
|--------|---------|
| `.types.ts` | Interfaces and type aliases only |
| `.constants.ts` | Constant values |
| `.service.ts` | Business logic or infrastructure service |
| `.system.ts` | ECS-style simulation system |
| `.manager.ts` | Stateful coordinator for a resource |
| `.utils.ts` | Pure utilities |
| `.guard.ts` | Validation and anomaly detection |
| `.builder.ts` | Construction/setup logic |
| `.processor.ts` | Stateless transformation step |
| `.provider.ts` | Adapter between subsystems |
| `.hook.ts` | React hook |
| `.tsx` | React component |
| `.test.ts` | Unit test |

Existing `interfaces/` directories use the `I`-prefix convention (for example `ISimulationEngine.ts`) and are exempt from suffix rules.

## Code Standards

- Keep modules focused and prefer one primary responsibility per file.
- Treat files around 200 lines as a review signal, not a mechanically enforced hard limit. Decompose when size reflects mixed responsibilities or poor locality.
- Do not introduce `any` or `@ts-ignore`.
- Prefer named constants for non-obvious domain/configuration values.
- Avoid new barrel files. Existing compatibility/export barrels may remain until removing them provides a concrete locality or dependency benefit.

## Verification

`pnpm run check` is the enforced repository gate. It runs type checking, the full unit-test suite in deterministic run mode, dependency-cruiser, and a production build. CI and the current Husky pre-commit hook cover the same baseline.

`pnpm run check:strict` is the cleanup audit. It additionally runs ESLint, knip, and tooling checks and currently reports pre-existing quality debt that should be removed in focused follow-up changes.

Individual commands remain available for focused diagnostics:

```bash
pnpm run typecheck
pnpm run lint
pnpm run check:canon
pnpm run test --run
pnpm run build
```

## Debugging Protocol

For a bug fix, establish the root cause before changing behavior. Reproduce the failure, isolate the cause, add a regression test when practical, implement the smallest fix, and verify the repository gate.

## Git Workflow

- No force pushes to shared branches.
- Keep commits scoped to one logical change.
- Do not bypass hooks with `--no-verify` unless explicitly approved.
- Feature and bug changes should include appropriate tests.
- Repository-only cleanup must not silently change simulation behavior.

## Getting Started

Prerequisites: Node.js LTS and pnpm.

```bash
pnpm install
pnpm dev
pnpm run check
```

Tests live in `__tests__/` directories adjacent to the source they cover.
