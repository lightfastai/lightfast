import { defineConfig } from "vitest/config";

/**
 * Shared vitest config — all packages extend this.
 *
 * Resource limits prevent CPU saturation when Turborepo runs
 * many vitest processes in parallel (~11 concurrently):
 *   - threads pool: shares memory, much lighter than forks
 *   - maxThreads: 2: limits each vitest instance to 2 worker threads
 *   - fileParallelism: false: runs test files sequentially within each instance
 *
 * Net result: 11 instances × 2 threads = 22 threads (vs 154 forked processes).
 */
export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 2,
      },
    },
    fileParallelism: false,
  },
});
