# Implementation Plan: Непрохідні аномалії + дискретна їжа + органічний ріст

## Контекст
Потрібно реалізувати три пов'язані зміни симуляції:
1. Аномалії (obstacles) мають стати непрохідними з пріоритетом ковзання (slide), а відбиття — fallback.
2. Їжа має зменшуватися дискретними укусами з видимим зменшенням розміру та пороговим видаленням.
3. Організми повинні стартувати малими (≈40% adult) та рости залежно від геному, віку й енергії.

## task_boundary
- `src/config/physics.constants.ts`
- `src/config/rendering.constants.ts`
- `src/simulation/Entity.ts`
- `src/simulation/systems/CollisionSystem.ts`
- `src/simulation/services/BufferManager.ts`
- `src/simulation/services/PersistenceService.ts`
- `src/types.ts`
- `src/ui/Viewport.tsx`
- `src/simulation/systems/__tests__/CollisionSystem.test.ts`
- `src/simulation/__tests__/Entity.growth-and-food.test.ts` (новий)
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `task.md`
- `walkthrough.md`

## Стратегія реалізації
1. **Food bites**
   - Додати `maxEnergy/currentEnergy/baseRadius`.
   - Реалізувати `applyBite(...)` з мінімальним порогом видалення.
   - Синхронізувати рендер-радіус з часткою енергії.
2. **Organism growth**
   - Ввести `adultRadius/currentRadius/growthRatio`.
   - Додати метод `updateGrowthFromState()` (age + energy + genome).
   - Новороджені стартують з `newbornScale = 0.4`.
3. **Impassable obstacles**
   - У колізіях: push-out + slide по дотичній, reflect як fallback.
   - Додати anti-stuck евристику (`stuckTicks`, jitter impulse).
4. **Diagnostics**
   - Показувати `currentRadius`, `adultRadius`, `%growth`, `food.currentEnergy`, `maturity`, `stuckTicks` у hover-діагностиці.
