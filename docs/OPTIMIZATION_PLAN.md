# План оптимізації

## 1. Діагностика проблеми (Diagnosis)
- Симуляція продовжує виконувати `update()`, хоча на екрані залишаються лише мертві організми та їжа. Це відбувається через **надмірну ефективність хижаків** та **недостатню швидкість розмноження травоїдних**, що призводить до швидкого вимирання всіх живих організмів. Крім того, відсутня умова зупинки симуляції, що дозволяє продовжувати обчислення без сенсу.

## 2. Технічні виправлення (Engine Logic)
- Додати перевірку на завершення гри (Game Over) у метод `Engine.update()`.
- Якщо `this.organisms.size === 0`, викликати `this.stop()` та задокументувати подію як `EXTINCTION` (логування).
- При зупинці виводити повідомлення в консоль та/або UI, щоб користувач розумів причину зупинки.

## 3. Біологічне балансування (Game Design)
- **Травоїдні (Prey):**
  - Збільшити параметр `reproductionThreshold` (швидкість розмноження) або початкову популяцію, щоб вони могли підтримувати чисельність під тиском хижаків.
- **Хижаки (Predators):**
  - Підвищити `energyLossRate` (швидкість втрати енергії), щоб хижаки швидше голодували, якщо не знайдуть жертв, запобігаючи їх масовому вимиранню за 10 секунд.
- **Сенсори:**
  - Перевірити значення `sensorRadius` у `types.ts`. Якщо радіус занадто малий, організми можуть не «бачити» їжу, що призводить до їх смерті навіть у присутності ресурсів.

## 4. План дій (Action Plan)
- **Крок 1:** Додати перевірку `Game Over` у `Engine.update()` та реалізувати метод `stop()` з логуванням `EXTINCTION`.
- **Крок 2:** Оновити константи `reproductionThreshold` для травоїдних та `energyLossRate` для хижаків у відповідних файлах конфігурації.
- **Крок 3:** Переглянути та, за потреби, збільшити `sensorRadius` у `types.ts`.
- **Крок 4:** Протестувати симуляцію після змін, переконавшись, що при вимиранні всіх організмів симуляція зупиняється і більше не виконує зайві обчислення.
- **Крок 5:** Додати unit‑тести для нових умов зупинки та перевірити, що логування `EXTINCTION` працює коректно.

*Після затвердження цього плану я виконаю зазначені кроки та оновлю документацію.*


## 5. Виконані локальні покращення (Logger Refactor)
- Усунено ТОП-8 smell-ів у `src/core/services/Logger.ts`.
- Зменшено довгі сигнатури через payload-об’єкти (`LogPayload`, `ConsoleCapturePayload`).
- Прибрано `any` у command-subscribe контракті через `RemoteCommand`.
- Декомпозовано console output для зниження цикломатичної складності.
- Централізовано reconnect delay та precision-константи.
- Додано unit-тести `src/core/services/__tests__/Logger.test.ts` для ключових сценаріїв.
- Усунено TS strict-помилку у `SimulationContext` (index signature доступ через bracket notation).
- Виділено pure FPS helper-логіку в `src/ui/context/fps.ts` з unit-тестами.

## 6. Академічне підвищення якості logging stack (32+ оптимізації)

### Реалізовано
- **log-server**: усунено `any`, додано type guards для payload/error, нормалізацію рівнів логів, resolver-helpers, централізацію ANSI та command-констант.
- **Logger transport**: декомпозиція socket lifecycle, контроль reconnect-delay через константу, безпечне перевкладання в чергу при send/flush помилках, ідемпотентне `setEnabled`.
- **Logger core**: payload-орієнтовані приватні API, clamp для `maxLogs`, нормалізація invalid minutes, інкрементальні counters `info/warning/error`, синхронізація статистики при cleanup/clear.
- **Тестування**: додано `src/core/services/logger/__tests__/Logger.academic.test.ts` та `src/core/services/logger/__tests__/WebSocketTransport.test.ts`.

### Перевірка
- Targeted unit tests на нові сценарії.
- Targeted eslint для змінених файлів.
- Повний `typecheck`.

## 7. Академічна стабілізація v4 (64+ оптимізацій)

### Ключові результати
- **Core Logger (`src/core/services/Logger.ts`)**: стабільний dedup-key, safe stringify для circular payloads, bounded remote queue, reconnect timer lifecycle, ідемпотентний remote toggle, immutable remote entry mapping.
- **Secondary Logger (`src/core/services/logger/Logger.ts`)**: safe stringify compare, `getLogsByLevel`, додаткове покриття circular dedup кейсу.
- **Transport (`WebSocketTransport`)**: bounded queue з trimming policy, single reconnect schedule, timer cleanup у `close`, декомпозиція socket lifecycle handlers.
- **Log Server (`scripts/log-server.ts`)**: payload size caps, sanitize text fields, strict parse diagnostics, validated broadcast commands.
- **Tooling (`vite.config.ts`)**: optional checker plugin loading через env-flag, що стабілізує production build / pre-commit у середовищах без локального checker-модуля.

