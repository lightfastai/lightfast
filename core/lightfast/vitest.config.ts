import { defineConfig, mergeConfig } from "vitest/config";
import pkg from "./package.json";
import sharedConfig from "../../vitest.shared";

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
  }),
);
