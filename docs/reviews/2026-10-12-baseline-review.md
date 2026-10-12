# REVIEW SUPPLEMENT — URGENT TOP-3

> Дополнение к текущему ревью проекта Entropia. Документ не заменяет ревью,
> а проводит отдельный анализ пробелов, рисков и зависимостей и валидирует
> предварительный ТОП-3 от координатора.
>
> - **Дата:** 2026-10-12
> - **Ветка:** `agent/normalize-repository-baseline` (она же head PR #49)
> - **База PR:** `main` (`origin/main` = `178e205`)
> - **Состояние PR #49:** OPEN, **DRAFT**, `mergeable: MERGEABLE`
> - **Метод:** инспекция репозитория (`git`, `gh`), прогон `vitest` (196/196 pass),
>   прогон `tsc --noEmit`, `git apply --check`, `git merge-tree`, чтение
>   `BACKLOG.md`, `deploy.yml`, `ci.yml`, `vite.config.ts`, `Entities.tsx`,
>   `Collision.system.ts`, `SceneContainer.tsx`, `useSimulationSettings.ts`,
>   `useSettingsState.ts`, `.tmp/entropia-lint-cleanup-from-884f628.patch`.
>
> **Важное уведомление об исходных данных.** Плейсхолдеры `{{...}}` в ТЗ не были
> раскрыты: файл «текущее ревью» / `Thought for 9s.txt` в репозитории отсутствует
> (поиск по `*review*` и `*thought*` — 0 совпадений). Поэтому итоговый анализ
> построен на артефактах репозитория, перечисленных выше. Если полный текст
> ревью существует вне репозитория — его нужно приложить, часть выводов может
> скорректироваться (см. «Вопросы к координатору», Q1).

---

## 1. Резюме текущего состояния

### 1.1 Что уже сделано в PR #49 (ветка `agent/normalize-repository-baseline`)

- Ветка содержит **17 коммитов** относительно `origin/main`, `0` коммитов позади.
- Главный по объёму эффект — **удаление случайно закоммиченного `.pnpm-store/`**:
  - `origin/main` содержит **11 167 файлов**, из них **10 984** — `.pnpm-store/v10/...`;
  - ветка PR #49 содержит **183 файла** (`.pnpm-store/` полностью удалён);
  - суммарный diff с базой: ~`10 998` файлов, `175 insertions(+), 2 284 554 deletions(-)`.
- В `.gitignore` ветки добавлено `.pnpm-store/`.
- Разделены гейты: `pnpm run check` (enforced) и `pnpm run check:strict` (долговой
  аудит), см. `package.json:10-20`.
- Удалены/ослаблены устаревшие lint-suppression; добавлены `fix(lint): ...`
  коммиты (`7ff9db7`, `e61372a`, `0453c63`, `c16c216`, `f5cea1a`, `884f628`).
- Обновлены `CONTRIBUTING.md` и `docs/BACKLOG.md`.

### 1.2 Рассогласование зависимостей (главный блокер)

| Артефакт | Состояние |
|---|---|
| `origin/main` (база PR) | `vite@6.4.1`, `typescript` не является прямой зависимостью |
| локальный `main` | `origin/main` + `e6f95c2` (**Vite 8 + pin TypeScript**) |
| ветка PR #49 (HEAD) | база `origin/main`, **`e6f95c2` отсутствует** |
| установленный `node_modules` | `vite@8.0.5`, `typescript@5.9.3` |
| lock-файл ветки | `vite@6.4.1` |

**Факт (воспроизведён):** `./node_modules/.bin/tsc --noEmit` на ветке падает:

```
vite.config.ts(88,29): error TS2769: No overload matches this call.
  ... has no properties in common with type 'UserConfig'.
TSC_EXIT=2
```

Причина — рассинхрон `node_modules` (Vite 8 types) и lock/config ветки (Vite 6).
`e6f95c2` меняет `package.json`, `pnpm-lock.yaml` и `vite.config.ts`
(`manualChunks` object → function, обязательный для Vite 8/Rolldown), поэтому
после его merge конфиг и lock станут согласованы.

**Факт (воспроизведён):** `git merge-tree --write-tree HEAD e6f95c2` вернул
единственную строку-дерево без пометок `CONFLICT` (авто-merge `package.json`),
т.е. **merge `e6f95c2` в ветку PR — чистый**.

**Факт:** `e6f95c2` — единственный коммит локального `main`, не запушенный в
`origin/main`. Его сообщение: *upgrade Vite 6 → 8, fix CVE-2026-39363 /
CVE-2026-39365, pin TypeScript `~5.9.3`*.

### 1.3 Состояние рабочих артефактов вне коммитов

- `git status`: ветка чистая, кроме **untracked** `.tmp/`.
- `git stash@{0}` — «On main: local entropia housekeeping», меняет только
  `.gitignore` (добавляет `.tmp/` и `.claude/`).
  - [Факт] `.claude/` уже игнорируется (`.claude/settings.local.json` не мешает
    `git status`), т.е. добавление `.claude/` в stash — дублирующее/безопасное.
- `.tmp/entropia-lint-cleanup-from-884f628.patch` — lint-патч из 7 файлов.
  - [Факт] `git apply --check --recount` **применяет 3/7** файлов
    (`Metabolism.system.ts`, `Entities.tsx`, `urlConfigSync.allparams.test.ts`)
    и **отклоняет 4/7** (`Entities.orientation.test.ts`,
    `useSettingsState.ts`, `useSimulationSettings.url.test.ts`,
    `useSimulationSettings.ts`). `--3way` невозможен: «repository lacks the
    necessary blob».
  - Факт противоречит формулировке координатора «применить патч»: **патч не
    прикладывается к HEAD как есть**.
- `.tmp/history-rewrite/` — `backup-mirror.git`, `rewrite-mirror.git`,
  `message_callback.py`, `refname_callback.py`, `replace-text.txt`,
  `report/pulls-with-claude.json` (следы перезаписи истории).

### 1.4 Тесты и гейты

- `vitest run`: **28 файлов, 196 тестов — PASS** (3.04s). Дефекты камеры/еды
  тестами не покрыты (см. §2).
- `.husky/pre-commit`: `typecheck && test --run && depcruise && build`
  (lint намеренно исключён — комментарий «80 ESLint violations», см. BACKLOG).
- `.github/workflows/ci.yml`: `pnpm run check` на PR в `main` и push в `main`,
  pnpm 10 / Node 22.
- `.github/workflows/deploy.yml`: на push в `main` — `typecheck` → `test` →
  `build` → upload `./dist` → Pages.
- [Факт] **Локальное окружение не совпадает с CI**: Node `v24.18.1`, pnpm
  `11.21.0` против Node 22 / pnpm 10. `pnpm run typecheck` в этой среде падает
  ещё до tsc: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (pnpm пытается
  переустановить `node_modules` из-за несовпадения версий и отсутствия TTY).
- [Факт] В `package.json` нет поля `packageManager`, нет `.nvmrc`/`engines`.

### 1.5 Известные баги из BACKLOG (не подтверждены)

`docs/BACKLOG.md` явно помечает их «Reproduction Required … на current `main`»:

- **Food Render Inconsistency** — отражает ли instanced-рендер уменьшение
  радиуса еды после укусов.
- **Camera Orbit Sync** — всё ли состояние орбиты, нужное для точного reload,
  представлено в URL. «Position and target are already synchronized».

---

## 2. Дополнительный анализ (пробелы, риски, зависимости)

### 2.1 Пробел A — паритет окружения (Node/pnpm) и воспроизводимость

Локально нельзя выполнить тот же гейт, что в CI, без `CI=true` или смены
toolchain. Это ломает научную воспроизводимость («одна команда → один результат»).
Фикс `e6f95c2` помогает с Vite/TS, но **не** фиксирует Node/pnpm.
**Зависимость:** шаг «прогнать `pnpm run check`» из ТОП-3 невыполним, пока
окружение не нормализовано. [Гипотеза] `CI=true pnpm install --frozen-lockfile`
переустановит lock ветки (Vite 6) и тогда `typecheck` может пройти ещё до merge,
но это перезапишет `node_modules` и разойдётся с целевым Vite 8.

### 2.2 Пробел B — «рассинхрон» состоит из двух независимых частей

1. **Dependency desync** (`node_modules`/lock vs `e6f95c2`) — лечится merge.
2. **Upstream desync** — `e6f95c2` **не запушен**; PR #49 базируется на
   `origin/main` без него. Значит, недостаточно «смержить в ветку»: нужно решить,
   попадает ли `e6f95c2` в `origin/main` отдельно (тогда PR надо ребейзить) или
   вносится в PR (тогда PR становится несущим коммит с CVE-фиксом).

### 2.3 Пробел C — `.pnpm-store` в истории и ревью-риск

Удаление 10 984 файлов — правильное, но diff почти нечитаем для человека и
потенциально тяжёл для GitHub. [Вопрос Q3] Нужна ли перезапись истории (есть
`history-rewrite`), или достаточно forward-удаления. Blobs остаются в истории до
явного решения (это уже зафиксировано в BACKLOG).

### 2.4 Пробел D — природа lint-патча и его «протухание»

Патч уменьшает `no-magic-numbers`/дублирование и добавляет тесты (описания на
украинском). Он не является частью enforced-гейта (lint исключён). Часть файлов
не прикладывается → [Гипотеза] патч сгенерирован из состояния, слегка отличного
от текущего HEAD (не все lint-коммиты/перестановки учтены). Риск: слепое
применение с `--3way`/ручным разрешением может изменить поведение тестов.

### 2.5 Пробел E — Camera Orbit Sync (конкретизация)

Факты из кода:

- `CameraSnapshot` хранит только `px,py,pz,tx,ty,tz`
  (`useSimulationSettings.ts:10-14`); `CameraState` содержит ещё `zoom`,
  `distance`, `fov`, `aspect`, `near`, `far` (`CameraState.ts`) — в URL их нет.
- Значения в URL **округляются до целых**: `Math.round(px)` и т.д.
  (`useSimulationSettings.ts:98-104`) → потеря субпиксельной точности при reload.
- Снапшот пишется **только на событие `end`** OrbitControls
  (`SceneContainer.tsx:47-59`) с `enableDamping` (`dampingFactor 0.05`), т.е.
  после отпускания камера ещё докатывается — снятое значение может не совпасть с
  итоговым.
- Восстановление гейтится `appliedRef.current` (`SceneContainer.tsx:31-42`) —
  [Факт] применяется **ровно один раз** за жизнь компонента. Изменение
  `cameraSnapshot` через back/forward (`popstate` → `useUrlSync`) не вернёт камеру.
- `syncUIToUrl` всегда использует `replaceState` для камеры
  (`useSimulationSettings.ts:113`) — [Факт] отдельной записи истории камеры нет,
  back/forward навигация по позициям камеры невозможна by design.

### 2.6 Пробел F — Food Render Inconsistency (конкретизация)

Факты из кода:

- Данные: `Food` при укусе уменьшает `radius` (`Entity.ts:129-131`),
  `BufferManager.writeFoodToBuffer` пишет `f.radius` в `FOOD_OFFSETS.RADIUS`
  (`BufferManager.manager.ts:190-196`).
- Рендер: `updateFoodMesh` читает радиус из буфера и
  `DUMMY.scale.setScalar(radius)` (`Entities.tsx:80-102`), при этом
  `foodGeo = IcosahedronGeometry(RENDER.geometry.food.radius = 2)`
  (`rendering.constants.ts:115-118`) и `scaleMultiplier = engine.config.foodScale`
  (по умолчанию `1.2`).
  ⇒ визуальный радиус ≈ `2 × 1.2 × data.radius = 2.4 × data.radius`.
- Коллизия/хит-тест используют `data.radius`: `isColliding` в
  `Collision.system.ts` и `HIT_RADIUS_MULT_FOOD = 2` в
  `EntityManager.manager.ts:63`.
  ⇒ [Гипотеза] «несоответствие» — рассинхрон **визуального** радиуса (×2.4) и
  **физического/hover** (×1.0–2.0), а не отсутствие обновления при укусе:
  `updateFoodMesh` вызывается каждый кадр (в отличие от организмов, которые
  обновляются по `isNewBuffers || isCameraChanged`).
- **Не воспроизведено** живым рендером (нет браузерного прогона в этой сессии).

### 2.7 Пробел G — нет регрессионных тестов на камеру и еду

`Entities.orientation.test.ts` и `Entity.growth-and-food.test.ts` проверяют
модель, но не связку «буфер → матрица инстанса» и не URL↔камера. Значит,
исправления §2.5/§2.6 нельзя защитить от регрессий без новых тестов.

### 2.8 Пробел H — уборка `main` (stash) расходится с веткой

Stash висит на `main` и добавляет `.tmp/`; на ветке PR `.tmp/` не игнорируется.
Пока stash не применён/удалён, рабочее дерево формально «грязное» в глазах
любого, кто переключится на `main`.

### 2.9 Граф зависимостей задач (что от чего блокируется)

```
e6f95c2 (Vite8+TS pin, CVE)
   └─> нормализация node_modules/lock ──> работает pnpm run check / tsc
                                          └─> можно валидировать патч и фиксы камеры/еды
Патч (.tmp) ─┐
stash ───────┼─> чистое рабочее дерево ──> безопасные коммиты без потери work-in-progress
.tmp/history ┘
Camera/Food ──> требует тест-харнесса (не блокируется merge, но упирается в окружение для проверки)
```

---

## 3. ТОП-3 срочные задачи

Ниже — валидация предварительного ТОП-3 координатора. Для каждой задачи:
вердикт (Подтверждено / Скорректировано), почему срочно, влияние, шаги,
файлы, критерии готовности, риски.

### Задача 1 — Синхронизация зависимостей и merge `e6f95c2` в ветку PR

**Вердикт: ПОДТВЕРЖДЕНО, с уточнением.** Формулировка координатора верна, но
причина срочности шире «рассинхрона»: `e6f95c2` несёт **CVE-фиксы** и pin
TypeScript, а без него на ветке **падает `tsc`** (Vite 8 в `node_modules`).

- **Почему срочно:** enforced-гейт `pnpm run check` не проходит локально;
  `e6f95c2` — security-патч; всё остальное (валидация патча, тесты фиксов)
  зависит от согласованного toolchain.
- **Влияние:** разблокирует typecheck/build, устраняет CVE, делает PR #49
  реально проверяемым и готовым к снятию Draft.
- **Конкретные шаги:**
  1. Зафиксировать Node/pnpm: либо выполнять локально
     `corepack use pnpm@10 && nvm use 22`, либо `CI=true pnpm install
     --frozen-lockfile` (осознанно приняв текущий lock).
  2. Убедиться в чистоте merge:
     `git merge-tree --write-tree HEAD e6f95c2` (ожидается одна строка-дерево).
  3. `git switch agent/normalize-repository-baseline && git merge --no-ff e6f95c2`
     (или `git cherry-pick e6f95c2`, если `origin/main` остаётся без него).
  4. `pnpm install` (обновит `node_modules` под Vite 8 / TS 5.9.3).
  5. `pnpm run check` (typecheck → test → depcruise → build).
  6. `git push`, `gh pr ready 49` (снять Draft) — только после зелёного гейта.
- **Файлы/компоненты:** `package.json`, `pnpm-lock.yaml`, `vite.config.ts`
  (`manualChunks` → function) — целиком из `e6f95c2`; `ci.yml`, `deploy.yml`.
- **Критерии готовности:**
  - `pnpm run typecheck` — 0 ошибок (в т.ч. `vite.config.ts`);
  - `pnpm run check` — зелёный;
  - в ветке присутствует `e6f95c2` (`git merge-base --is-ancestor e6f95c2 HEAD`);
  - в `package.json` появились `vite: 8.0.5` и `typescript: ~5.9.3`;
  - PR #49 не Draft и `mergeable: MERGEABLE`.
- **Риски:**
  - авто-merge `package.json` может дать логически несовместимые поля →
    обязательна ручная проверка `package.json` после merge;
  - `pnpm-lock.yaml` переписан на 937 строк → возможны скрытые изменения версий
    транзитивных зависимостей;
  - выбранная стратегия (merge в PR vs push в `main`) влияет на историю и на
    то, что «видит» CI (PR base = `origin/main`).

### Задача 2 — Довести lint-cleanup патч и очистить рабочее дерево

**Вердикт: ПОДТВЕРЖДЕНО по цели, СКОРРЕКТИРОВАНО по методу.** Нельзя «просто
применить» патч: `git apply --check` прикладывает лишь 3/7 файлов, 4 отклоняются,
а `--3way` невозможен из-за отсутствия blobs. Сначала — аудит и пересборка патча.

- **Почему срочно:** риск потери work-in-progress (патч + stash + `.tmp/`);
  рабочее дерево должно стать чистым до снятия Draft.
- **Влияние:** частично снижает долг `check:strict` (из 80 ESLint-нарушений),
  закрывает «грязное» состояние репозитория.
- **Конкретные шаги:**
  1. Аудит: `git apply --check -v --recount .tmp/entropia-lint-cleanup-from-884f628.patch`
     — получить точный список прикладываемых/отклоняемых хунков.
  2. Приложить успешные файлы: `Metabolism.system.ts`, `Entities.tsx`,
     `urlConfigSync.allparams.test.ts`.
  3. Отклонённые 4 файла (`Entities.orientation.test.ts`,
     `useSettingsState.ts`, `useSimulationSettings.url.test.ts`,
     `useSimulationSettings.ts`) — либо перегенерировать патч из исходного
     источника, либо приложить вручную по хункам (без изменения поведения).
  4. Прогнать `pnpm run typecheck && pnpm run test --run`; для затронутых
     файлов — `pnpm exec eslint <paths>`.
  5. Закоммитить отдельно, телом сообщения зафиксировать «behavior-preserving».
  6. `git stash pop` (ожидаемые `.tmp/`, `.claude/` в `.gitignore`) и решить
     судьбу `.tmp/`:
     - `.tmp/entropia-lint-cleanup-*.patch` — удалить после фиксации содержимого;
     - `.tmp/history-rewrite/` — решить с координатором (см. Q3): хранить вне
       репозитория или удалить;
     - убедиться, что `.gitignore` ветки содержит `.tmp/` (stash приносит это).
- **Файлы/компоненты:** `.tmp/entropia-lint-cleanup-from-884f628.patch`,
  `src/simulation/systems/Metabolism.system.ts`, `src/ui/components/Entities.tsx`,
  `src/ui/context/hooks/useSimulationSettings.ts`,
  `src/ui/components/settings/useSettingsState.ts`, соответствующие тесты,
  `.gitignore`.
- **Критерии готовности:**
  - `pnpm run typecheck && pnpm run test --run` — зелёные;
  - `git status` — пусто (нет untracked/modified), `.tmp/` игнорируется;
  - `git stash list` — пуст;
  - содержимое патча сохранено в git-истории (а не только в `.tmp/`).
- **Риски:**
  - ручное разрешение 4 файлов может незаметно поменять семантику тестов
    (особенно `Entities.orientation.test.ts`, где меняется точность `toBeCloseTo`);
  - патч не в enforced-гейте → низкая ценность по сравнению с Задачей 1, но
    высокая ценность по гигиене. Если время ограничено — понизить приоритет
    после Задачи 1 (см. §4).

### Задача 3 — Воспроизвести и устранить Camera Orbit Sync и Food Render Inconsistency

**Вердикт: ПОДТВЕРЖДЕНО, с усилением.** Backlog прямо требует воспроизведения
на current `main`; порядок «тест → локализация → фикс → документ» корректен.

- **Почему срочно:** это единственные **пользовательские** дефекты в ТОП-3;
  без воспроизведения нельзя ни закрыть, ни опровергнуть. Научная ценность
  проекта (воспроизводимость) требует, чтобы баг был сначала зафиксирован тестом.
- **Влияние:** корректность reload сцены (камера) и визуально-физическая
  согласованность еды; защита от регрессий новыми тестами.
- **Конкретные шаги (Camera):**
  1. Юнит-тест round-trip `readUIFromUrl`/`syncUIToUrl` (по образцу
     `useSimulationSettings.url.test.ts`): записать снапшот с нецелыми
     координатами, прочитать обратно, сравнить — ожидаемо **выявит потерю
     точности** из-за `Math.round`.
  2. Тест на повторное применение: после первого mount изменить
     `cameraSnapshot` (эмуляция `popstate`) — ожидаемо **не применится** из-за
     `appliedRef` (`SceneContainer.tsx:31-42`).
  3. Решить продуктово: синхронизировать ли `zoom/fov/distance`; писать ли
     отдельную запись истории для камеры (`pushState` вместо `replaceState`).
  4. Ручной сценарий в браузере: повернуть/зумить с `enableDamping`, дождаться
     остановки, перезагрузить — сравнить позицию/цель.
- **Конкретные шаги (Food):**
  1. Юнит-тест: `Food.applyBite` уменьшает радиус → `BufferManager` пишет
     значение в `FOOD_OFFSETS.RADIUS` → прочитать буфер и убедиться, что
     `updateFoodMesh` получит обновлённый радиус (проверка связки, а не презентации).
  2. Зафиксировать число: визуальный масштаб = `foodGeo.radius(2) × foodScale ×
     data.radius`, физический = `data.radius` (коллизия) и
     `data.radius × HIT_RADIUS_MULT_FOOD(2)` (hover). Свести к инварианту и
     покрыть тестом.
  3. Ручной визуальный чек: сделать N укусов, наблюдать за размером еды;
     сравнить с hover-подсветкой.
- **Файлы/компоненты:** `src/ui/components/SceneContainer.tsx`,
  `src/ui/context/hooks/useSimulationSettings.ts`,
  `src/ui/components/settings/urlConfigSync.ts`,
  `src/ui/components/Entities.tsx`,
  `src/ui/components/__tests__/` , `src/simulation/systems/Collision.system.ts`,
  `src/simulation/services/BufferManager.manager.ts`,
  `src/simulation/managers/EntityManager.manager.ts`,
  `src/config/rendering.constants.ts`, `docs/BACKLOG.md`, `docs/PERFORMANCE.md`.
- **Критерии готовности:**
  - есть падающий(ие) тест(ы), воспроизводящий(ие) дефект(ы) до фикса;
  - после фикса `pnpm run check` зелёный; новые тесты включены в прогон;
  - в `docs/BACKLOG.md` баг переведён из «Reproduction Required» в
    подтверждённый/закрытый с указанием теста;
  - задокументированы причина и принятое решение (какие поля синхронизируем).
- **Риски:**
  - [Гипотеза] Food «несоответствие» может оказаться **дизайном**
    (`foodScaleBase`/`2.4×`), тогда правильный вывод — не фикс, а фиксация
    инварианта и правка hover-хита/доков;
  - `updateFoodMesh` вызывается каждый кадр → возможны perf-затраты, если
    синхронизация будет расширена;
  - без браузерного прогона полное воспроизведение ограничено unit-уровнем.

---

## 4. План немедленных действий на 48 часов

**Часть A (блокирующая, ~0.5–1 день)**

1. Нормализовать toolchain (pnpm 10 / Node 22) или осознанно зафиксировать
   `CI=true pnpm install --frozen-lockfile`. *(owner: infra)*
2. `git merge-tree` → merge `e6f95c2` в PR-ветку → `pnpm install` →
   `pnpm run check`. *(Задача 1)*
3. Ручная проверка `package.json` после авто-merge; фиксация `vite@8.0.5`,
   `typescript@~5.9.3`.
4. Push + `gh pr ready 49` (снять Draft) при зелёном гейте.

**Часть B (гигиена, параллельно, ~0.5 день)**

5. Приложить 3 успешных файла патча; 4 отклонённых — перегенерировать/разрешить
   вручную; `typecheck + test`; отдельный коммит. *(Задача 2)*
6. `git stash pop`; решение по `.tmp/` и `.tmp/history-rewrite/`; убедиться, что
   `.gitignore` содержит `.tmp/`; `git status` — пусто.

**Часть C (дефекты, начинать, когда CI зелёный; ~1 день)**

7. Написать падающие тесты для камеры (точность + повторное применение) и еды
   (буфер → радиус). *(Задача 3)*
8. Локализовать и починить (или зафиксировать инвариант и правку доков).
9. Обновить `docs/BACKLOG.md` статусом и ссылками на тесты.

**Definition of Done для 48ч:** `pnpm run check` зелёный на ветке с `e6f95c2`;
`git status` чист; для обоих багов есть минимум один воспроизводящий тест;
PR #49 не Draft.

---

## 5. Что можно отложить и почему

| Отложить | Почему безопасно |
|---|---|
| Остаток долга `check:strict` (≈80 ESLint-нарушений) | Не входит в enforced-гейт, `lint` сознательно исключён из pre-commit; чистить инкрементально. |
| Перезапись истории для удаления `.pnpm-store` из blobs | Forward-удаление уже сделано; перезапись — отдельное рискованное решение (влияет на все форки/PR). Требует явного одобрения. |
| `SharedArrayBuffer` render path | Backlog: ждёт проверки deployment headers/browser constraints; текущий snapshot-путь работает. |
| GPU particles / миграция эффектов эволюции на GPU | Только если профилирование покажет материальные затраты UI-потока (`docs/PERFORMANCE.md`). |
| Roadmap Phase 5–8 (генетика, погода, социум, persistence v2) | Не относится к стабилизации baseline. |
| Расширение камеры до `zoom/fov/aspect` | Сначала зафиксировать дефект и MVP-инвариант; расширение состояния — отдельный дизайн (влияет на URL-контракт). |
| Раскрытие `.pnpm-store`-diff в человекочитаемый обзор | Полезно для ревью, но не блокирует merge. |

---

## Вопросы к координатору

- **Q1.** Где полный текст текущего ревью / `Thought for 9s.txt`? Плейсхолдеры в
  ТЗ не были раскрыты; без него п. «дополняет текущее ревью» выполнен частично.
- **Q2.** Стратегия для `e6f95c2`: запушить его в `origin/main` отдельно (тогда PR
  #49 ребейзится) или вносить коммит в PR #49? От этого зависит, попадёт ли
  CVE-фикс в `main` независимо от судьбы PR.
- **Q3.** `.tmp/history-rewrite/` — есть ли решение о перезаписи истории? Удалять
  локальные зеркала (`backup-mirror.git`, `rewrite-mirror.git`) или архивировать
  вне репозитория?
- **Q4.** Кто владеет нормализацией Node/pnpm (появится ли `packageManager` /
  `.nvmrc` / `engines`), чтобы локальный гейт = CI-гейт?
- **Q5.** Продуктовое решение по камере: синхронизировать только
  `position+target` (как сейчас, с повышенной точностью) или расширить URL до
  `zoom/fov` и включить `pushState`-историю для камеры?
- **Q6.** Food: `2.4×` визуальный масштаб — намеренный дизайн или дефект? От
  ответа зависит, чинить рендер или инвариант/хит-тест.
- **Q7.** Есть ли доступ к браузерному прогону (dev-server) для подтверждения
  дефектов визуально, или ограничиваемся unit-тестами в этой итерации?
