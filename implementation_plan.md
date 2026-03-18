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

---

# Implementation Plan: WOW-ефект `Evolution Pulse` (2026-03-17)

## Контекст
Потрібно додати простий, але виразний візуальний ефект без змін у фізиці симуляції:
- світловий пульс при народженні організмів;
- короткий імплозивний пульс при смерті.

## task_boundary
- `src/ui/components/EvolutionPulse.tsx` (новий)
- `src/ui/Viewport.tsx`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `walkthrough.md`

## Кроки реалізації
1. Створити 3D-компонент пульсів, який:
   - слухає дельту `totalBirths/totalDeaths` зі статистики;
   - генерує пульси в позиціях організмів з render buffers;
   - анімує scale/opacity у `useFrame` з TTL.
2. Підключити компонент до сцени у `Viewport`.
3. Обмежити навантаження:
   - ліміт одночасних пульсів;
   - ліміт нових пульсів за тик.
4. Оновити документацію та walkthrough.
5. Прогнати `typecheck` і targeted unit tests.

## Критерії приймання
- Ефект візуально помітний при народженні/смерті.
- Немає впливу на simulation logic.
- TypeScript strict і тести проходять.

---

# Implementation Plan: WOW-ефект `Genetic Comet Trail` (2026-03-17)

## Контекст
Потрібно додати короткий "кометний хвіст" для новонароджених організмів:
- тривалість 2-3 секунди;
- яскраві кольори за видом;
- без втручання у simulation logic.

## task_boundary
- `src/ui/components/GeneticCometTrail.tsx` (новий)
- `src/ui/Viewport.tsx`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `walkthrough.md`
- `task.md`

## Кроки реалізації
1. Створити компонент на базі наявного `TrailSystem`.
2. Визначати newborn-кандидатів через появу нових alive-id у render buffers + дельту `totalBirths`.
3. Тримати активні comet-trails через TTL із лімітом одночасно активних ефектів.
4. Додати intro-wave при першій появі популяції для гарантованої видимості.
5. Підключити компонент у `Viewport`.
6. Прогнати `typecheck` + targeted eslint.

---

# Implementation Plan: Hot-path render performance hardening (2026-03-17)

## Контекст
Потрібно реалізувати найвпливовіші оптимізації для гарячого UI/render шляху:
1. зменшити per-frame GC/алокації;
2. прибрати надлишкові O(n)-операції у trail/comet логіці;
3. зменшити частоту зайвих React state-оновлень у кадрі.

## task_boundary
- `src/ui/components/Trails.tsx`
- `src/ui/components/GeneticCometTrail.tsx`
- `src/ui/effects/ParticleSystem.ts` (клас `TrailSystem`)
- `src/ui/context/SimulationContext.tsx`
- `src/ui/components/Entities.tsx` (лише точкові hot-path оптимізації)
- `src/ui/components/EvolutionPulse.tsx` (лише якщо потрібне усунення зайвих алокацій)
- `src/simulation/__tests__/` (тільки за потреби regression)
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `task.md`
- `walkthrough.md`

## План реалізації
1. **TrailSystem O(1) історія треку**
   - Усунути `shift()`/масиви `Vector3` у `updateTrail`.
   - Перейти на preallocated кільцеву структуру координат/alpha без per-point `new Vector3`.
   - Зберегти існуючий API `updateTrail/removeTrail/prune`.
2. **Trails.tsx мінімізація per-frame алокацій**
   - Прибрати template-string churn для id (cache-ключі/стабільні ключі).
   - Уникнути створення тимчасових об’єктів у циклі там, де це можливо без зміни API.
3. **GeneticCometTrail hot-path cleanup**
   - Замінити масові `[...]` алокації (`alive`, `aliveMap`, `newbornCandidates`) на reuse-буфери/мапи у `useRef`.
   - Знизити частоту `setRenderComets` до фактичних змін складу активних комет.
4. **SimulationContext history append optimization**
   - Прибрати `historyRef = [...historyRef, point].slice(...)` на кожному апдейті.
   - Використати кільцевий буфер/контрольований push+truncate без подвійного копіювання.
5. **Verification**
   - `pnpm exec vitest run` (повний regression).
   - `pnpm build`.
   - Зафіксувати зміни і результат у `walkthrough.md`, `task.md`, `docs/OPTIMIZATION_PLAN.md`.

