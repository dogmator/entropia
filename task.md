# task_boundary

## Задача
Довести logging stack до академічного ідеалу через 64+ виправлення з фокусом на fault-tolerance, type-safety, predictability і стабільний pre-commit pipeline.

## Гранульовані підзадачі
- [x] Перепланувати етап у `implementation_plan.md`.
- [x] Оптимізувати `src/core/services/Logger.ts` та оновити його unit-тести.
- [x] Оптимізувати `src/core/services/logger/Logger.ts` та розширити unit-тести.
- [x] Hardening `WebSocketTransport` + нові unit-тести.
- [x] Hardening `scripts/log-server.ts`.
- [x] Зробити `vite.config.ts` стійким для build без checker-залежності.
- [x] Прогнати tests + eslint + typecheck після кожного кодового етапу.
- [x] Оновити `walkthrough.md`, `README.md`, `docs/OPTIMIZATION_PLAN.md`.

## task_boundary (2026-03-15): impassable anomalies + food bites + growth
- Реалізувати дискретні укуси їжі з cooldown і пороговим видаленням.
- Реалізувати ріст організмів: newborn ~40% adult, ріст за age+energy+genome.
- Реалізувати slide-first колізії з перешкодами та anti-stuck fallback.
- Розширити hover-діагностику полями growth/energy/collision.
- Додати unit-тести нової логіки.

## task_boundary (2026-03-15): full QA + UX smoke + production-risk Top-3
- Перевірити можливість підтягнути зміни з `dev` перед тестуванням.
- Прогнати всі доступні перевірки якості з репозиторію/CI.
- Виконати browser-driven user-perspective перевірку UI з артефактом screenshot.
- Сформувати тестовий звіт з переліком виконаних та невиконаних перевірок.
- Підготувати 4 блоки Top-3: performance, refactoring/docs, UI/UX, fault-tolerance/ecosystem balance.

## task_boundary (2026-03-15): production-impact implementation package
- Реалізувати pipeline decomposition у `SimulationEngine.update`.
- Реалізувати message dedup/batching та import/export state contract у proxy/worker.
- Реалізувати явну модель run/pause/stop у UI controls.
- Додати fail-safe guards для деградаційних станів симуляції.
- Додати негативні тести для proxy sync/commands.
- Оновити документацію та тестовий звіт після реалізації.

## task_boundary (2026-03-15): merge verification pass
- Перевірити batching/dedup order-safety в `EngineProxy`.
- Підтвердити порядок simulation systems в `Engine.update`.
- Перевірити lazy-loaded UI з `SimulationContext`.
- Додати unit-test `state === import(export(state))`.

## task_boundary (2026-03-15): stabilization pass
- Diff-focused self-review ключових файлів поточного PR.
- Локальний hardening batching/flush order-safety без нового рефакторинг-етапу.
- Додати повторний persistence-cycle test.
- Додати/розширити тести на запитані послідовності команд proxy.

## task_boundary (2026-03-16): EngineProxy async timeout lifecycle hardening
- Усунути накопичення timeout-таймерів у `sendAsyncCommand` після успішного `commandResponse`.
- Гарантувати очищення timeout-handle також під час `dispose`.
- Додати unit-тест на cleanup timeout після успішної async-відповіді.
- Прогнати regression checks: targeted unit tests + typecheck + lint.

## task_boundary (2026-03-17): PerformanceMonitor O(1) history hardening
- Усунути O(n) `Array.shift()` у `PerformanceMonitor.endFrame`.
- Впровадити кільцевий буфер для frame-history без зміни бізнес-семантики метрик.
- Додати unit-тест для переповнення історії: порядок + актуальність latest-entry.
- Прогнати regression checks: targeted test + typecheck + lint (із фіксацією залишкового debt поза scope).

## task_boundary (2026-03-17): EventBus onAll duplicate-delivery hardening
- Усунути дублювання callback-викликів у `EventBus.onAll`, яке масштабувало обробку як `O(k + m)` підписок на `k` типів подій.
- Залишити лише глобальну підписку `'*'` для гарантії exactly-once delivery на одну подію.
- Додати regression unit-тест на інваріант: `onAll` викликає callback рівно один раз.
- Прогнати checks: targeted unit test + typecheck + lint (із фіксацією pre-existing debt).

## [2026-03-17] Worker buffer transfer hardening
- [x] Root-cause: воркер відправляв `updated` payload через `postMessage` без transferables, що викликало копіювання великих typed arrays на кожному кадрі.
- [x] Виділено окремий `workerSnapshot` для compact snapshot + transfer-list.
- [x] Додано unit-тести для non-shared і SharedArrayBuffer сценаріїв.
- [x] Валідація: targeted test, typecheck, lint (lint debt pre-existing).

## task_boundary (2026-03-17): EventBus history O(1) scalability hardening
- Локалізувати bottleneck в `EventBus.emit()` через O(n) `Array.shift()` на кожному переповненні історії.
- Замінити історію подій на кільцевий буфер фіксованої місткості без зміни публічного контракту.
- Додати regression unit-тест на інваріанти: capacity=100, порядок подій, correct last event.
- Прогнати quality gates для змін: targeted test + typecheck + eslint (targeted), зафіксувати pre-existing global lint debt.

