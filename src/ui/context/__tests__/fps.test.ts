import { describe, expect, it } from 'vitest';

import { calculateNextFpsState, createInitialFpsState } from '../fps';

const ONE_SECOND_MS = 1000;
const INITIAL_TS = 100;
const ELAPSED_BEFORE_SECOND = 400;

describe('fps helpers', () => {
    it('створює початковий стан FPS з нульовими значеннями', () => {
        expect(createInitialFpsState(INITIAL_TS)).toEqual({
            frames: 0,
            lastUpdate: INITIAL_TS,
            current: 0,
        });
    });

    it('інкрементує frames коли не пройшла 1 секунда', () => {
        const next = calculateNextFpsState(
            { frames: 2, lastUpdate: 100, current: 55 },
            ELAPSED_BEFORE_SECOND,
            ONE_SECOND_MS
        );

        expect(next).toEqual({
            frames: 3,
            lastUpdate: INITIAL_TS,
            current: 55,
        });
    });

    it('перераховує FPS коли пройшла 1 секунда або більше', () => {
        const next = calculateNextFpsState(
            { frames: 59, lastUpdate: 0, current: 0 },
            ONE_SECOND_MS,
            ONE_SECOND_MS
        );

        expect(next).toEqual({
            frames: 0,
            lastUpdate: ONE_SECOND_MS,
            current: 60,
        });
    });
});
