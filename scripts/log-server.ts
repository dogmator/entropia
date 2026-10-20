import { type RawData, WebSocket, WebSocketServer } from 'ws';

import {
    appendLogEntryWithLimit,
    DEFAULT_MAX_LOG_FILE_BYTES,
    DEFAULT_TRIM_TO_BYTES
} from './log-file-utils';
import { type LogPayload, parseLogPayload } from './log-payload';
import {
    evaluateHandshake,
    extractToken,
    isLoopbackHost,
    type ListenConfig,
    MAX_CLIENTS,
    MAX_PAYLOAD_BYTES,
    resolveListenConfig
} from './log-server-policy';

const LOG_FILE = 'remote_debug.log';
const LOG_FILE_PATH = `${process.cwd()}/${LOG_FILE}`;
const MAX_LOG_FILE_BYTES = DEFAULT_MAX_LOG_FILE_BYTES;
const TRIM_TO_BYTES = DEFAULT_TRIM_TO_BYTES;
const COMMAND_TYPE = 'COMMAND';
const COMMAND_RELOAD = 'RELOAD';
const COMMAND_CLEAR = 'clear';
const COMMAND_UNKNOWN_PREFIX = 'Unknown command:';
const ERROR_CODE_ADDRESS_IN_USE = 'EADDRINUSE';
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

const LOG_LEVEL_COLORS: Record<LogPayload['level'], string> = {
    info: ANSI_COLORS.green,
    warning: ANSI_COLORS.yellow,
    error: ANSI_COLORS.red
};

interface CommandPayload {
    type: typeof COMMAND_TYPE;
    action: string;
}

const formatLevel = (level: LogPayload['level']): string => level.toUpperCase();

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

const toBuffer = (data: RawData): Buffer => {
    if (Array.isArray(data)) {
        return Buffer.concat(data);
    }

    return data instanceof ArrayBuffer ? Buffer.from(data) : data;
};

const broadcast = (wss: WebSocketServer, command: CommandPayload): void => {
    if (command.action.length === 0) {
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

const handleLogMessage = (data: RawData): void => {
    try {
        const payload = parseLogPayload(toBuffer(data), MAX_PAYLOAD_BYTES);
        appendLogEntryWithLimit(
            LOG_FILE_PATH,
            createLogEntryText(payload),
            {
                maxBytes: MAX_LOG_FILE_BYTES,
                trimToBytes: TRIM_TO_BYTES
            }
        );
        printColoredLog(payload);
    } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : 'Unknown parse failure';
        console.error(`${ANSI_COLORS.red}[Error]${ANSI_COLORS.reset} Failed to process log bundle: ${reason}`);
    }
};

const describeListenAddress = (config: ListenConfig): string => {
    const host = config.host.includes(':') ? `[${config.host}]` : config.host;
    return `ws://${host}:${String(config.port)}`;
};

const printBanner = (config: ListenConfig): void => {
    console.log(`\n${ANSI_COLORS.magenta}========================================${ANSI_COLORS.reset}`);
    console.log(`${ANSI_COLORS.cyan}    ENTROPIA 3D DIAGNOSTIC SERVER     ${ANSI_COLORS.reset}`);
    console.log(`${ANSI_COLORS.magenta}========================================${ANSI_COLORS.reset}`);
    console.log(`Address:   ${describeListenAddress(config)}`);
    console.log(`Log File:  ${LOG_FILE_PATH}`);
    console.log(`File cap:  ${String(MAX_LOG_FILE_BYTES)} bytes (trim to ${String(TRIM_TO_BYTES)} bytes)`);
    console.log(`Limits:    ${String(MAX_PAYLOAD_BYTES)} bytes per message, ${String(MAX_CLIENTS)} clients`);
    if (!isLoopbackHost(config.host)) {
        console.log(`${ANSI_COLORS.yellow}Access:    REMOTE ENABLED — token required on every connection${ANSI_COLORS.reset}`);
    }
    console.log('Runtime:   TypeScript (tsx)');
    console.log('Status:    Running and waiting for connections...');
    console.log(`${ANSI_COLORS.magenta}----------------------------------------${ANSI_COLORS.reset}\n`);
};

const exitWithCritical = (message: string): never => {
    console.error(`${ANSI_COLORS.red}[CRITICAL]${ANSI_COLORS.reset} ${message}`);
    process.exit(1);
};

const loadConfigOrExit = (): ListenConfig => {
    try {
        return resolveListenConfig(process.env);
    } catch (error: unknown) {
        return exitWithCritical(error instanceof Error ? error.message : 'Invalid configuration.');
    }
};

const config = loadConfigOrExit();

const wss = new WebSocketServer({
    host: config.host,
    port: config.port,
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: ({ req }, done) => {
        const decision = evaluateHandshake({
            origin: req.headers.origin,
            providedToken: extractToken(req.url),
            requiredToken: config.token,
            activeClients: wss.clients.size
        });

        if (decision.accepted) {
            done(true);
            return;
        }

        console.warn(`${ANSI_COLORS.yellow}[Rejected]${ANSI_COLORS.reset} ${decision.reason} (origin: ${req.headers.origin ?? 'none'})`);
        done(false, decision.status, decision.reason);
    }
});

wss.on('connection', (ws: WebSocket) => {
    console.log(`${ANSI_COLORS.green}[Connected]${ANSI_COLORS.reset} New diagnostic client established`);

    ws.on('message', handleLogMessage);

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

wss.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === ERROR_CODE_ADDRESS_IN_USE) {
        exitWithCritical(`Port ${String(config.port)} is already in use.`);
    }

    exitWithCritical(`Server error: ${error.message}`);
});

// The banner is the readiness signal for operators and tests, so it is printed only once the socket is bound.
wss.on('listening', () => { printBanner(config); });

const cleanup = (): void => {
    console.log(`\n${ANSI_COLORS.yellow}Stopping Entropia diagnostic server...${ANSI_COLORS.reset}`);
    wss.close(() => {
        console.log('Server offline.');
        process.exit(0);
    });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
