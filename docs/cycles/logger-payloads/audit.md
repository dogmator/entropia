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

## 1. What the Logger is

### 1.1 Files
```
src/core/services/Logger.service.ts                      # ACTIVE logger (562 lines) — exported via @/core
src/core/services/__tests__/Logger.test.ts
src/core/services/logger/Logger.ts                       # parallel implementation (273 lines), NOT barrel-wired
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

### 1.2 Architecture
- **Singleton** (`Logger.getInstance()`), exported as `const logger`.
- Active `Logger.service.ts`: `enum LogLevel { DEBUG, INFO, WARNING, ERROR }`; methods
  `debug/info/warning/warn/error`, `logPerformance`, `logSimulationError`, `logSimulationEvent`.
  It keeps a ring buffer (`LOGGER_MAX_LOGS = 1000`), deduplicates against the last entry, uses a listener
  pattern (`subscribe`), has a built-in WebSocket remote channel (its own, without a transport class), and
  accepts incoming commands (`subscribeToCommands`).
- Inactive `logger/Logger.ts`: `enum LogLevel { INFO, WARNING, ERROR }` (no `debug`), a separate
  `WebSocketTransport`, and no incoming command handling. **knip: `logger` (Logger.ts:273) — unused export.**
- **Conclusion:** the active Logger writes to (a) an in-memory ring buffer for the UI (`DiagnosticsModal`/`LogsTab`),
  (b) `console` (only WARNING/ERROR via `outputToConsole`), (c) the remote WebSocket (if enabled).
- **Console interception:** the active Logger replaces `console.log/info/warn/error/debug` with wrappers that
  record the calls as logs (`source: 'Console'`). Interception is **disabled in the worker**
  (`resolveRuntimeEnvironment() === 'worker'` → return).

### 1.3 Payload types (complete)

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

`src/core/services/Logger.service.ts` (active) — its own copies:
```ts
export enum LogLevel { DEBUG='debug', INFO='info', WARNING='warning', ERROR='error' }
export interface LogEntry { timestamp: number; level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface LogPayload { level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface ConsoleCapturePayload { level: LogLevel; source: string; args: unknown[]; }
interface RemoteCommand { type: 'COMMAND'; [key: string]: unknown; }
```

`src/core/services/logger/Logger.ts` (inactive):
```ts
interface LogPayload { level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
```

`scripts/log-server.ts` (server):
```ts
type LogLevel = 'info' | 'warning' | 'error';
interface LogPayload { timestamp: number; level: LogLevel; message: string; source?: string; data?: Record<string, unknown>; }
interface CommandPayload { type: 'COMMAND'; action: string; }
```

## 2. Socket transport

### 2.1 Layer
- Active: the WebSocket logic is **inside** `Logger.service.ts` (`initWebSocket`, `flushQueue`, `maybeSendToRemote`).
- Inactive: `logger/transports/WebSocketTransport.ts` (queue 300, reconnect 3000ms), shared interface `RemoteTransport`.
- Server: `scripts/log-server.ts` (`new WebSocketServer({ port: 3011 })`).

### 2.2 What is sent (front → server)
- `JSON.stringify(entry)`, where `entry = LogEntry` → `{"timestamp","level","message","source"?,"data"?}`.
- Sent **one event at a time** (not in batches). While the socket is closed, events are queued
  (active: max 500, drop 50; transport: max 300, trim 30).
- Reconnect: 3000 ms. On a `send` error: re-queue and reconnect.
- `level` format: the strings `info|warning|error`. In the worker context the active enum does have DEBUG, but
  the server's `resolveLogLevel` lowers everything other than warning/error to `info`.

### 2.3 Return path (server → client)
- The server reads stdin: `reload` → broadcast `{type:'COMMAND', action:'RELOAD'}`; `clear` → local clear.
  (log-server.ts:148-163).
- The client (active Logger) parses incoming messages and notifies `subscribeToCommands`. The subscription exists
  in `src/ui/context/hooks/useEngineSync.ts:56`.
- The inactive `logger/Logger.ts` **has no `onmessage`**, so it does not support the return path.

### 2.4 Known mismatch
| | Value |
|---|---|
| Server `scripts/log-server.ts` | **PORT = 3011** (`ws://0.0.0.0:3011`) |
| Client `DEBUG_CONFIG.remoteWsEndpoint` | `ws://127.0.0.1:**3013**` (`remotePort: 3013`) |
| `debug.constants.ts` | `remoteLoggingEnabled: false` (in dev it is enabled through `resolveRemoteLoggingEnabled`) |

→ When `pnpm dev:logs` (tsx log-server.ts) is started, the client connects to a port where nothing is listening.

## 3. Map of Logger call sites

Total `logger.*` calls (src/): **59** (including tests). Without tests: 44.
| Method | Count |
|---|---|
| `logger.info` | 28 |
| `logger.warning` | 11 |
| `logger.error` | 9 |
| `logger.warn` | 6 |
| `logger.debug` | 5 |

By subsystem (including tests): `/simulation/` 33 · `/core/` 20 · `/ui/` 6 · `/shared/` 0 · worker 0 · transport 0.

Top files:
| File | Calls |
|---|---|
| `src/core/services/__tests__/Logger.test.ts` | 9 |
| `src/simulation/engine/EngineProxy.ts` | 8 |
| `src/simulation/engine/Engine.ts` | 7 |
| `src/simulation/engine/WorkerChannel.service.ts` | 6 |
| `src/core/services/logger/__tests__/Logger.academic.test.ts` | 6 |
| `src/simulation/engine/TickLoop.service.ts` | 5 |
| `src/core/services/PerformanceMonitor.service.ts` | 5 |

What is logged (non-test, excerpt):
- Engine: `Initializing`, `READY`, `STARTED`, `PAUSED`, `CRITICAL: Entity collections undefined`, `Direct updateWorldScale not supported`.
- TickLoop: `Engine tick N: X organisms, Y food`, `Population: ... [P/Pr/F]`, `Critical population drop`, `Fail-safe: extinction detected`, `Fail-safe: resource depletion`.
- DeathProcessor: `Engine: N organisms died...` (**debug**).
- EnvironmentBuilder: `Spawned N/M entities of type ...` (**info**).
- FoodAnomalyGuard: `Runtime food anomaly sanitation...` (**warn**).
- Worker: `Worker: Engine initialized, starting deferred loop` (**info**, the only one).
- Proxy/WorkerChannel: commands, `exportState/importState`, errors.
- UI: `useSettingsState` (`URL-first init`, `URL-first applyConfig`), `Diagnostics modal opened`, `Hovered over ...`, `Stats`, `Failed to init engine`.
- Collision/Metabolism: radius/diagnostics (**debug**).

## 4. Blind spots

### 4.1 Simulation
| What | Where it should be logged | Level | Context | Risk |
|---|---|---|---|---|
| **`reset()`** (clearing entities, zones, genetic data and grid, then rebuild) | `Engine.reset()` `Engine.ts:175` | info | tick, counts before/after | The destructive path is invisible. An "empty scene" after reset cannot be told apart from a failure. **P1** |
| **Births / reproduction** | `Entity.createOffspring` `Entity.ts:587` / `Reproduction.system.ts` | debug | parentId, genomeId, tick | Only deaths (debug) and the initial spawn (info) are logged. Birth dynamics are invisible. **P2** |
| Parameter changes (diff) | `useSettingsState.applyConfig` `:36` | info | `{key: value}` | Only `mode/isUrlEvent/url` is logged, **without the changed key or value**. **P2** |
| Speed / tick rate change (UI) | `useSimulationSettings.setSpeed` / worker `setSpeed` | info | old→new | Speed changes in `simulation.worker.ts:310` without a log. **P2** |
| Mass death / extinction | TickLoop covers it (`Fail-safe: extinction`, `Critical population drop`) | — | — | ✅ covered |
| System errors (NaN, missing entity) | partially (Collision/Metabolism debug, Engine CRITICAL) | warn | tick, entityId | FoodAnomalyGuard is covered; other systems are not. **P3** |

### 4.2 Worker (`simulation.worker.ts`)
| What | Where | Level | Context | Risk |
|---|---|---|---|---|
| **Command receipt** (`self.onmessage` `:316`) | `:316` | debug | `command.type` | No command tracing (except `Unknown command`). **P1** |
| **Init/update/async errors** | catch `:75`, `:102`, `:151` | error | message, stack, command | They return an `error` response but **do not write to the logger**. The stack goes only to postMessage. **P1** |
| `handleReset` `:114` | `:114` | info | — | Reset is invisible. **P1** |
| `handleSetConfig` `:163` | `:163` | info/debug | config patch | setConfig is invisible (the main side logs it, the worker does not). **P2** |
| `start/stopAutoUpdate`, `setSpeed`, `syncCamera` | `:215/:228/:310/:236` | info/debug | — | The lifecycle loop is not logged. **P2** |
| **console.\* in the worker** | everywhere | — | — | Console interception is disabled in the worker, so any `console.*` call is lost (it does not reach the remote sink). **P1** |

### 4.3 UI
| What | Where | Level | Context | Risk |
|---|---|---|---|---|
| **Camera restore from the URL** | `SceneContainer.tsx:33-42` (CameraTracker) | info | snapshot px/py/pz/tx/ty/tz | Camera Sync (BACKLOG) cannot be traced. **P2** |
| **Camera save (onEnd)** | `SceneContainer.tsx:49-55` | debug | snapshot | Camera changes are invisible. **P2** |
| Settings changes from the panel | `useSettingsState.update/toggle/applyPreset` | info | key, old→new | They go through `applyConfig`, but without a diff. **P2** |
| Restore from the URL (shared config) | `useSettingsState.getInitialState:23` | info | url, config | Partially covered (`URL-first init`). **P3** |
| **Render / WebGL errors** | `ErrorBoundary.tsx` | error | componentStack | It uses `console.error/warn` (main-thread interception), so the entries arrive as `source: 'Console'`. **There is no structured `logger.error`** with scene context. Errors in `useFrame` (Entities/CameraTracker) are not wrapped. **P2** |

### 4.4 Socket
| What | Where | Level | Context | Risk |
|---|---|---|---|---|
| Connection | `Logger.service.ts:340` (`onopen`) / `WebSocketTransport.handleOpen:97` | debug | endpoint | Only console.debug (captured), so it arrives as 'Console'. **P3** |
| **Connection loss (`onclose`)** | `Logger.service.ts:350-354` | warn | endpoint, was-connected | **No record at all.** Loss of remote logging is invisible. **P1 (Logger.service)** |
| Sending a message | `maybeSendToRemote:432` | — (none) | — | Not logged, even at debug. **P3** |
| Send/receive errors | `:434`, `:388` (console.warn) | warn | error | Errors go to console.warn (captured), but not through the logger. **P2** |
| **Endpoint mismatch** | `debug.constants.ts:11` vs `log-server.ts:9` | error | ports | The remote sink does not actually work. **P1** |

## 5. exactOptionalPropertyTypes in Logger-related code

Command: `./node_modules/.bin/tsc --noEmit --exactOptionalPropertyTypes` (the flag was added to the project tsconfig;
a copy in /tmp does not resolve the relative `include`/`paths`). Total **18** errors; Logger-related: **13**.

```ts
// LogPayload optional mutations (source/data passed as string|undefined)
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

Not Logger-related (for context within the group): `PerformanceMonitor.service.ts(155)` TS2375 (PerformanceEntry.memoryUsage);
`BufferManager.manager.ts(55)`/`workerSnapshot.ts(41)` TS2375 (RenderBuffers.sharedBuffer);
`simulation.worker.ts(76,103,152)` TS2345 (`WorkerResponse` error.stack: `string | undefined`).

### 5.4 Categories
- **"Optional field, but `undefined` passed explicitly"** (11): `LogPayload.source?/data?`, `LogEntry.source?/data?`
  (Logger.service 204/208/212/220/250/446; Logger.ts 92/96/100/127; log-server 105).
- **"readonly vs mutable / class property"** (1): `Logger.test.ts:41` (`private static instance: Logger` is assigned `undefined`).
- Not Logger-related, inside the worker group: `WorkerResponse.stack` optional + explicit `undefined` (3, TS2345).

Who builds the payloads: the `debug/info/warning/error` methods themselves (they pass `source` and `data` as
`string|undefined`), `createLogEntry`/`createRemoteLogEntry` (they forward `payload.source/data`),
`logPerformance`/`logSimulationError` (data with `undefined`), and the server-side `parseLogPayload`.

## 6. Baseline of the log flow

### 6.1 front → server (WS)
- Each event → `JSON.stringify(LogEntry)`, sent one at a time (not batched).
- Frequency: per event. While the socket is closed, events are buffered (500/300) and reconnect runs every 3000 ms.
- Format: `{"timestamp":<ms>,"level":"info|warning|error","message":"...","source":"?","data":{...}?}`.
- Expected receiver: `ws://127.0.0.1:3011` (server). The client targets **3013** (mismatch).
- Enabled by: `ui/index.tsx:20-21` → `logger.setRemoteLogging(resolveRemoteLoggingEnabled(...))`; on by default in dev.

### 6.2 console.*
- `console.*` in `src/`: **35** (17 in `Logger.service.ts`, 6 in `WebSocketTransport.ts`, 4 in `ErrorBoundary.tsx`,
  3 in `EventBus.service.ts`, 2 in the inactive `Logger.ts`, 1 each in `useHoverState.ts`, `Entities.tsx`, `Physics.system.ts`).
- There is **no `no-console` rule** in `eslint.config.ts` (grep: 0 matches).

## 7. Fix risks

### 7.1 What could break
- Serialization: client `JSON.stringify(entry)` and server `JSON.parse` + `sanitizeText`. `JSON.stringify` **omits**
  `undefined` values, so `{source: undefined}` ≡ `{}` on the wire. A type-only fix does not change runtime behavior.
- The server's `parseLogPayload` is the only external contract (`scripts/log-server.ts`). There is no protocol versioning.
- Console interception and deduplication (`getDedupKey`) use `safeStringify(data ?? null)`, so changing the payload shape does not affect them.

### 7.2 What can be fixed safely (type-level, no runtime change)
- Add `| undefined` to the optional fields of `LogPayload`/`LogEntry` (`source?: string | undefined; data?: ... | undefined`),
  **or** build the payload without the key when the value is `undefined`. Both options are equivalent on the wire.
- `Logger.test.ts:41`: narrow the `instance` type to `Logger | undefined` (already so; a test edit).
- `simulation.worker.ts` `WorkerResponse.stack`: similarly `| undefined`.
- Affected places: about 4 files (`Logger.service.ts`, `logger/Logger.ts`, `log-server.ts`, `Logger.test.ts`),
  about 13 lines; plus 3 lines in `simulation.worker.ts` (the neighboring group).

### 7.3 What needs a separate PR
- If the **socket protocol** (message format) changes → a separate PR and an ADR.
- Fixing the **endpoint mismatch** (3011 vs 3013) is a config/server change and a separate fix (not type-level).
- Removing the duplicate Logger (unused `logger/Logger.ts` + transports) → a separate PR (architecture).
- If `WorkerResponse`/`RenderBuffers` change, that is no longer the Logger group.

## 8. Open questions

1. **Server side:** is there access to the server code or logs? Only the local `scripts/log-server.ts` was found
   (dev receiver, file `remote_debug.log`). Who owns the production receiver?
2. **Endpoint mismatch:** which port is authoritative, 3011 (server) or 3013 (`DEBUG_CONFIG`)? Is it a defect, or is the
   server started with a different port outside the repository?
3. **Socket protocol specification:** there is no formal description. Is an ADR or versioning needed?
4. **Two Loggers:** is `logger/Logger.ts` (+ transports) the planned replacement of `Logger.service.ts`, or dead code
   (knip: unused export)? This determines whether the types are fixed in both.
5. **console in the worker:** should `console.*` calls from the worker be intercepted and forwarded to remote?
6. **What is critical on the server and what is only for debugging:** should tick and population logs be raised
   (currently info, potentially noisy) or lowered to debug?
7. **Connection loss:** is the expected behavior when the WebSocket drops a silent retry (current), or a warning or notification?
8. **`no-console`:** should an ESLint rule be introduced (35 direct `console.*` calls), or is this intentional?

### Findings from the automated smoke (2026-10-12, PR fix/log-transport)

9. **Vite HMR hardcoded `hmr.clientPort: 3000`** (`vite.config.ts` `SERVER_CONFIG.hmr`) — breaks HMR when the app runs on any non-default port (observed as `ws://localhost:3000/... 400` in the smoke). Debt: derive the HMR client port from the actual server port.
10. **WebGL in headless Chromium needs the SwiftShader fallback** (`--enable-unsafe-swiftshader` / full `channel: chromium`). Headless-shell cannot create a WebGL context; this is an environment limitation handled by the smoke harness, not a product bug.
11. **`Stats` log cadence is very low** (`UI_CONTROLS.SERVER_LOG_INTERVAL = 300` tick events ≈ 30s) — too infrequent for fast smoke markers. Consider a shorter dev-mode interval (or an explicit startup marker).
12. **Endpoint mismatch resolved** in fix/log-transport (3013 → 3011, plus `VITE_LOG_WS_PORT`/`LOG_SERVER_PORT` overrides). Question 2 above is now answered; keep for history.
13. **Worker forwarding refactor (PR #52 review #1/#2):** worker console/logger forwarding no longer depends on `console.*` (which Terser `drop_console` strips in prod) or on import order. The worker now uses an explicit `postLog` transport; `console.*` calls are bridged to it for DevTools, and the shared `Logger` exposes `setOutputSink` so worker `logger.warn/error` output is routed through `postLog` instead of the native console the logger bound at construction time.
14. **Potential refactor (future):** `Logger.setOutputSink` is a runtime mutation applied *after* construction. A cleaner design injects the transport/output-sink via the constructor (e.g. `createLogger({ outputSink })`), removing the post-construction mutation and making the dependency explicit. Out of scope for PR #52; track for a future logger-cycle PR.

### Findings from PR-B (logger cleanup, `refactor/logger-cleanup`)

15. **[DONE] Removed dead `logger/Logger.ts` + `transports/` (PR-B).** The parallel, non-barrel-wired implementation (and its private tests) is deleted. `Logger.service.ts` is now the single logger; `LogEntry` has one definition, exported via `@/core`. knip no longer reports the `logger` unused export.
16. **[DONE] `source: string` is mandatory (PR-B).** `LogEntry.source` / `LogPayload.source` are no longer optional; logger methods take `source: string` with a default of `'unknown'`. This clears the 13 Logger-related `exactOptionalPropertyTypes` errors (18 → 5 repo-wide; remaining 5 are other groups).
17. **[DONE] Cyclic/bigint-safe serialization (PR-B).** The active Logger already serialized through a `try/catch` `safeStringify` with a `WeakSet` replacer (`[Circular]` / `[Unserializable]`); removing the dead implementation leaves this as the single guard. Any future `JSON.stringify` on payloads must go through it.
18. **[FUTURE] `MAX_LOG_PAYLOAD_BYTES`** — cap the serialized payload size before queueing/sending, to bound memory and wire usage (the server already refuses > 100 kB, the client does not).
19. **[FUTURE] PII review** — logs may carry user IDs, API keys, filesystem paths and IPs. Define a redaction policy / allow-list before any log leaves the machine.
20. **[FUTURE] Prod levels** — decide whether `debug` is emitted in production or stripped, and whether the remote sink is enabled outside dev. Currently `debug` entries are produced unconditionally.
21. **[FUTURE] `setOutputSink` via constructor** — fold into the constructor-injection refactor tracked in item 14 (avoid post-construction mutation).
22. **[P1] Vite HMR `clientPort` hardcoded 3000** (`vite.config.ts` `SERVER_CONFIG.hmr.clientPort`). This makes the smoke test `tests/smoke/log-transport.spec.ts` falsely-green on `main`: it fails whenever the app runs on a non-default port (the smoke harness uses 13000 → HMR WS `ws://localhost:3000/...` → `ERR_CONNECTION_REFUSED`, aborts test 1). Required: make `clientPort` configurable via env (`VITE_HMR_PORT`). Separate PR — not the Logger group.

### Findings from PR-C (runtime observability, `feat/runtime-observability`)

23. **[PARTIAL] Worker lifecycle logs added (PR-C).** `simulation.worker.ts`: `onmessage` logs the incoming
    command type (`Worker:Message`, debug); `handleInit`/`handleUpdate`/`handleReset`/`handleAsyncCommand` now log
    an error on their previously-silent `catch` (`Worker:Init`/`Worker:Update`/`Worker:Reset`/`Worker:AsyncCommand`)
    via a shared `describeError` helper; `handleReset` logs `Worker:Reset` (info); `handleSetConfig` logs the
    changed keys only — never values — (`Worker:Config`, info). **Error paths are forwarded via the existing sink.**
    `debug`/`info` are visible only in the worker ring-buffer — see #26 for the transport.
24. **[PARTIAL] `Engine.reset()` logs added (PR-C).** `Engine.ts::reset()` logs `Engine:Reset` info at the start
    and, on completion, the resulting `{ organisms, food, obstacles }` counts. (No `try/catch` in `reset()`, so
    no error path; failures surface through the worker's `handleReset` catch.) Same visibility caveat as #23 (#26).
25. **[PARTIAL] Camera + settings logs added (PR-C).** `SceneContainer.tsx` logs camera restore and save as
    `UI:Camera` (debug) via a module-level helper; `onEnd` is already discrete (fires per interaction end), so no
    throttle is needed. `useSettingsState.ts` now logs `UI:Settings` with `{ key, from, to }` for `update` and
    `toggle`, and `{ quality }` for `applyPreset`. Existing `url-first` logs (`useSettingsState` source) are left
    as-is, not duplicated. Camera/settings run on the main thread, so these entries are fully visible in the UI
    ring buffer; worker-side `info` is unaffected.
26. **[P1] Forward worker `debug`/`info` to main/remote.** In the worker, `logger.setOutputSink` forwards only
    `warning`/`error` to the main thread; `debug`/`info` (e.g. `Worker:Message`, `Worker:Reset`, `Worker:Config`)
    live in the worker's own ring buffer and reach the UI only via the remote sink if enabled. Requires a transport
    refactor — extend `setOutputSink` to all levels or add a read-ring-buffer worker command. **Separate PR**
    (transport behavior change; out of scope for the observability-only PR-C).
