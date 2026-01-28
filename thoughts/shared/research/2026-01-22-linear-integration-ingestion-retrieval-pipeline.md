---
date: 2026-01-22T14:30:00+11:00
researcher: Claude
git_commit: 68cddbf9
branch: main
repository: lightfastai/lightfast
topic: "Linear Integration into Lightfast Console for Ingestion/Retrieval Pipeline"
tags: [research, codebase, linear, integration, ingestion, retrieval, pipeline, webhook, oauth]
status: complete
last_updated: 2026-01-22
last_updated_by: Claude
---

# Research: Linear Integration into Lightfast Console for Ingestion/Retrieval Pipeline

**Date**: 2026-01-22T14:30:00+11:00
**Researcher**: Claude
**Git Commit**: 68cddbf9
**Branch**: main
**Repository**: lightfastai/lightfast

## Research Question

How can Linear be integrated into the Lightfast console for the ingestion/retrieval pipeline?

## Summary

Linear integration is **planned but not yet implemented**. The codebase has existing research documentation, UI placeholders showing "Coming soon", and a stub webhook handler in a worktree. To implement Linear, the established patterns from GitHub and Vercel integrations should be followed. The integration would involve:

1. **OAuth flow** for user authorization (following the Vercel pattern)
2. **Webhook handlers** for real-time event ingestion (following the GitHub pattern)
3. **Dual pipeline processing** - documents for retrieval AND neural observations for event tracking
4. **Pinecone vector storage** with workspace namespace isolation

The existing infrastructure supports multi-source connectors, so Linear would be the third integration following GitHub and Vercel.

## Detailed Findings

### 1. Current Linear Integration Status

**Status**: Planned but not implemented

