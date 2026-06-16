import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig, searchForWorkspaceRoot } from "vite";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: "tag",
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: { preserveSymlinks: false },
      server: {
        fs: {
          allow: [appRoot, searchForWorkspaceRoot(appRoot)],
        },
      },
      optimizeDeps: {
        include: ["@hugeicons/core-free-icons", "@hugeicons/react"],
      },
    });
  },
};

export default config;
