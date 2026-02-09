---
date: 2026-02-07T15:00:00+08:00
researcher: claude
git_commit: 2ecbd44139d10df4db5be5ee7114e3944104866d
branch: feat/knock-notification-system
repository: lightfast
topic: "Knock Notification System — Full Types Analysis & DRY Audit"
tags: [research, codebase, notifications, knock, types, dry-analysis]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
last_updated_note: "Added placement analysis — vendor package boundary violation in @vendor/knock"
---

# Research: Knock Notification System — Full Types Analysis & DRY Audit

**Date**: 2026-02-07T15:00:00+08:00
**Researcher**: claude
**Git Commit**: 2ecbd44
**Branch**: feat/knock-notification-system
**Repository**: lightfast

## Research Question

Full types analysis of the Knock notification system: are types correctly structured, placed in appropriate packages, and DRY? Covers all notification-related types across `@repo/console-types`, `@vendor/knock`, `api/console`, and `apps/console`.

## Summary

The notification type system has a clear layering pattern, but there is **one significant placement violation**: `@vendor/knock` contains Lightfast-specific business logic and depends on `@repo/console-types` — it is the **only vendor package in the entire repo** with a `@repo/console-*` dependency. This breaks the vendor package contract ("standalone re-exports of third-party SDKs"). Specifically, `preferences.tsx` in the vendor package contains Lightfast category definitions, labels, and business rules that belong in the application layer.

Beyond the placement issue, there is **one DRY violation** (duplicated `groupBy` helper), **one intentional duplication** (Knock SDK types re-wrapped with documented rationale), and **two local interfaces** (`ClassifierInput`, `Recipient`) that are correctly scoped to their implementation files.

---

## Detailed Findings

### 1. Type Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ @repo/console-types (packages/console-types/src/notifications/)          │
│  ├─ rubric.ts     → Domain types: EventCategory, ChannelTier, etc.      │
│  └─ event-map.ts  → NOTIFICATION_RUBRIC constant                        │
├──────────────────────────────────────────────────────────────────────────┤
│ @vendor/knock (vendor/knock/)                                            │
│  ├─ src/index.ts           → Server client: Knock | null                │
│  ├─ src/components/        → React components + hooks                    │
│  │   ├─ provider.tsx       → NotificationsProvider (wraps KnockProvider)│
│  │   ├─ trigger.tsx        → NotificationsTrigger (bell icon)           │
│  │   └─ preferences.tsx    → useNotificationPreferences hook            │
│  └─ env.ts                 → Environment variable validation            │
├──────────────────────────────────────────────────────────────────────────┤
│ api/console (api/console/src/inngest/workflow/notifications/)             │
│  ├─ classifier.ts          → classifyNotification() + ClassifierInput   │
│  ├─ dispatch.ts            → notificationDispatch Inngest function      │
│  ├─ maturity.ts            → getWorkspaceMaturity()                     │
│  ├─ recipient-filter.ts    → filterByTargetingRule() + Recipient        │
│  ├─ daily-digest.ts        → dailyDigest Inngest cron                   │
│  └─ weekly-summary.ts      → weeklySummary Inngest cron                 │
├──────────────────────────────────────────────────────────────────────────┤
│ apps/console                                                             │
│  ├─ components/notifications-provider.tsx  → ConsoleNotificationsProvider│
│  ├─ components/app-header.tsx              → Renders NotificationsTrigger│
│  └─ .../settings/notifications/            → Preferences UI page        │
├──────────────────────────────────────────────────────────────────────────┤
│ api/console (tRPC + Inngest events)                                      │
│  ├─ router/user/notifications.ts           → getToken procedure         │
│  └─ inngest/client/client.ts               → Event schemas (Zod)       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Shared Types — `@repo/console-types` (Single Source of Truth)

**File**: `packages/console-types/src/notifications/rubric.ts`

All core domain types are defined here and exported through the package barrel:

| Type | Kind | Line | Description |
|------|------|------|-------------|
| `EventCategory` | union | 5 | `"critical" \| "workflow" \| "ambient"` |
| `ChannelTier` | union | 8 | `"interrupt" \| "aware" \| "inform" \| "ambient"` |
| `GroupingStrategy` | union | 11–15 | `"realtime" \| "batched_15m" \| "daily_digest" \| "weekly_digest"` |
| `TargetingRule` | union | 18–24 | `"all_members" \| "owner_only" \| "assignee_only" \| "reviewers_only" \| "actor_excluded" \| "actor_aware"` |
| `KNOCK_WORKFLOW_KEYS` | const | 27–32 | Maps ChannelTier → Knock workflow key strings |
| `KnockWorkflowKey` | derived union | 34–35 | `"critical-alert" \| "workflow-update" \| "daily-digest" \| "weekly-summary"` |
| `NOTIFICATION_CATEGORY_KEYS` | const array | 38–43 | `["critical-alerts", "workflow-updates", "daily-digests", "weekly-summaries"]` |
| `NotificationCategoryKey` | derived union | 45–46 | From `NOTIFICATION_CATEGORY_KEYS[number]` |
| `EventNotificationConfig` | interface | 49–58 | Per-event notification routing config |
| `WorthinessScore` | interface | 61–68 | 5-factor scoring for WORKFLOW events |
| `WorkspaceMaturity` | union | 71 | `"seed" \| "growing" \| "mature"` |
| `NotificationDecision` | interface | 74–83 | Classifier output |

**File**: `packages/console-types/src/notifications/event-map.ts`

| Export | Kind | Line | Description |
|--------|------|------|-------------|
| `NOTIFICATION_RUBRIC` | const | 16–192 | `Record<InternalEventType, EventNotificationConfig>` — 22 event types |

**Export chain**: `rubric.ts` + `event-map.ts` → `notifications/index.ts` → `packages/console-types/src/index.ts:18`

**Dependencies on other shared packages**:
- `InternalEventType` from `../integrations/event-types` (22-member union of all event type keys)
- `SourceType` from `@repo/console-validation` (`"github" | "vercel"`)

**Verdict**: Correctly placed. All reusable domain types live in the shared types package. No duplication detected.

---

### 3. Vendor Package — `@vendor/knock` (PLACEMENT VIOLATION)

#### 3.0 Vendor Package Contract Violation

**`@vendor/knock` is the only vendor package in the repo that depends on `@repo/console-types`.**

```
$ grep -r "@repo/console" vendor/*/package.json
vendor/knock/package.json:29:    "@repo/console-types": "workspace:*"
```

No other vendor package (`@vendor/email`, `@vendor/clerk`, `@vendor/db`, `@vendor/upstash`, etc.) depends on any `@repo/console-*` package. Per CLAUDE.md, vendor packages are "standalone re-exports of third-party SDKs." The `@repo/console-types` dependency means `@vendor/knock` contains Lightfast application logic, not a generic SDK wrapper.

**The violation originates in `preferences.tsx`**, which imports `NotificationCategoryKey` from `@repo/console-types` (line 5) and embeds Lightfast-specific category definitions (lines 50–83).

#### 3.1 Server Client (`vendor/knock/src/index.ts`) — Correctly Placed

| Export | Type | Line | Description |
|--------|------|------|-------------|
| `notifications` | `Knock \| null` | 12 | Server-side singleton, null when env var missing |
| `signUserToken` | function | 18 | Re-exported from `@knocklabs/node` |

**Verdict**: Correct pattern. Pure SDK wrapper matching `@vendor/email`, etc.

#### 3.2 Provider Component (`vendor/knock/src/components/provider.tsx`) — Misplaced Constant

| Definition | Kind | Line | Description |
|------------|------|------|-------------|
| `NotificationsProviderProps` | interface | 14–18 | `{ children: ReactNode; userId: string; userToken?: string \| null }` |
| `NotificationsProvider` | component | 20–46 | Wraps `KnockProvider` + `KnockFeedProvider` |

**Problem**: `knockFeedChannelId` is hardcoded to `"lightfast-console-notifications"` at line 12. A vendor package should not know the name of a specific Knock channel. This should be either a prop on `NotificationsProvider` or come from an environment variable.

