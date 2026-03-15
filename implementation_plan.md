# Implementation Plan: Академічна стабілізація v4 (64+ оптимізації)

## Контекст
Попередній етап покращив logging stack, але залишилися архітектурні прогалини: дублювання відповідальностей у двох Logger-модулях, нестабільний pre-commit build у середовищах без встановлених dev-checker залежностей, та нерівномірна fault-tolerance у WebSocket-потоках.

## Межі (task_boundary)
- `src/core/services/Logger.ts`
- `src/core/services/__tests__/Logger.test.ts`
- `src/core/services/logger/Logger.ts`
- `src/core/services/logger/__tests__/Logger.academic.test.ts`
- `src/core/services/logger/transports/WebSocketTransport.ts`
- `src/core/services/logger/__tests__/WebSocketTransport.test.ts`
- `scripts/log-server.ts`
- `vite.config.ts`
- `task.md`, `walkthrough.md`, `README.md`, `docs/OPTIMIZATION_PLAN.md`

## Ціль: мінімум 64 критично важливі оптимізації

### A. Core Logger reliability (1-24)
1. Нормалізувати `setRemoteLogging` як ідемпотентну операцію.
2. Додати queue limit для remote logging.
3. Додати backpressure при переповненні queue.
4. Уникати мутації локального `LogEntry` перед remote send.
5. Винести побудову remote payload у окремий pure helper.
6. Уніфікувати формат dedup-ключа.
7. Додати safe stringify для циклічних структур у payload.
8. Стабілізувати порівняння `data` для dedup.
9. Виділити `isObjectRecord` guard.
10. Прибрати зайву async-обгортку в `maybeSendToRemote`.
11. Винести `resolveConsoleMethod` helper.
12. Винести `buildConsoleMessage` helper.
13. Винести `shouldOutputToConsole` helper.
14. Додати `clearQueueOnDisable` для remote mode.
15. Додати `MAX_LOGS` guard та `setMaxLogs`.
16. Додати clamped cleanup ratio.
17. Уніфікувати stats update через інкрементальні лічильники.
18. Синхронізувати stats після batch cleanup.
19. Додати fallback для невалідного `minutes`.
20. Нормалізувати env detection без `ts-expect-error`.
21. Прибрати direct dependency від `import.meta`.
22. Додати типізований guard для remote command.
23. Знизити зв'язність у `initWebSocket` через хелпери.
24. Покращити error logging семантику для subscriber failures.

### B. Secondary logger module parity (25-40)
25. Додати `debug` сумісність через `LogLevel` розширення.
26. Уніфікувати dedup-підхід із основним Logger.
27. Безпечний `setMaxLogs` для secondary logger.
28. Виділити `normalizeMinutes` helper.
29. Додати `isFinite` guard для recent logs.
30. Уніфікувати message formatting helper.
31. Уніфікувати stats counters.
32. Додати `getLogsByLevel` без зайвих копій.
33. Зменшити цикломатичність `outputToConsole`.
34. Уніфікувати source fallback константами.
35. Додати `transport` close on disable.
36. Додати type-safe compare helper.
37. Додати queue cleanup після `clear`.
38. Додати `setMaxLogs` unit coverage.
39. Додати `invalid minutes` unit coverage.
40. Додати `stats consistency` unit coverage.

### C. Transport hardening (41-54)
41. Додати reconnect timer ref та очищення таймера.
42. Гарантувати single reconnect schedule.
43. Додати queue max size.
44. Додати overflow policy (drop oldest) з warning.
45. Винести websocket-open check helper.
46. Винести enqueue helper.
47. Винести dequeue/send helper.
48. Захистити `close()` від side effects on disable.
49. Виділити `handleOpen`/`handleClose`/`handleError`.
50. Нормалізувати serialize helper.
51. Додати flush loop guard.
52. Додати close cleanup для reconnect timer.
53. Додати unit-test reconnect timer clearing.
54. Додати unit-test queue overflow behavior.

### D. Log server + tooling stability (55-64)
55. Додати payload size cap у server parser.
56. Додати string length cap для message/source.
57. Додати безпечну JSON parse diagnostics.
58. Винести sanitize helper для текстових полів.
59. Додати стабільний формат persisted log entry.
60. Додати broadcast guard для invalid command.
61. Опціоналізувати checker plugin у Vite config.
62. Прибрати hard dependency `vite-plugin-checker` з build path.
63. Додати helper `createPlugins` для конфігурації.
64. Додати env flag `VITE_ENABLE_CHECKER` для явного вмикання checker.

## Критерії приймання
- Реалізовано не менше 64 оптимізацій зі списку.
- Unit-тести для нової поведінки покривають критичні кейси.
- `pnpm -s test --run ...` проходить для нових/оновлених тестів.
- `pnpm -s eslint` на змінених кодових файлах проходить.
- `pnpm -s typecheck` проходить.
- `git commit` виконується **без `--no-verify`**.
