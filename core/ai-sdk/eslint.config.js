import baseConfig from "@repo/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "coverage/**"],
  },
  ...baseConfig,
  {
    rules: {
      // Disable unsafe-related checks (these are all related to any types)
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Disable other problematic rules
      "@typescript-eslint/prefer-nullish-coalescing": "off", // Keep disabled - only 25 errors but requires careful review
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Allow empty object type
      "@typescript-eslint/no-empty-object-type": "off",
      // Disable unused variable checks for underscore-prefixed vars
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "destructuredArrayIgnorePattern": "^_" }],
      // Disable misused promises
      "@typescript-eslint/no-misused-promises": "off",
      // Finally, disable no-explicit-any (the hardest one)
      "@typescript-eslint/no-explicit-any": "off",
    }
  },
  {
    // Test file specific overrides
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      // vitest mocks use unbound methods frequently
      "@typescript-eslint/unbound-method": "off",
      // Test async generators for mock streams don't need await
      "@typescript-eslint/require-await": "off",
      // Empty functions are common in test mocks
      "@typescript-eslint/no-empty-function": "off",
      // import() type annotations are used in vi.importActual
      "@typescript-eslint/consistent-type-imports": "off",
    }
  }
];
