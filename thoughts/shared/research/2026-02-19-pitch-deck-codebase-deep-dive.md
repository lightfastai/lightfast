---
date: 2026-02-19
researcher: codebase-agent
topic: "Lightfast pitch deck — codebase deep dive"
tags: [research, codebase, pitch-deck, lightfast]
status: complete
---

# Codebase Deep Dive: Lightfast Pitch Deck Research

## Research Question

What is Lightfast, how does it work technically, who is it for, and what exists in the current pitch deck? We need to understand the product deeply enough to design 10 compelling investor slides.

## Summary

Lightfast is **the memory layer for software teams**. It ingests engineering events (PRs, commits, deployments, incidents, issues) from connected tools (GitHub, Vercel, Linear, Sentry), transforms them into **neural observations** with multi-view embeddings, extracts entities and relationships, and makes everything searchable via semantic search. The core insight is "two-key retrieval" — vector search + LLM reranking — achieving 90%+ precision where vector-only gets 60-70%. A 5-endpoint REST API and MCP tools give both humans and AI agents access to the memory layer. The existing pitch deck has 10 slides but with placeholder team/validation data.

---

## What Lightfast Is

### Mission/Vision (from SPEC.md)

**Mission**: "Make your engineering team's history instantly searchable and trustworthy. Capture what matters as it happens. Never lose context."

**Vision**: "Any engineer or agent can ask 'what broke?', 'who owns this?', 'why was this decision made?' and get accurate answers with sources—across your entire engineering ecosystem, in real time."

**Positioning**: "The memory layer for software teams — Search by meaning, not keywords. Every answer shows its source."

> Source: `SPEC.md:1-24`

### Target Customer

Four distinct personas identified via use-case pages:

1. **Agent Builders** — Build AI systems that predict, prevent, and optimize across the engineering stack. Use cases include: deployment risk scoring, incident root cause tracing, tribal knowledge detection, error clustering.
   > Source: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/agent-builders/data.ts:1-130` — 25 use cases listed

2. **Engineering Leaders** — Team health & velocity intelligence. Cognitive load estimation, sprint predictions, hiring need prediction.
   > Source: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/engineering-leaders/page.tsx:13`

3. **Platform Engineers** — Infrastructure intelligence. Drift detection, cost attribution, scaling prediction, security posture.
   > Source: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/platform-engineers/page.tsx:13`

4. **Technical Founders** — Strategic engineering intelligence. Connect engineering work to revenue impact, ROI tracking.
   > Source: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/technical-founders/page.tsx:13`

### Core Value Proposition

From landing page hero:
> "The **memory layer** for software teams and AI agents."

From FAQ (`apps/www/src/components/faq-section.tsx:12-58`):
- "Lightfast indexes your code, docs, tickets, and conversations so engineers and AI agents can search by meaning, get answers with sources, and trace decisions."
- "Traditional search matches keywords. Lightfast understands intent and meaning."
- "The memory layer captures the important moments — decisions made, incidents resolved, features shipped."
- "Every answer cites its sources... No black-box AI responses — everything is explainable and verifiable."

---

## Product Capabilities

### Console (apps/console)

The console is the main application serving as the dashboard, workspace manager, and API gateway. Key routers:

- **User Router** (`api/console/src/router/user/`): Account management, API keys, sources, workspace management — no org required
- **Org Router** (`api/console/src/router/org/`): Workspace operations, search, jobs, contents, activities, backfill, integrations — requires org membership
- **M2M Router** (`api/console/src/router/m2m/`): Internal services (Inngest workflows, webhooks)

> Source: `api/console/src/root.ts`, `CLAUDE.md`

### Search

The search system is a **multi-stage pipeline**:

1. **Query embedding** — User query embedded via Cohere (`embed-english-v3.0`, 1024 dimensions) with `inputType: "search_query"` optimization
   > Source: `packages/console-embed/src/utils.ts:89-98`

2. **Vector retrieval** — Pinecone query against workspace-namespaced index, returning top-K candidates
   > Source: `api/console/src/router/org/search.ts:119-129`

