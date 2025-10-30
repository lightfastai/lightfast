---
title: Retrieval Configuration
description: Weights, topK, graph bias, rerank thresholds, and defaults by workspace size
status: draft
owner: platform-search
audience: engineering
last_updated: 2025-10-30
tags: [retrieval, ranking, config]
---

# Retrieval Configuration

This page defines the knobs used by the retrieval router and reranker. Values are safe defaults with guidance for calibration by workspace size.

---

## Score Model

score = wv*vector + wl*lexical + wg*graph + wr*recency + wi*importance + wp*profile

- wv (vector): dense similarity
- wl (lexical): BM25/FTS score
- wg (graph): bounded boost from graph traversal
- wr (recency): exponential decay by occurredAt
- wi (importance): source/type/labels weighting
- wp (profile): similarity to entity profiles

---

## Global Defaults

- router.modes: knowledge | neural | hybrid (auto selects)
- identifiers.fast_path: true (skip embedding for `#123`, `repo:path`, etc.)
- budgets_ms:
  - graph_traversal: 15
  - rerank: 30
  - hydrate: 20
- disable_rerank_when_slow: true (falls back to fused order)

---

## Weights (Presets)

Small workspaces (XS/SM)
- wv=0.55, wl=0.25, wg=0.08, wr=0.08, wi=0.02, wp=0.02
- Notes: higher lexical share helps sparse data; graph kept light.

Medium workspaces (MD)
- wv=0.58, wl=0.20, wg=0.10, wr=0.08, wi=0.02, wp=0.02
- Notes: balanced; good default for most customers.

Large workspaces (LG/XL)
- wv=0.60, wl=0.15, wg=0.12, wr=0.08, wi=0.03, wp=0.02
- Notes: increase graph slightly; lexical down‑weights with better dense coverage.

---

## TopK and Fusion

- topK.lexical_first_stage: 50
- topK.vector_first_stage: 100
- topK.fused: 50
- aggregate.by_default: chunk (clients can roll up to documents)

Identifier fast path
- topK.lexical_identifiers: 20
- rerank.min_k_identifiers: 0 (skip)

---

## Rerank

- enabled: true
- model: rerank-v3.5 (or equivalent)
- min_k: 30         (only rerank when fused K ≥ min_k)
- top_n: 10         (output list length after rerank)
- threshold: auto   (calibrated per workspace; see Evaluation Playbook)
- cache_snippets: true (cache top chunk texts to reduce latency)

Calibration
- Use borderline pairs per workspace to set `threshold = mean - 1σ`.
- If p95 latency exceeds budget, reduce `top_n` or increase `min_k`.

---

## Graph Bias

- enabled: true
- hops: 1–2
- hop_factors: [1.0, 0.6]
- allowlist_by_intent:
  - ownership: [OWNED_BY, MEMBER_OF]
  - dependency: [DEPENDS_ON, BLOCKED_BY, RESOLVES]
  - alignment: [ALIGNS_WITH_GOAL]
- weight (wg): see presets above
- time_budget_ms: 15

Notes
- If traversal exceeds budget → skip graph bias for this request.
- Always attach rationale when bias affected ranking and `include.rationale=true`.

---

## Recency (wr)

Exponential decay: score *= exp(−Δt / half_life)

- half_life.chunks: 45 days
- half_life.observations: 14 days
- half_life.summaries: 90 days (light effect)

Tuning
- Increase chunks half‑life for handbooks/policies (long‑lived relevance).
- Decrease observations half‑life for fast‑moving teams.

---

## Importance (wi)

Source/type/label boosts applied during fusion.

Examples (additive before normalization)
- incidents: +0.08
- decisions/rfc: +0.05
- pr with fixes/resolves: +0.03

---

## Profiles (wp)

- enabled: true (bias toward relevant entity profiles when query intent implies ownership/domain)
- centroid_views: [title, body, summary]
- weight: see presets (typically 0.02)

---

## Workspace Size Heuristics

XS/SM
- prefer lower `topK.vector_first_stage` (e.g., 60)
- consider disabling graph until entity coverage is good

MD
- defaults as above

LG/XL
- keep `vector_first_stage` at 100–150
- enable graph; ensure adjacency caches are warm
- monitor rerank latency; adjust `min_k` and `top_n`

---

## Identifier Heuristics

Regex library (examples)
- issue: `[#][0-9]+|[A-Z]{2,}-[0-9]+`
- repo path: `\b[a-z0-9_.-]+/[a-z0-9_.-]+(:[\/\w.-]+)?\b`

When matched
- route = knowledge
- skip embedding; use lexical + direct hydration
- cap `topK` and return fast (<90 ms p95)

---

## Observability Fields

Log per request
- routerMode, routerScope
- stagesLatency: lexical, vector, rerank, hydrate
- contributionShares: chunks, observations, summaries
- graphInfluence: seeds, edgesUsed, boostApplied

See also: ../../operations/evaluation-playbook.md
