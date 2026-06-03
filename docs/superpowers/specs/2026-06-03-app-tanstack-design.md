# apps/app-tanstack Design

Status: Draft for user review
Date: 2026-06-03

## Summary

Create `apps/app-tanstack` as a live TanStack Start sibling to the current
Next.js `apps/app`. The new app will exercise the core runtime stack under the
same local development infrastructure without taking traffic from the existing
console app.

The first slice is infrastructure only: scaffold the TanStack app, wire local
dev, observability, request middleware, security headers, environment handling,
and a health endpoint. Product routes, tRPC auth integration, OAuth flows,
Server Action migration, and the MFE traffic switch stay out of scope until this
foundation is stable.

## Goals

- Add `apps/app-tanstack` as `@lightfast/app-tanstack`.
- Run it as a live sibling service through Portless at
  `https://[<wt>.]app-tanstack.lightfast.localhost`.
- Include it in root `pnpm dev` so runtime issues are visible during normal
  development.
- Keep `@lightfast/app` as the default app in `apps/app/microfrontends.json`.
- Reuse the TanStack Start shape already proven by `apps/mcp`.
- Adapt app-specific observability from `apps/app` without importing Next.js
  runtime APIs.
- Establish explicit middleware boundaries for security headers and future Clerk
  auth work.
- Provide a health endpoint with the same monitoring semantics as `apps/app`.

## Non-Goals

- Do not migrate product pages or authenticated workspace routes.
- Do not migrate OAuth, GitHub, connector, native proxy, chat, or Inngest route
  handlers.
- Do not move the tRPC handler into the TanStack app in this slice.
- Do not replace `@lightfast/app` in the MFE mesh.
- Do not remove Next.js dependencies from the existing `apps/app`.
- Do not copy Next.js Server Component, Server Action, or `clerkMiddleware`
  assumptions into TanStack Start.

## Architecture

`apps/app-tanstack` will mirror the app-level conventions used by `apps/mcp`:

- `vite.config.ts` with `tanstackStart()`, `nitro()`, React, aliases, strict
  Portless host/port handling, and Sentry's TanStack Start Vite plugin.
- `src/server.ts` as the server entry, importing a TanStack-compatible Sentry
  bootstrap module and wrapping the Start fetch handler with Sentry.
- `src/client.tsx` as the browser entry, initializing Sentry and hydrating
  `StartClient`.
- `src/router.tsx` with `createRouter`, scroll restoration, generated route tree,
  and Sentry router tracing.
- `src/start.ts` with global request/function middleware.
- `src/routes/__root.tsx` as the document shell and provider root.
- `src/routes/index.tsx` as a minimal console status page.
- `src/routes/api/health.ts` as a server route.
- `src/env.ts` using `@t3-oss/env-core`, because TanStack Start is not Next.js.

The new package will have its own `portless.json`, `turbo.json`,
`vercel.json`, `tsconfig.json`, and `vitest.config.ts`. Public assets and
favicon files can be copied from `apps/app` so browser rendering and health
checks look like the console service rather than the MCP service.

## Local Development

The package name will be `@lightfast/app-tanstack`, with Portless name
`app-tanstack.lightfast`.

The package scripts should follow the TanStack apps already in the repo:

- `dev`: run `vite dev` through Portless and environment injection.
- `dev:next`: alias to `pnpm dev` so root `turbo run dev:next` can start it.
- `build`: run `vite build` with env.
- `preview` and `start`: run Vite preview with env.
- `test`: run Vitest.
- `typecheck`: run `tsc --noEmit`.

Root `pnpm dev` should include `-F @lightfast/app-tanstack`, but the MFE proxy
should continue to route `lightfast-app` to `@lightfast/app`. This keeps the
new app reachable by direct Portless URL while avoiding accidental console
traffic changes.

## Environment

`apps/app-tanstack/src/env.ts` should be derived from the app and MCP env files:

- Use `@t3-oss/env-core` with `clientPrefix: "VITE_"`.
- Extend shared server envs that are not Next-specific, including DB,
  Braintrust, Upstash, and Unkey.
- Add Clerk values through a TanStack-safe adapter rather than the current
  Next-specific env wrapper.
- Accept existing `NEXT_PUBLIC_*` values on the server side for compatibility
  with current `.vercel/.env.development.local` files.
- Expose browser-safe values through `VITE_*` in Vite config.
- Preserve development defaults for app, www, and platform URLs.
- Keep build validation strict for production Sentry source map upload variables
  when source maps are enabled.

