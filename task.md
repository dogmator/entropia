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