**Verdict**: Component structure is fine, but the hardcoded channel ID is application-specific and should be passed in from the consumer.

#### 3.3 Trigger Component (`vendor/knock/src/components/trigger.tsx`) — Correctly Placed

| Definition | Kind | Line | Description |
|------------|------|------|-------------|
| `NotificationsTriggerContent` | internal component | 14–40 | Bell icon + popover |
| `NotificationsTrigger` | exported component | 42–52 | Conditional wrapper with env check |

**Verdict**: Thin SDK wrapper. Correctly placed.

#### 3.4 Preferences Hook (`vendor/knock/src/components/preferences.tsx`) — Mixed Placement

This file contains **two concerns that should be separated**:

**A. Generic Knock SDK types (lines 12–30) — CORRECTLY placed in vendor:**

| Type | Kind | Line | Why Correct |
|------|------|------|-------------|
| `ChannelTypePreferences` | type | 12 | Mirrors `@knocklabs/client` — avoids adding it as a dep |
| `WorkflowPreferenceSetting` | type | 16 | Same |
| `WorkflowPreferences` | type | 21 | Same |
| `PreferenceSet` | interface | 25 | Same |
| `ChannelPreference` | interface | 32–35 | Generic channel preference shape |

Documented rationale (line 7): *"Local type definitions matching @knocklabs/client's preference interfaces. We define them here because @knocklabs/react doesn't re-export them and we don't want to add @knocklabs/client as a direct dependency."*

The generic `updateChannelPreference()` and `getChannelEnabled()` functions (lines 165–205) are also correctly placed — they wrap Knock's `preferences.get()`/`set()` API without Lightfast-specific knowledge.

**B. Lightfast category business logic (lines 37–83, 102–118, 208–281) — INCORRECTLY placed in vendor:**

| Item | Kind | Line | Why Misplaced |
|------|------|------|---------------|
| `CategoryPreference` | interface | 37–47 | Typed to `NotificationCategoryKey` from `@repo/console-types` — Lightfast domain type |
| `CATEGORY_DEFINITIONS` | const | 50–83 | Contains Lightfast-specific labels ("Deployment failures, security vulnerabilities..."), descriptions, and `supportsInApp` business rules |
| `getCategoryPreferences()` | function | 208–229 | Maps `CATEGORY_DEFINITIONS` to Knock preference state — Lightfast category logic |
| `updateCategoryPreference()` | function | 232–281 | Updates Knock preferences keyed by `NotificationCategoryKey` — Lightfast category logic |
| `UseNotificationPreferencesResult` | interface | 102–118 | Includes `getCategoryPreferences` and `updateCategoryPreference` in its return type — couples generic hook to Lightfast categories |

**Where these should live**: In `apps/console/src/hooks/` (or a `packages/console-notifications/` package if other apps need it). The app layer should compose the generic vendor hook with the Lightfast-specific category logic.

**Correct split**:

`@vendor/knock/components/preferences.tsx` should export:
- `ChannelTypePreferences`, `PreferenceSet`, `ChannelPreference` (generic Knock types)
- A generic `useKnockPreferences()` hook that wraps `get()`/`set()` and returns `{ preferences, loading, updating, updateChannelPreference, getChannelEnabled }`

`apps/console/src/hooks/use-notification-preferences.ts` (or similar) should:
- Import the generic hook from `@vendor/knock`
- Import `NotificationCategoryKey`, `NOTIFICATION_CATEGORY_KEYS` from `@repo/console-types`
- Define `CATEGORY_DEFINITIONS`, `CategoryPreference`, `getCategoryPreferences()`, `updateCategoryPreference()` locally
- Compose them into the `useNotificationPreferences()` hook that the preferences UI consumes

---

### 4. Inngest Workflow Files — `api/console/src/inngest/workflow/notifications/`

#### 4.1 Classifier (`classifier.ts`)

**Local type**:

| Type | Kind | Line | Used By |
|------|------|------|---------|
| `ClassifierInput` | exported interface | 22–29 | `classifyNotification()` only |

