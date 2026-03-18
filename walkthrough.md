# Walkthrough

## Етап 1 — Планування
- Сформовано implementation plan.
- Визначено 8 smell-ів та таргет-файли.

## Етап 2 — Рефакторинг (виконано)
- Додано `LogPayload`, `ConsoleCapturePayload`, `RemoteCommand` для типобезпечності та спрощення сигнатур.
- Приватні методи переведені на об’єктні payload-аргументи для усунення long parameter list.
- Декомпозовано console-вивід на `shouldOutputToConsole`, `resolveConsoleMethod`, `buildConsoleMessage`.
- Винесено `LOGGER_RECONNECT_DELAY_MS` і `PERFORMANCE_PRECISION_DIGITS` замість магічних чисел.

## Етап 3 — Валідація (частково виконано)
- `pnpm -s test --run src/core/services/__tests__/Logger.test.ts` ✅
- `pnpm -s eslint src/core/services/Logger.ts src/core/services/__tests__/Logger.test.ts` ✅
- `pnpm -s typecheck` ⚠️ (є pre-existing помилка у `SimulationContext.tsx`)

## Етап 4 — Документація (виконано)
- README оновлено секцією про refactor Logger.
- docs/OPTIMIZATION_PLAN.md доповнено записом про усунення ТОП-8 smell-ів.

## Етап 5 — Продовження покращень (виконано)
- Виправлено `SimulationContext` для TypeScript strict (`cmd['action']`).
- Винесено FPS-обчислення у pure helper `src/ui/context/fps.ts`.
- Додано unit-тести `src/ui/context/__tests__/fps.test.ts`.
- Перевірки: targeted tests + targeted eslint + full typecheck.

## Етап 6 — Академічний hardening логування (виконано)
- Переплановано scope на 32+ оптимізації в `implementation_plan.md`.
- `scripts/log-server.ts`: прибрано `any`, додано type-guards, усунено nested ternary, централізовано ANSI/command/error-коди, виділено pure helpers для парсингу/форматування.
- `src/core/services/logger/transports/WebSocketTransport.ts`: додано ідемпотентний toggle enable, декомпозовано socket lifecycle, покращено send/flush error-handling без ignored exceptions, винесено reconnect-константу.
- `src/core/services/logger/Logger.ts`: payload-орієнтоване API приватних методів, guard на invalid minutes, контроль maxLogs, інкрементальні stats counters (без повторних full-filter проходів), стабільний cleanup зі sync статистики.
- Додано unit-тести: `Logger.academic.test.ts` та `WebSocketTransport.test.ts`.
- Валідація: targeted tests + targeted eslint + full typecheck.

## Етап 7 — Академічна стабілізація v4 (64+ оптимізації, виконано)
- `src/core/services/Logger.ts`: посилено dedup через стабільний ключ, додано safe stringify для циклічних структур, queue backpressure, окремі helper-и console/render/remote flow, ідемпотентне remote toggle, reconnect timer lifecycle, захист від мутації локальних log-entry при remote send.
- `src/core/services/__tests__/Logger.test.ts`: розширено покриття (maxLogs trim, invalid minutes fallback, source immutability, queue overflow policy).
- `src/core/services/logger/transports/WebSocketTransport.ts`: додано bounded queue, reconnect-timer guard/cleanup, decomposition handleOpen/handleClose/handleError, overflow trimming policy.
- `src/core/services/logger/__tests__/WebSocketTransport.test.ts`: додано кейс overflow trimming + bounded flush.
- `src/core/services/logger/Logger.ts`: додано safe stringify compare для dedup, `getLogsByLevel`, покриття circular payload dedup.
- `scripts/log-server.ts`: payload-size/message-size/source-size санітизація, safer JSON parse diagnostics, валідований broadcast command.
- `vite.config.ts`: checker-plugin переведено в optional async-loading за `VITE_ENABLE_CHECKER=true`, щоб production build та pre-commit не залежали від локальної наявності checker-пакета.
- Валідація: на кожному етапі змін коду виконувались tests + eslint + typecheck; додатково верифіковано `pnpm -s build`.

