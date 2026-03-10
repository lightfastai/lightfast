# Observer + Graph Service Split — Implementation Plan

## Overview

Split the monolithic `observation-capture.ts` (1241 lines) into two independent Hono services: **observer** (classify, embed, extract, store) and **graph** (edge resolution, cluster assignment). Introduce a declarative `edges` property on `ProviderDefinition` so providers declare their cross-source relationship rules, and a `workspace_linking_keys` table for order-independent edge resolution.

## Current State Analysis

The entire neural observation pipeline is a single Inngest function (`observation-capture.ts:321-1241`) that bundles three concerns:

1. **Observation capture** — classification, embedding, entity extraction, storage
2. **Graph building** — relationship detection via JSONB containment queries, cluster assignment
3. **Actor reconciliation** — cross-source actor ID resolution (Vercel→GitHub via commit SHA)

Cross-source linking logic is hardcoded in `relationship-detection.ts` with provider-specific `if/else` chains. No `edges` (or any linking) property exists on `ProviderDefinition`. The relationship detection system is point-in-time — each observation gets exactly one chance to create edges at capture time, causing correctness bugs when webhooks arrive out of order.

### Key Discoveries:
- `relationship-detection.ts:460-485` — `determineCommitRelationType` uses hardcoded source-pair matching
- `relationship-detection.ts:48-252` — Five detection blocks, each with hardcoded reference type filters
- `relationship-detection.ts:413-450` — `findObservationsByPrId` only searches `sourceId` (misses Linear issues)
- No GIN index on `sourceReferences` JSONB — all relationship queries are full table scans within workspace
- `reconcileVercelActorsForCommit` (`observation-capture.ts:217-314`) is the only forward reconciliation pattern
- Backfill app demonstrates independent Inngest client pattern at `apps/backfill/src/inngest/client.ts:50`

## Desired End State

Two independent Hono services communicating via Inngest events:

```
Webhook → Relay → Console ingress → transform
  → apps/observer (Inngest: apps-observer/observation.capture)
     ├── duplicate check, event allowlist, significance gate
     ├── classify (LLM) + embed (3 views) + extract entities
     ├── store observation + entities to DB
     ├── upsert 3 vectors to Pinecone
     └── emit apps-observer/observation.stored
  → apps/graph (Inngest: apps-graph/observation.process)
     ├── extract + insert linking keys from observation references
     ├── query workspace_linking_keys for matches
     ├── resolve edge rules (bidirectional, both providers' rules)
     ├── create relationship edges
     ├── cluster assignment (Pinecone cosine similarity)
     └── emit downstream events (profile.update, cluster.check-summary)
```

**Verification**: After all phases complete:
- `pnpm typecheck` passes
- `pnpm check` passes
- Observer processes a webhook end-to-end and emits `observation.stored`
- Graph receives `observation.stored`, resolves edges via rules, writes relationships
- Out-of-order webhooks (e.g., Sentry resolved_by before GitHub push) produce correct `resolves` relationship regardless of arrival order

## What We're NOT Doing

- **Actor reconciliation rework** — deferred to a future plan. Actor resolution stays as-is (moved to observer). `reconcileVercelActorsForCommit` is kept in graph as a temporary compatibility shim.
- **GIN index on sourceReferences** — superseded by `workspace_linking_keys` table for edge resolution. JSONB queries for actor reconciliation stay as-is.
- **PostTransformReference.type expansion** — future providers (Stripe, Clerk, etc.) will add types when implemented. The `edges` interface is designed to be open/extensible for this.
- **Cluster assignment rework** — moved to graph service as-is, no algorithm changes.
- **Profile update / LLM entity extraction rework** — stay as fire-and-forget Inngest events.

## Implementation Approach

Phase 1 establishes the type system (`EdgeRule`, extensible `RelationshipType`, `edges` on `ProviderDefinition`) and adds edge declarations to all four providers. Phase 2 creates the `workspace_linking_keys` table. Phase 3 scaffolds the observer Hono app and migrates observation capture steps. Phase 4 scaffolds the graph Hono app with the rule-based edge resolution algorithm. Phase 5 wires the event flow, deletes the monolith, and updates dev tooling.

---

## Phase 1: Types & Provider Edge Declarations

### Overview

Add the `EdgeRule` interface and `edges` property to `ProviderDefinition`. Declare edge rules on all four providers. Define an extensible `RelationshipType` and `LinkableRefType` in `console-providers`.

### Changes Required:

#### 1. Edge Types

**File**: `packages/console-providers/src/edges.ts` (new)

