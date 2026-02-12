# Knock Notification Integration — Phase 1 Implementation Plan

## Overview

Integrate Knock as the unified notification orchestration layer for the Lightfast console. Phase 1 establishes the end-to-end pipeline: `@vendor/knock` package, `KnockProvider` in the authenticated layout, bell icon in the AppHeader, and a first notification trigger from the `observation-capture` Inngest workflow for high-significance events (score >= 70).

## Current State Analysis

**No notification system exists.** The console has:
- Sonner toasts for immediate UI feedback (14 components)
- A jobs table with 5s polling for background job status (`apps/console/src/components/jobs-table.tsx`)
- An activity timeline for audit logging (`apps/console/src/components/activity-timeline.tsx`)
- Resend email for auth verification codes only (`vendor/email/`)

**What's ready to support this:**
- 16 vendor packages in `vendor/` with established patterns (env.ts, package.json, tsconfig.json conventions)
- next-forge reference implementation available in `tmp/next-forge/packages/notifications/` (~7 files)
- `observation-capture.ts` already emits `observation.captured` completion event at line 1052 with `significanceScore` field
- AppHeader at `apps/console/src/components/app-header.tsx:46` has clear space between workspace switcher and user avatar
- Authenticated layout at `apps/console/src/app/(app)/layout.tsx` wraps all authenticated pages

### Key Discoveries:
- Vendor packages use `@t3-oss/env-nextjs` for env validation with `skipValidation` for CI/lint (`vendor/email/src/env.ts`)
- Vendor packages extend `@repo/typescript-config/internal-package.json` (`vendor/email/tsconfig.json`)
- Console app env composition uses `extends: [...]` pattern in `apps/console/src/env.ts:12`
- Inngest workflow registration is in `api/console/src/inngest/index.ts:105-130` — new notification workflow needs to be added here
- The `observation.captured` event already contains `significanceScore` (line 1062) and `observationType` (line 1061) — perfect for notification gating
- `SIGNIFICANCE_THRESHOLD` for capture is 30; notification threshold should be higher (70+)

## Desired End State

After this plan is complete:

1. A `@vendor/knock` package exists with server client, client provider, bell trigger component, and env validation
2. The console app wraps authenticated pages with `KnockProvider` (graceful degradation when env vars not set)
3. A bell icon appears in the AppHeader next to the user avatar with a feed popover
4. When an observation with significance >= 70 is captured, a Knock notification appears in the in-app feed
5. A new Inngest workflow `notification-dispatch` listens for `observation.captured` and triggers Knock

### Verification:
- `pnpm typecheck` passes across all affected packages
- `pnpm lint` passes
- `pnpm build:console` succeeds
- Bell icon visible in AppHeader (when Knock env vars set)
- Graceful degradation (no errors when Knock env vars not set)
- End-to-end: GitHub push → observation captured (score >= 70) → Knock notification in feed

## What We're NOT Doing

- Email digest templates or email channel configuration
- Slack/Discord channel setup
- Notification preferences UI or settings pages
- Multiple notification event types (only high-significance observations)
- Knock dashboard workflow configuration (documented but not automated)
- Custom notification card styling (use Knock defaults)
- Tenant/workspace scoping in Knock (users receive all their notifications)
- Batching or threading configuration

## Implementation Approach

Follow the next-forge pattern with Lightfast's vendor package conventions. The implementation has 4 phases:
1. Create `@vendor/knock` package (server + client)
2. Integrate provider and bell icon into console app
3. Create `notification-dispatch` Inngest workflow
4. Wire observation-capture to trigger notifications

---

## Phase 1: Create `@vendor/knock` Package

### Overview
Create the vendor abstraction for Knock following the established pattern (mirroring `@vendor/email`).

### Changes Required:

#### 1. Package Configuration
**File**: `vendor/knock/package.json`

