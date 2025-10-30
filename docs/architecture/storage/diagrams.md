---
title: Storage Architecture Visual Summary
description: ASCII and Mermaid diagrams for the storage and retrieval pathways
status: working
owner: platform-storage
audience: engineering
last_updated: 2025-10-28
tags: [storage, diagrams]
---

# Storage Architecture Visual Summary

Last Updated: 2025-10-28

## Target Architecture (Neural Memory)

```
                               ┌───────────────────────────────┐
                               │        Source Systems         │
                               │ GitHub ▪ Linear ▪ Slack ▪ ... │
                               └──────────────┬────────────────┘
                                              │
                                      Ingestion Orchestrator
                                        (Inngest + Workers)
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                 Normalized Doc + Chunks                Observation Drafts
                         │                                         │
                         ▼                                         ▼
                ┌──────────────────┐                        ┌──────────────────┐
                │ PlanetScale      │                        │ PlanetScale      │
                │ knowledge_*      │                        │ memory_observations│
                └────────┬─────────┘                        └────────┬─────────┘
                         │                                          │
                         │                                          │
                ┌────────▼──────────┐                      ┌─────────▼──────────┐
                │ Object Storage    │                      │ Consolidation Jobs │
                │ (S3 raw bodies)   │                      │ summaries ▪ profiles│
                └────────┬──────────┘                      └─────────┬──────────┘
                         │                                          │
                ┌────────▼──────────┐                      ┌─────────▼──────────┐
                │ Embedding Pipeline│                      │ Embedding Pipeline │
                │ (Cohere, versions)│                      │   (multi‑view)     │
                └────────┬──────────┘                      └─────────┬──────────┘
                         │                                          │
                ┌────────▼──────────┐                      ┌─────────▼──────────┐
                │ Pinecone: chunks  │                      │ Pinecone: obs/sum/ │
                │ namespace per ws  │                      │ profiles namespaces │
                └────────┬──────────┘                      └─────────┬──────────┘
                         │                                          │
                ┌────────▼──────────┐                      ┌─────────▼──────────┐
                │ Redis Caches      │◄───────┐     ┌──────►│ Redis Caches      │
                │ docs/chunks (TTL) │        │     │       │ obs/sum profiles  │
                └────────┬──────────┘        │     │       └─────────┬──────────┘
                         │                   │     │                 │
                         │                   │     │                 │
                ┌────────▼───────────────────▼─────▼─────────────────▼──────────┐
                │                   Retrieval Router (Service)                   │
                │   knowledge | neural | hybrid • graph bias (1–2 hops)         │
                │   fusion + rerank • rationale • hydration • logging            │
                └────────┬──────────────────────────────────────────────────────┘
                         │
                ┌────────▼───────────┐
                │ Public API (v1)    │
                │ search | contents  │
                │ similar | answer   │
                └────────────────────┘
```

---

## Mermaid (alternate view)

```mermaid
flowchart TB
  subgraph Sources
    A[GitHub] --- B[Linear] --- C[Slack] --- D[Notion]
  end
  A --> E[Ingestion Orchestrator]
  B --> E
  C --> E
  D --> E
  E --> F[PlanetScale: knowledge_*]
  E --> G[PlanetScale: memory_observations]
  F --> H[S3 Raw Bodies]
  G --> I[Consolidation Jobs]
  I --> J[PlanetScale: memory_summaries / memory_profiles]
  F --> K[Embed + Index: Pinecone chunks]
  G --> L[Embed + Index: Pinecone observations]
  J --> M[Embed + Index: Pinecone summaries/profiles]
  subgraph Caches
    N[Redis: docs/chunks] --- O[Redis: obs/summaries] --- P[Redis: graph adjacency]
  end
  K --> Q[Retrieval Router]
  L --> Q
  M --> Q
  P --> Q
  Q --> R[API v1: search / contents / similar / answer]
```

---

Every answer cites evidence (chunks/observations) and, when graph influenced, includes a compact rationale of entities and edges.
