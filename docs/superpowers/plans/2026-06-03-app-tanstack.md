# apps/app-tanstack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/app-tanstack` as a live TanStack Start sibling app with Portless dev routing, observability, security middleware, and a health endpoint while keeping the current Next.js console as the default app.

**Architecture:** Build a new `@lightfast/app-tanstack` package using the proven `apps/mcp` TanStack Start shape. Keep traffic isolated on `app-tanstack.lightfast` and do not modify `apps/app/microfrontends.json` routing. Add only infrastructure routes and middleware in this slice; product auth and tRPC remain out of scope.

**Tech Stack:** pnpm workspace, Turborepo, Portless, Vite, TanStack Start, TanStack Router, React 19, Nitro, Sentry TanStack Start SDK, Vitest, TypeScript.

---

## File Structure

- Create `apps/app-tanstack/package.json`: package metadata, scripts, workspace dependencies, and Portless service name.
- Create `apps/app-tanstack/portless.json`: direct local service route name.
- Create `apps/app-tanstack/turbo.json`: build/dev env and output declarations.
- Create `apps/app-tanstack/vercel.json`: TanStack Start framework config.
- Create `apps/app-tanstack/tsconfig.json`: TypeScript config matching `apps/mcp`.
- Create `apps/app-tanstack/vitest.config.ts`: Vitest config using `@repo/vitest-config`.
- Create `apps/app-tanstack/src/__tests__/setup-env.ts`: test env defaults for env validation.
- Create `apps/app-tanstack/src/__tests__/env-config.test.ts`: tests for env and Vite/Sentry wiring.
- Create `apps/app-tanstack/src/__tests__/health.test.ts`: tests for `/api/health`.
- Create `apps/app-tanstack/src/__tests__/security-headers.test.ts`: tests for Fetch security header application.
- Create `apps/app-tanstack/src/__tests__/workspace-wiring.test.ts`: tests for Portless/root dev/MFE isolation.
- Create `apps/app-tanstack/src/env.d.ts`: Vite and TanStack Start type reference.
- Create `apps/app-tanstack/src/env.ts`: TanStack-safe env schema.
- Create `apps/app-tanstack/vite.config.ts`: TanStack Start, Nitro, React, Sentry, alias, and Portless dev server config.
- Create `apps/app-tanstack/src/security/headers.ts`: Fetch `Response` security header helper.
- Create `apps/app-tanstack/src/routes/api/health.ts`: health server route.
- Create `apps/app-tanstack/src/routes/__root.tsx`: document shell, metadata, favicons, not-found surface.
- Create `apps/app-tanstack/src/routes/index.tsx`: minimal status page.
- Create `apps/app-tanstack/src/router.tsx`: TanStack Router factory and Sentry router tracing.
- Create `apps/app-tanstack/src/start.ts`: global Sentry and security request middleware.
- Create `apps/app-tanstack/src/client.tsx`: browser entry with Sentry initialization.
- Create `apps/app-tanstack/src/server.ts`: server entry with Sentry fetch wrapping.
- Create `apps/app-tanstack/instrument.server.mjs`: server-side Sentry and Braintrust bootstrap.
- Copy `apps/app/public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, and `android-chrome-512x512.png` into `apps/app-tanstack/public/`.
- Modify `package.json`: add `@lightfast/app-tanstack` to the root `pnpm dev` Turborepo filter list.

## Out Of Scope Checks

- Do not add `@lightfast/app-tanstack` to `apps/app/microfrontends.json`.
- Do not create product routes under `/:slug`.
- Do not add a tRPC handler.
- Do not import `@vendor/clerk/server` or `@clerk/nextjs/server` in the new app.
- Do not migrate Server Actions, OAuth handlers, connector handlers, native proxy handlers, chat handlers, or Inngest handlers.

## Tasks

### Task 1: Scaffold The Package Shell

**Files:**
- Create: `apps/app-tanstack/package.json`
- Create: `apps/app-tanstack/portless.json`
- Create: `apps/app-tanstack/turbo.json`
- Create: `apps/app-tanstack/vercel.json`
- Create: `apps/app-tanstack/tsconfig.json`
- Create: `apps/app-tanstack/vitest.config.ts`
- Create: `apps/app-tanstack/src/__tests__/setup-env.ts`
- Create: `apps/app-tanstack/src/env.d.ts`
- Create: `apps/app-tanstack/public/*`

- [ ] **Step 1: Create the app directory skeleton**

Run:

```bash
mkdir -p apps/app-tanstack/src/__tests__ apps/app-tanstack/src/routes/api apps/app-tanstack/src/security apps/app-tanstack/public
```

Expected: the directories exist and `git status --short apps/app-tanstack` shows the new tree after files are added in later steps.

- [ ] **Step 2: Create `apps/app-tanstack/package.json`**

Use this exact content:

```json
{
  "name": "@lightfast/app-tanstack",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "portless": "app-tanstack.lightfast",
  "scripts": {
    "build": "pnpm with-env vite build",
    "clean": "git clean -xdf .cache .output .tanstack .turbo .vercel dist node_modules src/routeTree.gen.ts",
    "dev": "portless run pnpm with-related-projects pnpm with-env vite dev",
    "dev:next": "pnpm dev",
    "preview": "pnpm with-env vite preview",
    "start": "pnpm preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "with-env": "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local -e ../app/.env.overrides.local -e ../app/.vercel/.env.development.local --",
    "with-env:local": "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local -e ../app/.env.overrides.local -e ../app/.vercel/.env.development.local --",
    "with-env:vercel": "dotenv -e ./.vercel/.env.development.local -e ../app/.vercel/.env.development.local --",
    "with-related-projects": "env -S \"$(pnpm --silent --filter @repo/github-emulator env:sh -- --callback-url \\\"$(portless get lightfast)/api/github/setup\\\" --public-origin \\\"$(portless get github.lightfast)\\\")\n$(pnpm --silent --filter @repo/linear-emulator env:sh -- --public-origin \\\"$(portless get linear.lightfast)\\\")\n$(pnpm --silent --filter @repo/x-emulator env:sh -- --callback-url \\\"$(portless get lightfast)/api/connectors/x/mcp\\\" --public-origin \\\"$(portless get x.lightfast)\\\")\" INNGEST_SERVE_ORIGIN=$(portless get app-tanstack.lightfast) NEXT_PUBLIC_APP_URL=$(portless get app-tanstack.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) VITE_LIGHTFAST_APP_URL=$(portless get app-tanstack.lightfast) VITE_LIGHTFAST_WWW_URL=$(portless get www.lightfast) VITE_LIGHTFAST_PLATFORM_URL=$(portless get platform.lightfast) VITE_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN:-} INNGEST_DEV=$(portless get inngest.lightfast) QSTASH_URL=$(portless get qstash.lightfast)"
  },
  "dependencies": {
    "@db/app": "workspace:*",
    "@repo/ai": "workspace:*",
    "@repo/ui": "workspace:*",
    "@sentry/tanstackstart-react": "catalog:",
    "@t3-oss/env-core": "catalog:",
    "@tanstack/react-router": "catalog:",
    "@tanstack/react-start": "catalog:",
    "@vendor/braintrust": "workspace:*",
    "@vendor/upstash": "workspace:*",
    "@vendor/unkey": "workspace:*",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@tanstack/router-plugin": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "@vitejs/plugin-react": "catalog:",
    "dotenv-cli": "catalog:",
    "nitro": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Create static package config files**

Create `apps/app-tanstack/portless.json`:

```json
{
  "name": "app-tanstack.lightfast"
}
```

Create `apps/app-tanstack/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "tanstack-start",
  "ignoreCommand": "npx turbo-ignore"
}
```

Create `apps/app-tanstack/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node", "vite/client"],
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/app-tanstack/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Create `apps/app-tanstack/turbo.json`**

Use this exact content:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tags": ["app"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": [
        "BRAINTRUST_API_KEY",
        "CLERK_SECRET_KEY",
        "HEALTH_CHECK_AUTH_TOKEN",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SENTRY_DSN",
        "NEXT_PUBLIC_VERCEL_ENV",
        "SENTRY_AUTH_TOKEN",
        "SENTRY_DSN",
        "SENTRY_ORG",
        "SENTRY_PROJECT",
        "SERVICE_JWT_SECRET",
        "VERCEL_ENV",
        "VITE_*"
      ],
      "passThroughEnv": [
        "DATABASE_HOST",
        "DATABASE_USERNAME",
        "DATABASE_PASSWORD",
        "HOST",
        "KV_REST_API_TOKEN",
        "KV_REST_API_URL",
        "PORT",
        "PORTLESS_URL",
        "UNKEY_API_ID",
        "UNKEY_ROOT_KEY"
      ],
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.overrides.local",
        ".vercel/.env*",
        "../app/.env.overrides.local",
        "../app/.vercel/.env*"
      ],
      "outputs": [".output/**", "dist/**", "src/routeTree.gen.ts"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "passThroughEnv": ["HOST", "PORT", "PORTLESS_URL"]
    },
    "dev:next": {
      "cache": false,
      "persistent": true
    },
    "transit": {}
  }
}
```

- [ ] **Step 5: Create Vitest setup files**

Create `apps/app-tanstack/vitest.config.ts`:

```ts
import { resolve } from "node:path";
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
      passWithNoTests: true,
      setupFiles: ["src/__tests__/setup-env.ts"],
    },
    resolve: {
      alias: {
        "~": resolve(import.meta.dirname, "src"),
      },
    },
  })
);
```

Create `apps/app-tanstack/src/__tests__/setup-env.ts`:

```ts
process.env.BRAINTRUST_API_KEY ||= "test-braintrust-key";
process.env.CLERK_SECRET_KEY ||= "sk_test_fake-secret-key-for-tests";
process.env.DATABASE_HOST ||= "localhost";
process.env.DATABASE_PASSWORD ||= "test";
process.env.DATABASE_USERNAME ||= "test";
process.env.KV_REST_API_TOKEN ||= "test-kv-token";
process.env.KV_REST_API_URL ||= "https://kv.lightfast.test";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||=
  "pk_test_dGVzdC1jbGVyay5saWdodGZhc3QuZXhhbXBsZSQ";
process.env.NEXT_PUBLIC_SENTRY_DSN ||= "https://public@sentry.test/1";
process.env.SENTRY_DSN ||= "https://server@sentry.test/1";
process.env.SERVICE_JWT_SECRET ||= "test-service-jwt-secret-test-service-jwt-secret";
process.env.UNKEY_API_ID ||= "api_test";
process.env.UNKEY_ROOT_KEY ||= "unkey_test";
process.env.VITE_LIGHTFAST_APP_URL ||= "https://app-tanstack.lightfast.localhost";
process.env.VITE_LIGHTFAST_PLATFORM_URL ||=
  "https://platform.lightfast.localhost";
process.env.VITE_LIGHTFAST_WWW_URL ||= "https://www.lightfast.localhost";
process.env.VITE_SENTRY_DSN ||= "https://public@sentry.test/1";
```

- [ ] **Step 6: Copy app favicons**

Run:

```bash
cp apps/app/public/favicon.ico apps/app-tanstack/public/favicon.ico
cp apps/app/public/favicon-16x16.png apps/app-tanstack/public/favicon-16x16.png
cp apps/app/public/favicon-32x32.png apps/app-tanstack/public/favicon-32x32.png
cp apps/app/public/favicon-48x48.png apps/app-tanstack/public/favicon-48x48.png
cp apps/app/public/apple-touch-icon.png apps/app-tanstack/public/apple-touch-icon.png
cp apps/app/public/android-chrome-192x192.png apps/app-tanstack/public/android-chrome-192x192.png
cp apps/app/public/android-chrome-512x512.png apps/app-tanstack/public/android-chrome-512x512.png
```

Expected: `ls apps/app-tanstack/public` lists the seven copied files.

- [ ] **Step 7: Install workspace lockfile updates**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updates if the workspace needs to record the new importer. No package version should be changed by hand.

- [ ] **Step 8: Commit the package shell**

Run:

```bash
git add apps/app-tanstack pnpm-lock.yaml
git commit -m "chore: scaffold tanstack app package"
```

Expected: commit succeeds with only the new package shell and lockfile importer changes.

### Task 2: Add Environment And Vite Wiring

**Files:**
- Create: `apps/app-tanstack/src/__tests__/env-config.test.ts`
- Create: `apps/app-tanstack/src/env.ts`
- Create: `apps/app-tanstack/vite.config.ts`

- [ ] **Step 1: Write the failing env/Vite wiring tests**

Create `apps/app-tanstack/src/__tests__/env-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app-tanstack environment validation wiring", () => {
  it("uses TanStack-safe env-core rather than env-nextjs", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).not.toContain("@t3-oss/env-nextjs");
    expect(envSource).not.toContain("@vendor/clerk/env");
  });

  it("extends only non-Next shared env modules", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain('from "@vendor/upstash/env"');
    expect(envSource).toContain('from "@vendor/unkey/env"');
    expect(envSource).toContain("extends: [dbEnv, upstashEnv, unkeyEnv]");
  });

  it("accepts current NEXT_PUBLIC values and exposes Vite client values", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(envSource).toContain("NEXT_PUBLIC_SENTRY_DSN");
    expect(envSource).toContain("VITE_LIGHTFAST_APP_URL");
    expect(envSource).toContain("VITE_LIGHTFAST_WWW_URL");
    expect(envSource).toContain("VITE_LIGHTFAST_PLATFORM_URL");
  });

  it("evaluates env during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('import { env } from "./src/env"');
  });

  it("configures TanStack Start, Nitro, React, and Sentry plugins", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain("tanstackStart");
    expect(viteConfigSource).toContain("nitro()");
    expect(viteConfigSource).toContain("react()");
    expect(viteConfigSource).toContain("sentryTanstackStart");
  });
});
```

- [ ] **Step 2: Run the env/Vite test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/env-config.test.ts
```

Expected: FAIL because `src/env.ts` and `vite.config.ts` do not exist.

- [ ] **Step 3: Implement `apps/app-tanstack/src/env.ts`**

Use this exact content:

```ts
import "@tanstack/react-start/server-only";

import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-core";
import { upstashEnv } from "@vendor/upstash/env";
import { unkeyEnv } from "@vendor/unkey/env";
import { z } from "zod";

const vercelEnvSchema = z
  .enum(["development", "preview", "production"])
  .default("development");

const nodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");

const defaultAppUrl = "https://lightfast.ai";
const defaultPlatformUrl = "https://lightfast-platform.vercel.app";

export const env = createEnv({
  extends: [dbEnv, upstashEnv, unkeyEnv],
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_LIGHTFAST_PLATFORM_URL: z.string().url(),
    VITE_LIGHTFAST_WWW_URL: z.string().url(),
    VITE_SENTRY_DSN: z.string().url().optional(),
  },
  server: {
    BRAINTRUST_API_KEY: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_").optional(),
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1)
      .startsWith("pk_")
      .optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_VERCEL_ENV: vercelEnvSchema,
    NODE_ENV: nodeEnvSchema,
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SERVICE_JWT_SECRET: z.string().min(32).optional(),
    VERCEL_ENV: vercelEnvSchema,
  },
  runtimeEnv: {
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    HEALTH_CHECK_AUTH_TOKEN: process.env.HEALTH_CHECK_AUTH_TOKEN,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_LIGHTFAST_APP_URL:
      process.env.VITE_LIGHTFAST_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      defaultAppUrl,
    VITE_LIGHTFAST_PLATFORM_URL:
      process.env.VITE_LIGHTFAST_PLATFORM_URL ??
      process.env.NEXT_PUBLIC_PLATFORM_URL ??
      defaultPlatformUrl,
    VITE_LIGHTFAST_WWW_URL:
      process.env.VITE_LIGHTFAST_WWW_URL ??
      process.env.NEXT_PUBLIC_WWW_URL ??
      defaultAppUrl,
    VITE_SENTRY_DSN:
      process.env.VITE_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

export const sentryClientDsn =
  env.VITE_SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryServerDsn = env.SENTRY_DSN ?? sentryClientDsn;
```

- [ ] **Step 4: Implement `apps/app-tanstack/vite.config.ts`**

Use this exact content:

```ts
import { fileURLToPath } from "node:url";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { env, sentryClientDsn, sentryServerDsn } from "./src/env";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

const sentryBuildEnvKeys = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
] as const;

function requireSentryBuildEnv(command: "build" | "serve") {
  if (command === "build") {
    for (const key of sentryBuildEnvKeys) {
      if (!env[key]) {
        throw new Error(
          `Missing required Sentry build environment variable: ${key}`
        );
      }
    }
    if (!sentryClientDsn) {
      throw new Error(
        "Missing required public Sentry DSN environment variable: VITE_SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN"
      );
    }
    if (!sentryServerDsn) {
      throw new Error(
        "Missing required server Sentry DSN environment variable: SENTRY_DSN, VITE_SENTRY_DSN, or NEXT_PUBLIC_SENTRY_DSN"
      );
    }
  }

  return {
    authToken: env.SENTRY_AUTH_TOKEN,
    org: env.SENTRY_ORG,
    project: env.SENTRY_PROJECT,
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    ...tanstackStart(),
    nitro(),
    react(),
    ...sentryTanstackStart(requireSentryBuildEnv(command)),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_LIGHTFAST_APP_URL": JSON.stringify(
      env.VITE_LIGHTFAST_APP_URL
    ),
    "import.meta.env.VITE_LIGHTFAST_PLATFORM_URL": JSON.stringify(
      env.VITE_LIGHTFAST_PLATFORM_URL
    ),
    "import.meta.env.VITE_LIGHTFAST_WWW_URL": JSON.stringify(
      env.VITE_LIGHTFAST_WWW_URL
    ),
    "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(sentryClientDsn ?? ""),
  },
  server: {
    ...(host ? { host } : {}),
    ...(port ? { port, strictPort: true } : {}),
  },
}));
```

- [ ] **Step 5: Run the env/Vite tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/env-config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit env and Vite wiring**

Run:

```bash
git add apps/app-tanstack/src/__tests__/env-config.test.ts apps/app-tanstack/src/env.ts apps/app-tanstack/vite.config.ts
git commit -m "feat: wire tanstack app env and vite"
```

Expected: commit succeeds.

### Task 3: Add Security Header Helper And Health Route

**Files:**
- Create: `apps/app-tanstack/src/__tests__/security-headers.test.ts`
- Create: `apps/app-tanstack/src/__tests__/health.test.ts`
- Create: `apps/app-tanstack/src/security/headers.ts`
- Create: `apps/app-tanstack/src/routes/api/health.ts`

- [ ] **Step 1: Write the failing security header tests**

Create `apps/app-tanstack/src/__tests__/security-headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "../security/headers";

describe("security headers", () => {
  it("adds the app security headers to a Fetch response", async () => {
    const response = applySecurityHeaders(Response.json({ ok: true }));

    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "connect-src 'self'"
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves response status and existing headers", () => {
    const response = applySecurityHeaders(
      new Response("missing", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
```

- [ ] **Step 2: Write the failing health route tests**

Create `apps/app-tanstack/src/__tests__/health.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

describe("app-tanstack health route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns an unauthenticated health payload when no token is configured", async () => {
    vi.stubEnv("HEALTH_CHECK_AUTH_TOKEN", "");
    const { getHealth } = await import("../routes/api/health");

    const response = getHealth(new Request("https://app.test/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate"
    );
    await expect(response.json()).resolves.toMatchObject({
      environment: "test",
      service: "app-tanstack",
      status: "ok",
    });
  });

  it("rejects missing bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { getHealth } = await import("../routes/api/health");

    const response = getHealth(new Request("https://app.test/api/health"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authorization required",
    });
  });

  it("rejects invalid bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { getHealth } = await import("../routes/api/health");

    const response = getHealth(
      new Request("https://app.test/api/health", {
        headers: { authorization: "Bearer wrong-token" },
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("accepts valid bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { getHealth } = await import("../routes/api/health");

    const response = getHealth(
      new Request("https://app.test/api/health", {
        headers: {
          authorization: "Bearer test-health-token-test-health-token",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: "app-tanstack",
      status: "ok",
    });
  });
});
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/security-headers.test.ts src/__tests__/health.test.ts
```

Expected: FAIL because `src/security/headers.ts` and `src/routes/api/health.ts` do not exist.

- [ ] **Step 4: Implement `apps/app-tanstack/src/security/headers.ts`**

Use this exact content:

```ts
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://clerk.lightfast.ai",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://clerk.lightfast.ai https://clerk-telemetry.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
] as const;

const securityHeaders = [
  ["Content-Security-Policy", cspDirectives.join("; ")],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
] as const;

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of securityHeaders) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
```

- [ ] **Step 5: Implement `apps/app-tanstack/src/routes/api/health.ts`**

Use this exact content:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }) => getHealth(request),
    },
  },
});

export function getHealth(request: Request): Response {
  const authToken = env.HEALTH_CHECK_AUTH_TOKEN;

  if (authToken) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return Response.json({ error: "Authorization required" }, { status: 401 });
    }

    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!bearerMatch?.[1] || bearerMatch[1] !== authToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return Response.json(
    {
      environment: env.NODE_ENV,
      service: "app-tanstack",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
```

- [ ] **Step 6: Run the security and health tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/security-headers.test.ts src/__tests__/health.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit security and health route**

Run:

```bash
git add apps/app-tanstack/src/__tests__/security-headers.test.ts apps/app-tanstack/src/__tests__/health.test.ts apps/app-tanstack/src/security/headers.ts apps/app-tanstack/src/routes/api/health.ts
git commit -m "feat: add tanstack app health route"
```

Expected: commit succeeds.

### Task 4: Add TanStack Routes And Runtime Entries

**Files:**
- Create: `apps/app-tanstack/src/routes/__root.tsx`
- Create: `apps/app-tanstack/src/routes/index.tsx`
- Create: `apps/app-tanstack/src/router.tsx`
- Create: `apps/app-tanstack/src/start.ts`
- Create: `apps/app-tanstack/src/client.tsx`
- Create: `apps/app-tanstack/src/server.ts`
- Create: `apps/app-tanstack/instrument.server.mjs`

- [ ] **Step 1: Create `apps/app-tanstack/src/routes/__root.tsx`**

Use this exact content:

```tsx
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Lightfast Console TanStack" },
      {
        name: "description",
        content: "TanStack Start infrastructure shell for Lightfast Console.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "48x48",
        href: "/favicon-48x48.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* biome-ignore lint/style/noHeadElement: TanStack Start root routes render the document shell. */}
      <head>
        <HeadContent />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "min(100%, 32rem)",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#a1a1aa",
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          Not found
        </h1>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create `apps/app-tanstack/src/routes/index.tsx`**

