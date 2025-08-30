import baseConfig from "@repo/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: [
      "dist/**", 
      ".turbo/**", 
      "node_modules/**",
      ".output/**",
      ".tanstack/**",
      ".cache/**",
      "src/routeTree.gen.ts", // Auto-generated file
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    rules: {
      // Minimal overrides for dev-server - keep it strict
      "turbo/no-undeclared-env-vars": "off", // Allow ENV access in dev server
      "@typescript-eslint/no-empty-function": "off", // Allow empty constructors
    },
  },
];