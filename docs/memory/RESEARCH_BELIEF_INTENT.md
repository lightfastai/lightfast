# BELIEF- AND INTENT-CENTRIC MEMORY — Research Review and Design Proposal

Last Updated: 2025-10-27

This document surveys AI memory systems across industry and research and proposes a belief- and intent-centric memory model aligned with Lightfast’s relationships‑first Memory Graph. It complements docs/memory/GRAPH.md and focuses on durable, explainable memory grounded in organizational purpose.

---

## Executive Summary

- Most production “memory” today is either retrieval (RAG) or short‑term conversational state. Durable organizational memory requires first‑class representations of beliefs (mission/vision/principles/goals) and intents (goals → commitments → plans → tasks) linked to people, work, and artifacts.
- Best practices converge on: graph + provenance, hybrid retrieval with graph bias, confidence gating for LLM extraction, and explicit privacy/tenancy controls.
- We recommend elevating Beliefs and Intents to top‑level graph objects with lifecycle policies, evidence, and revision logs; integrate with traversal‑aware retrieval for explainable “why/who/depends” answers.

---

## What “Memory” Means (Working Taxonomy)

- Conversational state: turns, summaries, and preferences within or across sessions.
- External knowledge memory (RAG): chunked documents + embeddings + lexical search.
- Graph memory: entities, typed relationships, provenance, temporal attributes, beliefs/goals.
- Algorithmic memory: architectures that learn to read/write memory (NTM, DNC, Memory Networks), retrieval‑augmented transformers (RETRO, kNN‑LM), long‑context models.
- Internal model editing: modifying parametric memory (ROME, MEMIT, IKE) — not used for organizational truth in production.

Lightfast sits across the first three, prioritizing graph memory that grounds retrieval and answers in relationships and purpose.

---

## Industry Systems (Survey)

This section summarizes well‑known approaches to agent and product “memory.” It is not exhaustive but captures major patterns informing our design. Where specific implementation details vary over time, treat these as design exemplars rather than exact specifications.

- Supermemory (product)
  - Positioning: “Memory API for the AI era,” drop‑in memory layer with sub‑400ms latency; exposes Memory APIs, SDKs, a “Model Enhancer (Infinite Chat)” memory router, and cookbooks.
  - Blog claims and patterns: “Architecting a memory engine inspired by the human brain” emphasizes five constraints: high recall/precision, low latency at scale, ease of integration, semantic and non‑literal queries, and explainability. Notes tradeoffs of vector, graph, and key‑value stores; advocates hybrid plus strong API ergonomics.
  - Graph: promotes knowledge‑graph‑plus‑RAG for structure/explainability; tutorial shows Neo4j‑based graphs with LLMs for QA over structured edges.
  - Embeddings: discusses Matryoshka Representation Learning (MRL) to reduce vector dimensionality and costs while retaining performance.
  - Infra: highlights PlanetScale for performance improvements, with reliability focus and incident reports.
  - Links: https://supermemory.ai/docs, https://supermemory.ai/blog/memory-engine/, https://supermemory.ai/blog/knowledge-graph-for-rag-step-by-step-tutorial/, https://supermemory.ai/blog/matryoshka-representation-learning-the-ultimate-guide-how-we-use-it/

- Anthropic “Claude Memory”
  - Remembers user‑level facts and preferences across chats; opt‑in, user‑editable; categories like background, preferences, ongoing projects; safety‑filtered and revocable.
  - Design takeaways: scoped, user‑controlled memories; typed categories; safe defaults; transparency surface in UI.

- OpenAI ChatGPT “Memories” and Assistants state
  - Personal memories (opt‑in) to persist preferences and facts; Assistants/Threads support tool‑persisted state; enterprise controls for data retention.
  - Design takeaways: explicit “memory write” pathways, UI affordances to inspect/forget; separation of long‑term memory vs ephemeral thread state.

