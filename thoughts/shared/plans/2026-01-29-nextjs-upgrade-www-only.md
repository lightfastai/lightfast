# Next.js 16 Upgrade for apps/www Implementation Plan

## Overview

Upgrade `apps/www` from Next.js 15.5.7 to Next.js 16.1.6 while keeping other apps (console, auth, docs, chat) on Next.js 15.x using pnpm's named catalogs feature. As part of this upgrade, remove Clerk from apps/www since it's not needed for the marketing site.

## Current State Analysis

### Next.js Version
- **Current**: `next: ^15.5.7` via `pnpm-workspace.yaml:24`
- **Target**: `next: ^16.1.6`

### Apps Using Next.js
| App | Location | Current Reference |
|-----|----------|-------------------|
| console | `apps/console/package.json:75` | `catalog:` |
| www | `apps/www/package.json:59` | `catalog:` |
| auth | `apps/auth/package.json:44` | `catalog:` |
| docs | `apps/docs/package.json:40` | `catalog:` |
| chat | `apps/chat/package.json:81` | `catalog:` |

### Clerk Usage in apps/www (to be removed)
| File | Usage | Action |
|------|-------|--------|
| `middleware.ts:1` | `clerkMiddleware`, `createRouteMatcher` | Replace with standard middleware |
| `middleware.ts:73-98` | Auth check and redirect | Remove (not needed) |
| `layout.tsx:9` | `ClerkProvider` import | Remove |
| `layout.tsx:151-182` | `ClerkProvider` wrapper | Remove |
| `env.ts:6,20` | `clerkEnvBase` | Remove |
| `package.json:37` | `@vendor/clerk` dependency | Remove |
| `next.config.ts:27` | `@vendor/clerk` in transpilePackages | Remove |

### Key Discoveries

1. **apps/www is already Next.js 16 async-API ready**:
   - All `cookies()` calls already awaited (`apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:18`)
   - All `params` props typed as `Promise<T>` and awaited
   - All `searchParams` props typed as `Promise<T>` and awaited
   - No code changes required for async APIs

2. **Clerk in www only does one thing**: Redirects authenticated users from `/` to auth app's `/sign-in`. This is unnecessary - authenticated users can navigate to console manually.

3. **Shared packages are compatible**:
   - `packages/console-trpc` already uses `await headers()` ✅
   - `packages/chat-trpc` already uses `await headers()` ✅
   - `vendor/analytics` uses `useSearchParams()` in client component wrapped in Suspense ✅

4. **Third-party dependencies**:
   - `@sentry/nextjs ^10.20.0` - Officially supports Next.js 16 ✅
   - Clerk removal eliminates the compatibility concern entirely

5. **Existing named catalogs pattern** (`pnpm-workspace.yaml:62-71`):
   ```yaml
   catalogs:
     tailwind4:
       tailwindcss: 4.1.11
     zod3:
       zod: ^3.25.76
     zod4:
       zod: ^4.0.0
   ```

## Desired End State

After this plan is complete:
- `apps/www` runs on Next.js 16.1.6
- `apps/www` no longer depends on Clerk
- All other apps (console, auth, docs, chat) remain on Next.js 15.5.7
- Named catalogs `next15` and `next16` exist for future flexibility
- All builds pass and tests pass

### Verification

```bash
# All apps build successfully
pnpm build

# www uses Next.js 16
cd apps/www && pnpm list next | grep 16.1

# www no longer has Clerk
cd apps/www && pnpm list @vendor/clerk  # Should show nothing

# Other apps use Next.js 15
cd apps/console && pnpm list next | grep 15.5
```

## What We're NOT Doing

- ❌ Upgrading console, auth, docs, or chat to Next.js 16
- ❌ Keeping Clerk in apps/www
- ❌ Implementing alternative auth checks in www middleware
- ❌ Upgrading React version (already on 19.2.1)
- ❌ Migrating to Turbopack (already using it via `--turbopack` flag)

## Implementation Approach

1. Remove Clerk from apps/www first (simplifies the upgrade)
2. Add pnpm named catalogs for Next.js versioning
3. Migrate all apps to explicit catalog references
4. Upgrade apps/www to Next.js 16

---

## Phase 1: Remove Clerk from apps/www

### Overview
Remove Clerk dependency from the www app. The only functionality being removed is the redirect of authenticated users from `/` to the auth app - this is unnecessary since users can navigate manually.

