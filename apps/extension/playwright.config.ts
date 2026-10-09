import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
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
