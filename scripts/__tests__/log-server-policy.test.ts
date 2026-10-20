/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable sonarjs/no-clear-text-protocols -- origin fixtures intentionally use the local http:// dev protocol */
import { describe, expect, it } from 'vitest';

import { parseLogPayload, UNKNOWN_SOURCE } from '../log-payload';
import {
    DEFAULT_HOST,
    DEFAULT_PORT,
    evaluateHandshake,
    extractToken,
    isAllowedOrigin,
    MAX_CLIENTS,
    parsePort,
    resolveListenConfig
} from '../log-server-policy';

const LIMIT = 100_000;
const OPEN_HANDSHAKE = { origin: undefined, providedToken: null, requiredToken: null, activeClients: 0 };

describe('log server — listen configuration', () => {
    it('defaults to loopback without a token', () => {
        expect(resolveListenConfig({})).toEqual({ host: DEFAULT_HOST, port: DEFAULT_PORT, token: null });
    });

    it('accepts explicit loopback hosts without any opt-in', () => {
        expect(resolveListenConfig({ LOG_SERVER_HOST: 'localhost' }).host).toBe('localhost');
        expect(resolveListenConfig({ LOG_SERVER_HOST: '::1' }).host).toBe('::1');
    });

    it('refuses a non-loopback host unless remote access is explicitly enabled', () => {
        expect(() => resolveListenConfig({ LOG_SERVER_HOST: '0.0.0.0' })).toThrow('LOG_SERVER_ALLOW_REMOTE=1');
        expect(() => resolveListenConfig({ LOG_SERVER_HOST: '0.0.0.0', LOG_SERVER_ALLOW_REMOTE: 'true' })).toThrow('LOG_SERVER_ALLOW_REMOTE=1');
    });

    it('refuses remote access that has no token', () => {
        expect(() => resolveListenConfig({ LOG_SERVER_HOST: '0.0.0.0', LOG_SERVER_ALLOW_REMOTE: '1' })).toThrow('LOG_SERVER_TOKEN');
        expect(() => resolveListenConfig({ LOG_SERVER_HOST: '0.0.0.0', LOG_SERVER_ALLOW_REMOTE: '1', LOG_SERVER_TOKEN: '   ' })).toThrow('LOG_SERVER_TOKEN');
    });

    it('allows remote access only with both the opt-in flag and a token', () => {
        expect(resolveListenConfig({ LOG_SERVER_HOST: '0.0.0.0', LOG_SERVER_ALLOW_REMOTE: '1', LOG_SERVER_TOKEN: 's3cret' })).toEqual({
            host: '0.0.0.0',
            port: DEFAULT_PORT,
            token: 's3cret',
        });
    });

    it('fails loudly on an invalid port instead of silently using the default', () => {
        expect(parsePort(undefined)).toBe(DEFAULT_PORT);
        expect(parsePort('   ')).toBe(DEFAULT_PORT);
        expect(parsePort('13011')).toBe(13011);
        for (const bad of ['0', '65536', 'abc', '1.5', '-1']) {
            expect(() => parsePort(bad), bad).toThrow('LOG_SERVER_PORT');
        }
    });
});

describe('log server — origin policy', () => {
    it('accepts browser origins served from localhost or loopback over http(s)', () => {
        expect(isAllowedOrigin('http://localhost:13000')).toBe(true);
        expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
        expect(isAllowedOrigin('https://localhost')).toBe(true);
        expect(isAllowedOrigin('http://[::1]:3000')).toBe(true);
    });

    it('rejects foreign, look-alike and opaque origins', () => {
        expect(isAllowedOrigin('https://evil.example')).toBe(false);
        expect(isAllowedOrigin('http://localhost.evil.example')).toBe(false);
        expect(isAllowedOrigin('http://127.0.0.1.evil.example')).toBe(false);
        expect(isAllowedOrigin('null')).toBe(false);
        expect(isAllowedOrigin('file://')).toBe(false);
        expect(isAllowedOrigin('not a url')).toBe(false);
    });

    it('treats a missing Origin header as a non-browser client', () => {
        expect(isAllowedOrigin(undefined)).toBe(true);
    });
});

