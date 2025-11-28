---
title: Actor Identity Mapping
description: Correlating actors across platforms without complex identity resolution
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, identity]
---

# Actor Identity Mapping

## The Problem

A single person generates events across multiple platforms:

```
Sarah Johnson:
- GitHub: "sarahjohnson" (id: github_12345678)
- Linear: "Sarah Johnson" (id: linear_abc123)
- Slack: "@sarah" (id: slack_U01234ABC)
- Clerk: "sarah@acme.com" (id: user_2abc...)
- Sentry: "sarah@acme.com" (id: sentry_def456)
```

**Without correlation:** Neural memory sees 5 different actors, can't answer "what did Sarah work on?"

**With correlation:** All observations link to a single workspace actor ID.

## Design Principles

1. **No central identity service** - Avoid building Clerk/Auth0
2. **Workspace-scoped** - Each workspace controls its own mappings
3. **Confidence-scored** - Track certainty of each mapping
4. **Fallback gracefully** - Unknown actors still work, just not correlated
5. **User control** - Workspace admins can manually map/unmap

## Architecture

### Three-Tier Correlation Strategy

```
┌─────────────────────────────────────────────────────┐
│ Tier 1: OAuth Connection (Confidence: 1.0)          │
│ User explicitly connects GitHub/Linear to Clerk     │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Tier 2: Email Matching (Confidence: 0.85)           │
│ Same email used across platforms                    │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Tier 3: Heuristic Matching (Confidence: 0.60)       │
│ Name similarity, behavioral patterns                │
└─────────────────────────────────────────────────────┘
```

## Database Schema

### workspace_actor_identities

Maps source platform identities to workspace actor IDs.

```sql
CREATE TABLE workspace_actor_identities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Workspace actor ID (our canonical identifier)
  actor_id VARCHAR(191) NOT NULL,        -- e.g., 'actor_sarah_johnson'
  actor_name VARCHAR(255) NOT NULL,      -- Display name

  -- Source platform identity
  source VARCHAR(50) NOT NULL,           -- 'github' | 'linear' | 'slack' | 'clerk' | 'sentry'
  source_id VARCHAR(255) NOT NULL,       -- Platform-specific ID
  source_username VARCHAR(255),          -- Platform username
  source_email VARCHAR(255),             -- Platform email (if available)

  -- Mapping metadata
  mapping_method VARCHAR(50) NOT NULL,   -- 'oauth' | 'email_match' | 'admin_manual' | 'heuristic'
  confidence_score FLOAT NOT NULL,       -- 0.0-1.0

  -- Audit
  mapped_by VARCHAR(191),                -- User who created mapping (if manual)
  mapped_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_workspace_source_id ON workspace_actor_identities(workspace_id, source, source_id);
CREATE INDEX idx_workspace_actor ON workspace_actor_identities(workspace_id, actor_id);
CREATE INDEX idx_source_email ON workspace_actor_identities(workspace_id, source_email);
```

### workspace_actors

Canonical actors in a workspace.

```sql
CREATE TABLE workspace_actors (
  id VARCHAR(191) PRIMARY KEY,           -- e.g., 'actor_sarah_johnson'
  workspace_id VARCHAR(191) NOT NULL,

  -- Identity
  name VARCHAR(255) NOT NULL,            -- Display name
  email VARCHAR(255),                    -- Primary email (if known)
  avatar_url TEXT,

  -- Type
  type VARCHAR(50) NOT NULL,             -- 'user' | 'bot' | 'system'

  -- Metadata
  metadata JSONB,                        -- Extra info

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_workspace_actor_id ON workspace_actors(workspace_id, id);
CREATE INDEX idx_workspace_email ON workspace_actors(workspace_id, email);
```

## Tier 1: OAuth Connection

**Highest confidence (1.0)** - User explicitly connects their account.

### Example: Connect GitHub via Clerk OAuth

