import { logger } from '@/core';
import type { SimulationConfig } from '@/types';

const CONFIG_BATCH_DEBOUNCE_MS = 32;

/**
 * Service for batching simulation configuration updates.
 * Prevents flooding the worker with multiple setConfig commands in a short period.
 */
export class ConfigBatcher {
    private pendingConfigPatch: Partial<SimulationConfig> = {};
    private configBatchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly getWorker: () => Worker | null) {}

    /**
     * Updates the pending configuration patch and starts/resets the debounce timer.
     * @param newConfig Patch to apply
     * @param localConfig Optional local config object to update immediately for UI responsiveness
     */
    public updateConfig(newConfig: Partial<SimulationConfig>, localConfig?: SimulationConfig): void {
        if (localConfig) {
            Object.assign(localConfig, newConfig);
        }

        this.pendingConfigPatch = {
            ...this.pendingConfigPatch,
            ...newConfig,
        };

        if (this.configBatchTimer !== null) {
            clearTimeout(this.configBatchTimer);
        }

        this.configBatchTimer = setTimeout(() => {
            this.flush();
        }, CONFIG_BATCH_DEBOUNCE_MS);
    }

    /**
     * Immediately sends any pending configuration updates to the worker.
     */
    public flush(): void {
        const worker = this.getWorker();
        
        if (this.configBatchTimer !== null) {
            clearTimeout(this.configBatchTimer);
            this.configBatchTimer = null;
        }

        if (Object.keys(this.pendingConfigPatch).length === 0) {
            return;
        }

        const patch = this.pendingConfigPatch;
        this.pendingConfigPatch = {};

        if (worker) {
            worker.postMessage({ type: 'setConfig', config: patch });
            logger.info('Proxy: Sent batched setConfig command', 'ConfigBatcher', { config: patch });
        }
    }

    /**
     * Clears any pending updates and timers.
     */
    public dispose(): void {
        if (this.configBatchTimer !== null) {
            clearTimeout(this.configBatchTimer);
            this.configBatchTimer = null;
        }
        this.pendingConfigPatch = {};
    }
}
