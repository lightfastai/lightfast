---
title: "Phase 2: Observation Pipeline"
description: Core capture workflow, significance scoring, actor resolution, classification system
status: not_started
phase: 2
parent: "./README.md"
depends_on: ["./phase-01-foundation.md"]
blocks: ["./phase-03-github-ingestion.md", "./phase-04-vercel-ingestion.md", "./phase-05-sentry-ingestion.md"]
---

# Phase 2: Observation Pipeline

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Build the core observation capture pipeline that all sources feed into. This phase creates the `neural/observation.capture` Inngest workflow with significance evaluation, actor resolution, classification, and database persistence. Source-specific transformers (GitHub, Vercel, Sentry) are implemented in subsequent phases.

## Prerequisites

- [ ] Phase 1 completed and verified
- [ ] Database tables exist and migration applied
- [ ] Event schemas registered in Inngest client

## Changes Required

### 1. Create Observation Capture Workflow

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Create

```typescript
import { eq, and, gte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { subMinutes } from "date-fns";
import { db } from "@db/console";
import {
  workspaceNeuralObservations,
  workspaceActorIdentities,
  workspaceObservationClusters,
} from "@db/console/schema";
import { inngest } from "../../client/client";
import { log } from "@repo/logger";

// Significance threshold (0-100 scale)
const SIGNIFICANCE_THRESHOLD = 60;

// Event type weights (source:type → score out of 30)
const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  // High significance (25-30)
  "github:pull_request_merged": 30,
  "github:pull_request_closed": 28,
  "vercel:deployment.succeeded": 28,
  "vercel:deployment.error": 30,
  "sentry:issue.created": 28,
  "sentry:issue.resolved": 28,

  // Medium-high (20-24)
  "github:pull_request_opened": 24,
  "github:pull_request_reviewed": 22,
  "github:issues_opened": 22,
  "github:issues_closed": 22,
  "vercel:deployment.created": 20,
  "sentry:issue.assigned": 20,

  // Medium (15-19)
  "github:issue_comment": 15,
  "vercel:deployment.canceled": 15,
  "sentry:issue.ignored": 15,
};

interface SignificanceResult {
  score: number;
  factors: Record<string, number>;
  reasoning: string;
}

interface ActorResolution {
  actorId: string;
  actorName: string;
  actorType: string;
  confidence: number;
  isNew: boolean;
}

interface Classification {
  type: string;
  topics: string[];
  confidence: number;
}

/**
 * Evaluate event significance using multi-factor scoring
 */
async function evaluateSignificance(
  sourceEvent: {
    source: string;
    sourceType: string;
    title?: string;
    body?: string;
    references?: Array<{ type: string; id: string }>;
  },
  workspaceId: string
): Promise<SignificanceResult> {
  const factors: Record<string, number> = {};

  // Factor 1: Event Type Weight (0-30 points)
  const eventKey = `${sourceEvent.source}:${sourceEvent.sourceType}`;
  factors.eventType = EVENT_TYPE_WEIGHTS[eventKey] ?? 10;

  // Factor 2: Content Substance (0-25 points)
  const contentLength =
    (sourceEvent.title?.length ?? 0) + (sourceEvent.body?.length ?? 0);
  factors.contentSubstance = Math.min(25, Math.floor(contentLength / 100));

  // Factor 3: Reference Density (0-15 points)
  const refCount = sourceEvent.references?.length ?? 0;
  factors.referenceDensity = Math.min(15, refCount * 3);

  // Factor 4: Temporal Uniqueness (0-10 points)
  // Check for similar events in last 30 minutes
  const recentSimilar = await db
    .select({ id: workspaceNeuralObservations.id })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.sourceType, sourceEvent.source),
        gte(
          workspaceNeuralObservations.capturedAt,
          subMinutes(new Date(), 30)
        )
      )
    )
    .limit(5);

  factors.temporalUniqueness = Math.max(0, 10 - recentSimilar.length * 2);

  // Factor 5: Actor Activity Bonus (0-20 points) - simplified for now
  factors.actorActivity = 10; // Will be enhanced with profile lookup later

  const score = Object.values(factors).reduce((sum, val) => sum + val, 0);

  return {
    score,
    factors,
    reasoning: `Event type: ${factors.eventType}/30, Content: ${factors.contentSubstance}/25, Refs: ${factors.referenceDensity}/15, Unique: ${factors.temporalUniqueness}/10, Actor: ${factors.actorActivity}/20`,
  };
}

/**
 * Resolve actor identity using email matching (Tier 2)
 */
async function resolveActor(
  workspaceId: string,
  sourceEvent: {
    source: string;
    actor?: {
      id: string;
      name: string;
      email?: string;
    };
  }
): Promise<ActorResolution> {
  const actor = sourceEvent.actor;

  if (!actor) {
    return {
      actorId: "system",
      actorName: "System",
      actorType: "system",
      confidence: 1.0,
      isNew: false,
    };
  }

  // Try to find existing identity by source ID
  const existingBySourceId = await db
    .select()
    .from(workspaceActorIdentities)
    .where(
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceId),
        eq(workspaceActorIdentities.source, sourceEvent.source),
        eq(workspaceActorIdentities.sourceId, actor.id)
      )
    )
    .limit(1);

  if (existingBySourceId.length > 0) {
    const identity = existingBySourceId[0]!;
    return {
      actorId: identity.actorId,
      actorName: actor.name,
      actorType: "user",
      confidence: parseFloat(identity.confidenceScore),
      isNew: false,
    };
  }

  // Try email matching (Tier 2)
  if (actor.email) {
    const existingByEmail = await db
      .select()
      .from(workspaceActorIdentities)
      .where(
        and(
          eq(workspaceActorIdentities.workspaceId, workspaceId),
          eq(workspaceActorIdentities.sourceEmail, actor.email)
        )
      )
      .limit(1);

    if (existingByEmail.length > 0) {
      const identity = existingByEmail[0]!;

      // Create new identity mapping for this source
      await db.insert(workspaceActorIdentities).values({
        id: nanoid(),
        workspaceId,
        actorId: identity.actorId,
        source: sourceEvent.source,
        sourceId: actor.id,
        sourceUsername: actor.name,
        sourceEmail: actor.email,
        mappingMethod: "email_match",
        confidenceScore: "0.85",
      });

      return {
        actorId: identity.actorId,
        actorName: actor.name,
        actorType: "user",
        confidence: 0.85,
        isNew: false,
      };
    }
  }

  // Create new actor
  const newActorId = nanoid();
  await db.insert(workspaceActorIdentities).values({
    id: nanoid(),
    workspaceId,
    actorId: newActorId,
    source: sourceEvent.source,
    sourceId: actor.id,
    sourceUsername: actor.name,
    sourceEmail: actor.email ?? null,
    mappingMethod: "new_actor",
    confidenceScore: "1.0",
  });

  return {
    actorId: newActorId,
    actorName: actor.name,
    actorType: "user",
    confidence: 1.0,
    isNew: true,
  };
}

/**
 * Classify observation type and extract topics
 */
function classifyObservation(sourceEvent: {
  source: string;
  sourceType: string;
  title?: string;
  body?: string;
}): Classification {
  // Map source types to observation types
  const typeMapping: Record<string, string> = {
    "github:pull_request_opened": "code_change",
    "github:pull_request_merged": "code_change",
    "github:pull_request_closed": "code_change",
    "github:pull_request_reviewed": "code_review",
    "github:issues_opened": "issue",
    "github:issues_closed": "issue",
    "github:issue_comment": "discussion",
    "vercel:deployment.created": "deployment",
    "vercel:deployment.succeeded": "deployment",
    "vercel:deployment.error": "incident",
    "vercel:deployment.canceled": "deployment",
    "sentry:issue.created": "incident",
    "sentry:issue.resolved": "incident",
    "sentry:issue.assigned": "incident",
  };

  const eventKey = `${sourceEvent.source}:${sourceEvent.sourceType}`;
  const observationType = typeMapping[eventKey] ?? "activity";

  // Extract topics from content (simple keyword extraction)
  const content = `${sourceEvent.title ?? ""} ${sourceEvent.body ?? ""}`.toLowerCase();
  const topics: string[] = [];

  // Topic detection patterns
  const topicPatterns: Record<string, RegExp> = {
    authentication: /\b(auth|login|logout|session|token|oauth|jwt)\b/,
    database: /\b(database|db|migration|schema|query|sql|postgres)\b/,
    api: /\b(api|endpoint|route|rest|graphql|trpc)\b/,
    ui: /\b(ui|component|button|form|modal|page|layout)\b/,
    deployment: /\b(deploy|release|build|ci|cd|pipeline)\b/,
    performance: /\b(performance|speed|latency|cache|optimize)\b/,
    security: /\b(security|vulnerability|cve|xss|injection)\b/,
    testing: /\b(test|spec|jest|vitest|coverage)\b/,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(content)) {
      topics.push(topic);
    }
  }

  return {
    type: observationType,
    topics,
    confidence: 0.8, // Rule-based confidence
  };
}

/**
 * Build observation object from processed data
 */
function buildObservation(
  sourceEvent: {
    source: string;
    sourceType: string;
    sourceId: string;
    title: string;
    body?: string;
    occurredAt: string;
    references?: Array<{ type: string; id: string; url?: string }>;
    metadata?: Record<string, unknown>;
  },
  actor: ActorResolution,
  classification: Classification,
  significance: SignificanceResult,
  workspaceId: string,
  storeId: string
) {
  return {
    id: nanoid(),
    workspaceId,
    storeId,
    occurredAt: new Date(sourceEvent.occurredAt),
    actorType: actor.actorType,
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorConfidence: actor.confidence.toString(),
    observationType: classification.type,
    title: sourceEvent.title,
    content: sourceEvent.body ?? sourceEvent.title,
    topics: classification.topics,
    significanceScore: significance.score.toString(),
    confidenceScore: classification.confidence.toString(),
    sourceType: sourceEvent.source,
    sourceId: sourceEvent.sourceId,
    sourceReferences: sourceEvent.references ?? [],
  };
}

/**
 * Main observation capture workflow
 */
export const captureObservation = inngest.createFunction(
  {
    id: "apps-console/neural-capture-observation",
    name: "Neural Observation Capture",
    description: "Capture and process engineering observations from source events",
    retries: 3,
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId",
    },
    timeouts: {
      start: "1m",
      finish: "5m",
    },
  },
  { event: "apps-console/neural/observation.capture" },
  async ({ event, step }) => {
    const { workspaceId, storeId, sourceEvent } = event.data;

    // Step 1: Significance Evaluation (BLOCKING)
    const significance = await step.run("evaluate-significance", async () => {
      return await evaluateSignificance(sourceEvent, workspaceId);
    });

    if (significance.score < SIGNIFICANCE_THRESHOLD) {
      log.info("Observation below significance threshold", {
        workspaceId,
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        score: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
      });
      return {
        skipped: true,
        reason: "below_threshold",
        score: significance.score,
      };
    }

    // Step 2: Actor Resolution (BLOCKING)
    const actor = await step.run("resolve-actor", async () => {
      return await resolveActor(workspaceId, sourceEvent);
    });

    // Step 3: Classification (BLOCKING)
    const classification = await step.run("classify", async () => {
      return classifyObservation(sourceEvent);
    });

    // Step 4: Build Observation Object
    const observation = await step.run("build-observation", async () => {
      return buildObservation(
        sourceEvent,
        actor,
        classification,
        significance,
        workspaceId,
        storeId
      );
    });

    // Step 5: Store Observation (BLOCKING)
    const stored = await step.run("store-observation", async () => {
      const [obs] = await db
        .insert(workspaceNeuralObservations)
        .values(observation)
        .returning();

      log.info("Observation stored", {
        observationId: obs!.id,
        workspaceId,
        type: classification.type,
        significance: significance.score,
      });

      return obs!;
    });

    // Step 6: Fire-and-forget profile update
    if (actor.actorId !== "system") {
      await step.sendEvent("profile-update", {
        name: "apps-console/neural/profile.update",
        data: {
          workspaceId,
          actorId: actor.actorId,
          observationId: stored.id,
        },
      });
    }

    return {
      success: true,
      observationId: stored.id,
      type: classification.type,
      topics: classification.topics,
      significance: significance.score,
      actor: {
        id: actor.actorId,
        name: actor.actorName,
        isNew: actor.isNew,
      },
    };
  }
);
```