```json
{
  "name": "@vendor/knock",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./components/provider": "./src/components/provider.tsx",
    "./components/trigger": "./src/components/trigger.tsx",
    "./styles": "./src/styles.css",
    "./env": "./env.ts"
  },
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@knocklabs/node": "^1.20.0",
    "@knocklabs/react": "^0.8.11",
    "@t3-oss/env-nextjs": "catalog:",
    "react": "catalog:react19",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

#### 2. TypeScript Configuration
**File**: `vendor/knock/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": {
      "~/env": ["./env.ts"]
    }
  },
  "include": ["*.ts", "src"],
  "exclude": ["node_modules"]
}
```

#### 3. Environment Configuration
**File**: `vendor/knock/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    KNOCK_SECRET_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_KNOCK_API_KEY: z.string().optional(),
    NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_KNOCK_API_KEY: process.env.NEXT_PUBLIC_KNOCK_API_KEY,
    NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID:
      process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
```

All env vars are optional — the system degrades gracefully when Knock is not configured.

#### 4. Server-Side Client
**File**: `vendor/knock/src/index.ts`

```typescript
import { Knock } from "@knocklabs/node";
import { env } from "~/env";

const key = env.KNOCK_SECRET_API_KEY;

/**
 * Server-side Knock client singleton.
 * Returns null if KNOCK_SECRET_API_KEY is not set.
 */
export const notifications = key ? new Knock(key) : null;
```

#### 5. Client Provider Component
**File**: `vendor/knock/src/components/provider.tsx`

```typescript
"use client";

import {
  type ColorMode,
  KnockFeedProvider,
  KnockProvider,
} from "@knocklabs/react";
import type { ReactNode } from "react";
import { env } from "~/env";

const knockApiKey = env.NEXT_PUBLIC_KNOCK_API_KEY;
const knockFeedChannelId = env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

type NotificationsProviderProps = {
  children: ReactNode;
  userId: string;
};

