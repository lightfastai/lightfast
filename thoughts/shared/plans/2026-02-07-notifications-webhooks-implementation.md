---
date: 2026-02-07
author: architect-agent
topic: "Notifications, Email, Slack, Webhooks & Integrations Page Implementation"
tags: [plan, knock, resend, slack, svix, webhooks, integrations]
status: draft
based_on:
  - 2026-02-07-notifications-webhooks-architecture-design.md
  - 2026-02-07-notifications-webhooks-codebase-deep-dive.md
  - 2026-02-07-notifications-webhooks-external-research.md
---

# Implementation Plan: Notifications, Email, Slack, Webhooks & Integrations Page

## Overview

This plan covers 5 interconnected systems across 4 phases. The codebase already has 100% code-complete Knock infrastructure (client, provider, bell icon, dispatch workflow, CSP) but 0% dashboard configuration. Resend operates independently for auth emails. Zero Slack, zero outbound webhooks, zero unified integrations page exist.

**Phasing strategy**: Each phase builds on the previous, shipping incrementally. Phase 1 activates what's already built. Phase 2 adds email. Phase 3 adds Slack + outbound webhooks. Phase 4 unifies the UI.

---

## Phase 1: Activate Knock In-App Notifications + Security Fix

**Goal**: Make the existing Knock infrastructure actually deliver in-app notifications.
**Estimated scope**: ~2-3 days of code changes + Knock dashboard configuration.

### 1.1 Knock Dashboard Configuration — ✅ COMPLETE

> **Prerequisite**: Knock account exists (confirmed). Log into dashboard.knock.app.

**Steps**:

1. **Create in-app feed channel** — ✅ COMPLETE
   - ✅ Channel `lightfast-console-notifications` exists and configured
   - ✅ Channel ID matches hardcoded value in `vendor/knock/src/components/provider.tsx:12`

2. **Create workflow `observation-captured`** — ✅ COMPLETE
   - ✅ Workflow `observation-captured` created in development environment
   - ✅ Workflow key matches `OBSERVATION_WORKFLOW_KEY` in `api/console/src/inngest/workflow/notifications/dispatch.ts:11`
   - ✅ In-app feed step added with channel `lightfast-console-notifications`
   - ✅ Template configured with markdown body showing:
     - Observation type (capitalized)
     - Significance score
     - Topics (comma-separated)
     - Cluster ID (if present)
   - ✅ Action URL points to workspace: `https://lightfast.ai/workspace/{{ data.workspaceId }}`

3. **Configure recipient model** — ✅ COMPLETE
   - ✅ Decision: Using `clerkOrgId` as recipient (configured in dispatch.ts:73)
   - ✅ Knock will handle org → member fan-out automatically

4. **Enable enhanced security (user token signing)** — ✅ COMPLETE
   - ✅ Enhanced security mode enabled in Knock Dashboard
   - ✅ This forces `userToken` requirement on client-side
   - ✅ Code is ready to support this (Phase 1.2 complete)

**Success criteria**: ✅ Workflow visible in Knock dashboard, ✅ channel created, ✅ enhanced security enabled.

### 1.2 User Token Signing (Security Fix — CRITICAL)

**Problem**: `apps/console/src/components/notifications-provider.tsx:25` passes raw `userId` to KnockProvider. Any user could impersonate another by guessing their userId.

**Files to modify**:

#### A. New tRPC procedure for Knock token — ✅ COMPLETE

**File**: `api/console/src/router/user/notifications.ts` (new file)

```typescript
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { notifications } from "@vendor/knock";

export const notificationsRouter = createTRPCRouter({
  getToken: protectedProcedure.query(async ({ ctx }) => {
    if (!notifications) return null;
    const token = await notifications.signUserToken(ctx.auth.userId);
    return token;
  }),
});
```

#### B. Register in root router — ✅ COMPLETE

**File**: `api/console/src/root.ts`
- ✅ Import `notificationsRouter`
- ✅ Add to `userRouter`: `notifications: notificationsRouter`
- ✅ Update tRPC react client to route `notifications.*` to user endpoint

#### C. Update notifications provider — ✅ COMPLETE

