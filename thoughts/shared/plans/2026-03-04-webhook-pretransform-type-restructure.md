# Webhook PreTransform Type Restructure

## Overview

Restructure `@repo/console-webhooks` from a flat `transformers/` directory into `pre-transformers/` and `post-transformers/`. Pre-transformers contain strict PreTransform type definitions (with `PreTransform` prefix naming) alongside their transform functions. Post-transformers contain PostTransform validation and type re-exports. Delete the `transformers/` directory entirely. Fix all `.js` import extensions to extensionless imports (`.js` convention is only for Hono services: gateway, relay, backfill). Update `@repo/console-types/provider.ts` to import and re-export both PreTransform and PostTransform type families as the single source of truth for the full pipeline typing.

## Current State Analysis

The package has a flat structure where each `transformers/*.ts` file mixes PreTransform type definitions with transform logic:

```
src/
├── index.ts                 (barrel exports)
├── sanitize.ts              (content sanitization)
├── transform-context.ts     (TransformContext interface)
├── validation.ts            (validatePostTransformEvent)
└── transformers/
    ├── github.ts            (re-exports from @octokit/webhooks-types + 5 transform functions)
    ├── linear.ts            (~300 lines of self-defined interfaces + 5 transform functions)
    ├── vercel.ts            (~42 lines of self-defined interface + 1 transform function)
    └── sentry.ts            (~188 lines of self-defined interfaces + 4 transform functions)
```

### Key Discoveries:
- `@octokit/webhooks-types` is TypeScript-only (no Zod) — already imported at `transformers/github.ts:6-12`
- Linear, Vercel, Sentry have no official PreTransform type packages — self-defined types are correct approach
- Self-defined types have fixture gaps vs real wire payloads (documented in research)
- External consumers import from `"@repo/console-webhooks"` (bare package) — consumers will need updating for renamed types
- `PostTransformEvent` lives in `@repo/console-validation` — `validation.ts` just wraps `safeParse`
- All internal imports incorrectly use `.js` extensions (e.g., `from "../transform-context.js"`) — should be extensionless
- `@repo/console-types/provider.ts` is the single source of truth for provider/event metadata but has no type-level awareness of PreTransform or PostTransform shapes

### External Consumers (need type rename updates):
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts`
- `packages/console-test-data/src/loader/transform.ts`
- `packages/console-test-data/src/loader/index.ts`
- `packages/console-backfill/src/adapters/vercel.ts`
- `packages/console-backfill/src/adapters/round-trip.test.ts`
- `packages/console-backfill/src/adapters/github.ts` (imports `@octokit/webhooks-types` directly — unaffected)

## Desired End State

```
packages/console-webhooks/src/
├── index.ts                 (updated barrel — re-exports from pre-transformers/ and post-transformers/)
├── sanitize.ts              (unchanged)
├── transform-context.ts     (unchanged)
├── pre-transformers/
│   ├── index.ts             (barrel)
│   ├── github.ts            (PreTransform* types aliased from @octokit/webhooks-types + transform functions)
│   ├── linear.ts            (PreTransform* self-defined types + transform functions, fixture gaps fixed)
│   ├── vercel.ts            (PreTransform* self-defined types + transform function, fixture gaps fixed)
│   └── sentry.ts            (PreTransform* self-defined types + transform functions, fixture gaps fixed)
└── post-transformers/
    ├── index.ts             (barrel)
    └── validation.ts        (moved from src/validation.ts)

