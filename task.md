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
