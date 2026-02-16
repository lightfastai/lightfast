/**
 * Populate changelog with 4 neural memory implementation entries.
 *
 * Usage:
 *   cd apps/www && pnpm with-env node ../../scripts/populate-changelog.mjs
 *
 * Requires BASEHUB_ADMIN_TOKEN environment variable.
 */

import basehubPkg from "../vendor/cms/node_modules/basehub/dist/index.cjs";

const { basehub } = basehubPkg;

/**
 * Changelog entries for the neural memory implementation (Dec 11-17, 2025)
 */
const entries = [
  {
    title: "Observation Pipeline, Semantic Classification, Webhook Storage",
    slug: "0-2",
    body: `# v0.2 · December 11-12, 2025

**Observation Pipeline, Semantic Classification, and Webhook Storage**

---

### Neural Memory Observation Pipeline

Transform GitHub webhooks into searchable engineering memory. Every PR merge, issue update, and deployment becomes an observation with automatic significance scoring, semantic classification, and topic detection.

**What's included:**
- Significance scoring (0-100) filters noise from important events
- Semantic classification detects observation types (code_change, decision, incident, etc.)
- Topic extraction identifies what each event is about
- Inngest workflow orchestration with parallel processing

**Example significance factors:**
\`\`\`yaml
eventType: 30pts  # PR merged > issue comment
contentSubstance: 25pts  # Longer content = more significant
actorActivity: 20pts  # Active contributors prioritized
referenceDensity: 15pts  # More references = more connected
temporalUniqueness: 10pts  # Avoid duplicates
\`\`\`

**Why significance scoring:** Not every webhook matters. Bot commits, empty descriptions, and duplicate events create noise. Scoring lets us capture decisions and architectural changes while filtering routine updates.

---

### Raw Webhook Storage

Permanent retention of original webhook payloads for debugging, auditing, and future re-processing.

**What's included:**
- Full payload stored before transformation
- Indexed by workspace, source, and delivery ID
- Enables replay if transformers improve

---

### Pinecone Index Consolidation

Simplified from 4 namespaces per workspace to 1 with metadata filtering.

**What's included:**
- Single \`lightfast-v1\` index for all workspaces
- Layer metadata: \`knowledge\`, \`observations\`, \`clusters\`, \`profiles\`
- 3x reduction in namespace count
- Cross-layer retrieval in single query

[Learn more about the architecture](/docs/architecture)`,
    improvements: `- Observation pipeline captures GitHub webhooks as searchable memory
- Significance scoring (0-100) filters noise from important events
- Semantic classification detects observation types automatically
- Topic extraction identifies what each event relates to
- Raw webhook storage for permanent payload retention`,
    infrastructure: `- Inngest workflow orchestration with parallel step execution
- Pinecone consolidated to single lightfast-v1 index
- Metadata-based layer filtering replaces multiple namespaces
- Idempotent processing with delivery ID tracking`,
  },
  {
    title: "Entity Extraction, Observation Clusters, Multi-View Embeddings",
    slug: "0-3",
    body: `# v0.3 · December 13, 2025

**Entity Extraction, Observation Clusters, and Multi-View Embeddings**

---

### Entity Extraction

Automatically extract structured facts from observations: engineers, APIs, config keys, and project references. Rule-based extraction for high-confidence patterns, LLM enhancement for complex entities.

**What's included:**
- Rule-based: @mentions, API endpoints (GET/POST/...), env vars, issue refs
- LLM-enhanced: technical decisions, architectural patterns
- Confidence scoring (0.0-1.0) per extracted entity
- Entity store with exact-match lookup

**Example entities extracted:**
\`\`\`typescript
// From: "Sarah fixed the auth bug in POST /api/users"
[
  { category: "engineer", key: "sarah", confidence: 0.90 },
  { category: "endpoint", key: "POST /api/users", confidence: 0.95 },
]
\`\`\`

---

### Observation Clusters

Topic-grouped collections of related observations. When multiple PRs, issues, and commits relate to the same feature, they're automatically clustered for contextual retrieval.

**What's included:**
- Cluster assignment via embedding similarity + entity overlap
- Actor overlap detection (same team working on related items)
- Temporal proximity grouping
- Automatic cluster summaries (threshold-based generation)

**Cluster affinity scoring:**
- Embedding similarity: 40pts
- Entity overlap: 30pts
- Actor overlap: 20pts
- Temporal proximity: 10pts

---

### Multi-View Embeddings

Three embedding views per observation for optimal retrieval across query types.

**What's included:**
- **Title view**: Headline search ("auth bug fix")
- **Content view**: Full semantic search ("how does authentication work")
- **Summary view**: Gist-based retrieval (compact representation)

**Why multi-view:** Different queries need different representations. Title embeddings match short queries, content embeddings handle detailed questions, summary embeddings balance both.

---

### Actor Resolution

Cross-platform identity correlation without requiring a central identity service.

**What's included:**
- Tier 1: OAuth connection (confidence: 1.0)
- Tier 2: Email matching (confidence: 0.85)
- Tier 3: Heuristic matching (confidence: 0.60)
- Identity linking across GitHub, Linear, Sentry

[API documentation](/docs/api)`,
    improvements: `- Entity extraction identifies engineers, APIs, config keys from observations
- LLM enhancement for complex entity detection with confidence scoring
- Observation clusters group related PRs, issues, and commits
- Multi-view embeddings (title, content, summary) optimize retrieval
- Actor resolution links identities across GitHub, Linear, Sentry`,
    infrastructure: `- Entity store with PostgreSQL exact-match indexes
- Cluster assignment algorithm with 4-factor affinity scoring
- Parallel embedding generation for 3 views
- Actor profile computation with expertise domains`,
  },
  {
    title: "Search API, Hybrid Retrieval, Cross-Encoder Reranking",
    slug: "0-4",
    body: `# v0.4 · December 14-15, 2025

**Search API, Hybrid Retrieval, and Cross-Encoder Reranking**

---

### Public v1 Search API

Production-ready API for querying your engineering memory. Hybrid retrieval combines vector search with LLM relevance filtering for high-precision results.

**Endpoints:**
- \`POST /api/v1/search\` - Semantic search with filters
- \`GET /api/v1/contents/:id\` - Retrieve observation by ID
- \`POST /api/v1/findsimilar\` - Find related observations

**Example search:**
\`\`\`bash
curl -X POST https://api.lightfast.ai/v1/search \\
  -H "Authorization: Bearer sk-lf-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "authentication implementation",
    "filters": { "type": ["code_change", "decision"] },
    "topK": 10
  }'
\`\`\`

**What's included:**
- Workspace-scoped search with API key authentication
- Metadata filtering (type, actor, date range, source)
- Pagination with cursor-based navigation
- Response includes snippets, scores, and source citations

---

### Hybrid Retrieval (2-Key)

Two-stage retrieval for high recall AND high precision.

**Key 1: Vector Search**
- Pinecone query with metadata filters
- Fetches 50 candidates for final ranking
- Sub-50ms latency

**Key 2: LLM Relevance Gating**
- Claude Haiku validates each candidate
- Filters false positives from embedding similarity
- Combined score: 60% LLM relevance + 40% vector similarity

**Why 2-key:** Vector search has high recall but poor precision. Semantic similarity returns related but irrelevant results. LLM gating validates actual relevance to the query.

---

### Cross-Encoder Reranking

Final ranking pass using cross-encoder model for optimal result ordering.

**What's included:**
- Rerank top candidates after hybrid retrieval
- Cross-encoder scores query-document pairs
- Significant accuracy improvement over embedding similarity alone

---

### Webhook Security Hardening

Production security measures for GitHub webhook ingestion.

**What's included:**
- HMAC SHA-256 signature verification
- Request body size limits
- Rate limiting per workspace
- Input sanitization and validation

[API Reference](/docs/api/v1)`,
    improvements: `- v1/search endpoint with semantic search and metadata filters
- v1/contents endpoint for observation lookup by ID
- v1/findsimilar endpoint for related content discovery
- Hybrid 2-key retrieval (vector + LLM gating) for precision
- Cross-encoder reranking for optimal result ordering
- API key authentication with sk-lf- format`,
    infrastructure: `- BIGINT primary keys for high-volume tables
- Vector ID to observation ID resolver
- Clerk API caching for membership lookups
- Workspace config caching for v1 routes
- Webhook security: HMAC verification, rate limiting, sanitization`,
    fixes: `- Content re-fetch loop in workspace search resolved
- Search ID normalization for multi-view deduplication
- Statement-breakpoint delimiters in migrations`,
  },
  {
    title: "TypeScript SDK, MCP Server, AI Observability",
    slug: "0-5",
    body: `# v0.5 · December 16-17, 2025

**TypeScript SDK, MCP Server, and AI Observability**

---

### Lightfast TypeScript SDK

Official npm package for integrating Lightfast into your applications.

**Installation:**
\`\`\`bash
npm install lightfast
\`\`\`

**Usage:**
\`\`\`typescript
import { Lightfast } from "lightfast";

const lf = new Lightfast({ apiKey: "sk-lf-..." });

// Search your engineering memory
const results = await lf.search({
  query: "how does authentication work",
  topK: 10,
});

// Find similar observations
const similar = await lf.findSimilar({
  observationId: "obs_...",
  topK: 5,
});
\`\`\`

**What's included:**
- Full TypeScript types with Zod schema descriptions
- Search, contents, and findsimilar methods
- Automatic retry and error handling
- Dynamic version injection

---

### MCP Server (@lightfastai/mcp)

Model Context Protocol server for Claude Desktop and other MCP clients.

**Installation:**
\`\`\`bash
npx @lightfastai/mcp
\`\`\`

**What's included:**
- Search tool for querying observations
- Contents tool for retrieving by ID
- FindSimilar tool for related content
- Works with Claude Desktop, Cursor, and any MCP client

---

### AI Observability with Braintrust

Track and evaluate AI operations in the observation pipeline.

**What's included:**
- \`step.ai.wrap()\` for AI step instrumentation
- Braintrust integration for tracing
- Token usage and latency tracking
- Evaluation datasets for pipeline quality

**Why observability:** AI steps (classification, entity extraction, relevance filtering) need monitoring. Braintrust provides tracing, evaluation, and cost tracking for production AI workflows.

---

### API Key Unification

Standardized API key format across all Lightfast services.

**Format:** \`sk-lf-{256-bit entropy}\`

**What changed:**
- Unified prefix for all API keys
- 256-bit entropy for security
- Workspace-scoped activity tracking
- Key rotation support

---

### Actor Identity Organization Scope

Migrated actor identities from workspace to organization scope for cross-workspace identity resolution.

**What's included:**
- Single identity per user across all workspaces
- Organization-level identity management
- Backwards-compatible with existing data

[SDK Documentation](/docs/sdk) | [MCP Setup](/docs/mcp)`,
    improvements: `- lightfast npm package with full TypeScript support
- @lightfastai/mcp server for Claude Desktop integration
- Braintrust + step.ai.wrap() for AI observability
- API key format unified to sk-lf- with 256-bit entropy
- Actor identities migrated to organization scope`,
    infrastructure: `- Dual-package CI/CD deployment workflow
- Dynamic SDK version injection
- Zod schema descriptions for API documentation
- Embedding config versioned settings migration`,
    fixes: `- Edge runtime node:crypto error in chat build
- Vendor/mastra import path for createWorkflow
- Unused Clerk imports in auth pages`,
  },
];