**File**: `apps/console/src/components/notifications-provider.tsx`
- ✅ Fetch signed token via `trpc.notifications.getToken.queryOptions()`
- ✅ Pass `userToken={token}` to `NotificationsProvider` component (which wraps `KnockProvider`)

#### D. Update KnockProvider wrapper — ✅ COMPLETE

**File**: `vendor/knock/src/components/provider.tsx`
- ✅ Add `userToken?: string | null` prop to `NotificationsProvider`
- ✅ Pass to `<KnockProvider userToken={userToken}>`
- ✅ Don't render children until token is available (loading state)

**Success criteria**:
- `notifications-provider.tsx` no longer passes raw userId without a signed token
- Knock provider receives HMAC-signed `userToken`
- Bell icon still renders and shows notifications

### 1.3 End-to-End Verification — ✅ COMPLETE

**Test Script Created**: `scripts/test-notification.ts`

1. ✅ Start dev server (`pnpm dev:app`)
2. ✅ Trigger test event: `pnpm test:notification`
3. ✅ Verified: Inngest receives `observation.captured` event (Event ID: 01KGTPJRT4DHEZPWPT2JNQ3QJB)
4. ✅ Verified: `notificationDispatch` function fires (significance 85 >= 70)
5. ✅ Verified: Knock workflow `observation-captured` triggers successfully
6. ✅ Verified: Function completes with "Knock notification triggered" log
7. 🔄 Manual: Check bell icon in console app for notification (requires user login)

**Test Script Usage**:
```bash
# Default test IDs
pnpm test:notification

# Custom org/workspace
pnpm test:notification org_abc123 ws_xyz789
```

**Verification Logs**:
```
Knock notification triggered {
  workspaceId: 'workspace_test_notification',
  observationId: 'test-obs-1770422625092',
  clerkOrgId: 'org_test_notification',
  significanceScore: 85
}
```

**Success criteria**: ✅ Test script triggers notification flow → Inngest processes event → Knock API called successfully.

---

## Phase 2: Email Notifications via Knock + Resend

**Goal**: Add email as a second notification channel through Knock (Resend as delivery provider).
**Estimated scope**: ~2 days (mostly Knock dashboard + one preference center page).

### 2.1 Knock Dashboard: Add Resend Email Channel

**Steps** (manual, in Knock dashboard):

1. **Create Resend email channel**
   - Knock Dashboard → Channels and sources → Create channel → Email → Resend
   - API Key: existing `RESEND_API_KEY` (the `re_` prefixed key from env)
   - From: `noreply@lightfast.ai`
   - From Name: `Lightfast`
   - Reply-To: `support@lightfast.ai`

2. **Add email step to `observation-captured` workflow**
   - After the in-app feed step
   - Channel: Resend email channel (created above)
   - Enable batching: 5-minute window
   - Template (Liquid):

   ```liquid
   <h2>{{ total_activities }} new observations in {{ tenant.name }}</h2>

   {% for activity in activities %}
   <div style="border-left: 3px solid #6366f1; padding-left: 12px; margin-bottom: 16px;">
     <strong>{{ activity.data.observationType | capitalize }}</strong>
     (Score: {{ activity.data.significanceScore }})
     <br>
     Topics: {{ activity.data.topics | join: ", " }}
   </div>
   {% endfor %}

   <a href="https://lightfast.ai/workspace/{{ data.workspaceId }}">
     View in Lightfast
   </a>
   ```

3. **Configure batching**
   - Window: 5 minutes (reduces ~80% email volume)
   - Batch key: `workspaceId` (batch per workspace, not globally)
   - Template receives `{{ total_activities }}` and `{{ activities }}` array

**Success criteria**: Triggering a Knock workflow results in both in-app notification AND email after 5-min batch window.

### 2.2 Notification Preferences UI (Knock Preference Center)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/notifications/page.tsx` (new)

Knock provides an embeddable `<PreferencesModal>` React component from `@knocklabs/react`. This handles:
- Per-workflow opt-in/out (observation-captured, etc.)
- Per-channel preference (in-app, email, Slack)
- Digest frequency settings

```typescript
import { KnockProvider, PreferencesModal } from "@knocklabs/react";

// Embed Knock's preference center component
// User can toggle: in-app feed on/off, email on/off, per workflow
```

Add navigation link in workspace settings sidebar.

**Success criteria**: User can toggle email notifications on/off from Settings. Knock respects the preference.

