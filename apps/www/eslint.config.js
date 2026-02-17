import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";
import nextjsConfig from "@repo/eslint-config/nextjs";
import reactConfig from "@repo/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
  {
    // Server Actions require async even without await expressions
    files: [
      "src/components/announcement-badge.tsx",
      "src/components/changelog-preview.tsx",
      "src/components/hero-changelog-badge.tsx",
      "src/app/**/page.tsx",
    ],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
];