```typescript
export interface ClassifierInput {
  observationType: string;
  significanceScore: number;
  topics: string[];
  hasRelationships: boolean;
  actorId?: string;
  workspaceMaturity: WorkspaceMaturity;  // from @repo/console-types
}
```

**Imports from shared**: `EventCategory`, `EventNotificationConfig`, `NotificationDecision`, `WorthinessScore`, `WorkspaceMaturity`, `NOTIFICATION_RUBRIC`, `KNOCK_WORKFLOW_KEYS`, `isInternalEventType` — all from `@repo/console-types`.

**Verdict**: `ClassifierInput` is a function-specific input DTO. It assembles fields from the Inngest event into the shape the classifier needs. Correctly local — it's an implementation detail, not a domain contract.

#### 4.2 Recipient Filter (`recipient-filter.ts`)

**Local type**:

| Type | Kind | Line | Used By |
|------|------|------|---------|
| `Recipient` | exported interface | 11–15 | `filterByTargetingRule()`, `dispatch.ts` |

```typescript
export interface Recipient {
  id: string;
  email: string;
  name?: string | undefined;
}
```

**Import from shared**: `TargetingRule` from `@repo/console-types`.

**Verdict**: `Recipient` is used in `dispatch.ts` (which constructs recipients from Clerk data) and `recipient-filter.ts`. It's a lightweight DTO representing a notification recipient. It could potentially live in `@repo/console-types` if other packages need it, but currently it's only used within the notifications workflow directory. Correctly scoped for now.

#### 4.3 Dispatch (`dispatch.ts`)

**No local types defined**. All types flow through imports from `./classifier`, `./maturity`, `./recipient-filter`, `@vendor/knock`, and `@db/console`.

**Inline type usage**: Recipient objects are constructed inline at line ~138 matching the `Recipient` interface shape `{ id: string; email: string; name?: string }`.

**Verdict**: Clean — no type duplication.

#### 4.4 Daily Digest (`daily-digest.ts`) & Weekly Summary (`weekly-summary.ts`)

**DRY VIOLATION FOUND**: Identical `groupBy` helper function in both files.

**daily-digest.ts:192–201**:
```typescript
function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
```

**weekly-summary.ts:220–229**: Identical implementation.

**Both files also construct similar recipient and summary objects inline** without a shared type:

- Recipient construction (both files): `{ id: m.publicUserData?.userId ?? "", email: m.publicUserData?.identifier ?? "", name: m.publicUserData?.firstName ?? undefined }`
- Summary object shapes differ between daily and weekly (daily has `bySource`, weekly has `thisWeekCount`/`lastWeekCount`/`topEventTypes`)

**Verdict**: The `groupBy` duplication is a concrete DRY violation. The inline recipient construction matches the `Recipient` interface from `recipient-filter.ts` but doesn't import it. The summary objects have different shapes so they're not duplicated.

---

### 5. Console App Components

#### 5.1 Notifications Provider (`apps/console/src/components/notifications-provider.tsx`)

**Inline props type**: `{ children: ReactNode }` at line 9.

**Type flow**:
1. `useUser()` → `{ user, isLoaded }` from Clerk
2. `useQuery(trpc.notifications.getToken.queryOptions())` → `{ data: string | undefined }`
3. Passes `userId: string` and `userToken: string | null` to `NotificationsProvider`

**Verdict**: Clean — thin wrapper extracting Clerk auth for Knock provider.

#### 5.2 Preferences UI (`apps/console/src/app/.../notifications/_components/notification-preferences.tsx`)

**Local constants**:

| Constant | Type | Line | Description |
|----------|------|------|-------------|
| `CATEGORY_ICONS` | `Record<NotificationCategoryKey, typeof Bell>` | 19 | Maps category keys → Lucide icons |
| `CATEGORY_COLORS` | `Record<NotificationCategoryKey, string>` | 26 | Maps category keys → Tailwind classes |

**Type imports**:
- `useNotificationPreferences`, `CategoryPreference` from `@vendor/knock/components/preferences`
- `NotificationCategoryKey` from `@repo/console-types`