### 2.3 Existing Email Infrastructure (No Changes)

The following stay exactly as-is — they are NOT notification emails:
- `packages/email/src/templates/code-email.tsx` → auth code emails via `sendResendEmailSafe()`
- `packages/email/src/functions/all.ts` → Resend Audiences `early-access` contact management
- `vendor/email/src/index.ts` → Resend client factory (used by `apps/www` only)

These transactional/marketing emails bypass Knock entirely. No changes needed.

---

## Phase 3: Slack Notifications + Outbound Webhooks

**Goal**: Add Slack as a third notification channel via Knock SlackKit, and build outbound webhook infrastructure via Svix.
**Estimated scope**: ~5-7 days.

### 3.1 Slack App Creation (Manual, One-Time)

1. **Create Slack App** at `api.slack.com/apps`
   - App Name: `Lightfast Notifications`
   - OAuth redirect URL: `https://api.knock.app/oauth/slack/callback` (Knock manages the callback)
   - Bot Token Scopes: `channels:read`, `chat:write`
   - Record: App ID, Client ID, Client Secret

2. **Configure in Knock Dashboard**
   - Knock Dashboard → Channels and sources → Create channel → Chat → Slack (SlackKit)
   - Enter: Slack App ID, Client ID, Client Secret
   - Knock now manages Slack OAuth entirely

3. **Add Slack step to `observation-captured` workflow**
   - After email step
   - Channel: Slack (SlackKit)
   - Block Kit template:

   ```json
   {
     "blocks": [
       {
         "type": "header",
         "text": {
           "type": "plain_text",
           "text": "{{ data.observationType | capitalize }}: Score {{ data.significanceScore }}/100"
         }
       },
       {
         "type": "section",
         "text": {
           "type": "mrkdwn",
           "text": "*Topics:* {{ data.topics | join: ', ' }}"
         }
       },
       {
         "type": "actions",
         "elements": [
           {
             "type": "button",
             "text": { "type": "plain_text", "text": "View in Lightfast" },
             "url": "https://lightfast.ai/w/{{ data.workspaceId }}/observations/{{ data.observationId }}"
           }
         ]
       }
     ]
   }
   ```

**Success criteria**: Slack App created, registered in Knock, workflow has Slack step.

### 3.2 Slack Connection UI (SlackKit Components)

**New file**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/integrations/slack/page.tsx`

This page uses Knock's pre-built SlackKit React components:

```typescript
import {
  SlackAuthButton,
  SlackAuthContainer,
  SlackChannelCombobox,
} from "@knocklabs/react";
```

**Page structure**:
- If not connected: Show `SlackAuthButton` → redirects to Slack OAuth consent → Knock handles callback and token storage
- If connected: Show workspace name, `SlackChannelCombobox` for channel selection, "Send Test" button, "Disconnect" button

**Key implementation details**:
- SlackKit requires `tenantId` — use the workspace's `clerkOrgId` (already used as Knock tenant in `dispatch.ts:75`)
- Knock stores Slack bot token on the Tenant entity — Lightfast never sees the token
- Channel selection is saved as `channel_data` on a Knock Object

**Environment variables** (new):
- `NEXT_PUBLIC_SLACK_CLIENT_ID` — needed by SlackKit UI components
- Add to `turbo.json` → `globalEnv`
- Add to `vendor/knock/src/env.ts` → client-side validation

**Files to modify**:
- `turbo.json` — add `NEXT_PUBLIC_SLACK_CLIENT_ID` to `globalEnv`
- `vendor/knock/src/env.ts` — add `NEXT_PUBLIC_SLACK_CLIENT_ID` client-side validation
- `apps/console/package.json` — no new deps needed (SlackKit is in `@knocklabs/react`)

**Success criteria**: User can click "Connect Slack" → authorize → select channel → receive test notification in Slack.

### 3.3 Svix Vendor Package (Outbound Webhooks)

**New package**: `vendor/svix/`

```
vendor/svix/
  src/
    index.ts          # Svix client singleton
    env.ts            # SVIX_API_KEY validation (t3-env)
  env.ts              # Root re-export
  package.json        # dependency: svix
  tsconfig.json
```

**`vendor/svix/src/index.ts`**:
```typescript
import { Svix } from "svix";
import { env } from "./env";