packages/console-types/src/provider.ts
└── imports and re-exports both PreTransform* and PostTransform* type families
```

### Naming Convention

Top-level webhook envelope types get the `PreTransform` prefix:

| Old Name | New Name | Source |
|---|---|---|
| `PushEvent` | `PreTransformGitHubPushEvent` | `= PushEvent` from `@octokit/webhooks-types` |
| `PullRequestEvent` | `PreTransformGitHubPullRequestEvent` | `= PullRequestEvent` from `@octokit/webhooks-types` |
| `IssuesEvent` | `PreTransformGitHubIssuesEvent` | `= IssuesEvent` from `@octokit/webhooks-types` |
| `ReleaseEvent` | `PreTransformGitHubReleaseEvent` | `= ReleaseEvent` from `@octokit/webhooks-types` |
| `DiscussionEvent` | `PreTransformGitHubDiscussionEvent` | `= DiscussionEvent` from `@octokit/webhooks-types` |
| `LinearIssueWebhook` | `PreTransformLinearIssueWebhook` | Self-defined |
| `LinearCommentWebhook` | `PreTransformLinearCommentWebhook` | Self-defined |
| `LinearProjectWebhook` | `PreTransformLinearProjectWebhook` | Self-defined |
| `LinearCycleWebhook` | `PreTransformLinearCycleWebhook` | Self-defined |
| `LinearProjectUpdateWebhook` | `PreTransformLinearProjectUpdateWebhook` | Self-defined |
| `VercelWebhookPayload` | `PreTransformVercelWebhookPayload` | Self-defined |
| `SentryIssueWebhook` | `PreTransformSentryIssueWebhook` | Self-defined |
| `SentryErrorWebhook` | `PreTransformSentryErrorWebhook` | Self-defined |
| `SentryEventAlertWebhook` | `PreTransformSentryEventAlertWebhook` | Self-defined |
| `SentryMetricAlertWebhook` | `PreTransformSentryMetricAlertWebhook` | Self-defined |

Supporting/nested types (`LinearIssue`, `LinearUser`, `SentryIssue`, `SentryActor`, etc.) keep their current names — they're sub-types within the PreTransform namespace, not top-level envelope types.

All internal imports use extensionless paths (e.g., `from "../transform-context"` not `from "../transform-context.js"`).

Each pre-transformer file has a header comment documenting:
- Whether types come from an external library or are self-defined
- Why (library availability, quality of exports)
- Date of last fixture verification

## What We're NOT Doing

- Inject-event Zod schema enforcement (separate follow-up)
- PostTransform type changes (maintain as-is)
- Modifying `@repo/console-validation`
- Changing the relay's loose `schemas.ts` Zod schemas
- Adding new providers

## Implementation Approach

Rename types with `PreTransform` prefix, move files into new directory structure, fix fixture gaps, fix import extensions, update barrel, update all consumers, and integrate both type families into `console-types/provider.ts`.

---

## Phase 1: Create `pre-transformers/` with `PreTransform` prefix naming

### Overview
Create the new directory structure. Move each transformer file from `transformers/` to `pre-transformers/`, renaming top-level envelope types with the `PreTransform` prefix. Add decision documentation comments. Fix all `.js` import extensions to extensionless.

### Changes Required:

#### 1. Create `src/pre-transformers/github.ts`
**Source**: Copy from `src/transformers/github.ts`
**Changes**:
- Add decision documentation header
- Fix internal imports: `"../transform-context.js"` → `"../transform-context"`, `"../validation.js"` → `"../post-transformers/validation"`, `"../sanitize.js"` → `"../sanitize"`
- Add `PreTransform` aliases for the 5 event types from `@octokit/webhooks-types`
- Update transformer function signatures to use `PreTransform` names

```typescript
/**
 * GitHub Pre-Transform Types & Transformers
 *
 * PreTransform types: Re-exported from @octokit/webhooks-types (v7.6.1)
 * Decision: Official package, maintained by GitHub/Octokit, generated from GitHub's OpenAPI spec.
 * Zero-dependency, ~2.8M weekly downloads. No reason to self-define.
 *
 * Fixture verified: apps/relay/src/__fixtures__/github-push.json
 * Last verified: 2026-03-04
 */

import type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";

