---
date: 2026-02-08T01:04:35Z
researcher: jeevan
git_commit: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
branch: main
repository: lightfastai/lightfast
topic: "Integration of Datadog, BetterStack, and Sentry in Lightfast application"
tags: [research, codebase, monitoring, logging, observability, datadog, betterstack, sentry, logtail]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevan
---

# Research: Datadog, BetterStack, and Sentry Logging Integration

**Date**: 2026-02-08T01:04:35Z
**Researcher**: jeevan
**Git Commit**: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
**Branch**: main
**Repository**: lightfastai/lightfast

## Research Question

How are Datadog, BetterStack, and Sentry integrated into the Lightfast application? The user noted that Datadog seems to have better integrations with different apps than BetterStack, and asked about how Sentry's logs integrate.

## Summary

The Lightfast monorepo uses **BetterStack (Logtail)** and **Sentry** for observability, but **Datadog is not integrated**. Datadog appears only in marketing materials, UI components, and research documents as a potential integration showcase or competitive analysis reference.

**BetterStack Integration:**
- Active logging service via `@logtail/next` package wrapped in `@vendor/observability`
- Conditionally enabled for production/preview environments (console.log fallback for development)
- Used across all apps (console, www, chat, auth) via `withBetterStack()` wrapper
- Server-side logger imported from `@vendor/observability/log`
- Client-side logger via `useLogger()` hook from `@vendor/observability/client-log`
- Extensively used in API routes, tRPC procedures, Inngest workflows, and React components

**Sentry Integration:**
- Error tracking and performance monitoring via `@sentry/nextjs` SDK
- Configured through `@vendor/next` and `@vendor/observability` packages
- Conditionally applied only when running on Vercel platform
- Full integration in www, chat, and auth apps (instrumentation files for both server and client)
- Partial integration in console app (error boundaries only, no instrumentation files)
- tRPC middleware integration for capturing RPC errors with input context
- Session replay, performance profiling, and browser tracing features

**Key Finding:** Datadog has zero active integration. BetterStack handles structured logging while Sentry handles error tracking and performance monitoring. The two systems work together with distinct responsibilities in the observability stack.

## Detailed Findings

### Datadog: Marketing Only, No Active Integration

**Current State:**
Datadog is **NOT** integrated into the codebase as an active observability tool. All references are limited to:

1. **Marketing Materials** ([apps/www/src/app/(app)/(marketing)/use-cases/technical-founders/data.ts:152](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/src/app/(app)/(marketing)/use-cases/technical-founders/data.ts#L152))
   - Example query about monitoring tool evaluation mentioning Datadog

2. **UI Integration Showcase** ([apps/www/src/components/integration-showcase.tsx:12](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/src/components/integration-showcase.tsx#L12))
   - Lists Datadog as one of the showcased integrations for prospective customers

3. **Icon Library** ([packages/ui/src/components/integration-icons.tsx:28](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/packages/ui/src/components/integration-icons.tsx#L28))
   - SVG icon component for future integration use

**Search Results:**
- 0 `@datadog/*` or `dd-trace` imports
- 0 Datadog entries in package.json files
- 0 DATADOG environment variables
- 0 active implementation code

**Research References:**
Six research documents mention Datadog in competitive analysis contexts:
- `thoughts/shared/research/2026-02-07-notification-rubric-external-research.md` - Alert fatigue prevention strategies
- `thoughts/shared/research/2026-02-07-arch-eval-pipeline-external-research.md` - DORA metrics monitoring
- `thoughts/shared/research/2026-02-06-web-analysis-unified-slack-bot-architecture.md` - Rootly's Datadog integration
- `thoughts/shared/research/2026-01-29-landing-page-dither-redesign.md` - Integration grid mockup
- `thoughts/shared/research/2025-12-15-web-analysis-postgresql-operations-metrics-design.md` - Time-series aggregation patterns
- `thoughts/shared/research/2025-12-10-cloudflare-integration-research.md` - Technology partner listing

### BetterStack (Logtail): Active Structured Logging

**Architecture:**

BetterStack integration is centralized through the `@vendor/observability` package, which provides a unified logging interface that conditionally routes to either Logtail (production/preview) or console.log (development).

**Core Implementation Files:**

1. **Environment Configuration** ([vendor/observability/src/env/betterstack-env.ts:5-30](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/observability/src/env/betterstack-env.ts#L5-L30))
   - Server variables: `LOGTAIL_SOURCE_TOKEN`, `LOGTAIL_URL`
   - Client variables: `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`, `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN`
   - Environment discriminator: `NEXT_PUBLIC_VERCEL_ENV`

2. **Server-Side Logger** ([vendor/observability/src/log.ts:6-10](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/observability/src/log.ts#L6-L10))
   ```typescript
   const shouldUseBetterStack =
     betterstackEnv.NEXT_PUBLIC_VERCEL_ENV === "production" ||
     betterstackEnv.NEXT_PUBLIC_VERCEL_ENV === "preview";

   export const log = shouldUseBetterStack ? logtail : console;
   ```
   - Single source of truth for logging
   - Zero runtime overhead for environment check
   - Console API compatible interface

3. **Client-Side Logger Hook** ([vendor/observability/src/client-log.ts:30-43](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/observability/src/client-log.ts#L30-L43))
   ```typescript
   export function useLogger(): ClientLogger {
     const logtailLogger = useLogtailLogger();

     return useMemo(() => {
       const isBetterStackConfigured = process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN;

       if (!isBetterStackConfigured) {
         return consoleLogger;
       }

       return logtailLogger;
     }, [logtailLogger]);
   }
   ```
   - React hook for client-side components
   - Memoized to prevent unnecessary re-renders
   - Runtime configuration check

4. **Next.js Config Wrapper** ([vendor/next/src/next-config-builder.ts:137-139](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/next/src/next-config-builder.ts#L137-L139))
   - Exports `withBetterStack()` wrapper function
   - Re-exports from `@logtail/next` package
   - Applied during Next.js configuration build phase

**App Configuration:**

All apps wrap their Next.js config with `withBetterStack()` and extend `betterstackEnv` in their env.ts files:

- **Console App** ([apps/console/next.config.ts:13](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/console/next.config.ts#L13), [apps/console/src/env.ts:16](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/console/src/env.ts#L16))
- **WWW App** ([apps/www/next.config.ts:72](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/next.config.ts#L72), [apps/www/src/env.ts:20](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/src/env.ts#L20))
- **Chat App** ([apps/chat/next.config.ts:15](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/chat/next.config.ts#L15))
- **Auth App** ([apps/auth/next.config.ts:15](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/auth/next.config.ts#L15), [apps/auth/src/env.ts](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/auth/src/env.ts))

**Usage Patterns:**

*Server-Side Usage Examples:*

1. **API Routes** ([apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:85-89](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts#L85-L89))
   ```typescript
   import { log } from "@vendor/observability/log";

   log.info("[Vercel Webhook] Observation capture triggered", {
     workspaceId,
     eventType,
     deploymentId: deployment.id,
   });
   ```

2. **tRPC Procedures** ([api/console/src/router/org/search.ts:49](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/api/console/src/router/org/search.ts#L49))
   ```typescript
   import { log } from "@vendor/observability/log";

   log.info("Search query", { requestId, /* ... */ });
   ```

3. **Inngest Workflows** ([api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts))
   - 18 workflow files use structured logging
   - Examples: backfill-orchestrator, observation-capture, relationship-detection, entity-extraction

*Client-Side Usage Examples:*

4. **React Components** ([apps/chat/src/app/(auth)/_components/sign-up-email-input.tsx:37,60-70](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/chat/src/app/(auth)/_components/sign-up-email-input.tsx))
   ```typescript
   import { useLogger } from "@vendor/observability/client-log";

   const log = useLogger();

   log.info("[SignUpEmailInput] Authentication success", {
     email: data.email,
     timestamp: new Date().toISOString(),
   });
   ```
   - Used extensively in auth components across chat and auth apps
   - 15 client component files use the hook

**Activation Logic:**

- **Server-Side:** Active when `NEXT_PUBLIC_VERCEL_ENV` is "production" or "preview"
- **Client-Side:** Active when `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` is set
- **Development:** Falls back to console.log for local debugging

**File Count Summary:**

| Location | File Count |
|----------|-----------|
| vendor/observability/src/ | 5 implementation files |
| apps/console/src/lib/ & apps/console/src/app/ | 17 files |
| api/console/src/inngest/workflow/ | 18 workflow files |
| api/console/src/router/ | 2 router files |
| apps/auth client components | 7 files |
| apps/chat client components | 8 files |
| App configuration files | 9 files (next.config.ts + env.ts) |

### Sentry: Error Tracking and Performance Monitoring

**Architecture:**

Sentry is integrated across multiple Next.js apps for error tracking, performance monitoring, and session replay. The integration uses the `@sentry/nextjs` SDK (v10.20.0) with centralized configuration through `@vendor/observability` and `@vendor/next` packages.

**Core Configuration:**

1. **Environment Variables** ([vendor/observability/src/env/sentry-env.ts:4-22](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/observability/src/env/sentry-env.ts#L4-L22))
   - Server (build-time): `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
   - Client (runtime): `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VERCEL_ENV`

2. **Build Configuration** ([vendor/next/src/next-config-builder.ts:76-123](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/vendor/next/src/next-config-builder.ts#L76-L123))
   ```typescript
   export const sentryConfig = {
     org: env.SENTRY_ORG,
     project: env.SENTRY_PROJECT,
     authToken: env.SENTRY_AUTH_TOKEN,
     silent: !env.CI,
     widenClientFileUpload: env.VERCEL_ENV === "production",
     reactComponentAnnotation: { enabled: true },
     tunnelRoute: "/monitoring",
     disableLogger: true,
     bundleSizeOptimizations: { excludeDebugStatements: true },
     automaticVercelMonitors: true,
   };
   ```
   - Tunnel route at `/monitoring` to bypass ad-blockers
   - React component annotation for breadcrumbs
   - Automatic Vercel Cron Monitor integration

3. **Conditional Wrapper** ([apps/www/next.config.ts:76-78](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/next.config.ts#L76-L78))
   ```typescript
   if (env.VERCEL) {
     config = withSentry(config);
   }
   ```
   - Only wraps config when running on Vercel platform
   - Prevents Sentry initialization in local development

**Instrumentation Files:**

*Server-Side Instrumentation:*

1. **Simple Pattern** (www, auth apps) - ([apps/www/src/instrumentation.ts:5-29](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/src/instrumentation.ts#L5-L29))
   - Handles both Node.js and Edge runtimes
   - Basic configuration: DSN, environment, tracesSampleRate
   - Exports `onRequestError = captureRequestError` for Next.js

2. **Advanced Pattern** (chat app) - ([apps/chat/src/instrumentation.ts:13-50](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/chat/src/instrumentation.ts#L13-L50))
   - Includes `vercelAIIntegration()` for AI SDK tracing
   - Includes `consoleLoggingIntegration()` to forward console calls
   - `enableLogs: true` to capture console statements
   - Note about removed Node.js profiling due to Turbopack issues

*Client-Side Instrumentation:*

3. **Basic Replay** (www app) - ([apps/www/src/instrumentation-client.ts:11-48](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/www/src/instrumentation-client.ts#L11-L48))
   - Session replay with privacy: `maskAllText: true`, `blockAllMedia: true`
   - Environment-based sampling: 10% production, 100% development
   - Always captures error sessions: `replaysOnErrorSampleRate: 1.0`
   - PostHog analytics initialization

4. **Advanced Profiling** (chat app) - ([apps/chat/src/instrumentation-client.ts:12-51](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/chat/src/instrumentation-client.ts#L12-L51))
   - Includes `browserProfilingIntegration()` for CPU profiling
   - Includes `browserTracingIntegration()` for page navigation
   - `profilesSampleRate: 1.0` for profiling sample rate
   - Console logging integration on client side

**Error Boundaries:**

1. **Global Error Handler** ([apps/console/src/app/global-error.tsx:19-21](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/console/src/app/global-error.tsx#L19-L21))
   ```typescript
   useEffect(() => {
     captureException(error);
   }, [error]);
   ```
   - Identical pattern in console, www, chat, auth apps
   - Captures all unhandled errors at app root
   - Displays error digest for correlation

2. **Route-Level Handler** ([apps/chat/src/app/(auth)/error.tsx:19-32](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/chat/src/app/(auth)/error.tsx#L19-L32))
   ```typescript
   captureException(error, {
     tags: { location: "auth-routes" },
     extra: { errorDigest },
   });
   ```
   - More sophisticated error handling with context
   - Tags for filtering in Sentry dashboard
   - Extra metadata for debugging

**tRPC Middleware Integration:**

([api/console/src/trpc.ts:253-259](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/api/console/src/trpc.ts#L253-L259))
```typescript
import { trpcMiddleware } from "@sentry/core";

const sentryMiddleware = t.middleware(
  trpcMiddleware({ attachRpcInput: true })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);
```
- Base procedure that all other procedures extend
- `attachRpcInput: true` includes procedure input in error context
- Automatically captures all tRPC errors with context

**Clerk Error Handler Integration:**

([apps/console/src/app/lib/clerk/error-handler.ts](https://github.com/lightfastai/lightfast/blob/dec61c9b56ff86bc64ec5b8efedf7ed134c89af2/apps/console/src/app/lib/clerk/error-handler.ts))
- Structured error handling for Clerk auth errors
- Tags for error categorization (rate_limit, account_locked, validation)
- User-friendly message transformation
- Preserves original error as `cause`

**App Integration Summary:**

| App | Sentry Config | Instrumentation | Features |
|-----|--------------|-----------------|----------|
| console | ❌ No wrapper | ❌ No files | ✅ Error boundaries only |
| www | ✅ Conditional | ✅ Server + Client | Session replay, PostHog |
| chat | ✅ Conditional | ✅ Server + Client | Profiling, AI SDK, Braintrust |
| auth | ✅ Conditional | ✅ Server + Client | Basic replay |

**Key Features:**

- **Session Replay:** 10% production sampling, 100% error sessions
- **Performance Monitoring:** 100% trace sampling across all apps
- **CPU Profiling:** Chat app only (100% sampling)
- **Vercel AI SDK Integration:** Chat app server-side
- **Console Logging Integration:** Chat app (forwards console to Sentry)
- **Component Annotation:** React component names in breadcrumbs
- **Source Maps:** Automatic upload in CI with auth token

### Integration Architecture

**How BetterStack and Sentry Work Together:**

1. **Distinct Responsibilities:**
   - **BetterStack:** Structured logging for application events, business logic, and debugging
   - **Sentry:** Error tracking, performance monitoring, and session replay for anomalies

2. **Data Flow:**
   - API requests log structured events to BetterStack (request IDs, user context, operation details)
   - Errors and exceptions are captured by Sentry (stack traces, breadcrumbs, session replay)
   - tRPC procedures use both: BetterStack for query logging, Sentry for error capture

3. **Environment Strategy:**
   - **Development:** BetterStack uses console.log, Sentry disabled
   - **Preview:** BetterStack active, Sentry active (limited replay sampling)
   - **Production:** BetterStack active, Sentry active (10% replay sampling, 100% errors)

4. **Example: API Route with Both Systems:**

   ```typescript
   import { log } from "@vendor/observability/log";
   import { captureException } from "@sentry/nextjs";

   export async function POST(req: Request) {
     const requestId = generateId();

     // BetterStack: Log request start
     log.info("[API] Processing request", { requestId, endpoint: "/api/search" });

     try {
       const result = await performSearch(req);

       // BetterStack: Log successful completion
       log.info("[API] Request completed", { requestId, resultCount: result.length });

       return Response.json(result);
     } catch (error) {
       // BetterStack: Log error details for debugging
       log.error("[API] Request failed", { requestId, error });

       // Sentry: Capture exception with context
       captureException(error, {
         tags: { endpoint: "/api/search", requestId },
         extra: { requestBody: await req.json() },
       });

       return Response.json({ error: "Search failed" }, { status: 500 });
     }
   }
   ```

5. **Vendor Abstraction Pattern:**
   - All third-party integrations wrapped in `@vendor/*` packages
   - Consuming code never imports `@logtail/next` or `@sentry/nextjs` directly (except instrumentation files)
   - Centralized configuration and environment handling
   - Easy to swap implementations without changing application code

### App Integration Patterns

**Pattern 1: Console App - BetterStack Only**
- No Sentry wrapper in next.config.ts
- No instrumentation files
- Uses BetterStack extensively in API routes and workflows
- Has global-error.tsx with `captureException` (but Sentry not initialized)
- Likely relies on Vercel platform error reporting

**Pattern 2: WWW App - Full Stack**
- Conditional Sentry wrapper (Vercel only)
- BetterStack always enabled
- PostHog analytics integration
- Both server and client instrumentation
- Session replay with privacy masking
- Used for marketing site with high polish

**Pattern 3: Chat App - Advanced Monitoring**
- Conditional Sentry wrapper (Vercel only)
- BetterStack always enabled
- Vercel AI SDK integration with Sentry
- Browser profiling for performance optimization
- Braintrust integration for AI-specific logging
- Console removal in production (keeps error/warn)
- Most sophisticated observability setup

**Pattern 4: Auth App - Security Focused**
- Conditional Sentry wrapper (Vercel only)
- BetterStack always enabled
- Client-side logging for auth flows
- Clerk error handler with Sentry integration
- Session replay for debugging auth issues

**Pattern 5: API/Console - Backend Heavy**
- Uses BetterStack for structured logging
- Sentry tRPC middleware for error capture
- Inngest workflows with built-in logger
- Console logging with structured prefixes
- No direct Sentry usage (relies on middleware)

## Code References

### BetterStack Core
- `vendor/observability/src/log.ts:6-10` - Server-side logger export
- `vendor/observability/src/client-log.ts:30-43` - Client-side logger hook
- `vendor/observability/src/env/betterstack-env.ts:5-30` - Environment schema
- `vendor/next/src/next-config-builder.ts:137-139` - Next.js config wrapper

### BetterStack Usage (Sample)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:85-89` - API route logging
- `api/console/src/router/org/search.ts:49` - tRPC procedure logging
- `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts` - Workflow logging
- `apps/chat/src/app/(auth)/_components/sign-up-email-input.tsx:37,60-70` - Client component logging

### Sentry Core
- `vendor/observability/src/env/sentry-env.ts:4-22` - Environment schema
- `vendor/next/src/next-config-builder.ts:76-123` - Build configuration
- `apps/www/src/instrumentation.ts:5-29` - Server instrumentation
- `apps/www/src/instrumentation-client.ts:11-48` - Client instrumentation
- `apps/chat/src/instrumentation.ts:13-50` - Server with AI SDK integration
- `apps/chat/src/instrumentation-client.ts:12-51` - Client with profiling

### Sentry Usage
- `apps/console/src/app/global-error.tsx:19-21` - Global error boundary
- `apps/chat/src/app/(auth)/error.tsx:19-32` - Route error handler with tags
- `api/console/src/trpc.ts:253-259` - tRPC middleware integration
- `apps/console/src/app/lib/clerk/error-handler.ts` - Clerk error handler

### Configuration Files
- `apps/console/next.config.ts:13` - BetterStack only
- `apps/www/next.config.ts:72,76-78` - BetterStack + conditional Sentry
- `apps/chat/next.config.ts:15,128-130` - BetterStack + conditional Sentry + console removal
- `apps/auth/next.config.ts:15,31-33` - BetterStack + conditional Sentry

## Architecture Documentation

### Vendor Package Pattern

All third-party integrations follow a consistent abstraction pattern:

1. **Environment Schema** (`@vendor/observability/env/*-env.ts`)
   - Uses `@t3-oss/env-nextjs` for type-safe validation
   - Defines server and client variables
   - Can be composed via `extends` in app-level env files

2. **Implementation Package** (`@vendor/observability/src/*.ts`)
   - Wraps third-party SDK with application-specific logic
   - Provides drop-in replacement interface
   - Handles environment-based behavior

3. **Next.js Config Wrapper** (`@vendor/next/src/next-config-builder.ts`)
   - Exports wrapper functions for Next.js config
   - Centralizes plugin configuration
   - Type-safe composition pattern

4. **App-Level Usage**
   - Apps extend env schemas in their env.ts
   - Apps apply wrappers in next.config.ts
   - Apps import from `@vendor/*` packages (never from third-party directly)

### Logging Strategy

**Structured Logging Format:**
```typescript
log.info("[Component] Action description", {
  field1: value1,
  field2: value2,
  timestamp: new Date().toISOString(),
});
```

**Prefix Conventions:**
- `[Component]` - Application component (e.g., `[BackfillOrchestrator]`, `[SignUpEmailInput]`)
- `>>> tRPC` - tRPC context creation
- `[TRPC]` - tRPC timing middleware
- `[M2M Auth]` - Machine-to-machine authentication

**Log Levels:**
- `debug()` - Verbose debugging information
- `info()` - Normal operational events
- `warn()` - Warning conditions
- `error()` - Error conditions requiring attention

### Error Handling Strategy

**Layered Error Capture:**

1. **Global Level:** Next.js global-error.tsx captures all unhandled errors
2. **Route Level:** Next.js error.tsx captures route-specific errors with context
3. **Middleware Level:** tRPC middleware captures procedure errors with input
4. **Application Level:** Try/catch blocks with structured logging

**Error Context Enrichment:**

- Request IDs for tracing across systems
- User/org context from authentication middleware
- Procedure input (tRPC) or request body (API routes)
- Component location tags for filtering
- Timestamps and environment information

**Error Flow:**
```
Application Error
    ↓
Try/Catch Block
    ↓ (if caught)
log.error() + captureException()
    ↓
BetterStack (structured context) + Sentry (stack trace + replay)
    ↓ (if uncaught)
Error Boundary (global or route)
    ↓
captureException() → Sentry
```

### Environment-Based Behavior

| Environment | BetterStack | Sentry | Console Removal |
|-------------|-------------|--------|-----------------|
| development | console.log | ❌ Disabled | ❌ Disabled |
| preview     | ✅ Logtail  | ✅ Enabled | ❌ Disabled |
| production  | ✅ Logtail  | ✅ Enabled | ✅ Enabled (chat only) |

**Rationale:**
- Development uses console.log for instant feedback in terminal
- Preview enables both systems for pre-production testing
- Production uses full observability stack with optimized logging

### Integration with Other Systems

**PostHog Analytics:**
- Initialized in www app's `instrumentation-client.ts`
- Proxied through `/ingest` route to bypass ad-blockers
- Separate from error tracking (user behavior vs. technical errors)

**Vercel AI SDK:**
- Integrated with Sentry via `vercelAIIntegration()` in chat app
- Tracks AI streaming operations and token usage
- Captures AI-specific errors with context

**Braintrust:**
- Separate AI-specific logging platform in chat app
- Used alongside Sentry for comprehensive AI observability
- Focuses on prompt performance and model behavior

**Inngest:**
- Workflows use both BetterStack logger and Inngest's built-in logger
- BetterStack for business logic events
- Inngest logger for workflow-specific events (correlated by run ID)

**Clerk:**
- Custom error handler wraps Clerk errors
- Captures to Sentry with structured tags (rate_limit, account_locked)
- Transforms technical errors to user-friendly messages

## Historical Context (from thoughts/)

### Sentry Integration History
- `thoughts/shared/research/2025-12-10-sentry-integration-research.md` - Initial integration research covering OAuth flow, webhooks, API endpoints
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` - Detailed pipeline design, webhook verification, event transformation

### Monitoring Best Practices Research
- `thoughts/shared/research/2026-02-07-notification-rubric-external-research.md` - Extensive research on Datadog, New Relic, and Sentry alert fatigue prevention:
  - Datadog: 80% of alerts may be irrelevant, evaluation windows, composite monitors
  - Event correlation: Consolidated 4,000 alerts into single notification
  - Automated remediation workflows

### Infrastructure and Deployment
- `thoughts/shared/research/2026-02-08-vercel-deployment-checks-database-schema-validation.md` - Vercel deployment configuration, pre-deployment validation, Sentry env integration
- `thoughts/shared/research/2026-01-31-next-js-vercel-optimization-apps-www.md` - Next.js optimization with Sentry mentions

### Startup Tools Analysis
- `thoughts/shared/research/2026-02-06-startup-tools-webhook-analysis.md` - BetterStack (Logtail) in Category 7: Monitoring & Logging with webhook capabilities
- `thoughts/shared/research/2026-02-06-startup-tools-webhook-integration.md` - Webhook event inventory and cross-tool identity mapping

### Monitoring Philosophy
Research documents distinguish between:
- **Observability stack tools** (Sentry, Datadog, New Relic) - Focus on anomaly detection and system health
- **Dev stack notifications** (GitHub, Linear, Slack) - Focus on workflow events and collaboration

## Related Research

- `thoughts/shared/research/2025-12-10-sentry-integration-research.md` - Sentry OAuth and webhook integration
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` - Sentry data pipeline architecture
- `thoughts/shared/research/2026-02-07-notification-rubric-external-research.md` - Alert fatigue prevention (Datadog, Sentry best practices)
- `thoughts/shared/research/2026-02-06-startup-tools-webhook-analysis.md` - BetterStack webhook capabilities
- `thoughts/shared/research/2026-02-08-vercel-deployment-checks-database-schema-validation.md` - Vercel deployment with Sentry
- `thoughts/shared/plans/2026-02-07-notification-rubric-implementation.md` - Notification system design
- `thoughts/shared/plans/2026-02-07-notifications-webhooks-implementation.md` - Webhooks implementation plan

## Conclusion

The Lightfast application uses a **dual observability stack** with BetterStack (Logtail) for structured application logging and Sentry for error tracking and performance monitoring. Datadog is not integrated and only appears in marketing materials and competitive research.

**BetterStack strengths in this implementation:**
- Simple, unified API (console-compatible interface)
- Conditional environment-based routing (production/preview vs development)
- Extensive usage across all apps (57+ files)
- Centralized vendor abstraction
- Both server-side and client-side logging
- Structured logging with consistent format

**Sentry strengths in this implementation:**
- Comprehensive error tracking with session replay
- Performance monitoring and CPU profiling
- Tight Next.js integration (instrumentation, error boundaries)
- tRPC middleware for RPC error capture
- Vercel AI SDK integration for AI-specific tracing
- Source map uploads for symbolic stack traces
- Ad-blocker bypass via tunnel route

**Why this architecture makes sense:**
- BetterStack handles high-volume application events (every API call, workflow step, user action)
- Sentry focuses on exceptions and performance anomalies (lower volume, higher signal)
- Clear separation of concerns prevents log overload in either system
- Both systems provide different types of actionable insights
- Vendor abstraction makes it easy to swap implementations if needed

**Regarding Datadog vs BetterStack integrations:** The user's observation that "Datadog just has better integrations with different apps than BetterStack" is accurate in the general market, but irrelevant to this codebase since Datadog is not used. BetterStack's integration in this monorepo is comprehensive and well-designed, covering all necessary logging points across apps, APIs, and workflows. The vendor abstraction pattern means switching to Datadog would primarily require changing the `@vendor/observability` implementation while keeping all application code unchanged.
