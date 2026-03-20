# apps/memory Next.js App Shell — Implementation Plan

## Overview

Create `apps/memory/` as a minimal Next.js application that hosts the memory service at `memory.lightfast.ai`. This is a **separate Vercel project** (not a microfrontend). It exposes tRPC route handlers, Inngest serve endpoint, raw webhook ingestion, OAuth route handlers, and a health check. No UI framework dependencies beyond what Next.js requires — API-only.

## Current State Analysis

### What Exists Today (Spread Across 4 Services)

| Concern | Current location | Protocol |
|---------|-----------------|----------|
| OAuth flows | `apps/gateway/src/routes/connections.ts` | Hono (browser redirects) |
| Token vault | `apps/gateway/src/lib/token-{helpers,store}.ts` | Hono (X-API-Key) |
| Connection CRUD | `apps/gateway/src/routes/connections.ts` | Hono (X-API-Key) |
| Webhook ingestion | `apps/relay/src/routes/webhooks.ts` | Hono (HMAC) |
| Webhook delivery | `apps/relay/src/routes/workflows.ts` | Upstash Workflow |
| Console ingress | `apps/console/src/app/api/gateway/ingress/route.ts` | Upstash Workflow |
| Neural pipeline | `api/console/src/inngest/workflow/neural/` | Inngest |
| Backfill orchestration | `apps/backfill/src/workflows/` | Inngest |
| Health/token crons | `apps/gateway/src/functions/` | Inngest |

### What `apps/memory` Replaces

The memory app is a **clean-sheet** Next.js app that will eventually absorb gateway, relay, backfill, and the console neural pipeline. This plan covers only the shell — the skeleton that future work will port logic into.

### Architecture Pattern to Follow

Console app pattern (`apps/console/`) adapted for API-only use:
- `@t3-oss/env-nextjs` for env validation (not `@t3-oss/env-core` — we are in Next.js)
- tRPC via `fetchRequestHandler` from `@trpc/server/adapters/fetch`
- Inngest via `serve()` from `inngest/next`
- Route Handlers for non-tRPC endpoints (webhooks, OAuth)
- No Clerk middleware, no UI dependencies

### Auth Model

| Endpoint | Auth mechanism |
|----------|---------------|
| tRPC `/api/trpc/[trpc]` | JWT service tokens (Bearer header), org API keys |
| Webhook `/api/ingest/[provider]` | HMAC signature verification per provider |
| OAuth `/api/connect/*` | State token in Redis (authorize), none (callback is browser redirect) |
| Inngest `/api/inngest` | Inngest signing key (handled by `serve()`) |
| Health `/api/health` | None (public) |

## Desired End State

After this plan:
1. `apps/memory/` exists as a buildable, deployable Next.js app
2. `pnpm dev:memory` starts the app on port 4112
3. All route handlers exist with placeholder/stub implementations
4. `@api/platform` package exists with a stub `memoryRouter` and context creators
5. Inngest serve endpoint is wired up with an empty functions array
6. Env validation covers all required vars from gateway + relay + backfill + Inngest + providers

### Verification

```bash
pnpm typecheck              # No type errors across monorepo
pnpm check                  # No lint errors
pnpm build:memory           # Next.js build succeeds
pnpm dev:memory             # Starts on port 4112
curl http://localhost:4112/api/health  # Returns { "status": "ok" }
```

## What We're NOT Doing

- **No porting of business logic** — route handlers are stubs that return placeholder responses
- **No `packages/memory-trpc` client package** — that comes when consumers need to call memory
- **No Clerk middleware** — memory has no user sessions
- **No UI components** — API-only app, minimal root layout
- **No database migrations** — memory uses the existing `@db/app` schema
- **No microfrontends config** — memory.lightfast.ai is a separate Vercel project
- **No `@vendor/next/next-config-builder`** — that includes Sentry browser SDK, BetterStack RUM, and other UI-oriented plugins; memory needs none of that

