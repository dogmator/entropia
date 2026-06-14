# Entropia Project Backlog

This document tracks identified technical debt, planned improvements, and architectural milestones.

## 🧹 Completed Refactorings (v2.5.0)

- [x] **Engine.ts SOLID Decomposition**: Engine decomposed into Facade, TickLoop, and EntityQuery.
- [x] **200-line Limit Enforcement**: Decomposed large files like `SimulationContext.tsx` and `useSimulationSettings.ts`.
- [x] **Web Worker Migration**: Computational core fully isolated with Transferable Buffer support.
- [x] **URL-Driven State**: All critical simulation and UI parameters synchronized with browser query parameters.
- [x] **Circular Dependency Removal**: Elimination of cyclic imports across all layers via `dependency-cruiser`.
- [x] **Dead Code Removal**: Removed unused graphics, stale interfaces, and redundant index files.

## ⚠️ Technical Debt & Known Bugs

### High Priority
- **ESLint Compliance**: 84 violations remain across 39 files. `pnpm run lint` is temporarily disabled in the pre-commit hook.
- **Food Render Inconsistency**: The simulation correctly calculates food radius shrinkage (bites), but the instanced renderer in `Entities.tsx` does not reflect these changes in real-time (likely using `initialRadius` in the buffer snapshot).
- **Camera Orbit Sync**: While position and target are synced to the URL, the full orbit state (pan offset, specific zoom levels) may reset on page reload.

### Medium Priority
- **SharedArrayBuffer Migration**: Prepare infrastructure for SAB-based zero-latency shared memory (requires COOP/COEP headers).
- **GPU Particles**: Move `EvolutionPulse` and `GeneticCometTrail` to pure GPU-based systems to reduce CPU overhead in the UI thread.

## 🚀 Future Roadmap

- [ ] **Phase 5**: Advanced genetics (recessive traits, complex mutation masks).
- [ ] **Phase 6**: Environmental interactions (weather, terrain-based speed modifiers).
- [ ] **Phase 7**: Social behaviors (schooling/flocking, pack hunting).
- [ ] **Phase 8**: Persistence v2 (Cloud sync, community preset library).