## Етап 8 — Комплексне тестування функціональності (2026-03-15, виконано)
- Перед стартом перевірено можливість синхронізації з `dev` (`git remote -v`, `git branch --all`): remote не налаштовані, доступна лише локальна гілка `work`.
- Виконано повний регресійний прогін:
  - `pnpm run test --run` ✅
  - `pnpm run typecheck` ✅
  - `pnpm run build` ✅
  - `pnpm run lint` ❌ (pre-existing lint debt)
- З точки зору користувача виконано browser automation сценарій:
  - відкриття UI,
  - взаємодія з `🔍 Діагностика` і всіма ключовими вкладками,
  - перевірка кнопок керування симуляцією,
  - фіксація скриншота.
- Підсумковий звіт винесено в `docs/TESTING_REPORT_2026-03-15.md`.

## Етап 9 — Непрохідні аномалії, дискретна їжа та ріст (виконано)
1. Додано модель енергії їжі (`maxEnergy/currentEnergy/baseRadius`) і `applyBite` з cooldown.
2. Перероблено food collision: prey споживають їжу укусами, а не миттєвим видаленням.
3. Додано органічний ріст організмів (`adultRadius`, `growthRatio`, `maturityRatio`, `stuckTicks`).
4. Додано slide-first обробку obstacle collisions + fallback reflect + anti-stuck impulse.
5. Розширено hover-діагностику (radius/growth/maturity/stuck/current food energy).
6. Додано unit-тести для росту/їжі та оновлено тести колізій.

## Етап 10 — Комплексне тестування та production-risk аудит (2026-03-15)
1. Перевірено git-синхронізацію з `dev` до старту: в оточенні немає `dev/origin/dev`.
2. Запущено доступні quality gates: `pnpm run lint`, `pnpm run typecheck`, `pnpm exec vitest run`, `pnpm run build`, `pnpm run test:coverage -- --run`.
3. Проведено user-perspective UI smoke в browser container (кнопки, sliders, діагностика, короткий soak).
4. Зафіксовано артефакт screenshot та сформовано повний тестовий звіт.
5. Складено 4 блоки Top-3 з пріоритетами за production-ризиком і очікуваним ефектом.

## Етап 11 — Реалізація production-impact покращень (2026-03-15)
1. Розкладено гарячий `SimulationEngine.update()` на локальні етапи pipeline та додано fail-safe guards.
2. В `EngineProxy` додано dedup/batching команд і закрито contract gap (`exportState`/`importState`) через worker-команди.
3. Додано негативні unit-тести `EngineProxy.test.ts` (dedup, batched config, export fallback, import command).
4. UI керування доповнено явними станами `run/pause/stop`, disabled-state та захистом параметрів через clamp.
5. Діагностика отримала empty/degraded state для графіків при відсутніх даних.
6. Застосовано lazy-loading `SettingsPanel` + `DiagnosticsModal` для зниження initial runtime/bundle pressure.

## Етап 12 — Merge verification pass (2026-03-15)
1. Додано order-safety для batched `setConfig` у `EngineProxy` через flush перед critical-командами.
2. Додано unit-тести на порядок pipeline systems та на інваріант `state === import(export(state))`.
3. Посилено `PersistenceService.importState`: відновлення `rngState` + синхронізація статистики після імпорту.
4. Підтверджено browser-верифікацією, що lazy-loaded панелі коректно читають `SimulationContext`.

## Етап 13 — Stabilization pass (merge-readiness)
1. Виконано diff-focused self-review по ключових файлах PR.
2. Посилено batching/flush order-safety в `EngineProxy`.
3. Додано додаткові unit-тести послідовностей команд proxy.
4. Додано повторний persistence-cycle тест для перевірки дрейфу стану.
5. Прогнано typecheck/tests/build/lint/coverage-attempt та зафіксовано результати.

