export type LogLevel = 'info' | 'warning' | 'error';

export interface LogPayload {
    timestamp: number;
    level: LogLevel;
    message: string;
    source: string;
    data?: Record<string, unknown>;
}

export const MAX_MESSAGE_SIZE = 8192;
export const MAX_SOURCE_SIZE = 128;
export const UNKNOWN_SOURCE = 'unknown';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeText = (value: unknown, maxLength: number): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value.slice(0, maxLength).trim();
};

const resolveLogLevel = (value: unknown): LogLevel =>
    value === 'warning' || value === 'error' ? value : 'info';

/**
 * Parses one diagnostic bundle sent by a client.
 * Throws a descriptive Error for oversized, malformed or incomplete payloads so the caller can reject the message.
 */
export const parseLogPayload = (rawMessage: Buffer, maxPayloadBytes: number): LogPayload => {
    if (rawMessage.byteLength > maxPayloadBytes) {
        throw new Error('Payload size exceeds allowed limit');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawMessage.toString('utf8'));
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

    const payload: LogPayload = {
        timestamp: typeof parsed['timestamp'] === 'number' ? parsed['timestamp'] : Date.now(),
        level: resolveLogLevel(parsed['level']),
        message,
        source: sanitizeText(parsed['source'], MAX_SOURCE_SIZE) ?? UNKNOWN_SOURCE,
    };

    if (isRecord(parsed['data'])) {
        payload.data = parsed['data'];
    }

    return payload;
};