- Microsoft GraphRAG (Knowledge Graph‑aware RAG)
  - Builds structured graphs from text and uses graph‑aware retrieval to ground multi‑hop answers.
  - Design takeaways: graph synthesis + traversal boosts recall and explainability; edge provenance is key.

- LlamaIndex and LangGraph memory patterns
  - Conversation, entity, and summary memory modules; node‑scoped and global memory; checkpointers for durable state.
  - Design takeaways: layer memory by scope (agent, tool, org); TTL and summarization strategies; deterministic anchors + LLM augmentation.

- Vector DB vendor guides (Pinecone, others)
  - Emphasize hybrid retrieval, chunk hygiene, metadata filters, dedup/versioning, and index observability.
  - Design takeaways: retrieval is table stakes; provenance and filters matter more than embedding choice past a baseline.

- “Supermemory” style systems (productized or OSS)
  - Typically expose a memory write/read API for agents, with typed slots (facts, projects, preferences) and scoring/decay; often backed by a vector store plus metadata and TTL.
  - Design takeaways: a typed schema and editorial controls reduce drift; confidence and recency heuristics guide retention.

---

## Comparative Highlights (Lightfast vs Supermemory)

- Scope and target
  - Supermemory: general‑purpose “Memory API” for LLM apps, with conversational memory router (“Infinite Chat”), SDKs, cookbooks, and RAG infra.
  - Lightfast: organizational memory layer focused on entities, relationships, and beliefs/intent — connecting purpose → work → code with explainability.

- Graph orientation
  - Supermemory: recommends knowledge‑graph‑plus‑RAG for structure/explainability; examples with Neo4j.
  - Lightfast: graph is primary source of truth in our Memory Graph (PlanetScale + Redis adjacency), with hybrid retrieval biased by traversal.

- Beliefs and intents
  - Supermemory: not explicitly modeled as first‑class belief/intent objects in public docs.
  - Lightfast: beliefs (mission/vision/principles/goals) and intents (objectives/initiatives/commitments) are first‑class, with provenance, stability, and lifecycle.

- Conversation memory
  - Supermemory: “Model Enhancer (Infinite Chat)” hints at conversation‑level memory and routing.
  - Lightfast: conversation memory is optional and scoped; separated from org‑wide memory to avoid leakage; user‑controlled and revocable.

- Performance and infra
  - Both emphasize low‑latency pipelines; Supermemory cites sub‑400ms targets and PlanetScale; Lightfast uses PlanetScale/S3/Redis + Pinecone with hybrid retrieval and caching.

- Evaluation and explainability
  - Both advocate evaluation and explainability; Lightfast bakes “graph rationale” and graph QA suites into the design; Supermemory tutorials emphasize explainable graph queries.

Implication: adopt Supermemory’s practical patterns (APIs, routers, hybrid retrieval, dimension‑aware embeddings) while maintaining Lightfast’s differentiator — beliefs/intent grounding and relationships‑first graph as the organizing spine.

---

## Academic Foundations (Selected)

- Memory‑Augmented Neural Networks
  - Neural Turing Machines (NTM), Differentiable Neural Computers (DNC): external differentiable memory addressing; strong on synthetic tasks; less common in production LLM stacks.
  - Memory Networks / End‑to‑End Memory Networks: multi‑hop attention over memory slots.

- Retrieval‑Augmented Models
  - kNN‑LM (non‑parametric retrieval at inference); DeepMind RETRO (explicit chunk retrieval with cross‑attention); Retrieval‑Augmented Generation (RAG) as the dominant practical pattern.

- Agent cognition and planning
  - BDI (Belief‑Desire‑Intention) architecture: separates world state (beliefs), desired outcomes (desires/goals), and chosen commitments (intentions); supports plan revision and intention reconsideration.
  - Plan/goal recognition: inferring latent intent from observed actions/artifacts.

