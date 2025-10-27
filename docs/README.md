# Lightfast Documentation

Last Updated: 2025-10-27

Lightfast builds a relationships‑first Memory layer and a production‑ready Knowledge Store for teams. We connect your tools (GitHub, Linear, Notion, Slack, etc.), normalize artifacts into durable knowledge, and construct a Memory Graph of entities, relationships, and beliefs (mission, vision, goals). The result: explainable answers, multi‑hop reasoning (who/why/depends), and traceable links from purpose → projects → code → customers.

---

## Purpose

- Make organizational intent computable so teams — and their AI tools — act with shared context.
- Turn mission, vision, goals, and relationships into an operating memory that connects people, work, and outcomes.

## Vision

- Any tool or agent can answer why, who, how, and what depends on what — with evidence — across the company’s ecosystem, in real time.

## Positioning

- Relationships‑first memory (beyond RAG): a graph of entities, edges, and beliefs.
- Purpose‑centric: extract and stabilize mission/vision/goals; connect them to code, tickets, and docs.
- Explainable by design: every answer cites graph edges and supporting text.

## Guiding Principles

- Relationship first; retrieval second.
- Durable, real‑time, and explainable.
- Developer‑first, config‑driven, and interoperable.
- Privacy and tenancy by default.
- Evaluation‑backed decisions (quality, drift, latency).

## North‑Star Outcomes

- Time‑to‑context: seconds to “the why” behind any artifact.
- Graph coverage: % of artifacts linked to owners, dependencies, and goals.
- Answer quality: % multi‑hop questions answered with evidence.
- Onboarding compression: time saved to productive contributions.
- Agent success: task completion rate when powered by our memory.

---

## Table of Contents

