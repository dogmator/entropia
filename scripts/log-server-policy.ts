import { timingSafeEqual } from 'node:crypto';

export const DEFAULT_PORT = 3011;
export const DEFAULT_HOST = '127.0.0.1';
export const MAX_CLIENTS = 8;
export const MAX_PAYLOAD_BYTES = 100_000;

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '::1']);
const ALLOWED_ORIGIN_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const ALLOWED_ORIGIN_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_SERVICE_UNAVAILABLE = 503;

export interface ListenConfig {
    readonly host: string;
    readonly port: number;
    /** Shared secret required on every connection; null when the server is loopback-only without a token. */
    readonly token: string | null;
}

export interface HandshakeInput {
    readonly origin: string | undefined;
    readonly providedToken: string | null;
    readonly requiredToken: string | null;
    readonly activeClients: number;
}

export type HandshakeDecision =
    | { readonly accepted: true }
    | { readonly accepted: false; readonly status: number; readonly reason: string };

export const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS.has(host);

/** Returns the trimmed value, or undefined when the variable is unset or blank. */
const readEnvText = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed === '' ? undefined : trimmed;
};

/** Parses LOG_SERVER_PORT. Invalid values fail loudly instead of silently falling back. */
export const parsePort = (raw: string | undefined): number => {
    if (raw === undefined || raw.trim() === '') {
        return DEFAULT_PORT;
    }

    const port = Number(raw);
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
        throw new Error(`LOG_SERVER_PORT must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}, got "${raw}"`);
    }

    return port;
};

/**
 * Resolves where the diagnostic server listens.
 * Loopback is the default. Any non-loopback host is refused unless remote access is explicitly enabled
 * with LOG_SERVER_ALLOW_REMOTE=1 and protected by LOG_SERVER_TOKEN.
 */
export const resolveListenConfig = (env: NodeJS.ProcessEnv): ListenConfig => {
    const host = readEnvText(env['LOG_SERVER_HOST']) ?? DEFAULT_HOST;
    const token = readEnvText(env['LOG_SERVER_TOKEN']) ?? null;
    const port = parsePort(env['LOG_SERVER_PORT']);

    if (isLoopbackHost(host)) {
        return { host, port, token };
    }

    if (env['LOG_SERVER_ALLOW_REMOTE'] !== '1') {
        throw new Error(`Refusing to listen on non-loopback host "${host}". Set LOG_SERVER_ALLOW_REMOTE=1 to opt in.`);
    }

    if (token === null) {
        throw new Error('Remote access requires LOG_SERVER_TOKEN to be set.');
    }

    return { host, port, token };
};

/**
 * Origin is only checked when the browser sends one. Browsers always do for WebSocket handshakes,
 * so a foreign web page cannot open a connection. Non-browser tools send no Origin and are limited to the bound host.
 */
export const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (origin === undefined) {
        return true;
    }

    try {
        const url = new URL(origin);
        return ALLOWED_ORIGIN_PROTOCOLS.has(url.protocol) && ALLOWED_ORIGIN_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
};

const tokensMatch = (provided: string, required: string): boolean => {
    const providedBuffer = Buffer.from(provided);
    const requiredBuffer = Buffer.from(required);
    return providedBuffer.length === requiredBuffer.length && timingSafeEqual(providedBuffer, requiredBuffer);
};

export const evaluateHandshake = (input: HandshakeInput): HandshakeDecision => {
    if (!isAllowedOrigin(input.origin)) {
        return { accepted: false, status: HTTP_FORBIDDEN, reason: 'Origin not allowed' };
    }

    if (input.requiredToken !== null && (input.providedToken === null || !tokensMatch(input.providedToken, input.requiredToken))) {
        return { accepted: false, status: HTTP_UNAUTHORIZED, reason: 'Invalid or missing token' };
    }

    if (input.activeClients >= MAX_CLIENTS) {
        return { accepted: false, status: HTTP_SERVICE_UNAVAILABLE, reason: 'Too many diagnostic clients' };
    }

    return { accepted: true };
};

/** Reads the token from the `token` query parameter of the WebSocket URL. */
export const extractToken = (requestUrl: string | undefined): string | null => {
    if (requestUrl === undefined) {
        return null;
    }

    return new URL(requestUrl, 'http://localhost').searchParams.get('token');
};
