/**
 * Entropia 3D — Конфігураційні параметри системи дебагу та логування.
 */

export const DEBUG_CONFIG = {
    /** Увімкнення віддаленого логування за замовчуванням у DEV режимі. */
    remoteLoggingEnabled: true,

    /** Порт сервера логів. */
    remotePort: 3011,

    /** Хост сервера логів. */
    remoteHost: '127.0.0.1',

    /** Шлях до кінцевої точки логування. */
    remotePath: '/log',

    /** Конструктор повного URL для віддаленого логування (HTTP). */
    get remoteEndpoint(): string {
        return `http://${this.remoteHost}:${this.remotePort}${this.remotePath}`;
    },

    /** Конструктор повного URL для віддаленого логування (WebSocket). */
    get remoteWsEndpoint(): string {
        return `ws://${this.remoteHost}:${this.remotePort}`;
    }
} as const;

/**
 * Інтервал перевірки та оновлення об'ємів (bounding volumes) для raycasting.
 * (Збігається з RENDER.interaction.hoverInterval, якщо він доступний)
 */
export const DEBUG_RAYCAST_UPDATE_INTERVAL = 0.5; // Секунди