```typescript
import type { PostTransformReference } from "./post-transform-event";

// ── Ref Types ────────────────────────────────────────────────────────────────

/**
 * Reference types that can participate in cross-source observation linking.
 * Subset of PostTransformReference["type"]. New provider categories (GTM,
 * support, billing, auth) extend this list — the system is designed to
 * generalise to any reference type.
 */
export const LINKABLE_REF_TYPES = [
  "commit",
  "branch",
  "pr",
  "issue",
] as const;

export type LinkableRefType = (typeof LINKABLE_REF_TYPES)[number];

// ── Relationship Types ───────────────────────────────────────────────────────

/**
 * Known relationship types produced by edge resolution.
 *
 * This is an open union — providers can declare custom relationship strings
 * (e.g., "same_customer", "identified_as") for future provider categories.
 * The `(string & {})` arm preserves autocomplete for known types while
 * accepting any string at the type level.
 */
export const KNOWN_RELATIONSHIP_TYPES = [
  "deploys",
  "fixes",
  "references",
  "resolves",
  "same_branch",
  "same_commit",
  "tracked_in",
  "triggers",
] as const;

export type KnownRelationshipType = (typeof KNOWN_RELATIONSHIP_TYPES)[number];

export type RelationshipType = KnownRelationshipType | (string & {});

// ── Edge Rules ───────────────────────────────────────────────────────────────

/**
 * Declarative rule for how a provider's references create graph edges.
 *
 * When the graph service finds two observations sharing a linking key
 * (same refType + same value), it evaluates rules from BOTH providers
 * to determine the relationship type:
 *
 * 1. Collect matching rules from both providers
 * 2. Prefer rules with a refLabel match over wildcard (no refLabel)
 * 3. Between equal-specificity rules, prefer higher confidence
 * 4. If no provider rule matches, fall back to DEFAULT_EDGE_RULES
 *
 * Example: Sentry declares `{ refType: "commit", refLabel: "resolved_by", relationship: "resolves" }`.
 * When a GitHub push arrives with the same commit SHA, the graph service checks
 * Sentry's rules (finds the "resolved_by" rule) and creates a "resolves" edge —
 * regardless of which observation arrived first.
 */
export interface EdgeRule {
  /** The reference type this rule applies to */
  readonly refType: LinkableRefType;
  /**
   * Only apply when this provider's reference has this label.
   * Matches against PostTransformReference.label.
   * Omit to match any label (lower specificity).
   */
  readonly refLabel?: string;
  /**
   * Provider source to match against. Omit or "*" for any provider.
   * Use a specific provider name for targeted rules (e.g., "vercel").
   */
  readonly matchSource?: string;
  /** The relationship type to create when this rule matches */
  readonly relationship: RelationshipType;
  /**
   * Confidence score (0–1). Used as a tiebreaker when both providers
   * have matching rules at the same specificity level. Default: 1.0
   */
  readonly confidence?: number;
}

// ── Default Rules ────────────────────────────────────────────────────────────

/**
 * Fallback edge rules applied when no provider-specific rule matches.
 * Low confidence (0.5) so any provider-declared rule at 1.0 always wins.
 *
 * These capture universal semantics: "two observations share the same X."
 * Providers only need to declare rules for specific/interesting relationships
 * (e.g., "deploys", "fixes", "resolves") — the defaults handle the rest.
 *
 * When new reference types are added for future providers (email, customer,
 * subscription, etc.), add corresponding defaults here.
 */
export const DEFAULT_EDGE_RULES: readonly EdgeRule[] = [
  { refType: "commit", relationship: "same_commit", confidence: 0.5 },
  { refType: "branch", relationship: "same_branch", confidence: 0.5 },
  { refType: "pr", relationship: "references", confidence: 0.5 },
  { refType: "issue", relationship: "references", confidence: 0.5 },
];
```

#### 2. Update ProviderDefinition

**File**: `packages/console-providers/src/define.ts`

Add to imports:
```typescript
import type { EdgeRule } from "./edges";
```

Add to `ProviderDefinition` interface (alphabetical — between `events` and `getBaseEventType`):
```typescript
  /**
   * Declarative rules for cross-source observation edge creation.
   * Evaluated by the graph service when matching observations share a linking key.
   * Omit for providers that don't participate in cross-source linking.
   */
  readonly edges?: readonly EdgeRule[];
```

Update `defineProvider` function's `def` parameter type to include `edges`:
```typescript
// No additional constraint needed — EdgeRule fields are already type-safe.
// Unlike defaultSyncEvents (constrained to keyof TCategories), edges uses
// fixed union types (LinkableRefType, RelationshipType) not generic params.
```

The `Omit<..., "env">` already handles the exclusion. `edges` passes through as-is since it's optional and has no generic dependencies.

#### 3. GitHub Edge Rules

**File**: `packages/console-providers/src/providers/github/index.ts`

Add to the `defineProvider()` call (alphabetical — between `events` and `getBaseEventType`):

```typescript
  edges: [
    // GitHub commit → Vercel deployment = deploys
    { refType: "commit", matchSource: "vercel", relationship: "deploys" },
    // PR body "fixes/closes/resolves #123" → issue
    { refType: "issue", refLabel: "fix", relationship: "fixes" },
    { refType: "issue", refLabel: "close", relationship: "fixes" },
    { refType: "issue", refLabel: "resolve", relationship: "fixes" },
  ],
```

Default rules handle: `same_commit` (commit↔commit fallback), `same_branch` (branch↔branch), `references` (issue↔issue fallback, pr↔pr fallback).

