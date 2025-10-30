---
title: Graph Rationale & Signals
description: Entities and relationships for explainability and bounded graph bias
status: working
owner: platform-architecture
audience: engineering
last_updated: 2025-10-28
tags: [graph]
---

# Graph Rationale & Signals

Last Updated: 2025-10-28

This document focuses on the explicit structure that augments neural retrieval: entities and relationships that provide explainability and bounded bias. It complements Knowledge (chunks) and Neural Memory (observations/summaries/profiles).

---

## Executive Summary

- Entities (people, teams, repos, services, components, projects, customers, goals) and typed relationships (OWNED_BY, DEPENDS_ON, RESOLVES, ALIGNS_WITH_GOAL, etc.) provide explainability and short-hop traversal.
- Deterministic edges from connectors come first; LLM-assisted extraction may propose edges with confidence and evidence; never overwrite deterministic truth.
- Retrieval uses bounded traversal (1–2 hops) for graph bias and returns a concise rationale with evidence links.

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

Beliefs/intent are not a privileged data type; they appear within summaries and descriptors.

---

## Storage (sketch)

- Tables: `entities`, `entity_aliases`, `document_entities`, `relationships`, `relationship_evidence`.
- Temporal: edges carry `since`/`until`.
- RLS: workspace‑scoped; provenance and confidence required for writes.

---

## Ingestion

1) Deterministic (high precision)
- GitHub: AUTHORED_BY, RESOLVES, IMPLEMENTS (smart links), TOUCHES_COMPONENT, OWNED_BY (CODEOWNERS).
- Linear: BLOCKED_BY/RELATES_TO/DUPLICATES, PART_OF, ASSIGNED_TO.
- Notion: AUTHOR (Page → Person), ALIGNS_WITH_GOAL (db/tags).

2) LLM‑assisted (recall/semantics)
- Extract missing entities; propose edges with evidence spans and confidence.
- Gates: accept ≥0.80; review 0.60–0.79; discard <0.60; deterministic precedence.

---

## Identity Integration

- Person entities represent humans; provider accounts attach via `entity_aliases`.
- Multi-signal deterministic resolution (provider_user_id → verified email → alias set).
- See `../identity.md`.

## Graph‑Aware Retrieval

1) Classification
- Ownership/dependency/alignment → hybrid with graph bias.

2) Traversal
- Seed from query entities or top candidates; expand 1–2 hops with allowlists per intent (OWNED_BY/MEMBER_OF; DEPENDS_ON/BLOCKED_BY/RESOLVES; ALIGNS_WITH_GOAL).

3) Fusion and rationale
- Boost candidates linked to traversed entities/edges; rerank; include a compact rationale (entities, edges, evidence links).

---

## APIs (sketch)

- upsertEntity, upsertRelationship (with evidence), traverseNeighborhood.

---

## Evaluation

- Relationship precision/recall by type; target ≥95% deterministic, ≥85% LLM‑assisted after review.
- Graph QA: ownership, dependency, alignment with rationale faithfulness.
- Metrics logged in retrieval logs with graph‑specific fields.

---

## Rollout

- Phase 0: Schema + deterministic edges
- Phase 1: Redis adjacency + rationale surfaces
- Phase 2: LLM-assisted proposals + adjudication
- Phase 3: Graph‑aware bias in retrieval
- Phase 4: Quality loop + drift/alerting

See `./spec.md` for flags and criteria.

---

## References

- ../../architecture/storage/implementation-guide.md (schema/caching)
- ../ingestion/sync-design.md (ingestion)
- ../retrieval/search-design.md (retrieval)
- ../../operations/evaluation-playbook.md (evaluation)
