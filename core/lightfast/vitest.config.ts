import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";
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
