---
title: Temporal State Tracking
description: How entities evolve over time with bi-temporal tracking
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, temporal]
---

# Temporal State Tracking

## The Problem

Users ask time-based questions about their workspace:

```
"What happened yesterday?"
"What was the status of the auth feature last week?"
"Who was working on the API during Q3?"
"Show me deployments from the last sprint"
```

Neural memory needs to answer these with **historical accuracy**, not just current state.

## Design Principles

1. **Bi-temporal tracking** - Track both when events occurred AND when we learned about them
2. **State validity windows** - Every state has `valid_from` and `valid_to` timestamps
3. **Point-in-time queries** - "What did we know on Nov 15th?"
4. **Immutable history** - Never delete old states, only mark as invalid
5. **Current state flag** - Fast queries for "what's the status NOW?"

## Types of Temporal Data

### 1. Observations (Event Time)

Observations have a single timestamp: **when the event occurred**.

```typescript
interface Observation {
  occurredAt: Date;  // When the event actually happened
  capturedAt: Date;  // When we captured it (usually same or later)
}
```

**Example:**
```typescript
// PR merged at 10:00 AM
{
  id: 'obs_123',
  type: 'change',
  title: 'Merged PR #456',
  occurredAt: '2025-11-27T10:00:00Z',
  capturedAt: '2025-11-27T10:00:05Z'  // 5 seconds later
}
```

**Queries:**
```sql
-- What happened yesterday?
SELECT * FROM workspace_neural_observations
WHERE workspace_id = 'ws_abc'
  AND occurred_at >= NOW() - INTERVAL '1 day'
  AND occurred_at < NOW();

-- What happened between Nov 20-25?
SELECT * FROM workspace_neural_observations
WHERE workspace_id = 'ws_abc'
  AND occurred_at >= '2025-11-20'
  AND occurred_at < '2025-11-26';
```

### 2. Temporal States (Bi-temporal)

States track **when something was true** and **when we recorded it**.

```typescript
interface TemporalState {
  // What is being tracked
  entityType: string;     // 'project' | 'feature' | 'service'
  entityId: string;

  // What changed
  stateType: string;      // 'status' | 'progress' | 'health' | 'risk'
  stateValue: string;     // 'in_progress' | '60%' | 'healthy'

  // Validity window (when this was TRUE in reality)
  validFrom: Date;
  validTo: Date | null;   // null = still current

  // Recording time (when we learned about it)
  createdAt: Date;

  // Current state flag
  isCurrent: boolean;
}
```

**Example: Project Progress**
```typescript
// Auth feature progress over time
[
  {
    entityType: 'project',
    entityId: 'auth_feature',
    stateType: 'progress',
    stateValue: '25%',
    validFrom: '2025-11-01T00:00:00Z',
    validTo: '2025-11-10T00:00:00Z',
    createdAt: '2025-11-01T09:00:00Z',
    isCurrent: false
  },
  {
    entityType: 'project',
    entityId: 'auth_feature',
    stateType: 'progress',
    stateValue: '60%',
    validFrom: '2025-11-10T00:00:00Z',
    validTo: '2025-11-20T00:00:00Z',
    createdAt: '2025-11-10T14:30:00Z',
    isCurrent: false
  },
  {
    entityType: 'project',
    entityId: 'auth_feature',
    stateType: 'progress',
    stateValue: '100%',
    validFrom: '2025-11-20T00:00:00Z',
    validTo: null,  // Still current
    createdAt: '2025-11-20T16:00:00Z',
    isCurrent: true
  }
]
```

## State Transitions

### Creating Initial State

```typescript
async function createState(
  workspaceId: string,
  entityType: string,
  entityId: string,
  stateType: string,
  stateValue: string,
  validFrom: Date = new Date()
): Promise<TemporalState> {
  return await db.insert(workspaceTemporalStates).values({
    id: generateId(),
    workspaceId,
    entityType,
    entityId,
    stateType,
    stateValue,
    validFrom,
    validTo: null,        // Open-ended
    isCurrent: true,      // Mark as current
    createdAt: new Date()
  }).returning();
}

// Example: Mark project as started
await createState(
  'ws_abc',
  'project',
  'auth_feature',
  'status',
  'in_progress',
  new Date('2025-11-01')
);
```

### Transitioning State

```typescript
async function transitionState(
  workspaceId: string,
  entityId: string,
  stateType: string,
  newValue: string,
  transitionTime: Date = new Date(),
  reason?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Close current state
    const currentState = await tx.select()
      .from(workspaceTemporalStates)
      .where(
        and(
          eq(workspaceTemporalStates.workspaceId, workspaceId),
          eq(workspaceTemporalStates.entityId, entityId),
          eq(workspaceTemporalStates.stateType, stateType),
          eq(workspaceTemporalStates.isCurrent, true)
        )
      )
      .limit(1);

    if (currentState[0]) {
      await tx.update(workspaceTemporalStates)
        .set({
          validTo: transitionTime,
          isCurrent: false,
          updatedAt: new Date()
        })
        .where(eq(workspaceTemporalStates.id, currentState[0].id));
    }

    // 2. Create new state
    await tx.insert(workspaceTemporalStates).values({
      id: generateId(),
      workspaceId,
      entityType: currentState[0]?.entityType ?? 'unknown',
      entityId,
      stateType,
      stateValue: newValue,
      validFrom: transitionTime,
      validTo: null,
      isCurrent: true,
      changeReason: reason,
      createdAt: new Date()
    });
  });
}

// Example: Mark project as complete
await transitionState(
  'ws_abc',
  'auth_feature',
  'status',
  'complete',
  new Date('2025-11-20'),
  'All PRs merged and deployed'
);
```

