import { LogEntry } from '../types';

/**
 * Інтерфейс для транспортів віддаленого логування.
 */
export interface RemoteTransport {
    /** Надсилає запис логу до віддаленого пункту призначення. */
    send(entry: LogEntry): void;

    /** Активує або деактивує транспорт. */
    setEnabled(enabled: boolean): void;

    /** Закриває з'єднання та звільняє ресурси. */
    close(): void;
}
