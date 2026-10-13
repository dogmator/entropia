# Logger Payloads — Audit 2026-10-12

Read-only audit of the logging subsystem before fixing `exactOptionalPropertyTypes`
in the "Logger payloads" group. No code was changed; this file is the only artifact.

## Executive Summary

- There are **two parallel logger implementations**: `src/core/services/Logger.service.ts`
  (the **active** one, exported by the `@/core` barrel) and `src/core/services/logger/Logger.ts`
  (+ `transports/`) which is **not wired into the barrel** and is flagged by knip as an unused export.
- Payload types: `LogEntry` (public, `logger/types.ts` and duplicated in `Logger.service.ts`) and a
  private `LogPayload` in each logger; both use `source?: string` / `data?: Record<string, unknown>`.
- Transport: each log entry is `JSON.stringify`-ed and sent **per event** over WebSocket to
  `DEBUG_CONFIG.remoteWsEndpoint`; `scripts/log-server.ts` parses `{timestamp,level,message,source?,data?}`.
- **Endpoint mismatch:** server listens on port **3011**, client targets **3013** → remote sink is effectively dead.
- 59 `logger.*` call sites (28 info / 11 warning / 9 error / 6 warn / 5 debug); 35 direct `console.*` in `src/`
  with **no `no-console` rule**.
- Top-5 blind spots: (1) worker command/error paths unlogged + no console interception in worker;
  (2) WS endpoint mismatch; (3) no log on WebSocket **close/disconnect**; (4) `Engine.reset()` unlogged;
  (5) camera URL restore/save and config diffs unlogged.
- `exactOptionalPropertyTypes`: **18 errors total**, of which **13 are Logger/payload-related**
  (`LogPayload`/`LogEntry` optional fields receiving explicit `undefined`).
- All 13 logger errors share one root cause: callers construct objects with `source: string | undefined`
  while the target declares `source?: string`. Runtime is unaffected (`JSON.stringify` drops `undefined`;
  console path checks truthiness) → fix is type-level.

## 1. Что такое Logger

### 1.1 Файлы
```
src/core/services/Logger.service.ts                      # ACTIVE logger (562 lines) — exported via @/core
src/core/services/__tests__/Logger.test.ts
src/core/services/logger/Logger.ts                       # parallel impl (273 lines), NOT barrel-wired
src/core/services/logger/types.ts                        # LogEntry, LoggerStats, LogLevel (INFO/WARN/ERROR)
src/core/services/logger/transports/RemoteTransport.ts   # interface
src/core/services/logger/transports/WebSocketTransport.ts
src/core/services/logger/__tests__/Logger.academic.test.ts
src/core/services/logger/__tests__/WebSocketTransport.test.ts
src/ui/utils/remoteLogging.ts                            # resolveRemoteLoggingEnabled()
scripts/log-server.ts                                    # WS receiver (port 3011)
scripts/log-file-utils.ts
src/ui/components/diagnostics/LogsTab.tsx, hooks.ts      # UI consumers
```

### 1.2 Архитектура
- **Singleton** (`Logger.getInstance()`), экспортируется как `const logger`.
- Активный `Logger.service.ts`: `enum LogLevel { DEBUG, INFO, WARNING, ERROR }`; методы
  `debug/info/warning/warn/error`, `logPerformance`, `logSimulationError`, `logSimulationEvent`.
  Хранит ring-buffer (`LOGGER_MAX_LOGS = 1000`), дедуп по последней записи, Listener-pattern (`subscribe`),
  встроенный WebSocket-remote (свой, без transport-класса) + приём команд (`subscribeToCommands`).
- Неактивный `logger/Logger.ts`: `enum LogLevel { INFO, WARNING, ERROR }` (без `debug`), вынесенный
  `WebSocketTransport`, нет приёма входящих команд. **knip: `logger` (Logger.ts:273) — unused export.**
- **Вывод:** активный Logger пишет в (a) in-memory ring-buffer для UI (`DiagnosticsModal`/`LogsTab`),
  (b) `console` (только WARNING/ERROR через `outputToConsole`), (c) remote WebSocket (если включён).
