/**
 * Entropia 3D — Утиліта для асинхронного ведення логів.
 *
 * Реалізує механізм неблокуючого виводу діагностичних повідомлень
 * за допомогою мікрозадач (queueMicrotask), що мінімізує вплив на
 * основний розрахунковий цикл симуляції.
 */
export class Logger {
    /**
     * Формування часової мітки у форматі ISO.
     */
    private static getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Допоміжний метод для безпечного формування аргументів логування.
     */
    private static formatArgs(tag: string, message: unknown, ...args: unknown[]): unknown[] {
        const timestamp = `[${tag}] [${this.getTimestamp()}]`;
        if (typeof message === 'string') {
            return [`${timestamp} ${message}`, ...args];
        }
        return [timestamp, message, ...args];
    }

    /**
     * Реєстрація повідомлення рівня відладки (Debug).
     */
    static debug(message: unknown, ...args: unknown[]): void {
        queueMicrotask(() => {
            console.log(...this.formatArgs('DEBUG', message, ...args));
        });
    }

    /**
     * Реєстрація попередження (Warning).
     */
    static warn(message: unknown, ...args: unknown[]): void {
        queueMicrotask(() => {
            console.warn(...this.formatArgs('ПОПЕРЕДЖЕННЯ', message, ...args));
        });
    }

    /**
     * Реєстрація помилки (Error).
     */
    static error(message: unknown, ...args: unknown[]): void {
        queueMicrotask(() => {
            console.error(...this.formatArgs('ПОМИЛКА', message, ...args));
        });
    }
}