## Temporal Queries

### 1. Current State

**"What's the current status of auth feature?"**

```typescript
async function getCurrentState(
  workspaceId: string,
  entityId: string,
  stateType: string
): Promise<TemporalState | null> {
  const state = await db.select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        eq(workspaceTemporalStates.isCurrent, true)
      )
    )
    .limit(1);

  return state[0] ?? null;
}

// Usage
const status = await getCurrentState('ws_abc', 'auth_feature', 'status');
console.log(status.stateValue);  // "complete"
```

### 2. Point-in-Time Query

**"What was the status on Nov 15th?"**

```typescript
async function getStateAt(
  workspaceId: string,
  entityId: string,
  stateType: string,
  pointInTime: Date
): Promise<TemporalState | null> {
  const state = await db.select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        lte(workspaceTemporalStates.validFrom, pointInTime),
        or(
          isNull(workspaceTemporalStates.validTo),
          gt(workspaceTemporalStates.validTo, pointInTime)
        )
      )
    )
    .limit(1);

  return state[0] ?? null;
}

// Usage
const statusOnNov15 = await getStateAt(
  'ws_abc',
  'auth_feature',
  'status',
  new Date('2025-11-15')
);
console.log(statusOnNov15.stateValue);  // "in_progress"
```

### 3. State History

**"Show me the complete history of auth feature status"**

```typescript
async function getStateHistory(
  workspaceId: string,
  entityId: string,
  stateType: string
): Promise<TemporalState[]> {
  return await db.select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType)
      )
    )
    .orderBy(desc(workspaceTemporalStates.validFrom));
}

// Usage
const history = await getStateHistory('ws_abc', 'auth_feature', 'status');
history.forEach(state => {
  console.log(
    `${state.validFrom.toISOString()}: ${state.stateValue}`
  );
});
// Output:
// 2025-11-20T00:00:00Z: complete
// 2025-11-10T00:00:00Z: in_progress
// 2025-11-01T00:00:00Z: planned
```

### 4. Changes in Time Range

**"What changed during the last sprint?"**

```typescript
async function getStateChanges(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<TemporalState[]> {
  return await db.select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        gte(workspaceTemporalStates.validFrom, startDate),
        lte(workspaceTemporalStates.validFrom, endDate)
      )
    )
    .orderBy(desc(workspaceTemporalStates.validFrom));
}

// Usage: Last 2 weeks
const changes = await getStateChanges(
  'ws_abc',
  subWeeks(new Date(), 2),
  new Date()
);
```

## Automatic State Extraction

States can be automatically extracted from observations:

```typescript
// Observation: PR merged
{
  type: 'change',
  title: 'Merged PR #456: Complete auth implementation',
  metadata: { labels: ['feature-complete'] }
}

// Auto-create state transition
await transitionState(
  workspaceId,
  'auth_feature',
  'status',
  'complete',
  observation.occurredAt,
  `Automatically detected from observation ${observation.id}`
);
```

### Example: Extract from Linear Issue

```typescript
async function handleLinearIssueUpdate(event: SourceEvent) {
  const issue = event.metadata;

  // If issue state changed, create temporal state
  if (issue.state) {
    await transitionState(
      event.workspaceId,
      issue.id,
      'status',
      issue.state,  // 'todo' | 'in_progress' | 'done'
      event.occurredAt,
      `Linear issue state changed`
    );
  }

  // If issue progress changed
  if (issue.estimate) {
    await transitionState(
      event.workspaceId,
      issue.id,
      'progress',
      `${issue.completedSubtasks}/${issue.totalSubtasks}`,
      event.occurredAt
    );
  }
}
```

## Time-Range Queries for Observations

### "What happened yesterday?"

```typescript
async function getObservationsYesterday(
  workspaceId: string
): Promise<Observation[]> {
  const yesterday = subDays(startOfDay(new Date()), 1);
  const today = startOfDay(new Date());

  return await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        gte(workspaceNeuralObservations.occurredAt, yesterday),
        lt(workspaceNeuralObservations.occurredAt, today)
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt));
}
```

### "What happened this week?"

```typescript
async function getObservationsThisWeek(
  workspaceId: string
): Promise<Observation[]> {
  const weekStart = startOfWeek(new Date());

  return await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        gte(workspaceNeuralObservations.occurredAt, weekStart)
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt));
}
```

### "Show me all incidents in November"

