import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "@repo/vitest-config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
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
            "@repo/console-trpc",
            "@repo/console-octokit-github",
            "@repo/console-validation",
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
        "@repo/console-octokit-github/env": resolve(
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
