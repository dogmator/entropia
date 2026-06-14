import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}', '*.config.ts'],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ['@vitest/coverage-v8'], // Example of pre-existing known issues if any
};

export default config;
