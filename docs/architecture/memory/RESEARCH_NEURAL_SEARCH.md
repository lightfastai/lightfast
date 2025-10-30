---
title: Research Notes — Neural Search
description: Practical research notes informing Lightfast’s neural search design
status: working
owner: platform-research
audience: engineering
last_updated: 2025-10-28
tags: [research]
---

# Research Notes — Neural Search

Last Updated: 2025-10-28

This brief surveys neural search practices relevant to Lightfast (e.g., Exa-style meaning-first retrieval), and how we apply them.

Key ideas
- Multi-representation: embed titles, snippets, bodies, and summaries; queries use `search_query` role.
- Hybrid signals: dense + sparse/lexical + recency + importance + personalization; fuse then rerank with cross-encoder.
- Profiles: entity centroids help bias toward relevant owners/domains without hard filters.
- Bounded graph bias: 1–2 hops; explainability via rationale that cites entities/edges and evidence.

Lightfast applications
- Observations: high-signal moments form a first-class neural memory. We index them separately from chunks for speed and control.
- Summaries: cluster observations to provide quick orientation; embed and index for overview queries.
- Scoring: `wv*vector + wl*lexical + wg*graph + wr*recency + wi*importance + wp*profile`; calibrated per workspace.

Open questions
- Model policy per view (single vs specialized embeddings).
- Personalization defaults and opt-outs per workspace.
- When to persist low-confidence inferred links vs treating them as transient boosts.
