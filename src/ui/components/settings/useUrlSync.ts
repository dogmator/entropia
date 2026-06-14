import { useEffect, useRef } from 'react';

import type { SimulationConfig } from '@/types';

import { parseConfigFromSearch, type UrlHistoryMode } from './urlConfigSync';
import { isGraphicsQuality } from './useSettingsState.utils';

export const useUrlSync = (
    defaultConfigRef: React.RefObject<SimulationConfig>,
    applyConfig: (nextConfig: SimulationConfig, mode: UrlHistoryMode, isUrlEvent: boolean) => void,
    urlSyncTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>
): void => {
    const isUrlDrivenUpdateRef = useRef(false);

    useEffect(() => {
        const onPopState = () => {
            const parsed = parseConfigFromSearch(window.location.search, defaultConfigRef.current, {
                graphicsQuality: (v, f) => (isGraphicsQuality(v) ? v : f),
            });
            isUrlDrivenUpdateRef.current = true;
            applyConfig(parsed, 'replace', true);
            isUrlDrivenUpdateRef.current = false;
        };
        window.addEventListener('popstate', onPopState);
        const timerToClear = urlSyncTimerRef.current;
        return () => {
            window.removeEventListener('popstate', onPopState);
            if (timerToClear) { clearTimeout(timerToClear); }
        };
    }, [applyConfig, defaultConfigRef, urlSyncTimerRef]);
};
