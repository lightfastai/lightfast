# Vercel Integration Slug Environment Variable

## Overview

The Vercel integration authorization route hardcodes `"lightfast-dev"` as the integration slug, causing production users at lightfast.ai to be directed to the development integration on Vercel's marketplace. This plan adds a `VERCEL_INTEGRATION_SLUG` environment variable to `@repo/console-vercel/env`, following the exact pattern already established by `GITHUB_APP_SLUG` in `@repo/console-octokit-github/env`.

## Current State Analysis

**Bug**: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:37` hardcodes:
```typescript
const marketplaceUrl = new URL("https://vercel.com/integrations/lightfast-dev/new");
```

**Result**: Production (lightfast.ai) shows "Lightfast Dev" integration instead of "Lightfast".

**Existing pattern**: GitHub integration already solves this correctly:
- `packages/console-octokit-github/src/env.ts:24` defines `GITHUB_APP_SLUG`
- `apps/console/src/app/(github)/api/github/install-app/route.ts:24` uses `env.GITHUB_APP_SLUG`

## Desired End State

- `VERCEL_INTEGRATION_SLUG` environment variable defined in `@repo/console-vercel/env`
- Authorize route uses `env.VERCEL_INTEGRATION_SLUG` instead of hardcoded string
- Development deploys use `"lightfast-dev"`, production deploys use `"lightfast"`
- Verified via `pnpm lint && pnpm typecheck`

## What We're NOT Doing

- Not changing the OAuth callback flow or token exchange
- Not modifying webhook handling
- Not adding `NEXT_PUBLIC_VERCEL_ENV` detection (using env var per-environment is the established pattern)
- Not changing any UI components

## Implementation Approach

Mirror the `GITHUB_APP_SLUG` pattern exactly. Three files change, one env var added.

## Phase 1: Add Environment Variable and Use It

### Changes Required:

#### 1. Add `VERCEL_INTEGRATION_SLUG` to package env
**File**: `packages/console-vercel/src/env.ts`
**Change**: Add `VERCEL_INTEGRATION_SLUG` server variable with Zod validation

```typescript
server: {
    // Vercel Integration Slug (integration name in marketplace URL)
    // Used for: Marketplace install URL (https://vercel.com/integrations/{slug}/new)
    // Example: "lightfast" (production) or "lightfast-dev" (development)
    VERCEL_INTEGRATION_SLUG: z.string().min(1),

    // Vercel Integration OAuth & Webhooks
    // NOTE: Integration webhooks use the CLIENT_INTEGRATION_SECRET for signature verification,
    // not a separate webhook secret (per Vercel docs)
    VERCEL_CLIENT_SECRET_ID: z.string().min(1).startsWith("oac_"),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
    // Redirect URI for OAuth token exchange - must match Integration Console config
    // In local dev with ngrok: https://your-ngrok-url.ngrok-free.app/api/vercel/callback
    // In production: https://lightfast.ai/api/vercel/callback
    VERCEL_REDIRECT_URI: z.string().url().optional(),
},
```

#### 2. Use env variable in authorize route
**File**: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts`
**Change**: Import `env` and use `VERCEL_INTEGRATION_SLUG` instead of hardcoded string

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateOAuthState } from "@repo/console-oauth/state";
import { env } from "~/env";
```

Replace lines 35-37:
```typescript
// Build Vercel Integration marketplace install URL
const integrationSlug = env.VERCEL_INTEGRATION_SLUG;
const marketplaceUrl = new URL(`https://vercel.com/integrations/${integrationSlug}/new`);
```

#### 3. Add env var to development environment
**File**: `apps/console/.vercel/.env.development.local`
**Change**: Add `VERCEL_INTEGRATION_SLUG=lightfast-dev`

**Note**: Production environment variable `VERCEL_INTEGRATION_SLUG=lightfast` must be set in Vercel dashboard for the production deployment.

### Success Criteria:

#### Automated Verification:
- [ ] Linting passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Console builds: `pnpm build:console`

#### Manual Verification:
- [ ] Dev server starts without env validation errors
- [ ] Clicking "Connect Vercel" redirects to `vercel.com/integrations/lightfast-dev/new` in development
- [ ] After setting `VERCEL_INTEGRATION_SLUG=lightfast` in Vercel production env, production redirects to `vercel.com/integrations/lightfast/new`

## References

- Research: `thoughts/shared/research/2026-02-08-vercel-integration-hardcoded-slug.md`
- GitHub pattern (env): `packages/console-octokit-github/src/env.ts:21-24`
- GitHub pattern (usage): `apps/console/src/app/(github)/api/github/install-app/route.ts:24`
- Bug location: `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts:37`
- Vercel env package: `packages/console-vercel/src/env.ts`