- Knowledge representation and belief revision
  - AGM belief revision: formal rules for incorporating new information with minimal change; provenance matters to resolve conflicts.

These inform: first‑class beliefs and intents, separation of desire vs commitment, provenance, and curated revision.

---

## Memory Patterns That Work In Production

- Deterministic first, LLM‑assisted second: extract entities/edges from structured sources (APIs/links), then augment with LLMs under confidence gates.
- Provenance + confidence everywhere: edges, beliefs, and intents must carry evidence and source; never silently overwrite deterministic truth.
- Typed categories and scopes: personal vs team vs org; conversational vs durable; belief vs intent vs task.
- Temporal semantics: since/until for edges; intent lifecycle timestamps; belief supersession with stability windows.
- Graph‑aware retrieval: seed from entities/edges and bias chunk ranking; always expose “graph rationale.”
- Memory routers for conversations: segment ephemeral conversational state vs durable organizational memory; keep per‑user preference slots user‑controlled, with TTL and explicit write intents (inspired by Anthropic/OpenAI and Supermemory’s “Infinite Chat” model enhancer).
- Privacy by default: opt‑in, explainable memory, per‑tenant boundaries, redaction + TTL for sensitive slots.

---

## Belief and Intent — Definitions

- Belief: durable, corroborated statement of purpose or principle (mission, vision, principles, policies, goals, themes). Long‑lived; changes are audited and justified.
- Intent: a commitment to move toward a belief‑aligned outcome (goal → commitment → plan → task). Time‑bounded; owned; evidence‑backed; revisable.

Beliefs provide the “why”; intents connect the “why” to the “what” and “who.”

---

## Proposed Data Model Additions

Extend docs/memory/GRAPH.md with first‑class Intents and supporting logs. Keep beliefs as specified; add revision and linkage mechanics. SQL shown for PlanetScale/Postgres; adapt naming to the existing conventions.

```sql
-- Intents: desired outcomes instantiated as commitments
CREATE TABLE intents (
  id               varchar(40) PRIMARY KEY,
  workspace_id     varchar(40) NOT NULL,
  title            varchar(255) NOT NULL,
  description      mediumtext NULL,
  intent_type      varchar(24) NOT NULL, -- objective|key_result|initiative|commitment|experiment
  status           varchar(16) NOT NULL, -- proposed|committed|in_progress|paused|completed|abandoned
  priority         varchar(16) NULL,     -- p0|p1|p2 or custom
  owner_entity_id  varchar(40) NULL,     -- team or person
  belief_id        varchar(40) NULL,     -- aligns to active belief/goal
  start_at         timestamp NULL,
  due_at           timestamp NULL,
  confidence       decimal(4,3) NULL,    -- inferred mapping confidence if LLM‑linked
  source           varchar(20) NOT NULL, -- rule|llm|manual
  source_document_id varchar(40) NULL,
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_intent_ws_status (workspace_id, status),
  INDEX idx_intent_belief (workspace_id, belief_id)
);

-- Link intents to entities/documents (many‑to‑many roles)
CREATE TABLE intent_links (
  id               varchar(40) PRIMARY KEY,
  workspace_id     varchar(40) NOT NULL,
  intent_id        varchar(40) NOT NULL,
  ref_kind         varchar(16) NOT NULL, -- entity|document
  ref_id           varchar(40) NOT NULL,
  role             varchar(24) NOT NULL, -- owner|assignee|evidence|depends_on|related
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_il_intent (workspace_id, intent_id),
  INDEX idx_il_ref (workspace_id, ref_kind, ref_id)
);

-- Intent lifecycle events for auditing and temporal reasoning
CREATE TABLE intent_events (
  id               varchar(40) PRIMARY KEY,
  workspace_id     varchar(40) NOT NULL,
  intent_id        varchar(40) NOT NULL,
  event_type       varchar(24) NOT NULL, -- created|committed|status_changed|deadline_set|completed|abandoned
  metadata_json    json NOT NULL,
  occurred_at      timestamp NOT NULL,
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ie_intent_time (workspace_id, intent_id, occurred_at)
);

-- Optional: belief revision/audit log (AGM‑inspired)
CREATE TABLE belief_revisions (
  id               varchar(40) PRIMARY KEY,
  workspace_id     varchar(40) NOT NULL,
  belief_id        varchar(40) NOT NULL,
  change_type      varchar(16) NOT NULL, -- created|updated|superseded
  reason           varchar(255) NULL,
  evidence_document_id varchar(40) NULL,
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_br_belief (workspace_id, belief_id)
);
```

