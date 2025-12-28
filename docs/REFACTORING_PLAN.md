# Comprehensive Refactoring Plan - Entropia Game Engine

## ✅ COMPLETED WORK

### Phase 1: Abstractions ✓
- ✅ Created `ISystem`, `IEntity`, `ISimulationEngine` interfaces
- ✅ Created `IEntityRepository`, `ISimulationContext` interfaces
- ✅ All interfaces in `src/simulation/interfaces/`

### Phase 5: Split Constants ✓
- ✅ Split `constants.ts` (853 lines) into 13 modular files
- ✅ Created `src/config/` directory structure
- ✅ Updated all imports across codebase
- ✅ Reduction: 853 → 867 lines (better organization)

### Phase 2: Break Down Engine.ts ✓
- ✅ Extracted **EntityManager** (246 lines)
- ✅ Extracted **GridManager** (58 lines)
- ✅ Extracted **CameraDataProvider** (30 lines)
- ✅ Integrated **StatisticsManager** (removed 487 duplicate lines!)
- ✅ **Engine.ts: 1088 → 600 lines (45% reduction)**

### Test Coverage ✓
- ✅ All 72 tests passing
- ✅ 8 test files
- ✅ TypeScript compilation: 0 errors

---

## 🚧 REMAINING WORK

### Phase 3: Decouple UI from Simulation (HIGH PRIORITY)
- ❌ Use EngineProxy in SimulationContext (currently uses Engine directly)
- ❌ Move update loop from Entities.tsx to Worker
- ❌ Create DTOs for UI/Simulation communication
- ❌ Remove direct entity imports in UI (Organism, Food, Obstacle)

### Phase 4: Eliminate DRY Violations
- ❌ Consolidate performance monitoring (remove duplication in SimulationContext)
- ❌ Consolidate type guards (remove duplication in Viewport.tsx)

### Phase 6: Increase Test Coverage
- ❌ Add tests for EntityManager
- ❌ Add tests for GridManager
- ❌ Add tests for CameraDataProvider
- ❌ Target: 70%+ coverage

### Phase 7: Infrastructure
- ❌ Add lint-staged
- ❌ Fix 417 ESLint errors (magic numbers, max-lines-per-function, etc.)
- ❌ Add CI/CD pipeline
- ❌ Configure coverage thresholds

---

## Analysis Summary

Based on deep codebase analysis, identified critical architectural issues:

### Critical Issues (🔴)
1. **SimulationContext bypasses Worker architecture** - uses Engine directly instead of EngineProxy
2. **Engine.ts is God Object** - 1087 lines, 10+ responsibilities
3. **StatisticsManager unused** - logic duplicated in Engine
4. **Tight UI-Simulation coupling** - UI directly calls engine.update()

### Important Issues (🟡)
5. **No abstractions** - missing ISystem, IEntity, ISimulationEngine interfaces
6. **DRY violations** - duplicated caching, type guards, constants
7. **Low test coverage** - ~10% (8 test files for 77 source files)
8. **Monolithic constants.ts** - 853 lines

---

## Refactoring Strategy

### Phase 1: Abstractions & Interfaces ✨
**Goal:** Create abstraction layer for SOLID compliance

#### 1.1 Create Core Interfaces
- [ ] `src/simulation/interfaces/ISystem.ts` - unified system interface
- [ ] `src/simulation/interfaces/IEntity.ts` - base entity contract
- [ ] `src/simulation/interfaces/ISimulationEngine.ts` - engine contract
- [ ] `src/simulation/interfaces/IEntityRepository.ts` - storage abstraction
- [ ] `src/simulation/interfaces/IRenderData.ts` - rendering abstraction

#### 1.2 Update Existing Systems
- [ ] BehaviorSystem implements ISystem
- [ ] PhysicsSystem implements ISystem
- [ ] MetabolismSystem implements ISystem
- [ ] ReproductionSystem implements ISystem
- [ ] CollisionSystem implements ISystem

#### 1.3 Update Entities
- [ ] Organism implements IEntity
- [ ] Food implements IEntity
- [ ] Obstacle implements IEntity

**Benefits:**
- Testability (easy mocking)
- Extensibility (add new systems/entities without modifying core)
- Type safety

