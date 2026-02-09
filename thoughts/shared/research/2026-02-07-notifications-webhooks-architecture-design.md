---
date: 2026-02-07
researcher: architect-agent
topic: "Notifications, Email, Webhooks Architecture Design"
tags: [research, architecture, knock, resend, slack, webhooks, integrations]
status: complete
based_on:
  - 2026-02-07-notifications-webhooks-codebase-deep-dive.md
  - 2026-02-07-notifications-webhooks-external-research.md
---

# Architecture Design: Notifications, Email, and Outbound Webhooks

## Executive Summary

This document synthesizes findings from a codebase deep dive (identifying 100% code-complete but 0% configured Knock infrastructure, two separate Resend implementations, zero outbound webhook code, and pervasive terminology inconsistency) with external research (52 sources covering Knock+Resend integration, Slack OAuth V2 best practices, Svix webhook infrastructure, and industry integration taxonomy).

**The core architectural insight**: Lightfast already has the hardest parts built -- a neural observation pipeline emitting 30+ typed Inngest events, a relationship graph linking cross-source entities, and a Knock vendor package wired into the console. What's missing is configuration, not code. The remaining work is (1) Knock dashboard setup, (2) Resend as Knock email channel, (3) Slack via Knock SlackKit, (4) Svix for outbound webhooks, and (5) a unified taxonomy to replace the current integrations/connectors/sources/providers confusion.

**Key decisions:**
- **Email**: Use Knock + Resend (Resend as Knock email channel provider, Knock handles templates/batching/preferences)
- **Resend Audiences**: Do NOT use now. Defer to future marketing phase. Knock covers all notification use cases.
- **Slack**: Use Knock SlackKit for Phase 1 notifications. Add custom `@slack/bolt` bot in Phase 2 only if interactive features are needed.
- **Taxonomy**: "Integrations" as the top-level user-facing page. "Connectors" for data source connections (GitHub, Linear). "Channels" for notification delivery (email, Slack, webhooks).
- **Outbound Webhooks**: Use Svix (free tier: 50k messages/month). Build-your-own would cost 10x more in engineering time for inferior reliability.

---

## 1. Existing Foundation

### What's Built and Working

| Component | Status | Key Detail |
|-----------|--------|------------|
| `@vendor/knock` package | 100% code-complete | Client singleton, KnockProvider, bell icon trigger, 230-line custom CSS theme |
| Console frontend (provider + bell) | 100% code-complete | NotificationsProvider bridges Clerk userId to Knock |
| Notification dispatch workflow | 100% code-complete | Inngest function: `observation.captured` (significance >= 70) -> Knock trigger |
| CSP security config | 100% code-complete | `api.knock.app` (HTTPS + WSS), `cdn.knock.app` allowed |
| `@vendor/email` (Resend wrapper) | 100% code-complete | `createEmailClient(apiKey)` -> `new Resend(apiKey)` |
| `packages/email` (templates + functions) | 100% code-complete | React Email sign-in template, `sendResendEmailSafe()`, audience contact management |
| Resend Audiences | Partially configured | `early-access` audience exists (ID: `566b084b-...`), used by waitlist flow |
| Inbound webhooks (GitHub, Vercel) | 100% code-complete | Full transformer pipeline, HMAC verification, raw payload storage |
| Inngest event catalog | 30+ events defined | Complete type-safe schemas in `client.ts:24-841` |
| Relationship graph | 100% code-complete | Cross-source linking: commit SHAs, branch names, issue IDs, PR numbers |
| Environment variables | Set | `KNOCK_API_KEY` and `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` in `.env.development.local` |

### What's NOT Built

| Component | Status | Gap |
|-----------|--------|-----|
| Knock dashboard configuration | 0% | No workflow, no channels, no templates created |
| Knock user token signing | Missing | Raw `userId` passed to KnockProvider; production requires HMAC-signed tokens |
| Email via Knock | Not connected | Resend and Knock operate independently |
| Slack code | 0% | Zero routes, zero OAuth, zero SlackKit components, zero env vars |
| Outbound webhooks | 0% | No DB table, no delivery system, no UI |
| Notification preferences UI | 0% | Users cannot configure channels or opt-out |

### Known Code Deviations

