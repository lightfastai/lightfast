# Activity Tracking Architecture

**Date:** 2025-11-20
**Status:** Architectural Analysis
**Relevance:** Phase 2.5 - Entity Relationships & Context

---

## Executive Summary

The console app has a **sophisticated 4-layer activity tracking infrastructure** that captures all user actions and system events. However, only ~20% of this data is visible to users through the Activity Timeline component. This document outlines the current architecture and provides recommendations for a **unified activity feed** that surfaces all trackable activities with proper context and relationships.

---

## Current Activity Tracking Architecture

### Layer 1: Jobs Table (Primary, 20% Visible)

**Table:** `lightfast_jobs`
**Visibility:** ✅ Visible in Activity Timeline component

Tracks all Inngest workflow executions:
- Status progression: `queued` → `running` → `completed/failed/cancelled`
- Trigger types: `manual`, `scheduled`, `webhook`, `automatic`
- Execution metrics: duration, error messages, input/output
- User attribution: which user triggered (if manual)
- Resource linking: workspace, repository (optional), organization

**What's tracked:**
- ✅ Document ingestion workflows
- ✅ Repository initial sync
- ✅ Manual reindex operations
- ✅ Background processing tasks

**What's shown:**
- Job name, status badge, relative timestamp
- Trigger type with icon
- Duration (for completed jobs)
- Error messages (truncated + expandable full details)

### Layer 2: Metrics Table (Aggregation, Dashboard Only)

**Table:** `lightfast_metrics`
**Visibility:** ✅ Visible in dashboard statistics

Time-series performance data:
- Metric types: `query_latency`, `documents_indexed`, `api_calls`, `errors`, `job_duration`
- Per-workspace and per-repository granularity
- Flexible tags for filtering
- Hourly aggregation for trends

**What's tracked:**
- ✅ Query performance metrics
- ✅ Document indexing counts
- ✅ API call volumes
- ✅ Error rates
- ✅ Job duration statistics

**What's shown:**
- Aggregated statistics (total, avg, percentiles)
- Time-series charts (hourly)
- Comparison views (current vs previous period)

### Layer 3: Ingestion Events (Audit Trail, Hidden)

**Table:** `lightfast_ingestion_events`
**Visibility:** ❌ Not visible in UI

Webhook delivery audit trail:
- Idempotency keys per source (GitHub: deliveryId)
- Event metadata by source type
- Processing status: `processed`, `skipped`, `failed`
- Source tracking: `webhook`, `backfill`, `manual`, `api`

**What's tracked:**
- ✅ Webhook deliveries received
- ✅ Event processing results
- ✅ Deduplication via idempotency keys
- ✅ Processing timestamps

**What's NOT shown:**
- ❌ Which webhooks triggered which jobs
- ❌ Webhook delivery failures
- ❌ Event audit trail
- ❌ Specific file processing details

### Layer 4: Entity Timestamps (Secondary, Hidden)

**Tables:** `lightfast_connected_repository`, `lightfast_connected_sources`, `lightfast_integrations`
**Visibility:** ❌ Not visible in UI

Entity lifecycle tracking:
- Repository: `connectedAt`, `lastSyncedAt`, `lastIngestedAt`, `configDetectedAt`
- Sources: `lastSyncedAt`, `lastIngestedAt`, `connectedAt`
- Integrations: `connectedAt`, `lastSyncedAt`, `lastSyncStatus`

**What's tracked:**
- ✅ Repository connection/disconnection
- ✅ Configuration detection results
- ✅ Sync status changes
- ✅ Document count changes
- ✅ OAuth integration connections

**What's NOT shown:**
- ❌ Repository connection history
- ❌ Configuration change timeline
- ❌ Integration authorization events
- ❌ Sync failure details

---

## The Visibility Gap

### Data Exists But Hidden (80% of Activities)

| Activity Type | Data Source | Currently Visible |
|--------------|-------------|-------------------|
| Job executions | `lightfast_jobs` | ✅ Activity Timeline |
| Repository connections | `lightfast_connected_repository` | ❌ No UI |
| Repository disconnections | `lightfast_connected_repository` | ❌ No UI |
| Config detection | `lightfast_connected_repository` | ❌ No UI |
| OAuth integrations | `lightfast_integrations` | ❌ No UI |
| Workspace integrations | `lightfast_workspace_integrations` | ❌ No UI |
| Webhook deliveries | `lightfast_ingestion_events` | ❌ No UI |
| Document changes | `lightfast_docs_documents` | ❌ Aggregated only |
| Performance metrics | `lightfast_metrics` | ✅ Dashboard stats |
| Health status changes | Calculated | ✅ Dashboard health |

