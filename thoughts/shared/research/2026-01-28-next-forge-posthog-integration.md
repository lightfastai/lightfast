---
date: 2026-01-28T15:44:57+11:00
researcher: Claude
git_commit: ff65906b78caead1463061e06a84630bc364f7a6
branch: feat/pitch-deck-page
repository: lightfastai/lightfast
topic: "Next-Forge PostHog Integration into vendor/analytics"
tags: [research, posthog, analytics, next-forge, vendor-package, worktrees]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Next-Forge PostHog Integration into vendor/analytics

**Date**: 2026-01-28T15:44:57+11:00
**Researcher**: Claude
**Git Commit**: ff65906b78caead1463061e06a84630bc364f7a6
**Branch**: feat/pitch-deck-page
**Repository**: lightfastai/lightfast

## Research Question

How does next-forge implement PostHog, and how can we integrate those patterns into Lightfast's `vendor/analytics` package for `apps/www`, using git worktrees for the integration work?

## Summary

**Key Finding**: Lightfast's `vendor/analytics` package already has a comprehensive PostHog implementation that closely mirrors next-forge's patterns. The existing implementation includes client/server SDKs, reverse proxy configuration, and automatic pageview tracking. The primary differences are in the instrumentation pattern (next-forge uses `instrumentation-client.ts` for initialization) and environment composition approach.

**Worktree Strategy**: Since `apps/www` already has PostHog fully integrated, the worktree approach would be useful for testing improvements or adding new features (like the pitch deck tracking) in isolation before merging.

---

## Detailed Findings

### Next-Forge PostHog Implementation

#### Package Structure
```
packages/analytics/
├── index.ts                    # Client-side re-export: export { posthog as analytics }
├── keys.ts                     # Environment validation with Zod
├── provider.tsx                # AnalyticsProvider (Vercel + Google Analytics)
├── instrumentation-client.ts   # PostHog initialization
├── server.ts                   # Server-side PostHog Node client
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies
```

#### Dependencies (`/tmp/repos/next-forge/packages/analytics/package.json:9-17`)
```json
{
  "@next/third-parties": "16.0.7",
  "@t3-oss/env-nextjs": "^0.13.8",
  "@vercel/analytics": "^1.6.1",
  "posthog-js": "^1.302.2",
  "posthog-node": "^5.17.2",
  "react": "19.2.1",
  "server-only": "^0.0.1",
  "zod": "^4.1.13"
}
```

#### Environment Validation (`/tmp/repos/next-forge/packages/analytics/keys.ts:4-16`)
```typescript
export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_"),
      NEXT_PUBLIC_POSTHOG_HOST: z.url(),
      NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().startsWith("G-").optional(),
    },
    runtimeEnv: {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    },
  });
```

#### Client Initialization - Instrumentation Pattern (`/tmp/repos/next-forge/packages/analytics/instrumentation-client.ts:4-9`)
```typescript
export const initializeAnalytics = () => {
  posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: keys().NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2025-05-24",
  });
};
```

**App Integration** (`/tmp/repos/next-forge/apps/app/instrumentation-client.ts:1-5`):
```typescript
import { initializeAnalytics } from "@repo/analytics/instrumentation-client";
import { initializeSentry } from "@repo/observability/client";

initializeSentry();
initializeAnalytics();
```

Next.js automatically executes `instrumentation-client.ts` on client initialization.

#### Server-Side Client (`/tmp/repos/next-forge/packages/analytics/server.ts:1-11`)
```typescript
import "server-only";
import { PostHog } from "posthog-node";
import { keys } from "./keys";

export const analytics = new PostHog(keys().NEXT_PUBLIC_POSTHOG_KEY, {
  host: keys().NEXT_PUBLIC_POSTHOG_HOST,
  flushAt: 1,        // Immediate flush for serverless
  flushInterval: 0,  // No batching
});
```