export const NotificationsProvider = ({
  children,
  userId,
}: NotificationsProviderProps) => {
  if (!(knockApiKey && knockFeedChannelId)) {
    return children;
  }

  return (
    <KnockProvider apiKey={knockApiKey} userId={userId}>
      <KnockFeedProvider colorMode={"dark" as ColorMode} feedId={knockFeedChannelId}>
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
};
```

Note: Hardcoded `"dark"` because the console uses `className="dark"` globally in `apps/console/src/app/layout.tsx:71`.

#### 6. Bell Icon Trigger Component
**File**: `vendor/knock/src/components/trigger.tsx`

```typescript
"use client";

import {
  NotificationFeedPopover,
  NotificationIconButton,
} from "@knocklabs/react";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import { env } from "~/env";

import "@knocklabs/react/dist/index.css";
import "../styles.css";

export const NotificationsTrigger = () => {
  const [isVisible, setIsVisible] = useState(false);
  const notifButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = (event: Event) => {
    if (event.target === notifButtonRef.current) {
      return;
    }
    setIsVisible(false);
  };

  if (!env.NEXT_PUBLIC_KNOCK_API_KEY) {
    return null;
  }

  return (
    <>
      <NotificationIconButton
        onClick={() => setIsVisible(!isVisible)}
        ref={notifButtonRef}
      />
      {notifButtonRef.current && (
        <NotificationFeedPopover
          buttonRef={notifButtonRef as RefObject<HTMLElement>}
          isVisible={isVisible}
          onClose={handleClose}
        />
      )}
    </>
  );
};
```

#### 7. CSS Overrides
**File**: `vendor/knock/src/styles.css`

```css
:root {
  --rnf-notification-icon-button-size: 1rem;
}

.rnf-notification-icon-button svg {
  width: var(--rnf-notification-icon-button-size);
  height: var(--rnf-notification-icon-button-size);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds (new package resolves)
- [ ] `pnpm --filter @vendor/knock typecheck` passes
- [ ] `pnpm --filter @vendor/knock lint` passes

#### Manual Verification:
- [ ] Package structure matches other vendor packages (env.ts, src/, package.json)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Integrate Provider and Bell Icon into Console App

### Overview
Add `@vendor/knock` as a dependency of the console app, wrap the authenticated layout with `NotificationsProvider`, and add the bell icon to `AppHeader`.

### Changes Required:

#### 1. Add Dependency
**File**: `apps/console/package.json`
**Changes**: Add `@vendor/knock` to dependencies

```json
"@vendor/knock": "workspace:*"
```

#### 2. Extend Console Env (Optional)
**File**: `apps/console/src/env.ts`
**Changes**: Import and extend with Knock env

Add to imports:
```typescript
import { env as knockEnv } from "@vendor/knock/env";
```

Add to extends array:
```typescript
extends: [vercel(), clerkEnvBase, dbEnv, sentryEnv, githubEnv, vercelEnv, knockEnv],
```

This makes Knock env vars available through the console's unified env object and ensures they're validated at startup.

#### 3. Create Notifications Provider Wrapper
**File**: `apps/console/src/components/notifications-provider.tsx`
**Changes**: Create a thin wrapper that extracts userId from Clerk

```typescript
"use client";

import { useUser } from "@clerk/nextjs";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useUser();

  if (!user) {
    return children;
  }

  return (
    <NotificationsProvider userId={user.id}>
      {children}
    </NotificationsProvider>
  );
}
```

#### 4. Wrap Authenticated Layout
**File**: `apps/console/src/app/(app)/layout.tsx`
**Changes**: Add `ConsoleNotificationsProvider` inside `HydrateClient`

```typescript
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { AppHeader } from "~/components/app-header";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  prefetch(userTrpc.organization.listUserOrganizations.queryOptions());

  return (
    <PageErrorBoundary fallbackTitle="Failed to load application">
      <div className="dark h-screen flex flex-col overflow-hidden">
        <HydrateClient>
          <ConsoleNotificationsProvider>
            <AppHeader />
          </ConsoleNotificationsProvider>
        </HydrateClient>
        <div className="flex-1 flex overflow-hidden">{children}</div>
      </div>
    </PageErrorBoundary>
  );
}
```

Note: `ConsoleNotificationsProvider` wraps `AppHeader` so the bell icon can access the Knock context. It does NOT need to wrap `{children}` because the feed popover renders as a portal from the header, not from page content.

#### 5. Add Bell Icon to AppHeader
**File**: `apps/console/src/components/app-header.tsx`
**Changes**: Add `NotificationsTrigger` between workspace switcher area and user avatar

```typescript
"use client";

import { useParams, usePathname } from "next/navigation";
import { TeamSwitcher } from "./team-switcher";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";

export function AppHeader() {
  const pathname = usePathname();
  const params = useParams();

  const mode =
    pathname.startsWith("/account") || pathname.startsWith("/new")
      ? "account"
      : "organization";

  const workspaceName =
    typeof params.workspaceName === "string" ? params.workspaceName : undefined;
  const orgSlug = typeof params.slug === "string" ? params.slug : undefined;

  return (
    <header className="flex items-center justify-between py-2 px-4 bg-background">
      <div className="flex items-center gap-1">
        <TeamSwitcher mode={mode} />
        {workspaceName && orgSlug && (
          <>
            <span className="text-muted-foreground/40 text-sm mr-2">/</span>
            <WorkspaceSwitcher
              orgSlug={orgSlug}
              workspaceName={workspaceName}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </header>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Console loads without errors when Knock env vars are NOT set (graceful degradation — no bell icon, no errors)
- [ ] When Knock env vars ARE set, bell icon appears in the header next to user avatar
- [ ] Clicking bell icon opens the notification feed popover (empty feed is expected)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the bell icon renders correctly before proceeding.

---

## Phase 3: Create Notification Dispatch Inngest Workflow

### Overview
Create a new Inngest workflow that listens for `observation.captured` events and triggers a Knock notification for high-significance observations (score >= 70).

### Changes Required:

#### 1. Add Knock Event Schema
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Add a new event for notification dispatch

In the `eventsMap` object, add after the neural memory events section:

```typescript
// ============================================================================
// NOTIFICATION EVENTS
// ============================================================================

/**
 * Notification dispatch event
 * Triggers Knock notification workflow for user-facing events
 */
"apps-console/notification.dispatch": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID */
    clerkOrgId: z.string().optional(),
    /** Knock workflow key */
    workflowKey: z.string(),
    /** Recipients (Clerk user IDs) */
    recipients: z.array(z.string()),
    /** Tenant ID for workspace scoping */
    tenant: z.string().optional(),
    /** Notification data payload */
    payload: z.record(z.unknown()),
  }),
},
```

#### 2. Create Notification Dispatch Workflow
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts`

