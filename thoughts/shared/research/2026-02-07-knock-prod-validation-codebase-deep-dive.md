---
date: 2026-02-07
researcher: codebase-agent
topic: "Knock Notification Integration - Production Validation"
tags: [research, codebase, knock, notifications, security]
status: complete
---

# Codebase Deep Dive: Knock Production Validation

## Research Question
Validate Knock notification integration for production deployment - configuration, security, and routing correctness.

## Summary

The Knock notification integration is architecturally sound with clear separation between server-side and client-side concerns. The implementation follows the codebase's vendor abstraction pattern (`@vendor/knock`) with proper t3-env validation at both the vendor package and consuming app levels. The notification dispatch flow correctly uses `clerkOrgId` (not `workspaceId`) as the Knock tenant parameter, which aligns with org-level notification routing.

Key security patterns are well-implemented: HMAC token signing via `KNOCK_SIGNING_KEY` happens exclusively server-side through a `userScopedProcedure` tRPC endpoint, the client only receives `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`, and no secrets are logged or stored in localStorage. The Inngest workflow has proper retry logic (3 retries), concurrency limits per workspace, and graceful error handling that re-throws Clerk API failures to trigger Inngest retries.

One notable finding: `KNOCK_SIGNING_KEY` is **missing from `turbo.json` globalEnv** while `KNOCK_API_KEY` and `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` are present. This could cause cache invalidation issues if the signing key changes between builds. Additionally, the notification preferences page uses `dynamic()` with `ssr: false` to prevent SSR issues with Knock client hooks - a correct pattern for client-only Knock components.

## Detailed Findings

### 1. Notification Dispatch Flow

**Entry Point**: `api/console/src/inngest/workflow/notifications/dispatch.ts:25`

The `notificationDispatch` Inngest function listens to the `apps-console/neural/observation.captured` event, which is emitted as a fire-and-forget event at the end of the `observationCapture` workflow (`api/console/src/inngest/workflow/neural/observation-capture.ts:1052-1067`).

#### Complete Event Flow

```
Webhook (GitHub/Vercel)
  → observation.capture event
  → observationCapture Inngest workflow (observation-capture.ts:336)
  → Step 8: emit "observation.captured" event (observation-capture.ts:1052-1055)
  → notificationDispatch Inngest workflow (dispatch.ts:25)
  → Knock workflow trigger (dispatch.ts:132)
```

#### Guard Chain (dispatch.ts:49-66)

1. **Knock client check** (line 49): Returns `skipped/knock_not_configured` if `KNOCK_API_KEY` not set
2. **Significance threshold** (line 55): Requires `significanceScore >= 70` (constant at line 20)
3. **Org context check** (line 65): Requires `clerkOrgId` to be present

#### Clerk Member Fetch (dispatch.ts:70-108)

The fetch runs as an Inngest step (`fetch-org-members`):

```typescript
const clerk = await clerkClient();
const membershipList = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrgId,
});
```

**Recipient Mapping** (dispatch.ts:78-92):
- Filters members requiring both `publicUserData.userId` AND `publicUserData.identifier` (email)
- Maps to: `{ id: userId, email: identifier, name: firstName + lastName }`
- `name` falls back to `firstName` only, or `undefined` if neither exists

**Error Handling** (dispatch.ts:100-107):
- Catches errors, logs `clerkOrgId` + error message (no PII in logs)
- Re-throws to fail the step, triggering Inngest retry

#### Post-Fetch Guards (dispatch.ts:110-126)

- Validates `orgMembers` is a non-null array
- Returns `skipped/no_org_members` if array is empty

#### Knock Trigger (dispatch.ts:129-152)

```typescript
await notifications.workflows.trigger("observation-captured", {
  recipients: orgMembers,  // Array of {id, email, name}
  tenant: clerkOrgId,      // ✅ Uses clerkOrgId, NOT workspaceId
  data: {
    observationId,
    observationType,
    significanceScore,
    topics: topics ?? [],
    clusterId,
    workspaceId,           // workspaceId only in data payload
  },
});
```

