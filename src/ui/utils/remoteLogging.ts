const REMOTE_LOGGING_KEY = 'entropia:remoteLogging';

type StorageLike = Pick<Storage, 'getItem'>;

/**
 * Dev: remote logging enabled by default (manual step not required).
 * Optional override:
 * - '0' => force disable
 * - '1' => force enable
 *
 * Production: enable only via explicit opt-in ('1').
 */
export const resolveRemoteLoggingEnabled = (
  storage: StorageLike,
  isDevelopment: boolean,
): boolean => {
  const value = storage.getItem(REMOTE_LOGGING_KEY);

  if (isDevelopment) {
    return value !== '0';
  }

  return value === '1';
};