- [Overview](#overview)
- [Purpose](#purpose)
- [Vision](#vision)
- [Positioning](#positioning)
- [Guiding Principles](#guiding-principles)
- [North‑Star Outcomes](#north-star-outcomes)
- [Architecture](#architecture)
  - [Storage Architecture](STORAGE_ARCHITECTURE.md)
  - [Architecture Diagram](STORAGE_ARCHITECTURE_DIAGRAM.md)
- [Knowledge Store](#knowledge-store)
  - [Design](KNOWLEDGE_STORE.md)
  - [Search & Retrieval](SEARCH_DESIGN.md)
- [Memory (Graph)](#memory-graph)
  - [Overview](memory/README.md)
  - [Graph Design](memory/GRAPH.md)
  - [SPEC (Research Mode)](memory/SPEC.md)
  - [Research: Belief & Intent](memory/RESEARCH_BELIEF_INTENT.md)
- [Sync & Ingestion](#sync--ingestion)
  - [Pipeline](SYNC_DESIGN.md)
- [Implementation Guides](#implementation-guides)
  - [Storage Implementation](STORAGE_IMPLEMENTATION_GUIDE.md)
- [Evaluation & Quality](#evaluation--quality)
  - [Evaluation Playbook](EVALUATION_PLAYBOOK.md)
  - [RAG Best Practices](rag-best-practices)
- [Roadmap](#roadmap)
  - [MVP Roadmap](MVP_ROADMAP.md)
- [Glossary](#glossary)

---

## Overview

- Vision: Make organizational intent (mission, vision, goals) computable and connect it to day‑to‑day outputs (code, issues, docs, conversations) via a first‑class Memory Graph.
- Two layers by design:
  - Knowledge Store: durable, chunked documents + hybrid retrieval (lexical + vector + optional rerank) for high recall and low latency.
  - Memory Graph: entities, typed relationships, and beliefs with provenance, confidence, and time. Enables multi‑hop reasoning and explainability.
- Connectors: GitHub, Linear, Notion, Slack (extensible) populate the Knowledge Store and seed the Memory Graph with deterministic edges; LLMs augment where helpful with confidence gating.

---

## Architecture

- Durable core: PlanetScale (MySQL) via Drizzle + S3 for raw artifacts; Redis for cache/queues.
- Indexing: chunk documents (200–400 tokens) and embed vectors in Pinecone (optionally sparse features).
- Retrieval: hybrid pipeline with optional reranking and graph‑aware bias for relationship queries.
- Observability: retrieval logs, feedback events, dashboards, and eval suites for continual quality monitoring.

See: STORAGE_ARCHITECTURE.md and STORAGE_ARCHITECTURE_DIAGRAM.md

---

## Knowledge Store

- Canonical tables: `knowledge_documents`, `knowledge_chunks`.
- Capabilities:
  - Deterministic versioning via `content_hash`.
  - Hybrid retrieval pipeline; identifier fast‑path.
  - Redis hydration cache for hot chunks/documents.
- Interfaces: `GET /api/knowledge/documents/:id`, `GET /api/knowledge/chunks`, `POST /api/knowledge/search` (supports `mode: 'knowledge' | 'graph' | 'hybrid'`).

See: KNOWLEDGE_STORE.md and SEARCH_DESIGN.md

---

## Memory (Graph)

- Core tables: `entities`, `entity_aliases`, `document_entities`, `relationships`, `relationship_evidence`, `beliefs`, `belief_links`.
- Relationship vocabulary (examples): AUTHORED_BY, OWNED_BY, MEMBER_OF, REFERENCES, RESOLVES, DUPLICATES, RELATES_TO, BLOCKED_BY, DEPENDS_ON, IMPLEMENTS, TOUCHES_COMPONENT, AFFECTS_METRIC, ALIGNS_WITH_GOAL.
- Beliefs: long‑lived mission/vision/principles/goals with corroboration rules and stability checks.
- Graph‑aware retrieval: traverse 1–2 hops for ownership/dependency/alignment questions; bias chunk ranking; include a concise “graph rationale” in responses.

See: memory/GRAPH.md

---

## Sync & Ingestion

- Flow: Source Event → Normalize → Persist (documents + chunks) → Upload artifacts (S3) → Embed + Index → Detect relationships → Prime caches → Emit eval events.
- Deterministic edges from connectors first; LLM‑assisted extraction adds candidates with confidence thresholds and evidence.
- Events: `knowledge.persisted`, `knowledge.embedding.requested`.

See: SYNC_DESIGN.md

---

## Implementation Guides

- Storage Implementation Guide covers:
  - Drizzle schema (PlanetScale MySQL) for Knowledge Store and Memory Graph.
  - Pinecone index setup and upsert helpers.
  - S3 and Redis utilities.

See: STORAGE_IMPLEMENTATION_GUIDE.md

---

## Evaluation & Quality

- Continuous evaluation with Braintrust.
- Metrics: recall@k, rerank calibration, snippet accuracy, latency splits; segmented by `retrieval_mode` (knowledge/graph/hybrid).
- Suites: smoke, regression (on `knowledge.persisted`), weekly benchmarks, source‑specific, and Graph QA (ownership/dependencies/alignment).

See: EVALUATION_PLAYBOOK.md and rag-best-practices

---

## Roadmap

- MVP milestones: schema and ingestion foundations → GitHub + embeddings → Slack + relationships → hybrid search + observability → evaluation + hardening → GA polish.

See: MVP_ROADMAP.md

---

## Glossary

- Knowledge Document: canonical, normalized representation of a source artifact (PR, issue, doc page, message, etc.).
- Knowledge Chunk: 200–400 token slice with overlap, indexed for retrieval.
- Memory Graph: entities, relationships, and beliefs with provenance and confidence.
- Entity: person/team/repo/service/component/project/customer/goal/etc.
- Relationship: typed edge (e.g., IMPLEMENTS, DEPENDS_ON) between entities and/or documents.
- Belief: mission/vision/principle/goal; long‑lived, consolidated from authoritative sources.
- Connector: integration that ingests events and data (GitHub/Linear/Notion/Slack).
- Workspace: multi‑tenant boundary spanning documents, entities, and indices.

---

## Reading Order (Suggested)

1) STORAGE_ARCHITECTURE.md → big picture and constraints
2) KNOWLEDGE_STORE.md → canonical document/chunk model and retrieval
3) memory/GRAPH.md → entities, relationships, beliefs, and traversal
4) SYNC_DESIGN.md → how data flows in and gets indexed
5) SEARCH_DESIGN.md → how queries are executed and answered
6) STORAGE_IMPLEMENTATION_GUIDE.md → code‑level helpers and config
7) EVALUATION_PLAYBOOK.md → how we measure and guard quality
