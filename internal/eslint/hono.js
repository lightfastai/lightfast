import honoConfig from "@hono/eslint-config";

/** @type {Awaited<import('typescript-eslint').Config>} */
export default [
  ...honoConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
