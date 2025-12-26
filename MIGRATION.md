# Міграційний Гайд: Глобальний Рефакторинг Entropia 3D

Цей документ описує кроки для повної міграції на нову модульну архітектуру.

---

## Огляд змін

### Що зроблено автоматично

- [x] Оновлено `tsconfig.json` з `strict: true` та повним набором перевірок
- [x] Створено модульну структуру `shared/types/` з Branded Types
- [x] Створено модульну структуру `shared/config/` з константами
- [x] Створено індекси експорту (`index.ts`) для всіх модулів
- [x] Видалено дублікати файлів (`.refactored.ts`)
- [x] Оновлено `README.md` з актуальною документацією

### Що потрібно зробити вручну

Наступні кроки вимагають ручної міграції через потенційні помилки компіляції.

---

## Чек-лист міграції

### 1. Міграція імпортів типів

**Старий спосіб:**
```typescript
import { OrganismId, Vector3, SimulationStats } from '../types';
```

**Новий спосіб:**
```typescript
import { OrganismId, Vector3, SimulationStats } from '@shared/types';
// або
import { OrganismId, Vector3, SimulationStats } from '../shared/types';
```

**Файли для оновлення:**
- [ ] `simulation/Engine.ts`
- [ ] `simulation/Entity.ts`
- [ ] `simulation/SpatialHashGrid.ts`
- [ ] `simulation/systems/*.ts`
- [ ] `ui/Viewport.tsx`
- [ ] `ui/context/SimulationContext.tsx`
- [ ] `ui/hooks/*.ts`

### 2. Міграція імпортів констант

**Старий спосіб:**
```typescript
import { WORLD_SIZE, GENETICS, COLORS } from '../constants';
```

**Новий спосіб:**
```typescript
import { WORLD_SIZE, GENETICS, COLORS } from '@shared/config';
// або
import { WORLD_SIZE } from '../shared/config/world';
import { GENETICS } from '../shared/config/genetics';
import { COLORS } from '../shared/config/render';
```

### 3. Видалення legacy файлів (після повної міграції)

```bash
# Після успішної міграції та тестування
rm types.ts
rm constants.ts
```

### 4. Оновлення vite.config.ts для path aliases

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@shared': path.resolve(__dirname, './shared'),
      '@core': path.resolve(__dirname, './core'),
      '@simulation': path.resolve(__dirname, './simulation'),
      '@ui': path.resolve(__dirname, './ui'),
    },
  },
});
```

---

## Порядок міграції

### Фаза 1: Типи (найменш ризиковано)

1. Оновіть імпорти типів у `simulation/` модулях
2. Запустіть `npm run typecheck`
3. Виправте помилки компіляції

### Фаза 2: Константи

1. Оновіть імпорти констант
2. Перевірте, що значення збігаються
3. Запустіть `npm run dev` для перевірки

### Фаза 3: Індекси експорту

1. Використовуйте нові індекси для скорочення імпортів:
   ```typescript
   // Замість
   import { PhysicsSystem } from '../simulation/systems/PhysicsSystem';
   import { MetabolismSystem } from '../simulation/systems/MetabolismSystem';

   // Використовуйте
   import { PhysicsSystem, MetabolismSystem } from '../simulation/systems';
   ```

### Фаза 4: Очищення

1. Видаліть невикористані legacy файли
2. Оновіть документацію
3. Запустіть повний тест-сьют

---

## Потенційні проблеми

### Проблема: Циклічні залежності

**Симптом:** `ReferenceError: Cannot access 'X' before initialization`

**Рішення:**
- Перевірте порядок експорту в `index.ts`
- Використовуйте `import type` де можливо

### Проблема: Помилки strict режиму

**Симптом:** `Object is possibly 'undefined'`

**Рішення:**
```typescript
// Додайте перевірку
if (value !== undefined) {
  // використовуйте value
}

// Або використовуйте optional chaining
const result = object?.property?.value;
```

### Проблема: noUncheckedIndexedAccess

**Симптом:** `Element implicitly has an 'undefined' type`

**Рішення:**
```typescript
const item = array[index];
if (item !== undefined) {
  // використовуйте item
}
```

---

## Нова структура файлів

```
entropia/
├── shared/
│   ├── types/
│   │   ├── brands.ts       # OrganismId, FoodId, etc.
│   │   ├── vectors.ts      # Vector3, MutableVector3
│   │   ├── enums.ts        # EntityType, OrganismState
│   │   ├── genome.ts       # PreyGenome, PredatorGenome
│   │   ├── config.ts       # WorldConfig, SimulationConfig
│   │   ├── events.ts       # SimulationEvent types
│   │   ├── stats.ts        # SimulationStats, PerformanceMetrics
│   │   ├── render.ts       # RenderBuffers, RenderFrame
│   │   ├── entities.ts     # GridEntity, EcologicalZone
│   │   └── index.ts        # Центральний реекспорт
│   │
│   ├── config/
│   │   ├── world.ts        # WORLD_SIZE, MAX_ORGANISMS
│   │   ├── physics.ts      # PHYSICS, INTERACTION
│   │   ├── genetics.ts     # GENETICS, REPRODUCTION
│   │   ├── render.ts       # COLORS, RENDER, UI_CONFIG
│   │   └── index.ts        # Центральний реекспорт
│   │
│   └── index.ts            # Головний експорт shared/
│
├── core/
│   ├── index.ts
│   ├── services/
│   │   └── index.ts
│   └── utils/
│       └── index.ts
│
├── simulation/
│   ├── index.ts
│   ├── systems/
│   │   └── index.ts
│   └── services/
│       └── index.ts
│
└── ui/
    ├── hooks/
    │   └── index.ts
    ├── components/
    │   └── index.ts
    └── effects/
        └── index.ts
```

---

## Команди для перевірки

```bash
# Перевірка типів
npm run typecheck

# Запуск dev-сервера
npm run dev

# Запуск тестів
npm run test

# Збірка продакшену
npm run build
```

---

## Підтримка

При виникненні проблем з міграцією:
1. Перевірте цей гайд
2. Перегляньте помилки TypeScript
3. Використовуйте `git diff` для порівняння зі старими файлами
