# Apps/Console Architecture Investigation Summary

**Date:** 2025-11-20  
**Status:** Comprehensive architectural analysis complete

---

## Executive Summary

The apps/console is a sophisticated **Workflow Orchestration Platform** that:
- Connects GitHub repositories to workspaces via GitHub App integration
- Ingests and indexes repository documentation automatically
- Tracks all user-initiated and system-initiated activities through a jobs table
- Provides real-time visibility into ingestion workflows and syncs

The system is designed to track activities at multiple levels: job execution, repository connections, document ingestion, and system health metrics.

---

## 1. Database Schema - Trackable Entities

### Core Entities

#### **Workspaces** (`lightfast_workspaces`)
- Isolated knowledge bases within an organization
- One default workspace per org (Phase 1), custom workspaces planned (Phase 2)
- Slug-based identification (e.g., "robust-chicken")
- Workspace-level settings for features and repository configuration
- **Activity tracking:** Created/updated timestamps

#### **Connected Repositories** (`lightfast_connected_repository`)
- GitHub repositories connected to organizations via GitHub App
- Immutable identifier: `githubRepoId` (never changes on rename/transfer)
- Stores installation ID for API access
- Configuration status tracking (`pending`, `configured`, `unconfigured`, `ingesting`, `error`)
- Configuration path and detection timestamp
- Document count and last ingestion/sync timestamps
- **Activity tracking:** `connectedAt`, `lastSyncedAt`, `lastIngestedAt`, `configDetectedAt`

