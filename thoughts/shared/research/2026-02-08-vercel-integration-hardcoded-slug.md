---
date: 2026-02-08T03:10:57.346Z
researcher: jeevanpillay
git_commit: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
branch: main
repository: lightfast
topic: "Vercel Integration Hardcoded Slug Bug"
tags: [research, codebase, vercel, integration, bug, hardcoded-values]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevanpillay
---

# Research: Vercel Integration Hardcoded Slug Bug

**Date**: 2026-02-08T03:10:57.346Z
**Researcher**: jeevanpillay
**Git Commit**: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
**Branch**: main
**Repository**: lightfast

## Research Question

There is a bug in `@apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/page.tsx` where when choosing Vercel at https://lightfast.ai/lightfast/lightfast/sources/connect?provider=vercel, it shows "lightfast-dev" instead of the production integration called "lightfast". Are there hardcoded values instead of using environment variables from `@packages/console-vercel/src/env.ts`?

## Summary

**YES, the Vercel integration slug is hardcoded** in the authorization route. The bug exists in `/apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:37` where the integration slug `"lightfast-dev"` is hardcoded directly in the marketplace URL. The code does not use any environment variables to determine which integration (dev vs production) to use, despite the existence of `@packages/console-vercel/src/env.ts` which contains other Vercel-related environment configuration.

## Detailed Findings

### The Hardcoded Value

**Location**: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:37`

```typescript
// Build Vercel Integration marketplace install URL
// Integration slug from Integration Console: lightfast-dev
const marketplaceUrl = new URL("https://vercel.com/integrations/lightfast-dev/new");
```

The integration slug `"lightfast-dev"` is hardcoded directly in the URL construction. This means:
- In development: Shows "lightfast-dev" ✓ (correct)
- In production: Shows "lightfast-dev" ✗ (incorrect - should show "lightfast")

### OAuth Flow Architecture

The Vercel connector follows this flow:

1. **User clicks "Connect Vercel"** in UI component
   - File: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/vercel-connector.tsx:68-88`
   - Opens popup window to `/api/vercel/authorize?redirect=<path>`

2. **Authorization endpoint redirects to Vercel marketplace**
   - File: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:25-57`
   - Line 37: **Hardcoded "lightfast-dev" slug**
   - Redirects to: `https://vercel.com/integrations/lightfast-dev/new?state=<encoded>`

3. **User authorizes on Vercel**
   - Vercel marketplace shows the integration name based on the URL slug
   - Currently always shows "Lightfast Dev" even in production

4. **Callback receives authorization code**
   - File: `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`
   - Exchanges code for access token using `VERCEL_CLIENT_SECRET_ID` and `VERCEL_CLIENT_INTEGRATION_SECRET`

### Environment Variables Available

**Location**: `packages/console-vercel/src/env.ts:13-32`

The package defines these environment variables:
- `VERCEL_CLIENT_SECRET_ID` - OAuth client ID (format: `oac_*`)
- `VERCEL_CLIENT_INTEGRATION_SECRET` - OAuth client secret
- `VERCEL_REDIRECT_URI` - Optional redirect URI override

**Important**: There is NO environment variable for the integration slug/name. The slug is not configurable via environment variables.

### Environment Variables Usage

The callback route (`apps/console/src/app/(vercel)/api/vercel/callback/route.ts:92`) uses:
```typescript
const clientSecret = env.VERCEL_CLIENT_INTEGRATION_SECRET;
```

The authorize route uses `NODE_ENV` only for cookie security:
```typescript
secure: process.env.NODE_ENV === "production",
```

But it does NOT use any environment variable to determine the integration slug.

### Documentation Shows Two Integrations

**Location**: `docs/examples/connectors/vercel-integration-setup.md:23`

The documentation clearly states there should be two separate integrations:
- **Development**: Name: "Lightfast Dev", Slug: "lightfast-dev"
- **Production**: Name: "Lightfast", Slug: "lightfast"