### Changes Required

#### 1. apps/www/src/middleware.ts
**File**: `apps/www/src/middleware.ts`
**Changes**: Replace clerkMiddleware with standard Next.js middleware

```typescript
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createSentryCspDirectives,
  createNextjsCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

// =============================================================================
// Security Headers
// =============================================================================

const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(), // Keep for other apps in microfrontends
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);

async function withSecurityHeaders(
  response: NextResponse,
): Promise<NextResponse> {
  const headers = await securityHeaders();
  for (const [key, value] of headers.headers.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

// =============================================================================
// NEMO Composition
// =============================================================================

/**
 * Custom middleware for www-specific logic
 * Sets x-pathname header for SSR components
 */
const wwwMiddleware = (request: NextRequest) => {
  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
};

const composedMiddleware = createNEMO(
  {},
  {
    before: [wwwMiddleware],
  },
);

// =============================================================================
// Main Middleware
// =============================================================================

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  // Run NEMO middleware chain (sets x-pathname, etc.)
  const nemoResponse = await composedMiddleware(req, event);

  // Return with security headers
  return withSecurityHeaders(
    (nemoResponse as NextResponse | null) ?? NextResponse.next(),
  );
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

#### 2. apps/www/src/app/layout.tsx
**File**: `apps/www/src/app/layout.tsx`
**Changes**: Remove ClerkProvider wrapper

Remove import (line 9):
```typescript
// Remove this line
import { ClerkProvider } from "@vendor/clerk/client";
```

Replace the ClerkProvider wrapper (lines 150-183) with just the children:

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/android-chrome-512x512.png`,
    sameAs: [
      siteConfig.links.twitter.href,
      siteConfig.links.github.href,
      siteConfig.links.discord.href,
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${siteConfig.name} – The Memory Layer for Software Teams`,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;

  return (
    <html className={fonts} lang="en" suppressHydrationWarning>
      <head>
        <JsonLd code={organizationSchema} />
        <JsonLd code={websiteSchema} />
      </head>
      <body className={cn("min-h-screen dark font-sans bg-background")}>
        <PrefetchCrossZoneLinksProvider>
          <PostHogProvider>
            {children}
            <Toaster />
            <VercelAnalytics />
            <SpeedInsights />
          </PostHogProvider>
          <PrefetchCrossZoneLinks />
        </PrefetchCrossZoneLinksProvider>
      </body>
    </html>
  );
}
```

Also remove unused imports that were only needed for ClerkProvider:
- Remove `env` import if only used for Clerk config
- Remove `authUrl`, `consoleUrl` imports if only used for Clerk config

#### 3. apps/www/src/env.ts
**File**: `apps/www/src/env.ts`
**Changes**: Remove clerkEnvBase

Remove import (line 6):
```typescript
// Remove this line
import { clerkEnvBase } from "@vendor/clerk/env";
```

Remove from extends array (line 20):
```typescript
extends: [
  vercel(),
  // Remove: clerkEnvBase,
  betterstackEnv,
  sentryEnv,
  // ... rest stays the same
],
```

#### 4. apps/www/package.json
**File**: `apps/www/package.json`
**Changes**: Remove @vendor/clerk dependency

Remove line 37:
```json
// Remove this line
"@vendor/clerk": "workspace:*",
```

#### 5. apps/www/next.config.ts
**File**: `apps/www/next.config.ts`
**Changes**: Remove @vendor/clerk from transpilePackages

Remove from transpilePackages array (line 27):
```typescript
transpilePackages: [
  "@repo/ui",
  "@vendor/seo",
  "@vendor/security",
  "@vendor/analytics",
  "@vendor/email",
  // Remove: "@vendor/clerk",
  "@vendor/inngest",
  "@vendor/observability",
  "@vendor/next",
  "@vendor/upstash",
  "@vendor/cms",
  "@repo/site-config",
  "@repo/email",
  "@repo/lib",
],
```

### Success Criteria

#### Automated Verification:
- [x] Run `pnpm install` from root
- [x] Build www: `pnpm --filter @lightfast/www build`
- [x] Typecheck www: `pnpm --filter @lightfast/www typecheck`
- [ ] Lint www: `pnpm --filter @lightfast/www lint` (pre-existing lint errors, not related to Clerk removal)
- [x] Verify Clerk removed: `cd apps/www && ! pnpm list @vendor/clerk 2>/dev/null`

**Note**: CLERK_SECRET_KEY is kept in env.ts for the early access waitlist API (server action in early-access-actions.ts). Only ClerkProvider and middleware auth were removed.

#### Manual Verification:
- [ ] Start www dev server: `pnpm dev:www`
- [ ] Navigate to `/` - should load without errors
- [ ] Check browser console for any Clerk-related errors
- [ ] Test microfrontends: `pnpm dev:app` - verify zone transitions still work

**Implementation Note**: After completing this phase and all verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Add Named Catalogs for Next.js

### Overview
Add `next15` and `next16` named catalogs to the workspace configuration. This enables per-app version targeting.

### Changes Required

#### 1. pnpm-workspace.yaml
**File**: `pnpm-workspace.yaml`
**Changes**: Add next15 and next16 named catalogs after the existing catalogs section (after line 71)

```yaml
catalogs:
  tailwind4:
    tailwindcss: 4.1.11
    postcss: 8.5.6
    '@tailwindcss/postcss': 4.1.11
    '@tailwindcss/typography': ^0.5.16
  zod3:
    zod: ^3.25.76
  zod4:
    zod: ^4.0.0
  # Add Next.js version catalogs
  next15:
    next: ^15.5.7
  next16:
    next: ^16.1.6
```

### Success Criteria

#### Automated Verification:
- [x] Run `pnpm install` successfully (validates catalog syntax)
- [x] Verify catalogs are recognized: `grep -A2 "next15" pnpm-workspace.yaml`

#### Manual Verification:
- [x] None required for this phase

---

## Phase 3: Migrate Apps to Explicit Catalog References

### Overview
Update all apps and packages to use explicit `catalog:next15` instead of the implicit `catalog:` for Next.js. This prepares for the upgrade and makes version intentions explicit.

### Changes Required

#### 1. apps/console/package.json
**File**: `apps/console/package.json`
**Changes**: Change Next.js reference to explicit catalog

```json
"next": "catalog:next15"
```

#### 2. apps/www/package.json
**File**: `apps/www/package.json:59`
**Changes**: Change Next.js reference to explicit catalog

```json
"next": "catalog:next15"
```

#### 3. apps/auth/package.json
**File**: `apps/auth/package.json`
**Changes**: Change Next.js reference to explicit catalog

```json
"next": "catalog:next15"
```

#### 4. apps/docs/package.json
**File**: `apps/docs/package.json`
**Changes**: Change Next.js reference to explicit catalog

```json
"next": "catalog:next15"
```

#### 5. apps/chat/package.json
**File**: `apps/chat/package.json`
**Changes**: Change Next.js reference to explicit catalog

```json
"next": "catalog:next15"
```

#### 6. Shared packages with Next.js dependencies

**File**: `vendor/next/package.json`
```json
"next": "catalog:next15"
```

**File**: `packages/console-trpc/package.json`
```json
"next": "catalog:next15"
```

**File**: `packages/chat-trpc/package.json`
```json
"next": "catalog:next15"
```

**File**: `vendor/analytics/package.json`
```json
"next": "catalog:next15"
```

**File**: `vendor/clerk/package.json`
```json
"next": "catalog:next15"
```

**File**: `vendor/cms/package.json` (devDependency)
```json
"next": "catalog:next15"
```

**File**: `vendor/seo/package.json` (devDependency)
```json
"next": "catalog:next15"
```

**Note**: `packages/url-utils/package.json` has `next: "*"` as peer dependency - leave as-is.

### Success Criteria

#### Automated Verification:
- [x] Run `pnpm install` successfully
- [ ] Build all apps: `pnpm build` (deferred to Phase 5)
- [ ] Typecheck: `pnpm typecheck` (deferred to Phase 5)
- [ ] Lint: `pnpm lint` (deferred to Phase 5)
- [x] Verify no version changes: `cd apps/www && pnpm list next` should still show 15.5.7

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:app` - verify all zones work (deferred to Phase 5)

**Implementation Note**: This phase should result in NO functional changes - it's purely a refactor for explicit versioning.

---

## Phase 4: Upgrade apps/www to Next.js 16

### Overview
Change `apps/www` to use `catalog:next16`. Since the codebase is already async-API ready and Clerk has been removed, this should be straightforward.

### Changes Required

#### 1. apps/www/package.json
**File**: `apps/www/package.json:59`
**Changes**: Switch to Next.js 16 catalog

```json
"next": "catalog:next16"
```

#### 2. apps/www/next.config.ts - Review (no changes expected)
**File**: `apps/www/next.config.ts`
**Review**: Current config uses only supported options:
- `reactStrictMode: true` ✅
- `transpilePackages` ✅
- `eslint.ignoreDuringBuilds` ✅
- `experimental.optimizeCss` ✅
- `experimental.optimizePackageImports` ✅

No changes needed.

### Success Criteria

#### Automated Verification:
- [x] Run `pnpm install` from root
- [x] Build www: `pnpm --filter @lightfast/www build`
- [x] Typecheck www: `pnpm --filter @lightfast/www typecheck`
- [ ] Lint www: `pnpm --filter @lightfast/www lint` (pre-existing lint errors, not related to upgrade)
- [x] Verify Next.js 16 installed: `cd apps/www && pnpm list next | grep 16.1`

**Note**: Fixed next.config.ts - removed deprecated `eslint` option (no longer supported in Next.js 16) and used `any` type to handle Next.js 15/16 type incompatibility in shared vendor packages.

#### Manual Verification:
- [ ] Start www dev server: `pnpm dev:www`
- [ ] Navigate through all pages and verify no hydration errors
- [ ] Test dynamic routes: `/blog/[slug]`, `/changelog/[slug]`, `/legal/[slug]`
- [ ] Test search params page: `/early-access`
- [ ] Verify cookies work: `/pitch-deck` (uses cookies for preface state)
- [ ] Check console for any deprecation warnings

**Implementation Note**: After completing this phase and all verification passes, pause here for thorough manual testing before declaring success.

---

## Phase 5: Full Build Verification

### Overview
Ensure the entire monorepo still builds correctly with mixed Next.js versions.

### Success Criteria

#### Automated Verification:
- [x] Key app builds pass: www, console, auth, docs (chat has pre-existing vitest issue)
- [ ] Full typecheck: `pnpm typecheck` (chat has pre-existing vitest issue)
- [ ] Full lint: `pnpm lint` (pre-existing lint errors across codebase)
- [x] Verify version isolation:
  ```bash
  cd apps/www && pnpm list next | grep 16.1     # ✓ 16.1.6
  cd apps/console && pnpm list next | grep 15.5 # ✓ 15.5.7
  cd apps/auth && pnpm list next | grep 15.5    # ✓ 15.5.7
  cd apps/docs && pnpm list next | grep 15.5    # ✓ 15.5.7
  cd apps/chat && pnpm list next | grep 15.5    # ✓ 15.5.7
  ```

#### Manual Verification:
- [ ] Test microfrontends: `pnpm dev:app`
- [ ] Navigate between www and console zones
- [ ] Verify no console errors on zone transitions

---

## Testing Strategy

### Unit Tests
No specific unit tests needed - existing tests should continue to pass.

### Integration Tests
- Build verification via CI/CD
- Typecheck verification

### Manual Testing Steps
1. Start `pnpm dev:www` and navigate to:
   - `/` (home page)
   - `/blog` (listing)
   - `/blog/[any-slug]` (dynamic route with params)
   - `/changelog` (listing)
   - `/changelog/[any-slug]` (dynamic route with params)
   - `/legal/terms` (legal pages)
   - `/early-access?email=test@test.com` (searchParams)
   - `/pitch-deck` (cookies usage)
2. Test microfrontends:
   - `pnpm dev:app`
   - Navigate from www to console zone and back
   - Verify no cross-zone errors

## Performance Considerations

- **Turbopack**: Already in use, no changes needed
- **Bundle size**: Removing Clerk should reduce bundle size
- **Cold start**: Turbopack default in Next.js 16 may improve cold starts

## Migration Notes

### Rollback Plan
If issues are found:
1. Revert `apps/www/package.json` to use `catalog:next15`
2. Re-add Clerk if needed (revert Phase 1 changes)
3. Run `pnpm install`
4. Rebuild

### Future Upgrades
Once stability is confirmed, other apps can be upgraded by changing their catalog reference from `catalog:next15` to `catalog:next16`.

## References

- Original research: `thoughts/shared/research/2026-01-29-nextjs-upgrade-www-only.md`
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [pnpm Catalogs Documentation](https://pnpm.io/catalogs)
- Current catalog patterns: `pnpm-workspace.yaml:62-71`
