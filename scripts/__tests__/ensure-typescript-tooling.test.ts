import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { DOCUMENTED_EXCEPTIONS, findForbiddenFiles, isForbiddenTooling } from '../ensure-typescript-tooling';

const DEPENDENCY_CRUISER_CONFIG = '.dependency-cruiser.mjs';
const POSTCSS_JS_CONFIG = 'postcss.config.mjs';
const POSTCSS_TS_CONFIG = 'postcss.config.ts';
const WEBPACK_JS_CONFIG = 'webpack.config.mjs';
const SOURCE_JS_FILE = 'src/app.js';

const tempRoots: string[] = [];

const createRepo = (files: string[]): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entropia-tooling-test-'));
  tempRoots.push(root);
  for (const file of files) {
    const absolutePath = path.join(root, file);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, '');
  }
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0, tempRoots.length)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('ensure-typescript-tooling', () => {
  it('flags JavaScript tooling configs that have no documented exception', () => {
    expect(isForbiddenTooling(WEBPACK_JS_CONFIG)).toBe(true);
    expect(isForbiddenTooling('webpack.config.cjs')).toBe(true);
    expect(isForbiddenTooling(SOURCE_JS_FILE)).toBe(true);
    expect(isForbiddenTooling('scripts/loader.mts')).toBe(true);
  });

  it('accepts TypeScript tooling configs and documented JavaScript exceptions', () => {
    expect(isForbiddenTooling(POSTCSS_TS_CONFIG)).toBe(false);
    expect(isForbiddenTooling('vite.config.ts')).toBe(false);
    expect(isForbiddenTooling(POSTCSS_JS_CONFIG)).toBe(false);
    expect(isForbiddenTooling(DEPENDENCY_CRUISER_CONFIG)).toBe(false);
  });

  it('documents a reason for every exception', () => {
    for (const [file, reason] of DOCUMENTED_EXCEPTIONS) {
      expect(reason.length, file).toBeGreaterThan(0);
    }
  });

  it('applies exceptions only to the exact root file', () => {
    expect(isForbiddenTooling(`nested/${DEPENDENCY_CRUISER_CONFIG}`)).toBe(true);
  });

  it('reports violations found by walking the tree and skips ignored directories', () => {
    const root = createRepo([
      WEBPACK_JS_CONFIG,
      DEPENDENCY_CRUISER_CONFIG,
      POSTCSS_JS_CONFIG,
      POSTCSS_TS_CONFIG,
      SOURCE_JS_FILE,
      'coverage/prettify.js',
      'node_modules/pkg/index.js',
    ]);

    const violations = findForbiddenFiles(root, root).sort((a, b) => a.localeCompare(b));
    expect(violations).toEqual([path.join('src', 'app.js'), WEBPACK_JS_CONFIG]);
  });
});
