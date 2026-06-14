import { useCallback, useRef } from 'react';

import { calculateNextFpsState, createInitialFpsState } from '../fps';
import { MS_PER_SECOND } from '../simulation.constants';

export const useFpsCalculator = (): { updateFps: () => number } => {
    const fpsRef = useRef(createInitialFpsState(0));

    const updateFps = useCallback(() => {
        const now = performance.now();

        if (fpsRef.current.lastUpdate === 0) {
            fpsRef.current = createInitialFpsState(now);
            return fpsRef.current.current;
        }

        fpsRef.current = calculateNextFpsState(fpsRef.current, now, MS_PER_SECOND);
        return fpsRef.current.current;
    }, []);

    return { updateFps };
};