## task_boundary (2026-03-17): organism vs anomaly hardening
- Трактувати зони як непрохідні аномалії для організмів.
- Freeze організмів, що вже знаходяться всередині аномалії.
- Реюзнути slide/reflect collision response для зіткнень зі стінкою аномалії.
- Заборонити spawn/reproduction організмів усередині зон.
- Додати unit-тести на freeze та spawn-заборону.

## task_boundary (2026-03-17): Evolution Pulse WOW effect
- Додати lightweight візуальний ефект пульсу для подій birth/death.
- Джерело тригерів: дельта `totalBirths/totalDeaths` у simulation stats.
- Джерело координат: `RenderBuffers` (alive для birth, dead для death).
- Реалізувати TTL-анімацію scale+opacity у `useFrame`.
- Інтегрувати компонент у `Viewport` без змін simulation logic.

## task_boundary (2026-03-17): Genetic Comet Trail WOW effect
- Додати post-birth trail-ефект для новонароджених організмів (`GeneticCometTrail`).
- Детектити newborn через нові alive-id у render buffers + дельту `totalBirths`.
- Додати intro-wave для миттєвої візуальної демонстрації після старту/reset.
- Реалізувати TTL та guardrails (max active / max new per frame).
- Інтегрувати компонент у `Viewport` без змін simulation logic.

## task_boundary (2026-03-17): periodic stutter mitigation
- Зменшити щосекундний overhead у UI-логуванні статистики.
- Знизити частоту cache-refresh у `StatisticsManager`, що викликав 1Hz піки обчислень.
- Валідувати відсутність регресій через `typecheck` + `build`.

## task_boundary (2026-03-17): food anomaly import hardening
- Усунути legacy-case: їжа з import-state не повинна з'являтися в межах аномалій (zones/obstacles).
- Додати санітизацію `state.food` під час `PersistenceService.importState`.
- Додати regression unit-test на import сценарій з їжею всередині аномалії.
- Оновити документацію про закриття edge-case.

## task_boundary (2026-03-17): runtime food anomaly sanitation
- Додати one-shot runtime-санітизацію їжі проти зон/перешкод на першому тіку після старту.
- Після `reset` і `importState` повторно активувати санітизаційний sweep.
- Додати regression unit-test на runtime-edge-case (legacy invalid food in memory).
- Оновити технічну документацію щодо нового safety-gate.

## task_boundary (2026-03-17): anomaly-validator unification
- Винести спільну геометричну перевірку аномалій у окремий utility-модуль.
- Усунути дублювання валідації у `SpawnService`, `PersistenceService` та `Engine`.
- Додати unit-тести для utility з перевіркою toroidal-case.
- Оновити документацію щодо уніфікації safety-логіки.

## task_boundary (2026-03-17): hot-path render performance hardening
- Усунути O(n) і GC-heavy операції в `TrailSystem.updateTrail` (`shift`/`Vector3` allocations) через O(1) кільцевий буфер.
- Зменшити per-frame алокації у `Trails` (cache id, reuse params objects).
- Зменшити per-frame алокації у `GeneticCometTrail` (reuse map/list buffers, cache id/snapshots, sync render state лише при фактичній зміні активних комет).
- Зменшити копіювання історії в `SimulationContext.appendHistoryPoint`.
- Виконати regression checks: `typecheck` + `vitest run` + `build`.

## task_boundary (2026-03-17): dev remote logging auto-enable + file size cap
- Увімкнути remote logging за замовчуванням у dev без ручного `localStorage` кроку.
- Зберегти можливість override через `localStorage['entropia:remoteLogging']`.
- Обмежити розмір `remote_debug.log` у `log-server` з авто-підрізанням старих записів.
- Додати unit-тести для нового dev-toggle та file-cap helper.
- Оновити документацію і перевірити `typecheck` + targeted tests + `build`.

## task_boundary (2026-03-18): phased performance overhaul
- Етап 1: розділити simulation cadence і render snapshot cadence у worker/proxy. ✅
- Етап 2: зменшити churn серіалізації render buffers у `BufferManager`/`workerSnapshot`. ✅
- Етап 3: скоротити кількість проходів по `organisms` через single-pass aggregation у `Engine`/`StatisticsManager`. ✅
- Етап 4: децимувати UI state updates та додати adaptive degrade для дорогих VFX.
- Етап 5: виконати повний regression, build, lint, browser smoke та оновити документацію після кожного етапу.
- Після кожного кодового етапу запускати tests + quality gates згідно з user instruction.

## task_boundary (2026-03-26): URL ↔ state synchronization for SimulationConfig
- Реалізувати strict-typed ініціалізацію `SimulationConfig` з `window.location.search`.
- Забезпечити clean URL (лише відхилення від default; очистка `?` при повному збігу).
- Для frequent updates застосувати debounced `history.replaceState`, для дискретних — `history.pushState`.
- Підтримати browser navigation (`popstate`) з миттєвим оновленням UI-стану.
- Ігнорувати невідомі ключі URL і падати на default для невалідних значень.
- Додати unit-тести для URL-sync утиліт і прогнати quality gates.
