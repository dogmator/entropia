export interface FpsState {
    frames: number;
    lastUpdate: number;
    current: number;
}

export const createInitialFpsState = (initialTimestamp: number): FpsState => ({
    frames: 0,
    lastUpdate: initialTimestamp,
    current: 0,
});

export const calculateNextFpsState = (
    previous: FpsState,
    now: number,
    msPerSecond: number
): FpsState => {
    const frames = previous.frames + 1;
    const elapsed = now - previous.lastUpdate;

    if (elapsed < msPerSecond) {
        return {
            ...previous,
            frames,
        };
    }

    return {
        frames: 0,
        lastUpdate: now,
        current: Math.round((frames * msPerSecond) / elapsed),
    };
};
