import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
      include: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "__tests__/**/*.{test,spec}.{ts,tsx}",
      ],
      passWithNoTests: true,
    },
  })
);
