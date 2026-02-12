---
date: 2026-01-31T12:00:00+08:00
researcher: claude-opus-4-5
topic: "t3-oss/env (t3-env) Vite Setup Documentation"
tags: [research, web-analysis, t3-env, vite, environment-variables, typescript, zod]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 8
---

# Web Research: t3-oss/env (t3-env) Vite Setup

**Date**: 2026-01-31
**Topic**: How to set up t3-env with Vite for type-safe environment variables
**Confidence**: High - based on official documentation and GitHub repository

## Research Question

How to set up t3-oss/env (t3-env) with Vite for type-safe, validated environment variables?

## Executive Summary

**t3-env** (`@t3-oss/env-core`) is a TypeScript library that provides type-safe, validated environment variables using Standard Schema-compliant validators (Zod, Valibot, ArkType). For Vite projects, use the **`@t3-oss/env-core`** package (there is no Vite-specific package). Key configuration: set `clientPrefix: "VITE_"` and `runtimeEnv: import.meta.env`. The library provides both compile-time TypeScript safety and runtime validation, failing fast if environment variables are missing or invalid.

## Key Metrics & Findings

### Package Architecture

**Finding**: t3-env has three main packages with different use cases
**Sources**: [Official Docs](https://env.t3.gg/docs/core), [GitHub](https://github.com/t3-oss/t3-env)

| Package | Use Case | Pre-configured |
|---------|----------|----------------|
| `@t3-oss/env-core` | Framework-agnostic (Vite, Remix, etc.) | No - manual config |
| `@t3-oss/env-nextjs` | Next.js projects | Yes - `NEXT_PUBLIC_` prefix |
| `@t3-oss/env-nuxt` | Nuxt projects | Yes |

**For Vite**: Use `@t3-oss/env-core`

### Vite-Specific Configuration

**Finding**: Vite requires specific configuration options
**Source**: [T3 Env Core Docs](https://env.t3.gg/docs/core)

| Option | Vite Value | Purpose |
|--------|------------|---------|
| `clientPrefix` | `"VITE_"` | Vite exposes vars with this prefix to client |
| `runtimeEnv` | `import.meta.env` | Vite's env object (not `process.env`) |
| `isServer` | `typeof window === "undefined"` | Server context detection for SSR |

### Available Presets

**Finding**: t3-env includes a built-in Vite preset for Vite's internal variables
**Source**: [T3 Env Presets](https://env.t3.gg/docs/core)

```typescript
import { vite } from "@t3-oss/env-core/presets-zod";
// Provides: MODE, DEV, PROD, SSR, BASE_URL
```

**Other Platform Presets**:
- `vercel()` - Vercel system variables
- `netlify()` - Netlify variables
- `railway()` - Railway variables
- `render()` - Render variables
- `fly.io()` - Fly.io variables

## Complete Vite Setup Guide

### Installation

```bash
npm install @t3-oss/env-core zod
# or
pnpm add @t3-oss/env-core zod
```

### Basic Configuration

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables.
   * Will throw if accessed on the client.
   */
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET_KEY: z.string().min(1),
  },

  /**
   * Client-side environment variables.
   * Must be prefixed with VITE_ in Vite projects.
   */
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.string().url(),
    VITE_APP_NAME: z.string().min(1),
  },

  /**
   * Vite exposes environment variables on import.meta.env
   */
  runtimeEnv: import.meta.env,

  /**
   * Server context detection (important for SSR)
   */
  isServer: typeof window === "undefined",

  /**
   * Recommended: Treat empty strings as undefined
   */
  emptyStringAsUndefined: true,
});
```

### With Vite Preset

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { vite } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.string().url(),
  },
  runtimeEnv: import.meta.env,

  // Extend Vite preset for MODE, DEV, PROD, SSR, BASE_URL
  extends: [vite()],
});
```

### Strict Mode (Optional)

```typescript
export const env = createEnv({
  clientPrefix: "VITE_",
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    VITE_API_URL: z.string().url(),
  },

  // Strict: explicitly list all vars
  runtimeEnvStrict: {
    DATABASE_URL: import.meta.env.DATABASE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL,
  },
});
```

### TypeScript Configuration

