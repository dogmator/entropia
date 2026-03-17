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
