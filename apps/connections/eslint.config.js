import honoConfig, { honoTestOverrides } from "@repo/eslint-config/hono";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", ".vercel/**"],
  },
  ...honoConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "vitest.config.ts", "tsup.config.ts"],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
    },
  },
  honoTestOverrides,
];
