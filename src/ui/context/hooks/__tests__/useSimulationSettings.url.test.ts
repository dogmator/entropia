/* eslint-disable @typescript-eslint/no-magic-numbers */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CAMERA, UI_CONTROLS } from '@/config';

import { readUIFromUrl, syncUIToUrl, UI_DEFAULTS } from '../simulationUrlState';

const CAM_KEYS = ['camX', 'camY', 'camZ', 'camTX', 'camTY', 'camTZ'];

describe('readUIFromUrl', () => {
    it('повертає всі defaults для порожнього search', () => {
        expect(readUIFromUrl('')).toEqual(UI_DEFAULTS);
        expect(readUIFromUrl('?')).toEqual(UI_DEFAULTS);
    });

    it('парсить всі 4 UI параметри з URL', () => {
        const result = readUIFromUrl('?speed=2&worldScale=3&autoRotate=false&autoRotateSpeed=5');
        expect(result.speed).toBe(2);
        expect(result.worldScale).toBe(3);
        expect(result.autoRotate).toBe(false);
        expect(result.autoRotateSpeed).toBe(5);
    });
});

describe('readUIFromUrl — clamping and fallbacks', () => {
    it('клампить speed в межах MIN–MAX', () => {
        expect(readUIFromUrl('?speed=-1').speed).toBe(UI_CONTROLS.SPEED.MIN);
        expect(readUIFromUrl('?speed=999').speed).toBe(UI_CONTROLS.SPEED.MAX);
        expect(readUIFromUrl('?speed=2.5').speed).toBeCloseTo(2.5);
    });

    it('клампить worldScale в межах MIN–MAX', () => {
        expect(readUIFromUrl('?worldScale=0').worldScale).toBe(UI_CONTROLS.WORLD_SCALE.MIN);
        expect(readUIFromUrl('?worldScale=100').worldScale).toBe(UI_CONTROLS.WORLD_SCALE.MAX);
    });

    it('клампить autoRotateSpeed в межах SPEED_MIN–SPEED_MAX', () => {
        expect(readUIFromUrl('?autoRotateSpeed=0').autoRotateSpeed).toBe(CAMERA.AUTO_ROTATE.SPEED_MIN);
        expect(readUIFromUrl('?autoRotateSpeed=999').autoRotateSpeed).toBe(CAMERA.AUTO_ROTATE.SPEED_MAX);
    });

    it('парсить autoRotate: true/false та 1/0', () => {
        expect(readUIFromUrl('?autoRotate=true').autoRotate).toBe(true);
        expect(readUIFromUrl('?autoRotate=1').autoRotate).toBe(true);
        expect(readUIFromUrl('?autoRotate=false').autoRotate).toBe(false);
        expect(readUIFromUrl('?autoRotate=0').autoRotate).toBe(false);
    });

    it('невалідне значення autoRotate повертає default', () => {
        expect(readUIFromUrl('?autoRotate=maybe').autoRotate).toBe(UI_DEFAULTS.autoRotate);
    });

    it('невалідні числа (NaN, Infinity) повертають defaults', () => {
        expect(readUIFromUrl('?speed=abc').speed).toBe(UI_DEFAULTS.speed);
        expect(readUIFromUrl('?worldScale=NaN').worldScale).toBe(UI_DEFAULTS.worldScale);
        expect(readUIFromUrl('?autoRotateSpeed=Infinity').autoRotateSpeed).toBe(UI_DEFAULTS.autoRotateSpeed);
    });

    it('ігнорує невідомі ключі', () => {
        const result = readUIFromUrl('?speed=2&unknownKey=boom');
        expect(result.speed).toBe(2);
        expect((result as unknown as Record<string, unknown>)['unknownKey']).toBeUndefined();
    });

    it('відсутні ключі отримують defaults', () => {
        const result = readUIFromUrl('?speed=3');
        expect(result.speed).toBe(3);
        expect(result.worldScale).toBe(UI_DEFAULTS.worldScale);
        expect(result.autoRotate).toBe(UI_DEFAULTS.autoRotate);
        expect(result.autoRotateSpeed).toBe(UI_DEFAULTS.autoRotateSpeed);
    });
});

describe('readUIFromUrl — camera snapshot', () => {
    it('парсить повний cameraSnapshot з усіх 6 params', () => {
        const result = readUIFromUrl('?camX=1200&camY=800&camZ=1200&camTX=400&camTY=400&camTZ=400');
        expect(result.cameraSnapshot).toEqual({ px: 1200, py: 800, pz: 1200, tx: 400, ty: 400, tz: 400 });
    });

    it('cameraSnapshot = null якщо хоча б один з 6 params відсутній', () => {
        expect(readUIFromUrl('?camX=100&camY=200&camZ=300&camTX=0&camTY=0').cameraSnapshot).toBeNull();
        expect(readUIFromUrl('?camX=100').cameraSnapshot).toBeNull();
        expect(readUIFromUrl('').cameraSnapshot).toBeNull();
    });

    it('cameraSnapshot = null якщо будь-який з 6 params — NaN', () => {
        expect(readUIFromUrl('?camX=NaN&camY=200&camZ=300&camTX=0&camTY=0&camTZ=0').cameraSnapshot).toBeNull();
    });

    it('cameraSnapshot supports negative coords', () => {
        const result = readUIFromUrl('?camX=-500&camY=0&camZ=-500&camTX=-100&camTY=-100&camTZ=-100');
        expect(result.cameraSnapshot).toEqual({ px: -500, py: 0, pz: -500, tx: -100, ty: -100, tz: -100 });
    });
});

