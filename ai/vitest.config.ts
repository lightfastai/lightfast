import { fileURLToPath } from "node:url";
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        "server-only": fileURLToPath(
          new URL("./src/__mocks__/server-only.ts", import.meta.url)
        ),
      },
    },
    test: {
      environment: "node",
    },
  })
);