From the documentation:
```markdown
#### Basic Details
- **Name**: `Lightfast Dev` (or `Lightfast` for production)
- **Category**: `DevTools`
- **URL Slug**: `lightfast-dev` (permanent, cannot be changed)
```

### Why This is a Bug

1. **Production shows dev integration**: When users visit the production site (lightfast.ai) and click "Connect Vercel", they are directed to the "Lightfast Dev" integration on Vercel marketplace
2. **Confusing user experience**: Users see a "dev" integration in production, which appears unprofessional
3. **No environment awareness**: The code doesn't check which environment it's running in (development, preview, production)
4. **Missing configuration**: There's no environment variable or configuration to specify which integration slug to use

### Vercel Environment Detection

The codebase uses `NEXT_PUBLIC_VERCEL_ENV` in other places for environment detection (from the system reminder about SENTRY_ENVIRONMENT). This could be used to determine which integration slug to use:
- `NEXT_PUBLIC_VERCEL_ENV === "production"` → use "lightfast"
- `NEXT_PUBLIC_VERCEL_ENV !== "production"` → use "lightfast-dev"

## Code References

- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:37` - Hardcoded "lightfast-dev" slug
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:48` - Uses NODE_ENV for cookie security only
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts:92` - Uses VERCEL_CLIENT_INTEGRATION_SECRET
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/vercel-connector.tsx:76` - Opens authorize popup
- `packages/console-vercel/src/env.ts:13-32` - Environment variable definitions (no slug variable)
- `docs/examples/connectors/vercel-integration-setup.md:23` - Documents two separate integrations

## Architecture Documentation

### Integration Route Structure

```
apps/console/src/app/(vercel)/
└── api/
    └── vercel/
        ├── authorize/
        │   └── route.ts       # OAuth initiation (hardcoded slug here)
        ├── callback/
        │   └── route.ts       # OAuth callback handler
        └── webhooks/
            └── route.ts       # Webhook event handler
```

### OAuth State Management

The authorization flow uses `@repo/console-oauth` for state management:
- `generateOAuthState()` creates secure state with nonce, timestamp, and redirect path
- State is stored in `vercel_oauth_state` cookie with 10-minute expiry
- `validateOAuthState()` verifies state on callback to prevent CSRF attacks

### Middleware Configuration

The authorize route is marked as public in middleware:
- File: `apps/console/src/middleware.ts:45`
- Pattern: `/api/vercel/authorize` requires no authentication
- This allows the OAuth flow to initiate from unauthenticated state

## Historical Context (from thoughts/)

**Vercel Integration Setup Documentation** (`docs/examples/connectors/vercel-integration-setup.md`)
- Documents the complete setup process for creating Vercel integrations
- Shows that different integration names/slugs are intentional (dev vs production)
- Explains that URL slug is "permanent, cannot be changed" once created
- References both development and production URLs throughout

**Memory Connector Backfill Research** (`thoughts/shared/research/2026-02-06-memory-connector-backfill-architecture-deep-dive.md:61`)
- Documents that authorization redirects to `https://vercel.com/integrations/lightfast-dev/new`
- Notes this is the marketplace install flow, not OAuth authorize endpoint
- No mention of environment-based slug selection

## Related Research

- `thoughts/shared/research/2025-12-10-vercel-integration-research.md` - Original Vercel integration implementation patterns
- `thoughts/shared/research/2026-02-08-vercel-deployment-checks-database-schema-validation.md` - Vercel deployment configuration

## Open Questions

1. Should there be a new environment variable `VERCEL_INTEGRATION_SLUG` added to `@packages/console-vercel/src/env.ts`?
2. Should the code use `NEXT_PUBLIC_VERCEL_ENV` to automatically determine the slug?
3. Are there separate OAuth credentials (CLIENT_SECRET_ID and CLIENT_INTEGRATION_SECRET) for the production "lightfast" integration that need to be configured?
4. Should the integration slug be determined at build time or runtime?