```typescript
// User clicks "Connect GitHub" in workspace settings
async function connectGitHubAccount(
  userId: string,  // Clerk user ID
  workspaceId: string
): Promise<void> {
  // 1. User goes through OAuth flow (handled by Clerk)
  const githubAccount = await clerk.users.getUserOAuthAccessToken(
    userId,
    'oauth_github'
  );

  // 2. Get GitHub user info
  const githubUser = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${githubAccount.token}` }
  }).then(r => r.json());

  // 3. Get or create workspace actor for this Clerk user
  const actor = await getOrCreateActorForClerkUser(workspaceId, userId);

  // 4. Create identity mapping
  await db.insert(workspaceActorIdentities).values({
    id: generateId(),
    workspaceId,
    actorId: actor.id,
    actorName: actor.name,

    source: 'github',
    sourceId: githubUser.id.toString(),
    sourceUsername: githubUser.login,
    sourceEmail: githubUser.email,

    mappingMethod: 'oauth',
    confidenceScore: 1.0,

    mappedBy: userId,
    mappedAt: new Date(),
  });
}
```

**Result:** All GitHub events from `githubUser.id` now map to `actor.id` with 100% confidence.

## Tier 2: Email Matching

**Medium-high confidence (0.85)** - Same email used across platforms.

### Example: Match Linear user by email

```typescript
async function resolveActorByEmail(
  workspaceId: string,
  sourceEmail: string,
  source: string,
  sourceId: string
): Promise<string | null> {
  // 1. Check if we already have a mapping for this source ID
  const existing = await db.select()
    .from(workspaceActorIdentities)
    .where(
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceId),
        eq(workspaceActorIdentities.source, source),
        eq(workspaceActorIdentities.sourceId, sourceId)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].actorId;
  }

  // 2. Look for other identities with same email
  const sameEmail = await db.select()
    .from(workspaceActorIdentities)
    .where(
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceId),
        eq(workspaceActorIdentities.sourceEmail, sourceEmail)
      )
    )
    .limit(1);

  if (sameEmail[0]) {
    // Found an actor with same email - use their actor ID
    await db.insert(workspaceActorIdentities).values({
      id: generateId(),
      workspaceId,
      actorId: sameEmail[0].actorId,
      actorName: sameEmail[0].actorName,

      source,
      sourceId,
      sourceEmail,

      mappingMethod: 'email_match',
      confidenceScore: 0.85,

      mappedAt: new Date(),
    });

    return sameEmail[0].actorId;
  }

  // 3. No match found - create new actor
  const newActor = await db.insert(workspaceActors).values({
    id: generateActorId(),
    workspaceId,
    name: extractNameFromEmail(sourceEmail),
    email: sourceEmail,
    type: 'user',
  }).returning();

  await db.insert(workspaceActorIdentities).values({
    id: generateId(),
    workspaceId,
    actorId: newActor[0].id,
    actorName: newActor[0].name,

    source,
    sourceId,
    sourceEmail,

    mappingMethod: 'email_match',
    confidenceScore: 0.85,

    mappedAt: new Date(),
  });

  return newActor[0].id;
}
```

**Example:**
```
Linear event: { userId: "linear_abc123", email: "sarah@acme.com" }
Existing GitHub mapping: { sourceId: "github_12345", sourceEmail: "sarah@acme.com", actorId: "actor_sarah" }
Result: Linear event also maps to "actor_sarah" (confidence: 0.85)
```

## Tier 3: Heuristic Matching

**Lower confidence (0.60)** - Name similarity, no email available.

### Example: Match Slack user by name

```typescript
async function resolveActorByNameSimilarity(
  workspaceId: string,
  sourceName: string,
  source: string,
  sourceId: string
): Promise<string | null> {
  // 1. Check if already mapped
  const existing = await db.select()
    .from(workspaceActorIdentities)
    .where(
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceId),
        eq(workspaceActorIdentities.source, source),
        eq(workspaceActorIdentities.sourceId, sourceId)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].actorId;
  }

  // 2. Find actors with similar names
  const allActors = await db.select()
    .from(workspaceActors)
    .where(eq(workspaceActors.workspaceId, workspaceId));

  const candidates = allActors.map(actor => ({
    actor,
    similarity: calculateNameSimilarity(sourceName, actor.name)
  }))
  .filter(c => c.similarity > 0.8)  // Only high similarity
  .sort((a, b) => b.similarity - a.similarity);

  if (candidates.length === 0) {
    // No similar names - create new actor
    const newActor = await db.insert(workspaceActors).values({
      id: generateActorId(),
      workspaceId,
      name: sourceName,
      type: 'user',
    }).returning();

    await db.insert(workspaceActorIdentities).values({
      id: generateId(),
      workspaceId,
      actorId: newActor[0].id,
      actorName: newActor[0].name,

      source,
      sourceId,
      sourceUsername: sourceName,

      mappingMethod: 'new_actor',
      confidenceScore: 1.0,  // Confident it's a new actor

      mappedAt: new Date(),
    });

    return newActor[0].id;
  }

  // 3. Map to most similar actor (but flag as heuristic)
  const bestMatch = candidates[0];

  await db.insert(workspaceActorIdentities).values({
    id: generateId(),
    workspaceId,
    actorId: bestMatch.actor.id,
    actorName: bestMatch.actor.name,

    source,
    sourceId,
    sourceUsername: sourceName,

    mappingMethod: 'heuristic',
    confidenceScore: 0.60,  // Lower confidence

    mappedAt: new Date(),
  });

  return bestMatch.actor.id;
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names
  const n1 = name1.toLowerCase().replace(/[^a-z]/g, '');
  const n2 = name2.toLowerCase().replace(/[^a-z]/g, '');

  // Levenshtein distance
  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);

  return 1 - (dist / maxLen);
}
```

**Example:**
```
Slack event: { userId: "slack_U01234", name: "Sarah J" }
Existing actor: { id: "actor_sarah", name: "Sarah Johnson" }
Similarity: 0.82
Result: Slack event maps to "actor_sarah" (confidence: 0.60)
```

## Resolution Algorithm

When an observation is captured, resolve the actor:

```typescript
async function resolveActor(
  workspaceId: string,
  sourceEvent: SourceEvent
): Promise<{
  actorId: string;
  actorName: string;
  confidence: number;
}> {
  const { source, actor } = sourceEvent;

  if (!actor) {
    // System event, no actor
    return {
      actorId: 'system',
      actorName: 'System',
      confidence: 1.0
    };
  }

  // Try resolution in order of confidence

  // 1. Check if we already have a mapping
  const existing = await db.select()
    .from(workspaceActorIdentities)
    .where(
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceId),
        eq(workspaceActorIdentities.source, source),
        eq(workspaceActorIdentities.sourceId, actor.id)
      )
    )
    .limit(1);

  if (existing[0]) {
    return {
      actorId: existing[0].actorId,
      actorName: existing[0].actorName,
      confidence: existing[0].confidenceScore
    };
  }

  // 2. Try email matching (if email available)
  if (actor.metadata?.email) {
    const emailMatch = await resolveActorByEmail(
      workspaceId,
      actor.metadata.email,
      source,
      actor.id
    );

    if (emailMatch) {
      return {
        actorId: emailMatch,
        actorName: actor.name,
        confidence: 0.85
      };
    }
  }

  // 3. Try name similarity
  const nameMatch = await resolveActorByNameSimilarity(
    workspaceId,
    actor.name,
    source,
    actor.id
  );

  return {
    actorId: nameMatch,
    actorName: actor.name,
    confidence: 0.60
  };
}
```

## Admin Controls

### Manual Mapping UI

Workspace admins can manually merge/split actors:

```typescript
// Admin says: "These are the same person"
async function mergeActors(
  workspaceId: string,
  sourceActorId: string,
  targetActorId: string,
  adminUserId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Update all identities pointing to sourceActorId
    await tx.update(workspaceActorIdentities)
      .set({
        actorId: targetActorId,
        mappingMethod: 'admin_manual',
        confidenceScore: 1.0,
        mappedBy: adminUserId,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(workspaceActorIdentities.workspaceId, workspaceId),
          eq(workspaceActorIdentities.actorId, sourceActorId)
        )
      );

    // 2. Update all observations
    await tx.update(workspaceNeuralObservations)
      .set({ actorId: targetActorId })
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.actorId, sourceActorId)
        )
      );

    // 3. Delete source actor
    await tx.delete(workspaceActors)
      .where(
        and(
          eq(workspaceActors.workspaceId, workspaceId),
          eq(workspaceActors.id, sourceActorId)
        )
      );
  });
}

