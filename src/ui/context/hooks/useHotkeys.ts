import { useEffect } from 'react';

import { SPEED_KEYS } from '../simulation.constants';

export const useHotkeys = (setSpeed: (val: number | ((prev: number) => number)) => void): void => {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Space') {
                setSpeed(prev => prev === SPEED_KEYS.PAUSE ? SPEED_KEYS.NORMAL : SPEED_KEYS.PAUSE);
            } else if (e.key === '0') {
                setSpeed(SPEED_KEYS.PAUSE);
            } else if (e.key === '1') {
                setSpeed(SPEED_KEYS.NORMAL);
            } else if (e.key === '2') {
                setSpeed(SPEED_KEYS.FAST);
            } else if (e.key === '5') {
                setSpeed(SPEED_KEYS.TURBO);
            }

            if (['f', 'F'].includes(e.key)) {
                if (!document.fullscreenElement) {
                    void document.documentElement.requestFullscreen();
                } else {
                    void document.exitFullscreen();
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => { window.removeEventListener('keydown', handleKey); };
    }, [setSpeed]);
};
