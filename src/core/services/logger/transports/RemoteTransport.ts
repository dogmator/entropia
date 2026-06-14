import type { LogEntry } from '../types';

/**
 * Interface for remote logging transports.
 */
export interface RemoteTransport {
    /** Sends log entry to a remote destination. */
    send(entry: LogEntry): void;

    /** Activates or deactivates the transport. */
    setEnabled(enabled: boolean): void;

    /** Closes connection and releases resources. */
    close(): void;
}
