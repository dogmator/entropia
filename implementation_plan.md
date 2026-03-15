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
