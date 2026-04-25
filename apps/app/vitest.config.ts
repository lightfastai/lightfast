import { resolve } from "node:path";
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
      globals: true,
      environment: "happy-dom",
      setupFiles: ["./src/__tests__/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      passWithNoTests: true,
      server: {
        deps: {
          inline: [
            "@repo/ui",
            "@repo/app-trpc",
            "@repo/app-octokit-github",
            "@repo/app-validation",
          ],
        },
      },
    },
    resolve: {
      alias: {
        "~": resolve(import.meta.dirname, "src"),
        "next/image": resolve(
          import.meta.dirname,
          "src/__tests__/__mocks__/next-image.tsx"
        ),
        "@repo/app-octokit-github/env": resolve(
          import.meta.dirname,
          "src/__tests__/__mocks__/github-env.ts"
        ),
        "server-only": resolve(
          import.meta.dirname,
          "src/__tests__/__mocks__/server-only.ts"
        ),
      },
    },
  })
);