**Why**: Core pipeline that all sources feed into. Handles significance filtering, actor resolution, and classification.

### 2. Create Profile Update Workflow (Stub)

**File**: `api/console/src/inngest/workflow/neural/update-profile.ts`
**Action**: Create

```typescript
import { inngest } from "../../client/client";
import { log } from "@repo/logger";

/**
 * Profile update workflow (fire-and-forget)
 * Stub implementation - will be expanded in Phase 8
 */
export const updateProfile = inngest.createFunction(
  {
    id: "apps-console/neural-update-profile",
    name: "Neural Profile Update",
    description: "Update actor profiles based on observations",
    retries: 3,
    // Debounce: Only process if no other update in last 5 minutes
    concurrency: {
      limit: 10,
      key: "event.data.actorId",
    },
    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId, observationId } = event.data;

    // Stub: Log for now, full implementation in Phase 8
    await step.run("log-profile-update", async () => {
      log.info("Profile update triggered (stub)", {
        workspaceId,
        actorId,
        observationId,
      });
    });

    return {
      success: true,
      stub: true,
      actorId,
      message: "Profile update stub - full implementation in Phase 8",
    };
  }
);
```

**Why**: Placeholder for profile updates, called by observation capture but fully implemented later.

### 3. Create Cluster Summary Check Workflow (Stub)