Design notes
- Intents explicitly align to beliefs via `belief_id` and indirectly via `intent_links` to projects/tickets/repos.
- Use existing `relationships` for rich edges (e.g., INTENT_ALIGNS_WITH_GOAL, IMPLEMENTS_INTENT via PRs); intent tables provide lifecycle and ownership.
- Preserve provenance and confidence for any LLM‑inferred links; never overwrite deterministic sources.
- Consider a dedicated `conversation_memories` table for per‑user ephemeral memory (preferences, ongoing projects) with scoped visibility, TTL, and user‑driven erasure. Keep strictly separate from org‑wide beliefs and intents.

---

## Ingestion & Extraction Extensions

1) Deterministic intent detection
- Linear/Jira: Projects/Objectives/OKRs → `intent_type=objective|key_result`; status from native fields.
- GitHub: Milestones/Releases → `intent_type=initiative`; owners from CODEOWNERS and team mappings.
- Notion: Strategy/OKR databases → beliefs and intents seeded with high confidence.

2) LLM‑assisted intent inference
- From specs/PRs/issues, infer candidate intents with: title, type, alignment belief, owner, due date, and evidence spans.
- Gating: accept ≥0.80, queue review 0.60–0.79, discard <0.60; never downgrade deterministic mappings.

3) Belief consolidation and stability
- As in MEMORY_GRAPH_DESIGN: corroborate across sources; require stability window (e.g., 14 days) before superseding.
- Record `belief_revisions` with reasons and evidence for audits and explainability.

4) Alias expansion
- Maintain alias tables for people/teams/repos/components; map intent owners accurately using email/handle/repo URL aliases.

5) Conversation memory (optional module)
- User‑initiated writes only; typed slots (preference, background, tool‑setting); TTL defaults; allow “forget” and full export.
- Do not surface these in org‑wide graph reasoning unless explicitly shared and re‑typed as org memory.

---

## Retrieval Integration (Graph‑Aware)

- Query classification detects ownership, dependency, alignment, intention, and status questions.
- Traversal seeds from detected entities and intents; expand 1–2 hops constrained by edge types per intent (OWNED_BY, ALIGNS_WITH_GOAL, IMPLEMENTS, DEPENDS_ON, BLOCKED_BY).
- Candidate boosting: increase scores of chunks linked to nearby intents and their evidence.
- Answer composition: include “graph rationale” listing beliefs, intents, and edges with links to evidence.
 - Conversation memory: when query is personal or session‑scoped, consult `conversation_memories` first via a fast KV store or summarized vector slot; never bleed into org‑wide answers unless requested.

---

## Implementation Notes for Lightfast

- Add Memory Router module
  - Classify queries into: organizational (ownership/dependency/alignment), knowledge (general RAG), and personal (conversation/preferences).
  - Route to: graph traversal + hybrid retrieval; knowledge‑only retrieval; or conversation memory store.
  - Return a merged context with explicit sections and a short “graph rationale.”

- Dimensionality strategy for embeddings
  - Support MRL or smaller‑dimensional embeddings for cost/latency; store multiple representations per chunk behind a versioned index key; fall back to high‑dimensional for cold paths if needed.

- Connectors
  - Keep deterministic edges first; add more sources where intents/beliefs live (OKR tools, strategy docs).

