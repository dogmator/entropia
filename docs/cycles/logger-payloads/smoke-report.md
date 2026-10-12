# Smoke Report — Log Transport — 2026-10-12

## Environment
- App port: 13000
- Log server port: 13011
- Browser: Chromium (Playwright 1.64.0)
- Commit: 2433157

## Results
| # | Check | Status | Notes |
|---|---|---|---|
| 1 | page loads clean | ✅ | consoleErrors=4719 (benign filtered), pageErrors=68 (benign filtered), nonBenign=0 |
| 2 | simulation starts (worker booted) | ✅ | saw "Proxy: Worker initialized" |
| 3 | WS connected | ✅ | urls=[ws://localhost:3000/entropia/?token=UjfKEk3pNPJK, ws://127.0.0.1:13011/] |
| 4 | runs 30s without errors | ✅ | nonBenign before=0 after=0 |
| 5 | log-server reports connection | ✅ | saw [Connected] |
| 6 | remote log entries | ✅ | entries=915 |
| 7 | simulation worker present | ✅ | workers=1 |
| 8 | worker console forwarded to remote | ✅ | msg=true sourceWorker=true |
| 9 | WS close logged | ✅ | saw "remote log WS closed" |
| 10 | WS reconnect observed | ✅ | connections 1 -> 2 |
| 11 | reload stable | ✅ | new nonBenign errors=0 |

## WebSockets observed
- ws://localhost:3000/entropia/?token=UjfKEk3pNPJK (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)
- ws://localhost:3000/entropia/?token=UjfKEk3pNPJK (frames received: 0)
- ws://127.0.0.1:13011/ (frames received: 0)

## Console errors (deduplicated, capped)
- WebSocket connection to 'ws://localhost:3000/entropia/?token=UjfKEk3pNPJK' failed: Error during WebSocket handshake: Unexpected response code: 400
- [vite] failed to connect to websocket (Error: WebSocket closed without opened.). 
- Failed to load resource: the server responded with a status of 404 (Not Found)
- THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
- THREE.WebGLRenderer: Error creating WebGL context.
- WebSocket connection to 'ws://127.0.0.1:13011/' failed: 
- [ERROR] [Logger:WS]: remote log WS error {endpoint: ws://127.0.0.1:13011, context: Main}
- WebSocket connection to 'ws://127.0.0.1:13011/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED

## Page errors (deduplicated, capped)
- WebSocket closed without opened.
- Error creating WebGL context.

## Captured log (sample)
```
[2026-10-12T19:22:49.164Z] [INFO] [Main:WorkerChannel] Proxy: Sending command setSpeed {"command":{"type":"setSpeed","speed":1}}
[2026-10-12T19:22:49.164Z] [INFO] [Main:WorkerChannel] Proxy: Sending command startLoop {"command":{"type":"startLoop"}}
[2026-10-12T19:22:49.165Z] [INFO] [Main:WorkerChannel] Proxy: Sending command stopLoop {"command":{"type":"stopLoop"}}
[2026-10-12T19:22:49.165Z] [INFO] [Main:WorkerChannel] Proxy: Sending command startLoop {"command":{"type":"startLoop"}}
[2026-10-12T19:22:49.168Z] [ERROR] [Main:Console] [vite] failed to connect to websocket (Error: WebSocket closed without opened.).
[2026-10-12T19:22:49.442Z] [INFO] [Main:EngineProxy] Proxy: Worker initialized
[2026-10-12T19:22:49.502Z] [WARNING] [Main:Console] The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(100%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
[2026-10-12T19:22:49.638Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.641Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.646Z] [INFO] [Main:useSettingsState] URL-first init {"url":"","config":{"foodSpawnRate":0.8,"maxFood":400,"maxOrganisms":400,"showObstacles":true,"mutationFactor":0.12,"reproductionThreshold":150,"drag":0.96,"separationWeight":2.5,"alignmentWeight":1.2,"cohesionWeight":1,"seekWeight":3.5,"avoidWeight":3.5,"organismOpacity":0.92,"foodOpacity":0.85,"organismScale":1,"foodScale":1.2,"showGrid":true,"gridOpacity":0.2,"bloomIntensity":0.8,"trailLength":80,"showEnergyGlow":true,"showTrails":true,"showParticles":true,"graphicsQuality":"HIGH"}}
[2026-10-12T19:22:49.679Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.681Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.701Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.702Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.737Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.739Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.770Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.773Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.805Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.807Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
[2026-10-12T19:22:49.845Z] [ERROR] [Main:Console] THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x24dc, Sandboxed = no, Optimus = yes, AMD switchable = no, Reset notification strategy = 0x0000, ErrorMessage = BindToCurrentSequence failed: .
[2026-10-12T19:22:49.848Z] [ERROR] [Main:Console] THREE.WebGLRenderer: Error creating WebGL context.
```