const key = env.SVIX_API_KEY;
export const svix = key ? new Svix(key) : null;
```

Pattern matches `@vendor/knock/src/index.ts` exactly — singleton with null fallback.

**`vendor/svix/src/env.ts`**:
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SVIX_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    SVIX_API_KEY: process.env.SVIX_API_KEY,
  },
});
```

**Environment variables** (new):
- `SVIX_API_KEY` — from Svix dashboard after account creation
- Add to `turbo.json` → `globalEnv`

**Success criteria**: `@vendor/svix` package builds, exports `svix` client, env validation passes.

### 3.4 Database Schema: Add `svixAppId` to orgWorkspaces

**File**: `db/console/src/schema/tables/org-workspaces.ts`

Add one column:
```typescript
svixAppId: varchar("svix_app_id", { length: 255 }),
```

Nullable — workspaces created before Svix integration won't have this.

**Migration**:
```bash
cd db/console && pnpm db:generate && pnpm db:migrate
```

**Success criteria**: Column exists, migration runs cleanly, existing data unaffected.

### 3.5 Svix App Lifecycle

When a workspace is created, create a corresponding Svix Application. When deleted, delete it.

**File to modify**: `api/console/src/router/org/workspace.ts`

In the workspace creation mutation:
```typescript
// After workspace is created in DB:
if (svix) {
  const svixApp = await svix.application.create({
    name: workspace.name,
    uid: workspace.id, // Use workspace ID as external UID for idempotency
  });
  await db.update(orgWorkspaces)
    .set({ svixAppId: svixApp.id })
    .where(eq(orgWorkspaces.id, workspace.id));
}
```

For existing workspaces without `svixAppId`, create Svix app lazily on first webhook endpoint creation.

**Success criteria**: New workspaces get Svix apps. Existing workspaces get them on first webhook setup.

### 3.6 Webhook Fan-Out Inngest Function

**New file**: `api/console/src/inngest/workflow/webhooks/fan-out.ts`

```typescript
// Subscribes to multiple Inngest events:
// - observation.captured → webhook event type: "observation.created"
// - sync.completed → webhook event type: "sync.completed"
// - source.connected.github → webhook event type: "source.connected"
// - source.disconnected → webhook event type: "source.disconnected"
//
// For each event:
//   1. Look up workspace's svixAppId from DB
//   2. If no svixAppId, skip (workspace has no webhook config)
//   3. Map Inngest event payload → public webhook payload
//      (strip internal fields like clerkOrgId, add eventId + timestamp + version)
//   4. Call svix.message.create(svixAppId, { eventType, payload })
//   5. Svix handles routing, signing, retry, logging
```

**Event mapping** (Tier 1 — ship first):

| Inngest Event | Webhook Event Type | Payload Fields |
|---|---|---|
| `observation.captured` | `observation.created` | observationId, observationType, significanceScore, topics, clusterId, workspaceId |
| `sync.completed` | `sync.completed` | sourceId, jobId, success, filesProcessed, embeddingsCreated |
| `source.connected.github` | `source.connected` | workspaceId, sourceId, sourceType |
| `source.disconnected` | `source.disconnected` | sourceId, deleteData |

**Webhook payload envelope**:
```json
{
  "id": "evt_<nanoid>",
  "type": "observation.created",
  "timestamp": "2026-02-07T12:00:00Z",
  "version": "2026-02-07",
  "data": { ... }
}
```

**Register in Inngest**:
- `api/console/src/inngest/workflow/webhooks/index.ts` — re-export
- `api/console/src/inngest/index.ts` — add `webhookFanOut` to `createInngestRouteContext()` functions array

**Success criteria**: Events flowing through Inngest trigger Svix message creation. Svix dashboard shows messages.

### 3.7 Webhook Management tRPC Router

**New file**: `api/console/src/router/org/webhooks.ts`

Endpoints (all under `orgRouter` — require org membership):

| Endpoint | Type | Purpose |
|---|---|---|
| `webhooks.listEndpoints` | Query | List webhook endpoints for workspace (proxy to Svix) |
| `webhooks.createEndpoint` | Mutation | Register new endpoint (URL, subscribed event types, description) |
| `webhooks.updateEndpoint` | Mutation | Update endpoint config |
| `webhooks.deleteEndpoint` | Mutation | Remove endpoint |
| `webhooks.getPortalUrl` | Query | Get Svix app portal URL for embedded management UI |
| `webhooks.sendTestMessage` | Mutation | Send test event to endpoint |