#### Reverse Proxy (`/tmp/repos/next-forge/packages/next-config/index.ts:16-34`)
```typescript
async rewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    { source: "/ingest/decide", destination: "https://us.i.posthog.com/decide" },
  ];
},
skipTrailingSlashRedirect: true,
```

#### Provider Component (`/tmp/repos/next-forge/packages/analytics/provider.tsx:6-20`)
```typescript
export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => (
  <>
    {children}
    <VercelAnalytics />
    {NEXT_PUBLIC_GA_MEASUREMENT_ID && <GoogleAnalytics gaId={NEXT_PUBLIC_GA_MEASUREMENT_ID} />}
  </>
);
```

Note: PostHog initialization happens in `instrumentation-client.ts`, NOT in the provider.

#### Event Tracking Examples

**User Webhooks** (`/tmp/repos/next-forge/apps/api/app/webhooks/auth/route.ts:15-33`):
```typescript
const handleUserCreated = (data: UserJSON) => {
  analytics.identify({
    distinctId: data.id,
    properties: {
      email: data.email_addresses.at(0)?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: new Date(data.created_at),
      avatar: data.image_url,
    },
  });

  analytics.capture({ event: "User Created", distinctId: data.id });
};
```

**Payment Webhooks** (`/tmp/repos/next-forge/apps/api/app/webhooks/payments/route.ts:22-40`):
```typescript
const handleCheckoutSessionCompleted = async (data: Stripe.Checkout.Session) => {
  const user = await getUserFromCustomerId(customerId);
  analytics.capture({ event: "User Subscribed", distinctId: user.id });
};
```

**Feature Flags** (`/tmp/repos/next-forge/packages/feature-flags/lib/create-flag.ts:1-20`):
```typescript
const isEnabled = await analytics.isFeatureEnabled(key, userId);
```

---

### Lightfast's Existing vendor/analytics Implementation

#### Package Structure
```
vendor/analytics/
├── src/
│   └── providers/
│       ├── google/index.ts        # GoogleAnalytics re-export
│       ├── posthog/
│       │   ├── client.tsx         # PostHogProvider + usePosthogAnalytics hook
│       │   └── server.ts          # Server-side PostHog Node client
│       └── vercel/index.ts        # VercelAnalytics + SpeedInsights re-exports
├── env.ts                         # posthogEnv with Zod validation
├── package.json
└── tsconfig.json
```

#### Dependencies (`vendor/analytics/package.json:43-54`)
```json
{
  "@next/third-parties": "^15.3.0",
  "@t3-oss/env-nextjs": "catalog:",
  "@vercel/analytics": "^1.5.0",
  "@vercel/speed-insights": "^1.2.0",
  "posthog-js": "^1.194.5",
  "posthog-node": "^4.3.1",
  "server-only": "^0.0.1",
  "zod": "catalog:zod3"
}
```

#### Environment Validation (`vendor/analytics/env.ts:4-15`)
```typescript
export const posthogEnv = createEnv({
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
```

#### Client Provider (`vendor/analytics/src/providers/posthog/client.tsx:11-71`)
```typescript
export function PostHogProvider({ children, baseUrl }: PostHogProviderProps) {
  useEffect(() => {
    posthog.init(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: `${baseUrl}/ingest`,
      ui_host: "https://us.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,  // Manual tracking
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      {children}
      <SuspendedPostHogPageView />
    </PHProvider>
  );
}
```

**Automatic Pageview Tracking** (lines 35-54):
```typescript
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = searchParams?.toString()
        ? `${window.location.origin}${pathname}?${searchParams.toString()}`
        : `${window.location.origin}${pathname}`;
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);
}
```

**Custom Hook** (lines 67-71):
```typescript
export function usePosthogAnalytics() {
  return usePostHog();
}
```

#### Server-Side Client (`vendor/analytics/src/providers/posthog/server.ts:1-14`)
```typescript
import "server-only";
import { PostHog } from "posthog-node";
import { posthogEnv } from "~/env";

export const analytics = new PostHog(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
  host: posthogEnv.NEXT_PUBLIC_POSTHOG_HOST,
  flushAt: 1,        // Immediate flush for serverless
  flushInterval: 0,  // No batching
});
```

