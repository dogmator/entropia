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
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
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
      // Operator-approved tighter option (2026-10-21): each value sits 3 points below the lowest baseline measured for
      // the Istanbul method on Vitest 5. Measured range over repeated runs on the same tests and sources: lines
      // 52.28-52.76, statements 50.90-51.37, functions 46.07-46.37, branches 39.10-39.91. The spread comes from a
      // timing-dependent path in PerformanceMonitor, and the observed outliers raised coverage rather than lowering it.
      // The previous values (44 / 44 / 54 / 74) were set against the V8 counts of Vitest 2 (54.85 / 54.85 / 64.65 /
      // 82.86) and do not measure the same things.
      thresholds: {
        lines: 49,
        functions: 43,
        branches: 36,
        statements: 48,
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
