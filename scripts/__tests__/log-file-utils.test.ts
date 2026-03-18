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

    appendLogEntryWithLimit(filePath, 'def', 100, 80);

    expect(fs.readFileSync(filePath, 'utf8')).toBe('abcdef');
  });

  it('trims old data and keeps file under limit', () => {
    const filePath = createTempLogFile('0123456789'.repeat(20)); // 200 bytes

    appendLogEntryWithLimit(filePath, 'XYZ', 120, 60);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(Buffer.byteLength(content)).toBeLessThanOrEqual(123); // 120 + 3 bytes append
    expect(content.endsWith('XYZ')).toBe(true);
    expect(content.includes('0123456789')).toBe(true);
  });
});

