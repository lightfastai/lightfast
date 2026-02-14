import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreWorkspaces: ["db/*", "vendor/db", "packages/url-utils"],
  workspaces: {
    ".": {
      entry: ["scripts/*.{js,ts}"],
      ignoreDependencies: ["turbo", "turbo-ignore"],
    },
    "apps/*": {
      entry: [
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/route.ts",
        "src/app/api/**/route.ts",
        "src/middleware.ts",
        "src/instrumentation.ts",
        "next.config.{js,ts,mjs}",
        "tailwind.config.{js,ts}",
        "postcss.config.{js,ts,mjs}",
        "sentry.*.config.ts",
      ],
      ignoreDependencies: ["@sentry/nextjs"],
    },
    "api/*": {
      entry: ["src/index.ts", "src/inngest/**/*.ts"],
    },
    "packages/*": {
      entry: ["src/index.ts", "src/index.tsx"],
    },
    "vendor/*": {
      entry: ["src/index.ts", "env.ts"],
    },
    "core/*": {
      entry: ["src/index.ts"],
    },
    "internal/*": {
      entry: ["src/index.ts", "*.js", "*.json"],
      ignore: ["internal/arch-eval/**"],
    },
  },
  ignore: [
    "**/node_modules/**",
    "**/.turbo/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "thoughts/**",
    "examples/**",
    "db/**",
    "vendor/db/**",
    "**/eslint.config.{js,mjs,cjs}",
  ],
  ignoreDependencies: [
    "@repo/eslint-config",
    "@repo/prettier-config",
    "@repo/typescript-config",
  ],
};

export default config;
