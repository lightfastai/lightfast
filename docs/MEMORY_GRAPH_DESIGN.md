# Memory Graph Design (Relationships‑First Memory)

Last Updated: 2025-10-27

> This document specifies a graph‑native memory layer for Lightfast that elevates “memory” beyond chunked retrieval (RAG) by introducing durable entities, typed relationships, and long‑lived beliefs with provenance. It builds on the existing storage, sync, and search designs without disrupting them.

---

## Executive Summary

- Keep the current durable core (PlanetScale + S3), hybrid retrieval (lexical + Pinecone + rerank), and caching (Redis) as-is.
- Add a Memory Graph: entities (people, repos, projects, customers, components), typed relationships (AUTHORED_BY, DEPENDS_ON, ALIGNS_WITH_GOAL, etc.), and beliefs (mission, vision, principles, goals) with provenance and confidence.
- Populate relationships deterministically from connectors first; augment with LLM extraction under confidence gating. Consolidate beliefs from authoritative sources (Notion/handbook/briefs) with stability checks.
- Expose graph‑aware retrieval: graph traversal seeds and boosts chunk retrieval; answer composition includes “why” via graph evidence.

Outcomes: explainable answers, multi‑hop “who/why/depends” queries, and end‑to‑end links from purpose → projects → code → customers.

---

## Ontology

### Entities

`entity.type` canonical values (extendable):

- person, team, organization
- repo, service, component, file
- project, ticket, issue, pull_request
- doc, page, meeting, spec
- customer, account, opportunity
- goal, metric, experiment, release

### Relationships (edge vocabulary)

Each edge has: `type`, `from`, `to`, `confidence`, `detectedBy`, `since`, `until` and evidence references.

- AUTHORED_BY: (pull_request|issue|doc|page|ticket|commit) → person
- OWNED_BY: (repo|service|component|project|doc) → (team|person)
- MEMBER_OF: person → team
- REFERENCES: (doc|page|issue|pr|ticket|message) → (doc|issue|pr|ticket|repo)
- RESOLVES: pr → issue|ticket
- DUPLICATES: issue|ticket → issue|ticket (symmetric)
- RELATES_TO: any artifact ↔ artifact (symmetric)
- BLOCKED_BY: (ticket|pr) → (ticket|pr)
- DEPENDS_ON: (service|component|project) → (service|component|project)
- IMPLEMENTS: pr|commit → (ticket|spec)
- TOUCHES_COMPONENT: pr|commit → component
- AFFECTS_METRIC: (pr|release|experiment) → metric
- ALIGNS_WITH_GOAL: (project|ticket|doc|page) → goal

Deterministic edges use structured API fields or explicit references (e.g., PR ↔ Issue link, CODEOWNERS, Linear relations). LLM‑derived edges supplement with confidence gating and evidence.

### Beliefs

Long‑lived, consolidated statements with stability and provenance:

- mission, vision, principle, policy, goal, theme

Beliefs link to entities via `belief_links` (e.g., GOAL constrains Project/Team; PRINCIPLE informs Component).

---

## PlanetScale Schema (proposed)

> Assumes the Knowledge Store uses `knowledge_documents` and `knowledge_chunks`. The Memory Graph stores relationships independently in `relationships` and links documents to entities.