## Етап 14 — EngineProxy timeout lifecycle hardening (2026-03-16)
1. Локалізовано критичний bottleneck у `EngineProxy.sendAsyncCommand`: timeout-таймери не очищались після успішної відповіді.
2. Додано явний `timeoutId` у pending-request та централізований cleanup.
3. Забезпечено cleanup у трьох гілках: success-response, timeout-reject, dispose.
4. Додано unit-тест, що перевіряє відсутність повторного reject після вже успішно завершеної async-команди.
5. Прогнано `vitest` (targeted), `typecheck`, `lint` (lint фіксує pre-existing debt поза scope).

## Етап 15 — PerformanceMonitor O(1) history hardening (2026-03-17)
1. Локалізовано масштабний ризик у гарячому шляху: `Array.shift()` у `endFrame()` виконував O(n) копіювання масиву при кожному переповненні історії.
2. Реалізовано кільцевий буфер (`entriesStart`) для збереження історії кадрів з O(1) вставкою.
3. Інкапсульовано доступ до історії через `storeEntry`, `getLatestEntry`, `getOrderedEntries`, щоб зберегти попередню семантику API.
4. Додано unit-тест на переповнення буфера, який перевіряє збереження порядку та актуальність останнього запису.
5. Валідація:
   - `pnpm test --run src/core/utils/__tests__/PerformanceMonitor.test.ts` ✅
   - `pnpm typecheck` ✅
   - `pnpm lint` ❌ (значний pre-existing lint debt поза scope змін)

## Етап 16 — EventBus onAll duplicate-delivery hardening (2026-03-17)
1. Виявлено архітектурний дефект у `EventBus.onAll`: callback одночасно реєструвався на кожен поточний тип події і в `'*'`.
2. Це створювало дубльовану доставку одного й того ж event до глобального слухача та зайве зростання пам'яті пропорційно кількості типів подій.
3. Реалізовано точковий fix: `onAll` тепер реєструє лише `'*'`-слухач, а `emit()` вже забезпечує дистрибуцію до глобальних callbacks.
4. Додано unit-тест `src/core/__tests__/EventBus.test.ts` на інваріант exactly-once для `onAll`.
5. Валідація: targeted test ✅, typecheck ✅, lint ❌ (наявний pre-existing lint debt поза scope).

## Етап 17 — Worker render-buffer transfer hardening (2026-03-17)
1. Локалізовано критичний bottleneck у `simulation.worker.ts`: кожен `updated` кадр серіалізував великі `Float32Array` без transferables.
2. Додано `workerSnapshot.ts`, який формує компактний snapshot за `count * stride` та готує `transferables` для non-SAB буферів.
3. Оновлено `sendResponse` у worker для підтримки `postMessage(response, transferables)`.
4. Збережено існуючу zero-copy семантику для `SharedArrayBuffer` (без transfer-list).
5. Додано unit-тест `workerSnapshot.test.ts` для обох режимів передачі.
6. Валідація: targeted test ✅, typecheck ✅, lint ❌ (наявний pre-existing lint debt поза scope).

## Етап 18 — EventBus history O(1) scalability hardening (2026-03-17)
1. Проведено root-cause аналіз: `EventBus.emit()` використовував `Array.shift()` при переповненні історії, що створювало O(n) копіювання в гарячому шляху.
2. Реалізовано кільцевий буфер історії (`historyStart`, `historySize`, `appendToHistory`, `readHistory`) з O(1) вставкою/перезаписом.
3. Адаптовано `getHistory`, `getLastEvent`, `clearHistory` під нову модель збереження без зміни публічної поведінки.
4. Додано regression unit-тест на сценарій 120 подій при місткості 100 для перевірки порядку та latest-event.
5. Валідація:
   - `pnpm run test --run src/core/__tests__/EventBus.test.ts` ✅
   - `pnpm run typecheck` ✅
   - `pnpm exec eslint src/core/EventBus.ts src/core/__tests__/EventBus.test.ts` ✅
   - `pnpm run lint` ❌ (наявний pre-existing lint debt у великій кількості файлів поза scope)

