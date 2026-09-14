import { defineConfig } from "vitest/config";

// Every Vitest package shares recursive discovery and bounded workers.
// Turbo may run packages concurrently; files within each package run serially.
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: false,
    pool: "threads",
    maxWorkers: 2,
    fileParallelism: false,
  },
});