/**
 * Create a changelog entry in BaseHub
 */
async function getChangelogCollectionId(client) {
  const result = await client.query({
    changelog: {
      post: {
        _id: true,
      },
    },
  });
  return result.changelog.post._id;
}

async function createChangelogEntry(client, parentId, data) {
  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: [{
          type: "create",
          parentId: parentId,
          data: {
            type: "instance",
            title: data.title,
            slug: data.slug,
            value: {
              body: {
                type: "rich-text",
                value: {
                  format: "markdown",
                  value: data.body,
                },
              },
              improvements: {
                type: "text",
                value: data.improvements ?? null,
              },
              infrastructure: {
                type: "text",
                value: data.infrastructure ?? null,
              },
              fixes: {
                type: "text",
                value: data.fixes ?? null,
              },
              patches: {
                type: "text",
                value: data.patches ?? null,
              },
            },
          },
        }],
      },
      message: true,
      status: true,
    },
  });
}

async function main() {
  const token = process.env.BASEHUB_ADMIN_TOKEN;
  if (!token) {
    throw new Error(
      "BASEHUB_ADMIN_TOKEN is not set in the environment.\n" +
        "Run this script with: cd apps/www && pnpm with-env node ../../scripts/populate-changelog.mjs"
    );
  }

  const client = basehub({ token });

  console.log("Creating changelog entries for Neural Memory implementation...\n");

  // First, get the changelog post collection ID
  console.log("Fetching changelog post collection ID...");
  let parentId;
  try {
    parentId = await getChangelogCollectionId(client);
    console.log(`  Collection ID: ${parentId}\n`);
  } catch (error) {
    throw new Error(`Failed to get changelog post collection ID: ${error.message}`);
  }

  for (const entry of entries) {
    console.log(`Creating: ${entry.title} (/${entry.slug})`);
    try {
      const result = await createChangelogEntry(client, parentId, entry);
      console.log(`  ✓ Created (status: ${result.transaction.status})`);
      console.log(`  message: ${result.transaction.message}\n`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}\n`);
      // Continue with other entries even if one fails
    }
  }

  console.log("Done! Visit https://lightfast.ai/changelog to see the entries.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