Because `@vendor/clerk/env` currently uses `@t3-oss/env-nextjs`, the first
implementation should either avoid extending that env directly or add a small
TanStack-safe Clerk env adapter before using Clerk in the new app. The adapter
must preserve the existing `CLERK_SECRET_KEY` and
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` contracts while exposing a Vite-safe
publishable key to the browser.

## Observability

The TanStack observability baseline comes from `apps/mcp`:

- `@sentry/tanstackstart-react` in Vite, client, server entry, router tracing,
  and global Start middleware.
- Server fetch wrapping with `wrapFetchWithSentry`.
- `instrument.server.mjs` or equivalent server bootstrap imported before the
  Start handler.

The app-specific behavior comes from `apps/app`, adapted without `@sentry/nextjs`:

- Environment-aware trace sample rates.
- Token scrubbing for navigation breadcrumbs.
- Dropping expected client-side tRPC 4xx errors once tRPC is introduced.
- Dropping expected server-side tRPC 4xx and Inngest non-retriable errors once
  those surfaces are introduced.
- Braintrust OTel registration for service name `lightfast-app-tanstack`.
- Extra error data integration where supported by the TanStack Sentry package.

The initial slice should not add Vercel Analytics or Speed Insights unless the
repo already has TanStack-safe wrappers for those packages.

## Middleware

Global middleware should start with:

- Sentry request middleware.
- Sentry function middleware.
- Security header middleware using the existing `@vendor/security` CSP helpers
  where they can run in a Fetch `Request`/`Response` environment.

The current Next proxy cannot be copied directly. It depends on
`NextRequest`, `NextResponse`, `@clerk/nextjs/server`, and
`@vercel/microfrontends/next/middleware`. The TanStack app needs a future Clerk
request-auth adapter with explicit Fetch semantics instead.

The first slice should define the files and middleware extension points, but it
should not implement product route gates. Future route auth must pair UI
guards with server route or server function enforcement, because TanStack route
guards do not protect RPC endpoints by themselves.

## Clerk Integration Boundary

The existing `api/app` auth resolution uses `@vendor/clerk/server`, which
re-exports Next.js Clerk APIs. That is not a valid long-term dependency for
TanStack Start request auth.

The staged plan is:

1. Scaffold the TanStack app without depending on server-side Clerk auth for
   product routes.
2. Add a TanStack-safe Clerk adapter around `@clerk/backend` or another Clerk
   Fetch-compatible primitive.
3. Update `api/app` identity resolution to accept an injected auth resolver or
   a framework-neutral request auth context.
4. Move the TanStack tRPC server route once cookie and native bearer auth both
   resolve through the framework-neutral path.
5. Only then migrate authenticated product routes.

Client-side Clerk components can be evaluated separately, but the first slice
should not assume `@clerk/nextjs` components are safe in Vite without a focused
compatibility check.

## Health Route

`/api/health` should mirror `apps/app`:

- Return JSON with `service: "app-tanstack"`, `status: "ok"`, timestamp, and
  environment.
- If `HEALTH_CHECK_AUTH_TOKEN` is set, require an exact Bearer token match.
- Return `401` for missing or invalid auth.
- Set `Cache-Control: no-store, no-cache, must-revalidate`.

This route is the first server-route validation target because it exercises
environment loading, middleware, response headers, and server routing without
depending on product auth.

## Testing

Initial tests should be focused and low-maintenance:

- Env validation tests for development defaults and required production values.
- Health route tests for unauthenticated, invalid token, valid token, response
  shape, and cache headers.
- Middleware tests for security headers on normal responses.
- A smoke test that route generation and TypeScript compile for the new app.

Broader Playwright or product-route tests should wait until migrated UI and
auth flows exist.

## Rollout

1. Add the sibling app and verify `pnpm --filter @lightfast/app-tanstack
   typecheck`, `test`, and `build`.
2. Add it to root `pnpm dev` and verify the direct Portless URL.
3. Keep the MFE mesh pointing at `@lightfast/app`.
4. Implement Clerk/tRPC integration in a later slice.
5. Migrate small unauthenticated routes first, then authenticated account routes,
   then org-scoped product routes.
6. Switch MFE traffic only after route parity and auth parity are verified.

## Risks

- Clerk server APIs are currently Next-oriented, so copying them into TanStack
  would create a brittle migration. The first slice avoids that dependency.
- TanStack Start is isomorphic by default, so server-only code must stay inside
  server routes, server functions, middleware, or server-only modules.
- Root `pnpm dev` may become noisier after adding another persistent app. The
  app should keep logs concise and fail fast on env misconfiguration.
- Sentry source map validation can block local builds if build-time variables
  are required too aggressively. Local and production validation should follow
  the `apps/mcp` pattern.
- Security middleware may need adaptation from Next response semantics to Fetch
  response semantics.

## Acceptance Criteria

- `apps/app-tanstack` exists and follows the TanStack Start structure used by
  `apps/mcp`.
- `pnpm dev` starts the new app alongside the existing services.
- The direct Portless URL serves the TanStack shell.
- `/api/health` behaves like the existing app health endpoint.
- Observability initializes on client and server without Next.js imports.
- The current `@lightfast/app` MFE routing remains unchanged.
- Focused tests, typecheck, and build pass for `@lightfast/app-tanstack`.