```typescript
async function getIncidentsInMonth(
  workspaceId: string,
  month: Date
): Promise<Observation[]> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  return await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.type, 'incident'),
        gte(workspaceNeuralObservations.occurredAt, monthStart),
        lte(workspaceNeuralObservations.occurredAt, monthEnd)
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt));
}
```

## Temporal Search Integration

When users search with temporal queries, boost results by recency:

```typescript
async function temporalSearch(
  workspaceId: string,
  query: string
): Promise<SearchResult[]> {
  // 1. Extract time window from query
  const timeWindow = extractTimeWindow(query);

  // 2. Search observations in time window
  const observations = await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        gte(workspaceNeuralObservations.occurredAt, timeWindow.start),
        lte(workspaceNeuralObservations.occurredAt, timeWindow.end)
      )
    );

  // 3. Semantic search within time-filtered results
  const results = await semanticSearch(query, observations);

  // 4. Apply recency boost
  return results.map(r => ({
    ...r,
    score: r.score * calculateRecencyBoost(r.timestamp, new Date())
  }));
}

function extractTimeWindow(query: string): { start: Date; end: Date } {
  const now = new Date();

  if (/yesterday/i.test(query)) {
    return {
      start: subDays(startOfDay(now), 1),
      end: startOfDay(now)
    };
  }

  if (/this week/i.test(query)) {
    return {
      start: startOfWeek(now),
      end: now
    };
  }

  if (/last sprint/i.test(query)) {
    return {
      start: subWeeks(now, 2),
      end: now
    };
  }

  // Default: last 30 days
  return {
    start: subDays(now, 30),
    end: now
  };
}

function calculateRecencyBoost(timestamp: Date, now: Date): number {
  const ageHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

  // Exponential decay: 1.0 at 0 hours, 0.5 at 7 days, 0.1 at 30 days
  return Math.exp(-ageHours / (7 * 24));
}
```

## State Types & Entities

### Common State Types

| State Type | Values | Use Case |
|------------|--------|----------|
| `status` | todo, in_progress, in_review, done, blocked | Track work status |
| `progress` | 0%, 25%, 50%, 75%, 100% | Track completion |
| `health` | healthy, degraded, down | Track service health |
| `risk` | low, medium, high, critical | Track project risk |
| `priority` | p0, p1, p2, p3 | Track priority changes |

### Common Entity Types

| Entity Type | Examples | Tracked States |
|-------------|----------|----------------|
| `project` | auth_feature, api_v2 | status, progress, risk |
| `service` | api_server, db_primary | health, version |
| `feature` | oauth_login, file_upload | status, progress |
| `sprint` | sprint_47, q4_2025 | status, velocity |

## Example Workflows

### Workflow 1: Track Feature Development

```typescript
// Week 1: Feature started
await createState('ws_abc', 'project', 'oauth_feature', 'status', 'in_progress');
await createState('ws_abc', 'project', 'oauth_feature', 'progress', '10%');

// Week 2: Progress update
await transitionState('ws_abc', 'oauth_feature', 'progress', '50%');

// Week 3: In review
await transitionState('ws_abc', 'oauth_feature', 'status', 'in_review');
await transitionState('ws_abc', 'oauth_feature', 'progress', '90%');

// Week 4: Complete
await transitionState('ws_abc', 'oauth_feature', 'status', 'complete');
await transitionState('ws_abc', 'oauth_feature', 'progress', '100%');

// Query: What was progress on Nov 15?
const nov15Progress = await getStateAt(
  'ws_abc',
  'oauth_feature',
  'progress',
  new Date('2025-11-15')
);
console.log(nov15Progress.stateValue);  // "50%"
```

### Workflow 2: Track Service Health

```typescript
// Service starts healthy
await createState('ws_abc', 'service', 'api_server', 'health', 'healthy');

// Incident detected
await transitionState(
  'ws_abc',
  'api_server',
  'health',
  'degraded',
  new Date(),
  'High error rate detected'
);

// Incident resolved
await transitionState(
  'ws_abc',
  'api_server',
  'health',
  'healthy',
  new Date(),
  'Fix deployed'
);

// Query: Service downtime this month
const healthHistory = await getStateHistory('ws_abc', 'api_server', 'health');
const downtimeEvents = healthHistory.filter(s => s.stateValue === 'degraded');
console.log(`Service was degraded ${downtimeEvents.length} times this month`);
```

## Performance Optimizations

### 1. Index on Current States

```sql
CREATE INDEX idx_state_current
ON workspace_temporal_states(workspace_id, is_current)
WHERE is_current = TRUE;
```

Fast queries for "what's the current status?"

### 2. Partition by Time

For large workspaces, partition states by month:

```sql
CREATE TABLE workspace_temporal_states_2025_11
PARTITION OF workspace_temporal_states
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

### 3. Materialized Views for Common Queries

```sql
CREATE MATERIALIZED VIEW current_project_states AS
SELECT
  workspace_id,
  entity_id,
  state_type,
  state_value,
  valid_from
FROM workspace_temporal_states
WHERE is_current = TRUE
  AND entity_type = 'project';

-- Refresh periodically
REFRESH MATERIALIZED VIEW current_project_states;
```

---

_Last updated: 2025-11-27_
