---
title: Lightfast Platform Overview
description: What Lightfast is, core pillars, and how it works
status: working
owner: platform
audience: engineering
last_updated: 2025-10-30
tags: [overview]
---

# Lightfast Platform Overview

Last Updated: 2025-10-30

Lightfast is a neural memory system that combines semantic retrieval with explicit structure. We unify three pillars:

- Knowledge: durable chunks from sources like GitHub, Linear, Notion, Slack
- Neural Memory: observations, summaries, and profiles purpose-built for semantic search
- Graph: entities and relationships for explainability and short-hop reasoning

Together, these deliver answers and context with evidence — fast, explainable, and agent-ready.

---

## Principles

- Neural-first, structure-aware: semantic retrieval augmented by explicit entities/edges.
- Evidence over assertion: every claim traces to memory (chunks/observations) and relations.
- Multi-representation by default: titles, snippets, bodies, and summaries improve recall and precision.
- Developer-first, tenant-safe: simple APIs, clear contracts, strong isolation.
- Quality as a loop: measure, calibrate, and adapt with feedback.

---

## What We Store

- Knowledge Chunks: durable slices of documents for high-recall retrieval.
- Memory Observations: atomic “moments” like decisions, incident lines, PR highlights, Q/A; multi‑view embeddings.
- Memory Summaries: clustered rollups by entity/topic/time for quick orientation and aging/compression.
- Memory Profiles: per‑entity prototype vectors (centroids) and descriptors for personalization and biasing.
- Graph: explicit entities and typed relationships for explainability and 1–2 hop traversal.

Beliefs and intent live within summaries, not as a privileged type.

---

## How It Works (at a glance)

- Ingest: connectors normalize artifacts → create chunks and observations; attach entities, timestamps, and importance; embed multiple views.
- Index: vector indexes per workspace and embedding version for chunks, observations, summaries, and profiles.
- Retrieve: hybrid pipeline fuses dense, lexical, graph bias, recency, importance, and profile similarity; cross‑encoder reranks top‑K.
- Explain: cite chunks/observations and show graph rationale when applicable.
- Answer: compose extractive or abstractive responses with citations; stream when needed.

---

## Next

- Architecture deep dive: ../architecture/spec.md
- Data model: ../architecture/data-model.md
- Retrieval design: ../architecture/retrieval/search-design.md
- Glossary: ./glossary.md