**Key Finding**: `tenant: clerkOrgId` is correct. This scopes notifications at the organization level. `workspaceId` is only passed in the data payload for template rendering purposes.

#### Inngest Function Configuration (dispatch.ts:26-35)

- **ID**: `apps-console/notification.dispatch`
- **Retries**: 3
- **Concurrency**: 20 per `event.data.workspaceId`
- **No batch window**: Events are processed individually (no batching at the Inngest level; batching is configured in Knock dashboard)

#### Registration (api/console/src/inngest/index.ts:44,68,138)

The function is properly:
- Imported at line 44
- Re-exported at line 68
- Registered with `serve()` at line 138

### 2. Environment Variable Security

#### Complete Env Var Map

| Variable | Scope | Defined In | Used In | Validated |
|---|---|---|---|---|
| `KNOCK_API_KEY` | Server | `vendor/knock/env.ts:6` | `vendor/knock/src/index.ts:6` | Zod `z.string().min(1)` |
| `KNOCK_SIGNING_KEY` | Server | `vendor/knock/env.ts:7`, `api/console/src/env.ts:22` | `api/console/src/router/user/notifications.ts:9` | Zod `z.string().min(1)` |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | Client | `vendor/knock/env.ts:10,13` | `vendor/knock/src/components/provider.tsx:11`, `trigger.tsx:43` | Zod `z.string().min(1)` |

#### t3-env Validation Layers

**Layer 1 - Vendor Package** (`vendor/knock/env.ts:1-17`):
```typescript
createEnv({
  server: {
    KNOCK_API_KEY: z.string().min(1),
    KNOCK_SIGNING_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
```

**Layer 2 - API Console** (`api/console/src/env.ts:18,22`):
- Separately declares `KNOCK_API_KEY` and `KNOCK_SIGNING_KEY` as server vars
- Used by the Inngest dispatch workflow

**Layer 3 - Apps Console** (`apps/console/src/env.ts:7,13`):
- Extends `knockEnv` from vendor package via `extends: [..., knockEnv, ...]`
- This means all Knock env validation runs at app startup

#### turbo.json Registration (`turbo.json:133-134`)

```json
"KNOCK_API_KEY",
"NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY"
```

**FINDING: `KNOCK_SIGNING_KEY` is MISSING from turbo.json globalEnv.** This means Turborepo won't invalidate build caches when the signing key changes. While this may not cause runtime issues (signing key is used at request time, not build time), it's an inconsistency.

#### Secret Logging Audit

**No secrets are logged.** Grep results show:
- `dispatch.ts:94`: Logs `clerkOrgId` and `memberCount` (no PII)
- `dispatch.ts:101-104`: Logs error message only (`error.message`), no secrets
- `dispatch.ts:145-151`: Logs `workspaceId`, `observationId`, `clerkOrgId`, `recipientCount`, `significanceScore`
- No `console.log` statements with `KNOCK`, `key`, `secret`, or `token` values in production code
- `scripts/test-notification.ts:89` references `grep KNOCK_API_KEY` as a debug command - not a logging concern since it's a dev-only script

#### localStorage / Token Storage Audit

**No tokens stored in localStorage or sessionStorage.** Grep for `localStorage.*knock|localStorage.*token|sessionStorage.*knock` returned zero matches. The signed user token is:
1. Generated server-side via tRPC `notifications.getToken` endpoint
2. Held in React Query cache (`staleTime: 5 * 60 * 1000` - 5 minutes)
3. Passed as a prop to `KnockProvider` component
4. Never persisted to client storage

### 3. Client/Server Separation

#### Server-Side Only Code

| File | Purpose | Server Indicator |
|---|---|---|
| `vendor/knock/src/index.ts` | `Knock` client instantiation, `signUserToken` export | Imports `@knocklabs/node` (server SDK) |
| `vendor/knock/env.ts` | Env validation with server vars | `server: { KNOCK_API_KEY, KNOCK_SIGNING_KEY }` |
| `api/console/src/router/user/notifications.ts` | Token signing endpoint | `userScopedProcedure` (runs on server) |
| `api/console/src/inngest/workflow/notifications/dispatch.ts` | Notification dispatch | Inngest workflow (runs on server) |