### User Impact

**Users cannot answer:**
- When was this repository connected?
- Why did configuration detection fail?
- Which webhook triggered this job?
- Who authorized this integration?
- What changed in the last sync?
- Why did the last sync fail?

**Users must:**
- Check multiple dashboard views
- Infer from job logs
- Contact support for audit trail
- Manually correlate events

---

## Trackable Activity Types

### 1. User-Initiated Actions

| Action | tRPC Endpoint | Creates Job | Activity Record |
|--------|---------------|-------------|-----------------|
| Connect repository | `repository.connect` | ✅ Yes | ❌ No timeline entry |
| Manual reindex | `repository.reindex` | ✅ Yes | ✅ Via job |
| Detect config | `repository.detectConfig` | ❌ No | ❌ No timeline entry |
| OAuth integration | `github.storeOAuthResult` | ❌ No | ❌ No timeline entry |
| Cancel job | `jobs.cancel` | ❌ No | ❌ No timeline entry |
| Connect workspace integration | `workspace.connect` | ✅ Yes | ✅ Via job |

### 2. System-Initiated Actions

| Action | Trigger | Creates Job | Activity Record |
|--------|---------|-------------|-----------------|
| Webhook ingestion | GitHub push | ✅ Yes | ✅ Via job |
| Config change detection | File monitor | ❌ No | ❌ No timeline entry |
| Repository disconnection | App uninstall | ❌ No | ❌ No timeline entry |
| Metrics recording | Background | ❌ No | ✅ Via metrics table |
| Health calculation | On-demand | ❌ No | ❌ No timeline entry |

### 3. Observable Events (Via Database)

| Event | Table | Tracked | Visible |
|-------|-------|---------|---------|
| Sync status change | `connected_repository` | ✅ Yes | ❌ No |
| Document count change | `connected_repository` | ✅ Yes | ❌ No |
| Integration sync failure | `integrations` | ✅ Yes | ❌ No |
| Webhook delivery | `ingestion_events` | ✅ Yes | ❌ No |
| Config status change | `connected_repository` | ✅ Yes | ❌ No |

---

## Recommendation: Unified Activity Feed

### Design Principles

1. **Heterogeneous timeline** - Mix different activity types chronologically
2. **Progressive disclosure** - Summary → expandable details
3. **Context preservation** - Show who/what/why/when for each activity
4. **Relationship awareness** - Link related activities (webhook → job → documents)
5. **Filter-first** - Enable filtering by type, source, status, user

### Activity Type Taxonomy

```typescript
type Activity =
  | JobActivity              // Current: workflow executions
  | RepositoryActivity       // NEW: connected, synced, disconnected, config
  | IntegrationActivity      // NEW: oauth, workspace integrations
  | WebhookActivity          // NEW: delivery audit trail
  | ConfigActivity           // NEW: detection, validation results
  | HealthActivity           // NEW: status changes, degradation
  | DocumentActivity         // NEW: bulk changes, ingestion summaries
  | MetricActivity           // NEW: threshold breaches, anomalies
```

### Unified Activity Schema

```typescript
interface UnifiedActivity {
  // Core identity
  id: string;
  type: ActivityType;
  timestamp: Date;

  // Actor & context
  actor?: {
    type: "user" | "system" | "webhook";
    userId?: string;
    email?: string;
    source?: "github" | "linear" | "notion";
  };

  // Target entity
  entity: {
    type: "repository" | "integration" | "job" | "workspace" | "document";
    id: string;
    name: string;
    metadata: Record<string, unknown>;
  };

  // Activity details
  action: string;  // "connected", "triggered", "completed", "failed", "detected"
  status: "success" | "failure" | "in_progress" | "cancelled";

  // Impact & results
  impact?: {
    documentsProcessed?: number;
    errors?: number;
    duration?: number;
    changes?: Record<string, { before: unknown; after: unknown }>;
  };

  // Relationships
  relatedActivities?: string[];  // IDs of related activities
  triggeredBy?: string;          // ID of parent activity

  // Evidence & context
  evidence?: {
    errorMessage?: string;
    configPath?: string;
    webhookDeliveryId?: string;
    inngestRunId?: string;
  };
}
```

### Implementation Approach

#### Option A: Denormalized Activity Table (Recommended)

**Pros:**
- Fast queries for timeline view
- Simple filtering and pagination
- Easy to add new activity types
- No complex joins

**Cons:**
- Data duplication
- Requires sync with source tables
- More storage

