import { resolve } from "path";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

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
        "~": resolve(__dirname, "src"),
        "next/image": resolve(__dirname, "src/__tests__/__mocks__/next-image.tsx"),
        "@repo/console-octokit-github/env": resolve(
          __dirname,
          "src/__tests__/__mocks__/github-env.ts",
        ),
        "server-only": resolve(
          __dirname,
          "src/__tests__/__mocks__/server-only.ts",
        ),
      },
    },
  }),
);
