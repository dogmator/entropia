export interface SnapshotDispatchDecisionParams {
  updated: boolean;
  now: number;
  lastSnapshotTime: number;
  minIntervalMs: number;
}

export const DEFAULT_RENDER_SNAPSHOT_FPS = 30;
const MILLISECONDS_PER_SECOND = 1000;
export const DEFAULT_RENDER_SNAPSHOT_INTERVAL_MS = MILLISECONDS_PER_SECOND / DEFAULT_RENDER_SNAPSHOT_FPS;

export const shouldDispatchRenderSnapshot = ({
  updated,
  now,
  lastSnapshotTime,
  minIntervalMs,
}: SnapshotDispatchDecisionParams): boolean => {
  if (!updated) {
    return false;
  }

  return now - lastSnapshotTime >= minIntervalMs;
};