| Plan Spec | Actual Implementation | Impact |
|-----------|----------------------|--------|
| `KNOCK_SECRET_API_KEY` | `KNOCK_API_KEY` | Minor naming difference |
| `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID` env var | Hardcoded `"lightfast-console-notifications"` | Feed ID not configurable |
| Recipients: resolve from `orgMembers` DB | Uses `clerkOrgId` directly as single recipient | Knock must be configured for org -> member expansion |
| `notification.dispatch` generic event | Unused; actual dispatch listens to `observation.captured` directly | Dead code in Inngest schema |

---

## 2. External Capabilities (Key Vendor Features)

### Knock
- **Workflow engine**: Multi-step workflows with delays, conditions, branches, batching
- **Preference center**: Per-workflow, per-channel user opt-in/out (embeddable React component)
- **Batch/Digest**: Time-window batching (e.g., 5-min) reduces email volume 5-10x; daily digest reduces 30-50x
- **SlackKit**: Managed OAuth for Slack workspace connections, channel selection combobox, Block Kit templates with Liquid
- **Outbound webhooks**: `message.sent`, `message.delivered`, `message.bounced`, etc. -- 8 retry attempts with exponential backoff
- **Pricing**: Free 10k messages/mo; Starter $250/mo for 50k; multi-channel sends count separately

### Resend
- **Email API**: React Email templates, batch sending (100/call), scheduling, attachments
- **Audiences**: Contact lists, broadcasts, unsubscribe management -- included in Pro ($20/mo)
- **Webhook events**: 7 delivery tracking event types (sent, delivered, bounced, opened, clicked, etc.)
- **Pricing**: Free 100 emails/day; Pro $20/mo for 50k

### Svix
- **Webhook infrastructure**: Enterprise-grade sending, retrying, signing, logging, customer portal
- **Free tier**: 50k messages/month, 99.9% SLA
- **Pro tier**: $490/mo for 2.5M messages, 99.99% SLA
- **Self-hostable**: Rust + PostgreSQL + Redis under SSPL license
- **SDKs**: JS, Python, Ruby, Go, Rust, Java, C#, PHP, Terraform

---

## Proposed Design

### 1. Email Architecture (Knock + Resend)

#### Decision: Resend as Knock Email Channel Provider

Knock renders and routes all notification emails. Resend is the delivery layer only.

```
Inngest observation.captured (significance >= 70)
  -> Knock workflow trigger
    -> Knock template engine (Liquid)
      -> Resend API (pre-rendered HTML delivery)
        -> Recipient inbox
```

**Why this way, not direct Resend calls for notifications:**
- Knock provides user preferences (opt-in/out per workflow, per channel)
- Knock provides batching/digest (5-min window or daily digest)
- Knock provides multi-channel routing (same trigger -> in-app + email + Slack)
- Knock provides delivery tracking and retry
- Direct Resend calls remain for non-notification emails (auth codes via `packages/email`)

#### Configuration Steps (Knock Dashboard)

1. **Create Resend email channel**
   - Knock Dashboard -> Channels and sources -> Create channel -> Resend
   - Add `RESEND_API_KEY` (existing key, re_prefix validated)
   - Set `from: noreply@lightfast.ai` (requires domain verification in Resend)
   - Set `fromName: Lightfast`

2. **Create workflow `observation-captured`**
   - Must match `OBSERVATION_WORKFLOW_KEY` constant in `dispatch.ts`
   - Add in-app feed channel step (channel ID matching `"lightfast-console-notifications"`)
   - Add email channel step (Resend) with batching

3. **Configure email batching**
   - Recommended: 5-minute batch window initially
   - Reduces 50k triggers -> ~10k emails (80% reduction)
   - Template receives `{{ total_activities }}` and `{{ activities }}` array

4. **Email template (Liquid)**

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

5. **User token signing (CRITICAL for production)**
   - Current code passes raw `userId` to KnockProvider -- insecure
   - Must implement server-side HMAC signing:
   ```typescript
   // api/console route or tRPC procedure
   import { Knock } from "@knocklabs/node";
   const knock = new Knock({ apiKey: env.KNOCK_API_KEY });
   const userToken = await knock.signUserToken(userId);
   ```
   - Pass `userToken` prop to KnockProvider

#### Existing Email Infrastructure (Unchanged)

The following continues to operate independently of Knock:
- **Auth code emails**: `packages/email/src/templates/code-email.tsx` via `sendResendEmailSafe()`
- **Waitlist contacts**: `addToWaitlistContactsSafe()` for Resend Audiences `early-access`

