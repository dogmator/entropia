import { describe, expect, it, vi } from 'vitest';

import type { SimulationConfig } from '@/types';

import {
    buildSearchFromConfigDiff,
    parseConfigFromSearch,
    updateUrlFromConfig,
} from '../urlConfigSync';

const DEFAULT_CONFIG: SimulationConfig = {
    foodSpawnRate: 0.2,
    maxFood: 120,
    maxOrganisms: 250,
    showObstacles: true,
    mutationFactor: 0.1,
    reproductionThreshold: 200,
    drag: 0.94,
    separationWeight: 1,
    alignmentWeight: 1,
    cohesionWeight: 1,
    seekWeight: 1,
    avoidWeight: 1,
    organismOpacity: 0.85,
    foodOpacity: 1,
    organismScale: 1,
    foodScale: 1,
    bloomIntensity: 1,
    showGrid: false,
    gridOpacity: 0.2,
    trailLength: 16,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'HIGH',
};

describe('urlConfigSync', () => {
    it('parses known keys and ignores unknown query parameters', () => {
        const parsed = parseConfigFromSearch(
            '?maxFood=300&showObstacles=false&unknownKey=boom',
            DEFAULT_CONFIG
        );

        expect(parsed.maxFood).toBe(300);
        expect(parsed.showObstacles).toBe(false);
        expect((parsed as Record<string, unknown>).unknownKey).toBeUndefined();
    });

    it('falls back to defaults for invalid numeric and enum-like values', () => {
        const parsed = parseConfigFromSearch(
            '?maxFood=abc&graphicsQuality=INVALID',
            DEFAULT_CONFIG,
            {
                graphicsQuality: (value, fallback) => (
                    value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'ULTRA' || value === 'CUSTOM'
                        ? value
                        : fallback
                ),
            }
        );

        expect(parsed.maxFood).toBe(DEFAULT_CONFIG.maxFood);
        expect(parsed.graphicsQuality).toBe(DEFAULT_CONFIG.graphicsQuality);
    });

    it('builds clean query string only from values different than defaults', () => {
        const changed: SimulationConfig = {
            ...DEFAULT_CONFIG,
            maxFood: 300,
            showGrid: true,
        };

        const search = buildSearchFromConfigDiff(changed, DEFAULT_CONFIG);
        const params = new URLSearchParams(search);

        expect(params.get('maxFood')).toBe('300');
        expect(params.get('showGrid')).toBe('true');
        expect(params.has('foodSpawnRate')).toBe(false);
    });

    it('uses replaceState for frequent updates and pushState for discrete updates', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        const pushSpy = vi.spyOn(window.history, 'pushState');

        const replaceConfig: SimulationConfig = {
            ...DEFAULT_CONFIG,
            maxFood: 500,
        };
        const pushConfig: SimulationConfig = {
            ...DEFAULT_CONFIG,
            maxFood: 600,
        };

        updateUrlFromConfig(replaceConfig, DEFAULT_CONFIG, 'replace');
        updateUrlFromConfig(pushConfig, DEFAULT_CONFIG, 'push');

        expect(replaceSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledTimes(1);

        replaceSpy.mockRestore();
        pushSpy.mockRestore();
    });
});
