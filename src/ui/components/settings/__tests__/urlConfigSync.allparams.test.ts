/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, it } from 'vitest';

import type { SimulationConfig } from '@/types';

import { buildSearchFromConfigDiff, parseConfigFromSearch } from '../urlConfigSync';
import { sanitizeConfig } from '../useSettingsState.utils';

/**
 * Baseline with every SimulationConfig key set to non-default values.
 * Used to verify that all 24 params survive a parse→serialize round-trip.
 */
const DEFAULTS: SimulationConfig = {
    foodSpawnRate: 0.5,
    maxFood: 200,
    maxOrganisms: 300,
    showObstacles: true,
    mutationFactor: 0.1,
    reproductionThreshold: 150,
    drag: 0.96,
    separationWeight: 2.5,
    alignmentWeight: 1.2,
    cohesionWeight: 1.0,
    seekWeight: 3.5,
    avoidWeight: 3.5,
    organismOpacity: 0.92,
    foodOpacity: 0.85,
    organismScale: 1.0,
    foodScale: 1.2,
    bloomIntensity: 0.8,
    showGrid: true,
    gridOpacity: 0.2,
    trailLength: 80,
    showEnergyGlow: true,
    showTrails: true,
    showParticles: true,
    graphicsQuality: 'HIGH',
};

const ALL_CHANGED: SimulationConfig = {
    foodSpawnRate: 0.3,
    maxFood: 100,
    maxOrganisms: 50,
    showObstacles: false,
    mutationFactor: 0.25,
    reproductionThreshold: 200,
    drag: 0.9,
    separationWeight: 1.5,
    alignmentWeight: 0.8,
    cohesionWeight: 0.6,
    seekWeight: 2.0,
    avoidWeight: 2.0,
    organismOpacity: 0.7,
    foodOpacity: 0.6,
    organismScale: 1.5,
    foodScale: 0.8,
    bloomIntensity: 1.2,
    showGrid: false,
    gridOpacity: 0.05,
    trailLength: 40,
    showEnergyGlow: false,
    showTrails: false,
    showParticles: false,
    graphicsQuality: 'LOW',
};

describe('URL round-trip — всі 24 параметри SimulationConfig', () => {
    it('serialize → parse повертає ідентичні значення для всіх ключів', () => {
        const search = buildSearchFromConfigDiff(ALL_CHANGED, DEFAULTS);
        const params = new URLSearchParams(search);

        // всі 24 ключі повинні з'явитися в URL
        expect(params.size).toBe(Object.keys(DEFAULTS).length);

        const parsed = parseConfigFromSearch(search, DEFAULTS);
        expect(parsed).toEqual(ALL_CHANGED);
    });

    it('числові параметри зберігають точність після round-trip', () => {
        const changed: SimulationConfig = {
            ...DEFAULTS,
            foodSpawnRate: 0.123,
            drag: 0.987,
            mutationFactor: 0.045,
            bloomIntensity: 3.14,
            gridOpacity: 0.075,
        };
        const parsed = parseConfigFromSearch(buildSearchFromConfigDiff(changed, DEFAULTS), DEFAULTS);
        expect(parsed.foodSpawnRate).toBeCloseTo(0.123, 5);
        expect(parsed.drag).toBeCloseTo(0.987, 5);
        expect(parsed.mutationFactor).toBeCloseTo(0.045, 5);
        expect(parsed.bloomIntensity).toBeCloseTo(3.14, 5);
        expect(parsed.gridOpacity).toBeCloseTo(0.075, 5);
    });

    it('булеві параметри (всі 6) коректно серіалізуються та парсяться', () => {
        const allFalse: SimulationConfig = {
            ...DEFAULTS,
            showObstacles: false,
            showGrid: false,
            showEnergyGlow: false,
            showTrails: false,
            showParticles: false,
        };
        const parsed = parseConfigFromSearch(buildSearchFromConfigDiff(allFalse, DEFAULTS), DEFAULTS);
        expect(parsed.showObstacles).toBe(false);
        expect(parsed.showGrid).toBe(false);
        expect(parsed.showEnergyGlow).toBe(false);
        expect(parsed.showTrails).toBe(false);
        expect(parsed.showParticles).toBe(false);
    });

    it('graphicsQuality — всі валідні enum значення', () => {
        const qualities = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA', 'CUSTOM'] as const;
        for (const q of qualities) {
            const changed = { ...DEFAULTS, graphicsQuality: q };
            const parsed = parseConfigFromSearch(buildSearchFromConfigDiff(changed, DEFAULTS), DEFAULTS, {
                graphicsQuality: (v, f) => (['LOW', 'MEDIUM', 'HIGH', 'ULTRA', 'CUSTOM'] as const).includes(v as never) ? v : f,
            });
            expect(parsed.graphicsQuality).toBe(q);
        }
    });

    it('параметри зі значенням default не потрапляють в URL (clean URL)', () => {
        const changed: SimulationConfig = { ...DEFAULTS, maxFood: 999 };
        const params = new URLSearchParams(buildSearchFromConfigDiff(changed, DEFAULTS));
        expect(params.size).toBe(1);
        expect(params.get('maxFood')).toBe('999');
    });
});