## Критерії приймання
- В гарячому рендер-шляху прибрано найбільш дорогі per-frame алокації.
- Немає змін функціональної поведінки симуляції.
- `vitest run` і `build` проходять.

---

# Implementation Plan: Periodic 1Hz stutter mitigation (2026-03-17)

## Контекст
Користувач зафіксував періодичні фризи з частотою приблизно раз на секунду.

## task_boundary
- `src/config/ui.constants.ts`
- `src/config/statistics.constants.ts`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`
- `walkthrough.md`
- `task.md`

## План
1. Зменшити частоту UI stats logging.
2. Збільшити `CACHE_TIMEOUT` для статистичних heavy-обчислень.
3. Підтвердити валідацію (`typecheck`, `build`) і оновити документацію.

---

# Implementation Plan: Заборона появи їжі всередині аномалій (2026-03-17)

## Контекст
Є підозра, що фіча «їжа не з'являється всередині аномалій» закрита не повністю. Поточні тести покривають spawn через `SpawnService`, але не покривають legacy/import сценарії.

## task_boundary
- `src/simulation/services/PersistenceService.ts`
- `src/simulation/__tests__/Engine.buffers.test.ts`
- `task.md`
- `walkthrough.md`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`

## План
1. Додати санітизацію `food` під час `importState`: не завантажувати елементи їжі, що потрапляють у зони/аномалії або в заборонену дистанцію до obstacles.
2. Додати regression-тест на import сценарій: state із їжею в аномалії після `importState` не повинен містити таку їжу.
3. Перевірити, що існуючий spawn-тест і новий regression-тест проходять.
4. Оновити `task.md`, `walkthrough.md`, `README.md`, `docs/OPTIMIZATION_PLAN.md` коротким записом про закриття edge-case.

## Критерії приймання
- Після імпорту стану в engine немає `food` всередині аномалій.
- Новий тест відтворює edge-case і проходить стабільно.
- Існуючі тести на spawn-обмеження продовжують проходити.

---

# Implementation Plan: Runtime one-shot санітизація їжі в аномаліях (2026-03-17)

## Контекст
Після фіксу `importState` потрібен додатковий runtime-захист, щоб очищати legacy/кастомні стани, де їжа могла опинитися в аномаліях уже в пам'яті рушія.

## task_boundary
- `src/simulation/Engine.ts`
- `src/simulation/__tests__/Engine.buffers.test.ts`
- `task.md`
- `walkthrough.md`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`

## План
1. Додати one-shot runtime sweep для `food` на першому тіку після `start`/`reset`/`importState`.
2. Використати ту саму тороїдальну перевірку та той самий buffer (`+5`), що у spawn/persistence валідації.
3. Додати regression-тест на runtime-сценарій: вручну вставлена їжа в аномалії має бути вилучена після першого `update()`.
4. Документувати поведінку в README/walkthrough/optimization notes.

---

# Implementation Plan: Уніфікація anomaly-validator для їжі (2026-03-17)

## Контекст
Поточна логіка перевірки «їжа не всередині аномалій» дублюється у трьох місцях (`SpawnService`, `PersistenceService`, `Engine`). Це підвищує ризик розходження поведінки.

## task_boundary
- `src/simulation/utils/AnomalyValidation.ts` (новий)
- `src/simulation/utils/__tests__/AnomalyValidation.test.ts` (новий)
- `src/simulation/services/SpawnService.ts`
- `src/simulation/services/PersistenceService.ts`
- `src/simulation/Engine.ts`
- `task.md`
- `walkthrough.md`
- `README.md`
- `docs/OPTIMIZATION_PLAN.md`

## План
1. Створити спільний utility-модуль для валідації позиції відносно сферичних аномалій (zones/obstacles) з тороїдальною метрикою.
2. Перевести `SpawnService`, `PersistenceService`, `Engine` на спільний utility, зберігши поточні пороги (`+5`, `minDistance`, avoidZones behavior).
3. Додати unit-тести utility на базові сценарії (блокування зоною, перешкодою, вимкнення zone-check).
4. Прогнати regression suite (targeted vitest + typecheck) і оновити документацію.
