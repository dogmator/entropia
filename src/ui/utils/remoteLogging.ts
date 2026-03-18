const REMOTE_LOGGING_KEY = 'entropia:remoteLogging';

type StorageLike = Pick<Storage, 'getItem'>;

/**
 * Dev: remote logging увімкнено за замовчуванням (manual step не потрібен).
 * Optional override:
 * - '0' => force disable
 * - '1' => force enable
 *
 * Production: увімкнення лише через explicit opt-in ('1').
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

