import { resolve } from "node:path";
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
      passWithNoTests: true,
      setupFiles: ["src/__tests__/setup-env.ts"],
    },
    resolve: {
      alias: {
        "~": resolve(import.meta.dirname, "src"),
      },
    },
  })
);
