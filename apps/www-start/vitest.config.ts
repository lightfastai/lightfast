import { resolve } from "node:path";
import sharedConfig from "@repo/vitest-config";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
      passWithNoTests: true,
      server: {
        deps: {
          inline: ["@repo/ui"],
        },
      },
    },
    resolve: {
      alias: {
        "~": resolve(import.meta.dirname, "src"),
      },
    },
  })
);
