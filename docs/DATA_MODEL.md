# Data Model — Neural Memory ERD

Last Updated: 2025-10-28

This document captures the canonical data model for Lightfast’s Neural Memory stack. It includes Knowledge (documents/chunks), Neural Memory (observations/summaries/profiles), and Graph (entities/relationships), plus embedding/version metadata and retrieval‑relevant indexes.

---

## Mermaid ERD (Conceptual)

```mermaid
erDiagram
  %% Short names used for GitHub Mermaid compatibility
  WS ||--o{ DOC : has
  WS ||--o{ CHUNK : has
  WS ||--o{ OBS : has
  WS ||--o{ SUM : has
  WS ||--o{ PROF : has
  WS ||--o{ ENT : has
  ENT ||--o{ ALIAS : has
  DOC ||--o{ CHUNK : contains
  DOC ||--o{ DOC_ENT : links
  ENT ||--o{ DOC_ENT : linked
  REL ||--o{ REL_EVID : supportedBy
  ENT ||--o{ REL : from
  ENT ||--o{ REL : to
  DOC ||--o{ REL_EVID : cites
  CHUNK ||--o{ REL_EVID : cites
  OBS ||--o{ REL_EVID : cites

  %% Mapping:
  %% WS=WORKSPACES, DOC=KNOWLEDGE_DOCUMENTS, CHUNK=KNOWLEDGE_CHUNKS,
  %% OBS=MEMORY_OBSERVATIONS, SUM=MEMORY_SUMMARIES, PROF=MEMORY_PROFILES,
  %% ENT=ENTITIES, ALIAS=ENTITY_ALIASES, DOC_ENT=DOCUMENT_ENTITIES,
  %% REL=RELATIONSHIPS, REL_EVID=RELATIONSHIP_EVIDENCE

  WORKSPACES {
    string id PK
    string name
  }

  KNOWLEDGE_DOCUMENTS {
    string id PK
    string workspaceId FK
    string organizationId
    string source
    string sourceId
    string type
    string title
    string summary
    string state
    string rawPointer
    string contentHash
    json   metadataJson
    json   authorJson
    datetime occurredAt
    datetime createdAt
    datetime updatedAt
    int    version
    json   lineageJson
  }

  KNOWLEDGE_CHUNKS {
    string id PK
    string documentId FK
    string workspaceId
    int    chunkIndex
    text   text
    int    tokenCount
    string sectionLabel
    string embeddingModel
    string embeddingVersion
    string chunkHash
    json   keywords
    json   sparseVector
    datetime occurredAt
    datetime createdAt
    datetime supersededAt
  }

  MEMORY_OBSERVATIONS {
    string id PK
    string workspaceId FK
    string documentId FK
    text   text
    text   title
    text   summary
    datetime occurredAt
    float  importance
    json   tags
    json   subjectRefs
    string embeddingModel
    string embeddingVersion
    string privacy
    string contentHash
    datetime createdAt
  }

  MEMORY_SUMMARIES {
    string id PK
    string workspaceId FK
    json   windowJson
    text   text
    string embeddingModel
    string embeddingVersion
    json   coverageJson
    datetime createdAt
  }

  MEMORY_PROFILES {
    string id PK
    string workspaceId FK
    string entityId FK
    json   centroidsJson
    json   descriptors
    float  drift
    datetime lastRebuiltAt
  }

  ENTITIES {
    string id PK
    string workspaceId FK
    string kind
    string name
    datetime createdAt
  }

  ENTITY_ALIASES {
    string id PK
    string entityId FK
    string aliasType
    string value
    int    verified
  }

  DOCUMENT_ENTITIES {
    string id PK
    string documentId FK
    string entityId FK
    string role  // mention|owner|author|assignee|component
    json   evidence // chunkId(s) or span info
  }

  RELATIONSHIPS {
    string id PK
    string workspaceId FK
    string type
    string fromId FK
    string toId FK
    float  confidence
    datetime since
    datetime until
    datetime createdAt
  }

  RELATIONSHIP_EVIDENCE {
    string id PK
    string relationshipId FK
    string documentId FK
    string chunkId FK
    string observationId FK
    float  weight
  }

  EMBEDDING_VERSIONS {
    string name PK
    string provider
    int    dim
    string compression  // float32|int8|binary
    string status       // active|canary|archived
    datetime createdAt
  }
```

---

## Keys & Indexes (Recommended)

- knowledge_documents
  - UNIQUE (workspaceId, source, sourceId)
  - INDEX (workspaceId, occurredAt)
- knowledge_chunks
  - INDEX (documentId)
  - INDEX (workspaceId, chunkHash)
  - INDEX (workspaceId, occurredAt)
- memory_observations
  - INDEX (workspaceId, occurredAt)
  - UNIQUE (workspaceId, contentHash)
- memory_summaries
  - INDEX (workspaceId, createdAt)
- memory_profiles
  - UNIQUE (workspaceId, entityId)
- entities
  - INDEX (workspaceId, kind)
- entity_aliases
  - UNIQUE (workspaceId, aliasType, value)
- document_entities
  - INDEX (documentId), INDEX (entityId)
- relationships
  - INDEX (workspaceId, type)
- relationship_evidence
  - INDEX (relationshipId)
- embedding_versions
  - PRIMARY (name)

All tables are workspace‑scoped for isolation and auditability.

---

## Vector Index Families (Pinecone)

- chunks → `lightfast-chunks`
- observations → `lightfast-observations`
- summaries → `lightfast-summaries`
- profiles → `lightfast-profiles`

Namespace: `${workspaceId}-${embeddingVersion}`.

Metadata budget: keep under ~1 KB; store heavy fields in PlanetScale and reference IDs in vectors.

---

## ID & Naming Conventions

- IDs: URL‑safe 26–40 char strings (e.g., NanoID/KSUID) for app PKs.
- Timestamps: UTC, `occurredAt` denotes source event time; `createdAt` denotes persistence.
- Hashes: `contentHash` (document/observation) and `chunkHash` (chunk) are deterministic to support idempotency.
- Privacy: `privacy` on observations defaults to `org`; override for DMs or restricted scopes.

---

## PII & Privacy Notes

- Observations may contain personal data (names, emails, handles). Redact on write when configured.
- DM/Private channels default to `privacy = private`; never exposed across workspaces.
- Provide “forget/export” paths per workspace policy.

---

## Relationships & Rationale

- `document_entities`, `relationships`, and `relationship_evidence` enable explainability in retrieval.
- Retrieval attaches a compact “graph rationale” when biasing affected ranking.

---

## References

- docs/STORAGE_IMPLEMENTATION_GUIDE.md
- docs/SYNC_DESIGN.md
- docs/SEARCH_DESIGN.md
- docs/memory/GRAPH.md