// PreTransform type aliases — re-exported from @octokit/webhooks-types
export type PreTransformGitHubPushEvent = PushEvent;
export type PreTransformGitHubPullRequestEvent = PullRequestEvent;
export type PreTransformGitHubIssuesEvent = IssuesEvent;
export type PreTransformGitHubReleaseEvent = ReleaseEvent;
export type PreTransformGitHubDiscussionEvent = DiscussionEvent;
```

#### 2. Create `src/pre-transformers/linear.ts`
**Source**: Copy from `src/transformers/linear.ts`
**Changes**:
- Add decision documentation header
- Fix internal imports to extensionless + updated validation path
- Rename top-level webhook types: `LinearIssueWebhook` → `PreTransformLinearIssueWebhook`, etc.
- Keep supporting types (`LinearIssue`, `LinearUser`, `LinearLabel`, etc.) unchanged

```typescript
/**
 * Linear Pre-Transform Types & Transformers
 *
 * PreTransform types: Self-defined.
 * Decision: @linear/sdk/webhooks (added July 2025) does not export standalone named TypeScript
 * interfaces. Types are inferred through the handler's generic event system, not as discrete
 * `export type` declarations. Additionally, webhook payloads use flat string IDs (e.g., `teamId`)
 * while the SDK types use nested objects (e.g., `team: Team`), making the SDK types structurally
 * incompatible with wire payloads.
 *
 * Fixture verified: apps/relay/src/__fixtures__/linear-issue-create.json
 * Last verified: 2026-03-04
 */

// Top-level envelope types — PreTransform prefixed
export interface PreTransformLinearIssueWebhook extends LinearWebhookBase { ... }
export interface PreTransformLinearCommentWebhook extends LinearWebhookBase { ... }
export interface PreTransformLinearProjectWebhook extends LinearWebhookBase { ... }
export interface PreTransformLinearCycleWebhook extends LinearWebhookBase { ... }
export interface PreTransformLinearProjectUpdateWebhook extends LinearWebhookBase { ... }

// Supporting types — no prefix (sub-types within the PreTransform namespace)
export interface LinearWebhookBase { ... }
export interface LinearIssue { ... }
export interface LinearUser { ... }
// etc.
```

#### 3. Create `src/pre-transformers/vercel.ts`
**Source**: Copy from `src/transformers/vercel.ts`
**Changes**:
- Add decision documentation header
- Fix internal imports to extensionless + updated validation path
- Rename: `VercelWebhookPayload` → `PreTransformVercelWebhookPayload`

```typescript
/**
 * Vercel Pre-Transform Types & Transformers
 *
 * PreTransform types: Self-defined.
 * Decision: No official @vercel/webhooks package exists. @vercel/sdk is a REST API client
 * for managing webhooks (create, list, delete) and does not export inbound webhook payload types.
 *
 * Fixture verified: apps/relay/src/__fixtures__/vercel-deployment.json
 * Last verified: 2026-03-04
 */

export interface PreTransformVercelWebhookPayload { ... }
```

#### 4. Create `src/pre-transformers/sentry.ts`
**Source**: Copy from `src/transformers/sentry.ts`
**Changes**:
- Add decision documentation header
- Fix internal imports to extensionless + updated validation path
- Rename envelope types: `SentryIssueWebhook` → `PreTransformSentryIssueWebhook`, etc.
- Keep supporting types (`SentryIssue`, `SentryErrorEvent`, `SentryActor`) unchanged

```typescript
/**
 * Sentry Pre-Transform Types & Transformers
 *
 * PreTransform types: Self-defined.
 * Decision: @sentry/types contains SDK-internal types (Breadcrumb, Event, Scope) for sending
 * data TO Sentry, not for receiving integration platform webhooks. No @sentry/webhooks or
 * @sentry/integration-types package exists.
 *
 * Fixture verified: apps/relay/src/__fixtures__/sentry-issue.json
 * Last verified: 2026-03-04
 */

// Top-level envelope types — PreTransform prefixed
export interface PreTransformSentryIssueWebhook { ... }
export interface PreTransformSentryErrorWebhook { ... }
export interface PreTransformSentryEventAlertWebhook { ... }
export interface PreTransformSentryMetricAlertWebhook { ... }

