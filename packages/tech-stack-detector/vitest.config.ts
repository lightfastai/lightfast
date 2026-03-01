import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
      exclude: ["node_modules", "dist"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/**",
          "dist/**",
          "**/*.test.ts",
          "**/*.spec.ts",
          "**/*.config.ts",
          "src/cli.ts",
        ],
      },
    },
  }),
);
