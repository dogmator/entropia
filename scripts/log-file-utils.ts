import fs from 'fs';

export const DEFAULT_MAX_LOG_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_TRIM_TO_BYTES = 4 * 1024 * 1024; // keep latest 4 MB

export const enforceLogFileSizeLimit = (
  logFilePath: string,
  maxBytes: number = DEFAULT_MAX_LOG_FILE_BYTES,
  trimToBytes: number = DEFAULT_TRIM_TO_BYTES
): void => {
  if (!fs.existsSync(logFilePath)) {
    return;
  }

  const size = fs.statSync(logFilePath).size;
  if (size <= maxBytes) {
    return;
  }

  const keepBytes = Math.max(0, Math.min(trimToBytes, maxBytes));
  if (keepBytes === 0) {
    fs.writeFileSync(logFilePath, '');
    return;
  }

  const startOffset = Math.max(0, size - keepBytes);
  const bytesToRead = Math.min(keepBytes, size);
  const buffer = Buffer.allocUnsafe(bytesToRead);

  const fileDescriptor = fs.openSync(logFilePath, 'r');
  try {
    fs.readSync(fileDescriptor, buffer, 0, bytesToRead, startOffset);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  fs.writeFileSync(logFilePath, buffer);
};

export const appendLogEntryWithLimit = (
  logFilePath: string,
  entry: string,
  maxBytes: number = DEFAULT_MAX_LOG_FILE_BYTES,
  trimToBytes: number = DEFAULT_TRIM_TO_BYTES
): void => {
  enforceLogFileSizeLimit(logFilePath, maxBytes, trimToBytes);
  fs.appendFileSync(logFilePath, entry);
};