---

## Phase 1: `@api/platform` Package — tRPC Routers and Context

### Overview

Create the `api/memory/` package following the `@api/app` pattern. This contains the tRPC router definitions, context creators, and Inngest client/function registrations. Built with `tsc` only, raw TS source consumed by the Next.js app.

### Changes Required

#### 1. `api/memory/package.json`

```json
{
  "name": "@api/platform",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    },
    "./inngest": {
      "types": "./dist/inngest/index.d.ts",
      "default": "./src/inngest/index.ts"
    },
    "./inngest/client": {
      "types": "./dist/inngest/client.d.ts",
      "default": "./src/inngest/client.ts"
    }
  },
  "license": "FSL-1.1-Apache-2.0",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "@db/app": "workspace:*",
    "@repo/app-providers": "workspace:*",
    "@repo/inngest": "workspace:*",
    "@repo/lib": "workspace:^",
    "@trpc/server": "catalog:",
    "@vendor/inngest": "workspace:*",
    "inngest": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

#### 2. `api/memory/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3. `api/memory/turbo.json`

```json
{
  "extends": ["//"],
  "tags": ["api"],
  "tasks": {}
}
```

#### 4. `api/memory/src/trpc.ts` — tRPC Initialization

Context is simpler than console — no Clerk, no M2M tokens. Auth is either:
- Service token (JWT Bearer) — for cross-service calls
- Org API key (Bearer) — for external API consumers
- Unauthenticated — for health check

```typescript
/**
 * Memory service tRPC initialization
 *
 * Auth model: JWT service tokens + org API keys (no Clerk sessions)
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

/**
 * Auth context — discriminated union.
 * Starts simple; expand as auth mechanisms are ported.
 */
type AuthContext =
  | { type: "service"; serviceId: string }
  | { type: "apiKey"; orgId: string; apiKeyId: string }
  | { type: "unauthenticated" };

export interface MemoryContext {
  auth: AuthContext;
  headers: Headers;
}

export const createMemoryContext = async (opts: {
  headers: Headers;
}): Promise<MemoryContext> => {
  // TODO: Phase 2 — implement JWT verification and API key lookup
  // For now, all requests are unauthenticated (only health check works)
  return {
    auth: { type: "unauthenticated" as const },
    headers: opts.headers,
  };
};

const t = initTRPC.context<MemoryContext>().create({
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/** Requires any authenticated context (service token or API key) */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.type === "unauthenticated") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({ ctx });
});
```

#### 5. `api/memory/src/root.ts` — Router Composition

```typescript
/**
 * Memory service root router
 *
 * Stub router — procedures will be added as logic is ported from
 * gateway, relay, backfill, and the console neural pipeline.
 */
import { createTRPCRouter } from "./trpc";

export const memoryRouter = createTRPCRouter({
  // Future: connections, ingest, backfill, pipeline sub-routers
});

export type MemoryRouter = typeof memoryRouter;
```

#### 6. `api/memory/src/index.ts` — Public API Surface

```typescript
export type { MemoryRouter } from "./root";
export { memoryRouter } from "./root";
export { createMemoryContext } from "./trpc";
export { createCallerFactory } from "./trpc";
```

#### 7. `api/memory/src/inngest/client.ts` — Inngest Client

```typescript
import type { GetEvents } from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";

/**
 * Memory service Inngest client.
 *
 * App ID is "lightfast-memory". Uses the shared @repo/inngest client factory
 * which registers all event schemas.
 */
const inngest = createInngestClient({
  appName: "lightfast-memory",
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

#### 8. `api/memory/src/inngest/index.ts` — Inngest Serve Config

```typescript
/**
 * Inngest exports for memory application
 *
 * Functions will be added as they are ported from:
 * - api/console/src/inngest/workflow/neural/ (event-store, entity-graph, entity-embed)
 * - api/console/src/inngest/workflow/notifications/ (dispatch)
 * - apps/backfill/src/workflows/ (orchestrator, entity-worker)
 * - apps/gateway/src/functions/ (health-check, token-refresh)
 */

