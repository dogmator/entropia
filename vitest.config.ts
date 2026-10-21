import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

// The simulation tests run hundreds of ticks each. Coverage instrumentation makes them several times slower, so the
// default 5 s per-test budget is too small. Only the time budget changes; no assertion is affected.
const TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: TEST_TIMEOUT_MS,
    setupFiles: [],
    exclude: [...configDefaults.exclude, 'tests/**'],
    coverage: {
      // Istanbul instruments the source and counts statements, functions and branches on AST nodes, so its numbers
      // are stable across Vitest versions and can be checked against the source. The V8 provider reconstructs the
      // same counts from runtime ranges; its counts changed between Vitest 2 and Vitest 5 without any source change.
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'src/main.tsx',
      ],
      // Recalibrated for the Istanbul baseline on Vitest 5. Measured range over repeated runs on the same tests and
      // sources: lines 52.28-52.76, statements 50.90-51.37, functions 46.07-46.37, branches 39.10-39.91. The spread comes
      // from a timing-dependent path in PerformanceMonitor. The previous values (44 / 44 / 54 / 74) were set against the
      // V8 counts of Vitest 2 (54.85 / 54.85 / 64.65 / 82.86). Measured from the lowest baseline in the range, each new
      // value sits 11.3 (lines), 10.9 (statements), 11.1 (functions) and 9.1 (branches) points below it. The old values
      // sat 10.85, 10.85, 10.65 and 8.86 points below their baselines, so the regression tolerance is unchanged.
      thresholds: {
        lines: 41,
        functions: 35,
        branches: 30,
        statements: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@core': path.resolve(__dirname, './src/core'),
      '@simulation': path.resolve(__dirname, './src/simulation'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
});