These are transactional/marketing emails that don't go through the notification pipeline.

---

### 2. Resend Audiences Recommendation

#### Decision: Do NOT Use Resend Audiences for Notifications. Defer to Marketing Phase.

**Reasoning:**

| Use Case | Solution | Why Not Audiences |
|----------|----------|-------------------|
| Observation notifications | Knock workflows | Knock provides preferences, batching, multi-channel |
| Job completion alerts | Knock workflows | Same as above |
| Workspace invites | Knock workflows | Same as above |
| Daily/weekly digest | Knock digest schedules | Knock handles digest aggregation natively |
| Product updates (future) | **Resend Audiences** | Broadcast to all users regardless of Knock preferences |
| Changelog emails (future) | **Resend Audiences** | Marketing email, not notification |
| Early access waitlist (existing) | **Resend Audiences** | Already configured, keep as-is |

**Current state**: The `early-access` audience (ID: `566b084b-...`) exists and should remain. No new audiences needed now.

**When to revisit**: When Lightfast launches public blog/changelog and wants to send marketing emails to all users. At that point, add audiences like `product-updates`, `changelog`, `enterprise-users`. Cost: included in Resend Pro ($20/mo).

---

### 3. Slack Bot Install UX

#### Decision: Knock SlackKit for Phase 1, Optional Custom Bot for Phase 2

**Phase 1 (SlackKit)** gives: One-way notifications to Slack channels via Knock's managed OAuth. No infrastructure to host. Channel selection combobox. Block Kit templates.

**Phase 2 (Custom `@slack/bolt`)** adds: Slash commands (`/lightfast search`), interactive buttons, modals, cross-source enriched messages via relationship graph. Only needed if users demand interactive features.

#### Complete User Flow (Phase 1: SlackKit)

```
1. User navigates to: Settings -> Integrations -> Slack
   ┌──────────────────────────────────────────────────────┐
   │  Slack                                    [Available] │
   │                                                       │
   │  Get notified about observations, search results,     │
   │  and workspace events directly in Slack.              │
   │                                                       │
   │  Permissions needed:                                  │
   │  - Post messages to channels                          │
   │  - Read channel list (for setup)                      │
   │                                                       │
   │  [Connect Slack]                                      │
   └──────────────────────────────────────────────────────┘

2. User clicks "Connect Slack" -> SlackAuthButton (Knock React component)
   -> Redirects to Slack OAuth consent page
   -> User selects their Slack workspace
   -> User approves scopes (channels:read, chat:write)
   -> Slack redirects to https://api.knock.app/oauth/slack/callback
   -> Knock stores bot token on Tenant entity (workspaceId)

3. Post-install configuration:
   ┌──────────────────────────────────────────────────────┐
   │  Slack                                  [Connected]   │
   │  Workspace: Acme Corp                                │
   │                                                       │
   │  Notification Channel                                │
   │  [#engineering          v]  [Send Test]              │
   │                                                       │
   │  Notification Types                                  │
   │  [x] High-significance observations (score >= 70)    │
   │  [x] Job completions                                 │
   │  [ ] All observations                                │
   │                                                       │
   │  [Disconnect]              [Save Changes]            │
   └──────────────────────────────────────────────────────┘

4. Channel selection uses SlackChannelCombobox (Knock React component)
   -> Fetches channels from connected Slack workspace via Knock
   -> User selects channel
   -> Selection stored on Knock Object as channel_data
```

#### OAuth Flow Architecture

```
                  Console UI                     Knock                    Slack
                      |                            |                       |
  User clicks    [SlackAuthButton]                 |                       |
  "Connect"           |--- redirect ------------->  |                       |
                      |                            |--- OAuth authorize -->  |
                      |                            |                       |
                      |                            |   User approves       |
                      |                            |<-- auth code ------   |
                      |                            |                       |
                      |                            |--- exchange code -->   |
                      |                            |<-- bot token ------   |
                      |                            |                       |
                      |                   Store token on                   |
                      |                   Tenant(workspaceId)              |
                      |<-- redirect back ------    |                       |
                      |                            |                       |
  Channel selection   |                            |                       |
  [SlackChannelCombobox]                           |                       |
                      |--- list channels -------> |--- conversations.list ->|
                      |<-- channel list ---------- |<-- channel list -------|
                      |                            |                       |
  User selects        |--- save channel --------> |                       |
  #engineering        |   (Object channel_data)    |                       |
```