// Admin says: "This mapping is wrong, split it"
async function unmapIdentity(
  workspaceId: string,
  identityId: string,
  adminUserId: string
): Promise<void> {
  const identity = await db.select()
    .from(workspaceActorIdentities)
    .where(eq(workspaceActorIdentities.id, identityId))
    .limit(1);

  if (!identity[0]) return;

  // Create new actor for this identity
  const newActor = await db.insert(workspaceActors).values({
    id: generateActorId(),
    workspaceId,
    name: identity[0].sourceUsername || identity[0].actorName,
    email: identity[0].sourceEmail,
    type: 'user',
  }).returning();

  // Update identity to point to new actor
  await db.update(workspaceActorIdentities)
    .set({
      actorId: newActor[0].id,
      mappingMethod: 'admin_manual',
      mappedBy: adminUserId,
      updatedAt: new Date()
    })
    .where(eq(workspaceActorIdentities.id, identityId));
}
```

## Query Examples

### "What did Sarah work on?"

```typescript
async function getActorObservations(
  workspaceId: string,
  actorName: string
): Promise<Observation[]> {
  // 1. Find actor by name
  const actor = await db.select()
    .from(workspaceActors)
    .where(
      and(
        eq(workspaceActors.workspaceId, workspaceId),
        ilike(workspaceActors.name, `%${actorName}%`)
      )
    )
    .limit(1);

  if (!actor[0]) return [];

  // 2. Get all observations for this actor
  const observations = await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.actorId, actor[0].id)
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt));

  return observations;
}
```

### "Show me all GitHub PRs by this person"

```typescript
async function getActorSourceActivity(
  workspaceId: string,
  actorId: string,
  source: 'github' | 'linear' | 'slack'
): Promise<Observation[]> {
  // Get observations filtered by source
  const observations = await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.actorId, actorId),
        sql`source_references @> ${JSON.stringify([{ source }])}`
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt));

  return observations;
}
```

## Confidence Scores in Practice

```typescript
// When displaying observations, show confidence
interface ObservationWithConfidence extends Observation {
  actorConfidence: number;
}

