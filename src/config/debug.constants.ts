/**
 * Entropia 3D — Configuration parameters for debug and logging systems.
 */

export const DEBUG_CONFIG = {
    /** Enable remote logging by default in DEV mode. */
    remoteLoggingEnabled: false,

    /** Log server port. */
    remotePort: 3013,

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