5. **Testing**
   - Unit-тести на покус їжі, порогове видалення, ріст, та slide/fallback-collision.
   - Запуск: `pnpm run test --run`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`.
   - Browser-driven smoke перевірка UI + скриншот.

## Критерії приймання
- Organisms не проникають в obstacle; при контакті ковзають уздовж поверхні.
- Food зменшує `currentEnergy`/`radius` дискретно та зникає лише за порогом.
- Новонароджені помітно менші та доростають до adult за енергією+віком.
- Нові поля доступні в діагностиці.
- Всі тести/перевірки проходять.

---

# Implementation Plan: Повний QA-прогін + користувацька UI-перевірка + production-risk аналіз

## Контекст
Користувач запросив повний прогін доступних тестів/quality gates, перевірку UI очима користувача через browser automation та аналітичний висновок у форматі 4×Top-3.

## План виконання
1. Перевірити можливість синхронізації з `dev` (fetch + наявність локальної/remote гілки).
2. Запустити доступні перевірки: lint, typecheck, unit tests, build, coverage.
3. Підняти локальний dev-сервер і провести browser-driven UI smoke.
4. Зафіксувати screenshot-артефакт і підготувати деталізований звіт.
5. Сформувати 4 пріоритизовані Top-3 з фокусом на production-ризиках.

## Артефакти
- `docs/TESTING_REPORT_2026-03-15.md`
- оновлення `docs/OPTIMIZATION_PLAN.md`
- оновлення `walkthrough.md`
- оновлення `task.md`

---

# Implementation Plan: Production-impact improvements після QA (2026-03-15)

## Реалізаційний scope
1. **Performance**
   - Декомпозиція `SimulationEngine.update()` на локальні pipeline-етапи.
   - Зменшення шуму команд у `EngineProxy` (dedup `setSpeed`, dedup loop commands, batched `setConfig`).
   - Lazy-loading важких UI-модулів (`SettingsPanel`, `DiagnosticsModal`) для зниження pressure initial bundle.
2. **Refactoring / Contract gaps**
   - Реалізація `exportState`/`importState` у proxy+worker контракті замість `not implemented`.
   - Посилення типізації async payload у proxy.
3. **UI/UX**
   - Явні стани керування симуляцією (`run/pause/stop`) з disabled-state.
   - Безпечні clamp-обмеження для налаштувань симуляції.
   - Empty/degraded state для графіків діагностики при відсутності метрик.
4. **Fault-tolerance / ecosystem balance**
   - Fail-safe guards: pause при підтвердженому extinction, recovery spawn при тривалому zero-food.
   - Негативні unit-тести для proxy state-sync сценаріїв.

## Валідація
- `pnpm run typecheck`
- `pnpm exec vitest run`
- `pnpm run build`
- `pnpm run lint` (із фіксацією залишкового debt)
- `pnpm run test:coverage -- --run` (best effort)
- browser-driven UI smoke + screenshot

---

# Implementation Plan: Merge verification pass (2026-03-15)

## Scope
1. Перевірити order-safe поведінку `EngineProxy` batching/dedup.
2. Підтвердити порядок system pipeline після декомпозиції `Engine.update`.
3. Перевірити lazy-loaded UI в контексті `SimulationContext`.
4. Додати unit-тест інваріанту `state === import(export(state))` і виправити persistence за потреби.

---

# Implementation Plan: Stabilization pass (merge-readiness)

## Scope (без розширення етапу)
1. Diff-focused self-review ключових файлів поточного PR.
2. Локальний hardening race-sensitive місць у batching/flush `EngineProxy`.
3. Додаткові unit-тести на запитані послідовності команд і persistence repeat cycle.
4. Повторна валідація typecheck/tests/build/lint/coverage-attempt.

---

# Implementation Plan: EngineProxy async timeout lifecycle hardening (2026-03-16)

## Контекст
У `EngineProxy.sendAsyncCommand` створюється `setTimeout` для кожного async-запиту, але при успішній відповіді цей таймер не очищається. Під навантаженням це створює зайві активні таймери, що погіршує масштабованість і може спричиняти деградацію продуктивності event loop.

## Scope
- `src/simulation/EngineProxy.ts`
- `src/simulation/__tests__/EngineProxy.test.ts`
- `docs/OPTIMIZATION_PLAN.md`
- `walkthrough.md`
- `README.md`
- `task.md`

## Кроки
1. Розширити `PendingRequest` timeout handle та очищати його при `commandResponse`.
2. Очищати timeout handle також у fallback-path (dispose/timeout).
3. Додати unit-тест на гарантію відсутності timeout-rejection після вчасної відповіді.
4. Прогнати `vitest`, `typecheck`, `lint`.

---

# Implementation Plan: PerformanceMonitor history buffer O(1) hardening (2026-03-17)

## Context
Найкритичніший bottleneck у `PerformanceMonitor` — видалення першого елемента через `Array.shift()` на кожному переповненні історії кадрів. Це створює O(n) копіювання масиву в гарячому циклі `endFrame()`.

## task_boundary
- `src/core/services/PerformanceMonitor.ts`
- `src/core/utils/__tests__/PerformanceMonitor.test.ts`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `task.md`
- `walkthrough.md`

## Fix strategy
1. Замінити `shift()` на кільцевий буфер фіксованого розміру (`entriesStart`).
2. Інкапсулювати запис/читання через `storeEntry`, `getLatestEntry`, `getOrderedEntries`.
3. Оновити місця читання історії та latest-метрик на нові helper-методи.
4. Додати unit-тест на коректність обрізки/порядку/актуального останнього кадру.
5. Прогнати targeted tests + typecheck + lint (best-effort з фіксацією pre-existing debt).

---

# Implementation Plan: EventBus onAll duplicate-delivery hardening (2026-03-17)

## Контекст
Глобальний API `EventBus.onAll` дублював обробку подій: callback реєструвався і на конкретні типи, і на `'*'`.

## Стратегія
1. Прибрати per-type реєстрації з `onAll`.
2. Залишити лише `'*'`-реєстрацію, оскільки `emit()` уже дистрибутує global callbacks.
3. Додати unit-тест на exactly-once delivery для `onAll`.
4. Прогнати checks: targeted test, typecheck, lint.

## Критерії
- `onAll` callback викликається рівно один раз на один `emit`.
- Поведінка інших API `EventBus` не змінена.

---

# Implementation Plan: Worker render-buffer transfer pressure hardening (2026-03-17)

## Контекст
У worker-loop на кожному тіку передаються великі `Float32Array` рендер-буфери через `postMessage` без transferables. Це провокує постійне deep-copy між потоками і масштабно збільшує CPU/memory pressure при рості популяції.

## План
1. Ізолювати snapshot-утиліту для формування компактних views тільки на фактично заповнені елементи (`count * stride`).
2. Для не-SAB буферів створювати копію лише used-length та передавати `ArrayBuffer` як transferable.
3. Для `SharedArrayBuffer` зберегти zero-copy поведінку без transfer-list.
4. Додати unit-тести на обидва сценарії (transferable і SAB).
5. Прогнати `vitest` (targeted), `typecheck`, `lint`.

---

# Implementation Plan: EventBus history O(1) scalability hardening (2026-03-17)

## Контекст
`EventBus.emit()` обрізав історію подій через `Array.shift()`. У високочастотному потоці це створює O(n) копіювання масиву, що знижує пропускну здатність шини подій.

## task_boundary
- `src/core/EventBus.ts`
- `src/core/__tests__/EventBus.test.ts`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `task.md`
- `walkthrough.md`

## План
1. Замінити історію подій на кільцевий буфер фіксованої місткості (100).
2. Зберегти публічний API без поведінкових змін (`getHistory`, `getLastEvent`, `clearHistory`).
3. Додати unit-тест на переповнення буфера та порядок подій.
4. Прогнати targeted tests + quality checks.

---

# Implementation Plan: Непрохідність організмів для зон-аномалій (2026-03-17)

## Scope
1. Заборонити проникнення/рух організмів всередині екологічних сфер (зони трактуються як тверді аномалії).
2. Додати freeze-поведінку для організмів, які вже опинилися глибоко всередині аномалії.
3. Забезпечити ковзання/відбиття при контакті зі стінкою аномалії через існуючу collision-модель.
4. Заборонити spawn/reproduction організмів у межах аномалій.
5. Додати unit-тести для collision та spawn-обмежень.
