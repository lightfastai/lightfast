---
date: 2026-02-06T19:30:00+08:00
researcher: claude-opus-4-6
git_commit: 40d138e4314aeea8872247850740476bf8aa0c75
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Knock Implementation Status & Slack Bot Setup Requirements"
tags: [research, codebase, knock, slack, notifications, inngest, integration, status]
status: complete
last_updated: 2026-02-06
last_updated_by: claude-opus-4-6
---

# Research: Knock Implementation Status & Slack Bot Setup Requirements

**Date**: 2026-02-06T19:30:00+08:00
**Researcher**: claude-opus-4-6
**Git Commit**: 40d138e4314aeea8872247850740476bf8aa0c75
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

How far along is the Knock notification implementation, and what is needed to set up Lightfast with a Slack bot into user's Slack channels?

## Summary

**Knock implementation is ~85% complete for Phase 1 (in-app notifications).** The vendor package, frontend components, backend workflow, CSP configuration, and styled UI are all built and wired together. The remaining work is Knock dashboard configuration (creating the account, workflow, and channel) and setting environment variables.

**Slack bot integration has 0% code implementation.** Extensive research and architecture documents exist (5 documents dated 2026-02-06), but no Slack-specific code, OAuth routes, or environment variables have been created. Slack is shown as "coming soon" in the UI.

---

## Detailed Findings

### 1. Knock Implementation — What's Built

#### Vendor Package (`@vendor/knock`)

Fully implemented following the established vendor abstraction pattern:

| File | Status | Description |
|------|--------|-------------|
| `vendor/knock/package.json` | Complete | Dependencies: `@knocklabs/node@^1.20.0`, `@knocklabs/react@^0.8.11` |
| `vendor/knock/src/index.ts` | Complete | Server-side Knock client singleton (12 lines, null-safe when env not set) |
| `vendor/knock/src/env.ts` | Complete | t3-env validation: `KNOCK_API_KEY` (server), `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` (client) |
| `vendor/knock/env.ts` | Complete | Root re-export |
| `vendor/knock/src/components/provider.tsx` | Complete | `KnockProvider` + `KnockFeedProvider` wrapper, hardcoded dark mode, feed ID `"lightfast-console-notifications"` |
| `vendor/knock/src/components/trigger.tsx` | Complete | `NotificationIconButton` + `NotificationFeedPopover`, Suspense-wrapped, null when env not set |
| `vendor/knock/src/styles.css` | Complete | 230 lines of custom CSS — full shadcn/ui dark theme integration (OKLCH colors), popover, items, empty state, scrollbar |
| `vendor/knock/tsconfig.json` | Complete | Extends internal-package config |

#### Console App Frontend Integration

| File | Status | Description |
|------|--------|-------------|
| `apps/console/src/components/notifications-provider.tsx` | Complete | Wraps app with `NotificationsProvider`, passes Clerk `userId` |
| `apps/console/src/components/app-header.tsx` | Complete | `NotificationsTrigger` bell icon placed between workspace switcher and user dropdown |
| `apps/console/package.json` | Complete | `@vendor/knock` workspace dependency added |
| `apps/console/next.config.ts` | Complete | `@vendor/knock` in `transpilePackages` |

#### Backend Notification Workflow

| File | Status | Description |
|------|--------|-------------|
| `api/console/src/inngest/workflow/notifications/dispatch.ts` | Complete | Inngest function listening to `observation.captured`, filters by significance >= 70, triggers Knock workflow `"observation-captured"` with org context |
| `api/console/src/inngest/workflow/notifications/index.ts` | Complete | Re-exports `notificationDispatch` |
| `api/console/package.json` | Complete | `@vendor/knock` workspace dependency added |

#### Security Configuration

| File | Status | Description |
|------|--------|-------------|
| `vendor/security/src/csp/knock.ts` | Complete | CSP directives for `api.knock.app` (HTTPS + WSS) and `cdn.knock.app` |

#### Environment Variables

| Variable | Location | Status |
|----------|----------|--------|
| `KNOCK_API_KEY` | `apps/console/.vercel/.env.development.local` (line 25) | Set (value exists) |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | `apps/console/.vercel/.env.development.local` (line 31) | Set (value exists) |
| Both variables | `turbo.json` globalEnv (lines 133-134) | Registered |

### 2. Knock Implementation — What's NOT Done

#### Knock Dashboard Configuration (Manual, No Code)

These are manual steps in the Knock dashboard that have not been verified as complete:

1. **Knock Account**: Create account at knock.app (free tier)
2. **In-App Feed Channel**: Create channel named "Console In-App Feed", note channel ID
3. **Notification Workflow**: Create workflow with key `observation-captured` matching the code constant `OBSERVATION_WORKFLOW_KEY`
4. **Workflow Template**: Configure in-app channel step with message template (title, body)
5. **Commit Changes**: Knock requires committing workflow changes to deploy

#### Code Deviations from Plan

The implementation slightly differs from the Phase 1 plan:

| Plan Spec | Actual Implementation | Impact |
|-----------|----------------------|--------|
| Env vars: `KNOCK_SECRET_API_KEY` | Uses `KNOCK_API_KEY` | Different naming convention |
| Env vars: `NEXT_PUBLIC_KNOCK_API_KEY` | Uses `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | Different naming convention |
| Env vars: `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID` | Hardcoded `"lightfast-console-notifications"` in provider.tsx | Feed channel ID is not configurable via env var |
| Recipients: resolve from `orgMembers` DB table | Uses `clerkOrgId` directly as single recipient | Simpler but different recipient model |
| Plan includes `NonRetriableError` import | Not imported in actual code | Cleaner error handling |
| Plan includes `db` + `orgMembers` query | Not present — sends to org ID directly | No DB dependency in dispatch workflow |

#### Verification Not Yet Completed

From the plan's success criteria, these have not been confirmed:
- [ ] Bell icon visible in AppHeader (when Knock env vars set)
- [ ] Clicking bell icon opens notification feed popover
- [ ] Inngest dev server shows the `notification.dispatch` function registered
- [ ] End-to-end: observation captured (score >= 70) triggers Knock notification in feed

### 3. Slack Bot Integration — Current State

#### What Exists (UI Only)

| Component | File | Status |
|-----------|------|--------|
| Slack icon SVG | `packages/ui/src/components/integration-icons.tsx:174` | Icon component exists |
| Provider selector | `apps/console/.../sources/connect/_components/provider-selector.tsx:42-47` | Slack listed as `"coming_soon"` |
| FAQ content | `apps/www/src/components/faq-section.tsx` | Mentions Slack |
| Integration showcase | `apps/www/src/components/integration-showcase.tsx` | Shows Slack icon |
| Source type schema | `packages/console-validation/src/schemas/sources.ts:23-27` | Slack NOT in enum (`["github", "vercel", "linear", "sentry"]`) |

#### What Does NOT Exist (No Code)

- No `/api/slack/` route group or OAuth routes
- No Slack webhook receiver
- No Slack bot token environment variables
- No `@slack/bolt` or SlackKit dependency
- No Slack OAuth flow components (like `SlackAuthButton`)
- No Slack channel selection UI
- No `slack` entry in source type validation schema
- No database records for Slack workspace connections

### 4. Slack Integration — Two Architectural Paths Researched

The research documents describe two complementary approaches:

#### Path A: Knock SlackKit (Managed by Knock)

**Source**: `thoughts/shared/research/2026-02-06-knock-setup-slack-bot-resend-integration.md`

Knock provides SlackKit — a managed OAuth solution where:
1. User clicks "Connect Slack" button (Knock's `SlackAuthButton` component)
2. OAuth redirects to Slack, user authorizes in their workspace
3. Knock receives and stores the access token on the Tenant entity
4. User selects channel via `SlackChannelCombobox` component
5. When workflow triggers, Knock routes to selected Slack channel automatically

**What this gives**: One-way notifications to Slack channels using Knock's template system (Liquid + Block Kit JSON)

**What this doesn't give**: Slash commands, modals, bidirectional actions, event subscriptions

**Setup requirements**:
1. Create Slack App at api.slack.com/apps
2. Add OAuth redirect URL: `https://api.knock.app/oauth/slack/callback`
3. Add bot token scopes: `channels:read`, `chat:write`
4. Configure SlackKit in Knock dashboard with Client ID + Secret
5. Add `SlackAuthButton` and `SlackChannelCombobox` to console UI
6. Add Slack channel step to Knock workflow
7. Environment variables: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`

#### Path B: Custom `@slack/bolt` Bot (Self-Hosted)

**Source**: `thoughts/shared/research/2026-02-06-web-analysis-unified-slack-bot-architecture.md`

A full-featured Slack bot that subscribes to `observation.captured` Inngest events and:
1. Queries the relationship graph for cross-source context
2. Enriches notifications with linked entities (PR ↔ Sentry error ↔ Vercel deploy)
3. Threads messages by cluster ID
4. Supports slash commands, interactive buttons, modals

**What this gives**: Full Slack API, interactive features, cross-source enriched notifications

**What this doesn't give**: Managed OAuth (must build yourself), integrated multi-channel orchestration

**Setup requirements**:
1. Create Slack App with full permissions
2. Install `@slack/bolt` package
3. Build OAuth flow (following GitHub/Vercel pattern in codebase)
4. Create `packages/console-notifications/` package with provider abstraction
5. Build Inngest function for Slack-specific dispatch
6. Deploy bot infrastructure (Socket Mode for dev, HTTP for production)
7. Build interactive handlers for buttons, slash commands
8. Environment variables: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`

