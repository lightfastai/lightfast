---
date: 2026-02-07T14:26:24+08:00
researcher: claude
git_commit: 85b2646b2dd6384340686bbc5588f4adb74132ac
branch: feat/realistic-sandbox-test-data
repository: lightfastai/lightfast
topic: "Can the webhook event type system be streamlined? Analysis of current state and console-webhooks-types proposal"
tags: [research, codebase, console-webhooks, console-types, event-types, event-mapping, type-consolidation]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: Webhook Event Type System — Current State & Streamlining Analysis

**Date**: 2026-02-07T14:26:24+08:00
**Researcher**: claude
**Git Commit**: 85b2646b
**Branch**: feat/realistic-sandbox-test-data
**Repository**: lightfastai/lightfast

## Research Question

Is there a clearer, more streamlined pattern for the event type system currently spread across `console-types/src/integrations/event-types.ts`, `console-types/src/integrations/events.ts`, `console-webhooks/src/vercel.ts`, and `console-webhooks/src/event-mapping.ts`? Could a new `console-webhooks-types` package help? What can be merged and strongly typed?

## Summary

The event type system currently serves **three distinct purposes** spread across **two packages** and **four key files**:

1. **Display metadata** (`events.ts`) — What events a user can subscribe to, with labels and descriptions for the UI
2. **Internal registry** (`event-types.ts`) — Canonical event type keys with significance weights for scoring
3. **Provider payload types** (`vercel.ts` and transformer files) — TypeScript types for raw webhook payloads from each provider
4. **Format mapping** (`event-mapping.ts`) — Bidirectional conversion between provider-specific external formats and internal format

The recent consolidation (commit `85b2646b`) has already unified the internal event type keys to use source-prefixed format (`github:push`, `sentry:issue.created`, etc.) and added all 4 sources to both the registry and the mapping layer. The current state is **significantly more streamlined** than it was before this commit.

Below is a detailed map of what exists, how the types flow, and where the remaining type boundaries sit.

## Detailed Findings

### 1. The Four Concerns and Where They Live

#### Concern A: Display Metadata (UI event subscriptions)
**File**: `packages/console-types/src/integrations/events.ts`

Defines what events each provider supports, for use in UI checkboxes/toggles:

| Object | Keys (external format) | Fields | Used By |
|--------|----------------------|--------|---------|
| `GITHUB_EVENTS` | `push`, `pull_request`, `issues`, `release`, `discussion` | label, description, type | UI event subscription |
| `VERCEL_EVENTS` | `deployment.created`, `deployment.succeeded`, etc. | label, description, type | UI event subscription |
| `SENTRY_EVENTS` | `issue`, `error`, `event_alert`, `metric_alert` | label, description, type | UI event subscription |
| `LINEAR_EVENTS` | `Issue`, `Comment`, `Project`, `Cycle`, `ProjectUpdate` | label, description, type | UI event subscription |

Derived types: `GitHubEvent`, `VercelEvent`, `SentryEvent`, `LinearEvent` (keyof each object).

**Key characteristic**: Keys match the **external/provider format** — what the webhook provider calls these events. For example, GitHub uses `pull_request` (underscore), Linear uses PascalCase `Issue`.

#### Concern B: Internal Event Type Registry (scoring + validation)
**File**: `packages/console-types/src/integrations/event-types.ts`

Source of truth for 40 internal event types with source-prefixed keys:

| Source | Count | Example Keys |
|--------|-------|-------------|
| GitHub | 13 | `github:push`, `github:pull-request.opened` |
| Vercel | 5 | `vercel:deployment.created`, `vercel:deployment.error` |
| Sentry | 7 | `sentry:issue.created`, `sentry:metric-alert` |
| Linear | 15 | `linear:issue.created`, `linear:project-update.created` |

Each entry has: `source: SourceType`, `label: string`, `weight: number (0-100)`.

Exports:
- `INTERNAL_EVENT_TYPES` — const object (source of truth)
- `InternalEventType` — union type derived from keys
- `getEventConfig()` — lookup config by type
- `getEventWeight()` — lookup weight (returns 35 for unknown)
- `isInternalEventType()` — type guard
- `ALL_INTERNAL_EVENT_TYPES` — array for iteration

**Key characteristic**: Keys use **internal standardized format** (`{source}:{entity}.{action}`, kebab-case). This is what gets stored in `SourceEvent.sourceType`.