**Token storage**: Knock manages all Slack tokens on the Tenant entity. Lightfast never stores Slack tokens directly. This is a security advantage -- reduces attack surface.

**Multi-tenant model**: Each Lightfast workspace maps to a Knock Tenant. Each tenant can have one Slack workspace connection. This is a 1:1 mapping (one Lightfast workspace -> one Slack workspace).

#### Slack Block Kit Template (Knock Liquid)

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

#### Knock Dashboard Configuration for Slack

1. **Create Slack App** at `api.slack.com/apps`
   - Name: "Lightfast Notifications"
   - OAuth redirect URL: `https://api.knock.app/oauth/slack/callback`
   - Bot token scopes: `channels:read`, `chat:write`
2. **Create Slack channel in Knock Dashboard**
   - Channels and sources -> Create channel -> Slack (SlackKit)
   - Enter: App ID, Client ID, Client Secret
3. **Add Slack step to `observation-captured` workflow**
   - After in-app feed step and email step
   - Configure Block Kit template with Liquid variables
4. **Environment variables** (new):
   - `SLACK_CLIENT_ID` -- for SlackKit UI components
   - `SLACK_CLIENT_SECRET` -- for Knock dashboard config only (not in app code)

#### Console UI Components to Build

```typescript
// apps/console/src/app/(app)/[orgSlug]/settings/integrations/slack/page.tsx
// New page: Slack integration settings

// Uses from @knocklabs/react:
import {
  KnockSlackProvider,
  SlackAuthButton,
  SlackAuthContainer,
  SlackChannelCombobox,
} from "@knocklabs/react";

// Wrapped in existing KnockProvider (already in notifications-provider.tsx)
// Requires tenantId={workspaceId} for multi-tenant mapping
```

#### Error Handling

| Error | Handling |
|-------|----------|
| `token_revoked` | Mark as disconnected in UI, prompt re-auth |
| `channel_not_found` | Show warning, prompt to reconfigure |
| `missing_scope` | Show re-authorization flow |
| `rate_limited` | Knock handles retry internally |

---

### 4. Integrations vs Connectors Taxonomy

#### Decision: Three-Tier Terminology

| Term | Definition | Where Used | Examples |
|------|-----------|------------|---------|
| **Integration** | Top-level page name. Any connection between Lightfast and an external service. | UI page title, navigation, marketing overview | "Integrations page", "Manage integrations" |
| **Connector** | A data source connection that syncs information INTO Lightfast. | UI cards for GitHub/Linear/Vercel/Sentry, marketing feature page, backfill system | "GitHub Connector", "Linear Connector" |
| **Channel** | A notification delivery endpoint that sends information OUT of Lightfast. | UI cards for Email/Slack/Webhooks, notification settings | "Slack Channel", "Email Channel", "Webhook Channel" |

#### Integrations Page Structure

```
Settings -> Integrations (top-level page)
  |
  +-- Data Connectors (section)
  |   +-- GitHub          [Connected]      "Sync repos, PRs, issues"
  |   +-- Vercel          [Connected]      "Sync deployments"
  |   +-- Linear          [Available]      "Sync issues and projects"
  |   +-- Sentry          [Available]      "Sync errors and incidents"
  |   +-- Notion          [Coming Soon]    "Sync pages and databases"
  |
  +-- Notification Channels (section)
  |   +-- In-App Feed     [Active]         "Bell icon notifications"
  |   +-- Email           [Configure]      "Email digests via Resend"
  |   +-- Slack           [Connect]        "Slack channel notifications"
  |   +-- Webhooks        [Configure]      "HTTP webhooks for automation"
  |   +-- Discord         [Coming Soon]    "Discord channel notifications"
  |
  +-- Automation (section, future)
      +-- Zapier          [Coming Soon]    "Connect to 5000+ apps"
```

#### Migration Path from Current Inconsistencies