### 5. Recommended Path for Slack Integration

The research documents recommend a phased approach:

**Phase 1**: Use Knock SlackKit for basic notifications (1-2 days of code work)
- Leverages existing Knock infrastructure
- No additional hosting/infrastructure needed
- Gets notifications into Slack channels quickly
- Limited to one-way notifications

**Phase 2** (Optional): Add custom `@slack/bolt` bot for interactive features
- Slash commands: `/lightfast search <query>`
- Interactive buttons: "View in Lightfast", "Load Similar Events"
- Cross-source enriched messages using relationship graph
- Estimated 5-7 days of development

### 6. Existing OAuth Patterns to Follow

The codebase has two complete OAuth integration patterns:

**GitHub OAuth** (`apps/console/src/app/(github)/api/github/`):
- `authorize-user/route.ts` — User authorization endpoint
- `user-authorized/route.ts` — OAuth callback handler
- `app-installed/route.ts` — Installation callback
- `install-app/route.ts` — Installation redirect
- `webhooks/route.ts` — Webhook receiver (17KB)

**Vercel OAuth** (`apps/console/src/app/(vercel)/api/vercel/`):
- `authorize/route.ts` — Authorization endpoint
- `callback/route.ts` — OAuth callback
- `webhooks/route.ts` — Webhook handler

**Connector Components** (reference for Slack connector UI):
- `apps/console/.../sources/connect/_components/github-connector.tsx`
- `apps/console/.../sources/connect/_components/vercel-connector.tsx`

### 7. Notification Dispatch Workflow — Implementation Details

The `notificationDispatch` function (`api/console/src/inngest/workflow/notifications/dispatch.ts`):

```
Event: apps-console/neural/observation.captured
  │
  ├─ Guard: Knock client configured? (null check)
  ├─ Guard: significanceScore >= 70? (NOTIFICATION_SIGNIFICANCE_THRESHOLD)
  ├─ Guard: clerkOrgId present?
  │
  └─ Step: trigger-knock-workflow
     └─ notifications.workflows.trigger("observation-captured", {
          recipients: [{ id: clerkOrgId }],
          tenant: clerkOrgId,
          data: { observationId, observationType, significanceScore, topics, clusterId, workspaceId }
        })
```

**Concurrency**: 20 concurrent per workspace
**Retries**: 3
**Threshold**: Only fires for observations with significance >= 70

## Code References

### Knock Vendor Package
- `vendor/knock/src/index.ts` — Server-side Knock client singleton
- `vendor/knock/src/env.ts` — Environment variable validation
- `vendor/knock/src/components/provider.tsx` — KnockProvider + KnockFeedProvider wrapper
- `vendor/knock/src/components/trigger.tsx` — Bell icon + popover
- `vendor/knock/src/styles.css` — 230-line custom dark theme CSS
- `vendor/knock/package.json` — Package definition

### Console App Integration
- `apps/console/src/components/notifications-provider.tsx` — Clerk user ID → Knock provider bridge
- `apps/console/src/components/app-header.tsx` — Bell icon placement in header

### Backend Workflow
- `api/console/src/inngest/workflow/notifications/dispatch.ts` — Inngest → Knock bridge
- `api/console/src/inngest/workflow/notifications/index.ts` — Export

### Security
- `vendor/security/src/csp/knock.ts` — CSP directives for Knock API + WebSocket

### Slack UI (Coming Soon)
- `apps/console/.../sources/connect/_components/provider-selector.tsx:42-47` — Slack as "coming_soon"
- `packages/ui/src/components/integration-icons.tsx:174` — Slack icon SVG

## Architecture Documentation

### Current Knock Data Flow

```
GitHub Push → Webhook → Inngest observation.capture → Neural Pipeline
  → observation.captured event (significance >= 70)
    → notificationDispatch Inngest function
      → Knock API: workflows.trigger("observation-captured", { recipients, data })
        → Knock In-App Feed Channel
          → KnockProvider (WebSocket) → NotificationFeedPopover (bell icon)
```

