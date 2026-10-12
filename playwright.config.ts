import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    launchOptions: {
      args: ['--disable-gpu', '--use-gl=swiftshader', '--disable-dev-shm-usage'],
    },
  },
});
