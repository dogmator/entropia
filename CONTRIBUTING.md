# Contributing to Entropia

This document is the single source of truth for development standards, architectural rules, and workflows for the Entropia v2.5.0 biological evolution simulator.

---

## Architectural Layers

Imports must only flow **downward** through these layers. Circular dependencies and upward imports are prohibited.

| # | Layer | Contents | Depends on |
|---|-------|----------|------------|
| 1 | `shared/` | Base types, constants, utilities | nothing |
| 2 | `core/` | EventBus, Logger, PerformanceMonitor | `shared` |
| 3 | `simulation/` | Engine, Systems, Managers, Workers | `core`, `shared` |
| 4 | `ui/` | React components, Three.js, hooks | all layers below |

## File Naming Convention

Each file must have a suffix that reflects its sole responsibility.

| Suffix | Purpose |
|--------|---------|
| `.types.ts` | Interfaces and type aliases only. No logic. |
| `.constants.ts` | Constant values only. |
| `.service.ts` | Business logic or infrastructure service. |
| `.system.ts` | ECS-style system logic in the simulation. |
| `.manager.ts` | Stateful coordinator managing a specific resource. |
| `.utils.ts` | Pure utility functions with no state or side effects. |
| `.guard.ts` | Validation logic, type predicates, anomaly detection. |
| `.builder.ts` | Object construction / environment setup logic. |
| `.processor.ts` | Stateless transformation or processing pipeline step. |
| `.provider.ts` | Data adapter/accessor that bridges two subsystems. |
| `.hook.ts` | React hooks (one hook per file). |
| `.tsx` | React components (JSX only, minimal logic). |
| `.test.ts` | Unit tests. |

**Exception — `interfaces/` directories**: Files inside any `interfaces/` folder are exempt from suffix rules. Use the `I`-prefix convention instead (e.g., `ISimulationEngine.ts`).

## Code Standards

- **Single Responsibility**: one file — one class, hook, or component.
- **200-line limit**: exceeding this is a signal of SRP violation and requires decomposition.
- **No `any`**: use explicit types or narrow with type guards. `@ts-ignore` is forbidden.
- **No dead code**: all exports must be reachable. Use `knip` to verify.
- **Constants over magic numbers**: all numeric and string literals must be extracted to `.constants.ts` files.
- **No barrel files** (`index.ts` re-exports): import directly from the source file.

## Tooling

| Tool | Purpose |
|------|---------|
| `knip` | Detects unused exports, orphan files, and dead dependencies. |
| `dependency-cruiser` | Enforces layer boundaries, prevents circular dependencies. |
| `ESLint` | Strict TypeChecked rules and naming conventions. |
| `Vitest` | Unit test runner. |
| `tsc --noEmit` | Type correctness gate. |

## Debugging Protocol

When fixing a bug, follow these four phases in order. Do not skip phases.

1. **Investigate** — Read error logs, reproduce the issue, collect data. Do not guess.
2. **Analyze** — Find working examples in the codebase, compare, isolate the difference.
3. **Hypothesize** — Formulate one root-cause hypothesis. Test it with a minimal change.
4. **Implement** — Write a failing test, implement the fix, verify no regressions.

Rules: one fix at a time, no fix without a test, document the root cause in the commit message.

## Git Workflow

- **No force pushes** to shared branches.
- **Atomic commits**: one logical change per commit.
- **Commit only passing code**: `pnpm tsc --noEmit` and `pnpm test` must pass before committing.
- **No `--no-verify`** unless explicitly approved.
- Every feature or bug fix requires a unit test.

## Getting Started

**Prerequisites**: Node.js (LTS), pnpm

```bash
pnpm install
pnpm dev          # development server
pnpm test         # run all tests via Vitest
pnpm tsc --noEmit # type check
pnpm build        # production build → dist/
pnpm run lint     # ESLint
```

Tests live in `__tests__/` directories adjacent to the source file they cover.
