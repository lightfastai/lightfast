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
      // Strict TypeScript rules for compiler code
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "no-useless-escape": "error",
      "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/unbound-method": "error",
    },
  },
  {
    // Test files need some flexibility
    files: ["**/*.test.ts", "**/*.test.js"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn", // Tests often assert on values
      "@typescript-eslint/no-explicit-any": "warn", // Mock data might use any
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/unbound-method": "off", // expect() methods are unbound
      "@typescript-eslint/no-require-imports": "warn", // Dynamic imports in tests
    },
  },
  {
    // Bundler code needs to work with dynamic modules
    files: ["src/bundler.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "warn", // Dynamic module loading
      "@typescript-eslint/no-explicit-any": "warn", // Manifest typing
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/require-await": "warn", // Async plugin hooks
    },
  },
];