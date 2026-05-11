import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";
import pkg from "./package.json";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    define: {
      __SDK_VERSION__: JSON.stringify(pkg.version),
    },
    test: {
      globals: true,
      environment: "node",
      passWithNoTests: true,
      globalSetup: ["./src/__tests__/integration/setup.ts"],
      // Run integration tests serially; they share a server.
      pool: "forks",
      poolOptions: {
        forks: { singleFork: true },
      },
    },
  })
);