#### Reverse Proxy (`vendor/next/src/next-config-builder.ts:27-50`)
```typescript
async rewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    { source: "/ingest/decide", destination: "https://us.i.posthog.com/decide" },
  ];
},
skipTrailingSlashRedirect: true,
```

#### apps/www Integration (`apps/www/src/app/layout.tsx:10-11, 173-177`)
```typescript
import { PostHogProvider } from "@vendor/analytics/posthog-client";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";

// In layout:
<PostHogProvider baseUrl={createBaseUrl()}>
  {children}
  <Toaster />
  <VercelAnalytics />
  <SpeedInsights />
</PostHogProvider>
```

---

### Comparison: Next-Forge vs Lightfast

| Feature | Next-Forge | Lightfast | Notes |
|---------|-----------|-----------|-------|
| **Initialization** | `instrumentation-client.ts` | `useEffect` in Provider | Lightfast uses provider-based init |
| **Pageview Tracking** | Not automatic (no pageview code found) | Automatic via `PostHogPageView` | Lightfast has better pageview tracking |
| **Reverse Proxy** | `/ingest/*` rewrites | `/ingest/*` rewrites | Identical pattern |
| **Server SDK** | `flushAt: 1, flushInterval: 0` | `flushAt: 1, flushInterval: 0` | Identical serverless optimization |
| **Env Validation** | Zod via `@t3-oss/env-nextjs` | Zod via `@t3-oss/env-nextjs` | Identical approach |
| **Person Profiles** | Not configured | `identified_only` | Lightfast more specific |
| **UI Host** | Not configured | `https://us.posthog.com` | Lightfast explicitly set |
| **Google Analytics** | Optional via provider | Separate `./google` export | Lightfast modular |
| **Speed Insights** | Not included | Included via `@vercel/speed-insights` | Lightfast more complete |
| **Custom Hook** | N/A | `usePosthogAnalytics()` | Lightfast has convenience hook |
| **CSP Directives** | Not found | `createAnalyticsCspDirectives()` | Lightfast has security layer |

---

### Worktree Strategy for Integration Work

#### When to Use Worktrees

1. **Testing New Tracking Features** - Develop pitch deck tracking in isolation
2. **SDK Version Upgrades** - Test new `posthog-js` or `posthog-node` versions
3. **Performance Experiments** - A/B test different initialization approaches
4. **Breaking Changes** - Refactor analytics without affecting main development

#### Worktree Setup Commands

```bash
# Create worktree for PostHog improvements
git worktree add ../lightfast-analytics-upgrade feat/posthog-upgrade

# Work in the worktree
cd ../lightfast-analytics-upgrade

# Install dependencies (from worktree root)
pnpm install

# Run www dev server
pnpm dev:www

# When done, remove worktree
git worktree remove ../lightfast-analytics-upgrade
```

#### Directory Structure with Worktree
```
Code/@lightfastai/
├── lightfast/                       # Main worktree (current)
│   └── vendor/analytics/
└── lightfast-analytics-upgrade/     # Feature worktree
    └── vendor/analytics/            # Modify here
```

#### Worktree Benefits for Analytics Work

1. **Isolated Testing**: Test PostHog changes without affecting main development
2. **Parallel Development**: Continue other work in main worktree
3. **Easy Rollback**: Delete worktree if changes don't work out
4. **No Stash/Switch**: Avoid context switching with git stash or branch switching

---

### Patterns from Next-Forge Worth Adopting

#### 1. Instrumentation-Based Initialization
Next-forge uses `instrumentation-client.ts` for initialization which is executed automatically by Next.js.

**Benefit**: Cleaner separation of initialization logic from provider rendering.

**Current Lightfast Pattern** (`PostHogProvider`):
```typescript
useEffect(() => {
  posthog.init(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, { ... });
}, []);
```

