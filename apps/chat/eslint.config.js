import baseConfig from "@repo/eslint-config/base";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "src/eval/**"],
  },
  ...baseConfig,
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
