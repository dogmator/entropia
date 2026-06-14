import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { appendLogEntryWithLimit } from '../log-file-utils';

const testDirs: string[] = [];

const createTempLogFile = (content: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entropia-log-test-'));
  testDirs.push(dir);
  const filePath = path.join(dir, 'remote_debug.log');
  fs.writeFileSync(filePath, content);
  return filePath;
};

afterEach(() => {
  for (const dir of testDirs.splice(0, testDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('log-file-utils', () => {
  it('appends entry without trimming when file is below limit', () => {
    const filePath = createTempLogFile('abc');
    const LIMIT_100 = 100;
    const TRIM_80 = 80;

    appendLogEntryWithLimit(filePath, 'def', { maxBytes: LIMIT_100, trimToBytes: TRIM_80 });

    expect(fs.readFileSync(filePath, 'utf8')).toBe('abcdef');
  });

  it('trims old data and keeps file under limit', () => {
    const REPEAT_COUNT = 20;
    const LIMIT_120 = 120;
    const TRIM_60 = 60;
    const EXPECTED_MAX_BYTES = 123;
    const filePath = createTempLogFile('0123456789'.repeat(REPEAT_COUNT)); // 200 bytes

    appendLogEntryWithLimit(filePath, 'XYZ', { maxBytes: LIMIT_120, trimToBytes: TRIM_60 });

    const content = fs.readFileSync(filePath, 'utf8');
    expect(Buffer.byteLength(content)).toBeLessThanOrEqual(EXPECTED_MAX_BYTES); // 120 + 3 bytes append
    expect(content.endsWith('XYZ')).toBe(true);
    expect(content.includes('0123456789')).toBe(true);
  });
});

