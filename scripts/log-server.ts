import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket,WebSocketServer } from 'ws';

/**
 * Entropia 3D — TypeScript WebSocket Server for Remote Logging.
 * Standardized diagnostic relay for developmental observability.
 */

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants (Keep synchronized with DEBUG_CONFIG)
const PORT = 3011;
const LOG_FILE = 'remote_debug.log';

interface LogPayload {
    timestamp: number;
    level: 'info' | 'warning' | 'error';
    message: string;
    source?: string;
    data?: Record<string, unknown>;
}

/**
 * Initialize WebSocket Server
 */
const wss = new WebSocketServer({ port: PORT });

/**
 * Connection Handler
 */
wss.on('connection', (ws: WebSocket) => {
    console.log('\x1b[32m[Connected]\x1b[0m New diagnostic client established');

    ws.on('message', (message: Buffer) => {
        try {
            const data: LogPayload = JSON.parse(message.toString());
            const timestamp = new Date(data.timestamp || Date.now()).toISOString();
            const level = (data.level || 'info').toUpperCase();
            const source = data.source ? `[${data.source}] ` : '';
            const payload = data.data ? ` ${JSON.stringify(data.data)}` : '';

            const logEntry = `[${timestamp}] [${level}] ${source}${data.message}${payload}\n`;

            // Persistence
            fs.appendFileSync(LOG_FILE, logEntry);

            // Colorized Terminal Output
            const levelColor = level === 'ERROR' ? '\x1b[31m' : level === 'WARNING' ? '\x1b[33m' : '\x1b[32m';
            console.log(`${levelColor}[${level}]\x1b[0m ${source}${data.message}`);
        } catch (err: any) {
            console.error(`\x1b[31m[Error]\x1b[0m Failed to process log bundle: ${err.message}`);
        }
    });

    ws.on('close', () => {
        console.log('\x1b[33m[Disconnected]\x1b[0m Diagnostic client closed session');
    });

    ws.on('error', (error: Error) => {
        console.error(`\x1b[31m[Socket Error]\x1b[0m ${error.message}`);
    });
});

/**
 * Global Server Error Handling
 */
wss.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[CRITICAL]\x1b[0m Port ${PORT} is already in use.`);
    } else {
        console.error(`\x1b[31m[CRITICAL]\x1b[0m Server error: ${e.message}`);
    }
    process.exit(1);
});

console.log(`\n\x1b[35m========================================\x1b[0m`);
console.log(`\x1b[36m    ENTROPIA 3D DIAGNOSTIC SERVER     \x1b[0m`);
console.log(`\x1b[35m========================================\x1b[0m`);
console.log(`Address:   ws://localhost:${PORT}`);
console.log(`Log File:  ${path.resolve(LOG_FILE)}`);
console.log(`Runtime:   TypeScript (tsx)`);
console.log(`Status:    Running and waiting for connections...`);
console.log(`\x1b[35m----------------------------------------\x1b[0m\n`);

/**
 * Graceful Shutdown
 */
const cleanup = () => {
    console.log(`\n\x1b[33mStopping Entropia diagnostic server...\x1b[0m`);
    wss.close(() => {
        console.log(`Server offline.`);
        process.exit(0);
    });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
