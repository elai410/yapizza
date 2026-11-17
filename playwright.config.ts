import { defineConfig, devices } from '@playwright/test';

// Load .env so flag checks in tests see the same NEXT_PUBLIC_* values as the app; shell vars still win.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
