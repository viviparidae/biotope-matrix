import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bash -lc "pkill -f \"tsx apps/worker/src/index.ts\" || true; pkill -f \"vite --config apps/frontend/vite.config.ts\" || true; PORT=8787 pnpm exec tsx apps/worker/src/index.ts >/tmp/biotope-worker.log 2>&1 & pnpm exec vite --config apps/frontend/vite.config.ts --host 127.0.0.1 --strictPort"',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