- Governance
  - Add ACLs to intent/belief endpoints; require explicit user consent for conversation memory; implement “forget/export.”

- Observability
  - Extend retrieval logs with router decisions, memory scope used, and embedding variant; segment evals accordingly.

---

## Agent Interfaces (Sketch)

- Write memory
  - `POST /api/memory/intents` to propose or commit intents; include evidence and desired owners.
  - `POST /api/memory/beliefs` to propose updated beliefs; route through consolidation rules.

- Read memory
  - `GET /api/memory/graph?seeds=...&hops=..&types=[...]` returns entities, intents, beliefs, edges.
  - `GET /api/memory/why?artifactId=...` returns belief/intent alignment and rationale.

- Safety
  - Per‑user/tenant ACLs; redaction for PII; intent privacy levels (public/team/private).
  - Explicit user consent for conversation memory writes; export/forget endpoints.

---

## Evaluation

- Intent detection
  - Precision/recall by intent_type; owner assignment accuracy; status accuracy; SLA to sync latency.

- Belief stability
  - Weekly churn <5%; alert on unexpected supersessions; corroboration count per active belief.

- Graph QA
  - Ownership (“Who owns component X?”), dependency (“What depends on service Y?”), alignment (“How does project Z align with our goals?”), intention (“What is the current intent for initiative A?”).

- End‑to‑end agent outcomes
  - Task success rate and error attribution with and without graph boosts; explanation quality ratings.
  - Conversation memory: preference recall accuracy, unintended leakage checks, and user satisfaction for “remembers me” tasks.

---

## Privacy, Governance, and Tenancy

- Opt‑in memory with visibility scopes; audit logs for writes/edits/deletions.
- Workspace‑scoped RLS on all tables; S3 and vector indices namespace by workspace.
- Memory erasure: hard delete of personal memories on request; TTL/retention policies for sensitive intents.

---

## Open Questions

- Which “Supermemory” implementation(s) are in scope for a detailed comparative (product vs OSS)?
- Should intents be modeled purely as graph edges on existing artifacts, or as first‑class records plus edges (this proposal)?
- Do we need a dedicated graph index (Neo4j/TypeDB) for high‑fanout intent traversal at scale, or can PlanetScale + Redis adjacency suffice for MVP?
- How to balance per‑user personalization memories with org‑wide beliefs/intents without leakage?
 - Should we adopt MRL‑style embeddings or smaller‑dimensional models as a default to control cost/latency, and where would we switch dimensions in the pipeline?

---

## References (selected, to ground further review)

Academic
- Graves et al., Neural Turing Machines (2014)
- Graves et al., Hybrid computing using a neural network with dynamic external memory (DNC) (2016)
- Weston et al., Memory Networks (2014–2015)
- Khandelwal et al., kNN‑LM (2019)
- Borgeaud et al., RETRO: Improving language models with retrieved contexts (2022)
- Alchourrón, Gärdenfors, Makinson, On the logic of theory change (AGM) (1985)

Industry and frameworks
- Supermemory: docs and blogs
  - https://supermemory.ai/docs/introduction
  - https://supermemory.ai/docs/how-it-works
  - https://supermemory.ai/blog/memory-engine/
  - https://supermemory.ai/blog/knowledge-graph-for-rag-step-by-step-tutorial/
  - https://supermemory.ai/blog/matryoshka-representation-learning-the-ultimate-guide-how-we-use-it/
- Microsoft GraphRAG (engineering playbook/blog)
- LlamaIndex memory modules (entity/conversation/summary)
- LangGraph memory and checkpointers
- Anthropic Claude “Memory” user‑level feature (product docs)
- OpenAI “ChatGPT Memories” and Assistants state (product docs)
- Vector DB best practices (Pinecone, etc.)

Note: For a fully footnoted literature review with quotes and direct links, see the action item in the main PR to run web research and attach curated citations.