- **Перехват console:** активный Logger подменяет `console.log/info/warn/error/debug`, оборачивая их в
  логи (`source: 'Console'`). Перехват **отключён в worker** (`resolveRuntimeEnvironment() === 'worker'` → return).

### 1.3 Типы payload (полностью)

`src/core/services/logger/types.ts`:
```ts
export enum LogLevel { INFO = 'info', WARNING = 'warning', ERROR = 'error' }
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    source?: string;
    data?: Record<string, unknown>;
}
export interface LoggerStats { total: number; info: number; warning: number; error: number; recent: number; }
```

`src/core/services/Logger.service.ts` (активный) — собственные копии:
```ts
export enum LogLevel { DEBUG='debug', INFO='info', WARNING='warning', ERROR='error' }
export interface LogEntry { timestamp: number; level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface LogPayload { level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface ConsoleCapturePayload { level: LogLevel; source: string; args: unknown[]; }
interface RemoteCommand { type: 'COMMAND'; [key: string]: unknown; }
```

`src/core/services/logger/Logger.ts` (неактивный):
```ts
interface LogPayload { level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
```

`scripts/log-server.ts` (сервер):
```ts
type LogLevel = 'info' | 'warning' | 'error';
interface LogPayload { timestamp: number; level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface CommandPayload { type: 'COMMAND'; action: string; }
```

## 2. Socket-транспорт

### 2.1 Слой
- Активный: WebSocket-логика **внутри** `Logger.service.ts` (`initWebSocket`, `flushQueue`, `maybeSendToRemote`).
- Неактивный: `logger/transports/WebSocketTransport.ts` (queue 300, reconnect 3000ms), общий интерфейс `RemoteTransport`.
- Сервер: `scripts/log-server.ts` (`new WebSocketServer({ port: 3011 })`).

### 2.2 Что отправляется (front → server)
- `JSON.stringify(entry)` где `entry = LogEntry` → `{"timestamp","level","message","source"?,"data"?}`.
- Отправка **по одному событию** (не батчами); при закрытом сокете — очередь (активный: max 500, drop 50; transport: max 300, trim 30).
- Reconnect: 3000 ms. При `send` ошибке — re-queue + reconnect.
- Формат `level` — строки `info|warning|error` (в worker-контексте DEBUG-уровень существует в активном enum, но сервер `resolveLogLevel` низводит всё, кроме warning/error, в `info`).

### 2.3 Обратный путь (server → client)
- Сервер читает stdin: `reload` → broadcast `{type:'COMMAND', action:'RELOAD'}`; `clear` → локальная очистка. (log-server.ts:148-163).
- Клиент (активный Logger) парсит входящее и уведомляет `subscribeToCommands`; подписка есть в `src/ui/context/hooks/useEngineSync.ts:56`.
- Неактивный `logger/Logger.ts` **не имеет `onmessage`** — обратный путь не поддерживает.

### 2.4 Известное расхождение
| | Значение |
|---|---|
| Сервер `scripts/log-server.ts` | **PORT = 3011** (`ws://0.0.0.0:3011`) |
| Клиент `DEBUG_CONFIG.remoteWsEndpoint` | `ws://127.0.0.1:**3013**` (`remotePort: 3013`) |
| `debug.constants.ts` | `remoteLoggingEnabled: false` (в dev включается через `resolveRemoteLoggingEnabled`) |

→ При запуске `pnpm dev:logs` (tsx log-server.ts) клиент подключается к порту, где никто не слушает.

## 3. Карта вызовов Logger

Всего `logger.*` (src/): **59** (вкл. тесты). Без тестов — 44.
| Метод | Кол-во |
|---|---|
| `logger.info` | 28 |
| `logger.warning` | 11 |
| `logger.error` | 9 |
| `logger.warn` | 6 |
| `logger.debug` | 5 |

По подсистемам (вкл. тесты): `/simulation/` 33 · `/core/` 20 · `/ui/` 6 · `/shared/` 0 · worker 0 · transport 0.