**File**: `api/console/src/inngest/workflow/neural/check-cluster-summary.ts`
**Action**: Create

```typescript
import { inngest } from "../../client/client";
import { log } from "@repo/logger";

/**
 * Cluster summary check workflow
 * Stub implementation - will be expanded in Phase 8
 */
export const checkClusterSummary = inngest.createFunction(
  {
    id: "apps-console/neural-check-cluster-summary",
    name: "Neural Cluster Summary Check",
    description: "Check observation clusters for summary generation",
    retries: 3,
    concurrency: {
      limit: 5,
      key: "event.data.workspaceId",
    },
    timeouts: {
      start: "30s",
      finish: "5m",
    },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clusterId } = event.data;

    // Stub: Log for now, full implementation in Phase 8
    await step.run("log-cluster-check", async () => {
      log.info("Cluster summary check triggered (stub)", {
        workspaceId,
        clusterId,
      });
    });

    return {
      success: true,
      stub: true,
      clusterId,
      message: "Cluster summary stub - full implementation in Phase 8",
    };
  }
);
```

**Why**: Placeholder for cluster summaries, fully implemented in Phase 8.

### 4. Create Neural Workflow Index

**File**: `api/console/src/inngest/workflow/neural/index.ts`
**Action**: Create

```typescript
export { captureObservation } from "./capture-observation";
export { updateProfile } from "./update-profile";
export { checkClusterSummary } from "./check-cluster-summary";
```