```sql
-- Core entities
CREATE TABLE entities (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  type            varchar(32) NOT NULL,
  source          varchar(20) NOT NULL,
  source_id       varchar(128) NULL,
  name            varchar(255) NOT NULL,
  metadata_json   json NOT NULL,
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ws_type_source (workspace_id, type, source, source_id)
);

CREATE TABLE entity_aliases (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  entity_id       varchar(40) NOT NULL,
  alias_type      varchar(32) NOT NULL, -- email|github|slack|domain|repo_url|canonical_name
  value           varchar(255) NOT NULL,
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ws_alias (workspace_id, alias_type, value),
  INDEX idx_alias_entity (entity_id)
);

-- Link knowledge documents to entities with roles discovered during ingestion
CREATE TABLE document_entities (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  document_id     varchar(40) NOT NULL,
  entity_id       varchar(40) NOT NULL,
  role            varchar(32) NOT NULL, -- author|mentioned|owner|repo|service|component|customer
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_de_document (workspace_id, document_id),
  INDEX idx_de_entity (workspace_id, entity_id)
);

-- Generalized relationships between refs (entity or document)
CREATE TABLE relationships (
  id                varchar(40) PRIMARY KEY,
  workspace_id      varchar(40) NOT NULL,
  from_kind         varchar(16) NOT NULL, -- entity|document
  from_id           varchar(40) NOT NULL,
  to_kind           varchar(16) NOT NULL, -- entity|document
  to_id             varchar(40) NOT NULL,
  relationship_type varchar(32) NOT NULL,
  confidence        decimal(4,3) NOT NULL,
  detected_by       varchar(16) NOT NULL, -- rule|llm|manual
  since             timestamp NULL,
  until             timestamp NULL,
  created_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_edge (
    workspace_id, from_kind, from_id, to_kind, to_id, relationship_type
  ),
  INDEX idx_rel_outbound (workspace_id, from_id, relationship_type),
  INDEX idx_rel_inbound (workspace_id, to_id, relationship_type)
);

-- Evidence that supports an edge
CREATE TABLE relationship_evidence (
  id                varchar(40) PRIMARY KEY,
  workspace_id      varchar(40) NOT NULL,
  relationship_id   varchar(40) NOT NULL,
  document_id       varchar(40) NOT NULL,
  chunk_id          varchar(40) NULL,
  evidence_type     varchar(24) NOT NULL, -- link|text_span|api_field
  offset_start      int NULL,
  offset_end        int NULL,
  confidence        decimal(4,3) NOT NULL,
  created_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ev_rel (workspace_id, relationship_id),
  INDEX idx_ev_doc (workspace_id, document_id)
);

-- Consolidated beliefs (mission/vision/principles/goals)
CREATE TABLE beliefs (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  belief_type     varchar(24) NOT NULL, -- mission|vision|principle|policy|goal|theme
  text            mediumtext NOT NULL,
  source_document_id varchar(40) NULL,
  confidence      decimal(4,3) NOT NULL,
  status          varchar(16) NOT NULL, -- active|superseded
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_belief_ws_type (workspace_id, belief_type, status)
);

CREATE TABLE belief_links (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  belief_id       varchar(40) NOT NULL,
  entity_id       varchar(40) NOT NULL,
  link_type       varchar(24) NOT NULL, -- ALIGNS_WITH|CONSTRAINS|INFORMED_BY
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_belief_link (workspace_id, belief_id),
  INDEX idx_belief_entity (workspace_id, entity_id)
);
```

RLS: enforce workspace scoping on all tables (see `docs/STORAGE_IMPLEMENTATION_GUIDE.md`).

---

## TypeScript Interfaces

