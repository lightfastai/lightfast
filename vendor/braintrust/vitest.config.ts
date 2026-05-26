import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        "server-only": new URL(
          "./src/__tests__/__mocks__/server-only.ts",
          import.meta.url
        ).pathname,
      },
    },
    test: {
      environment: "node",
    },
  })
);
