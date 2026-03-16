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
    },
  })
);