```typescript
type RefKind = 'entity' | 'memory';

interface EntityRecord {
  id: string;
  workspaceId: string;
  type: string;
  source: string;
  sourceId?: string | null;
  name: string;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface RelationshipRecord {
  id: string;
  workspaceId: string;
  fromKind: RefKind;
  fromId: string;
  toKind: RefKind;
  toId: string;
  relationshipType: string;
  confidence: number; // 0..1
  detectedBy: 'rule' | 'llm' | 'manual';
  since?: Date | null;
  until?: Date | null;
  createdAt: Date;
}

interface RelationshipEvidenceRecord {
  id: string;
  workspaceId: string;
  relationshipId: string;
  documentId: string;
  chunkId?: string | null;
  evidenceType: 'link' | 'text_span' | 'api_field';
  offsetStart?: number | null;
  offsetEnd?: number | null;
  confidence: number;
  createdAt: Date;
}

interface BeliefRecord {
  id: string;
  workspaceId: string;
  beliefType: 'mission' | 'vision' | 'principle' | 'policy' | 'goal' | 'theme';
  text: string;
  sourceDocumentId?: string | null;
  confidence: number;
  status: 'active' | 'superseded';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Ingestion Extensions

Hook into `detectRelationships` (see `docs/SYNC_DESIGN.md`) and expand to:

1) Deterministic entity/edge extraction (high precision)

- GitHub
  - Person ←AUTHORED_BY— PR/Issue/Commit (from API fields)
  - PR —RESOLVES→ Issue (linked issues)
  - PR —IMPLEMENTS→ Ticket (cross‑links via Linear smart links)
  - PR/Commit —TOUCHES_COMPONENT→ Component (file path → component map)
  - Repo/Service —OWNED_BY→ Team (CODEOWNERS + directory/team mapping)

- Linear
  - Ticket —BLOCKED_BY/RELATES_TO/DUPLICATES→ Ticket (native relations)
  - Ticket —PART_OF→ Project
  - Ticket —ASSIGNED_TO→ Person

- Notion
  - Page —AUTHOR→ Person, Page —ALIGNS_WITH_GOAL→ Goal (tags/database)
  - Pages titled/typed mission/vision/principles → Belief drafts

2) LLM‑assisted extraction (recall/semantics)

- For each memory, run an extractor over normalized text:
  - Detect entities not created deterministically (components, features).
  - Propose edges with `relationship_type`, `confidence`, and evidence spans.
  - Gate: accept ≥0.80, queue review 0.60–0.79, discard <0.60.
  - Never overwrite deterministic edges; only add or increase confidence.

3) Belief consolidation

- Aggregate candidate beliefs from authoritative sources (Notion/handbook, strategy docs, kickoff decks).
- Elevate to `beliefs.status = 'active'` when corroborated by ≥2 sources and stable ≥14 days.
- Supersede prior beliefs of same `belief_type` when newer is higher confidence and corroborated.

---

## Extraction Prompts (LLM)

Use JSON‑only outputs. Include snippet character offsets from the provided text when `evidenceType = 'text_span'`.

### Entities + Relationships

System prompt (excerpt):

```
You extract entities and relationships from technical artifacts. 
Only use the allowed entity types and relationship types provided. 
Return strict JSON and include evidence spans when possible. Do not infer beyond the text.
```

User/tools context: supply allowed types, current workspace aliases (emails, handles, repo URLs), and normalized text.

Response JSON schema:

```json
{
  "entities": [
    { "name": "Lightfast API", "type": "service", "aliases": ["/services/api"] }
  ],
  "relationships": [
    {
      "from": { "name": "Lightfast API", "type": "service" },
      "to": { "name": "Auth Service", "type": "service" },
      "type": "DEPENDS_ON",
      "confidence": 0.86,
      "evidence": { "kind": "text_span", "offsetStart": 120, "offsetEnd": 188 }
    }
  ]
}
```

### Beliefs (mission/vision/principles/goals)

System prompt (excerpt):

```
Extract stable beliefs (mission, vision, principles, goals) stated or implied by the text. 
Prefer explicit statements. Summarize concisely. Include a confidence and whether it supersedes an older belief if clearly stated.
```

Response JSON schema:

```json
{
  "beliefs": [
    { "type": "mission", "text": "Help teams build knowledge-driven software faster.", "confidence": 0.84 }
  ]
}
```

---

## Graph‑Aware Retrieval

1) Query classification

- Ownership/dependency questions route to graph traversal first, then hydrate supporting chunks.
- General semantic queries use hybrid retrieval but apply graph bias: boost candidates whose `documentId` is within N hops of relevant entities.

2) Traversal

- Seed: resolve entities from query terms (via aliases) or detect from top fused candidates.
- Expand 1–2 hops by type with edge whitelist per intent (e.g., ownership: OWNED_BY/MEMBER_OF; dependency: DEPENDS_ON/BLOCKED_BY/RESOLVES).
- Collect memory IDs from adjacent nodes and increase their candidate scores by `graphBoost`.

3) Prompt assembly

- Add a short “graph rationale” section listing entities/edges used, with links to evidence.

---

## Helper APIs (sketch)

```typescript
export async function upsertEntity(input: {
  workspaceId: string;
  type: string;
  name: string;
  source?: string;
  sourceId?: string;
  aliases?: { aliasType: string; value: string }[];
  metadata?: Record<string, unknown>;
}): Promise<EntityRecord> { /* … */ }

