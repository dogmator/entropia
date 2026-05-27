/**
 * Entropia 3D — Утиліта двосторонньої синхронізації SimulationConfig з URL.
 *
 * Забезпечує:
 * - Строго типізований парсинг query-параметрів у SimulationConfig.
 * - Серіалізацію лише відхилень від defaults (Clean URL).
 * - Оновлення history через replaceState / pushState.
 */

import type { SimulationConfig } from '@/types';

/** Режим оновлення URL: 'push' додає запис в history, 'replace' — перезаписує поточний. */
export type UrlHistoryMode = 'push' | 'replace';

/** SimulationConfig без readonly-модифікаторів для безпечної побудови об'єктів. */
export type MutableSimulationConfig = { -readonly [K in keyof SimulationConfig]: SimulationConfig[K] };

type ConfigKey = keyof SimulationConfig;
type WritableConfigRecord = Record<ConfigKey, SimulationConfig[ConfigKey]>;

/** Словник опціональних валідаторів для конкретних ключів конфігурації. */
type ConfigValidator = {
    [K in ConfigKey]?: (value: SimulationConfig[K], defaultValue: SimulationConfig[K]) => SimulationConfig[K];
};

const BOOLEAN_TRUE_VALUES = new Set(['true', '1']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0']);

const isObjectValue = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Перетворення рядкового значення URL-параметра у тип відповідного поля конфігурації.
 * Повертає null, якщо значення не може бути безпечно розпізнане.
 */
const parseByDefaultType = <K extends ConfigKey>(
    rawValue: string,
    defaultValue: SimulationConfig[K]
): SimulationConfig[K] | null => {
    if (typeof defaultValue === 'number') {
        const parsed = Number(rawValue);
        return Number.isFinite(parsed) ? (parsed as SimulationConfig[K]) : null;
    }

    if (typeof defaultValue === 'boolean') {
        const normalized = rawValue.trim().toLowerCase();
        if (BOOLEAN_TRUE_VALUES.has(normalized)) { return true as SimulationConfig[K]; }
        if (BOOLEAN_FALSE_VALUES.has(normalized)) { return false as SimulationConfig[K]; }
        return null;
    }

    if (typeof defaultValue === 'string') {
        return rawValue as SimulationConfig[K];
    }

    if (Array.isArray(defaultValue)) {
        try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? (parsed as unknown as SimulationConfig[K]) : null;
        } catch {
            return null;
        }
    }

    if (isObjectValue(defaultValue)) {
        try {
            const parsed = JSON.parse(rawValue);
            return isObjectValue(parsed) ? (parsed as unknown as SimulationConfig[K]) : null;
        } catch {
            return null;
        }
    }

    return null;
};

/**
 * Серіалізація значення поля конфігурації у рядок для URL-параметра.
 */
const serializeValue = (value: SimulationConfig[ConfigKey]): string => {
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
        return String(value);
    }
    return JSON.stringify(value);
};

/**
 * Порівняння двох значень поля конфігурації на рівність.
 * Для примітивів — строге порівняння, для об'єктів — структурне через JSON.
 */
const areValuesEqual = (
    left: SimulationConfig[ConfigKey],
    right: SimulationConfig[ConfigKey]
): boolean => {
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
        return left === right;
    }
    return JSON.stringify(left) === JSON.stringify(right);
};

/**
 * Парсинг URL query-рядка у SimulationConfig.
 *
 * Ключі, відсутні в URL, отримують значення з defaultConfig.
 * Невідомі ключі ігноруються. Невалідні значення відкидаються на користь defaults.
 * Опціональний словник validators дозволяє додаткову валідацію конкретних ключів.
 */
export const parseConfigFromSearch = (
    search: string,
    defaultConfig: SimulationConfig,
    validators: ConfigValidator = {}
): SimulationConfig => {
    const params = new URLSearchParams(search);
    const nextConfig = { ...defaultConfig } as MutableSimulationConfig;
    const writable = nextConfig as WritableConfigRecord;

    (Object.keys(defaultConfig) as ConfigKey[]).forEach((key) => {
        const rawValue = params.get(key);
        if (rawValue === null) { return; }

        const parsed = parseByDefaultType(rawValue, defaultConfig[key]);
        if (parsed === null) { return; }

        const validator = validators[key] as
            | ((value: SimulationConfig[ConfigKey], defaultValue: SimulationConfig[ConfigKey]) => SimulationConfig[ConfigKey])
            | undefined;
        writable[key] = validator ? validator(parsed, defaultConfig[key]) : parsed;
    });

    return nextConfig;
};

/**
 * Серіалізація відхилень config від defaultConfig у рядок query-параметрів.
 *
 * Ключі, значення яких збігаються з defaults, у результат не потрапляють (Clean URL).
 * Повертає порожній рядок, якщо config ідентичний defaultConfig.
 */
export const buildSearchFromConfigDiff = (
    config: SimulationConfig,
    defaultConfig: SimulationConfig
): string => {
    const params = new URLSearchParams();

    (Object.keys(defaultConfig) as ConfigKey[]).forEach((key) => {
        if (areValuesEqual(config[key], defaultConfig[key])) { return; }
        params.set(key, serializeValue(config[key]));
    });

    return params.toString();
};

/**
 * Оновлення URL браузера відповідно до поточного стану конфігурації.
 *
 * Використовує history.pushState для дискретних дій (тоггли, пресети)
 * або history.replaceState для частих оновлень (слайдери).
 * Не змінює URL, якщо нове значення ідентичне поточному.
 */
export const updateUrlFromConfig = (
    config: SimulationConfig,
    defaultConfig: SimulationConfig,
    mode: UrlHistoryMode
): void => {
    const search = buildSearchFromConfigDiff(config, defaultConfig);
    const { pathname: path, hash, search: currentSearch } = window.location;
    const nextUrl = search ? `${path}?${search}${hash}` : `${path}${hash}`;
    const currentUrl = `${path}${currentSearch}${hash}`;

    if (nextUrl === currentUrl) { return; }

    if (mode === 'push') {
        window.history.pushState(null, '', nextUrl);
        return;
    }

    window.history.replaceState(null, '', nextUrl);
};
