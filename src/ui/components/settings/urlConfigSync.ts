/**
 * Entropia 3D — Two-way synchronization utility for SimulationConfig and URL.
 *
 * Provides:
 * - Strictly typed parsing of query parameters into SimulationConfig.
 * - Serialization of only deviations from defaults (Clean URL).
 * - History updates via replaceState / pushState.
 */

import type { SimulationConfig } from '@/types';

/** URL update mode: 'push' adds a history entry, 'replace' overwrites current. */
export type UrlHistoryMode = 'push' | 'replace';

/** SimulationConfig without readonly modifiers for safe object construction. */
export type MutableSimulationConfig = { -readonly [K in keyof SimulationConfig]: SimulationConfig[K] };

type ConfigKey = keyof SimulationConfig;
type WritableConfigRecord = Record<ConfigKey, SimulationConfig[ConfigKey]>;

/** Dictionary of optional validators for specific configuration keys. */
type ConfigValidator = {
    [K in ConfigKey]?: (value: SimulationConfig[K], defaultValue: SimulationConfig[K]) => SimulationConfig[K];
};

const BOOLEAN_TRUE_VALUES = new Set(['true', '1']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0']);

const isObjectValue = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseBoolean = (rawValue: string): boolean | null => {
    const normalized = rawValue.trim().toLowerCase();
    if (BOOLEAN_TRUE_VALUES.has(normalized)) { return true; }
    if (BOOLEAN_FALSE_VALUES.has(normalized)) { return false; }
    return null;
};

const parseJsonArray = (rawValue: string): unknown[] | null => {
    try {
        const parsed: unknown = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const parseJsonObject = (rawValue: string): Record<string, unknown> | null => {
    try {
        const parsed: unknown = JSON.parse(rawValue);
        return isObjectValue(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/**
 * Converting URL parameter string value to corresponding configuration field type.
 * Returns null if the value cannot be safely recognized.
 */
const parseByDefaultType = <K extends ConfigKey>(
    rawValue: string,
    defaultValue: SimulationConfig[K]
): SimulationConfig[K] | null => {
    if (typeof defaultValue === 'number') {
        const parsed = Number(rawValue);
        return Number.isFinite(parsed) ? (parsed as SimulationConfig[K]) : null;
    }

    if (typeof defaultValue === 'boolean') { return parseBoolean(rawValue) as SimulationConfig[K] | null; }
    if (typeof defaultValue === 'string') { return rawValue as SimulationConfig[K]; }
    if (Array.isArray(defaultValue)) { return parseJsonArray(rawValue) as SimulationConfig[K] | null; }
    if (isObjectValue(defaultValue)) { return parseJsonObject(rawValue) as SimulationConfig[K] | null; }

    return null;
};

/**
 * Serialization of configuration field value to string for URL parameter.
 */
const serializeValue = (value: SimulationConfig[ConfigKey]): string => {
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
        return String(value);
    }
    return JSON.stringify(value);
};

/**
 * Comparing two configuration field values for equality.
 * Strict comparison for primitives, structural comparison via JSON for objects.
 */
const areValuesEqual = (
    left: SimulationConfig[ConfigKey],
    right: SimulationConfig[ConfigKey]
): boolean => {
    if (typeof left !== 'object' || typeof right !== 'object') {
        return left === right;
    }
    return JSON.stringify(left) === JSON.stringify(right);
};

/**
 * Parsing URL query string into SimulationConfig.
 *
 * Missing keys in URL get values from defaultConfig.
 * Unknown keys are ignored. Invalid values are discarded in favor of defaults.
 * Optional validators dictionary allows extra validation for specific keys.
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
 * Serialization of config deviations from defaultConfig into a query parameter string.
 *
 * Keys with values identical to defaults are not included (Clean URL).
 * Returns an empty string if config is identical to defaultConfig.
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
 * Updating browser URL according to current configuration state.
 *
 * Uses history.pushState for discrete actions (toggles, presets)
 * or history.replaceState for frequent updates (sliders).
 * Does not change URL if the new value is identical to current.
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
