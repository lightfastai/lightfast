---
date: 2026-01-22T04:11:22Z
researcher: Claude
git_commit: 68cddbf9097f3fb649238e967ba2df8533024b40
branch: main
repository: lightfast
topic: "Sentry Integration for Ingestion/Retrieval Pipeline"
tags: [research, sentry, integration, ingestion, retrieval, neural-memory, connector]
status: complete
last_updated: 2026-01-22
last_updated_by: Claude
---

# Research: Sentry Integration for Ingestion/Retrieval Pipeline

**Date**: 2026-01-22T04:11:22Z
**Researcher**: Claude
**Git Commit**: 68cddbf9097f3fb649238e967ba2df8533024b40
**Branch**: main
**Repository**: lightfast

## Research Question

How would Sentry integrate into Lightfast's ingestion and retrieval pipeline, and what is the current implementation status?

## Summary

Sentry integration is **planned but not yet implemented** in the Lightfast codebase. The architecture is fully prepared to accommodate Sentry as a connector - existing patterns for GitHub and Vercel provide clear templates for implementation. Research documentation exists from December 2025, but no actual code has been written for Sentry webhooks, OAuth flows, or data processing workflows.

**Current Status:**
- **Sentry for Error Monitoring**: Fully configured and active (`@vendor/observability`)
- **Sentry as Data Connector**: Not implemented (research complete, no code)

## Detailed Findings

### 1. Current Sentry Usage (Error Monitoring Only)

Sentry is currently used only for application error monitoring, not as a data source.

**Configuration Files:**
- `vendor/observability/src/env/sentry-env.ts` - Environment variables (DSN, org, project, auth token)
- `vendor/security/src/csp/sentry.ts` - CSP directives for Sentry ingest endpoints

This is separate from the planned "Sentry as a connector" feature for neural memory.

### 2. Planned Ingestion Pipeline (Not Implemented)

Based on existing connector patterns (GitHub, Vercel), Sentry ingestion would follow this architecture:

#### 2.1 Webhook Endpoint Structure (To Be Created)

Expected location: `apps/console/src/app/(sentry)/api/sentry/webhooks/route.ts`

Would follow the pattern from:
- GitHub: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- Vercel: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

#### 2.2 Webhook Verification (To Be Created)

Expected location: `packages/console-webhooks/src/sentry.ts`

Sentry uses **HMAC SHA-256** signature verification (documented in research):
```typescript
// From thoughts/shared/research/2025-12-10-sentry-integration-research.md:165-182
// Headers: Sentry-Hook-Signature (HMAC-SHA256)
// No prefix on signature (unlike GitHub's "sha256=" prefix)
```

#### 2.3 Event Transformation (To Be Created)

Expected location: `packages/console-webhooks/src/transformers/sentry.ts`

Would transform Sentry webhook payloads to `SourceEvent` schema:

```typescript
// Planned structure based on Sentry webhook documentation
interface SentryIssueEvent {
  action: "created" | "resolved" | "assigned" | "ignored";
  data: {
    issue: {
      id: string;
      shortId: string;  // e.g., "PROJ-123"
      title: string;
      status: string;
      level: "error" | "warning" | "info";
      metadata: { type: string; value: string; filename?: string };
      project: { id: string; name: string; slug: string };
      firstSeen: string;
      lastSeen: string;
    };
  };
  installation: { uuid: string };
  actor: { id: string; name: string; type: string };
}
```

#### 2.4 Inngest Workflow (To Be Created)

Expected location: `api/console/src/inngest/workflow/providers/sentry/`

Would emit `apps-console/neural/observation.capture` event with transformed `SourceEvent`.

### 3. Planned Retrieval Pipeline (Uses Existing Infrastructure)

Once Sentry data is ingested as neural observations, retrieval uses existing infrastructure:

#### 3.1 Four-Path Parallel Search
**Location**: `apps/console/src/lib/neural/four-path-search.ts:362-524`

Sentry observations would be retrieved via:
- **Path 1**: Vector similarity (Pinecone query with `sourceType: "sentry"` filter)
- **Path 2**: Entity pattern matching (issue IDs like `PROJ-123`)
- **Path 3**: Cluster context (if topics are clustered)
- **Path 4**: Actor profiles (issue assignees)

#### 3.2 Entity Search
**Location**: `apps/console/src/lib/neural/entity-search.ts:71-153`

Sentry-specific entity patterns to extract:
- Issue IDs: `PROJ-123`, `#123`
- Error types: `ReferenceError`, `TypeError`
- File paths from stack traces

#### 3.3 Search API
**Location**: `apps/console/src/app/(api)/v1/search/route.ts:41-285`

No changes needed - existing search API is source-agnostic. Sentry observations would be searchable via standard `/v1/search` endpoint.

### 4. Schema Integration Points

#### 4.1 Source Type Enum (Needs Extension)
**Location**: `packages/console-validation/src/schemas/sources.ts:23-26`

Current:
```typescript
export const sourceTypeSchema = z.enum(["github", "vercel"]);
```

Needs:
```typescript
export const sourceTypeSchema = z.enum(["github", "vercel", "sentry"]);
```

