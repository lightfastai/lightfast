import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/__tests__/**/*.{test,spec}.{ts,tsx}"],
    },
  })
);