### Верифікація
- Після кожного кроку змін коду запускались unit tests + eslint + typecheck.
- Додатково виконано production build як фінальний gate.

## Етап 8 — Комплексний тестовий прогін (2026-03-15, виконано)
- Перевірено стан синхронізації з `dev`: у середовищі відсутні `git remote`, тому merge/pull з `dev` недоступний технічно.
- Запущено повний unit-test suite: `pnpm run test --run` (успішно, 93/93).
- Запущено строгий typecheck: `pnpm run typecheck` (успішно).
- Перевірено production build: `pnpm run build` (успішно, наявне лише попередження про великі чанки).
- Запущено lint: `pnpm run lint` (виявлено pre-existing 360 errors, 10 warnings).
- Проведено browser-driven перевірку UX (керування симуляцією та вкладки діагностики) з артефактом скриншота.
- Детальний звіт зафіксовано у `docs/TESTING_REPORT_2026-03-15.md`.

## Оновлення 2026-03-15 — фізика аномалій, ріст, харчування
- Впровадити slide-first obstacle response для зменшення неприродних bounce-патернів.
- Закрити тунелювання через push-out + fallback reflect + anti-stuck.
- Перейти на bite-based модель їжі для детермінованого балансу.
- Додати growth pipeline (newborn->adult) керований age+energy+genome.
- Експортувати/імпортувати нові growth/food поля в persistence.

## 10. Аудит якості та UX-перевірка (2026-03-15, виконано)
- Перед запуском перевірено синхронізацію з `dev`; в оточенні відсутні `dev/origin/dev`, тому merge технічно недоступний.
- Прогнано повний доступний стек перевірок: `lint`, `typecheck`, `unit`, `build`, `coverage` (coverage впав через відсутній `@vitest/coverage-v8` та `ENOSPC`).
- Виконано browser-driven smoke сценарій UI з перевіркою кнопок/слайдерів/діагностики та скриншотом.
- Зафіксовано production-risk Top-3 по 4 напрямках: performance, refactoring/docs, UX, fault-tolerance/ecosystem balance.
- Деталі винесено в `docs/TESTING_REPORT_2026-03-15.md`.

## 11. Реалізований пакет покращень (2026-03-15)
- **Performance:**
  - декомпозовано `SimulationEngine.update()` на етапи (`prepareTick`, `runCoreSystems`, `runReproductionSystem`, `finishFrame`);
  - у `EngineProxy` реалізовано dedup `setSpeed` / loop-команд та batched `setConfig`;
  - у UI додано lazy-loading для `SettingsPanel` і `DiagnosticsModal`.
- **Refactoring/contract:**
  - прибрано runtime-gap з `not implemented` для `EngineProxy.exportState/importState` через нові worker-команди.
- **UI/UX:**
  - додано явні кнопки стану симуляції (`▶ Запуск`, `⏸ Пауза`, `⏹ Стоп`) + disabled-state;
  - додано clamp для ключових налаштувань;
  - додано degraded/empty стан графіків діагностики.
- **Fault-tolerance/ecosystem:**
  - fail-safe pause при тривалому extinction;
  - fail-safe recovery spawn при довгому дефіциті ресурсів.

## 12. Merge verification pass (2026-03-15)
- Доведено order-safety для `EngineProxy` batching/dedup через flush pending config перед critical-командами.
- Додано unit-тести на:
  - порядок system-pipeline у `Engine.update`;
  - dedup/batching order safety;
  - інваріант `state === import(export(state))`.
- Підтверджено browser-driven, що lazy-loaded `SettingsPanel`/`DiagnosticsModal` коректно працюють з `SimulationContext`.

## 13. Stabilization pass (merge-readiness)
- Посилено order-safety `EngineProxy` для batching/flush у критичних послідовностях команд.
- Додано повторний persistence-cycle інваріант (`state2 = import(export(import(export(state1))))`).
- Локально очищено частину code-smells у змінених файлах без розширення scope.

