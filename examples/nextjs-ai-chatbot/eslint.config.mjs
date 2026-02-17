import baseConfig from "@repo/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "dist/**"],
  },
  ...baseConfig,
];

export default eslintConfig;