**Implementation:**
```sql
CREATE TABLE lightfast_activities (
  id VARCHAR(255) PRIMARY KEY,
  workspace_id VARCHAR(255) NOT NULL,
  type ENUM('job', 'repository', 'integration', 'webhook', 'config', 'health', 'document', 'metric'),
  action VARCHAR(100) NOT NULL,
  status ENUM('success', 'failure', 'in_progress', 'cancelled'),
  timestamp DATETIME NOT NULL,

  -- Actor
  actor_type ENUM('user', 'system', 'webhook'),
  actor_user_id VARCHAR(255),
  actor_email VARCHAR(255),
  actor_source ENUM('github', 'linear', 'notion', 'sentry', 'vercel', 'zendesk'),

  -- Entity
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(500),
  entity_metadata JSON,

  -- Impact
  impact JSON,

  -- Relationships
  related_activities JSON,  -- array of activity IDs
  triggered_by VARCHAR(255),

  -- Evidence
  evidence JSON,

  INDEX idx_workspace_timestamp (workspace_id, timestamp DESC),
  INDEX idx_workspace_type (workspace_id, type),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_triggered_by (triggered_by)
);
```

**Population strategies:**
1. **Triggers:** DB triggers on source tables
2. **Application-level:** Create activity records in tRPC mutations
3. **Background sync:** Backfill from existing data
4. **Real-time:** Inngest workflow step creates activity

#### Option B: Federated Views (Not Recommended)

Query multiple tables at runtime and merge results.

**Pros:**
- No data duplication
- Always up-to-date

**Cons:**
- Complex queries with many joins
- Poor performance for timeline view
- Hard to maintain consistency

---

## Migration Strategy

### Phase 1: Schema & Backfill (Week 1-2)

1. **Create `lightfast_activities` table**
2. **Backfill from existing data:**
   - Jobs → JobActivity
   - Repository timestamps → RepositoryActivity
   - Integrations → IntegrationActivity
   - Ingestion events → WebhookActivity
3. **Add application-level activity creation:**
   - tRPC mutations create activities
   - Inngest workflows create activities

### Phase 2: UI Components (Week 3-4)

4. **Expand Activity Timeline component:**
   - Support multiple activity types
   - Add filtering UI
   - Add search functionality
5. **Add activity detail views:**
   - Click activity → full context drawer
   - Show related activities
   - Display evidence

### Phase 3: Real-time & Advanced (Week 5-6)

6. **Real-time updates:**
   - WebSocket for live activity feed
   - Notifications for critical events
7. **Advanced features:**
   - Export activity log (CSV/JSON)
   - Activity comparison views
   - Trend analysis

---

## Activity Relationships (Phase 2.5 Relevance)

### Why Activity Tracking Matters for Relationship Extraction

Activities are **first-class entities** that participate in relationships:

```
User "alice@company.com"
  ├─ CONNECTED → Repository "lightfast/core"
  ├─ TRIGGERED → Job "Initial Sync #123"
  └─ AUTHORIZED → Integration "GitHub OAuth"

Repository "lightfast/core"
  ├─ CONNECTED_BY → User "alice@company.com"
  ├─ TRIGGERED → Job "Docs Ingestion #456"
  ├─ RECEIVED → Webhook "delivery-abc123"
  └─ DETECTED → Config "lightfast.yml"

Job "Docs Ingestion #456"
  ├─ TRIGGERED_BY → Webhook "delivery-abc123"
  ├─ PROCESSED → Document "README.md"
  ├─ PROCESSED → Document "CONTRIBUTING.md"
  └─ CREATED_BY → User "alice@company.com"

Webhook "delivery-abc123"
  ├─ TRIGGERED → Job "Docs Ingestion #456"
  ├─ DELIVERED_TO → Repository "lightfast/core"
  └─ PROCESSED → IngestEvent "event-xyz789"
```

### Relationship Types

**User ↔ Activity:**
- `INITIATED` - User started action
- `AUTHORIZED` - User granted permission
- `CANCELLED` - User stopped action

**Repository ↔ Activity:**
- `CONNECTED` - Repository added
- `SYNCED` - Repository updated
- `DISCONNECTED` - Repository removed
- `DETECTED_CONFIG` - Configuration found

**Job ↔ Activity:**
- `TRIGGERED_BY` - What started the job
- `PROCESSED` - What the job operated on
- `COMPLETED` - Job finished successfully
- `FAILED` - Job encountered error

**Webhook ↔ Activity:**
- `DELIVERED` - Webhook received
- `TRIGGERED` - Webhook started job
- `PROCESSED` - Webhook handled

### Entity Resolution

Activity records enable cross-source entity resolution:

**Example: GitHub User → Clerk User**
```
GitHub Webhook (author: "alice")
  → Job "Docs Ingestion" (triggered by system)
  → Repository (connected by user_id: "user_abc123")
  → Clerk User (email: "alice@company.com")
```

**Resolution logic:**
1. GitHub author username from webhook metadata
2. Repository connection record → Clerk user ID
3. Map GitHub username → Clerk user email
4. Create `AUTHORED_BY` relationship

---

## Query Patterns

### Timeline View (Most Recent)

```sql
SELECT * FROM lightfast_activities
WHERE workspace_id = ?
ORDER BY timestamp DESC
LIMIT 20;
```

### Filter by Type

```sql
SELECT * FROM lightfast_activities
WHERE workspace_id = ?
  AND type IN ('repository', 'integration')
ORDER BY timestamp DESC;
```

### Find Related Activities

```sql
-- Get all activities triggered by a webhook
SELECT a2.*
FROM lightfast_activities a1
JOIN lightfast_activities a2 ON JSON_CONTAINS(a2.related_activities, JSON_QUOTE(a1.id))
WHERE a1.type = 'webhook' AND a1.id = ?;
```

### User Audit Trail

```sql
SELECT * FROM lightfast_activities
WHERE workspace_id = ?
  AND actor_user_id = ?
ORDER BY timestamp DESC;
```

### Repository Activity History

```sql
SELECT * FROM lightfast_activities
WHERE workspace_id = ?
  AND entity_type = 'repository'
  AND entity_id = ?
ORDER BY timestamp DESC;
```

---

## Performance Considerations

### Indexing Strategy

**Primary indexes:**
- `(workspace_id, timestamp DESC)` - Timeline queries
- `(workspace_id, type)` - Filtered timelines
- `(entity_type, entity_id)` - Entity history
- `(actor_user_id, timestamp DESC)` - User audit trail

**Secondary indexes:**
- `(triggered_by)` - Relationship traversal
- `(status, timestamp)` - Failed activities

### Pagination

Use cursor-based pagination for infinite scroll:

```typescript
interface ActivityPageRequest {
  workspaceId: string;
  limit: number;
  cursor?: string;  // timestamp of last item
  filters?: {
    type?: ActivityType[];
    status?: ActivityStatus[];
    entityType?: string[];
  };
}
```

### Caching

**Redis cache strategy:**
- Cache last 50 activities per workspace (5 min TTL)
- Invalidate on new activity creation
- Key: `activities:workspace:{workspaceId}:recent`

---

## Monitoring & Observability

### Metrics to Track

**Activity volume:**
- Activities created per hour (by type)
- Activities per workspace
- Activities per user

**Activity relationships:**
- % of activities with related activities
- Average relationship count per activity
- Orphaned activities (no relationships)

**Performance:**
- Activity creation latency
- Timeline query P95 latency
- Backfill processing rate

### Alerts

**Critical:**
- Failed activities exceeding threshold (>5% in 1h)
- Activity creation pipeline down

**Warning:**
- Timeline query P95 > 500ms
- Backfill lag > 1 hour

---

## Success Criteria

### Visibility Goals

- ✅ **100% of user actions** visible in timeline
- ✅ **100% of system events** visible in timeline
- ✅ **100% of relationships** queryable

### Performance Goals

- **Timeline load:** P95 < 300ms
- **Activity creation:** P95 < 50ms
- **Backfill rate:** 10,000 activities/min

### User Experience Goals

- Users can answer "when did X happen?" in < 5 seconds
- Users can trace relationships in < 3 clicks
- Users can export activity log in < 10 seconds

---

## Open Questions

1. **Retention policy:** How long to keep activities? (90 days? 1 year? Forever?)
2. **Privacy:** Should we redact sensitive data in activity evidence?
3. **Real-time:** WebSocket vs polling for live updates?
4. **Export:** What formats? (CSV, JSON, Parquet?)
5. **Notifications:** Email/Slack for critical activities?

---

## Next Steps

1. **Design review** - Validate unified activity schema
2. **Prototype** - Build POC with denormalized table
3. **Backfill** - Migrate existing data to activities table
4. **UI implementation** - Expand activity timeline component
5. **Monitoring** - Add metrics and alerts
6. **Documentation** - User-facing activity guide

---

## Related Documents

- `relationship-pipeline-audit.md` - Relationship extraction pipeline
- `cross-source-relationships.md` - Cross-source entity resolution
- `semantic-relationship-extraction.md` - LLM-based relationship discovery
- `CONSOLE_ARCHITECTURE_INVESTIGATION.md` - Full console architecture analysis