**Existing Components**:
- Research document at `thoughts/shared/research/2025-12-10-linear-integration-research.md`
- UI placeholder showing "Coming soon" in provider selector (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/provider-selector.tsx`)
- Linear SVG icon component at `packages/ui/src/components/integration-icons.tsx:112`
- Stub webhook handler in worktree at `worktrees/console-db-deploy/packages/console-webhooks/src/linear.ts`

**Not Yet Created**:
- `@packages/console-linear` - Linear API client wrapper
- OAuth routes (`apps/console/src/app/(linear)/`)
- Linear tRPC procedures
- Linear Inngest workflows
- Database schema entries for `linear` source type

### 2. Ingestion Pipeline Architecture

The ingestion pipeline processes data from external sources into two parallel paths:

#### Entry Points
| Source | Webhook Route | Handler |
|--------|---------------|---------|
| GitHub | `apps/console/src/app/(github)/api/github/webhooks/route.ts` | POST `/api/github/webhooks` |
| Vercel | `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` | POST `/api/vercel/webhooks` |
| Linear | (Not created) | Would be `/api/linear/webhooks` |

#### Webhook Processing Flow
1. **Signature Verification** - HMAC SHA-256 validation (`packages/console-webhooks/src/github.ts:77-145`)
2. **Timestamp Validation** - Reject stale webhooks (5 minute max age)
3. **Event Routing** - Route to appropriate handler based on event type
4. **Dual Pipeline Dispatch** - Fire events for both document sync AND neural observations

#### Inngest Workflow Hierarchy (GitHub Pattern)
```
apps-console/github.push
  ↓
apps-console/github-push-handler
  ↓ (forks into 2 parallel paths)
  ├─→ Document Sync Pipeline
  │     apps-console/sync.requested
  │       → apps-console/sync.orchestrator
  │       → apps-console/github.sync.trigger
  │       → apps-console/github.sync.orchestrator
  │       → apps-console/files.batch.process
  │       → apps-console/documents.process
  │
  └─→ Neural Observation Pipeline
        apps-console/neural/observation.capture
          → apps-console/neural/observation.captured
          → apps-console/neural/profile.update
          → apps-console/neural/cluster.check-summary
          → apps-console/neural/llm-entity-extraction.requested
```

#### Key Workflow Files
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` - Main sync orchestration
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts` - GitHub-specific sync
- `api/console/src/inngest/workflow/processing/process-documents.ts` - Document chunking and embedding
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Event tracking and classification

### 3. Document Sync Pipeline (For Linear Docs/Comments)

#### Processing Steps
1. **Fetch Content** - Retrieve document/issue/comment content via Linear GraphQL API
2. **Chunking** - Split content using `@repo/console-chunking` (default 512 tokens, 50 overlap)
3. **Embedding** - Generate Cohere embeddings via `@repo/console-embed`
4. **Vector Storage** - Upsert to Pinecone with workspace namespace
5. **Database Persist** - Store document metadata in `workspaceKnowledgeDocuments`

#### Relevant Code
- `packages/console-chunking/src/chunk.ts` - Token-based chunking
- `packages/console-embed/src/utils.ts:150-160` - Embedding provider creation
- `packages/console-pinecone/src/client.ts` - Pinecone operations
- `api/console/src/inngest/workflow/processing/process-documents.ts:113-590` - Full processing workflow

#### Vector Metadata Schema
```typescript
{
  layer: "documents",
  workspaceId: string,
  sourceType: "linear",  // Would be added
  sourceId: string,      // e.g., linear-issue-${issueId}
  documentId: string,
  chunkIndex: number,
  text: string,
  metadata: {
    issueId: string,
    teamId: string,
    state: string,
    priority: number,
    url: string
  }
}
```

### 4. Neural Observation Pipeline (For Linear Events)

#### Processing Steps
1. **Transform Event** - Convert webhook payload to `SourceEvent` schema
2. **Significance Scoring** - Score event importance (0-100)
3. **Classification** - Use Claude Haiku to categorize event
4. **Multi-View Embeddings** - Generate 3 embeddings (title, content, summary)
5. **Entity Extraction** - Extract entities from text and references
6. **Actor Resolution** - Match actor to workspace profile
7. **Cluster Assignment** - Group related observations
8. **Vector Upsert** - Store all 3 views in Pinecone
9. **Database Persist** - Store observation in `workspaceNeuralObservations`

#### Event Transformation Pattern
The GitHub transformer at `packages/console-webhooks/src/transformers/github.ts` shows the pattern:
- Lines 36-109: Push event transformation
- Lines 114-251: Pull request transformation
- Lines 256-335: Issue transformation

Linear would need similar transformers for:
- `Issue` events (create, update, remove)
- `Comment` events
- `Project` events
- `Cycle` events (sprints)
- `ProjectUpdate` events

#### Observation Metadata Schema
```typescript
{
  layer: "observations",
  view: "title" | "content" | "summary",
  observationType: "linear.issue.created" | "linear.comment.created" | ...,
  source: "linear",
  sourceType: "issue.created" | "comment.created" | ...,
  sourceId: string,
  title: string,
  snippet: string,
  occurredAt: string,
  actorName: string,
  observationId: string  // Pre-generated nanoid
}
```

### 5. Retrieval Pipeline Architecture

#### Search API Entry Points
- **tRPC**: `api/console/src/router/org/search.ts:42` - `search.query` procedure
- **REST**: `apps/console/src/app/(api)/v1/findsimilar/route.ts:186` - POST `/v1/findsimilar`

#### Query Flow
1. **Authentication** - Verify API key and workspace access
2. **Workspace Resolution** - Fetch embedding config (model, index, namespace)
3. **Query Embedding** - Generate embedding with `inputType: "search_query"`
4. **Pinecone Query** - Vector similarity search with metadata filters
5. **Result Mapping** - Transform to API response format

#### Namespace Isolation
- Single Pinecone index per environment: `lightfast-v1`
- Hierarchical namespace: `org_{clerkOrgId}:ws_{workspaceId}`
- Metadata filters distinguish documents vs observations: `layer: "documents" | "observations"`

#### Filtering Capabilities
- By source: `sourceType: "github" | "vercel" | "linear"`
- By layer: `layer: "documents" | "observations"`
- By view: `view: "title" | "content" | "summary"` (observations only)
- By observation type: `observationType: "push" | "pull-request.merged" | ...`

### 6. Database Schema for Integrations

#### Integration Storage (`db/console/src/schema/tables/workspace-integrations.ts`)

**Key Columns**:
- `sourceConfig` - JSONB with discriminated union (lines 81-119)
- `providerResourceId` - Indexed for fast webhook lookups (line 129)
- `isActive` - Boolean sync status (line 132)

**Current Source Types** (lines 84-126):
```typescript
sourceType: "github" | "vercel"  // Linear would be added here
```

**Source Config Structure** (would need Linear variant):
```typescript
{
  version: 1,
  sourceType: "linear",
  type: "workspace" | "team",
  teamId: string,
  teamName: string,
  sync: {
    events?: string[],  // ["issue", "comment", "project"]
    autoSync: boolean
  }
}
```

#### Documents Table (`db/console/src/schema/tables/workspace-knowledge-documents.ts`)
- `sourceType` - SourceType enum (line 37)
- `sourceId` - Source-specific identifier (line 39)
- `sourceMetadata` - JSONB for Linear-specific fields (line 41)

#### Observations Table (`db/console/src/schema/tables/workspace-neural-observations.ts`)
- `source` - varchar(50) for "linear" (line 144)
- `sourceType` - varchar(100) for event type (line 149)
- `sourceId` - unique identifier for deduplication (line 154)

### 7. Webhook Package Infrastructure

#### Existing Webhook Handlers (`packages/console-webhooks/`)
- `src/github.ts` - GitHub webhook verification (9,793 lines)
- `src/vercel.ts` - Vercel webhook verification (10,053 lines)
- `src/common.ts` - Shared HMAC utilities (6,350 lines)
- `src/storage.ts` - Payload storage (2,138 lines)

#### Stub Linear Handler (`worktrees/console-db-deploy/packages/console-webhooks/src/linear.ts`)
- 144 lines with TODO comments
- Not active in main codebase
- Would use `@linear/sdk` for signature verification

#### Linear SDK Webhook Verification
```typescript
import { LinearWebhookClient } from '@linear/sdk/webhooks';

const client = new LinearWebhookClient({
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET
});

client.on('Issue', (payload) => {
  // Signature automatically verified
});
```

### 8. OAuth Integration Pattern

#### Existing OAuth Routes Structure
```
apps/console/src/app/
├── (github)/
│   ├── api/github/
│   │   ├── authorize-user/route.ts
│   │   ├── user-authorized/route.ts
│   │   ├── install-app/route.ts
│   │   ├── app-installed/route.ts
│   │   └── webhooks/route.ts
│   └── github/connected/page.tsx
├── (vercel)/
│   ├── api/vercel/
│   │   ├── authorize/route.ts
│   │   ├── callback/route.ts
│   │   └── webhooks/route.ts
│   └── vercel/connected/page.tsx
└── (linear)/  ← Would be created
    ├── api/linear/
    │   ├── authorize/route.ts
    │   ├── callback/route.ts
    │   └── webhooks/route.ts
    └── linear/connected/page.tsx
```

#### OAuth Package (`packages/console-oauth/`)
- `src/tokens.ts` - Token management (9,968 lines)
- `src/state.ts` - OAuth state management (7,922 lines)
- `src/pkce.ts` - PKCE flow implementation (6,884 lines)

#### Linear OAuth Details (from research doc)
- Authorization URL: `https://linear.app/oauth/authorize`
- Token URL: `https://api.linear.app/oauth/token`
- Required scope: `read` (always required)
- Refresh tokens: Enabled by default

### 9. Validation Schemas

#### Source Type Enum (`packages/console-validation/src/schemas/sources.ts:20-25`)
```typescript
export const SourceTypeSchema = z.enum(["github", "vercel"]);
// Would need: z.enum(["github", "vercel", "linear"])
```

#### Event Schema (`packages/console-validation/src/schemas/source-event.ts`)
Defines the `SourceEvent` structure used by observation pipeline.

#### Workflow I/O (`packages/console-validation/src/schemas/workflow-io.ts`)
Defines input/output schemas for Inngest workflows (16,823 lines).

## Code References

### Ingestion Entry Points
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:462` - GitHub webhook POST handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Vercel webhook handler
- `api/console/src/inngest/workflow/providers/github/push-handler.ts:36` - GitHub push Inngest function

### Document Processing
- `api/console/src/inngest/workflow/processing/process-documents.ts:113` - Document processing workflow
- `packages/console-chunking/src/chunk.ts:62` - Chunking algorithm
- `packages/console-embed/src/utils.ts:150` - Embedding provider creation

### Neural Observation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:335` - Observation capture workflow
- `packages/console-webhooks/src/transformers/github.ts` - Event transformation patterns

### Retrieval
- `api/console/src/router/org/search.ts:42` - Search tRPC procedure
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:186` - Find similar REST endpoint
- `packages/console-pinecone/src/client.ts:68` - Pinecone upsert operations

### Database Schema
- `db/console/src/schema/tables/workspace-integrations.ts:25` - Integration config
- `db/console/src/schema/tables/workspace-knowledge-documents.ts:28` - Document storage
- `db/console/src/schema/tables/workspace-neural-observations.ts:48` - Observation storage

### Webhook Infrastructure
- `packages/console-webhooks/src/github.ts:77` - Signature verification
- `packages/console-webhooks/src/common.ts` - HMAC utilities
- `packages/console-webhooks/src/storage.ts:26` - Payload storage

## Architecture Documentation

### Current Integration Flow Pattern
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ External Source (GitHub/Vercel/Linear)                                      │
│                              │                                              │
│                              ▼                                              │
│              ┌───────────────────────────────┐                              │
│              │ Webhook Endpoint               │                              │
│              │ /api/{source}/webhooks         │                              │
│              │ - Signature verification       │                              │
│              │ - Timestamp validation         │                              │
│              │ - Event routing                │                              │
│              └───────────────────────────────┘                              │
│                              │                                              │
│              ┌───────────────┴───────────────┐                              │
│              ▼                               ▼                              │
│  ┌────────────────────┐        ┌────────────────────┐                       │
│  │ Document Pipeline   │        │ Observation Pipeline│                      │
│  │ - Sync orchestrator │        │ - Event transform   │                      │
│  │ - Batch processor   │        │ - Classification    │                      │
│  │ - Chunking          │        │ - Multi-view embed  │                      │
│  │ - Embedding         │        │ - Entity extraction │                      │
│  └────────────────────┘        └────────────────────┘                       │
│              │                               │                              │
│              ▼                               ▼                              │
│  ┌────────────────────┐        ┌────────────────────┐                       │
│  │ Pinecone            │        │ Pinecone            │                      │
│  │ layer: "documents"  │        │ layer: "observations"│                     │
│  └────────────────────┘        └────────────────────┘                       │
│              │                               │                              │
│              ▼                               ▼                              │
│  ┌────────────────────┐        ┌────────────────────┐                       │
│  │ workspace_knowledge │        │ workspace_neural    │                      │
│  │ _documents          │        │ _observations       │                      │
│  └────────────────────┘        └────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Namespace Strategy
- **Single index**: `lightfast-v1` (cost-efficient, scales to 25,000 namespaces)
- **Namespace format**: `org_{clerkOrgId}:ws_{workspaceId}`
- **Tenant isolation**: Via namespace parameter in all queries

### Concurrency Controls (Inngest)
- Push handler: Singleton mode, latest cancels previous (lines 48-51 in push-handler.ts)
- Sync orchestrator: 1 concurrent per sourceId (lines 49-52 in sync-orchestrator.ts)
- Document processor: 5 concurrent per workspace (lines 130-135 in process-documents.ts)
- Observation capture: 10 concurrent per workspace (lines 346-349 in observation-capture.ts)

## Historical Context (from thoughts/)

### Linear Integration Research
- `thoughts/shared/research/2025-12-10-linear-integration-research.md` - Comprehensive research on Linear API, OAuth, webhooks, SDK

### Related Integration Research
- `thoughts/shared/research/2025-12-10-github-issues-integration-research.md` - GitHub Issues patterns
- `thoughts/shared/research/2025-12-10-github-pr-integration-research.md` - GitHub PR patterns
- `thoughts/shared/research/2025-12-10-integration-marketplace-console.md` - Marketplace design

### Pipeline Architecture
- `thoughts/changelog/observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md` - Observation pipeline design
- `thoughts/shared/research/2025-12-16-neural-observation-workflow-tracking-analysis.md` - Workflow analysis

### Actor & Identity
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` - Actor resolution design
- `thoughts/shared/plans/2025-12-16-org-level-actor-identities.md` - Cross-source identity

## Related Research

- [Linear Integration Research (2025-12-10)](thoughts/shared/research/2025-12-10-linear-integration-research.md)
- [Observation Pipeline Architecture](thoughts/changelog/observation-pipeline-semantic-classification-webhook-architecture-20251217-152845.md)
- [Search API Hybrid Retrieval](thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md)

## Open Questions

1. **OAuth Actor Authorization** - Should Linear actions come from the app itself (actor authorization) or the user who connected (standard OAuth)? Actor authorization may be better for agent-like behavior.

2. **Event Prioritization** - Which Linear events should be enabled by default? Issues and comments are most valuable; documents and cycles may be optional.

3. **Cross-Source Linking** - How should Linear issues link to GitHub PRs when mentioned? The existing cross-source linking for Vercel deployments could inform this.

4. **Team vs Workspace Scope** - Should Linear integration be per-team or per-workspace? Linear's organizational structure differs from GitHub's repo-centric model.

5. **GraphQL Complexity** - Linear uses GraphQL exclusively. Should the client wrapper handle query complexity budgeting automatically?
