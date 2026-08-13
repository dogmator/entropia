# Entropia Project Backlog

This document tracks verified technical debt, planned improvements, and architectural milestones. Items that have not been reproduced against the current `main` branch are explicitly marked as needing verification.

## Completed Refactorings (v2.5.0)

- [x] Engine decomposition into Facade, TickLoop, and EntityQuery.
- [x] Web Worker isolation with transferable render snapshots.
- [x] URL-driven simulation and camera state.
- [x] Circular dependency removal with dependency-cruiser rules.
- [x] Dead-code/tooling checks added to the repository verification scripts.

## Repository Baseline

- The canonical code-quality command is `pnpm run check`.
- `pnpm run check:ci` extends it with a production build for pre-merge verification.
- `.pnpm-store/` must not be tracked. Historical blobs may remain in Git history until an explicit history-rewrite decision is made.

## Technical Debt & Known Bugs

### High Priority — Reproduction Required

- **Food Render Inconsistency**: verify whether food radius shrinkage after bites is reflected by the current instanced renderer. Do not treat this as confirmed until reproduced on current `main`.
- **Camera Orbit Sync**: verify whether all orbit state needed for a faithful reload is represented by the current URL state. Position and target are already synchronized.

### Medium Priority

- **SharedArrayBuffer path**: evaluate a true shared-memory render path once deployment headers and browser constraints are verified. The current non-SAB snapshot path still copies the used TypedArray range before transfer.
- **GPU particles**: evaluate moving evolution effects to GPU-backed rendering only if profiling shows material UI-thread cost.

## Future Roadmap

- [ ] Phase 5: advanced genetics (recessive traits, complex mutation masks).
- [ ] Phase 6: environmental interactions (weather, terrain-based speed modifiers).
- [ ] Phase 7: social behaviors (schooling/flocking, pack hunting).
- [ ] Phase 8: persistence v2 (cloud sync, community preset library).