Add Vite env types for IDE support:

```typescript
// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  // add more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Build-Time Validation

Validate at Vite config load time:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import "./src/env"; // Validates environment on config load

export default defineConfig({
  // ...
});
```

## Common Patterns

### Boolean Coercion

```typescript
server: {
  ENABLE_FEATURE: z
    .string()
    .transform((s) => s !== "false" && s !== "0"),
}
```

### Number Coercion

```typescript
server: {
  PORT: z.coerce.number(),
  MAX_RETRIES: z.coerce.number().min(1).max(10),
}
```

### Optional with Defaults

```typescript
client: {
  VITE_ENABLE_ANALYTICS: z.string().default("false"),
}
```

### Alternative Validators

**Valibot**:
```typescript
import * as v from "valibot";
client: {
  VITE_API_URL: v.pipe(v.string(), v.url()),
}
```

**ArkType**:
```typescript
import { type } from "arktype";
client: {
  VITE_API_URL: type("string.url"),
}
```

## Security Best Practices

1. **Never prefix secrets with `VITE_`** - They will be bundled into client code
2. **Use `.env.local` for secrets** - Add to `.gitignore`
3. **Use `.env.example` for documentation** - Commit to git
4. **Split schemas if variable names are sensitive** - Prevents schema leaking to client

### Split File Pattern (For Sensitive Names)

```typescript
// src/env/server.ts
export const serverEnv = createEnv({
  server: {
    SECRET_API_KEY: z.string().min(1),
  },
  runtimeEnv: import.meta.env,
});

// src/env/client.ts
export const clientEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.string().url(),
  },
  runtimeEnv: import.meta.env,
});
```

## Lightfast Environment Variables Reference

### Services Integrated

Lightfast uses 20+ services requiring environment variables:

| Service | Type | Variables | Required |
|---------|------|-----------|----------|
| Clerk | Authentication | 7 vars | ✅ Yes |
| PlanetScale | Database | 4 vars | ✅ Yes |
| GitHub | Integration | 5 vars | ✅ Yes (for workflows) |
| Inngest | Workflows | 3 vars | ✅ Yes |
| Pinecone | Vector Search | 1 var | ✅ Yes |
| Upstash | Redis/KV | 5 vars | ✅ Yes |
| Vercel | Deployment | 5 vars | ✅ Yes (on Vercel) |
| BaseHub | CMS | 2 vars | ✅ Yes |
| Sentry | Error Tracking | 5 vars | ✅ Yes |
| Better Stack | Logging | 4 vars | ✅ Yes |
| PostHog | Analytics | 2 vars | ✅ Yes |
| Arcjet | Security | 2 vars | ✅ Yes |
| Resend | Email | 2 vars | ⚠️ Optional (features) |
| Vercel Blob | Storage | 2 vars | ⚠️ Optional |
| Braintrust | AI Evaluation | 4 vars | ⚠️ Optional |
| Anthropic | LLM | 1 var | ⚠️ Optional (features) |
| OpenAI | LLM | 1 var | ⚠️ Optional (features) |
| Cohere | Embeddings | 1 var | ⚠️ Optional (features) |
| ElevenLabs | Text-to-Speech | 1 var | ⚠️ Optional (features) |
| BrowserBase | Web Automation | 2 vars | ⚠️ Optional (features) |
| Mixedbread | Embeddings | 2 vars | ⚠️ Optional (docs) |
| Exa | Web Search | 1 var | ⚠️ Optional (chat) |

### Complete Environment Variables for apps/www (Vite)

