import sharedConfig from "@repo/vitest-config";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [react()],
    esbuild: {
      jsx: "automatic",
    },
    test: {
      environment: "happy-dom",
      globals: true,
      include: ["src/__tests__/**/*.{test,spec}.{ts,tsx}"],
    },
  })
);
