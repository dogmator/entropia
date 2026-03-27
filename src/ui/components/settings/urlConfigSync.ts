import type { SimulationConfig } from '@/types';

export type UrlHistoryMode = 'push' | 'replace';

type ConfigKey = keyof SimulationConfig;
type MutableSimulationConfig = { -readonly [K in keyof SimulationConfig]: SimulationConfig[K] };
type SimulationConfigRecord = Record<ConfigKey, SimulationConfig[ConfigKey]>;

type ConfigValidator = {
    [K in ConfigKey]?: (value: SimulationConfig[K], defaultValue: SimulationConfig[K]) => SimulationConfig[K];
};

const BOOLEAN_TRUE_VALUES = new Set(['true', '1']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0']);

const isObjectValue = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

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
        if (BOOLEAN_TRUE_VALUES.has(normalized)) {
            return true as SimulationConfig[K];
        }
        if (BOOLEAN_FALSE_VALUES.has(normalized)) {
            return false as SimulationConfig[K];
        }
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

const serializeValue = (value: SimulationConfig[ConfigKey]): string => {
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
        return String(value);
    }

    return JSON.stringify(value);
};

const areValuesEqual = (left: SimulationConfig[ConfigKey], right: SimulationConfig[ConfigKey]): boolean => {
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
        return left === right;
    }

    return JSON.stringify(left) === JSON.stringify(right);
};

export const parseConfigFromSearch = (
    search: string,
    defaultConfig: SimulationConfig,
    validators: ConfigValidator = {}
): SimulationConfig => {
    const params = new URLSearchParams(search);
    const nextConfig: MutableSimulationConfig = { ...defaultConfig };
    const writableConfig = nextConfig as SimulationConfigRecord;

    (Object.keys(defaultConfig) as ConfigKey[]).forEach((key) => {
        const rawValue = params.get(key);
        if (rawValue === null) {
            return;
        }

        const parsed = parseByDefaultType(rawValue, defaultConfig[key]);
        if (parsed === null) {
            return;
        }

        const validator = validators[key] as
            | ((value: SimulationConfig[ConfigKey], defaultValue: SimulationConfig[ConfigKey]) => SimulationConfig[ConfigKey])
            | undefined;
        const nextValue = validator ? validator(parsed, defaultConfig[key]) : parsed;
        writableConfig[key] = nextValue;
    });

    return nextConfig;
};

export const buildSearchFromConfigDiff = (
    config: SimulationConfig,
    defaultConfig: SimulationConfig
): string => {
    const params = new URLSearchParams();

    (Object.keys(defaultConfig) as ConfigKey[]).forEach((key) => {
        if (areValuesEqual(config[key], defaultConfig[key])) {
            return;
        }

        params.set(key, serializeValue(config[key]));
    });

    return params.toString();
};

export const updateUrlFromConfig = (
    config: SimulationConfig,
    defaultConfig: SimulationConfig,
    mode: UrlHistoryMode
): void => {
    const search = buildSearchFromConfigDiff(config, defaultConfig);
    const path = window.location.pathname;
    const hash = window.location.hash;
    const nextUrl = search ? `${path}?${search}${hash}` : `${path}${hash}`;
    const currentUrl = `${path}${window.location.search}${hash}`;

    if (nextUrl === currentUrl) {
        return;
    }

    if (mode === 'push') {
        window.history.pushState(null, '', nextUrl);
        return;
    }

    window.history.replaceState(null, '', nextUrl);
};
