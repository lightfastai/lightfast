import path from "node:path";
import { fileURLToPath } from "node:url";
import sharedConfig from "@repo/vitest-config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

const dirname =
  typeof import.meta.dirname === "undefined"
    ? path.dirname(fileURLToPath(import.meta.url))
    : import.meta.dirname;

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "node",
            include: ["stories/**/*.test.ts"],
          },
        },
        {
          extends: true,
          plugins: [
            storybookTest({ configDir: path.join(dirname, ".storybook") }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  })
);