describe('syncUIToUrl', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('записує в URL лише відхилення від defaults', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        syncUIToUrl({ ...UI_DEFAULTS, speed: 3 });
        const calledUrl = replaceSpy.mock.calls[0]?.[2] as string;
        expect(calledUrl).toContain('speed=3');
        expect(calledUrl).not.toContain('worldScale');
        expect(calledUrl).not.toContain('autoRotate=');
        replaceSpy.mockRestore();
    });

    it('видаляє параметр з URL при поверненні до default', () => {
        window.history.replaceState(null, '', '/?speed=3');
        syncUIToUrl(UI_DEFAULTS);
        expect(window.location.search).not.toContain('speed');
    });

    it('не викликає replaceState якщо URL не змінився', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        syncUIToUrl(UI_DEFAULTS);
        expect(replaceSpy).not.toHaveBeenCalled();
        replaceSpy.mockRestore();
    });

    it('мержить з існуючими SimulationConfig params у URL', () => {
        window.history.replaceState(null, '', '/?maxFood=100&graphicsQuality=LOW');
        syncUIToUrl({ ...UI_DEFAULTS, speed: 2 });
        const params = new URLSearchParams(window.location.search);
        expect(params.get('maxFood')).toBe('100');
        expect(params.get('graphicsQuality')).toBe('LOW');
        expect(params.get('speed')).toBe('2');
    });
});

describe('syncUIToUrl — complete UI and camera state', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('записує всі 4 параметри при повному відхиленні від defaults', () => {
        syncUIToUrl({ speed: 3, worldScale: 2, autoRotate: false, autoRotateSpeed: 10, cameraSnapshot: null });
        const params = new URLSearchParams(window.location.search);
        expect(params.get('speed')).toBe('3');
        expect(params.get('worldScale')).toBe('2');
        expect(params.get('autoRotate')).toBe('false');
        expect(params.get('autoRotateSpeed')).toBe('10');
    });

    it('записує 6 cam params при наявності cameraSnapshot', () => {
        const snapshot = { px: 1200.7, py: 800.3, pz: 1200.1, tx: 400, ty: 400, tz: 400 };
        syncUIToUrl({ ...UI_DEFAULTS, cameraSnapshot: snapshot });
        const params = new URLSearchParams(window.location.search);
        expect(params.get('camX')).toBe('1201');
        expect(params.get('camY')).toBe('800');
        expect(params.get('camZ')).toBe('1200');
        expect(params.get('camTX')).toBe('400');
        expect(params.get('camTY')).toBe('400');
        expect(params.get('camTZ')).toBe('400');
    });

    it('видаляє cam params при cameraSnapshot = null', () => {
        window.history.replaceState(null, '', '/?camX=100&camY=200&camZ=300&camTX=0&camTY=0&camTZ=0');
        syncUIToUrl(UI_DEFAULTS);
        const params = new URLSearchParams(window.location.search);
        CAM_KEYS.forEach((key) => {
            expect(params.get(key)).toBeNull();
        });
    });
});

describe('readUIFromUrl — fallback до defaults при відсутності параметрів', () => {
    it('повертає всі defaults при порожньому URL', () => {
        const result = readUIFromUrl('');
        expect(result.speed).toBe(UI_DEFAULTS.speed);
        expect(result.worldScale).toBe(UI_DEFAULTS.worldScale);
        expect(result.autoRotate).toBe(UI_DEFAULTS.autoRotate);
        expect(result.autoRotateSpeed).toBe(UI_DEFAULTS.autoRotateSpeed);
    });

    it('часткові параметри: відсутні ключі отримують defaults', () => {
        const result = readUIFromUrl('?speed=3');
        expect(result.speed).toBe(3);
        expect(result.worldScale).toBe(UI_DEFAULTS.worldScale);
        expect(result.autoRotate).toBe(UI_DEFAULTS.autoRotate);
    });
});

describe('camera state round trip through the URL', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('restores the camera snapshot written to the URL, rounded to whole units', () => {
        syncUIToUrl({ ...UI_DEFAULTS, cameraSnapshot: { px: 12.4, py: -30.6, pz: 500, tx: 0, ty: 1, tz: -2 } });

        expect(readUIFromUrl(window.location.search).cameraSnapshot).toEqual({ px: 12, py: -31, pz: 500, tx: 0, ty: 1, tz: -2 });
    });

    it('keeps speed and camera together across a simulated reload', () => {
        syncUIToUrl({ ...UI_DEFAULTS, speed: 2, cameraSnapshot: { px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 6 } });

        const restored = readUIFromUrl(window.location.search);
        expect(restored.speed).toBe(2);
        expect(restored.cameraSnapshot).toEqual({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 6 });
    });
});