import { serve } from "inngest/next";
import { inngest } from "./client";

export { inngest };

/**
 * Create the Inngest route handler for Next.js
 *
 * Initially serves zero functions. As functions are ported,
 * they are added to the functions array here.
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [],
    servePath: "/api/inngest",
  });
}
```

### Success Criteria

- [ ] `pnpm install` resolves all dependencies
- [ ] `pnpm --filter @api/platform typecheck` passes
- [ ] `pnpm --filter @api/platform build` produces `dist/` with declaration files

---

## Phase 2: `apps/memory/` — Next.js App Shell

### Overview

Create the Next.js application that serves the memory service. Minimal configuration — no UI framework, no Clerk, no microfrontends. API-only.

### Changes Required

#### 1. `apps/memory/package.json`

```json
{
  "name": "@lightfast/memory",
  "license": "FSL-1.1-Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm with-env next build --turbopack",
    "clean": "git clean -xdf .cache .next .turbo .vercel node_modules",
    "dev": "pnpm with-env next dev --port 4112 --turbo",
    "start": "pnpm with-env next start -p 4112",
    "typecheck": "tsc --noEmit",
    "with-env": "dotenv -e ./.vercel/.env.development.local --"
  },
  "dependencies": {
    "@api/platform": "workspace:*",
    "@db/app": "workspace:*",
    "@repo/app-providers": "workspace:*",
    "@repo/inngest": "workspace:*",
    "@repo/lib": "workspace:*",
    "@t3-oss/env-nextjs": "^0.12.0",
    "@trpc/server": "catalog:",
    "@vendor/inngest": "workspace:*",
    "@vendor/observability": "workspace:*",
    "@vendor/upstash": "workspace:*",
    "next": "catalog:next16",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "server-only": "^0.0.1",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "dotenv-cli": "^8.0.0",
    "typescript": "catalog:"
  }
}
```

Note: React is required by Next.js even for API-only apps (route handlers run in the Next.js runtime). No Tailwind, no UI packages.

#### 2. `apps/memory/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "types": ["node"],
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": [".", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### 3. `apps/memory/turbo.json`

```json
{
  "extends": ["//"],
  "tags": ["app"],
  "tasks": {}
}
```

#### 4. `apps/memory/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore"
}
```

#### 5. `apps/memory/next.config.ts`

Minimal — no microfrontends, no Sentry browser SDK, no BetterStack RUM. Just the basics.

```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  // API-only app — no UI optimization needed
  reactStrictMode: true,

  transpilePackages: [
    "@api/platform",
    "@db/app",
    "@repo/app-providers",
    "@repo/inngest",
    "@repo/lib",
    "@vendor/inngest",
    "@vendor/observability",
    "@vendor/upstash",
  ],

  // Disable static page generation — all routes are dynamic API handlers
  output: undefined,
};

export default config;
```

#### 6. `apps/memory/src/env.ts` — Merged Env Validation

Combines env vars from gateway, relay, backfill, Inngest, and provider packages. This is the superset of all services being consolidated.

```typescript
import { PROVIDER_ENVS } from "@repo/app-providers";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [
    vercel(),
    betterstackEnv,
    upstashEnv,
    ...PROVIDER_ENVS(),
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Service auth — internal API key for cross-service calls
    MEMORY_API_KEY: z.string().min(1),

    // Token vault encryption
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      .refine(
        (key) => {
          const hexPattern = /^[0-9a-f]{64}$/i;
          const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
          return hexPattern.test(key) || base64Pattern.test(key);
        },
        {
          message:
            "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)",
        }
      ),

    // Webhook verification secrets (per-provider, ported from relay)
    GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1).optional(),
    LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
    SENTRY_CLIENT_SECRET: z.string().min(1).optional(),

    // Inngest
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),

    // Observability
    SENTRY_DSN: z.string().url().optional(),
  },
  client: {},
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

#### 7. `apps/memory/src/app/layout.tsx` — Minimal Root Layout

```tsx
export const metadata = {
  title: "Lightfast Memory",
  description: "Memory service API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

#### 8. `apps/memory/src/app/page.tsx` — Root Page (API-only, returns nothing useful)

```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/api/health");
}
```

### Success Criteria

- [ ] `pnpm install` resolves all workspace dependencies
- [ ] `pnpm --filter @lightfast/memory typecheck` passes
- [ ] `pnpm --filter @lightfast/memory build` (or `pnpm build:memory`) succeeds

---

## Phase 3: Route Handlers

### Overview

Create all API route handlers as stubs. Each handler is wired up with the correct exports and runtime configuration, but business logic is deferred to future work.

### Changes Required

#### 1. `apps/memory/src/app/api/health/route.ts` — Health Check

```typescript
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "memory",
    timestamp: new Date().toISOString(),
  });
}
```

#### 2. `apps/memory/src/app/api/trpc/[trpc]/route.ts` — tRPC Handler

```typescript
import { createMemoryContext, memoryRouter } from "@api/platform";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";

export const runtime = "nodejs";

/**
 * CORS: allow lightfast.ai origins for cross-origin tRPC calls.
 * memory.lightfast.ai is a separate domain from lightfast.ai (console).
 */
