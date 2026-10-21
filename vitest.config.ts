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
      thresholds: {
        lines: 44,
        functions: 54,
        branches: 74,
        statements: 44,
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