describe('log server — handshake decision', () => {
    it('accepts a plain local client', () => {
        expect(evaluateHandshake(OPEN_HANDSHAKE)).toEqual({ accepted: true });
    });

    it('rejects a foreign web page with 403', () => {
        expect(evaluateHandshake({ ...OPEN_HANDSHAKE, origin: 'https://evil.example' })).toMatchObject({ accepted: false, status: 403 });
    });

    it('requires the configured token and rejects missing or wrong ones with 401', () => {
        const required = { ...OPEN_HANDSHAKE, requiredToken: 's3cret' };

        expect(evaluateHandshake(required)).toMatchObject({ accepted: false, status: 401 });
        expect(evaluateHandshake({ ...required, providedToken: 'wrong!' })).toMatchObject({ accepted: false, status: 401 });
        expect(evaluateHandshake({ ...required, providedToken: 's3cre' })).toMatchObject({ accepted: false, status: 401 });
        expect(evaluateHandshake({ ...required, providedToken: 's3cret' })).toEqual({ accepted: true });
    });

    it('refuses new clients once the connection cap is reached', () => {
        expect(evaluateHandshake({ ...OPEN_HANDSHAKE, activeClients: MAX_CLIENTS - 1 })).toEqual({ accepted: true });
        expect(evaluateHandshake({ ...OPEN_HANDSHAKE, activeClients: MAX_CLIENTS })).toMatchObject({ accepted: false, status: 503 });
    });

    it('reads the token from the query string', () => {
        expect(extractToken('/?token=abc')).toBe('abc');
        expect(extractToken('/')).toBeNull();
        expect(extractToken(undefined)).toBeNull();
    });
});

describe('log server — payload parsing', () => {
    const encode = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));

    it('parses a valid bundle and keeps the level, source and object data', () => {
        const payload = parseLogPayload(encode({ message: 'hello', level: 'warning', source: 'Worker', data: { n: 1 }, timestamp: 42 }), LIMIT);

        expect(payload).toEqual({ message: 'hello', level: 'warning', source: 'Worker', data: { n: 1 }, timestamp: 42 });
    });

    it('falls back to safe defaults for unknown level, missing source and non-object data', () => {
        const payload = parseLogPayload(encode({ message: 'x', level: 'verbose', data: 'not-an-object' }), LIMIT);

        expect(payload.level).toBe('info');
        expect(payload.source).toBe(UNKNOWN_SOURCE);
        expect(payload.data).toBeUndefined();
        expect(typeof payload.timestamp).toBe('number');
    });

    it('truncates overly long message and source fields', () => {
        const payload = parseLogPayload(encode({ message: 'm'.repeat(10_000), source: 's'.repeat(500) }), LIMIT);

        expect(payload.message).toHaveLength(8192);
        expect(payload.source).toHaveLength(128);
    });

    it('rejects oversized payloads before parsing them', () => {
        expect(() => parseLogPayload(Buffer.alloc(LIMIT + 1, 'a'), LIMIT)).toThrow('exceeds allowed limit');
    });

    it('rejects malformed JSON, non-object bodies and empty messages', () => {
        expect(() => parseLogPayload(Buffer.from('{not json'), LIMIT)).toThrow('Invalid JSON payload');
        expect(() => parseLogPayload(encode([1, 2]), LIMIT)).toThrow('Invalid log payload structure');
        expect(() => parseLogPayload(encode('text'), LIMIT)).toThrow('Invalid log payload structure');
        expect(() => parseLogPayload(encode({ message: '   ' }), LIMIT)).toThrow('non-empty message');
        expect(() => parseLogPayload(encode({}), LIMIT)).toThrow('non-empty message');
    });
});