#### Client-Side Code

| File | Purpose | Client Indicator |
|---|---|---|
| `vendor/knock/src/components/provider.tsx` | `KnockProvider` + `KnockFeedProvider` wrapper | `"use client"` directive, imports `@knocklabs/react` |
| `vendor/knock/src/components/trigger.tsx` | Bell icon + feed popover | `"use client"` directive |
| `vendor/knock/src/components/preferences.tsx` | User preference management hook | `"use client"` directive |
| `apps/console/src/components/notifications-provider.tsx` | Fetches token via tRPC, wraps children | `"use client"` directive |
| `apps/console/.../notification-preferences.tsx` | Preferences UI | `"use client"` directive |

#### Client-Side Environment Exposure

The only Knock env var exposed to the client is `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`:
- Defined in `vendor/knock/env.ts` under `client:` block (line 10)
- Registered in `experimental__runtimeEnv` (line 13) - required for Next.js client access
- Used in `provider.tsx:11` and `trigger.tsx:43`
- `KNOCK_API_KEY` and `KNOCK_SIGNING_KEY` are under `server:` blocks and cannot leak to client bundles

#### SSR Handling

The notification preferences page (`apps/console/.../settings/notifications/page.tsx:8-17`) uses `dynamic()` with `ssr: false`:
```typescript
const NotificationPreferences = dynamic(
  () => import("./_components/notification-preferences").then(mod => mod.NotificationPreferences),
  { ssr: false, loading: () => <PreferencesSkeleton /> },
);
```
This prevents SSR issues with `useKnockClient()` which requires browser context.

The `ConsoleNotificationsProvider` (`apps/console/src/components/notifications-provider.tsx:21-22`) only fetches tokens when `typeof window !== "undefined"`:
```typescript
enabled: isLoaded && !!user && typeof window !== "undefined",
```

### 4. Clerk API Integration Security

#### Organization Member Fetch Pattern

The dispatch workflow (`dispatch.ts:72-74`) uses:
```typescript
const clerk = await clerkClient();
const membershipList = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrgId,
});
```

This is the same pattern used throughout the codebase:
- `api/console/src/router/user/workspace.ts:56,129`
- `api/console/src/router/org/workspace.ts:77,243`
- `api/console/src/router/user/organization.ts:28`

The `clerkClient()` function returns an authenticated server-side Clerk client that uses `CLERK_SECRET_KEY` (not exposed to client).

#### publicUserData Fields Exposed

From `dispatch.ts:80-91`, only these fields are accessed:
- `publicUserData.userId` → Used as Knock recipient ID
- `publicUserData.identifier` → Used as email for Knock recipient
- `publicUserData.firstName` → Used for display name
- `publicUserData.lastName` → Used for display name

No sensitive PII (phone, address, metadata) is accessed or passed to Knock.

#### Knock Data Payload (dispatch.ts:135-143)

The `data` payload sent to Knock contains:
- `observationId` - Internal observation ID
- `observationType` - String like "push", "pull_request_merged"
- `significanceScore` - Numeric score
- `topics` - Array of string tags
- `clusterId` - Internal cluster ID
- `workspaceId` - Internal workspace ID

**No PII in the data payload.** No email addresses, user names, or personal data.

#### Error Handling When Clerk API Fails

From `dispatch.ts:100-107`:
```typescript
catch (error) {
  log.error("Failed to fetch org members from Clerk", {
    clerkOrgId,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;  // Re-throws to fail the step
}
```

And from the fix in commit `3acf225c`: the workflow now prevents dispatch when org member fetch fails. The re-thrown error triggers Inngest's retry mechanism (3 retries configured at line 30).

### 5. Inngest Workflow Integration

#### Workflow Registration

```
api/console/src/inngest/index.ts:44  → import { notificationDispatch }
api/console/src/inngest/index.ts:138 → registered in serve() functions array
```

#### Event Schema (api/console/src/inngest/client/client.ts:626-649)

