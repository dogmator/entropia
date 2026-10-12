/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Optional override for the remote log WebSocket port (default 3011). */
    readonly VITE_LOG_WS_PORT?: string;
}