## 14. EngineProxy async timeout lifecycle hardening (2026-03-16)
- Виявлено архітектурний ризик: `sendAsyncCommand` створював timeout на кожний запит, але при успішній відповіді таймер не очищався.
- Це створювало накопичення «зайвих» активних таймерів під високою частотою async-команд і зайве навантаження на event loop.
- Реалізовано lifecycle cleanup timeout-handle у всіх критичних гілках: `commandResponse`, `timeout`, `dispose`.
- Додано unit-тест, що підтверджує відсутність delayed timeout-rejection після вчасної відповіді воркера.

## 15. PerformanceMonitor history O(1) hardening (2026-03-17)
- Ідентифіковано головний runtime-bottleneck у diagnostics-підсистемі: `Array.shift()` у `endFrame` масштабується як O(n) та деградує під навантаженням.
- Реалізовано кільцевий буфер фіксованої місткості для історії кадрів з O(1) вставкою та стабільним memory profile.
- Збережено backward-compatible поведінку публічних методів (`getCurrentMetrics`, `getPerformanceHistory`, `getAveragePerformance`).
- Додано unit-тест на сценарій переповнення буфера для гарантії правильного порядку записів і актуального latest-entry.

## 16. EventBus onAll exactly-once hardening (2026-03-17)
- **Проблема масштабу:** `onAll` створював підписки на кожен поточний тип події + `'*'`, тому один `emit()` міг викликати той самий callback двічі.
- **Архітектурний ризик:** дублювання обробки підвищує CPU-витрати, створює непередбачувану семантику доставки та зайвий memory footprint при зростанні кількості event-type.
- **Рішення:** прибрано per-type fan-out із `onAll`; залишено лише глобальний `'*'`-канал, що вже підтримується `emit()`.
- **Перевірка:** додано regression test на exactly-once delivery для `onAll`.

## 17. EventBus history O(1) hardening (2026-03-17)
- **Проблема:** в `EventBus.emit()` історія подій обрізалась через `Array.shift()`, що дає O(n) копіювання у гарячому шляху при переповненні буфера.
- **Ризик для масштабу:** зі зростанням частоти подій зростає CPU pressure і latency доставки подій.
- **Рішення:** впроваджено фіксований кільцевий буфер (`historyStart`, `historySize`) з O(1) append/overwrite.
- **Сумісність:** публічні методи `getHistory`, `getLastEvent`, `clearHistory` зберегли попередню семантику.
- **Верифікація:** додано unit-тест на переповнення (120 emit при місткості 100), порядок і останню подію.

## 18.1. UI resilience hotfixes (2026-03-17)
- **Reset consistency:** після `reset` додається синхронізуючий `update`, щоб уникнути зависання візуального стану після `stop`.
- **Worker portability:** додано `SharedArrayBuffer` feature-detection в snapshot-пайплайні.
- **Debug-noise control:** remote logging переведено в explicit opt-in модель.
- **PWA integrity:** додано відсутні іконки з manifest для усунення 404 у прод-оточеннях.

## 2026-03-17 — Hardening непрохідності аномалій
- Додано collision-gate для зон-аномалій у `CollisionSystem` з freeze-path для випадків deep-penetration.
- Уніфіковано collision response для obstacle/zone через спільний spherical barrier resolver.
- Заборонено spawn/reproduction організмів у зоні дії аномалій через валідацію у `SpawnService`.
- Додано unit-тести на freeze-стан і на блокування spawn усередині аномалії.

## 2026-03-17 — Evolution Pulse visual WOW effect
- Додано lightweight 3D-ефект `EvolutionPulse` для підсилення UX-помітності народжень/смертей.
- Тригери: дельта `totalBirths/totalDeaths`; координати пульсів семпляться з `RenderBuffers` (alive/dead).
- Анімація виконується у `useFrame` через scale/opacity fade, без втручання у фізику.
- Впроваджено guardrails для продуктивності: `MAX_EVENTS_PER_TICK` і `MAX_PULSES`.

## 2026-03-17 — Genetic Comet Trail visual WOW effect
- Додано новий layer `GeneticCometTrail` для коротких пост-натальних trail-ефектів.
- Newborn визначаються через delta-аналіз alive-id (render buffers) з валідацією через `totalBirths`.
- Реалізовано intro-wave для гарантованої помітності після старту/reset.
- Впроваджено performance guards: `COMET_TTL_SECONDS`, `COMET_MAX_ACTIVE`, `COMET_MAX_NEW_PER_FRAME`.

## 2026-03-17 — Periodic 1Hz stutter mitigation
- Ідентифіковано регулярне 1Hz навантаження у двох місцях: UI stats logging і cache-refresh статистики.
- Зменшено частоту UI логів (`SERVER_LOG_INTERVAL: 60 -> 300`), щоб прибрати щосекундний шум.
- Збільшено timeout кешу статистики (`CACHE_TIMEOUT: 1000 -> 3000`), щоб знизити частоту важких обчислень.

