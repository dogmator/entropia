# Remote Logging & Observability

Entropia 3D includes a robust remote logging system designed for high-performance debugging and ecosystem monitoring.

## 🚀 Quick Start

1.  **Install dependencies** (handled automatically by `pnpm install`):
    ```bash
    pnpm install
    ```

2.  **Start development environment**:
    ```bash
    pnpm dev
    ```
    *This automatically launches both the Vite application and the diagnostic WebSocket server.*

3.  **Observe logs**: Open `remote_debug.log` in your editor or watch the terminal output (prefixed with `[dev:logs]`).

## 🏗️ Architecture

The system uses a **WebSocket-based** transport layer for minimal overhead and persistent connectivity.

### Components

- **Logger Service (`src/core/services/logger`)**: 
    - A modular singleton orchestrating logging.
    - Uses a `WebSocketTransport` to queue and send logs.
    - Automatically reconnects if the server goes offline.
- **Log Server (`scripts/log-server.ts`)**:
    - A high-performance **TypeScript** server running via `tsx`.
    - Automatically launched by the `dev` script via `concurrently`.
    - Writes incoming logs to `remote_debug.log`.
    - Provides color-coded real-time feedback in the terminal.

## 🛠️ Configuration

Configuration is centralized in `src/config/debug.constants.ts`:

- `remoteLoggingEnabled`: Master toggle.
- `remotePort`: Default is `3011`.
- `remoteHost`: Default is `localhost`.

## 📊 Features

- **Entity Hover Tracking**: Every time you hover over an entity (organism, food, obstacle), a detailed event is sent to the remote log.
- **Message Queuing**: If the server is unreachable, the logger buffers messages and flushes them once the connection is restored.
- **Dev-Only**: Remote logging is strictly disabled in production builds.