Топ файлов:
| Файл | Вызовов |
|---|---|
| `src/core/services/__tests__/Logger.test.ts` | 9 |
| `src/simulation/engine/EngineProxy.ts` | 8 |
| `src/simulation/engine/Engine.ts` | 7 |
| `src/simulation/engine/WorkerChannel.service.ts` | 6 |
| `src/core/services/logger/__tests__/Logger.academic.test.ts` | 6 |
| `src/simulation/engine/TickLoop.service.ts` | 5 |
| `src/core/services/PerformanceMonitor.service.ts` | 5 |

Что логируется (non-test, выжимка):
- Engine: `Initializing`, `READY`, `STARTED`, `PAUSED`, `CRITICAL: Entity collections undefined`, `Direct updateWorldScale not supported`.
- TickLoop: `Engine tick N: X organisms, Y food`, `Population: ... [P/Pr/F]`, `Critical population drop`, `Fail-safe: extinction detected`, `Fail-safe: resource depletion`.
- DeathProcessor: `Engine: N organisms died...` (**debug**).
- EnvironmentBuilder: `Spawned N/M entities of type ...` (**info**).
- FoodAnomalyGuard: `Runtime food anomaly sanitation...` (**warn**).
- Worker: `Worker: Engine initialized, starting deferred loop` (**info**, единственный).
- Proxy/WorkerChannel: команды, `exportState/importState`, ошибки.
- UI: `useSettingsState` (`URL-first init`, `URL-first applyConfig`), `Diagnostics modal opened`, `Hovered over ...`, `Stats`, `Failed to init engine`.
- Collision/Metabolism: radius/diagnostics (**debug**).

## 4. Слепые пятна

### 4.1 Симуляция
| Что | Где должно логироваться | Уровень | Контекст | Риск |
|---|---|---|---|---|
| **`reset()`** (очистка entity/zones/genetic/grid + rebuild) | `Engine.reset()` `Engine.ts:175` | info | tick, counts до/после | Destructive-путь невидим; «пустая сцена» после reset неотличима от сбоя. **P1** |
| **Рождение/репродукция** | `Entity.createOffspring` `Entity.ts:587` / `Reproduction.system.ts` | debug | parentId, genomeId, tick | Только смерти (debug) и начальный spawn (info) логируются; динамика рождаемости слепа. **P2** |
| Изменение параметров (diff) | `useSettingsState.applyConfig` `:36` | info | `{key: value}` | Логируется только `mode/isUrlEvent/url`, **без изменённого ключа и значения**. **P2** |
| Изменение speed/tick rate (UI) | `useSimulationSettings.setSpeed` / worker `setSpeed` | info | старое→новое | speed меняется в `simulation.worker.ts:310` без лога. **P2** |
| Массовая смерть/вымирание | TickLoop покрывает (`Fail-safe: extinction`, `Critical population drop`) | — | — | ✅ покрыто |
| Ошибки систем (NaN, отсутствие entity) | частично (Collision/Metabolism debug, Engine CRITICAL) | warn | tick, entityId | FoodAnomalyGuard покрыт; прочие системы — нет. **P3** |

### 4.2 Worker (`simulation.worker.ts`)
| Что | Где | Уровень | Контекст | Риск |
|---|---|---|---|---|
| **Приём команды** (`self.onmessage` `:316`) | `:316` | debug | `command.type` | Нет трассировки команд (кроме `Unknown command`). **P1** |
| **Ошибки init/update/async** | catch `:75`, `:102`, `:151` | error | message, stack, command | Возвращают `error`-response, но **не пишут в logger**; stack уходит только в postMessage. **P1** |
| `handleReset` `:114` | `:114` | info | — | reset невидим. **P1** |
| `handleSetConfig` `:163` | `:163` | info/debug | config patch | setConfig невидим (главная сторона логирует, воркер — нет). **P2** |
| `start/stopAutoUpdate`, `setSpeed`, `syncCamera` | `:215/:228/:310/:236` | info/debug | — | Lifecycle loop нелогирован. **P2** |
| **console.* в worker** | везде | — | — | Перехват console отключён в worker → любой `console.*` теряется (не уходит в remote). **P1** |