3. **Reranking** — Three-tier reranking system:
   - **Fast**: Passthrough (vector scores only)
   - **Balanced**: Cohere rerank API
   - **Thorough**: Claude Haiku 4.5 LLM-based semantic scoring with weighted combination (60% LLM + 40% vector)
   > Source: `packages/console-rerank/src/factory.ts:1-48`, `packages/console-rerank/src/providers/llm.ts:1-300`

4. **Result assembly** — Scores, snippets, metadata, entities returned

The API surfaces 5 endpoints (expanded from SPEC.md's 4):
- `POST /v1/search` — Semantic search with multi-path retrieval
- `POST /v1/contents` — Batch content retrieval by ID (up to 50)
- `POST /v1/findsimilar` — Vector similarity + entity overlap + cluster analysis
- `POST /v1/graph` — Relationship graph traversal (1-3 hops)
- `POST /v1/related` — Related events grouped by relationship type and source
> Source: `packages/console-openapi/src/registry.ts:1-249`

### Agent Orchestration / MCP Tools

Lightfast provides AI SDK tools for agent integration:

- **workspaceSearchTool** — "Search through workspace neural memory for relevant documents and observations"
- **workspaceGraphTool** — "Traverse the relationship graph between events" (answers "which PR fixed which issue")
- **workspaceFindSimilarTool** — "Find semantically similar content to a given document"
- **workspaceContentsTool** — "Fetch full content for specific observations by ID"
- **workspaceRelatedTool** — "Get directly related events for a specific observation"

All tools use `@lightfastai/ai-sdk` with typed Zod schemas and runtime context injection.
> Source: `packages/console-ai/src/workspace-search.ts:1-63`, `packages/console-ai/src/workspace-graph.ts:1-50`

### Context/Knowledge Tracing

The neural memory system captures and links engineering events in a rich knowledge graph:

**Observation Pipeline** (Inngest workflow — `api/console/src/inngest/workflow/neural/observation-capture.ts`):

1. **Idempotency check** — Dedup by workspace + sourceId
2. **Event filtering** — Check source config (which event types are enabled)
3. **Significance scoring** — Rule-based scoring (0-100) with keyword signals, reference density, content substance
   > Source: `api/console/src/inngest/workflow/neural/scoring.ts:1-118`
4. **Classification** — Claude Haiku classifies events into categories (bug_fix, feature, refactor, security, incident, decision, etc.) with fallback regex
   > Source: `api/console/src/inngest/workflow/neural/classification.ts:1-163`
5. **Multi-view embedding** — Three separate embeddings per observation (title, content, summary) via Cohere
6. **Entity extraction** — Regex-based + structured reference extraction (API endpoints, issue/PR refs, @mentions, file paths, commit SHAs, branch names, env vars)
   > Source: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:1-211`
7. **Cluster assignment** — Groups related observations by embedding similarity, topic overlap, entity IDs, and actor affinity
8. **Relationship detection** — Links observations via shared commit SHAs, branch names, issue IDs, PR numbers across sources (GitHub <-> Vercel <-> Linear <-> Sentry)
   > Source: `api/console/src/inngest/workflow/neural/relationship-detection.ts:1-494`
9. **Actor resolution** — Cross-source identity resolution (GitHub ID, email, username matching)

**Async follow-up workflows**:
- Profile updates (actor expertise tracking)
- Cluster summary generation
- LLM entity extraction (for rich content >200 chars)

**Relationship Types Detected**:
- `resolves` — Sentry issue resolved by a commit
- `deploys` — Vercel deployment linked to GitHub commit
- `same_commit` — Shared commit SHA across sources
- `same_branch` — Shared branch name
- `fixes` — PR explicitly fixes an issue
- `references` — Issue co-occurrence
- `tracked_in` — Linear issue linked to GitHub PR
- `triggers` — Sentry issue triggers Linear work

---

## Architecture

### How It Works

```
Webhook Events (GitHub, Vercel, Linear, Sentry)
         ↓
    Event Transformer (packages/console-webhooks)
         ↓ SourceEvent
    Inngest Workflow: Observation Capture
         ↓
    ┌─────────────────────────────────────────────┐
    │  PARALLEL:                                   │
    │  1. Classification (Claude Haiku)            │
    │  2. Multi-view Embedding (Cohere x3)         │
    │  3. Entity Extraction (regex + structured)    │
    │  4. Actor Resolution (cross-source ID)        │
    └──────────────┬──────────────────────────────┘
                   ↓
    Cluster Assignment → Relationship Detection
                   ↓
    ┌─────────────────────────────────────────────┐
    │  STORAGE:                                    │
    │  • PlanetScale: observations, entities,      │
    │    relationships, clusters, profiles         │
    │  • Pinecone: 3 vectors per observation       │
    │    (title, content, summary views)           │
    │    namespaced per workspace                  │
    └──────────────┬──────────────────────────────┘
                   ↓
    REST API / MCP Tools / tRPC Console
         ↓
    Search Pipeline: Embed → Vector Retrieve → Rerank → Respond
```

**Tech Stack**:
- **Storage**: PlanetScale (MySQL) for metadata, S3 for bodies, Redis (Upstash) for cache/queues
- **Vector DB**: Pinecone with cosine similarity, AWS us-west-2, namespace isolation per workspace
- **Embeddings**: Cohere `embed-english-v3.0`, 1024 dimensions, multi-view (title/content/summary)
- **LLM**: Claude Haiku for classification, entity extraction, reranking
- **Workflow**: Inngest for durable step functions with idempotency, concurrency limits, retries
- **API**: tRPC (internal), REST + OpenAPI 3.1 (external), MCP tools (agents)
- **Frontend**: Next.js 15, Vercel microfrontends (4 apps on single domain)
- **Auth**: Clerk with org-level isolation
- **Observability**: Custom logging via `@vendor/observability`

### Why This Architecture Is Unique

1. **Multi-view embeddings**: Instead of one embedding per document, Lightfast generates 3 (title, content, summary) — enabling precise retrieval when queries match different aspects of the same event.

2. **Two-key retrieval** (pitch deck slide "Our Insight"): Vector search alone gives 60-70% precision. Adding LLM reranking as a second "key" achieves 90%+ precision. The weighted combination (60% LLM + 40% vector) produces trustworthy results.

3. **Neural observation pipeline**: Not just indexing documents — extracting entities, building relationships, resolving actors across sources, assigning to clusters. This creates a structured knowledge graph on top of unstructured data.

4. **Cross-source relationship detection**: Automatically links a GitHub commit to its Vercel deployment to its triggering Linear issue to a related Sentry error — without any manual tagging.

5. **Significance gating**: Not everything gets indexed. A rule-based scoring system (with planned LLM upgrade) filters noise (dependency bumps, typo fixes, WIP commits) so only meaningful events enter the memory layer.

6. **Workspace-level tenant isolation**: Separate Pinecone namespaces, database isolation per workspace, embedding model locking per workspace to prevent vector space corruption.

---

## Existing Pitch Deck Analysis

### Current Slide Structure

10 slides defined in `apps/www/src/config/pitch-deck-data.ts`:

| # | ID | Type | Title | Key Content |
|---|-----|------|-------|-------------|
| 1 | title | title | LIGHTFAST | Red branded slide with grid design, "Pitch deck 2026" |
| 2 | intro | content | Hi, we are Lightfast. | "The memory layer for engineering teams" — 2 bullet points |
| 3 | problem | content | The Problem. | "Context is scattered" — 4 bullets with $40K stat |
| 4 | solution | content | Our Solution. | "A unified memory layer" — 4 bullets (connect in 5 min, semantic search, cite sources, MCP tools) |
| 5 | insight | content | Our Insight. | "The non-obvious truth" — two-key retrieval (vector + LLM), 90%+ precision |
| 6 | why-now | columns | Why Now. | 4 columns: AI capability, infrastructure, MCP protocol, adoption |
| 7 | team | content | The Team. | **PLACEHOLDER** — "[Name]" fields, needs real team data |
| 8 | validation | content | Validation. | Qualitative: "15+ engineering leads interviewed", "80% rate existing solutions inadequate" |
| 9 | ask | showcase | Building the memory layer... | $300K pre-seed, 12 months runway, Q2 2026 beta, $5K MRR target |
| 10 | vision | title | Every team deserves a memory layer. | Contact: jp@lightfast.ai, 51 Grosvenor St, South Yarra |

### Existing Narrative/Messaging

The pitch follows a clear arc:
1. **Who we are** → "The memory layer for engineering teams"
2. **Problem** → Context scattered across 8+ tools, $40K/engineer/year lost to searching
3. **Solution** → Unified search with citations
4. **Insight** → Two-key retrieval is the technical moat
5. **Why now** → AI agents need context, infrastructure is ready, MCP standard emerging
6. **Team** → (placeholder)
7. **Validation** → Customer development interviews
8. **Ask** → $300K pre-seed for 12 months

### Gaps

1. **Team slide is empty** — "[Name]" placeholders everywhere. This is THE most important slide for pre-seed.
2. **No product demo/screenshot** — No showcase of what the console looks like. The "showcase" slide type exists but the "ask" slide just shows a colored block.
3. **No market size** — No TAM/SAM/SOM or market sizing data anywhere in the deck.
4. **No competitive landscape** — Doesn't address Sourcegraph, Glean, or other competitors.
5. **No business model detail** — Pricing exists (`apps/www/pricing/page.tsx`: Free/$20/$Contact) but isn't in the deck.
6. **Validation is qualitative** — "Interviewed 15+ leads" is good but no user signup numbers, waitlist size, or other traction.
7. **No visual product architecture** — The architecture is genuinely impressive (multi-view embeddings, cross-source relationships) but no diagram shows it.

---

## Marketing Copy / Positioning

**Landing page hero** (`apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:262-268`):
> "The **memory layer** for software teams and AI agents."

**SEO metadata**:
> "Search everything your engineering org knows — code, PRs, docs, decisions — with answers that cite their sources"

**OG description**:
> "Make your team's knowledge instantly searchable. Search by meaning, not keywords. Every answer shows its source."

**Benefits from landing page** (6 cards):
1. One search, all sources
2. Automatic sync (real-time indexing)
3. Identity correlation (cross-platform person linking)
4. Instant answers
5. Track dependencies
6. Privacy by default

**OpenAPI description** (`packages/console-openapi/src/registry.ts:223-224`):
> "Real-time semantic search across all your company's data sources. This API is currently in alpha."

**Pricing tiers** (from pricing page):
- Starter: Free (3 users, 2 sources, 2,500 searches/month)
- Team: $20/user/month (1,500 searches/user, 5 sources, semantic search, Neural Memory)
- Business: Contact (unlimited everything, SSO, SLA)

---

## Key Technical Differentiators

### 1. Multi-View Embeddings
Each observation gets 3 separate embeddings (title, content, summary) stored in Pinecone with view-specific metadata. This is rare — most systems embed once. Multi-view enables retrieval that matches the right "aspect" of a document to the query.
> Source: `api/console/src/inngest/workflow/neural/observation-capture.ts:757-798`

### 2. Two-Key Retrieval (Vector + LLM Reranking)
Vector search alone = 60-70% precision. Adding LLM reranking = 90%+. The weighted combination (60% LLM / 40% vector) using Claude Haiku produces the "second key" that makes results trustworthy.
> Source: `packages/console-rerank/src/providers/llm.ts:77-83`, `apps/www/src/config/pitch-deck-data.ts:63-70`

### 3. Cross-Source Relationship Detection
Automatically detects relationships across tools: a Sentry error → linked to the commit that caused it → linked to the PR → linked to the issue → linked to the Vercel deployment. Relationship types: resolves, deploys, same_commit, same_branch, fixes, references, tracked_in, triggers.
> Source: `api/console/src/inngest/workflow/neural/relationship-detection.ts:1-494`

### 4. Neural Observation Pipeline
Not CRUD indexing — a sophisticated capture pipeline: significance scoring → classification → multi-view embedding → entity extraction → cluster assignment → relationship detection → actor resolution. Each observation is enriched before storage.
> Source: `api/console/src/inngest/workflow/neural/observation-capture.ts:374-1229`

### 5. Significance Gating
Noise reduction — events scored 0-100 with a threshold (currently 40). Dependency bumps, typo fixes, and WIP commits are filtered out. Only meaningful engineering moments enter the memory layer.
> Source: `api/console/src/inngest/workflow/neural/scoring.ts:16-118`

### 6. MCP-Native Design
Purpose-built for AI agents via Model Context Protocol. 5 typed tools (search, graph, findSimilar, contents, related) with Zod schemas and runtime context injection. Agents don't need the full codebase in context — they search Lightfast.
> Source: `packages/console-ai/src/workspace-search.ts:43-63`

### 7. Complete Tenant Isolation
Workspace-level isolation with separate Pinecone namespaces, workspace-locked embedding models (prevents vector space corruption from model switching), and per-workspace configuration.
> Source: `packages/console-embed/src/utils.ts:122-155`

---

## Code References

- `SPEC.md:1-114` — Full product vision, API spec, technical architecture, memory system design
- `apps/www/src/config/pitch-deck-data.ts:1-156` — All 10 slides with content
- `api/console/src/inngest/workflow/neural/observation-capture.ts:374-1229` — Core write path (the most important file)
- `api/console/src/inngest/workflow/neural/scoring.ts:42-118` — Significance scoring algorithm
- `api/console/src/inngest/workflow/neural/classification.ts:16-163` — LLM + fallback classification
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285` — Cross-source relationship creation
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:18-211` — Entity extraction patterns
- `packages/console-rerank/src/providers/llm.ts:97-300` — LLM reranking with weighted scores
- `packages/console-rerank/src/factory.ts:35-48` — Three-tier rerank modes
- `packages/console-embed/src/utils.ts:89-155` — Cohere embedding with workspace locking
- `packages/console-ai/src/workspace-search.ts:43-63` — MCP search tool definition
- `packages/console-ai/src/workspace-graph.ts:30-50` — MCP graph traversal tool
- `packages/console-openapi/src/registry.ts:1-249` — Full OpenAPI spec with 5 endpoints
- `api/console/src/router/org/search.ts:28-187` — Search tRPC router
- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:108-362` — Landing page with positioning
- `apps/www/src/components/faq-section.tsx:12-58` — FAQ content (key messaging)
- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx:108-249` — Pricing tiers and FAQs
- `apps/www/src/app/(app)/(marketing)/(content)/use-cases/agent-builders/data.ts:1-130` — 25 agent builder use cases

---

## Gaps Identified

1. **Team data missing** — Pitch deck slide 7 has placeholder "[Name]" text. Need real founder bios and credentials.

2. **No market size slide** — No TAM/SAM/SOM anywhere. The pitch needs market sizing for engineering context/knowledge management tools ($X billion developer tools market).

3. **No competitive positioning** — Sourcegraph (code search), Glean (enterprise search), Notion AI, GitHub Copilot — no comparison or differentiation slide exists.

4. **No product visuals** — The console app exists with rich UI but no screenshots or demo video appear in the deck. The showcase slide type supports a colored block but shows no product.

5. **Business model absent from deck** — Pricing is well-defined on the website (Free/$20/$Contact) but not in the pitch deck. Investors need to see the revenue model.

6. **Weak traction metrics** — "Interviewed 15+ leads" is fine for early stage but no waitlist size, signups, GitHub stars, or other quantifiable signals are shown.

7. **Architecture not visualized** — The multi-view embedding / cross-source relationship / neural pipeline architecture is genuinely impressive and differentiating, but there's no diagram in the deck. A visual would make the "Insight" slide much more powerful.

8. **Go-to-market missing** — No slide on how Lightfast will acquire customers (PLG? Sales-led? Developer community?). The website suggests PLG (early access waitlist, free tier).