```typescript
// apps/www/src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  // ============ SERVER VARIABLES ============
  server: {
    // Core Application
    NODE_ENV: z.enum(["development", "production", "test"]),

    // Clerk Authentication (Server-side)
    CLERK_SECRET_KEY: z.string().min(1),

    // Database
    DATABASE_URL: z.string().url(),

    // Security
    ENCRYPTION_KEY: z.string()
      .min(64)
      .max(64)
      .regex(/^[0-9a-f]{64}$/, "Must be 64 hex characters"),

    // Resend Email
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    RESEND_EARLY_ACCESS_AUDIENCE_ID: z.string().optional(),

    // BaseHub CMS
    BASEHUB_TOKEN: z.string().startsWith("bshb_pk_").optional(),
    BASEHUB_CHANGELOG_TOKEN: z.string().startsWith("bshb_pk_").optional(),

    // Better Stack Logging
    LOGTAIL_SOURCE_TOKEN: z.string().optional(),
    LOGTAIL_URL: z.string().url().optional(),

    // Arcjet Security
    ARCJET_KEY: z.string().startsWith("ajkey_").optional(),
    ARCJET_ENV: z.enum(["development", "production"]).optional(),

    // Observability
    SKIP_ENV_VALIDATION: z.string().optional(),
  },

  // ============ CLIENT VARIABLES ============
  clientPrefix: "VITE_",
  client: {
    // Core Application
    VITE_NODE_ENV: z.enum(["development", "production", "test"]),

    // Clerk Authentication (Public key)
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    VITE_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
    VITE_CLERK_AFTER_SIGN_IN_URL: z.string().default("/"),

    // Vercel Integration (on Vercel)
    VITE_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    VITE_VERCEL_URL: z.string().url().optional(),

    // Sentry Error Tracking
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.string().optional(),

    // Better Stack Public Logging
    VITE_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    VITE_BETTER_STACK_INGESTING_URL: z.string().url().optional(),

    // PostHog Analytics
    VITE_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
    VITE_POSTHOG_HOST: z.string().url().optional(),

    // Arcjet Security (Client-side)
    VITE_ARCJET_KEY: z.string().startsWith("ajkey_").optional(),
  },

  /**
   * Vite exposes environment variables on import.meta.env
   */
  runtimeEnv: import.meta.env,

  /**
   * Server context detection for SSR/hydration
   */
  isServer: typeof window === "undefined",

  /**
   * Treat empty strings as undefined
   */
  emptyStringAsUndefined: true,
});
```

### Environment Files Structure

```bash
apps/www/
├── .env.example           # All variables (commit to git)
├── .env.local            # Local development (add to .gitignore)
├── .env.development      # Dev environment
├── .env.production       # Production environment
└── .vercel/
    ├── .env.development.local
    ├── .env.preview.local
    └── .env.production.local
```

### .env.example Template

```bash
# Core Application
NODE_ENV=development
VITE_NODE_ENV=development

# ========== CLERK AUTHENTICATION ==========
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_SIGN_IN_URL=/sign-in
VITE_CLERK_AFTER_SIGN_IN_URL=/

# ========== DATABASE ==========
DATABASE_URL=mysql://...@aws.planetscale.net/lightfast

# ========== SECURITY ==========
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ========== VERCEL (when on Vercel) ==========
VITE_VERCEL_ENV=development
VITE_VERCEL_URL=https://www-dev.vercel.app

# ========== EMAIL (Resend) ==========
RESEND_API_KEY=re_...
RESEND_EARLY_ACCESS_AUDIENCE_ID=...

# ========== CMS (BaseHub) ==========
BASEHUB_TOKEN=bshb_pk_...
BASEHUB_CHANGELOG_TOKEN=bshb_pk_...

# ========== LOGGING (Better Stack) ==========
LOGTAIL_SOURCE_TOKEN=...
LOGTAIL_URL=https://in.logs.betterstack.com
VITE_BETTER_STACK_SOURCE_TOKEN=...
VITE_BETTER_STACK_INGESTING_URL=https://in.logs.betterstack.com

# ========== ERROR TRACKING (Sentry) ==========
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_SENTRY_ENVIRONMENT=development

# ========== ANALYTICS (PostHog) ==========
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com

# ========== SECURITY (Arcjet) ==========
ARCJET_KEY=ajkey_...
ARCJET_ENV=development
VITE_ARCJET_KEY=ajkey_...
```

### Vercel-Specific Setup

When deploying to Vercel, you can set environment variables in:

**Option 1: Project Settings (Recommended)**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add all variables with proper environment scoping (Development, Preview, Production)
3. Use `import.meta.env` to access in client code (with `VITE_` prefix)

**Option 2: .env Files in Repository**
```typescript
// apps/www/.vercel/.env.development.local
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=mysql://...dev...
# etc.

// apps/www/.vercel/.env.production.local
CLERK_SECRET_KEY=sk_prod_...
DATABASE_URL=mysql://...prod...
# etc.
```