#### 4. Sentry Edge Rules

**File**: `packages/console-providers/src/providers/sentry/index.ts`

```typescript
  edges: [
    // Sentry issue resolved via commit → resolves
    { refType: "commit", refLabel: "resolved_by", relationship: "resolves" },
  ],
```

#### 5. Linear Edge Rules

**File**: `packages/console-providers/src/providers/linear/index.ts`

```typescript
  edges: [
    // Linear issue with GitHub PR attachment → tracked_in
    { refType: "pr", refLabel: "tracked_in", matchSource: "github", relationship: "tracked_in" },
    // Linear issue with Sentry attachment → triggers
    { refType: "issue", refLabel: "linked", matchSource: "sentry", relationship: "triggers", confidence: 0.8 },
  ],
```

#### 6. Vercel Edge Rules

**File**: `packages/console-providers/src/providers/vercel/index.ts`

```typescript
  edges: [
    // Vercel deployment commit → GitHub = deploys
    { refType: "commit", matchSource: "github", relationship: "deploys" },
    // Vercel deployment PR → GitHub = deploys
    { refType: "pr", matchSource: "github", relationship: "deploys" },
  ],
```

#### 7. Barrel Export

**File**: `packages/console-providers/src/index.ts`

Add to exports:
```typescript
// ── Edge Rules ───────────────────────────────────────────────────────────────
export type {
  EdgeRule,
  KnownRelationshipType,
  LinkableRefType,
  RelationshipType,
} from "./edges";

export {
  DEFAULT_EDGE_RULES,
  KNOWN_RELATIONSHIP_TYPES,
  LINKABLE_REF_TYPES,
} from "./edges";
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] All existing tests pass: `pnpm test`
- [ ] Each provider's `edges` array is accepted by `defineProvider()` without type errors

#### Manual Verification:
- [ ] Review edge rule declarations against the research document's scenario matrix to confirm all 6 scenarios are covered
- [ ] Verify that default rules + provider rules produce correct relationship types for every scenario

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the edge rule declarations are correct before proceeding to the next phase.

---

## Phase 2: Database — `workspace_linking_keys` Table

### Overview

Create the `workspace_linking_keys` table for bidirectional, order-independent observation matching. This replaces JSONB containment queries for relationship detection.

### Changes Required:

#### 1. Drizzle Schema

**File**: `db/console/src/schema/tables/workspace-linking-keys.ts` (new)

```typescript
import { bigint, index, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Denormalized index for cross-source observation matching.
 *
 * Each row represents one linking key emitted by one observation.
 * When a new observation arrives, the graph service queries this table
 * to find existing observations with matching (workspace_id, key_type, key_value).
 *
 * This eliminates JSONB containment scans on sourceReferences and enables
 * order-independent edge resolution — whichever observation arrives second
 * finds the first via this index.
 */
export const workspaceLinkingKeys = pgTable(
  "workspace_linking_keys",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id),
    /** Reference type: "commit", "branch", "pr", "issue", etc. */
    keyType: varchar("key_type", { length: 50 }).notNull(),
    /** The actual linking value: SHA, branch name, "#123", "PROJ-456", etc. */
    keyValue: varchar("key_value", { length: 500 }).notNull(),
    observationId: bigint("observation_id", { mode: "bigint" })
      .notNull()
      .references(() => workspaceNeuralObservations.id),
    /** Provider that emitted this key (e.g., "github", "vercel") */
    source: varchar("source", { length: 50 }).notNull(),
    /** Original PostTransformReference.label (e.g., "resolved_by", "merge", "fix") */
    refLabel: varchar("ref_label", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Prevent duplicate entries for the same observation + key
    uniqueIndex("wlk_workspace_type_value_obs_uniq").on(
      table.workspaceId,
      table.keyType,
      table.keyValue,
      table.observationId,
    ),
    // Fast matching lookups: "find all observations with this key"
    index("wlk_workspace_type_value_idx").on(
      table.workspaceId,
      table.keyType,
      table.keyValue,
    ),
    // Reverse lookup: "find all linking keys for this observation"
    index("wlk_observation_id_idx").on(table.observationId),
  ],
);
```

#### 2. Schema Barrel Export

**File**: `db/console/src/schema/index.ts`

Add export:
```typescript
export { workspaceLinkingKeys } from "./tables/workspace-linking-keys";
```

#### 3. Update RelationshipType in DB Schema

**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts`

Update the `RelationshipType` to align with `console-providers` (keep as the DB-side source of truth for the column type, but the values should match):

```typescript
export type RelationshipType =
  | "deploys"
  | "fixes"
  | "references"
  | "resolves"
  | "same_branch"
  | "same_commit"
  | "tracked_in"
  | "triggers"
  | (string & {}); // extensible for future providers
```

#### 4. Generate Migration