#### 4.2 Source Metadata Schema (Placeholder Only)
**Location**: `packages/console-validation/src/schemas/source-metadata.ts:21`

Current (comment only):
```typescript
// Future source metadata schemas:
// - Sentry (organizationSlug, projectSlug)
```

#### 4.3 User Sources Table
**Location**: `db/console/src/schema/tables/user-sources.ts:42-67`

Sentry would extend `providerMetadata` discriminated union:
```typescript
| {
    version: 1;
    sourceType: "sentry";
    organizationSlug: string;
    organizationId: string;
    userId: string;
    userEmail: string;
    scopes: string[];  // org:read, project:read, event:read
  }
```

Token management fields already support Sentry's 8-hour token expiry:
- `accessToken`, `refreshToken`, `tokenExpiresAt` (lines 34-38)

#### 4.4 Workspace Integrations Table
**Location**: `db/console/src/schema/tables/workspace-integrations.ts:81-119`

Sentry would extend `sourceConfig` discriminated union:
```typescript
| {
    version: 1;
    sourceType: "sentry";
    type: "project";
    organizationSlug: string;
    projectSlug: string;
    projectId: string;
    sync: {
      events?: string[];  // ["issue", "error", "event_alert"]
      autoSync: boolean;
    };
  }
```

#### 4.5 Neural Observations Table
**Location**: `db/console/src/schema/tables/workspace-neural-observations.ts:142-164`

Already supports arbitrary source types:
- `source`: Would be `"sentry"`
- `sourceType`: Would be `"issue.created"`, `"error.captured"`, etc.
- `metadata`: JSONB for Sentry-specific fields

### 5. OAuth Flow (Not Implemented)

#### 5.1 Authorization Flow
From research document (lines 67-92):

1. Redirect user to: `https://sentry.io/oauth/authorize/?client_id=...&response_type=code&scope=org:read%20project:read%20event:read`
2. Sentry redirects back with authorization code
3. Exchange code for tokens at `https://sentry.io/oauth/token/`

#### 5.2 Token Refresh
**Critical**: Sentry tokens expire every **8 hours** (research doc line 113)

Requires automatic refresh logic - `user_sources.tokenExpiresAt` field supports this.

#### 5.3 Required Scopes (From Research)
| Scope | Description |
|-------|-------------|
| `org:read` | Organization information |
| `project:read` | Project data |
| `event:read` | Error and event data |
| `member:read` | Organization members |
| `team:read` | Team information |

### 6. Webhook Events (Planned)

From research document (lines 142-150):

| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| `issue` | Issue created/resolved/assigned | Issue lifecycle tracking |
| `error` | Individual error events | Detailed error context |
| `event_alert` | Alerts triggered | Real-time error awareness |
| `metric_alert` | Performance alerts | Performance context |
| `comment` | Comments on issues | Team discussions |
| `installation` | Integration lifecycle | Connection management |

### 7. Existing Connector Patterns (Reference Implementation)

#### 7.1 GitHub Webhook Flow
1. **Receive**: `POST /api/github/webhooks`
2. **Verify**: HMAC SHA-256 signature (`packages/console-webhooks/src/github.ts`)
3. **Store**: Raw payload to `workspace_webhook_payloads`
4. **Transform**: Event-specific transformers (`packages/console-webhooks/src/transformers/github.ts`)
5. **Emit**: Inngest event `apps-console/neural/observation.capture`
6. **Process**: Observation capture workflow generates embeddings, stores to Pinecone

#### 7.2 Vercel Webhook Flow
Same pattern with HMAC SHA-1 signature verification.

### 8. Data Flow Diagram (Planned)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SENTRY INGESTION PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Sentry Cloud                                                               │
│       │                                                                     │
│       ▼ webhook (issue.created, error.captured, etc.)                      │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ POST /api/sentry/webhooks                                   │           │
│  │ (apps/console/src/app/(sentry)/api/sentry/webhooks/route.ts)│           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ verify HMAC-SHA256 signature                                       │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ packages/console-webhooks/src/sentry.ts                     │           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ transform to SourceEvent                                           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ packages/console-webhooks/src/transformers/sentry.ts        │           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ emit Inngest event                                                 │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ inngest.send("apps-console/neural/observation.capture")     │           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ observation capture workflow                                       │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ api/console/src/inngest/workflow/neural/observation-capture │           │
│  │   - check duplicate (idempotency)                           │           │
│  │   - score significance (gate low-value events)              │           │
│  │   - generate embeddings (title, content, summary)           │           │
│  │   - upsert to Pinecone                                      │           │
│  │   - persist to workspace_neural_observations                │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SENTRY RETRIEVAL PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Query: "What errors are happening in the checkout flow?"             │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ POST /v1/search                                             │           │
│  │ (apps/console/src/app/(api)/v1/search/route.ts)             │           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ generate query embedding                                           │
│       │                                                                     │
│       ▼ four-path parallel search                                          │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │ apps/console/src/lib/neural/four-path-search.ts             │           │
│  │   Path 1: Vector similarity (Pinecone)                      │           │
│  │   Path 2: Entity search (PROJ-123 patterns)                 │           │
│  │   Path 3: Cluster context (topic grouping)                  │           │
│  │   Path 4: Actor profiles (assignees)                        │           │
│  └─────────────────────────────────────────────────────────────┘           │
│       │                                                                     │
│       ▼ normalize vector IDs to observation IDs                            │
│       │                                                                     │
│       ▼ rerank results (mode-based)                                        │
│       │                                                                     │
│       ▼ enrich with database metadata                                      │
│       │                                                                     │
│       ▼ return results with Sentry issues/errors                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Code References