**`CategoryRow` component props** (inline at line 176):
```typescript
{
  category: CategoryPreference;
  updating: boolean;
  globalEmailEnabled: boolean;
  globalInAppEnabled: boolean;
  onToggle: (categoryKey: NotificationCategoryKey, channelType: string, enabled: boolean) => Promise<void>;
}
```

**Verdict**: Correctly placed. UI-specific mapping constants belong in the component, not shared types.

---

### 6. tRPC Router & Inngest Events

#### 6.1 Notifications Router (`api/console/src/router/user/notifications.ts`)

Single `getToken` procedure. No custom types — returns `string` (JWT).

#### 6.2 Inngest Event Schemas (`api/console/src/inngest/client/client.ts`)

**Notification-related events**:

`"apps-console/notification.dispatch"` (lines 719–734):
```typescript
data: z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  workflowKey: z.string(),
  recipients: z.array(z.string()),
  tenant: z.string().optional(),
  payload: z.record(z.unknown()),
})
```

`"apps-console/neural/observation.captured"` (lines 626–653) — includes notification-relevant fields:
```typescript
actorSourceId: z.string().optional(),
actorName: z.string().optional(),
```

**Verdict**: Event schemas are defined via Zod in the Inngest client (runtime validation). These are separate from TypeScript interfaces in `@repo/console-types` (compile-time types). No duplication — they serve different purposes.

**Note**: The `notification.dispatch` event at lines 719–734 appears to be dead code — the dispatch workflow listens to `observation.captured`, not `notification.dispatch`. This matches the plan document's decision to keep it as a potential future generic dispatch mechanism.

---

## Placement Audit Summary

### Placement Violations

| # | Issue | Severity | Location | Details |
|---|-------|----------|----------|---------|
| 1 | **`@vendor/knock` depends on `@repo/console-types`** | **High** | `vendor/knock/package.json:29` | Only vendor package in the repo with a `@repo/console-*` dependency. Breaks the vendor package contract. |
| 2 | **Lightfast business logic in vendor package** | **High** | `vendor/knock/src/components/preferences.tsx:37–83, 208–281` | `CATEGORY_DEFINITIONS`, `CategoryPreference`, `getCategoryPreferences()`, `updateCategoryPreference()` contain Lightfast-specific category names, descriptions, and routing rules. Should be in `apps/console/src/hooks/` or a `packages/console-notifications/` package. |
| 3 | **Hardcoded channel ID in vendor package** | **Medium** | `vendor/knock/src/components/provider.tsx:12` | `knockFeedChannelId = "lightfast-console-notifications"` — application-specific constant embedded in vendor abstraction. Should be a prop or env var. |

### Correctly Placed

| # | Package/File | Why Correct |
|---|---|---|
| 1 | `@repo/console-types/notifications/` | All reusable domain types. Single source of truth for `EventCategory`, `ChannelTier`, `NotificationDecision`, etc. |
| 2 | `@vendor/knock/src/index.ts` | Pure SDK wrapper — `Knock \| null` singleton + `signUserToken` re-export. Matches `@vendor/email` pattern. |
| 3 | `@vendor/knock/src/components/trigger.tsx` | Thin component wrapping `@knocklabs/react` bell icon. No domain knowledge. |
| 4 | `@vendor/knock/src/components/preferences.tsx:12–30` | Generic Knock SDK type mirrors (documented rationale for avoiding `@knocklabs/client` dep). |
| 5 | `api/console/src/inngest/workflow/notifications/classifier.ts` | `ClassifierInput` — function-specific input DTO. Implementation detail, not a domain contract. |
| 6 | `api/console/src/inngest/workflow/notifications/recipient-filter.ts` | `Recipient` — workflow-internal DTO. Only used within notifications directory. |
| 7 | `apps/console/src/.../notification-preferences.tsx` | `CATEGORY_ICONS`, `CATEGORY_COLORS` — UI-only mapping constants. |
| 8 | `api/console/src/inngest/client/client.ts` | Inngest event Zod schemas — runtime validation, separate concern from compile-time TS interfaces. |

