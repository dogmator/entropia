/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// ============================================================================
// parseConfigFromSearch
// ============================================================================

describe('parseConfigFromSearch', () => {
    it('парсить відомі ключі та ігнорує невідомі query-параметри', () => {
        const parsed = parseConfigFromSearch(
            '?maxFood=300&showObstacles=false&unknownKey=boom',
            DEFAULT_CONFIG
        );

        expect(parsed.maxFood).toBe(300);
        expect(parsed.showObstacles).toBe(false);
        expect((parsed as unknown as Record<string, unknown>)['unknownKey']).toBeUndefined();
    });

    it('повертає defaults при порожньому рядку пошуку', () => {
        const parsed = parseConfigFromSearch('', DEFAULT_CONFIG);
        expect(parsed).toEqual(DEFAULT_CONFIG);
    });

    it('повертає defaults при відсутності query-рядка', () => {
        const parsed = parseConfigFromSearch('?', DEFAULT_CONFIG);
        expect(parsed).toEqual(DEFAULT_CONFIG);
    });

    it('відкидає невалідні числа на користь default', () => {
        const parsed = parseConfigFromSearch('?maxFood=abc&drag=NaN', DEFAULT_CONFIG);
        expect(parsed.maxFood).toBe(DEFAULT_CONFIG.maxFood);
        expect(parsed.drag).toBe(DEFAULT_CONFIG.drag);
    });

    it('відкидає Infinity та -Infinity на користь default', () => {
        const parsed = parseConfigFromSearch('?maxFood=Infinity&maxOrganisms=-Infinity', DEFAULT_CONFIG);
        expect(parsed.maxFood).toBe(DEFAULT_CONFIG.maxFood);
        expect(parsed.maxOrganisms).toBe(DEFAULT_CONFIG.maxOrganisms);
    });

    it('парсить булеві значення: true/false та 1/0 (регістро-незалежно)', () => {
        const parsed = parseConfigFromSearch(
            '?showGrid=true&showObstacles=0&showTrails=1&showParticles=FALSE',
            DEFAULT_CONFIG
        );
        expect(parsed.showGrid).toBe(true);
        expect(parsed.showObstacles).toBe(false);
        expect(parsed.showTrails).toBe(true);
        expect(parsed.showParticles).toBe(false);
    });

    it('відкидає невалідне булеве значення на користь default', () => {
        const parsed = parseConfigFromSearch('?showGrid=maybe&showEnergyGlow=yes', DEFAULT_CONFIG);
        expect(parsed.showGrid).toBe(DEFAULT_CONFIG.showGrid);
        expect(parsed.showEnergyGlow).toBe(DEFAULT_CONFIG.showEnergyGlow);
    });

    it('застосовує validator та відкидає невалідний enum', () => {
        const parsed = parseConfigFromSearch(
            '?maxFood=abc&graphicsQuality=INVALID',
            DEFAULT_CONFIG,
            {
                graphicsQuality: (value, fallback) => (
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'ULTRA' || value === 'CUSTOM'
                        ? value
                        : fallback
                ),
            }
        );

        expect(parsed.maxFood).toBe(DEFAULT_CONFIG.maxFood);
        expect(parsed.graphicsQuality).toBe(DEFAULT_CONFIG.graphicsQuality);
    });

    it('парсить числа з плаваючою крапкою', () => {
        const parsed = parseConfigFromSearch('?foodSpawnRate=0.35&drag=0.97', DEFAULT_CONFIG);
        expect(parsed.foodSpawnRate).toBeCloseTo(0.35);
        expect(parsed.drag).toBeCloseTo(0.97);
    });
});

// ============================================================================
// buildSearchFromConfigDiff
// ============================================================================

describe('buildSearchFromConfigDiff', () => {
    it('серіалізує лише значення, що відрізняються від defaults', () => {
        const changed: SimulationConfig = { ...DEFAULT_CONFIG, maxFood: 300, showGrid: true };
        const search = buildSearchFromConfigDiff(changed, DEFAULT_CONFIG);
        const params = new URLSearchParams(search);

        expect(params.get('maxFood')).toBe('300');
        expect(params.get('showGrid')).toBe('true');
        expect(params.has('foodSpawnRate')).toBe(false);
    });

    it('повертає порожній рядок якщо config ідентичний defaults', () => {
        const search = buildSearchFromConfigDiff(DEFAULT_CONFIG, DEFAULT_CONFIG);
        expect(search).toBe('');
    });

    it('серіалізує кілька змінених полів одночасно', () => {
        const changed: SimulationConfig = {
            ...DEFAULT_CONFIG,
            maxFood: 500,
            maxOrganisms: 100,
            graphicsQuality: 'LOW',
        };
        const search = buildSearchFromConfigDiff(changed, DEFAULT_CONFIG);
        const params = new URLSearchParams(search);

        expect(params.get('maxFood')).toBe('500');
        expect(params.get('maxOrganisms')).toBe('100');
        expect(params.get('graphicsQuality')).toBe('LOW');
    });
});

// ============================================================================
// updateUrlFromConfig
// ============================================================================

describe('updateUrlFromConfig', () => {
    beforeEach(() => {
        // Скидаємо URL перед кожним тестом — jsdom зберігає стан між тестами
        window.history.replaceState(null, '', '/');
    });

    it('викликає replaceState та pushState відповідно до mode', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        const pushSpy = vi.spyOn(window.history, 'pushState');

        updateUrlFromConfig({ ...DEFAULT_CONFIG, maxFood: 500 }, DEFAULT_CONFIG, 'replace');
        updateUrlFromConfig({ ...DEFAULT_CONFIG, maxFood: 600 }, DEFAULT_CONFIG, 'push');

        expect(replaceSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledTimes(1);

        replaceSpy.mockRestore();
        pushSpy.mockRestore();
    });

    it('не змінює URL якщо config ідентичний defaults', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        const pushSpy = vi.spyOn(window.history, 'pushState');

        updateUrlFromConfig(DEFAULT_CONFIG, DEFAULT_CONFIG, 'replace');
        updateUrlFromConfig(DEFAULT_CONFIG, DEFAULT_CONFIG, 'push');

        expect(replaceSpy).not.toHaveBeenCalled();
        expect(pushSpy).not.toHaveBeenCalled();

        replaceSpy.mockRestore();
        pushSpy.mockRestore();
    });

    it('формує коректний URL з query-параметрами для змінених полів', () => {
        const pushSpy = vi.spyOn(window.history, 'pushState');

        updateUrlFromConfig({ ...DEFAULT_CONFIG, maxFood: 400 }, DEFAULT_CONFIG, 'push');

        const calledUrl = pushSpy.mock.calls[0]?.[2] as string;
        expect(calledUrl).toContain('maxFood=400');

        pushSpy.mockRestore();
    });

    it('формує чистий URL (без ?) якщо config ідентичний defaults після зміни', () => {
        // Спочатку встановлюємо параметри в URL
        window.history.replaceState(null, '', '/?maxFood=400');

        const replaceSpy = vi.spyOn(window.history, 'replaceState');

        // Повертаємось до defaults — URL повинен очиститись
        updateUrlFromConfig(DEFAULT_CONFIG, DEFAULT_CONFIG, 'replace');

        // URL ідентичний поточному (pathname без params) — history не викликається
        expect(replaceSpy).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('maxFood'));
        replaceSpy.mockRestore();
        window.history.replaceState(null, '', '/');
    });
});
