import { calculateNextFpsState, createInitialFpsState, type FpsState } from './fps';
import { MS_PER_SECOND } from './simulation.constants';

/** What the canvas measured: how often it drew, how long a frame took, and how many draw calls one frame made. */
export interface RenderMetrics {
    readonly fps: number;
    readonly frameTime: number;
    readonly drawCalls: number;
}

export interface RenderMetricsRecorder {
    /** Called once for every frame the canvas renders. */
    readonly recordFrame: (now: number, drawCalls: number) => void;
    readonly snapshot: () => RenderMetrics;
}

/**
 * Measures the canvas itself. Frames come from the render loop, not from simulation updates, so the numbers stay right
 * while the simulation is paused and the canvas keeps drawing.
 */
export const createRenderMetrics = (): RenderMetricsRecorder => {
    let frameWindow: FpsState | null = null;
    let fps = 0;
    let frameTime = 0;
    let drawCalls = 0;

    return {
        recordFrame: (now, calls) => {
            // The first frame starts the window, so that the time before the canvas drew does not count as a slow frame.
            if (frameWindow === null) {
                frameWindow = createInitialFpsState(now);
            } else {
                const next = calculateNextFpsState(frameWindow, now, MS_PER_SECOND);
                if (next.lastUpdate !== frameWindow.lastUpdate) {
                    // The window has closed. Its frames, this one included, shared the whole of its duration.
                    frameTime = (now - frameWindow.lastUpdate) / (frameWindow.frames + 1);
                }
                fps = next.current;
                frameWindow = next;
            }
            drawCalls = calls;
        },
        snapshot: () => ({ fps, frameTime, drawCalls }),
    };
};