Use this exact content:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "min(100%, 42rem)",
          display: "grid",
          gap: "1rem",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#a1a1aa",
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          app-tanstack.lightfast
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.25rem, 7vw, 4.5rem)",
            lineHeight: 0.95,
          }}
        >
          Lightfast Console TanStack
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "34rem",
            color: "#d4d4d8",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          Infrastructure shell for the staged TanStack Start migration. The
          current Next.js console remains the default Lightfast app.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create `apps/app-tanstack/src/router.tsx`**

Use this exact content:

```tsx
import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });

  if (!router.isServer && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router)
    );
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

- [ ] **Step 4: Create `apps/app-tanstack/src/start.ts`**

Use this exact content:

```ts
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { applySecurityHeaders } from "~/security/headers";

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  return applySecurityHeaders(response);
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware, securityHeadersMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
```

- [ ] **Step 5: Create `apps/app-tanstack/src/client.tsx`**

Use this exact content:

```tsx
import * as Sentry from "@sentry/tanstackstart-react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

const TOKEN_RE = /token=[^&]+/;
const CLERK_TICKET_RE = /__clerk_ticket=[^&]+/;
const TICKET_RE = /ticket=[^&]+/;

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: 1.0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.type === "navigation" && breadcrumb.data?.to) {
        breadcrumb.data.to = String(breadcrumb.data.to)
          .replace(TOKEN_RE, "token=REDACTED")
          .replace(CLERK_TICKET_RE, "__clerk_ticket=REDACTED")
          .replace(TICKET_RE, "ticket=REDACTED");
      }
      return breadcrumb;
    },
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
```

- [ ] **Step 6: Create `apps/app-tanstack/src/server.ts`**

Use this exact content:

```ts
import "../instrument.server.mjs";