## Етап 19 — UI reset + worker/browser compatibility hardening (2026-03-17)
1. Відтворено симптом: після `stop` + вимирання популяції `reset` не оновлює відразу візуальний стан через відсутність `updated`-повідомлення.
2. Реалізовано точковий fix у `EngineProxy.reset()`: після `reset` надсилається один `update` для синхронізації буферів.
3. Усунуто `SharedArrayBuffer is not defined` у воркері через feature-detection перед `instanceof`.
4. Прибрано шумові WebSocket помилки 127.0.0.1:3013: remote logging за замовчуванням вимкнено, ввімкнення тільки через localStorage opt-in.
5. Усунуто manifest 404: додано `public/icon-192.png` та `public/icon-512.png`.
6. Валідація:
   - `pnpm test --run src/simulation/__tests__/workerSnapshot.test.ts src/simulation/__tests__/EngineProxy.test.ts` ✅
   - `pnpm typecheck` ✅
   - `pnpm exec eslint ...` ❌ (pre-existing lint debt у тестових файлах поза scope поточного hotfix)

## Етап 20 — Organism vs anomaly hardening (2026-03-17)
1. Уточнено вимогу: напівпрозорі сферичні зони на сцені мають працювати як повністю непрохідні аномалії для організмів.
2. Розширено `CollisionSystem.update(...)`: додано `zones`, а також pre-check `handleZoneCollisions`.
3. Для організмів, що повністю всередині аномалії, реалізовано freeze (обнулення velocity/acceleration).
4. Для зіткнень зі стінкою аномалії використано той самий slide-first / reflect-fallback механізм, що й для obstacle.
5. Оновлено spawn-логіку: `SpawnService` тепер блокує spawn/reproduction організмів у межах зон.
6. Додано unit-тести: freeze у `CollisionSystem.test.ts` і spawn-заборона у `SpawnService.anomaly.test.ts`.

## Етап 21 — Evolution Pulse visual effect (2026-03-17)
1. Додано новий компонент `src/ui/components/EvolutionPulse.tsx`.
2. Ефект підписаний на дельти `totalBirths/totalDeaths` через `SimulationContext` і не змінює simulation pipeline.
3. Позиції пульсів семпляться з render buffers:
   - birth pulse: позиції живих організмів;
   - death pulse: позиції мертвих організмів.
4. Анімація реалізована в `useFrame` (fade-out opacity + expansion scale) з TTL для авто-видалення.
5. Додано ліміти на інтенсивність: максимум пульсів за тик і максимум активних пульсів.
6. Інтеграція у сцену виконана через `Viewport` (`<EvolutionPulse engine={engine} />`).

## Етап 22 — Genetic Comet Trail visual effect (2026-03-17)
1. Додано новий компонент `src/ui/components/GeneticCometTrail.tsx`.
2. Реалізовано newborn-detection через появу нових alive-id у render buffers.
3. Додано intro-wave, щоб ефект був видимий одразу після старту/reset.
4. Для новонароджених запускається короткий trail (`TrailSystem`) з яскравим кольором за видом.
5. Додано обмеження продуктивності: TTL, max active comets, max new comets per frame.
6. Інтеграція в сцену через `Viewport` (`<GeneticCometTrail engine={engine} />`).

## Етап 23 — 1Hz stutter mitigation (2026-03-17)
1. Локалізовано регулярний фриз із періодом ~1 сек у двох джерелах: UI stats logging і статистичний cache refresh.
2. Зменшено частоту логування stats у UI: `SERVER_LOG_INTERVAL` 60 -> 300.
3. Збільшено період cache-refresh у `StatisticsManager`: `CACHE_TIMEOUT` 1000ms -> 3000ms.
4. Реалізовано без зміни simulation logic; лише зниження періодичного overhead.

## Етап 24 — Food anomaly import hardening (2026-03-17)
1. Локалізовано пропущений edge-case: під час `importState` їжа завантажувалась без геометричної валідації щодо зон/перешкод.
2. У `PersistenceService` додано санітизацію `state.food`: елементи, що потрапляють у заборонену дистанцію до zones/obstacles, не імпортуються.
3. Для узгодженості з runtime-spawn використано ту саму тороїдальну метрику та той самий buffer (`+5`) до радіуса аномалій.
4. Додано regression-тест `Engine.buffers.test.ts`: legacy-state з їжею всередині зони/перешкоди після `importState` очищується.

