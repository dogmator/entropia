import fs from 'fs';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

const DEFAULT_MAX_MB = 5;
const DEFAULT_TRIM_MB = 4;

export const DEFAULT_MAX_LOG_FILE_BYTES = DEFAULT_MAX_MB * BYTES_PER_MB; // 5 MB
export const DEFAULT_TRIM_TO_BYTES = DEFAULT_TRIM_MB * BYTES_PER_MB; // keep latest 4 MB

interface LogSizeOptions {
  maxBytes?: number;
  trimToBytes?: number;
}

export const enforceLogFileSizeLimit = (
  logFilePath: string,
  options: LogSizeOptions = {}
): void => {
  const { 
    maxBytes = DEFAULT_MAX_LOG_FILE_BYTES, 
    trimToBytes = DEFAULT_TRIM_TO_BYTES 
  } = options;

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
  options: LogSizeOptions = {}
): void => {
  enforceLogFileSizeLimit(logFilePath, options);
  fs.appendFileSync(logFilePath, entry);
};