import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry(
  wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request);
    },
  })
);
```

- [ ] **Step 7: Create `apps/app-tanstack/instrument.server.mjs`**

Use this exact content:

```js
import * as Sentry from "@sentry/tanstackstart-react";

const dsn =
  process.env.SENTRY_DSN ??
  process.env.VITE_SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN;

const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: environment === "production" ? 0.2 : 1.0,
    integrations: [Sentry.extraErrorDataIntegration({ depth: 3 })],
    beforeSendLog(log) {
      if (environment === "production" && log.level === "debug") {
        return null;
      }
      return log;
    },
  });
}

if (process.env.BRAINTRUST_API_KEY) {
  const { LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT } = await import(
    "@repo/ai/telemetry"
  );
  const { registerBraintrustOTel } = await import("@vendor/braintrust/otel");

  registerBraintrustOTel({
    parent: LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
    serviceName: "lightfast-app-tanstack",
  });
}
```

- [ ] **Step 8: Generate the route tree**

Run:

```bash
pnpm --filter @lightfast/app-tanstack with-env vite build
```

Expected: the build may fail at this point if Sentry build credentials are absent, but `apps/app-tanstack/src/routeTree.gen.ts` should be generated. If credentials are present, the build should complete.

- [ ] **Step 9: Run typecheck**

Run:

```bash
pnpm --filter @lightfast/app-tanstack typecheck
```

Expected: PASS. If it fails because `src/routeTree.gen.ts` is missing, rerun Step 8 and then rerun typecheck.

- [ ] **Step 10: Run all app-tanstack tests**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test
```

