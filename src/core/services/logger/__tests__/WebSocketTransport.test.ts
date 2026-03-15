import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketTransport } from '../transports/WebSocketTransport';
import type { LogEntry } from '../types';
import { LogLevel } from '../types';

const OPEN_STATE = 1;
const CLOSED_STATE = 3;
const QUEUE_OVERFLOW_ITERATIONS = 350;

class MockWebSocket {
    public static readonly OPEN = OPEN_STATE;
    public static readonly instances: MockWebSocket[] = [];

    public readyState = CLOSED_STATE;
    public onopen: (() => void) | null = null;
    public onclose: (() => void) | null = null;
    public onerror: ((error: unknown) => void) | null = null;
    public sent: string[] = [];

    constructor(public endpoint: string) {
        MockWebSocket.instances.push(this);
    }

    public send(payload: string): void {
        this.sent.push(payload);
    }

    public close(): void {
        this.readyState = CLOSED_STATE;
        this.onclose?.();
    }

    public open(): void {
        this.readyState = OPEN_STATE;
        this.onopen?.();
    }
}

const createEntry = (message: string): LogEntry => ({
    timestamp: Date.now(),
    level: LogLevel.INFO,
    message,
    source: 'Unit'
});

describe('logger/WebSocketTransport', () => {
    beforeEach(() => {
        MockWebSocket.instances.length = 0;
        vi.stubGlobal('WebSocket', MockWebSocket);
    });

    it('queues messages before socket opens and flushes after open', () => {
        const transport = new WebSocketTransport('ws://test');
        transport.setEnabled(true);

        transport.send(createEntry('queued'));

        const socket = MockWebSocket.instances[0];
        expect(socket).toBeDefined();
        expect(socket?.sent).toHaveLength(0);

        socket?.open();

        expect(socket?.sent).toHaveLength(1);
        expect(socket?.sent[0]).toContain('queued');
    });

    it('does not reconnect when disabled', () => {
        vi.useFakeTimers();
        const transport = new WebSocketTransport('ws://test');
        transport.setEnabled(true);

        const socket = MockWebSocket.instances[0];
        expect(socket).toBeDefined();

        transport.setEnabled(false);
        socket?.onclose?.();
        vi.runAllTimers();

        expect(MockWebSocket.instances).toHaveLength(1);
        vi.useRealTimers();
    });

    it('trims queue on overflow and eventually flushes bounded batch', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const transport = new WebSocketTransport('ws://test');
        transport.setEnabled(true);

        for (let index = 0; index < QUEUE_OVERFLOW_ITERATIONS; index += 1) {
            transport.send(createEntry(`entry-${index}`));
        }

        const socket = MockWebSocket.instances[0];
        socket?.open();

        expect((socket?.sent.length ?? 0)).toBeLessThan(QUEUE_OVERFLOW_ITERATIONS);
        expect(warnSpy).toHaveBeenCalledWith('WebSocketTransport: Queue overflow, oldest entries were trimmed');
    });
});
