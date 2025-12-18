---
title: Neural Search Systems — Literature Digest
description: Curated papers organized by pipeline stage with Lightfast tie-ins
status: working
owner: platform-research
audience: engineering
last_updated: 2025-12-09
tags: [research]
---

# Neural Search Systems — Literature Digest

Last Updated: 2025-10-28

This digest curates key papers and resources for Lightfast’s neural search design. It is organized by pipeline stage and maps each area back to our specs in `docs/architecture/spec.md` (architecture) and `docs/architecture/retrieval/search-design.md` (retrieval & ranking).

## How To Use

- For implementation: pick one default per stage (dense, sparse, rerank) and gate optional paths (HyDE, GraphRAG) behind flags.
- For evaluation: prefer BEIR zero-shot plus internal truth sets; log contribution shares by stage and router mode.
- For operations: adhere to latency budgets (identifier <90 ms; semantic <150 ms p95) and multi-tenant isolation.

---

## Candidate Generation — Dense Retrieval

- Dense Passage Retrieval (DPR). Karpukhin et al., EMNLP 2020. https://arxiv.org/abs/2004.04906
- ANCE: Approximate Nearest Neighbor Negative Contrastive Learning. Xiong et al., ICLR 2021. https://arxiv.org/abs/2007.00808
- Contriever (unsupervised). Izacard et al., 2021. https://arxiv.org/abs/2112.09118
- Large Dual Encoders (GTR). Ni et al., 2021. https://arxiv.org/abs/2112.07899

Lightfast tie‑in: default dense search over chunks and observations; multi‑view embeddings per query/document. See SPEC §5 Candidate Generation; SEARCH_DESIGN “Candidate Generation”.

## Late Interaction / Multi‑Vector

- ColBERT: Late Interaction over BERT. Khattab & Zaharia, 2020. https://arxiv.org/abs/2004.12832
- ColBERTv2. Santhanam et al., NAACL 2022. https://aclanthology.org/2022.naacl-main.272.pdf
- PLAID: Efficient Engine for Late Interaction. 2022. https://arxiv.org/abs/2205.09707

Tie‑in: optional high‑quality path for difficult queries; evaluate PLAID for latency budgets. See SPEC §5 Rerank/Quality modes.

## Sparse + Dense Hybrid (First‑Stage)

- SPLADE: Sparse Lexical and Expansion Model. Formal et al., SIGIR 2021. https://arxiv.org/abs/2107.05720

Tie‑in: combine SPLADE/BM25 with dense similarity in fusion scoring. See SPEC §5 Fusion & Scoring.

## Cross‑Encoder Re‑Ranking

- MonoT5 (Document/Passage Re‑Ranking via T5). Nogueira et al., 2020. https://arxiv.org/abs/2003.06713
- RankT5 (ranking losses). Zhuang et al., 2022. https://www.jagerman.nl/pdf/zhuang-2022-rankt5.pdf

Tie‑in: apply to fused top‑K with workspace‑calibrated thresholds. See SPEC §5 Rerank.

## ANN Indexing (Latency & Scale)

- FAISS: Billion‑Scale Similarity Search with GPUs. Johnson et al., 2017. https://arxiv.org/abs/1702.08734
- HNSW: Hierarchical Navigable Small Worlds. Malkov & Yashunin, TPAMI 2018. https://arxiv.org/abs/1603.09320
- ScaNN: Efficient Vector Similarity Search. Google Research, 2020. Blog + ICML paper link: https://research.google/blog/announcing-scann-efficient-vector-similarity-search/

Tie‑in: informs Pinecone/ANN configuration, quantization, and recall/speed tradeoffs. See SPEC Latency Targets; STORAGE_ARCHITECTURE “Vector”.

## Query Expansion & Generation‑Aided Retrieval

- RAG: Retrieval‑Augmented Generation. Lewis et al., NeurIPS 2020. https://arxiv.org/abs/2005.11401
- HyDE: Precise Zero‑shot Dense Retrieval without Labels. Gao et al., ACL 2023. https://arxiv.org/abs/2212.10496
- GAR: Generation‑Augmented Retrieval. Mao et al., ACL 2021. https://aclanthology.org/2021.acl-long.316.pdf

Tie‑in: enable fallbacks to improve recall on long‑tail queries; keep retrieval‑first answering with citations. See SPEC §6 Answering.

## Graph‑Augmented Retrieval (Explainability & Bias)

- GraphRAG (overview + arXiv). Microsoft Research. https://microsoft.github.io/graphrag/ and https://arxiv.org/abs/2501.00309
- Document GraphRAG. MDPI 2025. https://www.mdpi.com/2079-9292/14/11/2102

Tie‑in: bounded 1–2 hop boosts with allowlisted edges; attach rationale when graph influences ranking. See SPEC §5 Graph Boost and Hydration & Rationale.

## Personalization & Profiles

- DPSR: Deep Personalized & Semantic Retrieval (e‑commerce). SIGIR 2020. https://arxiv.org/abs/2006.02282
- Personal Word Embeddings for Personalized Search. SIGIR 2020. https://dl.acm.org/doi/10.1145/3397271.3401153
- Context‑aware History for Personalized Search. SIGIR 2020. https://dl.acm.org/doi/10.1145/3397271.3401175