### 4.3 UI
| Что | Где | Уровень | Контекст | Риск |
|---|---|---|---|---|
| **Восстановление камеры из URL** | `SceneContainer.tsx:33-42` (CameraTracker) | info | snapshot px/py/pz/tx/ty/tz | Camera Sync (BACKLOG) неотслеживаем. **P2** |
| **Сохранение камеры (onEnd)** | `SceneContainer.tsx:49-55` | debug | snapshot | Изменения камеры невидимы. **P2** |
| Изменения настроек из панели | `useSettingsState.update/toggle/applyPreset` | info | key, old→new | Идут через `applyConfig`, но без diff. **P2** |
| Восстановление из URL (общий конфиг) | `useSettingsState.getInitialState:23` | info | url, config | Частично покрыто (`URL-first init`). **P3** |
| **Ошибки рендера/WebGL** | `ErrorBoundary.tsx` | error | componentStack | Использует `console.error/warn` (перехват main-thread) → попадает как `source: 'Console'`; **нет структурированного `logger.error`** с контекстом сцены. Ошибки в `useFrame` (Entities/CameraTracker) не обёрнуты. **P2** |

### 4.4 Socket
| Что | Где | Уровень | Контекст | Риск |
|---|---|---|---|---|
| Подключение | `Logger.service.ts:340` (`onopen`) / `WebSocketTransport.handleOpen:97` | debug | endpoint | Только console.debug (captured) → попадает как 'Console'. **P3** |
| **Потеря соединения (`onclose`)** | `Logger.service.ts:350-354` | warn | endpoint, was-connected | **Нет ни одной записи**. Потеря remote-логирования невидима. **P1 (Logger.service)** |
| Отправка сообщения | `maybeSendToRemote:432` | — (нет) | — | Не логируется даже на debug. **P3** |
| Ошибки send/receive | `:434`, `:388` (console.warn) | warn | error | Ошибки идут в console.warn (captured), но не через logger. **P2** |
| **Endpoint mismatch** | `debug.constants.ts:11` vs `log-server.ts:9` | error | ports | Remote sink фактически не работает. **P1** |

## 5. exactOptionalPropertyTypes в Logger-связанном коде

Команда: `./node_modules/.bin/tsc --noEmit --exactOptionalPropertyTypes` (флаг добавлен к проектному tsconfig;
вариант «копия в /tmp» не резолвит относительные `include`/`paths`). Итого **18** ошибок; Logger-related — **13**.

```ts
// LogPayload optional mutations (source/data передаются как string|undefined)
src/core/services/Logger.service.ts(204) TS2379  debug()
src/core/services/Logger.service.ts(208) TS2379  info()
src/core/services/Logger.service.ts(212) TS2379  warning()
src/core/services/Logger.service.ts(220) TS2379  error()
src/core/services/logger/Logger.ts(92)   TS2379  info()
src/core/services/logger/Logger.ts(96)   TS2379  warning()
src/core/services/logger/Logger.ts(100)  TS2379  error()
// LogEntry optional creation (source/data)
src/core/services/Logger.service.ts(250) TS2375  createLogEntry()
src/core/services/Logger.service.ts(446) TS2375  createRemoteLogEntry()
src/core/services/logger/Logger.ts(127)  TS2375  createLogEntry()
// server payload
scripts/log-server.ts(105)               TS2375  parseLogPayload() return
// test
src/core/services/__tests__/Logger.test.ts(41) TS2412  private static instance: Logger | undefined
```

Не-Logger (для контекста группы): `PerformanceMonitor.service.ts(155)` TS2375 (PerformanceEntry.memoryUsage);
`BufferManager.manager.ts(55)`/`workerSnapshot.ts(41)` TS2375 (RenderBuffers.sharedBuffer);
`simulation.worker.ts(76,103,152)` TS2345 (`WorkerResponse` error.stack: `string | undefined`).

### 5.4 Категории
- **«Поле optional, но передаём `undefined` явно»** (11): `LogPayload.source?/data?`, `LogEntry.source?/data?`
  (Logger.service 204/208/212/220/250/446; Logger.ts 92/96/100/127; log-server 105).
- **«readonly vs mutable / class property»** (1): `Logger.test.ts:41` (`private static instance: Logger` присваивается `undefined`).
- Не-Logger внутри группы worker: `WorkerResponse.stack` optional + явный `undefined` (3, TS2345).