```typescript
/**
 * Notification dispatch workflow
 *
 * Listens for observation.captured events and triggers Knock notifications
 * for high-significance observations (score >= 70).
 *
 * This workflow acts as the bridge between Inngest events and Knock's
 * notification orchestration. It:
 * 1. Filters events by significance threshold
 * 2. Resolves workspace members as notification recipients
 * 3. Triggers the appropriate Knock workflow
 */

import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { notifications } from "@vendor/knock";
import { NonRetriableError } from "inngest";
import { db } from "@db/console/client";
import { orgMembers } from "@db/console/schema";
import { eq } from "drizzle-orm";

/** Minimum significance score to trigger a notification */
const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;

/** Knock workflow key for observation notifications (configured in Knock dashboard) */
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const notificationDispatch = inngest.createFunction(
  {
    id: "apps-console/notification.dispatch",
    name: "Notification Dispatch",
    description: "Routes high-significance observations to Knock notifications",
    retries: 3,
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId",
    },
  },
  { event: "apps-console/neural/observation.captured" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      observationId,
      observationType,
      significanceScore,
      topics,
      clusterId,
    } = event.data;

    // Guard: Knock client must be configured
    if (!notifications) {
      log.debug("Knock not configured, skipping notification", { workspaceId });
      return { status: "skipped", reason: "knock_not_configured" };
    }

    // Guard: Only notify for high-significance events
    if (!significanceScore || significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
        threshold: NOTIFICATION_SIGNIFICANCE_THRESHOLD,
      };
    }

    // Step 1: Resolve recipients (all org members for now)
    const recipients = await step.run("resolve-recipients", async () => {
      if (!clerkOrgId) {
        throw new NonRetriableError("Missing clerkOrgId for notification recipient resolution");
      }

      const members = await db.query.orgMembers.findMany({
        where: eq(orgMembers.clerkOrgId, clerkOrgId),
        columns: { clerkUserId: true },
      });

      return members.map((m) => m.clerkUserId);
    });

    if (recipients.length === 0) {
      return { status: "skipped", reason: "no_recipients" };
    }

    // Step 2: Trigger Knock workflow
    await step.run("trigger-knock-workflow", async () => {
      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: recipients.map((id) => ({ id })),
        tenant: clerkOrgId,
        data: {
          observationId,
          observationType,
          significanceScore,
          topics: topics ?? [],
          clusterId,
          workspaceId,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        observationId,
        recipients: recipients.length,
        significanceScore,
      });
    });

    return {
      status: "sent",
      observationId,
      recipients: recipients.length,
      significanceScore,
    };
  },
);
```

#### 3. Create Index Export
**File**: `api/console/src/inngest/workflow/notifications/index.ts`

```typescript
export { notificationDispatch } from "./dispatch";
```

#### 4. Register Workflow
**File**: `api/console/src/inngest/index.ts`
**Changes**: Import and register the new workflow

Add import:
```typescript
// Notification workflows
import { notificationDispatch } from "./workflow/notifications";
```

Add export:
```typescript
// Export notification workflows
export { notificationDispatch };
```

Add to `functions` array in `createInngestRouteContext()`:
```typescript
// Notifications
notificationDispatch,
```

#### 5. Add @vendor/knock Dependency to API
**File**: `api/console/package.json`
**Changes**: Add `@vendor/knock` to dependencies

```json
"@vendor/knock": "workspace:*"
```