**Next-forge Pattern** (could add to `vendor/analytics`):
```typescript
// vendor/analytics/src/instrumentation-client.ts
export const initializeAnalytics = () => {
  posthog.init(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${getBaseUrl()}/ingest`,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
  });
};
```

#### 2. Re-export Pattern
Next-forge exports the PostHog client as `analytics`:

```typescript
// vendor/analytics/index.ts
export { posthog as analytics } from "posthog-js";
```

**Benefit**: Consistent naming across client and server (`analytics.capture()` both places).

#### 3. Composed Environment Keys
Next-forge uses a `keys()` function pattern for environment composition:

```typescript
// In app's env.ts
import { keys as analytics } from "@repo/analytics/keys";

export const env = createEnv({
  extends: [analytics(), ...],
});
```

Lightfast already does this with `extends: [posthogEnv, ...]`.

---

## Code References

### Next-Forge Files
- `/tmp/repos/next-forge/packages/analytics/package.json` - Package dependencies
- `/tmp/repos/next-forge/packages/analytics/keys.ts:4-16` - Environment validation
- `/tmp/repos/next-forge/packages/analytics/instrumentation-client.ts:4-9` - Client initialization
- `/tmp/repos/next-forge/packages/analytics/server.ts:1-11` - Server-side client
- `/tmp/repos/next-forge/packages/analytics/provider.tsx:6-20` - Provider component
- `/tmp/repos/next-forge/packages/next-config/index.ts:16-34` - Reverse proxy config
- `/tmp/repos/next-forge/apps/api/app/webhooks/auth/route.ts:15-72` - User event tracking
- `/tmp/repos/next-forge/apps/api/app/webhooks/payments/route.ts:22-61` - Payment event tracking

### Lightfast Files
- `vendor/analytics/package.json:43-54` - Package dependencies
- `vendor/analytics/env.ts:4-15` - Environment validation
- `vendor/analytics/src/providers/posthog/client.tsx:11-71` - Client provider and pageview
- `vendor/analytics/src/providers/posthog/server.ts:1-14` - Server-side client
- `vendor/analytics/src/providers/vercel/index.ts:1-3` - Vercel Analytics exports
- `vendor/analytics/src/providers/google/index.ts:1-4` - Google Analytics exports
- `vendor/next/src/next-config-builder.ts:27-50` - Reverse proxy config
- `apps/www/src/app/layout.tsx:10-11, 173-177` - Provider integration
- `apps/www/src/env.ts:5, 26` - Environment composition
- `apps/www/src/middleware.ts:19-26` - CSP configuration

---

## Historical Context (from thoughts/)

### Related Documents
- `thoughts/shared/research/2026-01-28-pitch-deck-posthog-tracking-strategy.md` - Tracking strategy for pitch deck with custom events
- `thoughts/shared/plans/2026-01-22-pitch-deck-page.md` - Initial pitch deck implementation
- `thoughts/shared/research/2025-12-10-integration-marketplace-console.md` - PostHog listed as integration

---

## Open Questions

1. **Instrumentation vs Provider Init**: Should Lightfast adopt the `instrumentation-client.ts` pattern from next-forge, or is the current provider-based initialization sufficient?

2. **SDK Version Gap**: Next-forge uses `posthog-js@1.302.2` vs Lightfast's `1.194.5` - is an upgrade needed?

3. **Feature Flags**: Does Lightfast need PostHog feature flags integration like next-forge's `analytics.isFeatureEnabled()`?

4. **Server Event Tracking**: Should Lightfast add webhook event tracking patterns for user/payment events?

5. **Unified Export**: Should we export `posthog as analytics` for consistent client/server API?

---

## External Resources

- [Next-Forge GitHub Repository](https://github.com/vercel/next-forge)
- [PostHog JavaScript SDK Docs](https://posthog.com/docs/libraries/js)
- [PostHog Node SDK Docs](https://posthog.com/docs/libraries/node)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