#### Concern C: Provider Webhook Payload Types
Scattered across multiple files in `console-webhooks`:

| Provider | Location | Types Defined |
|----------|----------|--------------|
| GitHub | `transformers/github.ts` | Uses `@octokit/webhooks-types` (PushEvent, PullRequestEvent, etc.) |
| Vercel | `vercel.ts:36-202` | `VercelWebhookEventType`, `VercelWebhookPayload`, `VercelWebhookEvent` |
| Sentry | `transformers/sentry.ts:28-228` | `SentryIssueWebhook`, `SentryErrorWebhook`, `SentryIssue`, etc. |
| Linear | `transformers/linear.ts:28-326` | `LinearWebhookBase`, `LinearIssueWebhook`, `LinearIssue`, etc. |

Plus verification types in `types.ts:8-77`: `WebhookVerificationResult<T>`, `WebhookError` enum.

**Key characteristic**: These are **raw provider payload types** — they model what the external service sends. GitHub uses official `@octokit/webhooks-types`; Sentry, Linear, and Vercel have hand-written interfaces.

#### Concern D: External → Internal Format Mapping
**File**: `packages/console-webhooks/src/event-mapping.ts`

Bidirectional conversion tables and functions:

| Mapping Object | Entries | Conversion |
|---------------|---------|-----------|
| `GITHUB_TO_INTERNAL` | 13 | `pull_request_opened` → `github:pull-request.opened` |
| `VERCEL_TO_INTERNAL` | 5 | `deployment.created` → `vercel:deployment.created` |
| `SENTRY_TO_INTERNAL` | 7 | `event_alert` → `sentry:event-alert` |
| `LINEAR_TO_INTERNAL` | 15 | `Issue:create` → `linear:issue.created` |

Functions: `toInternalGitHubEvent()`, `toInternalVercelEvent()`, `toInternalSentryEvent()`, `toInternalLinearEvent()`, `toExternalGitHubEvent()`.

All mapping values are typed as `InternalEventType`, meaning the compiler enforces they exist in `INTERNAL_EVENT_TYPES`.

### 2. Type Flow Through the System

```
Provider Webhook (raw HTTP)
  │
  ├─ Verification: vercel.ts / github.ts
  │   Types: VercelWebhookPayload, GitHubWebhookEvent
  │
  ├─ Transformation: transformers/*.ts
  │   Input: Provider-specific payload types
  │   Mapping: event-mapping.ts (external → internal format)
  │   Output: SourceEvent { sourceType: string (internal format) }
  │
  ├─ Scoring: scoring.ts
  │   Lookup: getEventWeight(sourceEvent.sourceType) → INTERNAL_EVENT_TYPES
  │
  └─ UI: events.ts
      Display: GITHUB_EVENTS / VERCEL_EVENTS / SENTRY_EVENTS / LINEAR_EVENTS
```

### 3. Current Consumers

| Consumer | Package | What It Imports | From |
|----------|---------|----------------|------|
| GitHub webhook route | apps/console | Verification + all 5 GitHub transformers + storage | console-webhooks |
| Vercel webhook route | apps/console | Verification + Vercel transformer + storage | console-webhooks |
| Scoring pipeline | api/console | `getEventWeight()` | console-types |
| Event mapping | console-webhooks | `InternalEventType` | console-types |
| Test data loader | console-test-data | All transformers + payload types | console-webhooks/transformers |
| Backfill connectors | console-backfill | GitHub + Vercel transformers | console-webhooks/transformers |
| UI components | apps/console | `GITHUB_EVENTS`, `VERCEL_EVENTS`, etc. | console-types |

### 4. Current Overlap Between events.ts and event-types.ts

Both files contain label information for the same events:

| Event | `events.ts` label | `event-types.ts` label |
|-------|-------------------|----------------------|
| GitHub Push | "Push" | "Push" |
| GitHub PR | "Pull Requests" | "PR Opened" / "PR Closed" / etc. |
| Vercel Deployment Created | "Deployment Started" | "Deployment Started" |
| Sentry Issues | "Issues" | "Issue Created" / "Issue Resolved" / etc. |

`events.ts` labels are **category-level** (for UI subscription toggles — "subscribe to Pull Requests").
`event-types.ts` labels are **action-level** (for display in activity feeds — "PR Opened").