### Current Knock Component Tree

```
(app)/layout.tsx
  └─ HydrateClient
       └─ ConsoleNotificationsProvider (apps/console)
            └─ NotificationsProvider (vendor/knock) → KnockProvider → KnockFeedProvider
                 └─ AppHeader
                      └─ NotificationsTrigger (vendor/knock) → NotificationIconButton + NotificationFeedPopover
```

### Planned Slack Integration (from research)

```
                    ┌─ In-App Feed (exists)
observation.captured │
  → Knock trigger ──┼─ Email via Resend (not configured)
                    │
                    └─ Slack via SlackKit (not implemented)
                        ↓
                    Knock SlackKit OAuth
                        ↓
                    User's Slack Channel
```

## Historical Context (from thoughts/)

All research documents are dated 2026-02-06, indicating a single coordinated research sprint:

- `thoughts/shared/plans/2026-02-06-knock-notification-integration-phase-1.md` — Comprehensive Phase 1 implementation plan with 4 phases, success criteria, and verification steps
- `thoughts/shared/research/2026-02-06-knock-setup-slack-bot-resend-integration.md` — Detailed setup guide for Knock + SlackKit + Resend including pricing analysis, templates, and checklist
- `thoughts/shared/research/2026-02-06-web-analysis-unified-slack-bot-architecture.md` — Custom Slack bot architecture leveraging relationship graph for cross-source enriched notifications
- `thoughts/shared/research/2026-02-06-console-notification-system-inngest-workflows.md` — Mapping of all 20+ Inngest workflows to notification candidates, recommended user-facing events
- `thoughts/shared/research/2026-02-06-web-analysis-knock-unified-notification-orchestration.md` — Analysis of Knock as unified notification orchestration service

## Implementation Status Summary

| Component | Status | Completeness |
|-----------|--------|-------------|
| `@vendor/knock` package | Built | 100% |
| Console frontend (provider + bell) | Built | 100% |
| Notification dispatch workflow | Built | 100% |
| CSP security config | Built | 100% |
| Custom CSS theme | Built | 100% |
| Environment variables | Set | 100% |
| **Knock dashboard config** | **Not done** | **0%** |
| **End-to-end verification** | **Not done** | **0%** |
| Slack OAuth routes | Not started | 0% |
| Slack connector UI | Not started | 0% |
| Slack env variables | Not started | 0% |
| SlackKit/Bolt integration | Not started | 0% |

## What's Needed to Complete Knock (Phase 1)

1. **Knock Dashboard Setup** (manual, ~30 min):
   - Create Knock account
   - Create in-app feed channel → get channel ID
   - Create workflow with key `observation-captured`
   - Add in-app channel step with template
   - Commit changes

2. **Verify Feed Channel ID** — The provider currently hardcodes `"lightfast-console-notifications"` as the feed ID. This needs to match the Knock dashboard channel ID.

3. **End-to-End Test**:
   - Start dev server (`pnpm dev:app`)
   - Confirm bell icon renders
   - Trigger a high-significance observation
   - Verify notification appears in feed popover

## What's Needed for Slack Bot (SlackKit Path)

1. **Slack App Creation** (~15 min):
   - Create app at api.slack.com/apps
   - Name: "Lightfast Notifications"
   - Add OAuth redirect: `https://api.knock.app/oauth/slack/callback`
   - Add scopes: `channels:read`, `chat:write`
   - Note Client ID + Client Secret

2. **Knock Dashboard** (~15 min):
   - Create Slack channel (SlackKit)
   - Add Slack app credentials
   - Add Slack step to `observation-captured` workflow
   - Create Block Kit template with Liquid variables
   - Commit changes

3. **Code Changes** (~1-2 days):
   - Add `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` env vars
   - Add `SlackAuthButton` component for workspace connection
   - Add `SlackChannelCombobox` for channel selection
   - Create settings page for Slack connection management
   - Add `slack` to source type schema (if treating as integration)

4. **Testing**:
   - OAuth flow: Connect Lightfast to test Slack workspace
   - Channel selection: Pick channel from combobox
   - Notification delivery: Trigger observation → verify Slack message

## Open Questions

1. Should the feed channel ID be configurable via env var or remain hardcoded?
2. Has the Knock dashboard been set up at all (account created, workflow configured)?
3. For Slack, prefer SlackKit (quick, managed) or custom @slack/bolt (full-featured, more work)?
4. Should Slack integration be a separate "source" or a notification channel only?
5. Is Resend email channel also a Phase 1 priority, or just in-app + Slack?