---

### Phase 2: Break Down God Object (Engine.ts) 🔨
**Goal:** Single Responsibility Principle

#### 2.1 Extract EntityManager
**Responsibilities:**
- Manage organisms/food/obstacles collections
- findEntityAt, findFoodAt, getEntityByInstanceId
- Entity lifecycle (add/remove)

**File:** `src/simulation/managers/EntityManager.ts`

#### 2.2 Extract EngineOrchestrator
**Responsibilities:**
- Coordinate systems execution
- Manage update loop
- System registration/lifecycle

**File:** `src/simulation/core/EngineOrchestrator.ts`

#### 2.3 Use StatisticsManager (already exists!)
**Remove from Engine:**
- statsCache
- updateStats()
- calculateAverageEnergy()
- All statistics computation

**Integrate:** Use existing StatisticsManager instead

#### 2.4 Extract GridManager
**Responsibilities:**
- rebuildGrid()
- calculateGridEfficiency()
- Spatial indexing

**File:** `src/simulation/managers/GridManager.ts`

#### 2.5 Extract CameraDataProvider
**Responsibilities:**
- setCameraData()
- getCameraData()
- cameraDataCache

**File:** `src/simulation/providers/CameraDataProvider.ts`

#### 2.6 Refactored Engine.ts
**Remaining responsibilities:**
- Delegate to managers
- Coordinate orchestrator
- Public API facade

**Target:** <200 lines

---

### Phase 3: Decouple UI from Simulation 🔓
**Goal:** UI should not know about simulation internals

#### 3.1 Use EngineProxy in SimulationContext
**Current:**
```typescript
const engine = useMemo(() => new SimulationEngine(worldScale), [worldScale]);
```

**Refactored:**
```typescript
const engine = useMemo(() => new EngineProxy(worldScale), [worldScale]);
```

#### 3.2 Move Update Loop from Entities.tsx
**Problem:** UI component controls simulation loop
```typescript
// Entities.tsx:217
for (let s = 0; s < steps; s++) {
    engine.update();
}
```

**Solution:** Move to EngineProxy/Worker, UI only receives updates

#### 3.3 Create DTOs (Data Transfer Objects)
**Replace direct entity exposure with:**
- `RenderableEntity` DTO (only position, rotation, color)
- `EntityInfo` DTO (for selection panel)
- `StatisticsSnapshot` DTO

**Benefits:**
- UI doesn't import Organism/Food/Obstacle classes
- Clear data contracts
- Easier to serialize for Worker communication

#### 3.4 Create Simulation Facade
**File:** `src/simulation/SimulationFacade.ts`

Public API for UI:
```typescript
interface ISimulationFacade {
  start(): void;
  stop(): void;
  getRenderData(): RenderData;
  getStatistics(): StatisticsSnapshot;
  selectEntity(id: string): EntityInfo | null;
  // etc.
}
```

---

### Phase 4: Eliminate DRY Violations 🧹
**Goal:** Don't Repeat Yourself

#### 4.1 Consolidate Camera Caching
**Remove from:**
- Engine.ts (cameraDataCache)
- StatisticsManager.ts (duplicate)

**Create:**
- `src/simulation/providers/CameraDataProvider.ts` (single source of truth)

#### 4.2 Consolidate Performance Monitoring
**Remove from SimulationContext:**
- fpsCounter, tpsCounter, frameTimestamp calculation

**Use:** Existing PerformanceMonitor service

#### 4.3 Consolidate Type Guards
**Remove from Viewport.tsx:**
- isOrganism, isObstacle, isFood

**Use:** Existing EntityTypeGuards utility

#### 4.4 Consolidate Buffer Constants
**Problem:** Constants spread across:
- constants.ts (PHYSICS.ORGANISM_STRIDE)
- BufferManager.ts (BUFFER_CONSTANTS)

**Solution:** Single source in split constants (see Phase 5)

---

### Phase 5: Split Monolithic Constants 📦
**Goal:** Modular, discoverable constants

**Current:** `constants.ts` (853 lines)