| Current State | Target State | Migration |
|--------------|-------------|-----------|
| DB: `workspaceIntegrations` table | Keep as-is | No DB rename needed -- internal name is fine |
| DB: `userSources` table | Keep as-is | Internal name, maps to "connector" in UI |
| Validation: `SourceType`, `sourceTypeSchema` | Keep as-is | Internal type, maps to connector providers |
| tRPC: `integrationRouter` (empty) | Remove or repurpose | Clean up dead code, or repurpose for new integrations page API |
| tRPC: `sourcesRouter`, `userSourcesRouter` | Keep as-is | Internal naming is fine |
| Backfill: `BackfillConnector` | Keep as-is | Already uses "connector" correctly |
| UI: `GitHubConnector`, `VercelConnector` | Keep as-is | Already uses "connector" correctly |
| UI sidebar: "Latest Integrations" | Rename to "Connected" or "Active Connectors" | Minor text change |
| UI: `ProviderSelector` | Keep as-is, or rename to `ConnectorSelector` | Optional refactor |
| Marketing: "Connectors" page | Keep as-is | Consistent with new taxonomy |
| Inngest: `source.connected.github` | Keep as-is | Internal event naming is fine |
| Activity: `category: "integration"` | Keep as-is | Internal tracking category |

**Principle**: Rename user-facing text only. Do NOT rename DB tables, tRPC routers, or internal types. The cost of internal renaming is high and the benefit is near-zero since users never see internal names.

#### Status Badges

| Badge | Meaning | Visual |
|-------|---------|--------|
| Connected / Active | Integration installed and working | Green dot |
| Available | Ready to connect, not yet configured | Blue "Connect" button |
| Configure | Partially set up, needs configuration | Yellow "Configure" button |
| Coming Soon | Not yet available | Gray badge, disabled |
| Beta | Available for testing | Purple "Beta" badge |

---

### 5. Outbound Webhook System

#### Decision: Use Svix

**Why Svix over build-your-own:**

| Factor | Svix | Build Your Own |
|--------|------|----------------|
| Time to ship | Days | 6-12 months |
| Engineering cost | 1-2 engineers part-time | 3-5 engineers |
| Annual cost | $0 (free tier: 50k msg/mo) | $300k-$500k (eng time) |
| Reliability | Enterprise-grade, battle-tested | Unknown until production |
| Customer portal | Built-in | Must build |
| Retry logic | Exponential backoff, ~8 attempts | Must implement |
| Logging/debugging | Full UI with request/response inspection | Must build |

**Svix free tier (50k messages/month) is more than sufficient** for Lightfast's current scale. Upgrade to Pro ($490/mo) only when exceeding 50k.

**Precedent**: Clerk uses Svix for their webhooks. Lightfast already uses Clerk. This means the team is already familiar with Svix webhook verification patterns.

#### Event Catalog

Events exposed to customers via Svix, derived from Inngest events:

**Tier 1 (Ship first):**

| Webhook Event | Source Inngest Event | Payload |
|--------------|---------------------|---------|
| `observation.created` | `observation.captured` | `{ observationId, observationType, significanceScore, topics, clusterId, workspaceId }` |
| `sync.completed` | `sync.completed` | `{ sourceId, jobId, success, filesProcessed, embeddingsCreated }` |
| `source.connected` | `source.connected.github` | `{ workspaceId, sourceId, sourceType, sourceMetadata }` |
| `source.disconnected` | `source.disconnected` | `{ sourceId, deleteData }` |

**Tier 2 (Ship later):**

| Webhook Event | Source Inngest Event | Payload |
|--------------|---------------------|---------|
| `backfill.completed` | `backfill.completed` | `{ integrationId, workspaceId, provider, success, eventsProduced }` |
| `cluster.created` | `cluster.check-summary` (when `clusterIsNew`) | `{ clusterId, workspaceId, observationCount, topics }` |
| `document.processed` | `docs.file.process` (completion) | `{ documentId, sourceId, workspaceId }` |

**Event naming convention**: `resource.action` (Stripe/Clerk style) -- lowercase, dot-separated, past tense for completed events.

#### Architecture

```
Inngest Event (observation.captured, sync.completed, etc.)
  |
  v
New Inngest function: webhook.fan-out
  |
  +-- Filter: Is this event type in the workspace's webhook subscriptions?
  |
  +-- Transform: Map Inngest event payload -> webhook event payload
  |     (Strip internal fields, add metadata: eventId, timestamp, version)
  |
  +-- Dispatch: Send to Svix
        |
        v
      Svix handles:
        - Endpoint routing (which URLs to send to)
        - Payload signing (Svix signature standard)
        - Retry with exponential backoff
        - Delivery logging
        - Customer portal (endpoint management, logs, testing)
```