export async function upsertRelationship(input: {
  workspaceId: string;
  from: { kind: 'entity' | 'document'; id: string };
  to: { kind: 'entity' | 'document'; id: string };
  relationshipType: string;
  confidence: number;
  detectedBy: 'rule' | 'llm' | 'manual';
  evidence?: {
    documentId: string; chunkId?: string; kind: 'link' | 'text_span' | 'api_field';
    offsetStart?: number; offsetEnd?: number; confidence?: number;
  }[];
}): Promise<RelationshipRecord> { /* … */ }

export async function traverseNeighborhood(params: {
  workspaceId: string;
  seeds: { kind: 'entity' | 'document'; id: string }[];
  hopLimit: number;
  allowedTypes?: string[];
}): Promise<{ nodes: string[]; edges: RelationshipRecord[]; documentIds: string[] }> { /* … */ }
```

Redis adjacency cache keys:

- `graph:out:{workspaceId}:{refKind}:{id}` → list of edges
- `graph:in:{workspaceId}:{refKind}:{id}` → list of edges

---

## Evaluation Additions

- Relationship precision/recall by type: target ≥95% precision for deterministic; ≥85% for LLM‑assisted under review.
- Belief stability: weekly churn <5%; alert on unexpected supersessions.
- Graph QA suites (extend `docs/EVALUATION_PLAYBOOK.md`):
  - Ownership: “Who owns component X?”
  - Dependency: “What depends on service Y?”
  - Alignment: “How does project Z align with our goals?”

Metrics wired into `retrieval_logs` and `feedback_events` with graph‑specific fields (edges considered, boosts applied).

---

## Rollout Plan

Phase 0 — Schema foundation
- Create `entities`, `entity_aliases`, `memory_entities`, `relationships`, `relationship_evidence`, `beliefs`, `belief_links`.
- Backfill deterministic entities/edges for GitHub and Linear.

Phase 1 — Deterministic graph
- Implement connector mappers; populate Redis adjacency; expose “Why” evidence in UI.

Phase 2 — Beliefs
- Extract mission/vision/principles/goals from Notion/handbook; consolidate and surface belief cards.

Phase 3 — Graph‑aware retrieval
- Add graph bias in candidate fusion and simple typed traversals for ownership/dependency queries.

Phase 4 — Quality loop
- Add graph QA suites, adjudication UI for low‑confidence edges, drift/alerting.

---

## Governance & Multi‑Tenant

- All tables carry `workspace_id` and follow RLS. S3 prefixes and Pinecone namespaces already embed workspace IDs.
- Edges and beliefs retain provenance (memory IDs, chunk spans) to enable audits and explainability.

---

## Open Questions / Future Work

- Graph index: mirror to Neo4j/TypeDB if traversal load grows; PlanetScale remains source of truth.
- User curation: approvals for low‑confidence edges; bulk edit tools.
- Personalization: re‑rank edges using per‑user interaction data.
- Temporal reasoning: time‑sliced traversals using `since`/`until` for “as‑of” answers.

---

## References

- docs/STORAGE_ARCHITECTURE.md (Durability, Observability)
- docs/STORAGE_IMPLEMENTATION_GUIDE.md (Schema, Caching, Pinecone)
- docs/SYNC_DESIGN.md (Ingestion, Relationship Detection)
- docs/SEARCH_DESIGN.md (Pipeline, Rerank, Hydration)
- docs/EVALUATION_PLAYBOOK.md (Suites, Metrics, Calibration)
