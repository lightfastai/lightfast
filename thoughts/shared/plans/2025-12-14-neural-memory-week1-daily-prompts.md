---
date: 2025-12-14T05:21:17Z
researcher: Claude
git_commit: 5bc0bf4322d8d478b2ad6311f812804741137ec8
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Week 1: Daily Implementation Prompts"
tags: [prompts, implementation, neural-memory, week1, research-codebase]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Neural Memory Week 1: Daily Implementation Prompts

These prompts are designed to be used with the `/research-codebase` command to gather context before implementing each day's features.

---

## Day 1 Prompt: Rerank Package

**Copy and paste this into Claude Code:**

```
/research-codebase

Research question: Document all existing patterns for creating a rerank package in the codebase. I need to create `packages/console-rerank/` with Cohere and LLM providers. Focus on:

1. **LLM Filter Implementation**: Analyze `apps/console/src/lib/neural/llm-filter.ts` in complete detail:
   - Lines 66-162: Main llmRelevanceFilter() function
   - Lines 13-26: Zod schema for structured output
   - Lines 50-56: Default configuration (minConfidence, weights)
   - Lines 74-92: Bypass logic for small result sets
   - Lines 167-193: Prompt construction
   - How candidates are processed and scored
   - Score combination logic (0.6 * llm + 0.4 * vector)
   - Error handling and fallback behavior

2. **Cohere SDK Usage**: Find all current uses of cohere-ai package:
   - `vendor/embed/src/provider/cohere.ts` - Cohere embedding provider
   - Initialization patterns and API key handling
   - Error handling patterns
   - Any existing rerank usage (search for "rerank")

3. **Package Creation Pattern**: Document the exact structure needed:
   - `packages/console-pinecone/` - Complete file structure
   - `packages/console-pinecone/package.json` - Dependencies and exports
   - `packages/console-pinecone/tsconfig.json` - TypeScript config
   - `packages/console-pinecone/tsup.config.ts` - Build config
   - `packages/console-pinecone/src/index.ts` - Export pattern

4. **Vendor Provider Pattern**: Document the provider abstraction:
   - `vendor/embed/src/types.ts` - Interface definitions
   - `vendor/embed/src/provider/cohere.ts` - Provider class implementation
   - Factory function patterns

5. **Configuration Pattern**: How provider settings are stored:
   - `packages/console-config/src/private-config.ts` - EMBEDDING_CONFIG structure
   - How defaults are applied during workspace creation

Output a technical map with all file paths and line numbers for implementing `packages/console-rerank/` with:
- RerankProvider interface
- CohereRerankProvider (using rerank-v3.5)
- LLMRerankProvider (refactored from llm-filter.ts)
- PassthroughRerankProvider (for fast mode)
- createRerankProvider(mode) factory function
```

---

## Day 2 Prompt: /v1/search Route

**Copy and paste this into Claude Code:**

```
/research-codebase

Research question: Document the exact implementation of the internal search route to build `POST /v1/search`. I need to understand how to extract and adapt the 4-path parallel retrieval for the public API. Focus on:

1. **Internal Search Route** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`):
   - Full file analysis (494 lines)
   - Lines 292-318: Query embedding generation
   - Lines 324-359: 4-path parallel retrieval execution
   - Lines 375-379: Result merging logic
   - Line 382: LLM filter integration
   - Lines 394-435: Response building
   - Lines 437-463: Latency metrics
   - How workspace context is obtained
   - Error handling patterns

2. **API Key Authentication Extraction**:
   - `api/console/src/trpc.ts:530-576` - apiKeyProcedure middleware
   - `api/console/src/trpc.ts:790-850` - verifyApiKey() function
   - Headers: Authorization (Bearer token), X-Workspace-ID
   - How to adapt this to Next.js route handlers
   - `packages/console-api-key/src/crypto.ts` - hashApiKey function

3. **Neural Search Utilities** (reusable components):
   - `apps/console/src/lib/neural/entity-search.ts:71-150` - searchByEntities()
   - `apps/console/src/lib/neural/cluster-search.ts:19-94` - searchClusters()
   - `apps/console/src/lib/neural/actor-search.ts:41-140` - searchActorProfiles()
   - How these integrate in the search flow

4. **Search Schemas**:
   - `packages/console-types/src/api/search.ts:1-64` - Current schemas
   - What needs to be added for v1 (mode param, context option)

5. **Route Group Pattern**:
   - How to create `apps/console/src/app/(api)/v1/` route group
   - Any existing (api) route groups to reference

Output an implementation map for creating:
- `apps/console/src/app/(api)/v1/search/route.ts`
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
- Updated type schemas with mode parameter
```

---

## Day 3 Prompt: /v1/contents + /v1/findsimilar

**Copy and paste this into Claude Code:**

```
/research-codebase

Research question: Document existing content retrieval and similarity search patterns for implementing `POST /v1/contents` and `POST /v1/findsimilar`. Focus on:

