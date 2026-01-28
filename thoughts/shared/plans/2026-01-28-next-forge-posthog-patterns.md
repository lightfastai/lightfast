# Next-Forge PostHog Patterns Adoption Implementation Plan

## Overview

Adopt next-forge's PostHog implementation patterns into Lightfast's `vendor/analytics` package to improve initialization architecture, provide consistent naming across client/server, and upgrade to the latest PostHog SDK version.

## Current State Analysis

### Existing Implementation (`vendor/analytics`)

Lightfast already has a comprehensive PostHog implementation:

- **Client Provider**: `vendor/analytics/src/providers/posthog/client.tsx`
  - Initialization via `useEffect` in `PostHogProvider`
  - Manual pageview tracking via `PostHogPageView` component
  - `usePosthogAnalytics()` hook for accessing PostHog client

- **Server Client**: `vendor/analytics/src/providers/posthog/server.ts`
  - Serverless-optimized with `flushAt: 1, flushInterval: 0`
  - Exported as `analytics`

- **Environment**: `vendor/analytics/env.ts`
  - Zod validation for `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

- **Reverse Proxy**: `vendor/next/src/next-config-builder.ts:27-49`
  - `/ingest/*` routes to PostHog US endpoint

### Key Discoveries

- `vendor/analytics/src/providers/posthog/client.tsx:18-25` - Initialization happens in `useEffect`, which differs from next-forge's instrumentation pattern
- `vendor/analytics/package.json:49` - Using `posthog-js@^1.194.5` (next-forge uses `1.302.2`)
- `apps/www/src/instrumentation-client.ts` exists but only initializes Sentry, not PostHog
- Server client already exports as `analytics` matching next-forge pattern
- CSP directives already configured in `vendor/security/src/csp/analytics.ts`

## Desired End State

After this implementation:

1. **Instrumentation-based initialization**: PostHog initializes via `instrumentation-client.ts` instead of provider's `useEffect`
2. **Consistent naming**: Client-side exports `posthog as analytics` for unified API
3. **SDK upgrade**: Latest `posthog-js` and `posthog-node` versions
4. **Provider simplification**: `PostHogProvider` only provides context, no initialization logic
5. **Backwards compatibility**: Existing `usePosthogAnalytics()` hook continues to work

### Verification

- `apps/www` PostHog tracking continues to work (pageviews captured)
- No TypeScript errors in vendor/analytics or apps/www
- Build succeeds without warnings
- PostHog events visible in dashboard

## What We're NOT Doing

- **NOT** adding pitch deck tracking (separate plan)
- **NOT** adding feature flags integration
- **NOT** changing CSP configuration (already complete)
- **NOT** modifying reverse proxy configuration (already matches next-forge)
- **NOT** adding Google Analytics support (already exists separately)

## Implementation Approach

The implementation follows next-forge's architecture:
1. Create instrumentation initialization function
2. Update provider to be context-only
3. Add client re-export for consistent naming
4. Upgrade SDK versions
5. Update apps to use new instrumentation pattern

---

## Phase 1: Add Instrumentation Initialization

### Overview

Create an instrumentation-based initialization function that can be called from `instrumentation-client.ts` in each app, following next-forge's pattern.

### Changes Required

#### 1. Create instrumentation-client.ts export

**File**: `vendor/analytics/src/providers/posthog/instrumentation-client.ts` (new file)

```typescript
import posthog from "posthog-js";
import { posthogEnv } from "~/env";

/**
 * Initialize PostHog analytics.
 * Call this from your app's instrumentation-client.ts file.
 *
 * @param options.baseUrl - Base URL for the app (used to construct /ingest proxy path)
 */
