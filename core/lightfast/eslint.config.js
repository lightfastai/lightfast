import baseConfig from "@repo/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "coverage/**"],
  },
  ...baseConfig,
  {
    rules: {
      // Disable unsafe-related checks
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Disable other problematic rules
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Allow empty object type
      "@typescript-eslint/no-empty-object-type": "off",
      // Disable unused variable checks for underscore-prefixed vars
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      // Disable misused promises
      "@typescript-eslint/no-misused-promises": "off",
      // Finally, disable no-explicit-any (the hardest one)
      "@typescript-eslint/no-explicit-any": "off",
    }
  }
];