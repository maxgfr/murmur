import { defineConfig, devices } from "@playwright/test";

// Checks the production site and its published script (see e2e-live/). The local server only
// provides host pages on another origin and a fake OpenAI-compatible endpoint.
export default defineConfig({
  testDir: "e2e-live",
  timeout: 60_000,
  // Cold loads from GitHub Pages and its CDN take longer than local files.
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://localhost:4317", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun scripts/serve.ts",
    env: { PORT: "4317" },
    url: "http://localhost:4317/live.html",
    reuseExistingServer: !process.env.CI,
  },
});
