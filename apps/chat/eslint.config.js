import baseConfig from "@repo/eslint-config/base";

export default [
  {
    ignores: [".next/**", "src/eval/**", "**/*.test.ts"],
  },
  ...baseConfig,
];