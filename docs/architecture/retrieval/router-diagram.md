---
title: Retrieval Router Internals
description: Flow, classification, knobs, logging fields, and fallbacks
status: working
owner: platform-search
audience: engineering
last_updated: 2025-10-28
tags: [retrieval]
---

# Retrieval Router Internals

Last Updated: 2025-10-28

This diagram set details the internal flow of the retrieval router: classification, parallel candidate generation (knowledge + neural), bounded graph bias, fusion/scoring, rerank, gating, and hydration — with latency budgets and tunable knobs.

---

## ASCII Overview

```
User Query
   │
   ▼
┌───────────────┐    Heuristics + Signals
│ Query Process │──────────────────────────────────────────────────────────────┐
│  • strip syntax│  • identifiers (#123, repo:path) → knowledge                │
│  • build filters│ • intent (ownership/dep/align) → hybrid + graph bias       │
│  • embed (views)│ • recency/"what happened" → neural or hybrid               │
└───────┬────────┘  • ambiguous → hybrid with budgets                           │
        │ routerMode: knowledge | neural | hybrid                               │
        ▼
┌──────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│ Knowledge Candidates (chunks)            │         │ Neural Candidates (observations/summary) │
│ • Lexical (FTS/Meili)  ≤30ms             │         │ • Dense (multi‑view) ≤40ms                │
│ • Dense (Pinecone)     ≤40ms             │         │ • Profiles (centroids sim) ≤10ms          │
└──────────┬───────────────────────────────┘         └──────────┬───────────────────────────────┘
           │                                        seeds       │
           └───────────────┬─────────────────────────┬──────────┘
                           │                         │
                           ▼                         ▼
                   ┌──────────────────────────────────────────────┐
                   │ Bounded Graph Bias (≤15ms)                    │
                   │ • resolve entities (aliases)                   │
                   │ • traverse hops=1–2 (allowlists)              │
                   │ • boost linked candidates (confidence, hop)   │
                   └───────────┬────────────────────────────────────┘
                               │
                               ▼
                   ┌──────────────────────────────────────────────┐
                   │ Fusion & Scoring (≤5ms)                      │
                   │ score = wv*vector + wl*lexical +             │
                   │         wg*graph + wr*recency +              │
                   │         wi*importance + wp*profile           │
                   └───────────┬────────────────────────────────────┘
                               │   if K ≥ RERANK_MIN_K and allowed
                               ▼
                   ┌──────────────────────────────────────────────┐
                   │ Cross‑Encoder Rerank (≤30ms)                 │
                   │ • topK_fused → topN                          │
                   │ • threshold trim (workspace‑calibrated)      │
                   └───────────┬────────────────────────────────────┘
                               │
                               ▼
                   ┌──────────────────────────────────────────────┐
                   │ Hydration (Redis → PlanetScale, ≤20ms hot)   │
                   │ • docs/chunks/observations                   │
                   │ • highlights + rationale (if graph used)     │
                   └──────────────────────────────────────────────┘
```

Targets (p95): identifier <90 ms; semantic <150 ms.

---

## Mermaid (Flow)

```mermaid
flowchart TB
  Q[Query] --> P[Process: parse | filters | embed]
  P --> R{Router}
  R -->|knowledge| K
  R -->|neural| N
  R -->|hybrid| K
  R -->|hybrid| N

  subgraph Knowledge
    K1[Lexical <=30ms]
    K2[Dense <=40ms]
    K1 --> K
    K2 --> K
  end

  subgraph Neural
    N1[Dense <=40ms]
    N2[Profiles sim <=10ms]
    N1 --> N
    N2 --> N
  end

  K --> F
  N --> F

  subgraph GraphBias
    G1[Resolve entities]
    G2[Traverse hops 1-2]
    G3[Boost candidates]
  end

  F[Fusion score = wv+wl+wg+wr+wi+wp]
  F -->|if graph seeds| G1
  G1 --> G2 --> G3 --> F

  F --> S{Rerank gate}
  S -->|K>=min & allowed| CE[Cross-encoder rerank <=30ms]
  S -->|else| H
  CE --> H
  H[Hydration (Redis->DB) <=20ms]
  H --> O[Response with citations + optional rationale]
```

---

## Tunable Knobs (per workspace)

- topK_lexical, topK_dense, fused_top_k
- rerank_min_k, rerank_top_n, rerank_threshold
- graph_hop_limit (1–2), graph_weight, hop_factors
- recency_decay (half‑life), importance_weight, profile_weight
- budgets_ms: traversal, rerank; disable_rerank_when_slow

---

## Logging Fields

- routerMode, stagesLatency, rerankUsed, thresholdsUsed
- contributionShares: { chunks, observations, summaries }
- graphSeeds, graphEdgesUsed, graphBoostApplied
- rationaleIds (entities/edges/evidence), hydrationCacheHit

---

## Fallbacks

- Budget exceeded on traversal → skip graph bias
- Rerank degraded/disabled → return fused order
- Sparse graph/data → prefer knowledge‑only

---

Calibration and thresholds are maintained via Braintrust suites and feedback signals. See ../../operations/evaluation-playbook.md.