---

## DRY Audit Summary

### Violations Found

| # | Issue | Severity | Location | Details |
|---|-------|----------|----------|---------|
| 1 | `groupBy` helper duplicated | Low | `daily-digest.ts:192` & `weekly-summary.ts:220` | Identical 10-line function in both files |
| 2 | Recipient construction not using shared type | Low | `daily-digest.ts:~141` & `weekly-summary.ts:~159` | Inline `{ id, email, name }` objects match `Recipient` interface but don't import it |

### Intentional Duplications (Not Violations)

| # | What | Why | Location |
|---|------|-----|----------|
| 1 | Knock SDK preference types | `@knocklabs/react` doesn't re-export client types; avoids adding `@knocklabs/client` dep | `vendor/knock/src/components/preferences.tsx:12–30` |

### Correctly Local Types (Not Violations)

| # | Type | Why Local | Location |
|---|------|-----------|----------|
| 1 | `ClassifierInput` | Function-specific input DTO, only used by `classifyNotification()` | `classifier.ts:22–29` |
| 2 | `Recipient` | Workflow-internal DTO, only used in `dispatch.ts` + `recipient-filter.ts` | `recipient-filter.ts:11–15` |
| 3 | `CategoryRow` props | Component-local props type | `notification-preferences.tsx:176` |
| 4 | `NotificationsProviderProps` | Component-local props type | `provider.tsx:14–18` |

---

## Code References

- `packages/console-types/src/notifications/rubric.ts:5-83` — All shared notification types
- `packages/console-types/src/notifications/event-map.ts:16-192` — NOTIFICATION_RUBRIC constant
- `packages/console-types/src/notifications/index.ts:1-2` — Barrel export
- `packages/console-types/src/index.ts:18` — Root package export
- `packages/console-types/src/integrations/event-types.ts:25-123` — InternalEventType + helpers
- `vendor/knock/src/index.ts:1-18` — Server client + signUserToken
- `vendor/knock/src/components/provider.tsx:14-46` — NotificationsProvider
- `vendor/knock/src/components/trigger.tsx:14-52` — NotificationsTrigger
- `vendor/knock/src/components/preferences.tsx:12-293` — Preferences hook + local Knock types
- `vendor/knock/env.ts:1-18` — Environment variable validation
- `api/console/src/inngest/workflow/notifications/classifier.ts:22-185` — Classifier + ClassifierInput
- `api/console/src/inngest/workflow/notifications/dispatch.ts:31-275` — Dispatch workflow
- `api/console/src/inngest/workflow/notifications/maturity.ts:27-94` — Workspace maturity
- `api/console/src/inngest/workflow/notifications/recipient-filter.ts:11-50` — Recipient + filter
- `api/console/src/inngest/workflow/notifications/daily-digest.ts:192-201` — Duplicated groupBy
- `api/console/src/inngest/workflow/notifications/weekly-summary.ts:220-229` — Duplicated groupBy
- `api/console/src/inngest/client/client.ts:626-653` — observation.captured event schema
- `api/console/src/inngest/client/client.ts:719-734` — notification.dispatch event schema (dead code)
- `api/console/src/router/user/notifications.ts:5-14` — tRPC getToken
- `apps/console/src/components/notifications-provider.tsx:9-42` — Console notifications wrapper
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/notifications/_components/notification-preferences.tsx:19-230` — Preferences UI

## Architecture Documentation

### Type Layering Pattern

The notification system has a 4-layer type architecture, but the vendor layer currently violates its contract:

1. **Shared Domain Types** (`@repo/console-types`): Event categories, channel tiers, rubric types, decision interfaces. Importable by any package.
2. **Vendor Abstractions** (`@vendor/knock`): Should be pure Knock SDK wrappers. Currently **leaks into layer 4** by importing `@repo/console-types` and embedding Lightfast category business logic.
3. **Workflow Implementation** (`api/console/src/inngest/workflow/notifications/`): Function-specific DTOs (`ClassifierInput`, `Recipient`), Inngest function definitions. Correctly consumes shared types.
4. **UI / Application Layer** (`apps/console/src/`): Component props, icon/color mappings, application-specific hooks. Should consume vendor + shared types and contain the category-to-Knock bridging logic.

### Import Direction (Current — with violation)

```
@repo/console-types ← @vendor/knock ← apps/console
         ↑                  ↑ VIOLATION: vendor imports @repo/console-types
         │