Run from `db/console/`:
```bash
pnpm db:generate
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Inspect generated SQL to confirm indexes and constraints are correct
- [ ] Verify table exists in DB via `pnpm db:studio`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Observer Hono App

### Overview

Create `apps/observer/` following the exact blueprint of `apps/backfill/`. Migrate observation capture steps (duplicate check → store observation) from the monolith. The observer emits `apps-observer/observation.stored` when done.

### Changes Required:

#### 1. App Scaffold

Create `apps/observer/` with the standard Hono app structure:

```
apps/observer/
├── src/
│   ├── index.ts              # Vercel edge entry: export { default } from "./app.js"; export const config = { runtime: "edge" };
│   ├── app.ts                # Hono app + middleware (requestId → lifecycle → errorSanitizer → sentry)
│   ├── env.ts                # @t3-oss/env-core with Inngest + Pinecone + DB + AI env vars
│   ├── logger.ts             # createServiceLogger({ service: "observer" })
│   ├── sentry-init.ts        # initSentryService
│   ├── routes-table.ts       # Dev-time route table
│   ├── middleware/
│   │   ├── request-id.ts
│   │   ├── lifecycle.ts
│   │   ├── error-sanitizer.ts
│   │   └── sentry.ts
│   ├── routes/
│   │   └── inngest.ts        # Inngest serve handler
│   └── inngest/
│       ├── client.ts          # Inngest client with observer event schemas
│       └── workflows/
│           └── observation-capture.ts  # The observer workflow
├── package.json              # @lightfast/observer, port 4111
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── turbo.json
├── vercel.json
└── vitest.config.ts
```

**Port**: 4111 (follows relay=4108, backfill=4109, gateway=4110).

#### 2. Inngest Client & Events

**File**: `apps/observer/src/inngest/client.ts`

```typescript
import { Inngest, EventSchemas } from "@vendor/inngest";
import { z } from "zod";
import { env } from "../env.js";

const eventsMap = {
  // Input: triggered by console ingress after transformWebhookPayload
  "apps-observer/observation.capture": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string().optional(),
      connectionId: z.string(),
      orgId: z.string(),
      provider: z.string(),
      sourceEvent: z.object({
        source: z.string(),
        sourceType: z.string(),
        sourceId: z.string(),
        title: z.string(),
        body: z.string(),
        actor: z.object({
          id: z.string(),
          name: z.string().nullable(),
          email: z.string().nullable(),
          avatarUrl: z.string().nullable(),
        }).nullable(),
        occurredAt: z.string(),
        references: z.array(z.object({
          type: z.string(),
          id: z.string(),
          url: z.string().nullable(),
          label: z.string().nullable(),
        })),
        metadata: z.record(z.unknown()),
      }),
    }),
  },

  // Output: emitted after observation is stored, triggers graph service
  "apps-observer/observation.stored": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(),
      observationId: z.string(),          // externalId (nanoid)
      observationInternalId: z.string(),  // bigint stringified
      source: z.string(),                 // provider name
      sourceType: z.string(),
      sourceId: z.string(),
      references: z.array(z.object({
        type: z.string(),
        id: z.string(),
        url: z.string().nullable(),
        label: z.string().nullable(),
      })),
      actor: z.object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }).nullable(),
      significanceScore: z.number(),
      topics: z.array(z.string()),
      entitiesExtracted: z.number(),
    }),
  },

  // Fire-and-forget: LLM entity extraction (stays in observer)
  "apps-observer/llm-entity-extraction.requested": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(),
      observationId: z.string(),
    }),
  },
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});

export type Events = typeof eventsMap;
```

#### 3. Observer Workflow

**File**: `apps/observer/src/inngest/workflows/observation-capture.ts`

Migrate these steps from the monolith (in order):

| Step | Source Lines | What it does |
|------|-------------|-------------|
| `generate-replay-safe-ids` | 373-379 | nanoid + timestamp |
| `resolve-clerk-org-id` | 383-385 | ClerkOrgId from event or DB |
| `create-job` | 400-416 | Job tracking record |
| `check-duplicate` | 424-440 | Idempotency check by sourceId |
| `check-event-allowed` | 479-549 | Source config allowlist |
| `evaluate-significance` | 588-590 | Score 0-100, gate at 40 |
| `fetch-context` | 641-658 | Load workspace settings |
| `classify-observation` | 661-719 | Claude Haiku LLM + regex fallback |
| `generate-multi-view-embeddings` | 725-778 | 3 Pinecone vectors |
| `extract-entities` | 782-809 | Regex entity extraction |
| `upsert-multi-view-vectors` | 892-961 | 3 vectors to Pinecone |
| `store-observation` | 965-1056 | Insert observation + batch upsert entities |
| `emit-events` | (new) | Emit `observation.stored` + optionally `llm-entity-extraction.requested` |
| `complete-job-success` | 1168-1183 | Job completion |

**Key difference from monolith**: The observer does NOT do `resolve-actor`, `assign-cluster`, `detect-relationships`, or `reconcile-vercel-actors`. Those move to graph.

The `emit-events` step emits `apps-observer/observation.stored` with the full reference array, which the graph service consumes.

#### 4. Supporting Files to Copy/Reference

These existing files are imported by the observer workflow and stay in their current packages:

- `api/console/src/inngest/workflow/neural/scoring.ts` — significance scoring
- `api/console/src/inngest/workflow/neural/classification.ts` — LLM classification
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts` — regex extraction
- `api/console/src/inngest/workflow/neural/ai-helpers.ts` — shared AI utilities
- `api/console/src/inngest/workflow/neural/on-failure-handler.ts` — onFailure factory

