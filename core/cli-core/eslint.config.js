import baseConfig from "@repo/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", ".turbo/**", "node_modules/**"],
  },
];