#### Implementation: Svix Integration

**New package**: `@vendor/svix`

```
vendor/svix/
  src/
    index.ts          # Svix client singleton
    env.ts            # SVIX_API_KEY validation (t3-env)
  package.json        # dependency: svix
```

**Inngest fan-out function**: `api/console/src/inngest/workflow/webhooks/fan-out.ts`

```typescript
// Subscribes to multiple Inngest events
// For each event:
//   1. Look up workspace's Svix application ID
//   2. Map event to webhook payload
//   3. Call svix.message.create() to dispatch
```

**tRPC endpoints** (new, under `orgRouter`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `webhooks.list` | Query | List webhook endpoints for workspace |
| `webhooks.create` | Mutation | Register new endpoint (URL, events, description) |
| `webhooks.update` | Mutation | Update endpoint configuration |
| `webhooks.delete` | Mutation | Remove endpoint |
| `webhooks.getPortalUrl` | Query | Get Svix customer portal URL (embedded UI) |
| `webhooks.test` | Mutation | Send test event to endpoint |
| `webhooks.logs` | Query | Recent delivery attempts (proxied from Svix) |

**Database**: Minimal -- Svix manages most state. Only need:

| Field | Purpose |
|-------|---------|
| `svixAppId` on `orgWorkspaces` table | Links workspace to Svix application |

When a workspace is created, create a corresponding Svix application. When deleted, delete the Svix application.

#### Webhook Management UI

Two options for the management UI:

**Option A (Recommended): Svix Embedded Portal**
- Svix provides an embeddable portal component
- Zero UI code needed for endpoint management, logs, testing
- Get portal URL via `svix.authentication.appPortalAccess()`
- Embed in iframe within Settings -> Integrations -> Webhooks page

**Option B: Custom UI**
- Build endpoint CRUD forms in console
- Build log viewer
- More control over design, but 2-3 weeks of extra work

**Recommendation**: Start with Svix Embedded Portal. If design customization is critical later, build custom UI over the same Svix API.

#### Webhook Payload Format

```json
{
  "id": "evt_1234567890",
  "type": "observation.created",
  "timestamp": "2026-02-07T12:00:00Z",
  "version": "2026-02-07",
  "data": {
    "observationId": "obs_abc123",
    "observationType": "github_push",
    "significanceScore": 85,
    "topics": ["authentication", "security"],
    "clusterId": "cluster_xyz",
    "workspaceId": "ws_789"
  }
}
```

**Signing**: Svix handles signing automatically. Consumers verify using the `svix` npm package or raw HMAC verification.

**Versioning**: Include `version` field (date-based, e.g., `2026-02-07`). When payload shapes change, create new version. Old versions continue to work.

---

### 6. Integration Page UX

#### Settings -> Integrations Page Layout

The Integrations page is the single place users manage all external connections:

```
┌──────────────────────────────────────────────────────────────┐
│  Integrations                                                │
│                                                              │
│  DATA CONNECTORS                                             │
│  Sync data from your development tools into Lightfast.       │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ [GitHub Logo]     │  │ [Vercel Logo]     │                │
│  │ GitHub            │  │ Vercel            │                │
│  │ Repos, PRs, issues│  │ Deployments       │                │
│  │ ● Connected       │  │ ● Connected       │                │
│  │ [Configure]       │  │ [Configure]       │                │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ [Linear Logo]     │  │ [Sentry Logo]     │                │
│  │ Linear            │  │ Sentry            │                │
│  │ Issues, projects  │  │ Errors, incidents │                │
│  │ [Connect]         │  │ [Connect]         │                │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  NOTIFICATION CHANNELS                                       │
│  Configure how Lightfast notifies your team.                 │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ [Bell Icon]       │  │ [Email Icon]      │                │
│  │ In-App Feed       │  │ Email             │                │
│  │ Bell icon alerts  │  │ Digests via Resend│                │
│  │ ● Active          │  │ [Configure]       │                │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ [Slack Logo]      │  │ [Webhook Icon]    │                │
│  │ Slack             │  │ Webhooks          │                │
│  │ Channel alerts    │  │ HTTP endpoints    │                │
│  │ [Connect Slack]   │  │ [Configure]       │                │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Card Design

Each integration card follows a consistent pattern:
- **Logo**: 48x48px service icon (already exists in `integration-icons.tsx`)
- **Name**: Service name
- **Description**: One-line explanation
- **Status badge**: Connected (green dot), Available (no dot), Coming Soon (gray)
- **CTA button**: Configure (if connected), Connect (if available), grayed out (if coming soon)

#### Detail Pages

Clicking "Configure" on a connected integration opens its detail page:

- **Data Connectors**: Show connected repos/projects, sync status, last sync time, disconnect option
- **Notification Channels**: Show channel configuration (Slack channel selection, email preferences, webhook endpoints)

These detail pages already partially exist for GitHub/Vercel connectors. The new pages needed are:
- `/settings/integrations/slack` -- Slack connection + channel selection (SlackKit components)
- `/settings/integrations/email` -- Email preferences (Knock preference center embed)
- `/settings/integrations/webhooks` -- Webhook endpoint management (Svix portal embed)

---

## Data Flow Diagrams

### End-to-End Notification Flow (Post-Implementation)

```
GitHub Push -> Webhook handler -> Inngest observation.capture
  -> Neural pipeline (transform, classify, score, cluster)
    -> observation.captured event (significance: 85)
      |
      +---> Knock workflow trigger ("observation-captured")
      |       |
      |       +---> In-App Feed Channel -> WebSocket -> Bell icon popover
      |       |
      |       +---> Email Channel (Resend) -> 5-min batch -> Digest email
      |       |
      |       +---> Slack Channel (SlackKit) -> #engineering in Acme Corp
      |
      +---> Svix webhook fan-out
              |
              +---> https://customer-a.com/webhooks/lightfast
              +---> https://zapier.com/hooks/catch/lightfast-xyz
```

### Slack OAuth Data Flow

```
Console UI                Knock API              Slack API
     |                        |                       |
     |-- SlackAuthButton ---> |                       |
     |                        |-- /oauth/authorize --> |
     |                        |                       |-- User consent
     |                        |<-- auth code ---------|
     |                        |-- /oauth.v2.access -->|
     |                        |<-- bot token ---------|
     |                        |                       |
     |                   Store on Tenant              |
     |                   (workspace-123)              |
     |<-- redirect ---------|                         |
     |                        |                       |
     |-- SlackChannelCombobox |                       |
     |   (list channels) ---> |-- conversations.list->|
     |<-- channel list -------|<-- channel list ------|
     |                        |                       |
     |-- Save #engineering -->|                       |
     |   (Object channel_data)|                       |
```

### Outbound Webhook Fan-Out

```
Inngest Event Bus
     |
     +-- observation.captured -----+
     +-- sync.completed -----------+
     +-- source.connected.github --+
     +-- source.disconnected ------+
                                   |
                                   v
                        webhook.fan-out (Inngest fn)
                                   |
                    +-- Is event type subscribed? --+
                    |              |                 |
                    No             Yes               |
                    |              |                 |
                   (skip)   Map to webhook payload  |
                                   |                |
                           svix.message.create()    |
                                   |                |
                              Svix handles:         |
                              - Routing             |
                              - Signing             |
                              - Retry               |
                              - Logging             |
```

---

## Security Considerations

### Knock User Token Signing (CRITICAL)

**Current vulnerability**: `notifications-provider.tsx:25` passes raw `userId` to KnockProvider without HMAC signing. In production, any user could impersonate another by guessing their userId.

**Fix**: Implement server-side token signing via a tRPC procedure or API route:

```typescript
// New tRPC procedure on userRouter
knockToken: protectedProcedure.query(async ({ ctx }) => {
  const knock = getKnockClient(); // from @vendor/knock
  if (!knock) return null;
  return knock.signUserToken(ctx.auth.userId);
});
```

Pass the signed token to `KnockProvider`:
```tsx
<KnockProvider userId={user.id} userToken={signedToken}>
```

### Slack Token Security

With SlackKit, Knock manages Slack tokens entirely. Lightfast never sees or stores Slack bot tokens. This is the most secure model:
- No Slack tokens in Lightfast's database
- No Slack tokens in Lightfast's environment variables
- Knock handles token refresh and rotation
- Attack surface is limited to Knock's infrastructure

### Svix Webhook Signing

Svix handles all webhook signing automatically:
- Each endpoint gets a unique signing secret
- Payloads signed with Svix's signature scheme (more robust than simple HMAC)
- Consumers verify using the `svix` npm package
- Timestamp included in signature to prevent replay attacks (5-minute tolerance)
- Secret rotation supported natively

### Environment Variables (New)

| Variable | Where | Purpose |
|----------|-------|---------|
| `SVIX_API_KEY` | `apps/console/.vercel/.env.development.local` | Svix API access |
| `SLACK_CLIENT_ID` | `apps/console/.vercel/.env.development.local` | SlackKit UI component |
| `NEXT_PUBLIC_SLACK_CLIENT_ID` | `turbo.json` globalEnv | Client-side SlackKit |

Note: `SLACK_CLIENT_SECRET` is configured in Knock dashboard only, NOT stored in Lightfast's environment.

---

## File/Package Structure

### New Packages

```
vendor/svix/
  src/
    index.ts          # Svix client singleton (pattern matches @vendor/knock)
    env.ts            # SVIX_API_KEY t3-env validation
  env.ts              # Root re-export
  package.json        # dependency: svix
  tsconfig.json
```

### New Files in Existing Packages

```
api/console/src/
  inngest/workflow/webhooks/
    fan-out.ts        # Inngest function: subscribe to events, dispatch via Svix
    index.ts          # Re-export
  router/org/
    webhooks.ts       # New tRPC router: webhook endpoint CRUD, portal URL

apps/console/src/app/(app)/[orgSlug]/settings/integrations/
  slack/
    page.tsx          # Slack connection + channel selection (SlackKit)
  email/
    page.tsx          # Email preferences (Knock preference center)
  webhooks/
    page.tsx          # Webhook management (Svix portal embed)
  page.tsx            # Main integrations page (connector + channel cards)
```

### Modified Files

```
api/console/src/root.ts                    # Add webhooksRouter
api/console/src/inngest/index.ts           # Register webhook fan-out function
vendor/knock/src/components/provider.tsx    # Accept userToken prop
apps/console/src/components/notifications-provider.tsx  # Pass signed userToken
apps/console/package.json                  # Add @vendor/svix dependency
turbo.json                                 # Add SVIX_API_KEY, NEXT_PUBLIC_SLACK_CLIENT_ID to globalEnv
```

### DB Schema Changes

```
db/console/src/schema/tables/
  org-workspaces.ts   # Add svixAppId column (nullable VARCHAR)
```

Only one column addition. Svix manages all webhook endpoint state. Knock manages all Slack connection state.

---

## Open Questions

### Resolved by This Design

1. **Should we use Resend Audiences?** -- No. Knock handles all notification routing. Audiences deferred to marketing phase.
2. **Svix or build custom webhooks?** -- Svix. 10x faster, fraction of the cost, enterprise-grade from day 1.
3. **SlackKit or custom `@slack/bolt`?** -- SlackKit for Phase 1. Custom bot only if interactive features demanded.
4. **What's the terminology?** -- "Integrations" (page), "Connectors" (data sources), "Channels" (notification delivery).

### Remaining Open Questions

1. **Knock dashboard setup**: Has the Knock account been created? Has any workflow been configured? This blocks all notification delivery and should be the very first step.

2. **Feed channel ID**: The hardcoded `"lightfast-console-notifications"` in `provider.tsx:12` must match the Knock dashboard channel ID. Should this be moved to an environment variable for flexibility?

3. **Recipient model**: Current dispatch sends to `clerkOrgId` as a single recipient. Should Knock be configured for org-to-member expansion, or should the Inngest function resolve individual user IDs from the database?

4. **Email digest frequency**: Recommended 5-minute batch window. Should this be user-configurable via Knock preferences, or fixed?

5. **Svix self-hosted vs cloud**: Free tier (50k msg/mo) is sufficient now. If costs grow, self-hosted Svix (Rust + PostgreSQL + Redis) is an option since Lightfast already uses PostgreSQL and Redis (via Upstash).

6. **Slack Enterprise Grid**: Any target customers using Enterprise Grid? This affects OAuth implementation (org-wide installs vs workspace-level).

7. **Webhook event versioning**: Should Lightfast use date-based versioning (recommended: `2026-02-07`) or semantic versioning (`v1`, `v2`)? Date-based is simpler and matches Stripe's pattern.

8. **Phase 2 custom Slack bot**: Is there user demand for interactive Slack features (slash commands, buttons with server-side actions)? If not, Phase 2 may never be needed.