These should be extracted into a shared package (`packages/console-neural/` or similar) so both observer and the existing console API can import them without circular dependencies. However, for Phase 3 the observer can import directly from `@api/console` if the build dependency is acceptable, or the files can be duplicated temporarily and deduplicated in Phase 5.

**Recommended approach**: Move shared neural utilities to `packages/console-neural/` as a new internal package. This is clean and avoids both duplication and circular deps.

#### 5. Root Configuration

**File**: `pnpm-workspace.yaml` — already includes `apps/*` glob, no change needed.

**File**: root `package.json` — add dev script:
```json
"dev:observer": "turbo watch dev -F @lightfast/observer --continue"
```

**File**: root `turbo.json` — no changes needed (apps/* pattern covers new app).

**File**: `apps/observer/turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["app"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "passThroughEnv": [
        "INNGEST_APP_NAME",
        "INNGEST_EVENT_KEY",
        "INNGEST_SIGNING_KEY",
        "LOGTAIL_SOURCE_TOKEN",
        "SENTRY_DSN"
      ]
    },
    "dev": {
      "persistent": true,
      "interruptible": true
    }
  }
}
```

#### 6. Package Configuration

**File**: `apps/observer/package.json`:
```json
{
  "name": "@lightfast/observer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsup && pnpm with-env node dist/src/env.js",
    "dev": "NODE_ENV=development pnpm with-env srvx --prod --import tsx -p 4111 src/index.ts",
    "with-env": "dotenv -e .vercel/.env.development.local --"
  },
  "dependencies": {
    "@db/console": "workspace:*",
    "@repo/console-providers": "workspace:*",
    "@repo/lib": "workspace:*",
    "@t3-oss/env-core": "catalog:",
    "@vendor/inngest": "workspace:*",
    "@vendor/observability": "workspace:*",
    "hono": "catalog:",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "dotenv-cli": "catalog:",
    "srvx": "catalog:",
    "tsup": "catalog:",
    "tsx": "catalog:",
    "vitest": "catalog:"
  }
}
```

Dependencies will be adjusted based on which shared neural utilities are needed (AI SDK, Pinecone client, etc.).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds with new package
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Observer dev server starts: `pnpm dev:observer`
- [ ] Inngest Dev Server discovers observer functions

#### Manual Verification:
- [ ] Send a test webhook through relay → console ingress → observer and verify observation is stored in DB
- [ ] Verify `observation.stored` event appears in Inngest Dev Server dashboard
- [ ] Verify Pinecone vectors are upserted correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Graph Hono App

### Overview

Create `apps/graph/` — the graph service. Implements the edge rule resolution algorithm using `workspace_linking_keys` for bidirectional matching and provider `edges` declarations for relationship type determination. Also handles cluster assignment.

### Changes Required:

#### 1. App Scaffold

Create `apps/graph/` with the standard Hono app structure:

```
apps/graph/
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── env.ts
│   ├── logger.ts
│   ├── sentry-init.ts
│   ├── routes-table.ts
│   ├── middleware/
│   │   ├── request-id.ts
│   │   ├── lifecycle.ts
│   │   ├── error-sanitizer.ts
│   │   └── sentry.ts
│   ├── routes/
│   │   └── inngest.ts
│   └── inngest/
│       ├── client.ts
│       └── workflows/
│           └── observation-process.ts
├── package.json              # @lightfast/graph, port 4112
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── turbo.json
├── vercel.json
└── vitest.config.ts
```

**Port**: 4112.

#### 2. Inngest Client & Events

**File**: `apps/graph/src/inngest/client.ts`

```typescript
const eventsMap = {
  // Input: triggered by observer after observation is stored
  "apps-graph/observation.process": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(),
      observationId: z.string(),          // externalId (nanoid)
      observationInternalId: z.string(),  // bigint stringified
      source: z.string(),
      sourceType: z.string(),
      sourceId: z.string(),
      references: z.array(z.object({
        type: z.string(),
        id: z.string(),
        url: z.string().nullable(),
        label: z.string().nullable(),
      })),
      actor: z.object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }).nullable(),
      significanceScore: z.number(),
      topics: z.array(z.string()),
      entitiesExtracted: z.number(),
    }),
  },

  // Output: profile update (fire-and-forget, consumed by console)
  "apps-graph/profile.update": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(),
      actorId: z.string(),
      observationId: z.string(),
      sourceActor: z.object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }).nullable(),
    }),
  },

  // Output: cluster summary check (fire-and-forget, consumed by console)
  "apps-graph/cluster.check-summary": {
    data: z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(),
      clusterId: z.string(),
      observationCount: z.number(),
    }),
  },
};
```

**Event routing note**: The observer emits `apps-observer/observation.stored`. The graph service listens on `apps-graph/observation.process`. These are different event names. The bridge can be handled two ways:

**Option A — Direct cross-app event**: Observer emits `apps-graph/observation.process` directly. Simple but creates a coupling (observer knows about graph's event namespace).

**Option B — Console relay**: Console API listens on `apps-observer/observation.stored` and re-emits `apps-graph/observation.process`. Decoupled but adds latency.

**Option C — Shared event**: Both apps register the same event name (e.g., `neural/observation.stored`). Inngest routes to whichever app has a function triggered by that event.

**Recommended: Option A**. The coupling is acceptable — observer exists to feed graph. If we add more consumers of `observation.stored` in the future, we can switch to a fanout pattern then. For now, the observer emits `apps-graph/observation.process` directly via its Inngest client (add the event schema to observer's event map).

#### 3. Edge Resolution Algorithm

**File**: `apps/graph/src/inngest/workflows/observation-process.ts`

The core workflow:

```
Step: extract-linking-keys
  → Filter observation references to LINKABLE_REF_TYPES
  → For each linkable reference: { keyType, keyValue, source, refLabel }

Step: find-matches
  → Query workspace_linking_keys WHERE (workspace_id, key_type, key_value)
    matches any of the extracted keys, excluding current observation
  → Returns: Array<{ keyType, keyValue, matchedObservationId, matchedSource, matchedRefLabel }>

Step: resolve-edges
  → For each match:
    1. Load new provider's edges (from PROVIDERS[source].edges)
    2. Load matched provider's edges (from PROVIDERS[matchedSource].edges)
    3. Run bidirectional rule resolution (see algorithm below)
    4. Produce: { sourceObservationId, targetObservationId, relationshipType, confidence, linkingKey, linkingKeyType }
  → Deduplicate: keep highest-confidence edge per (targetObservationId, relationshipType)

Step: insert-edges
  → Bulk insert resolved edges into workspace_observation_relationships
  → ON CONFLICT DO NOTHING (idempotent)

Step: insert-linking-keys
  → Bulk insert extracted linking keys into workspace_linking_keys
  → ON CONFLICT DO NOTHING (idempotent)
  → NOTE: Insert AFTER edge resolution so this observation's keys
    don't match against itself in concurrent processing

Step: assign-cluster
  → (Migrated from monolith: cluster-assignment.ts)
  → Pinecone cosine similarity + entity overlap → cluster assignment

Step: resolve-actor
  → (Migrated from monolith: actor-resolution.ts)
  → Cross-source actor ID resolution

Step: reconcile-vercel-actors
  → (Migrated from monolith: temporary compatibility shim)
  → Only for GitHub push events

Step: emit-downstream
  → Emit profile.update (if actor resolved)
  → Emit cluster.check-summary
```

#### 4. Bidirectional Rule Resolution Algorithm

**File**: `apps/graph/src/lib/resolve-edge-rules.ts` (new)

```typescript
import {
  DEFAULT_EDGE_RULES,
  PROVIDERS,
  type EdgeRule,
  type RelationshipType,
} from "@repo/console-providers";

interface EdgeMatch {
  keyType: string;
  keyValue: string;
  newSource: string;
  newRefLabel: string | null;
  matchedSource: string;
  matchedRefLabel: string | null;
}

interface ResolvedEdge {
  relationship: RelationshipType;
  confidence: number;
}

/**
 * Resolve the relationship type for a matched pair of observations.
 *
 * Algorithm:
 * 1. Collect candidate rules from BOTH providers + defaults
 * 2. Score each rule by specificity (refLabel match = 2, matchSource match = 1)
 * 3. Pick the rule with highest (specificity, confidence)
 *
 * This bidirectional check is what fixes the ordering problem:
 * - When GitHub push arrives after Sentry (resolved_by commit), the resolver
 *   checks Sentry's rules and finds { refType: "commit", refLabel: "resolved_by",
 *   relationship: "resolves" } — producing the correct edge regardless of order.
 */
export function resolveEdge(match: EdgeMatch): ResolvedEdge {
  const newProvider = PROVIDERS[match.newSource as keyof typeof PROVIDERS];
  const matchedProvider = PROVIDERS[match.matchedSource as keyof typeof PROVIDERS];

  const candidates: Array<{ rule: EdgeRule; specificity: number }> = [];

  // Check new provider's rules
  for (const rule of newProvider?.edges ?? []) {
    const score = scoreRule(rule, match.keyType, match.newRefLabel, match.matchedSource);
    if (score >= 0) candidates.push({ rule, specificity: score });
  }

  // Check matched provider's rules (bidirectional)
  for (const rule of matchedProvider?.edges ?? []) {
    const score = scoreRule(rule, match.keyType, match.matchedRefLabel, match.newSource);
    if (score >= 0) candidates.push({ rule, specificity: score });
  }

  // Check default rules (lowest priority)
  for (const rule of DEFAULT_EDGE_RULES) {
    const score = scoreRule(rule, match.keyType, null, "*");
    if (score >= 0) candidates.push({ rule, specificity: score });
  }

  // Sort by specificity DESC, then confidence DESC
  candidates.sort((a, b) => {
    if (a.specificity !== b.specificity) return b.specificity - a.specificity;
    return (b.rule.confidence ?? 1.0) - (a.rule.confidence ?? 1.0);
  });

  const winner = candidates[0];
  if (!winner) {
    return { relationship: "references", confidence: 0.1 };
  }

  return {
    relationship: winner.rule.relationship,
    confidence: winner.rule.confidence ?? 1.0,
  };
}

/**
 * Score a rule against a match. Returns -1 if the rule doesn't apply.
 * Higher score = more specific.
 *
 * Scoring:
 * - refLabel specified and matches: +2
 * - refLabel specified but doesn't match: -1 (rule doesn't apply)
 * - matchSource specified (not "*") and matches: +1
 * - matchSource specified but doesn't match: -1 (rule doesn't apply)
 */
function scoreRule(
  rule: EdgeRule,
  keyType: string,
  refLabel: string | null,
  counterpartSource: string,
): number {
  // Must match refType
  if (rule.refType !== keyType) return -1;

  let score = 0;

  // refLabel filter
  if (rule.refLabel != null) {
    if (rule.refLabel === refLabel) {
      score += 2; // Specific label match = highest specificity
    } else {
      return -1; // Label required but doesn't match
    }
  }

  // matchSource filter
  const ruleSource = rule.matchSource ?? "*";
  if (ruleSource !== "*") {
    if (ruleSource === counterpartSource) {
      score += 1; // Specific source match
    } else {
      return -1; // Source required but doesn't match
    }
  }

  return score;
}
```

#### 5. Root Configuration

**File**: root `package.json` — add dev script:
```json
"dev:graph": "turbo watch dev -F @lightfast/graph --continue"
```

Update `dev:app` script to include observer and graph.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Graph dev server starts: `pnpm dev:graph`
- [ ] Inngest Dev Server discovers graph functions
- [ ] Unit tests for `resolveEdge()` pass — covering all 6 scenarios from the research document's ordering matrix

#### Manual Verification:
- [ ] Send a GitHub push webhook → verify observation stored (observer) → verify edges resolved (graph)
- [ ] Send a Vercel deployment webhook with same commit SHA → verify `deploys` edge created
- [ ] Test out-of-order: send Sentry resolved_by FIRST, then GitHub push → verify `resolves` edge (not `same_commit`)
- [ ] Test out-of-order: send Linear issue with GitHub PR attachment FIRST, then GitHub PR → verify `tracked_in` edge

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation of the ordering scenarios before proceeding.

---

## Phase 5: Wiring, Migration & Cleanup

### Overview

Wire the event flow (console ingress → observer → graph), update the console API to stop using the monolith, delete dead code, and update dev tooling.

### Changes Required:

#### 1. Update Console Ingress

**File**: `api/console/src/inngest/workflow/neural/` or wherever the console dispatches `neural/observation.capture`

Change the emitted event from `apps-console/neural/observation.capture` to `apps-observer/observation.capture`. The console API's Inngest client needs the observer's event schema added, or the console can emit via a direct Inngest `send()` with the event name as a string.

**Simpler approach**: Since Inngest events are just JSON messages routed by name, the console can emit `apps-observer/observation.capture` without importing the observer's client. The observer's Inngest serve endpoint will pick it up as long as both apps are registered with the same Inngest environment.

#### 2. Wire Observer → Graph

The observer's `emit-events` step emits `apps-graph/observation.process` with the stored observation data. Add this event to the observer's event map.

#### 3. Wire Graph → Console (Downstream Events)

The graph service emits `apps-graph/profile.update` and `apps-graph/cluster.check-summary`. The console API's existing `profileUpdate` and `clusterSummaryCheck` Inngest functions need their trigger events updated to listen on these new event names (or the graph emits the old event names — simpler for migration).

**Recommended**: Graph emits the old event names (`apps-console/neural/profile.update`, `apps-console/neural/cluster.check-summary`) during migration. This avoids changing the console's Inngest functions. Can be cleaned up later.

#### 4. Delete Monolith

Remove from `api/console/src/inngest/`:
- `workflow/neural/observation-capture.ts` (1241 lines) — replaced by observer + graph
- `workflow/neural/relationship-detection.ts` — replaced by edge rule resolution in graph
- Remove `observationCapture` from the console's Inngest serve function list

Keep (still used by console or moved to shared package):
- `workflow/neural/actor-resolution.ts` — used by graph
- `workflow/neural/cluster-assignment.ts` — used by graph
- `workflow/neural/scoring.ts` — used by observer
- `workflow/neural/classification.ts` — used by observer
- `workflow/neural/entity-extraction-patterns.ts` — used by observer
- `workflow/neural/ai-helpers.ts` — shared
- `workflow/neural/on-failure-handler.ts` — shared
- `workflow/neural/profile-update.ts` — stays in console (fire-and-forget)
- `workflow/neural/cluster-summary.ts` — stays in console (fire-and-forget)
- `workflow/neural/llm-entity-extraction-workflow.ts` — stays in console or moves to observer

#### 5. Update `dev:app` Script

**File**: root `package.json`

Update `dev:app` to include observer and graph services alongside existing services.

#### 6. Remove Old Event Schemas

Remove from console's Inngest client event map:
- `"apps-console/neural/observation.capture"` — no longer consumed by console
- `"apps-console/neural/observation.captured"` — replaced by observer's `observation.stored`

Keep:
- `"apps-console/neural/profile.update"` — still consumed by console's profileUpdate function
- `"apps-console/neural/cluster.check-summary"` — still consumed by console's clusterSummaryCheck
- `"apps-console/neural/llm-entity-extraction.requested"` — still consumed by console

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] All remaining tests pass: `pnpm test`
- [ ] `pnpm dev:app` starts all services including observer and graph
- [ ] Inngest Dev Server shows observer and graph functions registered

#### Manual Verification:
- [ ] Full end-to-end: webhook → relay → console ingress → observer → graph → edges in DB
- [ ] Profile update fires correctly after graph processes an observation with an actor
- [ ] Cluster summary check fires correctly after graph assigns a cluster
- [ ] LLM entity extraction fires correctly from observer for body > 200 chars
- [ ] Existing console features (search, workspace dashboard) still work with new observation flow

---

## Testing Strategy

### Unit Tests:

**`resolveEdge()` — `apps/graph/src/lib/resolve-edge-rules.test.ts`**:
- Scenario 1: GitHub commit + Vercel commit → `deploys` (both orders)
- Scenario 2: GitHub branch + Vercel branch → `same_branch` (both orders)
- Scenario 3: Sentry `resolved_by` commit + GitHub commit → `resolves` (both orders)
- Scenario 4: Linear `tracked_in` PR + GitHub PR → `tracked_in` (both orders)
- Scenario 5: GitHub `fixes #123` issue + GitHub issue → `fixes` (both orders)
- Scenario 6: Linear `linked` issue + Sentry issue → `triggers` (both orders)
- No matching rule → falls back to DEFAULT_EDGE_RULES
- No default rule → falls back to `references` at 0.1
- Specificity ordering: refLabel match beats wildcard, matchSource match beats wildcard
- Confidence tiebreaker: higher confidence wins at same specificity

**`scoreRule()` — same file**:
- Exact refType match required
- refLabel specified and matches → +2
- refLabel specified but doesn't match → -1
- matchSource specified and matches → +1
- matchSource specified but doesn't match → -1
- matchSource "*" or omitted → 0

### Integration Tests:

- Observer workflow: mock Inngest event → verify observation stored in test DB + Pinecone vectors upserted
- Graph workflow: mock `observation.stored` event → verify linking keys inserted + edges created in test DB
- Out-of-order test: insert linking keys for observation A, then process observation B → verify bidirectional edge

### Manual Testing Steps:

1. Start full stack with `pnpm dev:app`
2. Connect a GitHub repo via the console UI
3. Push a commit to the connected repo
4. Verify in DB: observation stored, linking keys created (commit SHA + branch)
5. Trigger a Vercel deployment for the same commit
6. Verify in DB: second observation stored, `deploys` edge created between GitHub and Vercel observations
7. Check Inngest dashboard: observer and graph functions executed successfully

## Performance Considerations

- **Linking key cardinality**: With email-based linking (future), a single email could match many observations across many providers. The graph service should cap matches (e.g., `LIMIT 100`) and log when the cap is hit.
- **Workspace partitioning**: All linking key queries are scoped to `workspace_id`. The btree index on `(workspace_id, key_type, key_value)` ensures these are fast even at scale.
- **Concurrent processing**: Two observations arriving simultaneously for the same workspace could race. The `ON CONFLICT DO NOTHING` on both `workspace_linking_keys` and `workspace_observation_relationships` handles this — edges are idempotent. The `insert-linking-keys` step runs AFTER `find-matches` to prevent self-matching.
- **JSONB elimination**: The graph service queries `workspace_linking_keys` (indexed btree) instead of `sourceReferences` JSONB (no index). This is a significant performance improvement for relationship detection.

## References

- Research document: `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md`
- Provider definitions: `packages/console-providers/src/define.ts:133-181`
- Current monolith: `api/console/src/inngest/workflow/neural/observation-capture.ts:321-1241`
- Current relationship detection: `api/console/src/inngest/workflow/neural/relationship-detection.ts:48-505`
- Hono app blueprint: `apps/backfill/` (canonical reference)
- Backfill Inngest pattern: `apps/backfill/src/inngest/client.ts:50-55`
- DB relationships schema: `db/console/src/schema/tables/workspace-observation-relationships.ts:27-35`
