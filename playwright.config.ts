import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run dev -w apps/api",
      url: "http://localhost:4000/api/health/live",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -w apps/web",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
  ],
  timeout: 60000,
});