describe('sanitizeConfig — клампінг CONFIG_LIMITS', () => {
    it('клампить maxOrganisms в межах 10–1000', () => {
        expect(sanitizeConfig({ ...DEFAULTS, maxOrganisms: 5 }, DEFAULTS).maxOrganisms).toBe(10);
        expect(sanitizeConfig({ ...DEFAULTS, maxOrganisms: 9999 }, DEFAULTS).maxOrganisms).toBe(1000);
        expect(sanitizeConfig({ ...DEFAULTS, maxOrganisms: 200 }, DEFAULTS).maxOrganisms).toBe(200);
    });

    it('клампить maxFood в межах 50–2000', () => {
        expect(sanitizeConfig({ ...DEFAULTS, maxFood: 10 }, DEFAULTS).maxFood).toBe(50);
        expect(sanitizeConfig({ ...DEFAULTS, maxFood: 5000 }, DEFAULTS).maxFood).toBe(2000);
    });

    it('клампить foodSpawnRate в межах 0–1', () => {
        expect(sanitizeConfig({ ...DEFAULTS, foodSpawnRate: -0.5 }, DEFAULTS).foodSpawnRate).toBe(0);
        expect(sanitizeConfig({ ...DEFAULTS, foodSpawnRate: 2.0 }, DEFAULTS).foodSpawnRate).toBe(1);
    });

    it('клампить drag в межах 0.8–1', () => {
        expect(sanitizeConfig({ ...DEFAULTS, drag: 0.5 }, DEFAULTS).drag).toBe(0.8);
        expect(sanitizeConfig({ ...DEFAULTS, drag: 1.5 }, DEFAULTS).drag).toBe(1);
    });

    it('клампить trailLength в межах 0–120 (включаючи default 80 та ULTRA 120)', () => {
        expect(sanitizeConfig({ ...DEFAULTS, trailLength: -10 }, DEFAULTS).trailLength).toBe(0);
        expect(sanitizeConfig({ ...DEFAULTS, trailLength: 200 }, DEFAULTS).trailLength).toBe(120);
        expect(sanitizeConfig({ ...DEFAULTS, trailLength: 80 }, DEFAULTS).trailLength).toBe(80);
        expect(sanitizeConfig({ ...DEFAULTS, trailLength: 120 }, DEFAULTS).trailLength).toBe(120);
    });

    it('клампить organismScale в межах 0.3–3', () => {
        expect(sanitizeConfig({ ...DEFAULTS, organismScale: 0.1 }, DEFAULTS).organismScale).toBe(0.3);
        expect(sanitizeConfig({ ...DEFAULTS, organismScale: 10 }, DEFAULTS).organismScale).toBe(3);
    });

    it('параметри без лімітів (separationWeight і т.д.) приймають будь-які числа', () => {
        expect(sanitizeConfig({ ...DEFAULTS, separationWeight: 99 }, DEFAULTS).separationWeight).toBe(99);
        expect(sanitizeConfig({ ...DEFAULTS, alignmentWeight: 0 }, DEFAULTS).alignmentWeight).toBe(0);
    });

    it('NaN та Infinity замінюються на default', () => {
        expect(sanitizeConfig({ ...DEFAULTS, maxFood: NaN }, DEFAULTS).maxFood).toBe(DEFAULTS.maxFood);
        expect(sanitizeConfig({ ...DEFAULTS, bloomIntensity: Infinity }, DEFAULTS).bloomIntensity).toBe(DEFAULTS.bloomIntensity);
    });
});