1. **Content Retrieval** (`api/console/src/router/org/contents.ts:1-135`):
   - Full router analysis
   - How document IDs are resolved
   - Database queries for workspaceKnowledgeDocuments
   - Database queries for workspaceNeuralObservations
   - Content formatting (markdown, text, html)
   - How missing IDs are handled

2. **Database Queries**:
   - `db/console/src/schema/tables/workspace-knowledge-documents.ts` - Document schema
   - `db/console/src/schema/tables/workspace-neural-observations.ts` - Observation schema
   - Query patterns for fetching by ID array
   - Workspace isolation (tenant filtering)

3. **Similarity Search Components**:
   - `packages/console-pinecone/src/client.ts` - Query interface
   - `vendor/pinecone/src/client.ts` - Raw Pinecone client
   - How vectors are queried for similarity
   - Filter syntax for Pinecone metadata
   - Namespace isolation per workspace

4. **Embedding Generation** (for on-demand embedding):
   - `packages/console-embed/src/utils.ts` - createEmbeddingProvider
   - `vendor/embed/src/provider/cohere.ts` - Cohere embedding
   - How to generate embedding for a document without pre-stored vector

5. **Relationship Queries** (for includeRelationships option):
   - `sourceReferences` field in observations
   - Entity connections between documents
   - How to query related documents

6. **Design Specifications**:
   - `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md:204-323` - Contents design
   - `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md:324-486` - FindSimilar design

Output an implementation map for:
- `apps/console/src/app/(api)/v1/contents/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- `packages/console-types/src/api/v1/contents.ts`
- `packages/console-types/src/api/v1/findsimilar.ts`
```

---

## Day 4 Prompt: Integration & Testing

**Copy and paste this into Claude Code:**

```
/research-codebase

Research question: Document all integration points and testing patterns to finalize the Week 1 public API implementation. Focus on:

1. **Complete API Key Verification**:
   - `api/console/src/trpc.ts:790-850` - Full verifyApiKey() implementation
   - `packages/console-api-key/src/crypto.ts` - All crypto functions
   - `db/console/src/schema/tables/user-api-keys.ts` - Schema with all columns
   - How lastUsedAt is updated non-blocking
   - Expiration checking logic

2. **Workspace Configuration** (for rerank settings):
   - `db/console/src/schema/tables/org-workspaces.ts` - Current columns (186-201)
   - Pattern for embedding provider columns (lines 127-138)
   - `db/console/src/migrations/` - Recent migration examples
   - How to add rerankProvider, rerankModel, rerankThreshold columns
   - `pnpm db:generate` command for migrations

3. **Validation Schemas**:
   - `packages/console-validation/src/schemas/store.ts` - embeddingProviderSchema pattern
   - How to create rerankProviderSchema, rerankModelSchema
   - Zod enum patterns for provider selection

4. **Private Config Defaults**:
   - `packages/console-config/src/private-config.ts` - EMBEDDING_CONFIG structure
   - How to add RERANK_CONFIG with defaults

5. **Testing Patterns**:
   - `packages/console-test-data/` - Test data utilities
   - `packages/console-test-data/src/verifier/verifier.ts` - Verification patterns
   - Any existing API route tests
   - How to test API key authentication

6. **Error Handling Standards**:
   - tRPC error codes and message patterns
   - NextResponse JSON error patterns
   - Logging with observability package

Output a final integration checklist with:
- API key middleware completion steps
- Database migration for rerank config
- Validation schema additions
- Testing approach for all 3 routes
- Error handling standardization
```

---

## Quick Reference: Key Files by Day

### Day 1 (Rerank Package)
- `apps/console/src/lib/neural/llm-filter.ts` - Refactor source
- `vendor/embed/src/provider/cohere.ts` - Provider pattern
- `packages/console-pinecone/` - Package structure pattern

### Day 2 (/v1/search)
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` - Internal route
- `api/console/src/trpc.ts:530-576` - API key auth
- `packages/console-types/src/api/search.ts` - Type schemas

### Day 3 (/v1/contents + /v1/findsimilar)
- `api/console/src/router/org/contents.ts` - tRPC contents
- `packages/console-pinecone/src/client.ts` - Pinecone queries
- `packages/console-embed/src/utils.ts` - Embedding generation

### Day 4 (Integration)
- `api/console/src/trpc.ts:790-850` - verifyApiKey full
- `db/console/src/schema/tables/org-workspaces.ts` - Workspace schema
- `packages/console-config/src/private-config.ts` - Defaults

---

## Usage Instructions

1. Start your day by running the appropriate prompt with `/research-codebase`
2. Wait for the research document to be generated
3. Use the research document as context for implementation
4. Reference the Week 1 root document for architecture decisions
5. Check off items in the testing checklist as you complete them

Each research document will be saved to `thoughts/shared/research/` with the pattern:
`2025-12-XX-neural-memory-week1-dayN-implementation.md`
