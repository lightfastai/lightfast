# Memory Graph Design (Relationships‑First Memory)

Last Updated: 2025-10-27

This document defines Lightfast’s graph‑native Memory layer: durable entities, typed relationships, and long‑lived beliefs with provenance. It complements the Knowledge Store and enables explainable, multi‑hop answers to “who/why/depends” questions.

---

## Executive Summary

- Durable core remains: PlanetScale/Postgres + S3; Redis for cache/queues; Pinecone for vectors (hybrid retrieval).
- Add Memory Graph: entities (people, repos, services, components, projects, customers, goals), typed relationships (AUTHORED_BY, OWNED_BY, DEPENDS_ON, RESOLVES, ALIGNS_WITH_GOAL, etc.), and beliefs (mission, vision, principles, goals) with provenance, confidence, and time.
- Populate deterministic edges from connectors first; augment with LLM extraction under confidence gating (never overwrite deterministic truth).
- Expose graph‑aware retrieval: traverse 1–2 hops to seed and boost chunk retrieval; include a short “graph rationale” in answers with links to evidence.

Outcomes: explainable answers, multi‑hop reasoning, and traceable links from purpose → projects → code → customers.

---

## Ontology

### Entities (canonical, extendable)
- person, team, organization
- repo, service, component, file
- project, ticket, issue, pull_request
- doc, page, meeting, spec
- customer, account, opportunity
- goal, metric, experiment, release

### Relationships (edge vocabulary)
Each edge has: `type`, `from`, `to`, `confidence`, `detectedBy` (rule|llm|manual), `since`, `until`, and evidence refs.
- AUTHORED_BY: (pull_request|issue|doc|page|ticket|commit) → person
- OWNED_BY: (repo|service|component|project|doc) → (team|person)
- MEMBER_OF: person → team
- REFERENCES: (doc|page|issue|pr|ticket|message) → (doc|issue|pr|ticket|repo)
- RESOLVES: pr → issue|ticket
- DUPLICATES: issue|ticket ↔ issue|ticket
- RELATES_TO: artifact ↔ artifact
- BLOCKED_BY: (ticket|pr) → (ticket|pr)
- DEPENDS_ON: (service|component|project) → (service|component|project)
- IMPLEMENTS: pr|commit → (ticket|spec)
- TOUCHES_COMPONENT: pr|commit → component
- AFFECTS_METRIC: (pr|release|experiment) → metric
- ALIGNS_WITH_GOAL: (project|ticket|doc|page) → goal

### Beliefs
- Types: mission, vision, principle, policy, goal, theme
- Consolidated from authoritative sources; status: active|superseded; revisions tracked with evidence and reasons.

---

## Storage (sketch)

- Tables: `entities`, `entity_aliases`, `document_entities`, `relationships`, `relationship_evidence`, `beliefs`, `belief_links`.
- Temporal: edges carry `since`/`until`; beliefs have revisions and status.
- RLS: all tables workspace‑scoped; provenance and confidence required for writes.
- See `docs/STORAGE_IMPLEMENTATION_GUIDE.md` for DDL patterns and caching.

---

## Ingestion

1) Deterministic (high precision)
- GitHub: AUTHORED_BY, RESOLVES (linked issues), IMPLEMENTS (Linear smart links), TOUCHES_COMPONENT (paths → component map), OWNED_BY (CODEOWNERS).
- Linear: BLOCKED_BY/RELATES_TO/DUPLICATES, PART_OF (Project), ASSIGNED_TO (Person).
- Notion: AUTHOR (Page → Person), ALIGNS_WITH_GOAL (tags/db), draft beliefs from mission/vision/principle pages.

2) LLM‑assisted (recall/semantics)
- Extract missing entities; propose edges with evidence spans and confidence.
- Gating: accept ≥0.80; review 0.60–0.79; discard <0.60. Never overwrite deterministic edges.

3) Belief consolidation
- Aggregate from authoritative sources; elevate to active when corroborated by ≥2 sources and stable ≥14 days; supersede prior with audit trail.

---

## Identity Integration

- Person entities represent humans within a workspace; provider accounts (GitHub/Slack/Linear/Notion/SSO) attach via `entity_aliases`.
- Deterministic resolution maps connector events to the correct Person (provider_user_id → verified email → multi‑signal).
- See `docs/IDENTITY_DESIGN.md` for auth user vs Person mapping, schema, and APIs.

## Graph‑Aware Retrieval

1) Classification
- Ownership/dependency/alignment → graph‑first (traverse, then hydrate chunks).
- General semantic → hybrid retrieval with graph bias for nearby entities.

2) Traversal
- Seed from query terms via alias resolution or top fused candidates; expand 1–2 hops with edge whitelists per intent (e.g., ownership: OWNED_BY/MEMBER_OF; dependency: DEPENDS_ON/BLOCKED_BY/RESOLVES).

3) Fusion and prompt
- Boost candidate chunks whose `documentId` is within N hops; rerank; include a “graph rationale” listing entities/edges and evidence links.

---

## APIs (sketch)

- upsertEntity, upsertRelationship (with optional evidence), traverseNeighborhood.
- Belief endpoints for consolidation; optional Intent endpoints if enabled (see SPEC).

---

## Evaluation

- Relationship precision/recall by type; target ≥95% deterministic, ≥85% LLM‑assisted after review.
- Belief stability: weekly churn <5%; revision correctness.
- Graph QA: ownership, dependency, alignment with rationale faithfulness.
- Metrics logged in retrieval logs with graph‑specific fields.

---

## Rollout

- Phase 0: Schema foundation and backfill deterministic edges for GitHub/Linear.
- Phase 1: Deterministic graph, Redis adjacency, and “Why” evidence surfaces.
- Phase 2: Beliefs extraction and consolidation; belief cards.
- Phase 3: Graph‑aware retrieval bias for ownership/dependency.
- Phase 4: Quality loop, adjudication UI, drift/alerting.

See `docs/memory/SPEC.md` for research‑mode flags and promotion criteria.

---

## References

- docs/STORAGE_IMPLEMENTATION_GUIDE.md (Schema, Caching, Pinecone)
- docs/SYNC_DESIGN.md (Ingestion, Relationship Detection)
- docs/SEARCH_DESIGN.md (Pipeline, Rerank, Hydration)
- docs/EVALUATION_PLAYBOOK.md (Suites, Metrics, Calibration)