### Existing Infrastructure (Implemented)

**Webhook Patterns:**
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` - GitHub webhook route
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Vercel webhook route
- `packages/console-webhooks/src/github.ts` - GitHub signature verification
- `packages/console-webhooks/src/vercel.ts` - Vercel signature verification
- `packages/console-webhooks/src/common.ts` - Shared verification utilities
- `packages/console-webhooks/src/transformers/github.ts` - GitHub event transformers
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel event transformers

**Ingestion Workflows:**
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Neural observation capture
- `api/console/src/inngest/workflow/processing/process-documents.ts` - Document processing
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` - Sync orchestration

**Retrieval Infrastructure:**
- `apps/console/src/lib/neural/four-path-search.ts` - Four-path parallel search
- `apps/console/src/lib/neural/entity-search.ts` - Entity pattern search
- `apps/console/src/lib/neural/cluster-search.ts` - Cluster context search
- `apps/console/src/app/(api)/v1/search/route.ts` - Search API endpoint
- `api/console/src/router/org/search.ts` - tRPC search router

**Schema Definitions:**
- `packages/console-validation/src/schemas/sources.ts:23-26` - Source type enum
- `packages/console-validation/src/schemas/source-metadata.ts:18-21` - Metadata schemas (comment)
- `db/console/src/schema/tables/user-sources.ts:42-67` - User sources table
- `db/console/src/schema/tables/workspace-integrations.ts:81-119` - Workspace integrations
- `db/console/src/schema/tables/workspace-neural-observations.ts:142-164` - Neural observations

### Not Implemented (Expected Locations)

**Sentry-Specific Code (To Create):**
- `apps/console/src/app/(sentry)/api/sentry/webhooks/route.ts` - Webhook endpoint
- `apps/console/src/app/(sentry)/sentry/connected/` - OAuth callback
- `packages/console-webhooks/src/sentry.ts` - Signature verification
- `packages/console-webhooks/src/transformers/sentry.ts` - Event transformers
- `api/console/src/inngest/workflow/providers/sentry/` - Sentry workflows

## Architecture Documentation

### Connector Pattern Summary

All connectors in Lightfast follow this architecture:

1. **OAuth Connection**: User authorizes via OAuth → Token stored in `user_sources`
2. **Resource Selection**: User selects specific resources → Config stored in `workspace_integrations`
3. **Webhook Registration**: System registers webhook URL with provider
4. **Event Processing**: Webhooks → Verification → Transformation → Inngest → Neural Memory
5. **Retrieval**: Standard search API queries across all sources

### Key Architectural Decisions

1. **Source-Agnostic Core**: The observation capture workflow and retrieval pipeline are source-agnostic. Adding Sentry requires only new webhook handlers and transformers.

2. **Discriminated Unions**: All source-specific data uses discriminated unions on `sourceType`, making extension straightforward.

3. **Multi-View Embeddings**: Each observation generates title, content, and summary embeddings. Sentry issues would include:
   - Title: Issue title with error type
   - Content: Full error message and context
   - Summary: AI-generated summary of impact

4. **Entity Extraction**: Sentry-specific entities (issue IDs, error types) would be extracted and stored in `workspace_neural_entities` for pattern matching.

## Historical Context (from thoughts/)

**Primary Research Document:**
- `thoughts/shared/research/2025-12-10-sentry-integration-research.md` - Comprehensive OAuth, webhook, and API documentation

**Related Integration Research (Same Initiative - December 10, 2025):**
- `thoughts/shared/research/2025-12-10-integration-marketplace-console.md` - Integration marketplace architecture
- `thoughts/shared/research/2025-12-10-linear-integration-research.md` - Linear integration (similar issue tracking)
- `thoughts/shared/research/2025-12-10-vercel-integration-research.md` - Vercel integration patterns

## Related Research

- [2025-12-10 Sentry Integration Research](./2025-12-10-sentry-integration-research.md) - OAuth, webhooks, API documentation
- [2025-12-10 Integration Marketplace Console](./2025-12-10-integration-marketplace-console.md) - Marketplace architecture

## Open Questions

1. **Priority**: When will Sentry connector implementation be prioritized?

2. **Internal vs Public Integration**: Should Lightfast start with Sentry Internal Integration (faster development, org-specific) or Public OAuth Integration (requires partnership approval)?

3. **Event Filtering**: Which Sentry events should be captured by default? All issues or only specific severity levels?

4. **Token Refresh Strategy**: Sentry's 8-hour token expiry requires proactive refresh. Should this be a background job or on-demand?

5. **Issue vs Error Granularity**: Sentry groups errors into issues. Should observations be created per-issue or per-error event?