**Register in root router**:
- `api/console/src/root.ts` — add `webhooks: webhooksRouter` to `orgRouter`

**Lazy Svix app creation**: If workspace has no `svixAppId`, create one on first `createEndpoint` call.

**Success criteria**: All CRUD operations work. Portal URL returns valid Svix embed URL.

### 3.8 Webhook Management UI

**New file**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/integrations/webhooks/page.tsx`

**Phase 1 approach**: Embed Svix App Portal (zero custom UI needed).

```typescript
// Get portal URL from tRPC
const { data } = api.org.webhooks.getPortalUrl.useQuery({ workspaceId });

// Render Svix portal in iframe
<iframe src={data.url} className="w-full h-[600px] border-0 rounded-lg" />
```

The Svix portal provides:
- Endpoint CRUD (add/edit/delete webhook URLs)
- Event type subscription management
- Delivery logs with request/response inspection
- Retry failed deliveries
- Test endpoint functionality

**Success criteria**: User can add webhook endpoint, select event types, see delivery logs, all within embedded portal.

---

## Phase 4: Unified Integrations Page

**Goal**: Create a single "Integrations" page that shows all connectors (data sources) and channels (notification delivery) with consistent taxonomy.
**Estimated scope**: ~3-4 days.

### 4.1 Terminology Decisions

| Term | Definition | Where Used |
|---|---|---|
| **Integration** | Top-level page name | UI page title, navigation |
| **Connector** | Data source that syncs INTO Lightfast | GitHub, Vercel, Linear, Sentry |
| **Channel** | Notification delivery OUT of Lightfast | In-App, Email, Slack, Webhooks |

**No internal renames** — DB tables (`workspaceIntegrations`, `userSources`), tRPC routers, validation schemas all stay as-is. Only user-facing text changes.

### 4.2 Integrations Page

**New file**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/integrations/page.tsx`

**Layout** — two sections:

**Data Connectors section**:
- GitHub → [Connected] / [Connect]
- Vercel → [Connected] / [Connect]
- Linear → [Coming Soon]
- Sentry → [Coming Soon]
- Notion → [Coming Soon]

**Notification Channels section**:
- In-App Feed → [Active] (always on)
- Email → [Configure] (links to notification preferences)
- Slack → [Connect] / [Connected] (links to Slack settings page)
- Webhooks → [Configure] (links to webhook management page)
- Discord → [Coming Soon]

**Card component**: Reuse/extend existing integration card patterns from `latest-integrations.tsx`:
- 48x48 icon (from `@repo/ui/integration-icons`)
- Name
- One-line description
- Status badge (Connected = green dot, Available = blue button, Coming Soon = gray)
- CTA button linking to detail page

### 4.3 Navigation Updates

**Files to modify**:

1. **Settings sidebar** — Add "Integrations" link in workspace settings navigation
   - Find the settings sidebar component (likely in `(manage)/settings/` layout)
   - Add link: `/[slug]/[workspaceName]/settings/integrations`

2. **Minor text updates**:
   - `latest-integrations.tsx` — change heading from "Latest Integrations" to "Active Connectors" (or remove if superseded by new integrations page)

### 4.4 Detail Pages (Connect Existing Flows)

The detail pages for each integration should link to existing flows:

| Integration | Detail Page Action |
|---|---|
| GitHub (connected) | Link to existing sources/connect flow, show connected repos, disconnect option |
| Vercel (connected) | Link to existing sources/connect flow, show connected projects, disconnect option |
| Email | Link to notification preferences page (Phase 2) |
| Slack | Link to Slack settings page (Phase 3) |
| Webhooks | Link to webhook management page (Phase 3) |

### 4.5 Clean Up Dead Code

- **`api/console/src/router/org/integration.ts`** — the `integrationRouter` is empty (`{ github: {} }`). Either:
  - Remove entirely and clean up import in `root.ts`, OR
  - Repurpose as the new webhooks/integrations API (but `webhooksRouter` already covers this)
  - Decision: Remove it. The `webhooksRouter` and existing `sourcesRouter` cover all needs.

