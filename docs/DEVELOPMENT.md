# Development Guide

This document covers local setup, the diagnostic log server, the test and quality gates, and the browser smoke tests.

## Local environment

Versions are pinned in three places that must agree: `.nvmrc` (Node 22.22.0), `packageManager` in `package.json` (pnpm 10.34.7), and `Dockerfile`.

```bash
pnpm install --frozen-lockfile   # install exactly what pnpm-lock.yaml records
pnpm dev                          # Vite dev server (port 3000) + diagnostic log server
```

Docker runs the same setup. `docker compose up` installs with `--frozen-lockfile` and then starts `pnpm run dev`.

## Diagnostic log server

`scripts/log-server.ts` receives log bundles from the browser over WebSocket and appends them to `remote_debug.log` in its working directory. The file is capped at 5 MB and trimmed to the latest 4 MB.

Secure defaults:

- It listens on `127.0.0.1` only.
- A browser page is accepted only from `localhost`, `127.0.0.1`, or `[::1]` over http(s). Other origins get HTTP 403.
- Each message is limited to 100 000 bytes. A larger frame closes the connection.
- At most 8 clients are connected at once.

Configuration (server environment):

| Variable | Default | Meaning |
|---|---|---|
| `LOG_SERVER_PORT` | `3011` | Listening port. Invalid values stop the server. |
| `LOG_SERVER_HOST` | `127.0.0.1` | Listening address. Any non-loopback value is refused unless `LOG_SERVER_ALLOW_REMOTE=1`. |
| `LOG_SERVER_ALLOW_REMOTE` | unset | Set to `1` to permit a non-loopback host. |
| `LOG_SERVER_TOKEN` | unset | Required with remote access. Clients pass it as `?token=…`, checked on every handshake in constant time. |

Remote access is an explicit opt-in. The browser client always connects to `127.0.0.1`, so remote mode is for other tools that can send the token.

Browser client settings:

- `VITE_LOG_WS_PORT` changes the client's target port (default `3011`).
- `localStorage['entropia:remoteLogging'] = '1'` enables remote logging, and `'0'` disables it.

## Tests

We use Vitest with jsdom.

```bash
pnpm test                 # watch mode
pnpm run test --run       # single run, as in CI
pnpm run test:coverage    # coverage report in coverage/
pnpm run test:ui          # interactive UI
```

Coverage is measured with Istanbul (`@vitest/coverage-istanbul`), which counts statements, functions and branches on source nodes. Thresholds are set in `vitest.config.ts`: lines 49, functions 43, branches 36, statements 48.

These values were recalibrated when the coverage method changed from V8 (Vitest 2) to Istanbul (Vitest 5). The old values (44, 54, 74, 44) were set against V8 counts, which do not measure the same things, so the two sets are not comparable. Each new value sits 3 points below the lowest baseline measured for Istanbul on Vitest 5: lines 52.28, statements 50.90, functions 46.07, branches 39.10. The operator approved this tighter tolerance on 2026-10-21. The run-to-run spread measured on the same tests is under one point per metric, so a drop of more than 3 points is a real regression. A larger drop fails the gate. The raise to 80% is tracked separately.

## Browser smoke tests

`tests/smoke/log-transport.spec.ts` runs the app in Chromium and checks the log transport end to end: page load, worker boot, WebSocket connect, forwarding, close and reconnect logging, and reload.

```bash
pnpm run test:smoke
```

- Ports: `SMOKE_APP_PORT` (default `13000`) and `SMOKE_LOG_PORT` (default `13011`). Both must be free. If one is taken, the run stops before starting anything. It never kills a process it did not start.
- Cleanup: the run stops the Vite and log-server processes it started, both at the end and on exit, SIGINT, or SIGTERM. Each runs in its own process group.
- Output: screenshots and `smoke-report.md` go to `test-results/smoke/`, which is git-ignored. The tracked report under `docs/` is written only when you set `SMOKE_REPORT_PATH` explicitly.
- Browser: by default Playwright uses its own Chromium build. To use an installed binary, set `SMOKE_CHROMIUM_PATH`. Playwright 1.64 expects `chromium-1248`, so a different installed build may need that path.

Example with an installed browser:

```bash
SMOKE_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm run test:smoke
```

## Quality gates

```bash
pnpm run check         # typecheck, unit tests with coverage thresholds, dependency-cruiser, build
pnpm run check:strict  # check, plus ESLint, knip, and tooling validation
```

Individual checks: `typecheck`, `lint`, `check:dead-code` (knip), `depcruise`, `check:tooling`. `check:tooling` lists its documented exceptions in `scripts/ensure-typescript-tooling.ts`, with the reason for each.

Dependency audit: `pnpm run audit:prod` fails on high or critical advisories in production dependencies. CI runs it in the `audit` job. Dev-tool advisories are listed in `docs/reports/2026-10-20-repository-hygiene.md`.

## Production build

```bash
pnpm build
```

The output goes to `dist/`.
