import baseConfig from "@repo/eslint-config/base";

export default [
  {
    ignores: [".next/**", ".source/**"],
  },
  ...baseConfig,
];