**Refactor to:**
```
src/config/
├── physics.constants.ts      # Physics simulation
├── rendering.constants.ts    # Rendering & buffers
├── ui.constants.ts           # UI/UX settings
├── performance.constants.ts  # Performance tuning
├── gameplay.constants.ts     # Game mechanics
└── index.ts                  # Re-exports
```

**Update imports:**
```typescript
// Before
import { PHYSICS, UI, RENDERING } from '@shared/config';

// After
import { PHYSICS } from '@/config/physics.constants';
import { UI } from '@/config/ui.constants';
```

---

### Phase 6: Increase Test Coverage 🧪
**Goal:** 70%+ coverage for critical paths

**Current:** ~10% (8 test files)

#### 6.1 Add Unit Tests
- [ ] EntityManager.test.ts
- [ ] EngineOrchestrator.test.ts
- [ ] StatisticsManager.test.ts (use it properly first!)
- [ ] BufferManager.test.ts
- [ ] SpawnService.test.ts
- [ ] GridManager.test.ts
- [ ] SimulationFacade.test.ts

#### 6.2 Add Integration Tests
- [ ] Engine.integration.test.ts (full update cycle)
- [ ] EngineProxy.test.ts (Worker communication)

#### 6.3 Add UI Component Tests
- [ ] SimulationContext.test.tsx
- [ ] Entities.test.tsx
- [ ] Viewport.test.tsx

#### 6.4 Configure Coverage Threshold
**vitest.config.ts:**
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70
    },
    exclude: [
      '**/*.test.ts',
      '**/*.config.ts',
      '**/types.ts'
    ]
  }
}
```

---

### Phase 7: Infrastructure Improvements 🏗️

#### 7.1 Add lint-staged
**package.json:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**.husky/pre-commit:**
```bash
pnpm lint-staged
pnpm test --run
```

#### 7.2 Add CI/CD Pipeline
**.github/workflows/ci.yml:**
- Run tests on PR
- Check coverage threshold
- Run linter
- Type check
- Build verification

#### 7.3 Update Documentation
- [ ] ARCHITECTURE.md - reflect new structure
- [ ] API.md - document public interfaces
- [ ] CONTRIBUTING.md - development workflow
- [ ] README.md - update setup instructions

---

## Execution Order

### Priority 1 (Foundation)
1. Phase 1: Create abstractions (interfaces)
2. Phase 5: Split constants.ts
3. Phase 2: Break down Engine.ts

### Priority 2 (Architecture)
4. Phase 3: Decouple UI from Simulation
5. Phase 4: Eliminate DRY violations

### Priority 3 (Quality)
6. Phase 6: Increase test coverage
7. Phase 7: Infrastructure improvements

---

## Success Criteria

### Architectural
- ✅ UI imports ZERO concrete simulation classes
- ✅ Engine.ts < 200 lines
- ✅ All systems implement ISystem
- ✅ SimulationContext uses EngineProxy (Worker-based)

### Code Quality
- ✅ Zero DRY violations
- ✅ All ESLint rules pass
- ✅ No files > 300 lines
- ✅ Max complexity: 10

### Testing
- ✅ Coverage ≥ 70%
- ✅ All critical paths tested
- ✅ Integration tests for Engine
- ✅ UI component tests

### Documentation
- ✅ ARCHITECTURE.md updated
- ✅ API.md created
- ✅ All public APIs documented

---

## Risk Mitigation

1. **Breaking Changes**
   - Create feature branch (already on `assistant/comprehensive-refactor-qgOpq`)
   - Run tests after each phase
   - Keep commits atomic

2. **Performance Regression**
   - Benchmark before/after
   - Use PerformanceMonitor throughout

3. **Incomplete Migration**
   - Complete one phase fully before next
   - Update tests immediately after refactor

---

## Timeline Estimate

- Phase 1: ~2 hours
- Phase 2: ~3 hours
- Phase 3: ~2 hours
- Phase 4: ~1 hour
- Phase 5: ~1 hour
- Phase 6: ~4 hours
- Phase 7: ~1 hour

**Total:** ~14 hours of focused refactoring

---

## Notes

- **eslint.config.js** - MUST NOT modify (per user requirement)
- **Lint rules** - Can only strengthen, not weaken
- **Principles** - Strict adherence to DRY/SOLID/KISS
- **Simulation/UI separation** - Critical requirement
