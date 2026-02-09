---
date: 2026-02-05T07:45:00Z
researcher: Claude
git_commit: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
branch: main
repository: lightfast
topic: "Lightfast Core Research Concerns"
tags: [research, vision, context-engineering, retrieval, multi-agent, memory-layer]
status: complete
last_updated: 2026-02-05
last_updated_by: Claude
---

# Lightfast Core Research Concerns

**Date**: 2026-02-05T07:45:00Z
**Researcher**: Claude
**Git Commit**: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
**Branch**: main
**Repository**: lightfast

## Summary

Lightfast is the memory layer for software teams. The core research concerns revolve around **context construction and engineering in multi-agent settings** - how to give AI agents accurate, trustworthy context about what an engineering team knows without polluting the token graph.

---

## Core Research Concerns

### 1. Context Construction & Engineering in Multi-Agent Settings

From Jeevan's foundational perspective:

> "Lightfast is focusing on pure context construction and engineering in a multi-agent setting."

The fundamental challenge: An agent has limited context `(1, MaxToken_x]`. There's clear degradation when you pollute the token graph with unnecessary context.

**Key Research Questions:**
- How to construct optimal context for AI agents?
- What is the minimum viable context for a given task?
- How to prioritize what enters the context window?
- How to measure context quality vs context size?

---

### 2. High-Precision Retrieval with Explainability

The search API must balance competing concerns:

| Concern | Challenge |
|---------|-----------|
| **Recall** | Find all relevant documents |
| **Precision** | Don't pollute context with irrelevant results |
| **Explainability** | Every answer must cite sources (no black-box answers) |
| **Latency** | Results must be fast enough for interactive use |

**Key Mechanisms Under Research:**
- **2-Key Retrieval Governor**: Vector search (Key 1) + LLM gating (Key 2)
- **Multi-view embeddings**: Title, content, summary embedded separately
- **Four-path parallel search**: Vector + Entity + Cluster + Actor
- **Cross-encoder reranking** for final precision boost

**Research Questions:**
- What's the optimal balance between vector search recall and LLM filter precision?
- How many embedding views are optimal? Which views matter most?
- When should each retrieval path be activated?

---

### 3. Temporal & Actor-Aware Memory

Unlike static document search, engineering memory requires understanding of time and people.

**Temporal Awareness:**
- "What happened last week?" must understand relative time
- "What changed since Tuesday?" requires date parsing and filtering
- Recency bias for recent events vs historical context

**Actor Attribution:**
- "What did Sarah work on?" must identify Sarah across sources
- "Who has context on auth?" requires expertise inference
- Contribution patterns and ownership signals

**Research Questions:**
- How to formalize temporal accuracy scoring?
- How to build accurate actor profiles from sparse signals?
- How to balance recency with historical relevance?

---

### 4. Cross-Source Entity Resolution

Engineers work across many tools. The challenge is building a unified view.

**Identity Resolution:**
- Same person: `@alice` on GitHub = `alice@company.com` on Linear = `U-alice` on Slack
- Mapping methods: OAuth (high confidence), Email (medium), Heuristic (low)
- Handling unknown or ambiguous actors

**Reference Linking:**
- PR body says "Fixes LIN-123" → link to Linear issue
- Sentry error → linked to causing commit
- Deployment → linked to merged PR

**Scenario Coherence:**
- Incident timeline: Sentry alert → Linear ticket → GitHub fix → Slack announcement
- Understanding event sequences across sources

**Research Questions:**
- What's the minimum confidence threshold for identity linking?
- How to detect implicit references (not just explicit "Fixes #123")?
- How to build coherent cross-source timelines?

---

### 5. Significance & Signal-to-Noise

Not all events matter equally. The challenge is distinguishing signal from noise.

**Significance Scoring Factors:**
- Event type importance (merged PR > opened PR > commit)
- Content substance (real changes vs routine updates)
- Actor activity patterns
- Reference density (highly linked = likely important)
- Temporal uniqueness

**Research Questions:**
- What threshold separates significant from noise?
- How to calibrate significance per workspace/team?
- How to handle false negatives (missing important events)?

---

### 6. Continuous Quality Evaluation

From SPEC.md:
> "Continuous evaluation: recall@k, rerank lift, snippet accuracy, rationale faithfulness"

**Metrics Framework:**

| Layer | Metrics | Target |
|-------|---------|--------|
| **Pipeline** | Throughput, latency, significance accuracy | ≥100/min, <500ms |
| **Retrieval** | MRR, NDCG@K, Recall@K, Precision@K | MRR ≥0.80 |
| **RAG Triad** | Faithfulness, Context Relevance, Answer Relevancy | ≥0.70 |

**Research Questions:**
- How to measure retrieval quality scientifically?
- How to detect drift in production?
- How to improve accuracy progressively without regression?
- What's the minimum eval dataset size for statistical significance?

---

### 7. Multi-Agent Communication & Context Preservation

From Jeevan's notes:
> "How do we get multiple agents to communicate effectively... we need to ensure context degradation doesn't occur in the main agent."

**The Subagent Challenge:**
- Main agent spawns subagents for specialized tasks
- Each subagent has its own context window
- Results must flow back without polluting main context
- Fine-grained control of what enters each context graph

**Research Questions:**
- How to summarize subagent findings without losing critical information?
- What's the optimal context handoff protocol?
- How to prevent context explosion in deep agent hierarchies?
- How to maintain coherence across agent boundaries?

---

## Summary Table

| Research Area | Core Question | Current Approach |
|---------------|---------------|------------------|
| **Context Engineering** | How to construct optimal context without token pollution? | Significance filtering, multi-view embeddings |
| **Retrieval Precision** | How to maximize precision without sacrificing recall? | 2-key retrieval (vector + LLM gate) |
| **Temporal Memory** | How to answer time-aware queries accurately? | Date parsing, recency bias, temporal filters |
| **Actor Resolution** | How to identify the same person across sources? | OAuth/email/heuristic identity tiers |
| **Cross-Source Linking** | How to connect related events across tools? | Reference extraction, entity linking |
| **Significance Scoring** | How to separate signal from noise? | Multi-factor scoring with threshold |
| **Quality Measurement** | How to scientifically evaluate and improve search? | Braintrust evals, MRR/NDCG metrics |
| **Multi-Agent Context** | How to prevent context degradation in agent hierarchies? | Subagent architecture (active research) |

---

## The Overarching Theme

**Building the memory layer that lets AI agents have accurate, trustworthy context about what an engineering team knows.**

The goal is not just search—it's giving agents the right context to reason about engineering work, make decisions, and take actions with confidence. Every research concern ties back to: **how do we construct the best possible context for any given query?**

---

## Related Documents

- `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` - Evaluation pipeline design
- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Scientific evaluation framework
- `thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md` - Evaluation environment architecture
- `SPEC.md` - Vision and mission
- `apps/console/CLAUDE.md` - Console product goals and Jeevan's foundational perspective

---

_Last updated: 2026-02-05_