Expected: PASS.

- [ ] **Step 11: Commit routes and runtime entries**

Run:

```bash
git add apps/app-tanstack/src/routes apps/app-tanstack/src/router.tsx apps/app-tanstack/src/start.ts apps/app-tanstack/src/client.tsx apps/app-tanstack/src/server.ts apps/app-tanstack/instrument.server.mjs apps/app-tanstack/src/routeTree.gen.ts
git commit -m "feat: add tanstack app runtime shell"
```

Expected: commit succeeds.

### Task 5: Wire Root Dev Without Switching MFE Traffic

**Files:**
- Create: `apps/app-tanstack/src/__tests__/workspace-wiring.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing workspace wiring tests**

Create `apps/app-tanstack/src/__tests__/workspace-wiring.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(import.meta.dirname, "../..");

describe("app-tanstack workspace wiring", () => {
  it("has a distinct package and Portless service name", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { name: string; portless: string };
    const portlessJson = JSON.parse(
      readFileSync(resolve(appRoot, "portless.json"), "utf8")
    ) as { name: string };

    expect(packageJson.name).toBe("@lightfast/app-tanstack");
    expect(packageJson.portless).toBe("app-tanstack.lightfast");
    expect(portlessJson.name).toBe("app-tanstack.lightfast");
  });

  it("is included in root pnpm dev", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(rootPackageJson.scripts.dev).toContain(
      "-F @lightfast/app-tanstack"
    );
  });

  it("does not replace the current app in the MFE mesh", () => {
    const microfrontendsJson = readFileSync(
      resolve(repoRoot, "apps/app/microfrontends.json"),
      "utf8"
    );

    expect(microfrontendsJson).toContain('"packageName": "@lightfast/app"');
    expect(microfrontendsJson).not.toContain("@lightfast/app-tanstack");
  });
});
```

- [ ] **Step 2: Run the workspace wiring test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/workspace-wiring.test.ts
```

