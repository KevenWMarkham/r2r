import { defineConfig, devices } from "@playwright/test";

// Playwright runs against `pnpm dev:canned` for deterministic (no-LLM) tests.
// In canned mode, all agent outputs come from fixtures — artificial 400-700ms
// dwells per step — so tests complete in seconds.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,           // shared Vite server; sequential avoids port races
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev:canned",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
