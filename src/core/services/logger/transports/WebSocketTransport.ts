import { DEBUG_CONFIG } from '@/config';

import { LogEntry } from '../types';
import { RemoteTransport } from './RemoteTransport';

/**
 * WebSocketTransport — реалізація транспорту логування через WebSocket.
 * Підтримує чергу повідомлень та автоматичне перепідключення.
 */
export class WebSocketTransport implements RemoteTransport {
    private socket: WebSocket | null = null;
    private messageQueue: LogEntry[] = [];
    private isConnecting: boolean = false;
    private enabled: boolean = false;
    private endpoint: string;

    constructor(endpoint: string = DEBUG_CONFIG.remoteWsEndpoint) {
        this.endpoint = endpoint;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) {
            this.connect();
        } else {
            this.close();
        }
    }

    public send(entry: LogEntry): void {
        if (!this.enabled) return;

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(entry);
            this.connect();
            return;
        }

        try {
            this.socket.send(JSON.stringify(entry));
        } catch (error) {
            this.messageQueue.push(entry);
            this.connect();
        }
    }

    public close(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnecting = false;
    }

    private connect(): void {
        if (this.socket || this.isConnecting || !this.enabled) return;

        this.isConnecting = true;

        try {
            this.socket = new WebSocket(this.endpoint);

            this.socket.onopen = () => {
                this.isConnecting = false;
                console.debug('[\x1b[36mLogger:WS\x1b[0m] Connected to', this.endpoint);
                this.flushQueue();
            };

            this.socket.onclose = () => {
                this.socket = null;
                this.isConnecting = false;
                if (this.enabled) {
                    // Рекінект через 3 секунди
                    setTimeout(() => this.connect(), 3000);
                }
            };

            this.socket.onerror = () => {
                this.isConnecting = false;
            };
        } catch (error) {
            this.isConnecting = false;
            console.warn('WebSocketTransport: Connection failed', error);
        }
    }

    private flushQueue(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        while (this.messageQueue.length > 0) {
            const entry = this.messageQueue.shift();
            if (entry) this.socket.send(JSON.stringify(entry));
        }
    }
}