Tie‑in: entity/profile centroids to bias retrieval; opt‑out controls. See SPEC §2 Memory Profiles; §5 Fusion & Scoring (profileSim).

## Neural Memory Systems

### Foundational Architectures

- Neural Turing Machines (NTM). Graves et al., 2014. https://arxiv.org/abs/1410.5401
- End‑to‑End Memory Networks. Sukhbaatar et al., NeurIPS 2015. https://arxiv.org/abs/1503.08895
- Differentiable Neural Computers (DNC). Graves et al., Nature 2016. https://www.nature.com/articles/nature20101

Tie‑in: foundational concepts for learned read/write memory operations; content‑based and location‑based addressing.

### Transformer‑Native Memory

- Memory Layers at Scale. Meta FAIR, Dec 2024. https://arxiv.org/abs/2412.09764
- Hierarchical Memory Transformer (HMT). Packer et al., May 2024. https://arxiv.org/abs/2405.06067
- Infini‑attention: Infinite Context with Bounded Memory. Google, Apr 2024. https://arxiv.org/abs/2404.07143
- LongNet: Scaling Transformers to 1B Tokens. Microsoft, Jul 2023. https://arxiv.org/abs/2307.02486

Tie‑in: Memory Layers add 128B trainable key‑value slots with no extra FLOPs; HMT mimics human sensory→short→long‑term hierarchy; Infini‑attention enables unbounded context.

### Virtual Context Management

- MemGPT: Towards LLMs as Operating Systems. Packer et al., Oct 2023. https://arxiv.org/abs/2310.08560
- HMLR: Hierarchical Memory Lookup & Routing. Sean‑V‑Dev, 2024. https://github.com/Sean-V-Dev/HMLR-Agentic-AI-Memory-System

Tie‑in: OS‑inspired paging between main context and external storage; explicit memorize/remember/update operations; 2‑key retrieval (vector + LLM gating).

### Memory Compression & Continual Learning

- Dynamic Memory Compression (DMC). Nawrot et al., 2024. https://arxiv.org/abs/2403.09636
- Compression Memory Training (CMT). Dec 2024. (memory bank consolidation for continual learning)
- Slim Attention: Cut Context Memory in Half. 2024. https://arxiv.org/abs/2410.03128

Tie‑in: learned KV cache compression; sparse memory finetuning prevents catastrophic forgetting; 2x memory reduction with zero accuracy loss.

### Production Memory Libraries

- Mem0: Memory Layer for AI Agents. 2024. https://github.com/mem0ai/mem0
- MemEngine: Unified Memory Library for LLM Agents. 2025. https://github.com/nuster1128/MemEngine
- Letta (MemGPT Framework). 2024. https://github.com/cpacker/memgpt

Tie‑in: production‑ready memory APIs; multi‑user/multi‑agent coordination; semantic/episodic/procedural memory types.

## Matryoshka Embeddings (Truncated Vectors)

- Matryoshka Representation Learning (MRL). Kusupati et al., NeurIPS 2022. https://arxiv.org/abs/2205.13147

Tie‑in: shortlist using prefix (low‑dim) and rerank with full‑dim to hit p95 latency goals. See STORAGE_ARCHITECTURE Embedding & Versioning.

## Evaluation & Robustness

- BEIR: Heterogeneous Zero‑Shot Retrieval Benchmark. NeurIPS 2021 D&B. https://arxiv.org/abs/2104.08663

Tie‑in: measure recall@k, rerank lift, and OOD generalization; segment by router mode. See SPEC §8 Evaluation; SEARCH_DESIGN “Monitoring & Evaluation”.

## Surveys (Context)

- LLMs for Information Retrieval: A Survey (2024). https://arxiv.org/html/2308.07107v4
- Generative Information Retrieval Surveys (2024–2025). https://arxiv.org/html/2406.01197v2 and https://arxiv.org/html/2404.14851v3

## System Inspiration (Exa)

- Next‑gen search system design. Exa blog (2025). https://exa.ai/blog/how-to-build-nextgen-search
- Exa 2.0 performance notes. https://exa.ai/blog/exa-api-2-0
- BM25 memory optimization at web scale. https://exa.ai/blog/bm25-optimization

---

### Mapping To Lightfast

- Dense retrieval (DPR/ANCE/Contriever/GTR) → SPEC §5 Candidate Generation; multi‑view embeddings.
- Hybrid fusion (SPLADE + dense) → SPEC §5 Fusion weights.
- Rerank (MonoT5/RankT5) → SPEC §5 Rerank thresholds.
- ANN choices (FAISS/HNSW/ScaNN) → SPEC Latency Targets; STORAGE_ARCHITECTURE Vector.
- Query expansion (HyDE/GAR) → SPEC §5 & §6; gated fallback.
- Graph bias (GraphRAG‑style rationale) → SPEC §5 Graph Boost; rationale on influence.
- Personalization (profiles) → SPEC §2 Profiles; §5 profileSim.
- Neural memory (Memory Layers/MemGPT/HMLR) → long‑term agent memory; 2‑key retrieval; virtual context.
- Memory compression (DMC/Slim Attention) → KV cache optimization; continual learning.
- Matryoshka truncation → STORAGE_ARCHITECTURE Embedding & Versioning.
- Evaluation (BEIR) → SPEC §8 Evaluation; SEARCH_DESIGN Monitoring.