async function getObservationsWithConfidence(
  workspaceId: string
): Promise<ObservationWithConfidence[]> {
  const observations = await db.select({
    obs: workspaceNeuralObservations,
    confidence: workspaceActorIdentities.confidenceScore
  })
    .from(workspaceNeuralObservations)
    .leftJoin(
      workspaceActorIdentities,
      and(
        eq(workspaceActorIdentities.workspaceId, workspaceNeuralObservations.workspaceId),
        eq(workspaceActorIdentities.actorId, workspaceNeuralObservations.actorId)
      )
    )
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  return observations.map(row => ({
    ...row.obs,
    actorConfidence: row.confidence ?? 1.0
  }));
}
```

## Best Practices

### 1. Prefer OAuth over heuristics

Encourage users to connect accounts via OAuth:

```typescript
// In workspace settings UI
const connectedAccounts = [
  { platform: 'GitHub', connected: true, confidence: 1.0 },
  { platform: 'Linear', connected: false, confidence: 0.85 },  // Email match
  { platform: 'Slack', connected: false, confidence: 0.60 },   // Name match
];

// Show "Connect" button for unconnected platforms
```

### 2. Review low-confidence mappings

Flag observations with low confidence for admin review:

```sql
-- Find observations with low actor confidence
SELECT o.*, ai.confidence_score
FROM workspace_neural_observations o
JOIN workspace_actor_identities ai
  ON o.actor_id = ai.actor_id
WHERE ai.confidence_score < 0.7
ORDER BY o.occurred_at DESC;
```

### 3. Audit mapping changes

Log all actor merges/splits:

```sql
CREATE TABLE workspace_actor_audit_log (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  action VARCHAR(50) NOT NULL,     -- 'merge' | 'split' | 'manual_map'
  actor_ids JSONB NOT NULL,        -- IDs involved
  admin_user_id VARCHAR(191),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

_Last updated: 2025-11-27_