Кто формирует payload: сами методы `debug/info/warning/error` (передают `source`, `data` как `string|undefined`),
`createLogEntry`/`createRemoteLogEntry` (пробрасывают `payload.source/data`), `logPerformance`/`logSimulationError`
(данные с `undefined`), и серверный `parseLogPayload`.

## 6. Baseline лог-потока

### 6.1 front → server (WS)
- Каждое событие → `JSON.stringify(LogEntry)`, send по одному (не батчи).
- Частота: по событию; при закрытом сокете — буферизация (500/300) + reconnect 3000ms.
- Формат: `{"timestamp":<ms>,"level":"info|warning|error","message":"...","source":"?","data":{...}?}`.
- Ожидаемый приёмник: `ws://127.0.0.1:3011` (сервер); клиент целится в **3013** (mismatch).
- Включается: `ui/index.tsx:20-21` → `logger.setRemoteLogging(resolveRemoteLoggingEnabled(...))`; в dev по умолчанию — on.

### 6.2 console.*
- `console.*` в `src/`: **35** (17 в `Logger.service.ts`, 6 в `WebSocketTransport.ts`, 4 в `ErrorBoundary.tsx`, 3 в `EventBus.service.ts`, 2 в неактивном `Logger.ts`, по 1 в `useHoverState.ts`/`Entities.tsx`/`Physics.system.ts`).
- Правила **`no-console` в `eslint.config.ts` НЕТ** (grep — 0 совпадений).

## 7. Риски фикса

### 7.1 Что может сломаться
- Сериализация: `JSON.stringify(entry)` (клиент) и сервер `JSON.parse` + `sanitizeText`. `undefined`-значения
  JSON.stringify **опускает**, поэтому `{source: undefined}` ≡ `{}` на проводе — runtime при type-only фиксе не меняется.
- Серверный `parseLogPayload` — единственный внешний контракт (`scripts/log-server.ts`); версионирования протокола нет.
- Перехват console и дедуп `getDedupKey` используют `safeStringify(data ?? null)` — изменение формы payload не влияет.

### 7.2 Что можно чинить безопасно (type-level, без изменения runtime)
- Добавить `| undefined` в optional-поля `LogPayload`/`LogEntry` (`source?: string | undefined; data?: ... | undefined`)
  **либо** собирать payload без ключа, когда значение `undefined` (обе опции эквивалентны на проводе).
- `Logger.test.ts:41` — сузить тип `instance` до `Logger | undefined` (уже так; правка теста).
- `simulation.worker.ts` `WorkerResponse.stack` — аналогично `| undefined`.
- Затрагиваемые места: ~4 файла (`Logger.service.ts`, `logger/Logger.ts`, `log-server.ts`, `Logger.test.ts`),
  ~13 строк; плюс 3 строки в `simulation.worker.ts` (соседняя группа).

### 7.3 Что требует отдельного PR
- Если правится **Socket-протокол** (формат сообщений) → отдельный PR + ADR.
- Исправление **endpoint mismatch** (3011 vs 3013) — конфиг/сервер, отдельный фикс (не type-level).
- Устранение дублирования двух Logger'ов (unused `logger/Logger.ts` + transports) — отдельный PR (архитектура).
- Если `WorkerResponse`/`RenderBuffers` менять — это уже не Logger-группа.

## 8. Открытые вопросы

1. **Серверная часть:** есть ли доступ к серверному коду/логам? Найден только локальный `scripts/log-server.ts`
   (dev-приёмник, файл `remote_debug.log`). Кто владелец продового приёмника?
2. **Endpoint mismatch:** какой порт авторитетный — 3011 (сервер) или 3013 (`DEBUG_CONFIG`)? Это дефект или
   сервер запускается с другим портом вне репозитория?
3. **Спецификация Socket-протокола:** формального описания нет. Нужен ли ADR/версионирование?
4. **Два Logger'а:** `logger/Logger.ts` (+ transports) — планируемое замещение `Logger.service.ts`
   или мёртвый код (knip: unused export)? От этого зависит, фиксить ли типы в обоих.