These serve different purposes and are not truly duplicated.

### 5. Provider Payload Types in vercel.ts

The `vercel.ts` file at `console-webhooks/src/vercel.ts` serves a **dual role**:
1. **Signature verification** functions (`verifyVercelWebhook`, etc.) — lines 225-416
2. **Payload type definitions** (`VercelWebhookPayload`, `VercelWebhookEventType`) — lines 36-202

This is the same pattern as `github.ts` (lines 1-352) which contains verification functions and references `@octokit/webhooks-types` for payload types.

The Sentry and Linear payload types live in the **transformer** files rather than verification files, because Sentry/Linear don't have signature verification modules yet (they use different auth mechanisms — Sentry uses internal integration tokens, Linear uses IP-based verification).

### 6. The Dependency Hierarchy

```
@repo/console-validation (foundation)
  └── SourceType = "github" | "vercel" | "linear" | "sentry"
  └── sourceEventSchema (Zod runtime validation)
       ↓
@repo/console-types (domain types)
  └── SourceEvent, SourceActor, SourceReference, TransformContext
  └── INTERNAL_EVENT_TYPES + InternalEventType (registry)
  └── GITHUB_EVENTS, VERCEL_EVENTS, SENTRY_EVENTS, LINEAR_EVENTS (display)
       ↓
@repo/console-webhooks (webhook handling)
  └── Verification: github.ts, vercel.ts
  └── Payload types: VercelWebhookPayload, SentryIssueWebhook, etc.
  └── Mapping: event-mapping.ts
  └── Transformers: transformers/*.ts
  └── Storage: storage.ts
```

### 7. What a console-webhooks-types Package Would Contain

If extracted, it would hold:

| Current Location | Type | Would Move? |
|-----------------|------|------------|
| `vercel.ts:36-202` | `VercelWebhookPayload`, `VercelWebhookEventType`, etc. | Yes — pure types |
| `transformers/sentry.ts:28-228` | `SentryIssueWebhook`, `SentryIssue`, etc. | Yes — pure types |
| `transformers/linear.ts:28-326` | `LinearWebhookBase`, `LinearIssue`, etc. | Yes — pure types |
| `types.ts:8-77` | `WebhookVerificationResult`, `WebhookError`, etc. | Yes — pure types |
| `transformers/github.ts` | Uses `@octokit/webhooks-types` directly | No — already externalized |
| `event-mapping.ts` | Mapping objects and functions | Debatable — has runtime code |
| `event-types.ts` (in console-types) | `INTERNAL_EVENT_TYPES`, `InternalEventType` | No — domain-level concern |
| `events.ts` (in console-types) | Display metadata | No — UI-level concern |

The value of a `console-webhooks-types` package would be:
- Clean separation of **pure type definitions** from **runtime code** (verification, transformation, storage)
- Allow consumers to import webhook payload types without pulling in crypto dependencies
- Currently `console-test-data` and `console-backfill` import from `console-webhooks` but only need types + transformers, not verification

The cost:
- One more package to maintain in the monorepo
- Additional build/dependency coordination
- The type definitions in transformer files are **co-located** with the transformer functions that consume them, which is a deliberate design choice for discoverability

## Code References

### Display Metadata
- `packages/console-types/src/integrations/events.ts:2-28` — GITHUB_EVENTS
- `packages/console-types/src/integrations/events.ts:30-56` — VERCEL_EVENTS
- `packages/console-types/src/integrations/events.ts:58-79` — SENTRY_EVENTS
- `packages/console-types/src/integrations/events.ts:81-107` — LINEAR_EVENTS

### Internal Event Type Registry
- `packages/console-types/src/integrations/event-types.ts:25-125` — INTERNAL_EVENT_TYPES (40 entries)
- `packages/console-types/src/integrations/event-types.ts:130` — InternalEventType union
- `packages/console-types/src/integrations/event-types.ts:149-154` — getEventWeight()

### Provider Payload Types
- `packages/console-webhooks/src/vercel.ts:36-202` — Vercel payload types
- `packages/console-webhooks/src/transformers/sentry.ts:28-228` — Sentry payload types
- `packages/console-webhooks/src/transformers/linear.ts:28-326` — Linear payload types
- `packages/console-webhooks/src/types.ts:8-77` — Verification types