**Success criteria**: Single "Integrations" page shows all connectors and channels. Each links to its detail/config page. Consistent terminology.

---

## Environment Variable Summary

### Existing (No Changes)
| Variable | Location | Purpose |
|---|---|---|
| `KNOCK_API_KEY` | server env, `turbo.json` | Knock server-side API |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | client env, `turbo.json` | Knock client-side |
| `RESEND_API_KEY` | server env, `turbo.json` | Resend email delivery |

### New
| Variable | Location | Purpose | Phase |
|---|---|---|---|
| `NEXT_PUBLIC_SLACK_CLIENT_ID` | client env, `turbo.json`, `vendor/knock/src/env.ts` | SlackKit UI components | 3 |
| `SVIX_API_KEY` | server env, `turbo.json`, `vendor/svix/src/env.ts` | Svix webhook infrastructure | 3 |

### Dashboard-Only (Not in Codebase)
| Variable | Where Configured | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Knock Dashboard (Resend channel config) | Knock → Resend delivery |
| `SLACK_CLIENT_SECRET` | Knock Dashboard (SlackKit config) | Slack OAuth |

---

## File Change Summary

### New Files

| File | Phase | Purpose |
|---|---|---|
| `api/console/src/router/user/notifications.ts` | 1 | Knock user token signing tRPC procedure |
| `vendor/svix/src/index.ts` | 3 | Svix client singleton |
| `vendor/svix/src/env.ts` | 3 | Svix env validation |
| `vendor/svix/env.ts` | 3 | Root re-export |
| `vendor/svix/package.json` | 3 | Package manifest |
| `vendor/svix/tsconfig.json` | 3 | TypeScript config |
| `api/console/src/inngest/workflow/webhooks/fan-out.ts` | 3 | Inngest → Svix fan-out |
| `api/console/src/inngest/workflow/webhooks/index.ts` | 3 | Re-export |
| `api/console/src/router/org/webhooks.ts` | 3 | Webhook management tRPC router |
| `apps/console/src/app/.../settings/integrations/slack/page.tsx` | 3 | Slack connection UI |
| `apps/console/src/app/.../settings/integrations/webhooks/page.tsx` | 3 | Webhook management UI |
| `apps/console/src/app/.../settings/notifications/page.tsx` | 2 | Notification preferences |
| `apps/console/src/app/.../settings/integrations/page.tsx` | 4 | Unified integrations page |

### Modified Files

| File | Phase | Change |
|---|---|---|
| `vendor/knock/src/components/provider.tsx` | 1 | Accept `userToken` prop |
| `apps/console/src/components/notifications-provider.tsx` | 1 | Fetch + pass signed userToken |
| `api/console/src/root.ts` | 1, 3 | Add notificationsRouter (P1), webhooksRouter (P3) |
| `db/console/src/schema/tables/org-workspaces.ts` | 3 | Add `svixAppId` column |
| `api/console/src/router/org/workspace.ts` | 3 | Create Svix app on workspace creation |
| `api/console/src/inngest/index.ts` | 3 | Register webhookFanOut function |
| `turbo.json` | 3 | Add SVIX_API_KEY, NEXT_PUBLIC_SLACK_CLIENT_ID to globalEnv |
| `vendor/knock/src/env.ts` | 3 | Add NEXT_PUBLIC_SLACK_CLIENT_ID |
| `apps/console/src/app/.../sources/_components/latest-integrations.tsx` | 4 | Update heading text |

### Deleted Files

| File | Phase | Reason |
|---|---|---|
| `api/console/src/router/org/integration.ts` | 4 | Empty router, dead code |

### DB Migrations

| Migration | Phase | Change |
|---|---|---|
| Auto-generated via `pnpm db:generate` | 3 | Add `svix_app_id` column to `lightfast_org_workspaces` |

---

## Open Question Decisions

These were listed as open in the architecture design. Here are pragmatic decisions for each:

### 1. Feed channel ID hardcoding
**Decision**: Keep hardcoded `"lightfast-console-notifications"` for now. Moving to env var adds complexity without benefit — there's only one feed channel and it's unlikely to change. Revisit if multi-feed support is needed.

