import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // CI uses both reporters: line writes step output to the workflow log,
  // html populates apps/desktop/playwright-report/ for the
  // 'Upload Playwright report on failure' step in desktop-ci.yml.
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
});