// Supporting types — no prefix
export interface SentryIssue { ... }
export interface SentryErrorEvent { ... }
export interface SentryActor { ... }
```

#### 5. Create `src/pre-transformers/index.ts`
**New file**: Barrel export for all pre-transformers with new names.

```typescript
/**
 * Pre-Transform Types & Transformers
 *
 * Each provider file contains:
 * 1. PreTransform type definitions (wire payload shapes as received from the provider)
 * 2. Transform functions that convert PreTransform → PostTransformEvent
 *
 * Type source decisions are documented at the top of each provider file.
 */

// GitHub (types from @octokit/webhooks-types)
export {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  githubTransformers,
} from "./github";
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookEventType,
} from "./github";

// Vercel (self-defined types)
export {
  transformVercelDeployment,
  vercelTransformers,
} from "./vercel";
export type {
  VercelWebhookEventType,
  PreTransformVercelWebhookPayload,
} from "./vercel";

// Linear (self-defined types)
export {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
  linearTransformers,
} from "./linear";
export type {
  LinearWebhookBase,
  LinearWebhookEventType,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  LinearIssue,
  LinearAttachment,
  LinearComment,
  LinearProject,
  LinearCycle,
  LinearProjectUpdate,
  LinearUser,
  LinearLabel,
} from "./linear";