### 2. Recipient model (org vs individual)
**Decision**: Keep org-level recipients (`clerkOrgId`). Configure Knock to handle org → member expansion via Knock Objects/Subscriptions. This is simpler than resolving individual users in the Inngest function and lets Knock manage the fan-out + per-user preferences.

### 3. Email digest frequency
**Decision**: Fixed 5-minute batch window initially. User-configurable via Knock Preference Center (which supports frequency preferences). Don't build custom frequency UI — Knock handles it.

### 4. Svix self-hosted vs cloud
**Decision**: Svix Cloud (free tier: 50k msg/month). Self-hosting adds operational complexity for zero benefit at current scale. Re-evaluate if monthly webhook volume exceeds 50k or if data residency requirements emerge.

### 5. Slack Enterprise Grid
**Decision**: Workspace-level installs only (standard OAuth). Enterprise Grid support deferred — it adds significant complexity (org-wide admin approval, workspace enumeration) and is only needed if enterprise customers request it.

### 6. Webhook event versioning
**Decision**: Date-based versioning (`2026-02-07`). Include `version` field in every webhook payload. When payload shapes change, bump the date. Matches Stripe's pattern. Simpler than semver for webhook payloads.

### 7. Phase 2 custom Slack bot
**Decision**: Defer indefinitely. SlackKit covers one-way notifications. A custom `@slack/bolt` bot is only worth building if users explicitly request interactive features (slash commands, buttons with server actions). Don't pre-build.

### 8. notification.dispatch generic event
**Decision**: Leave as-is in the Inngest schema for now. It's dead code but doesn't hurt. If future workflows need a generic notification dispatch (not tied to observation.captured), this event schema is ready. Don't remove it — it costs nothing to keep.

---

## Dependencies & Ordering

```
Phase 1.1 (Knock Dashboard) ──→ Phase 1.2 (Token Signing) ──→ Phase 1.3 (E2E Verify)
                                                                        │
                                                                        ▼
                                                              Phase 2.1 (Resend Channel)
                                                              Phase 2.2 (Preferences UI)
                                                                        │
                                                                        ▼
                                              ┌─────────────────────────┴──────────────────────┐
                                              ▼                                                ▼
                                    Phase 3.1-3.2 (Slack)                          Phase 3.3-3.8 (Webhooks)
                                              │                                                │
                                              └─────────────────────────┬──────────────────────┘
                                                                        ▼
                                                              Phase 4 (Integrations Page)
```

- Phase 1 is the foundation — must complete first
- Phase 2 depends on Phase 1 (Knock must be working)
- Phase 3 Slack and Phase 3 Webhooks are independent of each other — can run in parallel
- Phase 4 depends on Phase 3 (needs Slack + Webhook pages to exist for linking)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Knock dashboard config doesn't match code constants | Medium | High — no notifications work | Verify `observation-captured` workflow key and `lightfast-console-notifications` channel ID exactly match code |
| Knock enhanced security mode breaks existing dev flow | Low | Medium | Test in development first, ensure token signing works before enabling |
| SlackKit components don't match Knock React package version | Low | Medium | Check `@knocklabs/react@^0.8.11` includes SlackKit; upgrade if needed |
| Svix free tier limits hit during testing | Very Low | Low | 50k messages/month is generous; monitor usage |
| Existing `packages/email` flows break | Very Low | Low | No changes to existing email code; Knock email is additive |

---

## Testing Strategy

### Phase 1
- Manual: Push commit → verify bell icon shows notification
- Manual: Verify HMAC-signed user token in Knock provider (inspect network request)

### Phase 2
- Manual: Trigger notification → verify email arrives after 5-min batch window
- Manual: Toggle email off in preferences → verify no email sent

### Phase 3 (Slack)
- Manual: Connect Slack → select channel → trigger notification → verify Slack message
- Manual: Disconnect Slack → verify no more Slack messages

### Phase 3 (Webhooks)
- Manual: Create webhook endpoint → trigger event → verify delivery in Svix logs
- Integration: Use Svix CLI to inspect webhook deliveries
- Manual: Verify webhook payload format matches documented schema

### Phase 4
- Visual: Integrations page shows correct status badges for all connectors/channels
- Manual: All "Configure" / "Connect" links navigate to correct detail pages