The `observation.captured` event schema:
```typescript
"apps-console/neural/observation.captured": {
  data: z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    observationId: z.string(),
    sourceId: z.string(),
    observationType: z.string(),
    significanceScore: z.number().optional(),
    topics: z.array(z.string()).optional(),
    entitiesExtracted: z.number().optional(),
    clusterId: z.string().optional(),
    clusterIsNew: z.boolean().optional(),
  }),
},
```

**Note**: `clerkOrgId` is optional in the schema for backwards compatibility. The dispatch function guards against missing `clerkOrgId` at line 65.

#### Event Emission (observation-capture.ts:1052-1067)

The `observation.captured` event is emitted in Step 8 of the observation capture workflow:
```typescript
await step.sendEvent("emit-events", [
  {
    name: "apps-console/neural/observation.captured",
    data: {
      workspaceId,
      clerkOrgId,  // Propagated from early resolution
      observationId: observation.externalId,
      // ...
    },
  },
  // ... other events
]);
```

#### Error Handling & Retry Logic

- **Retries**: 3 (dispatch.ts:30)
- **Concurrency**: 20 per workspaceId (dispatch.ts:31-34)
- **Step isolation**: Clerk API call is wrapped in `step.run("fetch-org-members")` - if it fails, only that step retries
- **Knock trigger isolation**: Wrapped in separate `step.run("trigger-knock-workflow")` - Knock API failures don't retry Clerk fetch

#### Secret Exposure in Inngest

Inngest doesn't log function step results by default. The workflow:
- Never passes `KNOCK_API_KEY` or `KNOCK_SIGNING_KEY` as event data
- Only uses `notifications` client (pre-configured singleton) from `@vendor/knock`
- Error logs only contain safe identifiers (`workspaceId`, `clerkOrgId`, error messages)

### 6. Configuration Requirements

#### Required Environment Variables

| Variable | Where Needed | Source |
|---|---|---|
| `KNOCK_API_KEY` | Server (api/console, apps/console) | Knock Dashboard → Developers → API Keys → Secret key (`sk_...`) |
| `KNOCK_SIGNING_KEY` | Server (api/console, apps/console) | Knock Dashboard → Developers → Signing keys |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | Client (apps/console) | Knock Dashboard → Developers → API Keys → Public key (`pk_...`) |

#### Knock Dashboard Configuration Required

1. **Workflow**: `observation-captured` must be created and committed in Knock dashboard
2. **In-App Feed Channel**: `lightfast-console-notifications` (hardcoded in `provider.tsx:12`)
3. **Email Channel**: Must be configured with Resend integration in Knock dashboard
4. **Batch window**: Configured in Knock dashboard workflow settings (mentioned as "5 minutes" in UI text at `notification-preferences.tsx:105`)

#### Environment Files

- Development: `apps/console/.vercel/.env.development.local`
- MCP config: `.env.mcp` (contains `KNOCK_SERVICE_TOKEN` for MCP automation)
- Production: Set in Vercel dashboard

#### Unused Event Schema

There is an `apps-console/notification.dispatch` event defined in the Inngest client schema (`client.ts:715-729`) that is **NOT used** by any function. The actual `notificationDispatch` function listens to `observation.captured`, not this event. This appears to be a planned but unused generic notification dispatch pathway.

## Code References

### Core Implementation
- `api/console/src/inngest/workflow/notifications/dispatch.ts:25-161` - Main dispatch function
- `api/console/src/inngest/workflow/notifications/index.ts:1` - Re-export barrel
- `vendor/knock/src/index.ts:1-18` - Server-side Knock client singleton + signUserToken export
- `vendor/knock/env.ts:1-17` - t3-env validation (all 3 Knock env vars)
- `vendor/knock/src/components/provider.tsx:1-46` - Client-side KnockProvider wrapper
- `vendor/knock/src/components/trigger.tsx:1-52` - Bell icon notification trigger
- `vendor/knock/src/components/preferences.tsx:1-106` - Preference management hook

