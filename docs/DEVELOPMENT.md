# Development Guide

This document covers the operational setup, diagnostic tools, and development workflows for Entropia.

## 🛠️ Local Environment

### Setup
Ensure you have `pnpm` installed, then run:
```bash
pnpm install
```

### Running the App
```bash
pnpm dev
```
This starts the Vite dev server and the **Remote Log Server** concurrently.

## 📡 Remote Logging & Observability

Entropia includes a robust remote logging system for real-time monitoring of simulation events.

### How it Works
1. **Transport**: The client sends logs via WebSockets to a local server.
2. **Server**: `scripts/log-server.ts` (running via `tsx`) receives logs and writes them to `remote_debug.log`.
3. **Log Rotation**: The log file is capped at 5MB. When it exceeds this, it is automatically trimmed to the latest 4MB.

### Configuration
Centralized in `src/config/debug.constants.ts`:
- `remoteLoggingEnabled`: Master toggle.
- `remotePort`: Default `3011`.

### Manual Overrides
You can force the logger state via Browser Console:
- `localStorage['entropia:remoteLogging'] = '1'` (Enable)
- `localStorage['entropia:remoteLogging'] = '0'` (Disable)

## 🧪 Testing & Validation

### Running Tests
We use **Vitest** for unit testing.
```bash
pnpm test          # Run all tests
pnpm test:ui       # Run tests with UI reporter
pnpm test:coverage # Generate coverage report
```

### Type Checking
```bash
pnpm tsc --noEmit
```

### Linting
```bash
pnpm run lint
```

## 📦 Production Build
```bash
pnpm build
```
The output will be in the `dist/` directory, optimized for deployment.
