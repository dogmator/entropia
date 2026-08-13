import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}', '*.config.ts'],
  ignoreExportsUsedInFile: true,
};

export default config;