export const initializePostHogAnalytics = (options: { baseUrl: string }) => {
  if (typeof window === "undefined") return;

  posthog.init(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${options.baseUrl}/ingest`,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // Manual tracking via PostHogPageView
  });
};
```

#### 2. Add package.json export

**File**: `vendor/analytics/package.json`

Add new export entry after line 12:

```json
"./posthog-instrumentation-client": "./src/providers/posthog/instrumentation-client.ts",
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] New file exists at correct path

#### Manual Verification:
- [ ] Import resolves correctly from consuming apps

---

## Phase 2: Add Client Re-export

### Overview

Export the PostHog client as `analytics` for consistent naming across client and server code.

### Changes Required

#### 1. Create client index export

**File**: `vendor/analytics/src/providers/posthog/index.ts` (new file)

```typescript
/**
 * Re-export posthog as analytics for consistent naming.
 * Use this for custom event tracking after initialization.
 *
 * @example
 * import { analytics } from "@vendor/analytics/posthog";
 * analytics.capture("my_event", { property: "value" });
 */
export { default as analytics } from "posthog-js";
```

#### 2. Add package.json export

**File**: `vendor/analytics/package.json`

Add new export entry:

```json
"./posthog": {
  "types": "./src/providers/posthog/index.ts",
  "default": "./src/providers/posthog/index.ts"
},
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Import `analytics` from `@vendor/analytics/posthog` works correctly

---

## Phase 3: Simplify PostHogProvider

### Overview

Remove initialization logic from the provider since it will now happen in instrumentation. The provider becomes a pure context wrapper.

### Changes Required

#### 1. Update PostHogProvider component

**File**: `vendor/analytics/src/providers/posthog/client.tsx`

Replace lines 11-33 with:

```typescript
interface PostHogProviderProps {
  children: React.ReactNode;
}

/**
 * PostHog context provider.
 *
 * IMPORTANT: PostHog must be initialized via initializePostHogAnalytics()
 * in your app's instrumentation-client.ts BEFORE this provider mounts.
 *
 * This provider:
 * - Wraps children in PostHog React context
 * - Renders automatic pageview tracking component
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
  return (
    <PHProvider client={posthog}>
      {children}
      <SuspendedPostHogPageView />
    </PHProvider>
  );
}
```

Note: Remove `baseUrl` prop - no longer needed since initialization happens in instrumentation.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Provider still renders correctly with pageview tracking

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Upgrade PostHog SDK Versions

### Overview

Upgrade `posthog-js` and `posthog-node` to latest versions matching next-forge.

### Changes Required

#### 1. Update package.json dependencies

**File**: `vendor/analytics/package.json`

Update lines 49-50:

```json
"posthog-js": "^1.302.2",
"posthog-node": "^5.17.2",
```

#### 2. Run pnpm install

```bash
pnpm install
```

### Success Criteria

#### Automated Verification:
- [x] Install completes without errors: `pnpm install`
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Check for any breaking changes in PostHog changelogs
- [ ] PostHog events still captured correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Update apps/www to Use Instrumentation

### Overview

Update `apps/www` to initialize PostHog via instrumentation-client.ts instead of through the provider.

### Changes Required

#### 1. Update instrumentation-client.ts

**File**: `apps/www/src/instrumentation-client.ts`

Add PostHog initialization after Sentry:

```typescript
import {
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
} from "@sentry/nextjs";
import { initializePostHogAnalytics } from "@vendor/analytics/posthog-instrumentation-client";

import { env } from "~/env";
import { createBaseUrl } from "~/lib/base-url";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  debug: false,
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Initialize PostHog analytics
initializePostHogAnalytics({
  baseUrl: createBaseUrl(),
});

export const onRouterTransitionStart = captureRouterTransitionStart;
```

#### 2. Update root layout

**File**: `apps/www/src/app/layout.tsx`

Update the PostHogProvider usage (remove baseUrl prop):

Change line 173 from:
```typescript
<PostHogProvider baseUrl={createBaseUrl()}>
```

To:
```typescript
<PostHogProvider>
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:www` (pre-existing build issue with `Icons.loader`)

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:www`
- [ ] Navigate to pages and verify pageviews appear in PostHog
- [ ] Verify no console errors related to PostHog

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Clean Up and Documentation

### Overview

Remove deprecated exports, clean up unused code, and update documentation.

### Changes Required

#### 1. Remove deprecated logger export

**File**: `vendor/analytics/package.json`

Remove lines 13-16 (the broken logger export):

```json
"./logger": {
  "types": "./src/providers/logger/index.ts",
  "default": "./src/providers/logger/index.ts"
},
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds for all apps using @vendor/analytics

#### Manual Verification:
- [x] Verify no apps were importing the logger export

---

## Testing Strategy

### Unit Tests

No unit tests required - this is infrastructure/integration code.

### Integration Tests

- Verify PostHog initialization happens on client load
- Verify pageview events are captured
- Verify custom events can be captured via `analytics.capture()`

### Manual Testing Steps

1. Start `apps/www` dev server
2. Open browser DevTools Network tab
3. Navigate to any page
4. Verify requests to `/ingest/` endpoint succeed
5. Check PostHog dashboard for incoming events
6. Test `analytics.capture("test_event")` in browser console

---

## Performance Considerations

- **Instrumentation timing**: PostHog init happens during client instrumentation, before React hydration
- **Bundle size**: SDK upgrade may slightly increase bundle size (check before/after)
- **No initialization delay**: Provider no longer waits for `useEffect` to initialize

---

## Migration Notes

### Breaking Changes for Consumers

1. **PostHogProvider API change**: `baseUrl` prop removed
   - Apps must initialize via `initializePostHogAnalytics()` in instrumentation-client.ts

2. **New import pattern**: Can now import `analytics` from `@vendor/analytics/posthog`
   - Existing `usePosthogAnalytics()` hook still works

### Rollback Plan

If issues arise:
1. Revert `vendor/analytics/src/providers/posthog/client.tsx` to include `useEffect` initialization
2. Revert `apps/www/src/instrumentation-client.ts` to remove PostHog init
3. Revert `apps/www/src/app/layout.tsx` to pass `baseUrl` prop

---

## References

- Original research: `thoughts/shared/research/2026-01-28-next-forge-posthog-integration.md`
- Next-forge analytics package: `https://github.com/vercel/next-forge/tree/main/packages/analytics`
- PostHog JavaScript SDK: `https://posthog.com/docs/libraries/js`
- Next.js Instrumentation: `https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation`