Expected: FAIL because the root `pnpm dev` script does not include `@lightfast/app-tanstack`.

- [ ] **Step 3: Modify the root `package.json` dev script**

Change the root `package.json` `scripts.dev` value from:

```json
"dev": "portless proxy start && turbo run dev:next @lightfast/app#mfe:proxy //#_inngest //#_qstash //#_github_emulator //#_linear_emulator //#_x_emulator --concurrency=16 -F @lightfast/www -F @lightfast/app -F @lightfast/platform -F @lightfast/mcp --continue"
```

to:

```json
"dev": "portless proxy start && turbo run dev:next @lightfast/app#mfe:proxy //#_inngest //#_qstash //#_github_emulator //#_linear_emulator //#_x_emulator --concurrency=16 -F @lightfast/www -F @lightfast/app -F @lightfast/app-tanstack -F @lightfast/platform -F @lightfast/mcp --continue"
```

- [ ] **Step 4: Run the workspace wiring test and verify it passes**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test -- src/__tests__/workspace-wiring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all app-tanstack tests**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test
```

Expected: PASS.

- [ ] **Step 6: Commit root dev wiring**

Run:

```bash
git add package.json apps/app-tanstack/src/__tests__/workspace-wiring.test.ts
git commit -m "feat: run tanstack app in root dev"
```

Expected: commit succeeds and `apps/app/microfrontends.json` is unchanged.

### Task 6: Final Verification

**Files:**
- Verify: `apps/app-tanstack/**`
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify unchanged: `apps/app/microfrontends.json`

- [ ] **Step 1: Run package tests**

Run:

```bash
pnpm --filter @lightfast/app-tanstack test
```

Expected: PASS.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
pnpm --filter @lightfast/app-tanstack typecheck
```

Expected: PASS.

- [ ] **Step 3: Run package build**

Run:

```bash
pnpm --filter @lightfast/app-tanstack build
```

Expected: PASS when Sentry build env values are available. If the build fails with a missing `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VITE_SENTRY_DSN`, or `SENTRY_DSN` message, do not weaken validation without user approval; report the missing env values.

- [ ] **Step 4: Start root dev long enough to verify Portless registration**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Expected: logs show `@lightfast/app-tanstack` running Vite through Portless. Keep this process in the foreground while completing Steps 5 and 6, then stop it with `Ctrl-C`.

- [ ] **Step 5: Verify the direct health endpoint**

With `pnpm dev` still running, run in another terminal:

```bash
curl -i "$(portless get app-tanstack.lightfast)/api/health"
```

Expected: HTTP `200` with JSON containing `"service":"app-tanstack"` and `"status":"ok"` when `HEALTH_CHECK_AUTH_TOKEN` is unset. If the token is set in local env, expected HTTP status is `401` without an Authorization header.

- [ ] **Step 6: Verify the direct app shell**

With `pnpm dev` still running, run:

```bash
open "$(portless get app-tanstack.lightfast)"
```

Expected: browser renders the "Lightfast Console TanStack" status page.

- [ ] **Step 7: Confirm the MFE mesh did not switch traffic**

Run:

```bash
git diff -- apps/app/microfrontends.json
```

Expected: no output.

- [ ] **Step 8: Check final git status**

Run:

```bash
git status --short
```

Expected: clean, unless `src/routeTree.gen.ts` changed during build. If `src/routeTree.gen.ts` changed, inspect it and commit the generated update with:

```bash
git add apps/app-tanstack/src/routeTree.gen.ts
git commit -m "chore: update tanstack app route tree"
```

Expected: final `git status --short` is clean after any generated route tree update.

## Self-Review Notes

- Spec coverage: the plan creates the sibling app, direct Portless service, root dev wiring, env validation, Sentry/Braintrust observability bootstrap, global security middleware, health route, and tests. It explicitly keeps MFE traffic on `@lightfast/app`.
- Clerk boundary: the plan avoids `@vendor/clerk/server`, `@clerk/nextjs/server`, and `@vendor/clerk/env`; only raw Clerk env values are accepted for compatibility with existing env files.
- tRPC boundary: the plan does not add a tRPC route or depend on `api/app` auth resolution.
- Verification: package-level tests/typecheck/build are required, and direct Portless health/app checks are included.