const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  if (env.NODE_ENV === "production") {
    origins.add("https://lightfast.ai");
    origins.add("https://memory.lightfast.ai");
  }

  if (env.NODE_ENV === "development") {
    origins.add("http://localhost:4107"); // Console
    origins.add("http://localhost:3024"); // Microfrontends proxy
    origins.add("http://localhost:4112"); // Memory (self)
  }

  return origins;
};

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const originHeader = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin =
    originHeader && allowedOrigins.has(originHeader) ? originHeader : null;

  if (!allowOrigin) return res;

  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source"
  );
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");

  return res;
};

export const OPTIONS = (req: NextRequest) => {
  return setCorsHeaders(req, new Response(null, { status: 204 }));
};

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: memoryRouter,
    req,
    createContext: () =>
      createMemoryContext({
        headers: req.headers,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on 'memory.${path}'`, error);
    },
  });

  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
```

#### 3. `apps/memory/src/app/api/inngest/route.ts` — Inngest Serve

```typescript
/**
 * Inngest API route handler for memory service
 *
 * Serves Inngest functions registered in @api/platform/inngest.
 * Initially empty — functions are added as they are ported from
 * console, gateway, and backfill services.
 */
import { createInngestRouteContext } from "@api/platform/inngest";
import type { NextRequest } from "next/server";

const handlers = createInngestRouteContext();

export const GET = handlers.GET as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;

export const POST = handlers.POST as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;

export const PUT = handlers.PUT as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;
```

#### 4. `apps/memory/src/app/api/ingest/[provider]/route.ts` — Webhook Ingestion

```typescript
/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint. Replaces relay's entire webhook pipeline.
 *
 * Flow:
 * 1. Read raw body for HMAC verification
 * 2. Verify signature via deriveVerifySignature(signatureScheme)
 * 3. Parse payload via provider schema
 * 4. Persist delivery record
 * 5. inngest.send("memory/webhook.received")
 * 6. Return 200
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port webhook ingestion logic from apps/relay/src/routes/webhooks.ts
  // and apps/relay/src/middleware/webhook.ts
  //
  // Steps:
  // 1. getProvider(provider) — validate provider exists and has webhook support
  // 2. Read raw body for HMAC verification
  // 3. deriveVerifySignature(providerDef.webhook.signatureScheme) — verify
  // 4. Parse payload via provider schema, extract deliveryId/eventType/resourceId
  // 5. Persist to gatewayWebhookDeliveries
  // 6. inngest.send("memory/webhook.received", { ... })
  // 7. Return 200

  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "Webhook ingestion not yet ported from relay service",
    },
    { status: 501 }
  );
}
```

#### 5. `apps/memory/src/app/api/connect/[provider]/authorize/route.ts` — OAuth Start

```typescript
/**
 * GET /api/connect/:provider/authorize
 *
 * Initiate OAuth flow. Port from apps/gateway/src/routes/connections.ts:79
 *
 * NOT tRPC — returns redirect URL for browser OAuth.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port OAuth authorize logic from gateway connections.ts:79-141
  // Steps:
  // 1. Validate provider, get config
  // 2. Generate state token, store in Redis with TTL
  // 3. Build authorization URL via providerDef.auth.buildAuthUrl()
  // 4. Return { url, state }

  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth authorize not yet ported from gateway service",
    },
    { status: 501 }
  );
}
```

#### 6. `apps/memory/src/app/api/connect/[provider]/callback/route.ts` — OAuth Callback

```typescript
/**
 * GET /api/connect/:provider/callback
 *
 * OAuth callback. Port from apps/gateway/src/routes/connections.ts:208
 *
 * NOT tRPC — OAuth provider redirects here directly (browser).
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port OAuth callback logic from gateway connections.ts:208-489
  // Steps:
  // 1. Validate and consume state from Redis
  // 2. Call providerDef.auth.processCallback()
  // 3. Upsert installation + tokens in DB
  // 4. Store completion result in Redis for CLI polling
  // 5. Redirect to console or render inline HTML

  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth callback not yet ported from gateway service",
    },
    { status: 501 }
  );
}
```

#### 7. `apps/memory/src/app/api/connect/oauth/poll/route.ts` — CLI OAuth Polling

```typescript
/**
 * GET /api/connect/oauth/poll
 *
 * Poll for OAuth completion. Port from gateway connections.ts:180
 *
 * NOT tRPC — CLI polling with state token as auth.
 * The state token itself is the secret (cryptographically random nanoid).
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  // TODO: Port from gateway connections.ts:180-196
  // Steps:
  // 1. Read state from query param
  // 2. Check Redis for completion result
  // 3. Return { status: "pending" } or the completion result

  return Response.json(
    {
      status: "not_implemented",
      message: "OAuth poll not yet ported from gateway service",
    },
    { status: 501 }
  );
}
```

### Success Criteria

- [ ] `pnpm --filter @lightfast/memory typecheck` passes
- [ ] All route handlers export the correct HTTP method functions
- [ ] `pnpm --filter @lightfast/memory build` succeeds

---

## Phase 4: Dev Commands and Build Script

### Overview

Wire up the memory app into the monorepo dev workflow.

### Changes Required

#### 1. Root `package.json` — Add dev and build commands

Add to `scripts`:

```json
"dev:memory": "turbo watch dev -F @lightfast/memory --continue",
"build:memory": "turbo run build -F @lightfast/memory"
```

#### 2. Root `package.json` — Add to `dev:app` filter (optional, can defer)

Update the existing `dev:app` script to include memory:

```json
"dev:app": "turbo watch dev --concurrency=15 --filter=@lightfast/www --filter=@lightfast/auth --filter=@lightfast/console --filter=@lightfast/relay --filter=@lightfast/backfill --filter=@lightfast/gateway --filter=@lightfast/memory --continue"
```

This is optional for Phase 4 — `dev:memory` can be run standalone while the app is being built out. Add to `dev:app` once memory is ready for integration testing.

#### 3. Inngest dev server — Add memory URL

Update `apps/console/package.json` `dev:inngest` script to include memory's Inngest endpoint:

```json
"dev:inngest": "npx inngest-cli@latest dev -u http://localhost:3024/api/inngest -u http://localhost:4109/api/inngest -u http://localhost:4112/api/inngest"
```

#### 4. Environment setup

Create `.vercel/.env.development.local` for the memory app (or symlink from console's env file during dev). The memory app needs these vars at minimum:

```
MEMORY_API_KEY=<generate-for-dev>
ENCRYPTION_KEY=<reuse-from-gateway>
DATABASE_URL=<same-as-console>
UPSTASH_REDIS_REST_URL=<same-as-console>
UPSTASH_REDIS_REST_TOKEN=<same-as-console>
BETTERSTACK_SOURCE_TOKEN=<optional>
# Provider vars are optional — only needed when testing specific providers
```

### Success Criteria

- [ ] `pnpm dev:memory` starts Next.js on port 4112
- [ ] `curl http://localhost:4112/api/health` returns `{"status":"ok","service":"memory",...}`
- [ ] `curl http://localhost:4112/api/trpc/` returns a tRPC error (expected — no procedures yet)
- [ ] Inngest dev server discovers the memory app's serve endpoint (0 functions registered)

---

## Phase 5: Vercel Project Configuration

### Overview

Set up the Vercel project for `memory.lightfast.ai`. This is deployment config, not code.

### Steps

1. **Create Vercel project** named `lightfast-memory` linked to the monorepo
2. **Root directory**: `apps/memory`
3. **Framework preset**: Next.js
4. **Build command**: `pnpm build` (uses turbo-ignore for skip detection)
5. **Domain**: `memory.lightfast.ai`
6. **Environment variables**: Copy from gateway + relay + backfill, plus `MEMORY_API_KEY`, `INNGEST_APP_NAME=lightfast-memory`
7. **Inngest**: Configure `lightfast-memory` app in Inngest dashboard, set `INNGEST_SIGNING_KEY`

### Success Criteria

- [ ] Vercel deployment succeeds
- [ ] `https://memory.lightfast.ai/api/health` returns `{"status":"ok",...}`
- [ ] Inngest dashboard shows the `lightfast-memory` app with 0 functions

---

## File Tree Summary

```
api/memory/
  package.json
  tsconfig.json
  turbo.json
  src/
    trpc.ts                          # tRPC init, context, procedures
    root.ts                          # Router composition (stub)
    index.ts                         # Public API surface
    inngest/
      client.ts                      # Inngest client (lightfast-memory)
      index.ts                       # Inngest serve config

apps/memory/
  package.json
  tsconfig.json
  turbo.json
  vercel.json
  next.config.ts
  src/
    env.ts                           # Merged env validation
    app/
      layout.tsx                     # Minimal root layout
      page.tsx                       # Redirect to /api/health
      api/
        health/
          route.ts                   # GET — health check
        trpc/
          [trpc]/
            route.ts                 # GET, POST — tRPC handler
        inngest/
          route.ts                   # GET, POST, PUT — Inngest serve
        ingest/
          [provider]/
            route.ts                 # POST — webhook ingestion (stub)
        connect/
          [provider]/
            authorize/
              route.ts               # GET — OAuth start (stub)
            callback/
              route.ts               # GET — OAuth callback (stub)
          oauth/
            poll/
              route.ts               # GET — CLI OAuth poll (stub)
```

## References

- Console app patterns: `apps/console/package.json`, `apps/console/src/env.ts`, `apps/console/next.config.ts`
- Console tRPC handlers: `apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts`
- Console Inngest handler: `apps/console/src/app/(inngest)/api/inngest/route.ts`
- `@api/app` package: `api/console/package.json`, `api/console/src/index.ts`, `api/console/src/trpc.ts`
- Gateway OAuth routes: `apps/gateway/src/routes/connections.ts`
- Relay webhook routes: `apps/relay/src/routes/webhooks.ts`
- Gateway env (superset pattern): `apps/gateway/src/env.ts`
- Inngest client factory: `packages/inngest/src/client.ts`
- Platform architecture research: `thoughts/shared/research/2026-03-19-platform-trpc-architecture-patterns.md`
