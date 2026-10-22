/* eslint-disable max-lines-per-function */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GRAPHICS_PRESETS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';
import type { SimulationConfig } from '@/types';

import { type InitialConfigSource, type SettingsState, useSettingsState } from '../useSettingsState';

// The configuration of a fresh world. A URL parameter that is absent stands for these values.
const DEFAULTS = { ...GRAPHICS_PRESETS.LOW, maxFood: 400, maxOrganisms: 200, showTrails: true, graphicsQuality: 'LOW' } as unknown as SimulationConfig;
const URL_MAX_FOOD = 500;
const TYPED_MAX_FOOD = 600;
const RESTORED_MAX_FOOD = 700;
const RESTORED_MAX_ORGANISMS = 300;
// Longer than the debounce of the URL write, so that a pending write has run.
const DEBOUNCE_SETTLE_MS = 250;

// A world that takes configuration the way the worker does: a patch changes only the settings it names.
const createWorld = (initial: SimulationConfig): { world: SimulationConfig; engine: ISimulationEngine } => {
    const world: SimulationConfig = { ...initial };
    const engine = {
        get config(): SimulationConfig { return world; },
        updateConfig: vi.fn((patch: Partial<SimulationConfig>) => { Object.assign(world, patch); }),
    };
    return { world, engine: engine as unknown as ISimulationEngine };
};

let panel: SettingsState | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const Probe = ({ engine, source }: { engine: ISimulationEngine; source: InitialConfigSource }): null => {
    const settings = useSettingsState(engine, source);
    useEffect(() => { panel = settings; });
    return null;
};

const mountPanel = (engine: ISimulationEngine, source: InitialConfigSource): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const mounted = createRoot(container);
    root = mounted;
    act(() => { mounted.render(<Probe engine={engine} source={source} />); });
};

const unmountPanel = (): void => {
    act(() => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    panel = null;
};

const settingsPanel = (): SettingsState => {
    if (!panel) throw new Error('the settings panel is not mounted');
    return panel;
};

const wait = async (ms: number): Promise<void> => {
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, ms); }); });
};

// Goes back or forward in the history, and returns once the page has handled the popstate event.
const traverse = async (direction: 'back' | 'forward'): Promise<void> => {
    await act(async () => {
        const popped = new Promise<void>((resolve) => { window.addEventListener('popstate', () => { resolve(); }, { once: true }); });
        window.history[direction]();
        await popped;
    });
};

const searchParam = (key: string): string | null => new URLSearchParams(window.location.search).get(key);

// Each test starts on a page of its own, at the end of the history, so that its Back and Forward reach its own pages.
beforeEach(() => {
    window.history.pushState(null, '', '/');
});

afterEach(() => {
    unmountPanel();
    vi.restoreAllMocks();
});

// Changes the maxFood slider and a toggle on this page, then restores a checkpoint whose world is not what the URL says.
const editThenRestore = async (): Promise<{ world: SimulationConfig; engine: ISimulationEngine }> => {
    const { world, engine } = createWorld(DEFAULTS);
    mountPanel(engine, 'url');
    act(() => { settingsPanel().update('maxFood', URL_MAX_FOOD); });
    await wait(DEBOUNCE_SETTLE_MS);
    act(() => { settingsPanel().toggle('showTrails'); });
    unmountPanel();
    Object.assign(world, { maxFood: RESTORED_MAX_FOOD, maxOrganisms: RESTORED_MAX_ORGANISMS });
    mountPanel(engine, 'engine');
    return { world, engine };
};

describe('settings and browser history', () => {
    it('Back after a restore keeps the restored settings that the navigation does not touch', async () => {
        const { world } = await editThenRestore();

        await traverse('back');

        expect(world).toMatchObject({ maxFood: RESTORED_MAX_FOOD, maxOrganisms: RESTORED_MAX_ORGANISMS, showTrails: DEFAULTS.showTrails });
        expect(settingsPanel().config).toMatchObject({ maxFood: RESTORED_MAX_FOOD, maxOrganisms: RESTORED_MAX_ORGANISMS });
    });

    it('Forward after that Back applies the change it returns to, and keeps the restored settings', async () => {
        const { world } = await editThenRestore();

        await traverse('back');
        await traverse('forward');

        expect(world).toMatchObject({ maxFood: RESTORED_MAX_FOOD, maxOrganisms: RESTORED_MAX_ORGANISMS, showTrails: false });
        expect(settingsPanel().config).toMatchObject({ maxFood: RESTORED_MAX_FOOD, showTrails: false });
    });

    it('a parameter that navigation removes returns its setting to the default, even when the removed value equals the default', async () => {
        window.history.pushState(null, '', `/?maxFood=${String(DEFAULTS.maxFood)}`);
        const { world, engine } = createWorld(DEFAULTS);
        mountPanel(engine, 'url');
        unmountPanel();
        Object.assign(world, { maxFood: RESTORED_MAX_FOOD });
        mountPanel(engine, 'engine');

        await traverse('back');

        expect(world.maxFood).toBe(DEFAULTS.maxFood);
    });

    it('a URL write still waiting for its debounce is dropped when the user navigates, so the page they go to is not rewritten', async () => {
        window.history.pushState(null, '', '/?showTrails=false');
        const { world, engine } = createWorld(DEFAULTS);
        mountPanel(engine, 'url');
        act(() => { settingsPanel().update('maxFood', TYPED_MAX_FOOD); });

        await traverse('back');
        await wait(DEBOUNCE_SETTLE_MS);

        expect(window.location.search).toBe('');
        expect(world.maxFood).toBe(TYPED_MAX_FOOD);
        expect(world.showTrails).toBe(DEFAULTS.showTrails);
    });

    it('Back after a preset reverts the preset settings and keeps a restored setting that the preset does not touch', async () => {
        const { world, engine } = createWorld(DEFAULTS);
        mountPanel(engine, 'url');
        act(() => { settingsPanel().applyPreset('HIGH'); });
        unmountPanel();
        Object.assign(world, { maxFood: RESTORED_MAX_FOOD });
        mountPanel(engine, 'engine');

        await traverse('back');

        expect(world.maxFood).toBe(RESTORED_MAX_FOOD);
        for (const key of Object.keys(GRAPHICS_PRESETS.HIGH) as (keyof SimulationConfig)[]) {
            expect(world[key]).toBe(DEFAULTS[key]);
        }
    });

    it('a slider replaces the current page after its debounce, and a toggle adds a page', async () => {
        const { engine } = createWorld(DEFAULTS);
        mountPanel(engine, 'url');
        const pagesBefore = window.history.length;

        act(() => { settingsPanel().update('maxFood', URL_MAX_FOOD); });
        await wait(DEBOUNCE_SETTLE_MS);
        expect(searchParam('maxFood')).toBe(String(URL_MAX_FOOD));
        expect(window.history.length).toBe(pagesBefore);

        act(() => { settingsPanel().toggle('showTrails'); });
        expect(searchParam('showTrails')).toBe('false');
        expect(window.history.length).toBe(pagesBefore + 1);
    });
});