### Event Mapping
- `packages/console-webhooks/src/event-mapping.ts:15-38` — GITHUB_TO_INTERNAL
- `packages/console-webhooks/src/event-mapping.ts:44-50` — VERCEL_TO_INTERNAL
- `packages/console-webhooks/src/event-mapping.ts:59-67` — SENTRY_TO_INTERNAL
- `packages/console-webhooks/src/event-mapping.ts:76-92` — LINEAR_TO_INTERNAL

### Consumers
- `api/console/src/inngest/workflow/neural/scoring.ts:83` — getEventWeight() consumer
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` — GitHub webhook handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` — Vercel webhook handler
- `packages/console-test-data/src/loader/transform.ts` — Test data loader
- `packages/console-backfill/src/connectors/github.ts` — GitHub backfill

### Barrel Exports
- `packages/console-types/src/integrations/index.ts:1-2` — Re-exports events + event-types
- `packages/console-types/src/index.ts:15` — Re-exports integrations
- `packages/console-webhooks/src/index.ts:66` — Re-exports event-mapping

## Architecture Documentation

### Current Package Responsibilities

| Package | Responsibility | Event Type Concerns |
|---------|---------------|-------------------|
| `console-validation` | Zod schemas, SourceType enum | Foundation: SourceType = 4 sources |
| `console-types` | Domain types (SourceEvent, etc.) | Registry (INTERNAL_EVENT_TYPES) + Display (events.ts) |
| `console-webhooks` | Verification, transformation, mapping, storage | Payload types + mapping + transformer functions |

### How events.ts and event-types.ts Relate

```
events.ts (category-level, external keys)        event-types.ts (action-level, internal keys)
┌──────────────────────────────┐                 ┌──────────────────────────────────────┐
│ GITHUB_EVENTS.pull_request   │  ──one-to-many──▶  github:pull-request.opened          │
│   label: "Pull Requests"     │                 │  github:pull-request.closed          │
│   desc: "Capture PR opens.." │                 │  github:pull-request.merged          │
│   type: "observation"        │                 │  github:pull-request.reopened        │
│                              │                 │  github:pull-request.ready-for-review│
└──────────────────────────────┘                 └──────────────────────────────────────┘
```

`events.ts` = "what can you subscribe to" (coarse-grained, for UI)
`event-types.ts` = "what specific thing happened" (fine-grained, for processing)

### Mapping Layer Position

```
External format (provider)  ──event-mapping.ts──▶  Internal format (INTERNAL_EVENT_TYPES keys)
  pull_request_opened                                github:pull-request.opened
  deployment.succeeded                               vercel:deployment.succeeded
  issue.created                                      sentry:issue.created
  Issue:create                                       linear:issue.created
```

The mapping layer is the **boundary adapter** — it lives in `console-webhooks` because it's part of the webhook processing pipeline, not the domain type system.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-07-webhook-event-type-consolidation.md` — The consolidation plan that was executed in commit `85b2646b`. Introduced source-prefixed keys, added all 40 event types, created Sentry/Linear mappings, and updated all transformers to use mapping functions.
- `thoughts/shared/research/2026-02-07-webhook-transformer-event-type-fragmentation.md` — Pre-consolidation research documenting the fragmentation: only 18 registered types (GitHub + Vercel), missing Sentry/Linear mappings, namespace collisions on `issue.created`.
- `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md` — Earlier plan that promoted Sentry/Linear transformers from `console-test-data` to `console-webhooks`.

## Related Research

- `thoughts/shared/research/2025-12-15-webhook-actor-shape-verification.md`
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md`
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md`

## Open Questions

1. **Is a `console-webhooks-types` package worth the coordination cost?** The main benefit is allowing type-only imports without pulling in crypto/storage dependencies. The cost is another package in the monorepo. Currently 3 consumers import payload types: test-data loader, backfill connectors, and webhook routes.

2. **Should events.ts and event-types.ts be merged?** They serve different granularities (category vs. action) and different audiences (UI vs. backend). A merge would require the UI to handle the one-to-many relationship explicitly.

3. **Should the display labels from events.ts be derivable from event-types.ts?** Currently both have independent label strings. A function like `getEventCategoryLabel(source, entity)` could derive category labels from the action-level registry, but this adds coupling between UI and backend concerns.