**Why**: Clean exports for neural workflows.

### 5. Register Neural Workflows

**File**: `api/console/src/inngest/index.ts`
**Action**: Modify

Add imports after existing imports (~line 33):

```typescript
// Neural memory workflows
import {
  captureObservation,
  updateProfile,
  checkClusterSummary,
} from "./workflow/neural";
```

Add to exports (~line 51):

```typescript
// Export neural memory workflows
export { captureObservation, updateProfile, checkClusterSummary };
```

Add to `createInngestRouteContext` functions array (~line 114):

```typescript
// Neural memory workflows
captureObservation,
updateProfile,
checkClusterSummary,
```

**Why**: Register workflows with Inngest server.

## Database Changes

No new migrations - uses tables created in Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Workflows registered: Check Inngest dashboard shows 3 new functions
- [ ] Event types compile: `Events["apps-console/neural/observation.capture"]`

### Manual Verification:
- [ ] Send test event via Inngest dashboard with sample data
- [ ] Verify observation appears in database via Drizzle Studio
- [ ] Verify significance filtering works (low-significance events skipped)
- [ ] Verify actor identity created for new actor
- [ ] Verify profile update event fired (check Inngest dashboard)

## Rollback Plan

1. Remove neural workflow files from `api/console/src/inngest/workflow/neural/`
2. Remove imports and exports from `api/console/src/inngest/index.ts`
3. Workflows will stop being registered with Inngest

---

**CHECKPOINT**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to source ingestion phases.

---

**Previous Phase**: [Phase 1: Foundation](./phase-01-foundation.md)
**Next Phases**:
- [Phase 3: GitHub Ingestion](./phase-03-github-ingestion.md)
- [Phase 4: Vercel Ingestion](./phase-04-vercel-ingestion.md)
- [Phase 5: Sentry Ingestion](./phase-05-sentry-ingestion.md)
