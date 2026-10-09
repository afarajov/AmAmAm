import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // The mock bundle performs its first browser-side transform on demand.
  // Serial workers keep that cold start deterministic on clean machines/CI.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run build:mock && vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/tests/e2e/fixture.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
