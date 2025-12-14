---
date: 2025-12-14T04:11:09Z
researcher: Claude
git_commit: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Integration: APIs, Search System, and MCP"
tags: [research, neural-memory, api, search, mcp, integration, architecture]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
last_updated_note: "Corrected API routes to v1/search, v1/contents, v1/findsimilar, v1/answer. Removed incorrect v1/memory and v1/observe routes."
---

# Research: Neural Memory Integration with APIs, Search System, and MCP

**Date**: 2025-12-14T04:11:09Z
**Researcher**: Claude
**Git Commit**: ca81c4294e8e8ef8d2e0ced73848d0172a82ec1f
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

With the neural memory E2E design implemented (observation capture, entities, clusters, actor profiles), how do the current API patterns, search system, and MCP integration work, and how could they integrate with neural memory?

## Summary

The codebase has **three distinct layers** for neural memory:

1. **Write Path (Implemented)**: Neural memory capture pipeline via Inngest workflows - observations, entities, clusters, actor profiles all stored in PlanetScale with embeddings in Pinecone.

2. **Read Path (Implemented Internally)**: The internal search route (`apps/console/.../api/search/route.ts`) already implements full 4-path parallel retrieval:
   - Vector similarity (observations layer)
   - Entity search
   - Cluster context
   - Actor profiles
   - LLM relevance filtering

3. **Public API (Not Yet Exposed)**: Internal search uses session auth. Need public API endpoints with API key auth for external clients and MCP integration.

4. **MCP Layer (Planned, Not Implemented)**: Architecture supports MCP via tool factory patterns, but no actual MCP server exists. Documentation describes planned `@lightfast/mcp-server` package.

**Key Finding**: Neural memory read path is **implemented internally** but **not exposed publicly**. The path forward is creating Next.js API routes at `(api)/v1/*` that reuse the existing search logic with API key authentication.

---

## Public API Routes

The four public API routes follow Exa's API design patterns:

| Endpoint | Purpose | Input | Output |
|----------|---------|-------|--------|
| `POST /v1/search` | Discover relevant content | Query string | Ranked results with scores |
| `POST /v1/contents` | Fetch full documents | Document IDs | Full content + metadata |
| `POST /v1/findsimilar` | Find related documents | Document ID | Semantically similar items |
| `POST /v1/answer` | Generate LLM answers | Query + context | Answer with citations |

See `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` for detailed design specifications.

---

## Key Architectural Decisions

### API Route Strategy (Not tRPC)

**Important Clarification**: Search and public APIs use **Next.js API routes**, not tRPC routers.

| Use Case | Pattern | Location |
|----------|---------|----------|
| Internal search (session auth) | Next.js route | `(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` |
| Public API (API key auth) | Next.js route | `(api)/v1/search/route.ts` (to be created) |
| Console UI data | tRPC | `api/console/src/router/org/*.ts` |
| Inngest workflows | tRPC M2M | `api/console/src/router/m2m/*.ts` |

### Public API Architecture Decision

**Recommendation**: Start with route groups in console, extract to separate app later.

**Phase 1: `apps/console/src/app/(api)/v1/...`**
```
apps/console/src/app/
├── (api)/                    # Route group (no URL segment)
│   └── v1/
│       ├── search/route.ts      # POST /v1/search
│       ├── contents/route.ts    # POST /v1/contents
│       ├── findsimilar/route.ts # POST /v1/findsimilar
│       └── answer/route.ts      # POST /v1/answer
├── (app)/                    # Existing console UI
├── (github)/                 # GitHub webhooks
└── (trpc)/                   # tRPC endpoints
```