api/console/src/inngest/workflow/notifications/
```

### Import Direction (Correct)

```
@repo/console-types ← apps/console (hooks compose vendor + domain types)
         ↑                  ↑
         │           @vendor/knock (pure SDK wrapper, no @repo/* deps)
         │
api/console/src/inngest/workflow/notifications/
```

In the correct pattern, `@vendor/knock` has zero knowledge of Lightfast domain types. The application layer (`apps/console`) is responsible for composing the generic vendor hook with Lightfast's category system from `@repo/console-types`.

### Vendor Package Contract

Every other vendor package in the repo follows this contract:

| Package | Dependencies | Domain Knowledge |
|---------|-------------|-----------------|
| `@vendor/email` | `resend` | None — exports `createEmailClient()` |
| `@vendor/clerk` | `@clerk/nextjs` | None — re-exports Clerk SDK |
| `@vendor/db` | `drizzle-orm`, `@planetscale/*` | None — re-exports DB client |
| `@vendor/upstash` | `@upstash/redis`, `@upstash/ratelimit` | None — re-exports clients |
| **`@vendor/knock`** | `@knocklabs/node`, `@knocklabs/react`, **`@repo/console-types`** | **Lightfast category names, descriptions, business rules** |

`@vendor/knock` is the sole outlier.

### Inngest Event Types vs TypeScript Interfaces

Two parallel type systems serve different purposes:
- **Zod schemas** in `api/console/src/inngest/client/client.ts` — runtime event validation
- **TypeScript interfaces** in `@repo/console-types` — compile-time type safety

These are not duplicated — the Inngest event carries raw data that gets assembled into domain types by the workflow functions.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-06-knock-notification-integration-phase-1.md` — Original Phase 1 plan establishing vendor package pattern
- `thoughts/shared/plans/2026-02-07-notification-rubric-implementation.md` — Rubric system adding classifier, maturity, and digest types
- `thoughts/shared/plans/2026-02-07-notifications-webhooks-implementation.md` — Current activation plan (Phase 1 complete, Phase 2+ planned)
- `thoughts/shared/research/2026-02-06-knock-setup-slack-bot-resend-integration.md` — Knock + Resend + Slack architecture research

## Related Research

- `thoughts/shared/research/2026-02-06-console-notification-system-inngest-workflows.md`
- `thoughts/shared/research/2026-02-06-web-analysis-knock-unified-notification-orchestration.md`
- `thoughts/shared/research/2026-02-07-knock-prod-validation-architecture-design.md`

## Open Questions

1. **How to split `preferences.tsx` in `@vendor/knock`?** The file mixes generic Knock SDK wrapping (correctly placed) with Lightfast category logic (incorrectly placed). The clean split is: generic hook stays in vendor, category-aware composition moves to `apps/console/src/hooks/use-notification-preferences.ts`. This also removes the `@repo/console-types` dependency from `vendor/knock/package.json`.
2. **Should `knockFeedChannelId` become a prop or env var?** Currently hardcoded in `provider.tsx:12`. Making it a prop on `NotificationsProvider` is the simplest fix and keeps the vendor package generic.
3. **Should `Recipient` move to `@repo/console-types`?** Currently only used in workflow files. If future tRPC routers or other packages need it, it should be promoted. For now, correctly scoped.
4. **Should `ClassifierInput` move to shared types?** If unit tests in a separate package need to construct classifier inputs, yes. Currently only consumed by `classifier.ts` itself.
5. **`notification.dispatch` Inngest event**: Dead code in event schema (lines 719–734). The dispatch workflow listens to `observation.captured`, not this event. Plan documents note keeping it for potential future use.
