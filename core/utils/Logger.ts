
/**
 * Асинхронний логер для розробки.
 * Допомагає не забивати основний потік (hot path) важкими операціями виводу,
 * та автоматично вимикається в production.
 */

class Logger {
    private static isDev = (import.meta as any).env?.DEV;

    /**
     * Лог для дебагу. Працює тільки в DEV режимі.
     * Виконується асинхронно через queueMicrotask або setTimeout.
     */
    public static debug(message: string, ...args: any[]): void {
        if (!this.isDev) return;

        // Використовуємо setTimeout(0) для винесення логу з поточного кадру анімації
        setTimeout(() => {
            console.log(`%c[DEBUG]%c ${message}`, 'color: #10b981; font-weight: bold;', 'color: inherit;', ...args);
        }, 0);
    }

    /**
     * Попередження. Працює завжди в DEV, в PROD може бути обмежений.
     */
    public static warn(message: string, ...args: any[]): void {
        if (!this.isDev) return;

        setTimeout(() => {
            console.warn(`[WARN] ${message}`, ...args);
        }, 0);
    }

    /**
     * Помилка.
     */
    public static error(message: string, ...args: any[]): void {
        // Помилки логуємо завжди, але асинхронно
        setTimeout(() => {
            console.error(`[ERROR] ${message}`, ...args);
        }, 0);
    }
}

export default Logger;
