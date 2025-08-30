import baseConfig from "@repo/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", ".turbo/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts", "**/*.js"],
    rules: {
      // Allow some flexibility for compiler/CLI code while keeping most rules strict
      "@typescript-eslint/no-explicit-any": "warn", // Warn but don't error on any
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }], // Allow void operator
      "@typescript-eslint/prefer-nullish-coalescing": ["error", { ignoreTernaryTests: false, ignoreConditionalTests: true }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }], // Allow async functions in event handlers
      "@typescript-eslint/require-await": "warn", // Warn on async without await
      "no-useless-escape": "warn", // Warn on escape issues
      "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true, allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: true }],
    },
  },
];