**Why Route Group First**:
- Shared infrastructure (db, packages, middleware)
- Clean URL (`/v1/search` - route group doesn't appear)
- Fast iteration before committing to separate app
- Works with microfrontends (`lightfast.ai/v1/search`)
- Easy extraction later

**Phase 2: Extract to `apps/api` when**:
- \> 1000 daily external API requests
- Need independent scaling
- Want `api.lightfast.ai` subdomain
- Multiple API versions (v1, v2) concurrently

---

## Detailed Findings

### 1. Neural Memory Implementation Status

#### Implemented Components

| Component | Location | Status |
|-----------|----------|--------|
| **Observation Capture** | `api/console/src/inngest/workflow/neural/observation-capture.ts` | Implemented |
| **Entity Extraction** | `entity-extraction-patterns.ts`, `llm-entity-extraction.ts` | Implemented |
| **Cluster Assignment** | `cluster-assignment.ts` | Implemented |
| **Actor Resolution** | `actor-resolution.ts` | Implemented (Tier 2 email-based) |
| **Profile Update** | `profile-update.ts` | Implemented |
| **Cluster Summary** | `cluster-summary.ts` | Implemented |
| **Significance Scoring** | `scoring.ts` | Implemented |
| **Classification** | `classification.ts` | Implemented |
| **Temporal States** | Schema only | Schema exists, no workflow |

#### Database Tables

- `workspace_neural_observations` - Atomic events with 3-view embeddings
- `workspace_neural_entities` - Extracted entities with deduplication
- `workspace_observation_clusters` - Topic groupings with LLM summaries
- `workspace_actor_profiles` - Unified actor data
- `workspace_actor_identities` - Cross-platform identity mapping
- `workspace_temporal_states` - Bi-temporal state tracking (schema only)

#### Pinecone Strategy

```
Namespace: org_{clerkOrgId}:ws_{workspaceId}
Metadata: layer = "observations" | "clusters" | "documents"

Vector IDs:
- Observations: obs_title_{id}, obs_content_{id}, obs_summary_{id}
- Clusters: cluster_{id} (centroids)
- Documents: {docId}#{chunkIndex}
```

---

### 2. Current API Architecture

#### tRPC Router Structure

```
AppRouter
├── userRouter (no org required)
│   ├── organization - Clerk org management
│   ├── account - User profile
│   ├── userApiKeys - API key management
│   ├── userSources - OAuth integrations
│   └── workspaceAccess - Manual access verification
│
├── orgRouter (org membership required)
│   ├── search - Semantic search via Pinecone
│   ├── contents - Document retrieval
│   ├── workspace - Workspace management + nested sub-routers
│   │   ├── sources - Connected sources
│   │   ├── store - Embedding config
│   │   ├── documents - Document stats
│   │   ├── jobs - Job metrics
│   │   ├── health - System health
│   │   └── integrations - GitHub/Vercel linking
│   ├── integration - Integration connections
│   ├── jobs - Background job management
│   └── activities - Activity logging
│
└── m2mRouter (internal services only)
    ├── jobs - Job lifecycle (Inngest)
    ├── sources - Source management (webhooks)
    └── workspace - Workspace queries (Inngest)
```

#### Authentication Boundaries

| Procedure | Auth Type | Use Case |
|-----------|-----------|----------|
| `userScopedProcedure` | clerk-pending OR clerk-active | Onboarding, cross-org |
| `orgScopedProcedure` | clerk-active only | Workspace operations |
| `apiKeyProcedure` | Bearer + X-Workspace-ID | Public API access |
| `inngestM2MProcedure` | M2M token | Inngest workflows |
| `webhookM2MProcedure` | M2M token | Webhook handlers |

#### Neural-Related Endpoints

**Status: No neural-specific tRPC endpoints exist.**

Neural workflows are Inngest background jobs, not exposed via tRPC. Future neural features would be added as new sub-routers under `orgRouter`.

---

### 3. Current Search System

#### Search Endpoints

1. **tRPC `search.query`** (`api/console/src/router/org/search.ts:42-185`)
   - Protected by `apiKeyProcedure`
   - Simple vector search against `documents` layer only
   - Returns SearchResponse with results + latency metrics

2. **Next.js API Route** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`)
   - 4-path parallel retrieval:
     - Vector similarity search
     - Entity search (PlanetScale)
     - Cluster context search
     - Actor profile search
   - LLM relevance filtering
   - Context enrichment (clusters + actors)

#### Search Data Flow

```
Query → Embedding (Cohere) → Pinecone Query → Results
                                    ↓
                           (Currently: documents only)
                           (Missing: observations, clusters)
```

#### Key Gap

The search system queries the `documents` layer but **not the `observations` layer**. Neural memory data is stored but not retrievable through search.

```typescript
// Current: Only searches documents
filter: { layer: { $in: ["documents"] } }

// Needed: Include observations and clusters
filter: { layer: { $in: ["documents", "observations", "clusters"] } }
```

---

### 4. MCP Integration Status

#### Current State

| Aspect | Status | Location |
|--------|--------|----------|
| External MCP clients | Configured | `.mcp.json` (Playwright, Exa) |
| MCP server SDK | Not installed | No `@modelcontextprotocol/sdk` |
| Lightfast MCP server | Not implemented | `@lightfast/mcp-server` planned |
| Tool factory pattern | Implemented | `core/lightfast/src/core/primitives/agent.ts` |
| API-key protected endpoints | Implemented | `search.query`, `contents.fetch` |

#### Planned MCP Tools (from documentation)

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfast/mcp-server"],
      "env": { "LIGHTFAST_API_KEY": "lf_sk_live_..." }
    }
  }
}
```

**Planned Tools:**
- `lightfast_search` → POST /v1/search
- `lightfast_contents` → POST /v1/contents
- `lightfast_findsimilar` → POST /v1/findsimilar
- `lightfast_answer` → POST /v1/answer

#### No "Vercel MCP" Product

Important clarification: There is no "Vercel MCP" product. MCP (Model Context Protocol) is an Anthropic open standard. Vercel integration in Lightfast is webhook-based, not MCP-based.

---

## Architecture: Current vs. Target State

### Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                          WRITE PATH (Complete)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Webhook → Transformer → Inngest Workflow → Storage                 │
│   (GitHub)   (SourceEvent)  (observation-capture)                    │
│                                    │                                 │
│              ┌─────────────────────┼─────────────────────┐          │
│              ↓                     ↓                     ↓          │
│         PlanetScale            Pinecone             Fire Events     │
│         (observations,      (obs_title_,          (profile.update,  │
│          entities,           obs_content_,         cluster.summary, │
│          clusters,           cluster_)             llm-extraction)  │
│          actors)                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    READ PATH (Internal Only)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Internal Route: /[slug]/[workspaceName]/api/search                │
│   Auth: Clerk Session (userId)                                       │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              4-PATH PARALLEL RETRIEVAL (Implemented)         │   │
│   │                                                              │   │
│   │   Query → Embedding → Parallel Search:                       │   │
│   │     ├── Path 1: Vector (Pinecone, observations layer) ✓     │   │
│   │     ├── Path 2: Entity lookup (PlanetScale) ✓               │   │
│   │     ├── Path 3: Cluster context (Pinecone) ✓                │   │
│   │     └── Path 4: Actor profiles (PlanetScale) ✓              │   │
│   │                     ↓                                        │   │
│   │              LLM Relevance Filter ✓                          │   │
│   │                     ↓                                        │   │
│   │              Fusion & Ranking ✓                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Missing: Public API with API key auth                             │
│   Missing: MCP server (@lightfast/mcp-server)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────────────┐
│                          READ PATH (Public)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              SHARED SEARCH LOGIC (lib/neural/search.ts)      │   │
│   │                                                              │   │
│   │   Reuse existing 4-path retrieval + LLM filter:             │   │
│   │     ├── Path 1: Vector (observations) ✓                     │   │
│   │     ├── Path 2: Entity lookup ✓                             │   │
│   │     ├── Path 3: Cluster context ✓                           │   │
│   │     ├── Path 4: Actor profiles ✓                            │   │
│   │     └── Path 5: Vector (documents) ← Add for unified search │   │
│   │                     ↓                                        │   │
│   │              LLM Relevance Filter ✓                          │   │
│   │                     ↓                                        │   │
│   │              Fusion & Ranking ✓                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ↓                               ↓                      │
│   ┌─────────────────────┐       ┌─────────────────────┐            │
│   │  INTERNAL ROUTES    │       │  PUBLIC API ROUTES   │            │
│   │  (Session Auth)     │       │  (API Key Auth)      │            │
│   │                     │       │                      │            │
│   │  /[slug]/[ws]/api/* │       │  /v1/search          │            │
│   │                     │       │  /v1/contents        │            │
│   └─────────────────────┘       │  /v1/findsimilar     │            │
│                                 │  /v1/answer          │            │
│                                 └──────────┬───────────┘            │
│                                            │                        │
│                                            ↓                        │
│                                 ┌─────────────────────┐            │
│                                 │    MCP SERVER        │            │
│                                 │  @lightfast/mcp      │            │
│                                 │  (thin API wrapper)  │            │
│                                 │                      │            │
│                                 │  4 tools:            │            │
│                                 │  - lightfast_search  │            │
│                                 │  - lightfast_contents│            │
│                                 │  - lightfast_similar │            │
│                                 │  - lightfast_answer  │            │
│                                 └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Current Internal Search (Already Implements Neural Memory)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

The internal search route already implements 4-path parallel retrieval:
- Path 1: Vector similarity (Pinecone, `observations` layer)
- Path 2: Entity search (PlanetScale)
- Path 3: Cluster context search
- Path 4: Actor profile search

Plus LLM relevance filtering and result fusion. This is the reference implementation for public APIs.

### 2. Public API Endpoints (Next.js Routes)

**Proposed location**: `apps/console/src/app/(api)/v1/`

```typescript
// apps/console/src/app/(api)/v1/search/route.ts
// Discovery endpoint - find relevant content
import { withApiKeyAuth } from "~/lib/api/middleware";

export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Reuse 4-path search logic from internal route
  return searchWorkspace(request, auth.workspaceId);
}

// apps/console/src/app/(api)/v1/contents/route.ts
// Content retrieval - fetch full documents by IDs
export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  // Batch fetch documents/observations by ID
}

// apps/console/src/app/(api)/v1/findsimilar/route.ts
// Similarity endpoint - find related documents
export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  // Given a document ID, find semantically similar items
}

// apps/console/src/app/(api)/v1/answer/route.ts
// Answer generation - LLM synthesis with citations
export async function POST(request: NextRequest) {
  const auth = await withApiKeyAuth(request);
  // Search + LLM generation with streaming support
}
```

### 3. API Auth Middleware

```typescript
// apps/console/src/lib/api/middleware.ts
import { verifyApiKey } from "@api/console/trpc";

export async function withApiKeyAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const workspaceId = request.headers.get("X-Workspace-ID");

  if (!authHeader?.startsWith("Bearer ") || !workspaceId) {
    return { error: "Missing authentication", status: 401 };
  }

  const apiKey = authHeader.slice(7);
  const result = await verifyApiKey(apiKey, workspaceId);

  if (!result.valid) {
    return { error: result.error, status: 401 };
  }

  return {
    workspaceId: result.workspaceId,
    userId: result.userId,
    apiKeyId: result.apiKeyId,
  };
}
```

### 4. MCP Server Implementation

**Package location**: `packages/lightfast-mcp/`

MCP server is a thin wrapper around the 4 public API routes. No resources, just tools.

```typescript
// packages/lightfast-mcp/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "lightfast", version: "1.0.0" });

const API_URL = process.env.LIGHTFAST_API_URL ?? "https://lightfast.ai";
const API_KEY = process.env.LIGHTFAST_API_KEY;
const WORKSPACE_ID = process.env.LIGHTFAST_WORKSPACE_ID;

async function callApi(endpoint: string, body: unknown) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "X-Workspace-ID": WORKSPACE_ID,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

// Tool 1: lightfast_search → POST /v1/search
server.tool(
  "lightfast_search",
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit = 10 }) => {
    const result = await callApi("/v1/search", { query, limit });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

// Tool 2: lightfast_contents → POST /v1/contents
server.tool(
  "lightfast_contents",
  { ids: z.array(z.string()) },
  async ({ ids }) => {
    const result = await callApi("/v1/contents", { ids });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

// Tool 3: lightfast_findsimilar → POST /v1/findsimilar
server.tool(
  "lightfast_findsimilar",
  { id: z.string(), limit: z.number().optional() },
  async ({ id, limit = 10 }) => {
    const result = await callApi("/v1/findsimilar", { id, limit });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

// Tool 4: lightfast_answer → POST /v1/answer
server.tool(
  "lightfast_answer",
  { query: z.string(), mode: z.enum(["concise", "detailed", "summary"]).optional() },
  async ({ query, mode = "detailed" }) => {
    const result = await callApi("/v1/answer", { query, mode });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 5. Retrieval Governor Implementation

**Proposed location**: `packages/console-retrieval/src/governor.ts`

```typescript
interface GovernorResult {
  documents: ScoredResult[];
  observations: ScoredResult[];
  entities: Entity[];
  clusters: ClusterContext[];
  actors: ActorMatch[];
  metrics: RetrievalMetrics;
}

async function retrievalGovernor(
  workspaceId: string,
  query: string,
  options: RetrievalOptions
): Promise<GovernorResult> {
  const queryEmbedding = await generateEmbedding(query);

  // Parallel retrieval paths
  const [documents, observations, entities, clusters, actors] = await Promise.all([
    // Path 1: Document vectors
    searchPinecone(indexName, queryEmbedding, { layer: "documents" }, namespaceName),

    // Path 2: Observation vectors
    searchPinecone(indexName, queryEmbedding, { layer: "observations" }, namespaceName),

    // Path 3: Entity exact-match
    searchEntities(workspaceId, query),

    // Path 4: Cluster context
    searchClusters(workspaceId, queryEmbedding),

    // Path 5: Actor profiles
    searchActorProfiles(workspaceId, query),
  ]);

  // Key 2: LLM relevance filtering
  const filteredResults = await llmRelevanceFilter(query, [...documents, ...observations]);

  // Fusion and ranking
  return fuseResults(filteredResults, entities, clusters, actors);
}
```

---

## Integration Roadmap

### Phase 1: Public API Routes (Next.js)

1. Create `apps/console/src/app/(api)/v1/` route group
2. Implement API key auth middleware (`withApiKeyAuth`)
3. Create endpoints:
   - `POST /v1/search` - Semantic search with 4-path retrieval
   - `POST /v1/contents` - Fetch document contents by IDs
   - `POST /v1/findsimilar` - Find semantically similar documents
   - `POST /v1/answer` - LLM-generated answers with citations

### Phase 2: Retrieval Governor Enhancement

1. Extract search logic from internal route to shared `lib/neural/search.ts`
2. Add document layer to existing 4-path retrieval (currently observations-only)
3. Implement configurable layer selection via request params
4. Add caching for cluster summaries and actor profiles

### Phase 3: Build MCP Server

1. Create `packages/lightfast-mcp/` package
2. Implement 4 tools (thin wrappers around API routes):
   - `lightfast_search` → POST /v1/search
   - `lightfast_contents` → POST /v1/contents
   - `lightfast_findsimilar` → POST /v1/findsimilar
   - `lightfast_answer` → POST /v1/answer
3. Publish as `@lightfast/mcp-server` to npm

### Phase 4: Advanced Features

1. Temporal queries ("what was the status last week?")
2. Actor-centric queries ("what did Sarah work on?")
3. Cross-source linkage (GitHub → Linear → Vercel)
4. Extract to `apps/api` if scaling requires

---

## Code References

### Neural Memory
- `api/console/src/inngest/workflow/neural/observation-capture.ts:193` - Main capture workflow
- `db/console/src/schema/tables/workspace-neural-observations.ts:25` - Observation schema
- `db/console/src/schema/tables/workspace-neural-entities.ts:25` - Entity schema

### API Layer
- `api/console/src/router/org/search.ts:42` - tRPC search endpoint
- `api/console/src/trpc.ts:373` - Org-scoped procedure definition
- `api/console/src/trpc.ts:530` - API key procedure

### Search System
- `packages/console-pinecone/src/client.ts:1` - Pinecone client
- `packages/console-embed/src/utils.ts:126` - Embedding provider factory
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:186` - Advanced search

### MCP Configuration
- `.mcp.json` - External MCP server configuration
- `apps/docs/src/content/api/overview.mdx:289-307` - Planned MCP integration docs

---

## Historical Context (from thoughts/)

**46 research documents** exist for neural memory implementation spanning Dec 11-14, 2025:

- Day-by-day implementation plans (Days 1-5)
- Architecture research and gap analysis
- Security hardening reviews
- LLM entity extraction integration
- Cross-source linkage architecture
- Test data alignment

**No MCP-related documents** exist in thoughts/ - this is a new area requiring research.

---

## Related Research

- `thoughts/shared/research/2025-12-11-neural-memory-implementation-map.md` - Core implementation map
- `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md` - Cross-source architecture
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - Detailed API route design
- `thoughts/shared/plans/2025-12-13-neural-memory-day5.md` - Latest implementation plan

---

## Open Questions

1. **Rate Limiting**: How should API rate limits be structured? Per-endpoint? Per-workspace? Different limits for answer vs search?

2. **Caching Strategy**: Should cluster summaries and actor profiles be cached at the API layer? Redis? Edge caching?

3. **Extract Timing**: When should we extract from `(api)/v1/` route group to separate `apps/api`? What metrics trigger this?

4. **Cost Tracking**: Should we expose cost metrics like Exa (`costDollars`)? This would help users optimize usage.