**Key Vercel Environment Variables Provided Automatically:**
```typescript
import.meta.env.MODE          // "development" | "preview" | "production"
import.meta.env.DEV           // boolean
import.meta.env.PROD          // boolean
import.meta.env.VITE_VERCEL_ENV  // Your custom variable
import.meta.env.VITE_VERCEL_URL  // Auto-populated URL
```

### Integration with Vercel Preset

```typescript
// apps/www/src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

export const env = createEnv({
  server: {
    // ... your variables
  },
  client: {
    // ... your variables
  },
  runtimeEnv: import.meta.env,

  // Extend Vercel preset for automatic Vercel variables
  extends: [vercel()],
});

// Now available:
// env.VERCEL_ENV
// env.VERCEL_URL
// env.VERCEL_GIT_COMMIT_SHA
// env.VERCEL_GIT_COMMIT_MESSAGE
// env.VERCEL_GIT_BRANCH
// etc.
```

## Trade-off Analysis

### t3-env vs Manual Validation

| Factor | t3-env | Manual |
|--------|--------|--------|
| Type Safety | ✅ Full TypeScript inference | ⚠️ Manual type declarations |
| Runtime Validation | ✅ Zod/Valibot/ArkType | ❌ None by default |
| Fail-Fast | ✅ Errors at startup | ❌ Errors at usage time |
| Client/Server Split | ✅ Built-in protection | ❌ Manual implementation |
| Bundle Size | ~10KB (with Zod) | 0KB |

### Zod vs Valibot vs ArkType

| Factor | Zod | Valibot | ArkType |
|--------|-----|---------|---------|
| Bundle Size | ~14KB | ~7KB | ~5KB |
| API Familiarity | Most common | Similar to Zod | Unique syntax |
| Type Inference | Excellent | Excellent | Excellent |
| Ecosystem | Largest | Growing | Smallest |

## Recommendations for Lightfast www (Vite)

Based on research findings and Lightfast architecture:

1. **Use `@t3-oss/env-core` with Zod** - Best ecosystem support, already used in console
2. **Always set `emptyStringAsUndefined: true`** - Prevents common issues with empty env vars
3. **Import env.ts in vite.config.ts** - Validates at build time, fails fast
4. **Use Vercel preset** - Add automatic access to `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_*`
5. **Use `.vercel/.env.*.local` files** - Keep secrets out of git, scoped to environments
6. **Match console env.ts schema** - Coordinate with `@api/console` for consistency
7. **Separate secrets in schema comments** - Document which vars are sensitive (prefixed `sk_`, `re_`, etc.)

## Known Limitations

1. **No dedicated Vite docs page** - Must use core docs and infer Vite config
2. **TypeScript ImportMetaEnv still needed** - t3-env validates but doesn't augment Vite types
3. **HMR limitations** - `.env` changes require full Vite restart
4. **Monorepo complexity** - No extensive documentation for shared env configs

## Sources

### Official Documentation
- [T3 Env Core Documentation](https://env.t3.gg/docs/core) - Official docs
- [T3 Env GitHub Repository](https://github.com/t3-oss/t3-env) - Source code and issues

### Related Guides
- [Vite Environment Variables](https://vite.dev/guide/env-and-mode) - Official Vite docs
- [Create T3 App Env Guide](https://create.t3.gg/en/usage/env-variables) - T3 Stack usage

### Tutorials & Blog Posts
- [Type-Safe Env Vars in Remix](https://dev.to/seasonedcc/type-safe-env-vars-in-remix-a-modern-approach-with-arktype-11k9) - ArkType approach
- [Why T3 Env is My Go-To](https://www.mwskwong.com/blog/why-t3-env-is-my-go-to-for-managing-environment-variables) - Best practices

### Package References
- [NPM: @t3-oss/env-core](https://www.npmjs.com/package/@t3-oss/env-core)
- [JSR: @t3-oss/env-core](https://jsr.io/@t3-oss/env-core)

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Based on official documentation and repository source
**Next Steps**: Implement t3-env in Vite project using the configuration patterns above
