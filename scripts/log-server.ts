import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3011;
const LOG_FILE = 'remote_debug.log';
const COMMAND_TYPE = 'COMMAND';
const COMMAND_RELOAD = 'RELOAD';
const COMMAND_CLEAR = 'clear';
const COMMAND_UNKNOWN_PREFIX = 'Unknown command:';
const ERROR_CODE_ADDRESS_IN_USE = 'EADDRINUSE';
const MAX_MESSAGE_SIZE = 8192;
const MAX_SOURCE_SIZE = 128;
const MAX_PAYLOAD_BYTES = 100_000;
const RELOAD_INPUT = 'reload';

const ANSI_COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
} as const;

type LogLevel = 'info' | 'warning' | 'error';

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    info: ANSI_COLORS.green,
    warning: ANSI_COLORS.yellow,
    error: ANSI_COLORS.red
};

interface LogPayload {
    timestamp: number;
    level: LogLevel;
    message: string;
    source?: string;
    data?: Record<string, unknown>;
}

interface CommandPayload {
    type: typeof COMMAND_TYPE;
    action: string;
}

interface ErrorWithCode {
    message: string;
    code?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isErrorWithCode = (value: unknown): value is ErrorWithCode =>
    isRecord(value) && typeof value['message'] === 'string';

const resolveLogLevel = (value: unknown): LogLevel =>
    value === 'warning' || value === 'error' ? value : 'info';

const formatLevel = (level: LogLevel): string => level.toUpperCase();

const sanitizeText = (value: unknown, maxLength: number): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value.slice(0, maxLength).trim();
};

const parseLogPayload = (rawMessage: Buffer): LogPayload => {
    if (rawMessage.byteLength > MAX_PAYLOAD_BYTES) {
        throw new Error('Payload size exceeds allowed limit');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawMessage.toString());
    } catch {
        throw new Error('Invalid JSON payload');
    }

    if (!isRecord(parsed)) {
        throw new Error('Invalid log payload structure');
    }

    const message = sanitizeText(parsed['message'], MAX_MESSAGE_SIZE);
    if (!message) {
        throw new Error('Log payload must include non-empty message');
    }

    const timestamp = typeof parsed['timestamp'] === 'number' ? parsed['timestamp'] : Date.now();
    const level = resolveLogLevel(parsed['level']);
    const source = sanitizeText(parsed['source'], MAX_SOURCE_SIZE);
    const data = isRecord(parsed['data']) ? parsed['data'] : undefined;

    return {
        timestamp,
        level,
        message,
        source,
        data
    };
};

const createLogEntryText = (payload: LogPayload): string => {
    const timestamp = new Date(payload.timestamp).toISOString();
    const level = formatLevel(payload.level);
    const source = payload.source ? `[${payload.source}] ` : '';
    const details = payload.data ? ` ${JSON.stringify(payload.data)}` : '';

    return `[${timestamp}] [${level}] ${source}${payload.message}${details}\n`;
};

const printColoredLog = (payload: LogPayload): void => {
    const level = formatLevel(payload.level);
    const source = payload.source ? `[${payload.source}] ` : '';
    const color = LOG_LEVEL_COLORS[payload.level];

    console.log(`${color}[${level}]${ANSI_COLORS.reset} ${source}${payload.message}`);
};

const isValidCommand = (command: CommandPayload): boolean =>
    command.type === COMMAND_TYPE && command.action.length > 0;

const broadcast = (wss: WebSocketServer, command: CommandPayload): void => {
    if (!isValidCommand(command)) {
        return;
    }

    const payload = JSON.stringify(command);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
};

const handleStdinInput = (input: string, wss: WebSocketServer): void => {
    if (input === RELOAD_INPUT) {
        console.log(`${ANSI_COLORS.magenta}[Command]${ANSI_COLORS.reset} Broadcasting RELOAD signal...`);
        broadcast(wss, { type: COMMAND_TYPE, action: COMMAND_RELOAD });
        return;
    }

    if (input === COMMAND_CLEAR) {
        console.clear();
        return;
    }

    if (input.length > 0) {
        console.log(`${ANSI_COLORS.gray}${COMMAND_UNKNOWN_PREFIX} ${input}${ANSI_COLORS.reset}`);
    }
};

const handleServerError = (error: unknown): never => {
    if (!isErrorWithCode(error)) {
        console.error(`${ANSI_COLORS.red}[CRITICAL]${ANSI_COLORS.reset} Unknown server error.`);
        process.exit(1);
    }

    if (error.code === ERROR_CODE_ADDRESS_IN_USE) {
        console.error(`${ANSI_COLORS.red}[CRITICAL]${ANSI_COLORS.reset} Port ${PORT} is already in use.`);
        process.exit(1);
    }

    console.error(`${ANSI_COLORS.red}[CRITICAL]${ANSI_COLORS.reset} Server error: ${error.message}`);
    process.exit(1);
};

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket) => {
    console.log(`${ANSI_COLORS.green}[Connected]${ANSI_COLORS.reset} New diagnostic client established`);

    ws.on('message', (message: Buffer) => {
        try {
            const payload = parseLogPayload(message);
            fs.appendFileSync(LOG_FILE, createLogEntryText(payload));
            printColoredLog(payload);
        } catch (error: unknown) {
            const reason = isErrorWithCode(error) ? error.message : 'Unknown parse failure';
            console.error(`${ANSI_COLORS.red}[Error]${ANSI_COLORS.reset} Failed to process log bundle: ${reason}`);
        }
    });

    ws.on('close', () => {
        console.log(`${ANSI_COLORS.yellow}[Disconnected]${ANSI_COLORS.reset} Diagnostic client closed session`);
    });

    ws.on('error', (error: Error) => {
        console.error(`${ANSI_COLORS.red}[Socket Error]${ANSI_COLORS.reset} ${error.message}`);
    });
});

process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
    handleStdinInput(data.toString().trim(), wss);
});

wss.on('error', (error: unknown) => {
    handleServerError(error);
});

console.log(`\n${ANSI_COLORS.magenta}========================================${ANSI_COLORS.reset}`);
console.log(`${ANSI_COLORS.cyan}    ENTROPIA 3D DIAGNOSTIC SERVER     ${ANSI_COLORS.reset}`);
console.log(`${ANSI_COLORS.magenta}========================================${ANSI_COLORS.reset}`);
console.log(`Address:   ws://localhost:${PORT}`);
console.log(`Log File:  ${path.resolve(__dirname, LOG_FILE)}`);
console.log('Runtime:   TypeScript (tsx)');
console.log('Status:    Running and waiting for connections...');
console.log(`${ANSI_COLORS.magenta}----------------------------------------${ANSI_COLORS.reset}\n`);

const cleanup = (): void => {
    console.log(`\n${ANSI_COLORS.yellow}Stopping Entropia diagnostic server...${ANSI_COLORS.reset}`);
    wss.close(() => {
        console.log('Server offline.');
        process.exit(0);
    });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