## 2026-03-17 — Food anomaly import hardening
- Виявлено persistence-edge-case: `importState` відновлював `food` без spatial-валідації по відношенню до зон/перешкод.
- Додано санітизацію імпорту з тороїдальною дистанцією та захисним радіусним буфером (`+5`) для консистентності зі spawn-логікою.
- Додано regression test на сценарій legacy-state з їжею всередині аномалій.

## 2026-03-17 — Runtime one-shot food sanitation
- Додано lightweight safety-gate у `SimulationEngine`: одноразовий cleanup `food` проти zones/obstacles на першому update.
- Підхід мінімізує performance-вартість (без постійної перевірки щотика) та закриває legacy-edge-case у RAM-стані.
- Санітизація повторно активується після `reset` і `importState`.

## 2026-03-17 — Anomaly validator unification
- Винесено дубльовану spatial-валідацію у спільний utility `AnomalyValidation`.
- Синхронізовано правила для `SpawnService`, `PersistenceService` і runtime one-shot sanitation в `Engine`.
- Додано unit-тести utility, включно з тороїдальним boundary-сценарієм.

## 2026-03-17 — Hot-path render performance hardening
- `TrailSystem` переведено з GC-heavy моделі (`Vector3[]` + `shift`) на preallocated кільцевий буфер координат з O(1) append.
- `Trails.tsx` оптимізовано через id-cache і reuse параметрів, що зменшує щокадрові string/object алокації.
- `GeneticCometTrail.tsx` переведено на reuse буфери (`Map`/`Array`) + snapshot/id cache без масового пересоздання alive/newborn структур щокадру.
- `Entities.tsx`: відключено зайві щокадрові material-writes (`emissiveIntensity`) при незмінному `showEnergyGlow`.
- `SimulationContext.tsx`: history append переписано на push+truncate без подвійного копіювання масиву.
- Регресійна валідація пройдена: `typecheck`, `vitest run`, `build`.

## 2026-03-17 — Remote logging auto-enable (dev) + bounded log file
- Увімкнення remote logging у dev переведено на auto-mode (без ручного localStorage-кроку).
- Додано контрольований override через `localStorage['entropia:remoteLogging']` (`'0'` вимикає примусово).
- У `log-server` інтегровано bounded append: `remote_debug.log` обмежено до 5 MB, overflow-поведінка — trim до останніх 4 MB.
- Додано unit-тести для обох нових механізмів.

## 2026-03-18 — Worker render cadence split
- Після transferable-hardening головним transport bottleneck лишався занадто частий `updated` snapshot із worker у main thread.
- Додано cadence-control для відправки render snapshots без зміни fixed-step simulation update.
- Ручний `update` залишено immediate-path, щоб не ламати reset/manual synchronization flow.
- Додано pure helper `workerCadence` та regression unit-тест для фіксації інваріантів dispatch-рішення.

## 2026-03-18 — Buffer serialization pass reduction
- Buffer export path містив подвійний прохід: спочатку точний підрахунок живих/мертвих/food сутностей, потім окремий повний серіалізаційний pass.
- Пайплайн спрощено: `BufferManager` тепер використовує upper-bound оцінку для capacity management і виконує один точний write-pass, який одночасно формує фактичні counts.
- Семантика `RenderBuffers` збережена: UI все ще отримує exact `preyCount` / `predatorCount` / `foodCount`.
- Додано unit-тест на exact counts за умов over-allocation capacity, а regression `Engine.buffers.test.ts` підтвердив збереження shrink/reset/persistence поведінки.

## 2026-03-18 — Single-pass population aggregation
- Після скорочення buffer-churn наступним CPU bottleneck лишались повторні обходи `organisms` у statistics/death pipeline.
- У `SimulationEngine` зібрано population aggregation в одному проході: counts, energy sums, maxAge, maxGeneration і `deadIds`.
- `StatisticsManager` тепер споживає агрегований payload замість повторного scan по `Map<string, Organism>`, що скорочує кількість повних проходів у гарячому update-потоці.
- `PersistenceService.importState` синхронізовано з новою моделлю через явну реагрегацію статистики після імпорту.

## 2026-03-26 — URL/state synchronization hardening (UI config)
- Додано двосторонню синхронізацію `SimulationConfig` з query-параметрами без реініціалізації Three.js сцени.
- Реалізовано clean URL-diff: записуються лише поля, що відрізняються від default; при повному збігу параметри очищуються.
- Додано debounce для frequent `replaceState`, тоді як дискретні user actions використовують `pushState`.
- Додано `popstate` синхронізацію та валідаційні guards від невалідних/невідомих URL-параметрів.