### Integration Points
- `api/console/src/router/user/notifications.ts:1-13` - tRPC token signing endpoint
- `api/console/src/root.ts:19,55` - Router registration (under userRouter)
- `api/console/src/inngest/index.ts:44,68,138` - Inngest function registration
- `api/console/src/inngest/client/client.ts:626-649` - Event schema definition
- `api/console/src/inngest/workflow/neural/observation-capture.ts:1052-1067` - Event emission
- `apps/console/src/components/notifications-provider.tsx:1-42` - Client wrapper with tRPC token fetch
- `apps/console/src/app/(app)/layout.tsx:2,18` - Provider mounting
- `apps/console/src/components/app-header.tsx:4,29` - Bell icon mounting
- `apps/console/src/env.ts:7,13` - Console app env extension

### Configuration
- `turbo.json:133-134` - Turborepo env var registration
- `vendor/knock/package.json:1-44` - Package exports map
- `.env.mcp.example:9-11` - MCP service token reference

### Settings UI
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/notifications/page.tsx:1-72` - Settings page with dynamic import
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/notifications/_components/notification-preferences.tsx:1-181` - Preferences UI component

## Security Findings

### Positive Security Patterns

1. **Proper server/client separation**: `KNOCK_API_KEY` and `KNOCK_SIGNING_KEY` are exclusively in `server:` blocks of t3-env, preventing client bundle exposure
2. **HMAC token signing**: User tokens are signed via `@knocklabs/node`'s `signUserToken` with `KNOCK_SIGNING_KEY` server-side
3. **No token persistence**: Signed tokens live only in React Query cache (5-minute staleTime), never written to localStorage/sessionStorage
4. **Safe error logging**: Error handlers log identifiers and error messages only, never secrets or full stack traces with env vars
5. **Auth boundary correct**: Token signing is behind `userScopedProcedure` (requires authenticated Clerk user)
6. **Graceful degradation**: All components check for Knock API key availability before rendering (provider.tsx:25, trigger.tsx:43)
7. **No PII in Knock payloads**: Data payload contains only observation metadata, no user personal data
8. **Org-level tenant scoping**: `tenant: clerkOrgId` correctly scopes notifications at the organization level

### Items Requiring Attention

1. **`KNOCK_SIGNING_KEY` missing from `turbo.json`**: While `KNOCK_API_KEY` and `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` are listed in `turbo.json:133-134`, `KNOCK_SIGNING_KEY` is not. This means Turborepo won't invalidate caches when this key rotates. Likely low-risk since signing is runtime, but should be added for consistency.

2. **Token expiration not explicitly set**: The `signUserToken` call at `notifications.ts:8-10` passes `signingKey` but no explicit `expiresInSeconds` parameter. The default expiration depends on `@knocklabs/node` library defaults. The client-side `staleTime` is 5 minutes but this controls refetch, not token validity.

3. **Hardcoded feed channel ID**: `lightfast-console-notifications` is hardcoded in `provider.tsx:12`. If the channel ID needs to change, it requires a code deployment. Consider making this an env var for flexibility.

4. **Unused event schema**: `apps-console/notification.dispatch` event exists in the Inngest schema (`client.ts:715-729`) but no function listens to it. The actual dispatch function listens to `observation.captured`. This dead schema could cause confusion.

5. **No pagination on member fetch**: `getOrganizationMembershipList` at `dispatch.ts:73` doesn't specify `limit` parameter. Clerk defaults to returning first 10 members. For orgs with >10 members, some members may not receive notifications. This is a **functional bug** for larger organizations.

## Gaps Identified

1. **Member pagination**: The `getOrganizationMembershipList` call needs pagination support for organizations with >10 members (Clerk default limit)
2. **Token expiration configuration**: No explicit expiration set on signed user tokens - relies on library defaults
3. **Knock workflow definition**: The `observation-captured` workflow is configured in the Knock dashboard (external), not in code. No Knock workflow definition files exist in the codebase.
4. **No retry/fallback for Knock API**: If the Knock API itself is down, the Inngest step will retry 3 times but there's no circuit breaker or fallback notification mechanism
5. **Batch window configuration**: Email batching (mentioned as "every 5 minutes" in UI) must be configured in the Knock dashboard, not controlled by code
6. **No notification delivery monitoring**: No webhook or callback to verify Knock actually delivered notifications
7. **`turbo.json` missing `KNOCK_SIGNING_KEY`**: Should be added for build cache consistency