## Етап 25 — Runtime one-shot санітизація їжі (2026-03-17)
1. Додано в `SimulationEngine` прапорець `needsFoodAnomalySanitization` для одноразового cleanup без постійного оверхеду.
2. На першому тіку після `start`/`reset`/`importState` виконується sweep `food` проти зон і перешкод.
3. Геометрична перевірка використовує тороїдальну дистанцію та той самий safety-buffer `+5`, що у spawn/persistence-шляху.
4. Додано regression test: їжа, вручну вставлена в центр аномалії, видаляється після `update()`, валідна їжа зберігається.

## Етап 26 — Уніфікація anomaly-validator (2026-03-17)
1. Створено `src/simulation/utils/AnomalyValidation.ts` з єдиною функцією `isPositionBlockedByAnomalies`.
2. Переведено `SpawnService`, `PersistenceService` і `SimulationEngine` на спільний utility без зміни семантики порогів.
3. Додано unit-тести `src/simulation/utils/__tests__/AnomalyValidation.test.ts`, включно з toroidal boundary-case.
4. Ефект: прибрано дублювання і синхронізовано правила валідації між spawn/import/runtime шляхами.

## Етап 27 — Повний regression після anomaly hardening (2026-03-17)
1. Прогнано повний тестовий набір у non-watch режимі: `pnpm exec vitest run` — `18/18` test files, `126/126` tests ✅.
2. Прогнано production-збірку: `pnpm build` ✅.
3. Зафіксовано, що `pnpm test` у поточній конфігурації запускає watch-режим; для одноразового прогону використовується `pnpm exec vitest run`.
4. Додаткових runtime-regression після уніфікації anomaly-validator не виявлено.

## Етап 28 — Hot-path render performance hardening (2026-03-17)
1. `TrailSystem` переведено на O(1) кільцевий буфер історії позицій без `Array.shift()` і без `new THREE.Vector3` у кожному апдейті трейлу.
2. `Trails.tsx`: додано cache id (`prey_*/predator_*`) і reuse параметрів `position/color/enabled`, щоб зменшити per-frame object/string churn.
3. `GeneticCometTrail.tsx`: прибрано масові `alive/newborn` масивні алокації через reuse `Map`/`Array` буферів, snapshot-cache, id-cache; `setRenderComets` викликається лише при фактичній зміні активних комет.
4. `Entities.tsx`: оновлення `emissiveIntensity` тепер виконується тільки при зміні `showEnergyGlow`, без зайвих щокадрових записів у матеріали.
5. `SimulationContext.tsx`: `appendHistoryPoint` замінено на push+truncate без подвійного копіювання масиву на кожному тіку.
6. Валідація:
   - `pnpm run typecheck` ✅
   - `pnpm exec vitest run` ✅ (`18/18`, `126/126`)
   - `pnpm build` ✅

## Етап 29 — Dev remote logging auto-enable + bounded log file (2026-03-17)
1. Додано helper `resolveRemoteLoggingEnabled`: у dev remote logging увімкнено за замовчуванням, але `localStorage['entropia:remoteLogging']='0'` вимикає його явно.
2. `src/ui/index.tsx` переведено на новий helper, тож ручний крок `setItem(...,'1')` більше не обов'язковий у dev.
3. У `scripts/log-server.ts` підключено bounded append: `remote_debug.log` має ліміт 5 MB, при перевищенні файл підрізається до останніх 4 MB.
4. Додано unit-тести:
   - `src/ui/utils/__tests__/remoteLogging.test.ts`
   - `scripts/__tests__/log-file-utils.test.ts`
5. Валідація:
   - `pnpm run typecheck` ✅
   - `pnpm exec vitest run src/ui/utils/__tests__/remoteLogging.test.ts scripts/__tests__/log-file-utils.test.ts` ✅
   - `pnpm build` ✅