// Sentry (self-defined types)
export {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
  sentryTransformers,
} from "./sentry";
export type {
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./sentry";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [x] Each pre-transformer file has a clear decision documentation header
- [x] No `.js` extensions in any import within the package
- [x] All top-level envelope types have `PreTransform` prefix
- [x] Supporting/nested types (`LinearIssue`, `SentryActor`, etc.) keep original names

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Fix PreTransform type fixture gaps

### Overview
Update self-defined PreTransform interfaces to match real wire payloads observed in fixtures. This ensures strict correctness — the types should represent what the provider actually sends.

### Changes Required:

#### 1. Linear — `src/pre-transformers/linear.ts`

Add missing fields to `LinearWebhookBase` (verified against `__fixtures__/linear-issue-create.json`):

```typescript
export interface LinearWebhookBase {
  action: "create" | "update" | "remove";
  type: LinearWebhookEventType;
  createdAt: string;
  organizationId: string;
  webhookId: string;
  webhookTimestamp: number;
  // Fields present in real payloads but not previously typed:
  url?: string;              // URL to the affected resource
  actor?: LinearUser;        // User or app that triggered the webhook
}
```

Note: `actor` is optional because automated/system events may not have one. The transformers currently use `payload.data.creator` instead of `payload.actor` — both are valid; the transformer's choice is intentional since `creator` is entity-specific.

#### 2. Vercel — `src/pre-transformers/vercel.ts`

Add missing fields to `PreTransformVercelWebhookPayload` (verified against `__fixtures__/vercel-deployment.json`):

```typescript
export interface PreTransformVercelWebhookPayload {
  id: string;
  type: string;
  createdAt: number;
  region?: string;
  payload: {
    deployment?: {
      id: string;
      name: string;
      url?: string;
      readyState?: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED";
      errorCode?: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubCommitAuthorLogin?: string;
        githubOrg?: string;
        githubRepo?: string;
        githubDeployment?: string;
        githubCommitOrg?: string;
        githubCommitRepo?: string;
        githubCommitRepoId?: string;
        githubPrId?: string;
        // Fields present in real payloads but not previously typed:
        githubRepoId?: string;
        githubRepoOwnerType?: string;
      };
    };
    project?: {
      id: string;
      name: string;
    };
    team?: {
      id: string;
      slug?: string;
      name?: string;
    };
    user?: {
      id: string;
    };
    // Fields present in real payloads but not previously typed:
    alias?: string[];
    links?: {
      deployment?: string;
      project?: string;
    };
    plan?: string;
    regions?: string[];
    [key: string]: unknown;
  };
}
```

#### 3. Sentry — `src/pre-transformers/sentry.ts`

Add missing fields to `SentryIssue` (verified against `__fixtures__/sentry-issue.json`):

```typescript
export interface SentryIssue {
  // ... existing fields ...
  // Fields present in real payloads but not previously typed:
  shareId?: string | null;
  substatus?: string;
  subscriptionDetails?: Record<string, unknown> | null;
  issueType?: string;
  issueCategory?: string;
  priority?: string;
  priorityLockedAt?: string | null;
  isUnhandled?: boolean;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [x] Each new field has a comment noting it was verified against the fixture
- [x] No existing transformer logic changes — new fields are all optional
- [ ] Verify fixture files match the updated types: compare `__fixtures__/*.json` field-by-field

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Create `post-transformers/`, delete `transformers/`, update consumers

### Overview
Move `validation.ts` into `post-transformers/`. Update the package barrel `index.ts`. Delete `transformers/` and old `validation.ts`. Update all external consumers to use the new `PreTransform` type names.

### Changes Required:

#### 1. Create `src/post-transformers/validation.ts`
**Source**: Move from `src/validation.ts`
**Changes**: None — file content stays identical.

#### 2. Create `src/post-transformers/index.ts`
**New file**: Barrel export for post-transform utilities.

```typescript
/**
 * Post-Transform Validation & Types
 *
 * PostTransformEvent is the canonical shape produced by pre-transformers
 * and stored as JSONB in workspace_events. The Zod schema and TypeScript
 * types are defined in @repo/console-validation — this module provides
 * the validation wrapper used by transform functions.
 */

export { validatePostTransformEvent, type ValidationResult } from "./validation";
```

#### 3. Update `src/index.ts`
**Changes**: Point all imports at new directories. Use extensionless imports. Export new `PreTransform` names.

```typescript
/**
 * @repo/console-webhooks
 *
 * Webhook event pre-transformers, post-transform validation, and sanitization
 * for Console integrations.
 *
 * Structure:
 * - pre-transformers/  — PreTransform types + transform functions per provider
 * - post-transformers/ — PostTransform validation
 * - sanitize.ts        — Content sanitization utilities
 */

// Post-transform validation
export { validatePostTransformEvent, type ValidationResult } from "./post-transformers";

// Transform context
export type { TransformContext } from "./transform-context";

// Sanitization utilities
export {
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  encodeHtmlEntities,
  truncateWithEllipsis,
  sanitizeContent,
  sanitizeTitle,
  sanitizeBody,
} from "./sanitize";

// Pre-transformers (types + transform functions)
export {
  // GitHub
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  githubTransformers,
  // Vercel
  transformVercelDeployment,
  vercelTransformers,
  // Linear
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
  linearTransformers,
  // Sentry
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
  sentryTransformers,
} from "./pre-transformers";

export type {
  // GitHub (from @octokit/webhooks-types)
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  GitHubWebhookEventType,
  // Vercel (self-defined)
  VercelWebhookEventType,
  PreTransformVercelWebhookPayload,
  // Linear (self-defined)
  LinearWebhookBase,
  LinearWebhookEventType,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  LinearIssue,
  LinearAttachment,
  LinearComment,
  LinearProject,
  LinearCycle,
  LinearProjectUpdate,
  LinearUser,
  LinearLabel,
  // Sentry (self-defined)
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
  SentryIssue,
  SentryErrorEvent,
  SentryActor,
  SentryWebhookEventType,
} from "./pre-transformers";
```

#### 4. Delete `src/transformers/` directory
Remove:
- `src/transformers/github.ts`
- `src/transformers/linear.ts`
- `src/transformers/vercel.ts`
- `src/transformers/sentry.ts`

#### 5. Delete `src/validation.ts`
Moved to `src/post-transformers/validation.ts`.

#### 6. Update external consumers

All consumers that import the renamed types need updating. Transform function names and supporting types are unchanged.

**`apps/console/src/app/api/gateway/ingress/_lib/transform.ts`**:
```typescript
// Before:
import type { VercelWebhookPayload } from "@repo/console-webhooks";
import type { PushEvent, PullRequestEvent, IssuesEvent, ReleaseEvent, DiscussionEvent } from "@repo/console-webhooks";

// After:
import type { PreTransformVercelWebhookPayload } from "@repo/console-webhooks";
import type { PreTransformGitHubPushEvent, PreTransformGitHubPullRequestEvent, PreTransformGitHubIssuesEvent, PreTransformGitHubReleaseEvent, PreTransformGitHubDiscussionEvent } from "@repo/console-webhooks";
```

**`packages/console-test-data/src/loader/transform.ts`**:
```typescript
// Before:
import type { PushEvent, PullRequestEvent, ... } from "@repo/console-webhooks";
import type { SentryIssueWebhook, ... } from "@repo/console-webhooks";
import type { LinearIssueWebhook, ... } from "@repo/console-webhooks";
import type { VercelWebhookPayload } from "@repo/console-webhooks";

// After:
import type { PreTransformGitHubPushEvent, PreTransformGitHubPullRequestEvent, ... } from "@repo/console-webhooks";
import type { PreTransformSentryIssueWebhook, ... } from "@repo/console-webhooks";
import type { PreTransformLinearIssueWebhook, ... } from "@repo/console-webhooks";
import type { PreTransformVercelWebhookPayload } from "@repo/console-webhooks";
```

**`packages/console-backfill/src/adapters/vercel.ts`**:
```typescript
// Before:
import { VercelWebhookPayload, ... } from "@repo/console-webhooks";

// After:
import { PreTransformVercelWebhookPayload, ... } from "@repo/console-webhooks";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [x] `src/transformers/` directory no longer exists
- [x] `src/validation.ts` no longer exists
- [x] No `.js` extensions remain in any import within the package
- [x] All external consumers compile with new type names

---

## Phase 4: Integrate PreTransform + PostTransform types into `console-types/provider.ts`

### Overview
Update `@repo/console-types/provider.ts` to import and re-export both PreTransform and PostTransform type families, making it the single source of truth for the full pipeline typing per event.

### Changes Required:

#### 1. Update `packages/console-types/src/provider.ts`

Add type imports from both `@repo/console-webhooks` (PreTransform) and `@repo/console-validation` (PostTransform), then re-export them so consumers can import the complete type picture from `@repo/console-types`.

```typescript
// ─── Pipeline Type Re-exports ────────────────────────────────────────────────
// PreTransform types (wire payload shapes as received from providers)
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  PreTransformVercelWebhookPayload,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
} from "@repo/console-webhooks";

// PostTransform types (normalized event shapes after transformation)
export type {
  PostTransformEvent,
  PostTransformActor,
  PostTransformReference,
} from "@repo/console-validation";
```

#### 2. Update `packages/console-types/package.json`

Add `@repo/console-webhooks` as a dependency (if not already present):

```json
{
  "dependencies": {
    "@repo/console-webhooks": "workspace:*"
  }
}
```

Note: `@repo/console-validation` should already be a dependency since `SourceType` is imported from it.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [x] `@repo/console-types` exports both PreTransform and PostTransform type families
- [x] No circular dependency issues between console-types ↔ console-webhooks

**Implementation Note**: The plan originally assumed `console-webhooks` did not depend on `console-types`, but it did (stale dep). Removed stale `@repo/console-types` and `@db/console` deps from `console-webhooks/package.json` — neither was imported in source code. This broke the cycle and allowed Phase 4 to proceed.

---

## Testing Strategy

### Automated:
- Existing transformer unit tests should pass unchanged — no functional changes
- Type checking validates all consumer imports still resolve
- `pnpm build:console` validates the full build chain

### Manual:
- Verify `src/transformers/` is fully deleted
- Spot-check that each pre-transformer file has the correct decision documentation header
- Grep for `.js"` or `.js'` in `packages/console-webhooks/src/` to confirm no `.js` extensions remain
- Compare fixture JSON files field-by-field against updated interfaces
- Verify `@repo/console-types` can be imported with both PreTransform and PostTransform types

## References

- Research: `thoughts/shared/research/2026-03-04-webhook-pretransform-type-strategy.md`
- Package: `packages/console-webhooks/`
- Provider registry: `packages/console-types/src/provider.ts`
- Fixtures: `apps/relay/src/__fixtures__/`
- PostTransform schema: `packages/console-validation/src/schemas/post-transform-event.ts`