#### **Connected Sources** (`lightfast_connected_sources`)
- Multi-source support (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
- Per-source type metadata stored in JSONB
- Source-specific document counts
- **Activity tracking:** `lastSyncedAt`, `lastIngestedAt`, `connectedAt`

#### **Jobs** (`lightfast_jobs`) - **PRIMARY ACTIVITY TABLE**
- Tracks all workflow executions (Inngest runs)
- **Status states:** `queued` → `running` → `completed/failed/cancelled`
- **Trigger types:** `manual`, `scheduled`, `webhook`, `automatic`
- Tracks which user triggered job (if manual)
- Input/output parameters for job configuration and results
- Error messages and execution duration
- Linked to workspace, repository (optional), and organization
- **Activity tracking:** Created, started, completed, cancelled with timestamps
- **Key metrics:** Job ID, Inngest run ID, duration in milliseconds

#### **Ingestion Events** (`lightfast_ingestion_events`)
- Audit trail for source integration events
- Idempotency keys per source (GitHub: deliveryId)
- Event metadata by source type
- Processing status (`processed`, `skipped`, `failed`)
- Source tracking (`webhook`, `backfill`, `manual`, `api`)
- **Activity tracking:** `processedAt` timestamp

#### **Metrics** (`lightfast_metrics`)
- Time-series performance and usage data
- Metric types: `query_latency`, `queries_count`, `documents_indexed`, `api_calls`, `errors`, `job_duration`
- Per-workspace and per-repository aggregation
- Flexible tags for filtering (endpoint, method, status, user, job type, error type)
- **Activity tracking:** Timestamp for time-series analysis

#### **Docs Documents** (`lightfast_docs_documents`)
- Document records (from any source: GitHub, Linear, Notion, etc.)
- Source-specific IDs and metadata (discriminated union)
- Parent-child relationships for nested documents
- Content and configuration hashes for change detection
- Chunk counts for vector indexing
- Cross-document relationships
- **Activity tracking:** `createdAt`, `updatedAt`

#### **Stores** (`lightfast_stores`)
- Pinecone vector search stores (namespaced per workspace)
- Embedding configuration (model, provider, dimension)
- Chunking configuration (max tokens, overlap)
- Infrastructure config (metric, cloud, region)
- **Activity tracking:** `createdAt`, `updatedAt`

#### **Integrations & Resources** (`lightfast_integrations`, `lightfast_integration_resources`, `lightfast_workspace_integrations`)
- Personal OAuth integrations per user
- Integration resources (repos, teams, projects)
- Workspace-integration connections with sync config
- Provider-specific data (GitHub installations, Notion workspace, Linear teams, etc.)
- **Activity tracking:** `connectedAt`, `lastSyncedAt`, `lastSyncStatus`, `syncError`

---

## 2. tRPC Endpoints - User-Initiated Actions

### **Workspace Router** (`workspace.ts`)
Provides visibility into workspace state and trends:

- **`listByClerkOrgId`** - List all workspaces in an organization
- **`resolveFromClerkOrgId`** - Resolve workspace ID and external naming key
- **`statistics`** - Get comprehensive workspace statistics:
  - Connected sources (count and by type)
  - Stores with document counts
  - Total documents and chunks indexed
  - Recent jobs (last 24h) with success rate and avg duration
  
- **`statisticsComparison`** - Compare stats between time periods for trend analysis
  - Current vs previous period metrics
  - Percentage changes calculated
  
- **`jobPercentiles`** - Performance percentiles (p50, p95, p99, max)
  - Configurable time range (24h, 7d, 30d)
  
- **`performanceTimeSeries`** - Hourly aggregated job metrics
  - Job count per hour
  - Average duration per hour
  - Success rate per hour
  
- **`systemHealth`** - Workspace → Stores → Sources health hierarchy
  - Overall workspace health (healthy/degraded/down)
  - Store-level and source-level health indicators

### **Repository Router** (`repository.ts`)
Direct user actions on repository connections:

- **`list`** - List connected repositories (with active/inactive filter)
- **`get`** - Get single repository details
- **`connect`** - User connects new repository (requires org GitHub App installation)
- **`detectConfig`** - User manually triggers config detection
- **`reindex`** - User manually triggers full repository reindexing
  - Enumerates all files
  - Filters by lightfast.yml include globs
  - Queues documents for processing
  - **Returns:** Number of files queued for processing, matched count, delivery ID
  
**Webhook-accessible procedures (no auth):**
- `findActiveByGithubRepoId` - Internal lookup by GitHub repo ID
- `markInactive` / `markInstallationInactive` - Disconnect repositories
- `updateMetadata` - Update cached repository metadata
- `updateConfigStatus` - Update config detection status

### **Integration Router** (`integration.ts`)
User OAuth integrations and resource management:

**GitHub Integration:**
- **`github.list`** - Get user's GitHub integration with installations
- **`github.validate`** - Refresh installations from GitHub API, returns added/removed counts
- **`github.repositories`** - Get repositories for an installation
- **`github.detectConfig`** - Check for lightfast.yml in repository
- **`github.storeOAuthResult`** - Create/update integration after OAuth

**Integration Resources:**
- **`resources.create`** - Store specific resource (GitHub repo)
- **`resources.list`** - List resources for integration

**Workspace Integrations:**
- **`workspace.getStatus`** - Get sync status for repository in workspace
- **`workspace.connect`** - Connect resource to workspace with sync config
- **`workspace.list`** - List all workspace connections

### **Jobs Router** (`jobs.ts`)
Query and manage workflow jobs:

- **`list`** - List workspace jobs with filters:
  - Status filter (`queued`, `running`, `completed`, `failed`, `cancelled`)
  - Repository filter
  - Cursor-based pagination
  
- **`get`** - Get single job details
- **`recent`** - Get recent jobs for dashboard (default 10)
- **`statistics`** - Aggregated metrics for time window:
  - Count by status
  - Average duration for completed jobs
  - Success rate calculation
  
- **`cancel`** - Cancel running/queued job

---

## 3. Inngest Workflows - Background Processes

### **Core Workflows**

#### **docsIngestion** (`docs-ingestion.ts`)
**Primary workflow - triggered by GitHub push webhooks**

Flow:
1. **Create job record** - Initialize job for tracking
2. **Load lightfast.yml** - Fetch repository configuration with include globs
3. **Ensure store exists** - Invoke separate workflow for idempotent store creation
4. **Check idempotency** - Prevent duplicate processing of same webhook delivery
5. **Filter files** - Match changed files against config globs
6. **Trigger child workflows** - For each file: process (add/modify) or delete
7. **Record event** - Log in ingestion_events table for audit trail
8. **Complete job** - Mark job as completed with document count output

**Idempotency:** Uses GitHub deliveryId to prevent duplicate processing  
**Concurrency:** Singleton key on repo (skip if already processing)  
**Status tracking:** Job progresses through running → completed/cancelled/failed

#### **repositoryInitialSync** (`repository-initial-sync.ts`)
**Triggered when repository is first connected to workspace**

Flow:
1. Create job record for tracking
2. Ensure store exists for workspace
3. Update workspace integration status to "in_progress"
4. Fetch repository metadata from GitHub
5. Trigger initial document ingestion (docs.push event)
6. Update final sync status to "completed"
7. Complete job with success/error

**Trigger:** `apps-console/repository.connected` event  
**Can be cancelled:** If repository disconnected before sync completes

#### **ensureStore** (`ensure-store.ts`)
**Idempotent store provisioning workflow**

Ensures Pinecone store exists for workspace with proper configuration.

### **GitHub Adapters**
- **githubProcessAdapter** - Transform GitHub document events to generic format
- **githubDeleteAdapter** - Transform GitHub deletion events to generic format

### **Generic Multi-Source Workflows**
- **processDocuments** - Generic document processor (all sources)
- **deleteDocuments** - Generic document deletion (all sources)
- **extractRelationships** - Generic relationship extraction (all sources)

---

## 4. Current Activity Tracking - Activity Timeline Component

### **What's Currently Tracked** (`activity-timeline.tsx`)

The activity timeline displays jobs with:
- Job name (e.g., "Docs Ingestion: owner/repo")
- Status (completed, failed, running, queued, cancelled)
- Trigger type (webhook, manual, scheduled, automatic)
- Created timestamp (relative format: "2 hours ago")
- Execution duration (milliseconds or seconds)
- Error message (if failed)
- Expandable details showing:
  - Job ID
  - Created timestamp (absolute)
  - Completed timestamp
  - Duration in ms
  - Error details

**Limit:** Displays only 10 most recent jobs

---

## 5. Key Activities Trackable in the System

### **User-Initiated Actions**
1. **Repository Connection** - User connects GitHub repository via GitHub App
   - `repository.connect` tRPC mutation
   - Triggers `repository-initial-sync` workflow
   - Creates job record
   
2. **Manual Reindexing** - User triggers full repository reindex
   - `repository.reindex` tRPC mutation
   - Filters files by lightfast.yml config
   - Queues files for processing
   - Creates job record
   
3. **Configuration Detection** - User manually checks/updates config
   - `repository.detectConfig` tRPC mutation
   - Updates config status
   - No job created (lightweight)
   
4. **GitHub Integration** - User connects personal GitHub account
   - OAuth flow + `github.storeOAuthResult` mutation
   - `github.validate` to refresh installations
   
5. **Job Cancellation** - User cancels running/queued job
   - `jobs.cancel` mutation
   
6. **Workspace Integration** - User connects resource to workspace
   - `workspace.connect` mutation
   - Triggers initial sync

### **System-Initiated Actions**
1. **Webhook Ingestion** - GitHub push webhook triggers docs ingestion
   - `apps-console/docs.push` Inngest event
   - Creates job automatically
   - Auto-discovered via webhook
   
2. **Configuration Changes** - lightfast.yml modification detected
   - Updates config status
   - May trigger re-ingestion
   
3. **Repository Disconnection** - GitHub App uninstalled or repo deleted
   - Marks repository as inactive via webhook handler
   - No explicit job tracking
   
4. **Metrics Recording** - Background metrics aggregation
   - Time-series data automatically recorded
   - No user action
   
5. **Scheduled Syncs** - (If implemented in Phase 2)
   - Scheduled ingestion workflows
   - Would create jobs with trigger = "scheduled"

### **Observable Events (Via Database)**
1. **Integration Events** (`ingestion_events`)
   - Source webhook received
   - Event processing status
   - Idempotency key tracking
   
2. **Metrics Data** (`metrics`)
   - Query latency metrics
   - Document indexing counts
   - API call counts
   - Job duration metrics
   
3. **Repository Sync Status** (`connected_repository`)
   - Last sync/ingest timestamp
   - Configuration status changes
   - Document count changes
   
4. **Source Activity** (`connected_sources`)
   - Last synced/ingested timestamps
   - Active status changes
   - Document count changes

---

## 6. Comprehensive Activity Summary

### **Activities Visible in Activity Timeline (Currently)**
- All Inngest job executions (ingestion, initial sync)
- Job status changes (queued → running → completed/failed)
- Job duration and performance metrics
- Error messages on failure
- Trigger type (webhook, manual, scheduled, automatic)
- Relative timestamps

### **Activities Visible in Statistics & Metrics (Currently)**
- Source count and types
- Store information
- Document and chunk counts
- Job statistics (total, by status, success rate, avg duration)
- Performance percentiles (p50, p95, p99, max)
- Health status (healthy, degraded, down)
- Time-series performance data

### **Activities NOT Currently Visible in UI**
- Repository connection/disconnection events
- Configuration detection results
- GitHub OAuth completion
- Manual reindex trigger
- Integration authorization
- Workspace integration connections
- Specific ingestion event details (which files processed, error details)
- Metrics data visualization
- Source-level activity history
- User action audit trail (who did what, when)

---

## 7. Entity Relationships for Activity Tracking

```
Organization (Clerk)
├── Workspace (default created per org)
│   ├── Job (Inngest workflow execution)
│   │   ├── Repository (optional FK)
│   │   ├── Status (queued/running/completed/failed/cancelled)
│   │   ├── Input/Output (parameters and results)
│   │   └── Triggered by User (if manual)
│   │
│   ├── Connected Repository
│   │   ├── GitHub integration (installation ID)
│   │   ├── Config status (detected/error/pending)
│   │   ├── Document count
│   │   └── Last sync/ingest timestamps
│   │
│   ├── Connected Source (generic multi-source)
│   │   ├── Source type (github, linear, notion, etc.)
│   │   ├── Document count
│   │   └── Last sync/ingest timestamps
│   │
│   ├── Workspace Integration (resource → workspace link)
│   │   ├── Resource ID (repo, team, project)
│   │   ├── Sync config
│   │   ├── Last sync status
│   │   └── Last sync error
│   │
│   ├── Store (Pinecone vector store)
│   │   └── Documents (indexed with embeddings)
│   │       ├── Source type and ID
│   │       ├── Content and config hash
│   │       ├── Chunk count
│   │       └── Created/updated timestamps
│   │
│   ├── Ingestion Events (audit trail)
│   │   ├── Event key (idempotency)
│   │   ├── Status (processed/skipped/failed)
│   │   └── Processed timestamp
│   │
│   └── Metrics (time-series)
│       ├── Type (query_latency, documents_indexed, etc.)
│       └── Timestamp (for aggregation)
│
├── Integration (personal OAuth)
│   ├── User ID (owner)
│   ├── Provider (github, notion, linear, sentry)
│   ├── Access token (encrypted)
│   ├── Provider data (installations, workspace info, etc.)
│   ├── Sync status
│   └── Last sync timestamp
│
├── Integration Resource
│   ├── Resource data (provider-specific)
│   └── Last synced timestamp
│
└── Organization Integration (authorization)
    ├── Integration ID (which personal connection)
    ├── Authorized by user
    └── Authorized timestamp
```

---

## 8. Recommendations for Activity Timeline Enhancement

### **Currently Missing User Actions That Should Be Trackable**
1. **Repository connection** - Need new activity type
2. **OAuth integration** - Need new activity type
3. **Workspace integration** - Need new activity type
4. **Configuration detection** - Should create lightweight event
5. **Manual reindex trigger** - Already tracked via job
6. **Job cancellation** - Need audit record
7. **Resource authorization** - Need new activity type

### **Currently Missing System Events**
1. **Webhook delivery** - Log every webhook received
2. **Configuration changes** - Track config updates
3. **Repository disconnection** - Create activity record
4. **Sync failures** - Create error activity
5. **Metrics thresholds** - Alert when health degrades

### **Data to Include in Activity Records**
1. **Who initiated?** (user ID, email)
2. **What changed?** (entity type, IDs, before/after)
3. **Why?** (trigger reason, config details)
4. **What's the status?** (success/failure/in_progress)
5. **Impact?** (documents processed, errors, duration)

### **UI/UX Improvements**
1. Filter by activity type (jobs, connections, integrations, errors)
2. Filter by source (github, linear, etc.)
3. Search by repository name or user
4. Export activity log (CSV/JSON)
5. Real-time activity feed (WebSocket)
6. Notification for job failures
7. Activity drill-down for detailed metrics
8. Comparison view (this week vs last week)

---

## 9. Activity Tracking Technology Stack

### **Currently Used**
- **Primary:** Jobs table + Inngest workflow tracking
- **Secondary:** Metrics table for time-series data
- **Tertiary:** Ingestion events for idempotency/audit

### **Could Be Leveraged**
- **Clerk:** User action audit logs (if enabled)
- **Database triggers:** Automatic activity recording on schema changes
- **Events table:** New dedicated activity log table (denormalized)
- **Redis:** Real-time activity feed caching
- **Webhooks:** External system integration (Slack, webhooks, etc.)

---

## 10. Summary of Trackable Activities

| Activity | Entity | Table | Status | Implementation |
|----------|--------|-------|--------|-----------------|
| Job execution | Job | `lightfast_jobs` | ✅ Tracked | Visible in timeline |
| Job cancellation | Job | `lightfast_jobs` | ✅ Tracked | Not visible in UI |
| Webhook delivery | Ingestion | `lightfast_ingestion_events` | ✅ Tracked | Not visible in timeline |
| Repository connection | Repository | `lightfast_connected_repository` | ✅ Tracked | Not visible in UI |
| Repository disconnection | Repository | `lightfast_connected_repository` | ✅ Tracked (soft delete) | Not visible in UI |
| Config detection | Repository | `lightfast_connected_repository` | ✅ Tracked | Not visible in UI |
| Document ingestion | Document | `lightfast_docs_documents` | ✅ Tracked | Aggregated in metrics |
| OAuth integration | Integration | `lightfast_integrations` | ✅ Tracked | Not visible in UI |
| Workspace integration | WorkspaceIntegration | `lightfast_workspace_integrations` | ✅ Tracked | Not visible in UI |
| Store creation | Store | `lightfast_stores` | ✅ Tracked | Not visible in UI |
| Metrics recording | Metric | `lightfast_metrics` | ✅ Tracked | Visible in dashboard |
| Performance metrics | Workspace | Database queries | ✅ Calculated | Visible in dashboard |
| Health status | Workspace | Database queries | ✅ Calculated | Visible in dashboard |

---

## Conclusion

The apps/console has a **robust multi-layer activity tracking system** built on:

1. **Jobs table** - All Inngest workflow executions (primary UI visibility)
2. **Metrics table** - Performance and usage time-series (aggregated statistics)
3. **Ingestion events** - Webhook audit trail and idempotency tracking
4. **Entity tables** - Timestamps on repositories, sources, integrations (secondary tracking)

**User visibility is limited to the Activity Timeline component**, which shows job executions. However, **extensive activity data already exists in the database** but isn't surfaced in the UI. The system is ready to display:

- Repository connection/disconnection history
- Integration authorization events
- Configuration change history  
- Workspace integration connections
- Webhook delivery audit trail
- Performance metrics over time
- Health status degradation
- User action audit logs (who did what, when)

A comprehensive activity timeline expansion would simply need to:
1. Query additional tables (repositories, integrations, events)
2. Transform data into timeline-compatible format
3. Add UI components for filtering and drill-down
4. Implement real-time updates via WebSocket if needed

