# Sentry Gap: Add Missing Projects for Hono Services

## Overview

Three Hono-based Vercel serverless apps (`gateway`, `connections`, `backfill`) have Sentry error-capture middleware wired up but **no Sentry project, no DSN, and no `Sentry.init()` call** — meaning all `captureException`/`captureMessage` calls are silently dropped.

## Current State Analysis

### What exists in Sentry (5 projects, all `javascript-nextjs`):

| Sentry Project | Slug | App |
|---|---|---|
| lightfast-auth | `lightfast-auth` | `apps/auth` |
| lightfast-deus | `lightfast-console` | `apps/console` |
| lightfast-www | `lightfast-www` | `apps/www` |
| lightfast-chat | `lightfast-chat` | `apps/chat` |
| lightfast-docs | `lightfast-docs` | `apps/docs` |

### What's missing (3 Hono apps on Vercel serverless):

| App | Service Tag | Has Middleware | Has `Sentry.init()` | Has DSN Env Var |
|---|---|---|---|---|
| `apps/gateway` | `gateway` | Yes (`src/middleware/sentry.ts`) | **No** | **No** |
| `apps/connections` | `connections` | Yes (`src/middleware/sentry.ts`) | **No** | **No** |
| `apps/backfill` | `backfill` | Yes (`src/middleware/sentry.ts`) | **No** | **No** |

### Key Discoveries:
- All 3 apps use `@sentry/core` (catalog: `^10.20.0`), not `@sentry/nextjs`
- All 3 have identical middleware pattern: `Sentry.withScope` → tag with service/method/path/requestId → `captureException`/`captureMessage`
- Gateway exports `runtime: "edge"` (`apps/gateway/src/index.ts:2`); connections and backfill are Node.js serverless
- All 3 are deployed as Vercel serverless functions (confirmed by `vercel.json`)
- None have `SENTRY_DSN` in their env schema or `turbo.json` passThroughEnv
- The `@sentry/cli` npm package is in the pnpm catalog's `onlyDevDependencies` list

## Desired End State

All 3 Hono services report errors to dedicated Sentry projects. Verification:
1. Each app has a Sentry project with a DSN
2. `Sentry.init()` is called before middleware processes requests
3. A test error sent via the app produces an event in the corresponding Sentry project

## What We're NOT Doing

- No source map uploads (can be added later with `@sentry/cli` build integration)
- No performance tracing (`tracesSampleRate: 0`) — just error capture
- No Sentry Spotlight for dev (these are API services, not UI apps)
- No changes to the existing middleware — it's already correct, just needs `init()` to activate it

## Implementation Approach

Use the `sentry` CLI to create 3 projects via the API, then add `Sentry.init()` and DSN env wiring in each app.

## Phase 1: Create Sentry Projects

### Overview
Create 3 new Sentry projects under the `lightfast` team using the Sentry API.

### Steps:

```bash
# Create lightfast-gateway
sentry api teams/lightfast/lightfast/projects/ \
  -X POST \
  -F name=lightfast-gateway \
  -F slug=lightfast-gateway \
  -F platform=javascript

# Create lightfast-connections
sentry api teams/lightfast/lightfast/projects/ \
  -X POST \
  -F name=lightfast-connections \
  -F slug=lightfast-connections \
  -F platform=javascript

# Create lightfast-backfill
sentry api teams/lightfast/lightfast/projects/ \
  -X POST \
  -F name=lightfast-backfill \
  -F slug=lightfast-backfill \
  -F platform=javascript
```

Note: Platform is `javascript` (not `javascript-nextjs`) since these are Hono/serverless, not Next.js.

### Get DSNs:

```bash
# After creation, retrieve DSNs
sentry api projects/lightfast/lightfast-gateway/keys/ | jq '.[0].dsn.public'
sentry api projects/lightfast/lightfast-connections/keys/ | jq '.[0].dsn.public'
sentry api projects/lightfast/lightfast-backfill/keys/ | jq '.[0].dsn.public'
```

### Success Criteria:

#### Automated Verification:
- [ ] `sentry projects --json | jq '[.data[].slug]'` lists all 8 projects including the 3 new ones
- [ ] Each new project has a DSN key retrievable via the API

#### Manual Verification:
- [ ] Projects visible in Sentry web UI under the `lightfast` team

**Implementation Note**: After completing this phase, record the 3 DSN values. They are needed for Phase 2.

---

## Phase 2: Add `Sentry.init()` to Each Hono App

### Overview
Add a `sentry-init.ts` module to each app that calls `Sentry.init()` at module load time, and import it at the top of `app.ts` (before middleware).

### Changes Required:

#### 1. Gateway — `apps/gateway/src/sentry-init.ts` (new file)
```typescript
import * as Sentry from "@sentry/core";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  debug: false,
});
```

#### 2. Gateway — `apps/gateway/src/app.ts` (add import)
```typescript
import "./sentry-init.js"; // must be first
import { Hono } from "hono";
// ... rest unchanged
```

#### 3. Gateway — `apps/gateway/src/env.ts` (add SENTRY_DSN)
Add `SENTRY_DSN: z.string().url().optional()` to the `server` schema and `runtimeEnv`.

Note: `optional()` because the init file uses `process.env` directly (Sentry silently no-ops without a DSN, which is fine for local dev without Sentry). The env schema documents its existence for turbo passthrough.

#### 4. Gateway — `apps/gateway/turbo.json` (add passthrough)
Add `"SENTRY_DSN"` to `passThroughEnv` array.

#### 5–8. Repeat identical pattern for `apps/connections` and `apps/backfill`

Connections: same changes to `src/sentry-init.ts`, `src/app.ts`, `src/env.ts`, `turbo.json`
Backfill: same changes to `src/sentry-init.ts`, `src/app.ts`, `src/env.ts`, `turbo.json`

### Success Criteria:

#### Automated Verification:
- [ ] All apps build: `pnpm turbo run build --filter=@lightfast/gateway --filter=@lightfast/connections --filter=@lightfast/backfill`
- [ ] Lint passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Existing tests pass: `pnpm turbo run test --filter=@lightfast/gateway --filter=@lightfast/connections --filter=@lightfast/backfill`

#### Manual Verification:
- [ ] Each app's `sentry-init.ts` imports before `app.ts` middleware

---

## Phase 3: Configure Environment Variables in Vercel

### Overview
Add the `SENTRY_DSN` env var to each Vercel project.

### Steps:
1. Go to each Vercel project's Settings → Environment Variables
2. Add `SENTRY_DSN` with the DSN from Phase 1
3. Set for all environments (Production, Preview, Development)

### Success Criteria:

#### Manual Verification:
- [ ] Deploy each service and trigger a test error
- [ ] Error appears in the correct Sentry project within 30 seconds
- [ ] Error has correct tags: `service`, `http.method`, `http.path`, `request_id`

---

## Testing Strategy

### Smoke Test (post-deploy):
For each service, trigger a 500 via an invalid request or test endpoint, then verify the error appears in the Sentry project with the correct service tag and request context.

### Local Dev:
With no `SENTRY_DSN` set locally, `Sentry.init()` with `dsn: undefined` silently no-ops. No impact on local development workflow.

## References

- Existing Next.js Sentry init: `apps/console/src/instrumentation.ts`
- Existing Hono middleware: `apps/gateway/src/middleware/sentry.ts`
- Sentry `@sentry/core` docs for `init()`: compatible with edge/serverless runtimes
- Catalog version: `@sentry/core: ^10.20.0` in `pnpm-workspace.yaml:54`
