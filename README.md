# Entropia 3D

**Високопродуктивна тривимірна симуляція еволюційних процесів.**

[![Build](https://img.shields.io/github/actions/workflow/status/dogmator/entropia/ci.yml?branch=main&label=build)](https://github.com/dogmator/entropia/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](./LICENSE)

---

## Демонстрація

**[Запустити Live Demo](https://dogmator.github.io/entropia/)**

---

## Опис

Entropia 3D — це агентна симуляція екосистеми, де цифрові організми виживають, полюють, розмножуються та еволюціонують. Кожен організм має унікальний геном, що визначає його фізичні властивості та поведінку.

### Основні можливості

- **Генетична система**: Організми передають мутовані копії геному нащадкам
- **Два типи організмів**: Травоїдні (зелені) та хижаки (червоні)
- **Екологічні зони**: Оазиси, пустелі, мисливські угіддя, притулки
- **Фізична симуляція**: Алгоритм Boids для групової поведінки
- **Оптимізований рендеринг**: InstancedMesh, Frustum Culling, Float32Array буфери

---

## Технології

| Категорія | Технологія |
|-----------|------------|
| UI Framework | React 19 |
| 3D Engine | Three.js |
| Мова | TypeScript (strict mode) |
| Збірка | Vite |
| Тестування | Vitest |

---

## Архітектура

```
entropia/
├── core/                    # Інфраструктурні утиліти
│   ├── EventBus.ts          # Шина подій
│   ├── ObjectPool.ts        # Пул об'єктів
│   ├── services/            # Logger, PerformanceMonitor
│   └── utils/               # Random, MathUtils
│
├── simulation/              # Ядро симуляції (React-незалежне)
│   ├── Engine.ts            # Головний двигун
│   ├── Entity.ts            # Сутності: Organism, Food, Obstacle
│   ├── SpatialHashGrid.ts   # Просторова сітка O(1)
│   └── systems/             # BehaviorSystem, PhysicsSystem, etc.
│
├── ui/                      # React компоненти
│   ├── App.tsx              # Кореневий компонент
│   ├── Viewport.tsx         # 3D візуалізація
│   ├── components/          # Sidebar, Dashboard, Controls
│   ├── hooks/               # useThreeScene, useAnimationLoop
│   ├── effects/             # CosmicBackground, ParticleSystem
│   └── context/             # SimulationContext
│
├── shared/                  # Спільні типи та константи
│   ├── types/               # Branded Types, Enums, Interfaces
│   └── config/              # PHYSICS, GENETICS, RENDER
│
├── types.ts                 # Legacy типи (міграція до shared/)
└── constants.ts             # Legacy константи (міграція до shared/)
```

### Ключові архітектурні рішення

1. **Розділення логіки та презентації**: `simulation/` може працювати без React (Web Worker ready)
2. **Branded Types**: Типобезпечні ідентифікатори (`OrganismId`, `FoodId`, `GenomeId`)
3. **ECS-подібна архітектура**: Окремі системи для фізики, метаболізму, поведінки
4. **Float32Array буфери**: Zero-copy передача даних для рендерингу

---

## Встановлення

```bash
# Клонування
git clone https://github.com/dogmator/entropia.git
cd entropia

# Встановлення залежностей
npm install

# Запуск dev-сервера
npm run dev

# Збірка
npm run build

# Перевірка типів
npm run typecheck

# Тести
npm run test
```

---

## Керування

| Дія | Клавіша/Миша |
|-----|--------------|
| Пауза/Продовження | `Пробіл` |
| Швидкість 0x | `0` |
| Швидкість 1x | `1` |
| Швидкість 2x | `2` |
| Швидкість 5x | `5` |
| Повноекранний режим | `F` |
| Обертання камери | ПКМ + перетягування |
| Масштабування | Колесо миші |
| Вибір організму | ЛКМ |

---

## Конфігурація

### Параметри світу (`shared/config/world.ts`)

```typescript
WORLD_SIZE = 400           // Розмір світу
MAX_TOTAL_ORGANISMS = 400  // Максимум організмів
INITIAL_PREY = 80          // Початкова кількість травоїдних
INITIAL_PREDATOR = 8       // Початкова кількість хижаків
```

### Параметри генетики (`shared/config/genetics.ts`)

```typescript
GENETICS.mutationFactor = 0.12  // 12% ймовірність мутації
REPRODUCTION_ENERGY_THRESHOLD = 180
INITIAL_ENERGY = 100
MAX_ENERGY = 300
```

### Параметри фізики (`shared/config/physics.ts`)

```typescript
PHYSICS.drag = 0.96
PHYSICS.separationWeight = 2.5
PHYSICS.seekWeight = 3.5
```

---

## Типи

Проект використовує строгу типізацію з Branded Types:

```typescript
import {
  OrganismId,
  FoodId,
  Genome,
  SimulationConfig,
  createOrganismId
} from './shared/types';

// Ідентифікатори типобезпечні
const orgId: OrganismId = createOrganismId('org_1');
const foodId: FoodId = createFoodId('food_1');
// orgId === foodId → Помилка компіляції!
```

---

## Оптимізації продуктивності

1. **InstancedMesh**: Групове відмальовування організмів та їжі
2. **Frustum Culling (CPU)**: Пропуск об'єктів поза камерою
3. **Spatial Hash Grid**: O(1) пошук сусідів
4. **Float32Array буфери**: Мінімізація GC, готовність до Web Workers
5. **Adaptive Buffer Management**: Динамічне скорочення буферів

---

## Скрипти

| Команда | Опис |
|---------|------|
| `npm run dev` | Запуск dev-сервера |
| `npm run build` | Продакшн збірка |
| `npm run preview` | Локальний перегляд збірки |
| `npm run typecheck` | Перевірка TypeScript |
| `npm run test` | Запуск тестів |
| `npm run test:ui` | Тести з UI |
| `npm run test:coverage` | Покриття тестами |

---

## Ліцензія

UNLICENSED — приватний проект.

---

## Автори

Розроблено як демонстрація синергії фізики частинок, просторового хешування та генетичних алгоритмів.