#### 6. Verify orgMembers Schema Access
The workflow queries `orgMembers` to resolve notification recipients. Need to verify this table/query is available. The `orgMembers` table should be importable from `@db/console/schema` — it stores Clerk org membership records with `clerkOrgId` and `clerkUserId` columns.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter @api/console typecheck` passes
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Inngest dev server shows the new `notification.dispatch` function registered
- [ ] When an observation with significance >= 70 is captured, the Inngest function fires
- [ ] Knock dashboard shows the workflow trigger received

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the workflow appears in Inngest dev UI before proceeding.

---

## Phase 4: Knock Dashboard Configuration & End-to-End Test

### Overview
This phase covers what needs to be configured in the Knock dashboard (manual steps) and environment variables to complete the end-to-end pipeline.

### Changes Required:

#### 1. Knock Account Setup (Manual — Knock Dashboard)

1. Sign up at [knock.app](https://knock.app) (free tier)
2. Create a new environment (Development)
3. Note these values:
   - **Secret API key** → `KNOCK_SECRET_API_KEY`
   - **Public API key** → `NEXT_PUBLIC_KNOCK_API_KEY`

#### 2. Create In-App Feed Channel (Manual — Knock Dashboard)

1. Go to Channels → Create Channel
2. Select "In-App Feed"
3. Name: "Console In-App Feed"
4. Note the **Channel ID** → `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`

#### 3. Create Notification Workflow (Manual — Knock Dashboard)

1. Go to Workflows → Create Workflow
2. **Key**: `observation-captured` (must match `OBSERVATION_WORKFLOW_KEY` in code)
3. Add channel step: In-App Feed
4. Configure template:
   - **Title**: `High-significance {{observationType}} event captured`
   - **Body**: `Significance: {{significanceScore}}/100. Topics: {{topics | join: ", "}}. View observation {{observationId}}.`
5. Commit changes

#### 4. Set Environment Variables

Add to `apps/console/.vercel/.env.development.local`:

```bash
# Knock Notification Service
KNOCK_SECRET_API_KEY=sk_test_...
NEXT_PUBLIC_KNOCK_API_KEY=pk_test_...
NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID=...
```

### Success Criteria:

#### Automated Verification:
- [ ] Console app starts without errors: `pnpm dev:app`
- [ ] Bell icon appears in header
- [ ] No console errors related to Knock

#### Manual Verification:
- [ ] Trigger a GitHub push to a connected repo with significant changes
- [ ] Observe the observation-capture workflow run in Inngest
- [ ] Observe the notification-dispatch workflow run in Inngest
- [ ] Notification appears in the bell icon feed popover
- [ ] Clicking the notification shows details in the feed

---

## Testing Strategy

### Unit Tests:
- None needed for Phase 1 — all components are thin wrappers around Knock SDK

### Integration Tests:
- End-to-end: GitHub push → Inngest observation.capture → observation.captured → notification.dispatch → Knock API → in-app feed
- Verify graceful degradation: remove Knock env vars, confirm no errors

### Manual Testing Steps:
1. Start dev server with `pnpm dev:app`
2. Confirm bell icon renders in AppHeader (with Knock configured)
3. Trigger observation by pushing to a connected GitHub repo
4. Wait for Inngest workflows to complete
5. Check bell icon for new notification (should show unread count badge)
6. Click bell to open feed popover
7. Verify notification content matches observation data

## Performance Considerations

- Knock client is a singleton — no per-request overhead
- `NotificationsProvider` returns children directly when env vars are missing — zero overhead in unconfigured state
- `NotificationsTrigger` returns null when env vars missing — no DOM impact
- Notification dispatch workflow is fire-and-forget from observation-capture's perspective (separate Inngest event listener)
- Recipients are resolved from local DB, not external API calls

## Migration Notes

- No database migrations needed
- No breaking changes to existing functionality
- Knock integration is entirely additive
- Graceful degradation: everything works without Knock env vars (just no notifications)

## References

- Research: `thoughts/shared/research/2026-02-06-web-analysis-knock-unified-notification-orchestration.md`
- Research: `thoughts/shared/research/2026-02-06-console-notification-system-inngest-workflows.md`
- Reference implementation: `tmp/next-forge/packages/notifications/`
- Vendor pattern: `vendor/email/` (simplest vendor package)
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:1052-1107`
- AppHeader: `apps/console/src/components/app-header.tsx`
- Authenticated layout: `apps/console/src/app/(app)/layout.tsx`
- Inngest registration: `api/console/src/inngest/index.ts:105-130`
