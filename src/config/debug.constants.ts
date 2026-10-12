/**
 * Entropia 3D — Configuration parameters for debug and logging systems.
 */

const DEFAULT_REMOTE_PORT = 3011;

/** Resolves the remote log port, allowing a VITE_LOG_WS_PORT override. */
const resolveRemotePort = (): number => {
    const raw = import.meta.env.VITE_LOG_WS_PORT;
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_REMOTE_PORT;
};

export const DEBUG_CONFIG = {
    /** Enable remote logging by default in DEV mode. */
    remoteLoggingEnabled: false,

    /** Log server port (matches scripts/log-server.ts; VITE_LOG_WS_PORT overrides). */
    remotePort: resolveRemotePort(),

    /** Log server host. */
    remoteHost: '127.0.0.1',

    /** Logging endpoint path. */
    remotePath: '/log',

    /** Constructor for full remote logging URL (HTTP). */
    get remoteEndpoint(): string {
        return `http://${this.remoteHost}:${String(this.remotePort)}${this.remotePath}`;
    },

    /** Constructor for full remote logging URL (WebSocket). */
    get remoteWsEndpoint(): string {
        return `ws://${this.remoteHost}:${String(this.remotePort)}`;
    }
} as const;
