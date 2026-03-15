import { DEBUG_CONFIG } from '@/config';

import { LogEntry } from '../types';
import { RemoteTransport } from './RemoteTransport';

const RECONNECT_DELAY_MS = 3000;
const MAX_QUEUE_SIZE = 300;
const QUEUE_TRIM_COUNT = 30;

const serializeEntry = (entry: LogEntry): string => JSON.stringify(entry);

const isSocketOpen = (socket: WebSocket | null): socket is WebSocket =>
    socket !== null && socket.readyState === WebSocket.OPEN;

/**
 * WebSocketTransport — реалізація транспорту логування через WebSocket.
 * Підтримує чергу повідомлень, backpressure та автоматичне перепідключення.
 */
export class WebSocketTransport implements RemoteTransport {
    private socket: WebSocket | null = null;
    private messageQueue: LogEntry[] = [];
    private isConnecting: boolean = false;
    private enabled: boolean = false;
    private endpoint: string;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(endpoint: string = DEBUG_CONFIG.remoteWsEndpoint) {
        this.endpoint = endpoint;
    }

    public setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) {
            return;
        }

        this.enabled = enabled;
        if (enabled) {
            this.connect();
            return;
        }

        this.close();
    }

    public send(entry: LogEntry): void {
        if (!this.enabled) {
            return;
        }

        if (!isSocketOpen(this.socket)) {
            this.enqueue(entry);
            this.connect();
            return;
        }

        this.sendOverSocket(entry);
    }

    public close(): void {
        this.clearReconnectTimer();

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.isConnecting = false;
    }

    private connect(): void {
        if (this.socket || this.isConnecting || !this.enabled) {
            return;
        }

        this.isConnecting = true;

        try {
            this.socket = new WebSocket(this.endpoint);
            this.bindSocketHandlers();
        } catch (error) {
            this.isConnecting = false;
            console.warn('WebSocketTransport: Connection failed', error);
            this.scheduleReconnect();
        }
    }

    private bindSocketHandlers(): void {
        if (!this.socket) {
            return;
        }

        this.socket.onopen = () => this.handleOpen();
        this.socket.onclose = () => this.handleClose();
        this.socket.onerror = (error) => this.handleError(error);
    }

    private handleOpen(): void {
        this.isConnecting = false;
        this.clearReconnectTimer();
        console.debug('[\x1b[36mLogger:WS\x1b[0m] Connected to', this.endpoint);
        this.flushQueue();
    }

    private handleClose(): void {
        this.socket = null;
        this.isConnecting = false;
        this.scheduleReconnect();
    }

    private handleError(error: unknown): void {
        this.isConnecting = false;
        console.warn('[\x1b[31mLogger:WS\x1b[0m] WebSocket error:', error);
    }

    private scheduleReconnect(): void {
        if (!this.enabled || this.reconnectTimer) {
            return;
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, RECONNECT_DELAY_MS);
    }

    private clearReconnectTimer(): void {
        if (!this.reconnectTimer) {
            return;
        }

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    private sendOverSocket(entry: LogEntry): void {
        if (!isSocketOpen(this.socket)) {
            this.enqueue(entry);
            return;
        }

        try {
            this.socket.send(serializeEntry(entry));
        } catch (error) {
            console.warn('WebSocketTransport: Send failed, re-queue entry', error);
            this.enqueue(entry);
            this.scheduleReconnect();
        }
    }

    private flushQueue(): void {
        if (!isSocketOpen(this.socket)) {
            return;
        }

        while (this.messageQueue.length > 0) {
            const entry = this.messageQueue.shift();
            if (!entry) {
                continue;
            }

            try {
                this.socket.send(serializeEntry(entry));
            } catch (error) {
                console.warn('WebSocketTransport: Flush failed, entry returned to queue', error);
                this.messageQueue.unshift(entry);
                this.scheduleReconnect();
                break;
            }
        }
    }

    private enqueue(entry: LogEntry): void {
        this.messageQueue.push(entry);
        if (this.messageQueue.length <= MAX_QUEUE_SIZE) {
            return;
        }

        this.messageQueue.splice(0, QUEUE_TRIM_COUNT);
        console.warn('WebSocketTransport: Queue overflow, oldest entries were trimmed');
    }
}
