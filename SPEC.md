# Lightfast — Vision & Mission

Last Updated: 2025-10-28

Lightfast is memory built for teams. We help people and agents find what they need, understand context, and trace decisions across their entire organization.

---

## Mission

Make your team's knowledge instantly searchable and trustworthy. Capture what matters as it happens. Never lose context.

## Vision

Any person or agent can ask "who/what/why/depends" and get accurate answers with sources—across your entire company's ecosystem, in real time.

---

## Positioning

- **Memory for teams:** Search by meaning, not keywords. Every answer shows its source.
- **Explainable by design:** See who owns what, what depends on what, and why decisions were made.
- **Developer-first:** Four simple API routes. MCP tools for agents. Integrate in minutes.

---

## What We Remember

- **Documents & Code:** Pull requests, issues, docs, and discussions from GitHub, Linear, Notion, Slack, and more.
- **Decisions & Context:** Capture why decisions were made, what was discussed, and who was involved.
- **People & Ownership:** Track who owns what, who worked on what, and who has context on any topic.

Memory is broad and evidence-backed. Context emerges from what actually happened, not narrow predefined categories.

---

## Principles

- **Search by meaning:** Understand intent, not just match keywords.
- **Always cite sources:** Every answer shows where it came from.
- **Privacy by default:** Your data stays yours. Complete tenant isolation.
- **Continuously improve:** Measure quality, learn from usage, adapt over time.

---

## How We Build

- **Simple API:** Four routes do everything—search, contents, similar, answer. Same tools for REST and MCP.
- **Smart retrieval:** Search understands meaning and context. Results are ranked by relevance and recency.
- **Organized memory:** Consolidate related information. Surface what's important. Archive what's not.
- **Quality first:** Measure every query. Learn from feedback. Improve accuracy over time.

---

## API

Four routes power everything:

- **POST `/v1/search`** — Search and rank results. Optionally include rationale and highlights.
- **POST `/v1/contents`** — Get full documents, metadata, and relationships.
- **POST `/v1/similar`** — Find related content based on meaning.
- **POST `/v1/answer`** — Get synthesized answers with citations. Supports streaming.

Available via REST API and MCP tools for agent runtimes.

---

## What We Measure

- **Speed and quality:** How fast users get accurate answers with sources.
- **Trust:** How often answers include rationale and verifiable evidence.
- **Adoption:** How quickly developers integrate and how actively agents use the API.
- **Coverage:** How much of your team's knowledge is searchable and connected.

---

## What We Don't Do

- **Complex graph queries:** We focus on 1-2 hop relationships (ownership, dependencies), not deep graph traversal.
- **General analytics:** We're not a data warehouse or BI tool. We're built for memory and context.
- **Black-box answers:** Every answer must cite its sources. No summarization without verification.

---

## Technical

**Architecture:**
- Storage: PlanetScale (MySQL) for metadata, S3 for bodies, Redis for cache/queues
- Indexing: Pinecone for vector search; namespaced per workspace and embedding version
- Multi-view embeddings: title, snippet, body, summary embedded separately

**Retrieval:**
- Hybrid pipeline: dense + lexical + graph bias + recency + importance + profile similarity
- Cross-encoder rerank on top-K for precision
- Router modes: knowledge | neural | hybrid (internal; API stays simple)

**Memory System:**
- Chunks: durable document slices for high-recall retrieval
- Observations: atomic moments (decisions, incidents, highlights) with multi-view embeddings
- Summaries: clustered rollups by entity/topic/time
- Profiles: per-entity centroids and descriptors for personalization

**Graph:**
- Explicit entities and typed relationships
- Short-hop reasoning (1-2 hops) with bounded, explainable rationale
- Graph influence tracked per query

**Quality:**
- Continuous evaluation: recall@k, rerank lift, snippet accuracy, rationale faithfulness
- Per-workspace calibration: weights, thresholds, decay factors
- Feedback loops tune ranking over time
