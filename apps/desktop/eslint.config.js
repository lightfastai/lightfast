import baseConfig from "@repo/eslint-config/base.js";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "out/**", "*.config.ts", "*.config.js"],
  },
];