5. **console в worker:** нужно ли перехватывать/форвардить `console.*` из воркера в remote?
6. **Что критично на сервере, что только для отладки:** следует ли поднять уровень tick/population-логов
   (сейчас info, потенциально шумно) или понизить до debug?
7. **Потеря соединения:** ожидаемое поведение при обрыве WS — только тихий retry (текущее) или warn/уведомление?
8. **`no-console`:** вводить ли ESLint-правило (35 прямых `console.*`), или это осознанно?

### Findings from the automated smoke (2026-10-12, PR fix/log-transport)

9. **Vite HMR hardcoded `hmr.clientPort: 3000`** (`vite.config.ts` `SERVER_CONFIG.hmr`) — breaks HMR when the
   app runs on any non-default port (observed as `ws://localhost:3000/... 400` in the smoke). Debt: derive the
   HMR client port from the actual server port.
10. **WebGL in headless Chromium needs the SwiftShader fallback** (`--enable-unsafe-swiftshader` / full
    `channel: chromium`). Headless-shell cannot create a WebGL context; this is an environment limitation
    handled by the smoke harness, not a product bug.
11. **`Stats` log cadence is very low** (`UI_CONTROLS.SERVER_LOG_INTERVAL = 300` tick events ≈ 30s) — too
    infrequent for fast smoke markers. Consider a shorter dev-mode interval (or an explicit startup marker).
12. **Endpoint mismatch resolved** in fix/log-transport (3013 → 3011, plus `VITE_LOG_WS_PORT`/`LOG_SERVER_PORT`
    overrides). Question 2 above is now answered; keep for history.
13. **Worker forwarding refactor (PR #52 review #1/#2):** worker console/logger forwarding no longer depends
    on `console.*` (which Terser `drop_console` strips in prod) or on import order. The worker now uses an
    explicit `postLog` transport; `console.*` calls are bridged to it for DevTools, and the shared `Logger`
    exposes `setOutputSink` so worker `logger.warn/error` output is routed through `postLog` instead of the
    native console the logger bound at construction time.
14. **Potential refactor (future):** `Logger.setOutputSink` is a runtime mutation applied *after* construction.
    A cleaner design injects the transport/output-sink via the constructor (e.g. `createLogger({ outputSink })`),
    removing the post-construction mutation and making the dependency explicit. Out of scope for PR #52;
    track for a future logger-cycle PR.

### Findings from PR-B (logger cleanup, `refactor/logger-cleanup`)

15. **[DONE] Removed dead `logger/Logger.ts` + `transports/` (PR-B).** The parallel, non-barrel-wired
    implementation (and its private tests) is deleted. `Logger.service.ts` is now the single logger; `LogEntry`
    has one definition, exported via `@/core`. knip no longer reports the `logger` unused export.
16. **[DONE] `source: string` is mandatory (PR-B).** `LogEntry.source` / `LogPayload.source` are no longer
    optional; logger methods take `source: string` with a default of `'unknown'`. This clears the 13
    Logger-related `exactOptionalPropertyTypes` errors (18 → 5 repo-wide; remaining 5 are other groups).
17. **[DONE] Cyclic/bigint-safe serialization (PR-B).** The active Logger already serialized through a
    `try/catch` `safeStringify` with a `WeakSet` replacer (`[Circular]` / `[Unserializable]`); removing the dead
    implementation leaves this as the single guard. Any future `JSON.stringify` on payloads must go through it.
18. **[FUTURE] `MAX_LOG_PAYLOAD_BYTES`** — cap the serialized payload size before queueing/sending, to bound
    memory and wire usage (the server already refuses > 100 kB, the client does not).
19. **[FUTURE] PII review** — logs may carry user IDs, API keys, filesystem paths and IPs. Define a redaction
    policy / allow-list before any log leaves the machine.
20. **[FUTURE] Prod levels** — decide whether `debug` is emitted in production or stripped, and whether the
    remote sink is enabled outside dev. Currently `debug` entries are produced unconditionally.
21. **[FUTURE] `setOutputSink` via constructor** — fold into the constructor-injection refactor tracked in
    item 14 (avoid post-construction mutation).

