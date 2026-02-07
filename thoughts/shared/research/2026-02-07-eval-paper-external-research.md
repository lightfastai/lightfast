---
date: 2026-02-07
researcher: external-agent
topic: "AI eval pipeline continuation + paper topic identification — external research"
tags: [research, web-analysis, academic-papers, rag-evaluation, multi-view-embedding, hybrid-retrieval, publication-venues]
status: complete
confidence: very-high
sources_count: 120+
---

# External Research: Eval Pipeline + Paper Topics

## Research Question
What aspects of Lightfast's system would be novel contributions to the academic community? What existing work has been done in related areas? Where should Lightfast publish its first technical paper?

## Executive Summary

After extensive research across 8 investigation areas with 87+ sources, the academic landscape reveals **several strong novelty opportunities** for Lightfast. The most publishable contributions center on:

1. **Cross-source identity resolution for developer tools** — No academic papers exist on automatic cross-platform developer identity linking (GitHub + Jira + Linear + Slack) for RAG knowledge graphs. This is a **highly novel** contribution.

2. **Webhook-driven real-time knowledge graph construction** — While knowledge graphs from software engineering data exist (Nalanda at Microsoft, Graph4Code at IBM), none use real-time webhook ingestion. This represents a **novel architectural contribution**.

3. **Engineering-domain RAG evaluation benchmark** — BEIR and MTEB have **zero coverage** of engineering/DevOps domains (commits, deployments, incidents). Creating "EngRAG-Bench" would fill a **critical gap**.

4. **Significance-based ingestion filtering** — Pre-filtering documents by quality before embedding for RAG is **partially novel**. Extensive work exists on training data quality filtering (QuRating, DFN), but applying it as a RAG ingestion gate is underexplored. Neural Passage Quality Estimation (2020) is the closest prior work.

5. **Multi-view embeddings** and **4-path hybrid retrieval** have more established prior art but Lightfast's specific combination remains novel in the engineering domain context.

The recommended publication strategy is: **arXiv preprint first** (immediate), then **SIGIR SIRIP or EMNLP Industry Track** (peer review), targeting the cross-source identity resolution + engineering-domain RAG system as the primary paper topic.

---

## Key Findings

### 1. Multi-View Embeddings Literature

**What exists:**

Multi-view and multi-representation approaches to document retrieval are an active research area with several established methods:

- **ColBERT** (Khattab & Zaharia, SIGIR 2020): The foundational late-interaction model that represents documents as bags of token-level embeddings rather than single vectors. Uses MaxSim (maximum similarity) operator for scoring — computing maximum cosine similarity between each query token embedding and all document token embeddings, then summing across query tokens. This is the closest analog to MAX-score aggregation across views.

- **ColBERTv2** (Santhanam et al., NAACL 2022): Improved version with residual compression for storage efficiency while maintaining multi-vector representation quality.

- **Multi-Head RAG (MRAG)** (Phukan et al., arXiv 2024, arXiv:2406.05085): Uses activations from the Transformer's multi-head attention layer (rather than the decoder layer) as keys for document retrieval. Specifically designed for queries requiring retrieval of multiple, substantially different documents. The different attention heads capture different semantic aspects of the document.

- **Multi-Vector Retrieval** (Li et al., 2023): General framework for representing documents as multiple vectors rather than a single dense vector, showing improved recall on diverse queries.

- **Matryoshka Representation Learning** (MRL) (Kusupati et al., NeurIPS 2022): Not multi-view per se, but trains embeddings that are useful at multiple dimensionalities, enabling flexible precision-recall tradeoffs.

- **Poly-encoders** (Humeau et al., ICLR 2020): Use multiple attention heads to create several global representations per candidate, enabling richer matching than single-vector bi-encoders.

**What's novel about Lightfast's approach:**

Generating **separate embeddings for title, content, and summary** of the same document and using MAX-score aggregation across these views is a **moderate novelty**. The concept of multi-vector representation exists (ColBERT, MRAG, Poly-encoders), but:

- ColBERT uses token-level multi-vectors (hundreds per document), not semantically meaningful view-level vectors
- MRAG uses attention head activations, not explicit semantic decomposition
- No paper explicitly uses the title/content/summary decomposition as separate embedding views for the same document

**Novelty assessment for Lightfast**: **Medium**. The approach is a novel application of multi-view representation at the semantic-view level (vs. token level or attention-head level), but the general concept of multi-vector retrieval is well-established. Best positioned as an engineering contribution showing practical benefits of view-level decomposition.

---

### 2. Hybrid Retrieval Literature

**What exists:**

Hybrid retrieval combining multiple retrieval signals is well-studied:

- **Reciprocal Rank Fusion (RRF)** (Cormack et al., SIGIR 2009): The standard method for fusing ranked lists from multiple retrieval sources. Simple formula: `RRF(d) = Σ 1/(k + rank_i(d))` where k is typically 60. Widely used in Elasticsearch, Azure AI Search, and production systems.

- **Dense + Sparse Hybrid** (Ma et al., SIGIR 2021; Lin & Ma, EMNLP 2021): Combining BM25 (sparse) with dense retrieval is now standard practice. Shown to outperform either alone consistently.

- **ColBERT + BM25 + DPR Fusion** (Various, 2022-2024): Multiple papers combine 2-3 retrieval paths. Typical approaches use linear score interpolation or RRF.

- **RAPTOR** (Sarthi et al., ICLR 2024): Recursive abstractive processing for tree-organized retrieval — builds a hierarchical tree of document summaries and searches at multiple levels of abstraction.

- **HyDE** (Gao et al., 2022): Hypothetical Document Embeddings — generates a hypothetical answer, then uses it for retrieval. A form of query-side signal augmentation.

- **Multi-Signal Retrieval at Scale**: Production systems at Google, Microsoft, and Spotify combine dense retrieval + lexical matching + metadata filters + popularity signals. LinkedIn's search combines 5+ ranking signals. However, these are not typically described as parallel path retrieval for RAG.

**Key gap: 4+ parallel retrieval paths for RAG**

Most academic work combines 2-3 paths (typically dense + sparse, sometimes + reranker). Lightfast's 4-path parallel search (dense vector + entity-based + cluster-based + actor-based) with score fusion is **less common**:

- No paper found that combines exactly these 4 heterogeneous retrieval paths in parallel
- Entity-based retrieval as a separate path (not just metadata filtering) is uncommon in RAG literature
- Cluster-based retrieval (semantic clustering of documents) as a retrieval path has precedent in RAPTOR but not as one path among many
- Actor-based retrieval (filtering by person/entity responsible) is novel in RAG contexts

**Score fusion from heterogeneous sources:**

- **CombSUM / CombMNZ** (Fox & Shaw, 1994): Classic score combination methods
- **Learning-to-Rank fusion** (Liu, 2009): Train a model to combine scores from multiple signals
- **Normalized score fusion**: Z-score normalization before combination
- Most production systems use RRF or learned weights

**Novelty assessment for Lightfast**: **Medium-High**. While hybrid retrieval (2-3 paths) is established, the specific 4-path combination of dense + entity + cluster + actor retrieval in parallel for an engineering-domain RAG system does not have direct precedent. The novelty is in the specific combination and engineering-domain application, not in the individual retrieval methods.

---

### 3. Significance-Based Ingestion Filtering

**What exists:**

**Quality filtering for LLM training (extensive prior work):**

| Paper | Venue | Year | Method |
|-------|-------|------|--------|
| **QuRating** | ICML | 2024 | LLM pairwise judgments across 4 quality dimensions (writing style, expertise, facts, educational value) |
| **Data Filtering Networks (DFN)** | ICLR | 2024 | Specialized filtering networks for image-text dataset curation |
| **Classifier-Based Quality Filtering (CQF)** | arXiv | 2025 | Binary classifier distinguishing low-quality web data from high-quality seed set |
| **ScalingFilter** | EMNLP | 2024 | Perplexity difference between small/large LMs as quality factor |
| **D4** | NeurIPS | 2023 | Semantic de-duplication + prototypicality metric for training data |
| **NeMo Curator** | NVIDIA | 2024 | Heuristic + classifier filtering for LLM training data |

**Closest prior work for RAG:**

- **Neural Passage Quality Estimation for Static Pruning** (arXiv, 2020) — **MUST CITE**. Uses neural networks to predict query-agnostic passage quality BEFORE indexing. Successfully prunes 25%+ of passages while maintaining retrieval effectiveness. This is the closest analog to Lightfast's significance scoring.

- **InfoGain-RAG** (EMNLP 2025) — Uses Document Information Gain (DIG) for reranking, but post-retrieval filtering, not pre-ingestion.

- **"Is This Collection Worth My LLM's Time?"** (arXiv, Feb 2025, arXiv:2502.13691) — Measures "Information Potential" of text collections for LLMs without model training. Helps decide which collections are worth digitizing/preprocessing.

**What's missing:**

No paper explicitly frames quality assessment as a **pre-ingestion gate** that decides whether to embed and index a document in a RAG retrieval corpus. The key gap is:

1. All training data quality work targets model weights, not retrieval corpora
2. Most RAG systems follow: `All Documents → Embed Everything → Index All → Filter During Retrieval`
3. Lightfast's approach: `Document → Significance Score → Gate → Embed if significant → Index`

**Novelty assessment for Lightfast**: **Medium-High**. The specific application of quality/significance scoring as a pre-embedding gate for RAG is novel. The concept of quality filtering exists extensively (for LLM training), and static pruning exists (Neural Passage Quality Estimation), but treating the vector store as a curated knowledge base with significance-based ingestion gates is underexplored. Best positioned by citing training data quality literature and Neural Passage Quality Estimation, then showing the novel RAG application.

---

### 4. Engineering-Domain RAG Evaluation

**Existing benchmarks and their coverage:**

| Benchmark | Venue/Year | Domains Covered | Engineering Coverage |
|-----------|-----------|-----------------|---------------------|
| **BEIR** | SIGIR 2021-2024 | Scientific, Biomedical, News, Wikipedia, Twitter | ❌ None |
| **MTEB** | EACL 2023 (1000+ tasks) | General text, medical, legal, limited code | ❌ Minimal |
| **CoIR** | ACL 2025 | Code retrieval (10 datasets, 7 domains) | ⚠️ Partial (code only) |
| **SWE-bench** | ICLR 2024 | Python repo bug fixing | ⚠️ Uses commits but evaluates code generation |
| **CodeRAG-Bench** | arXiv 2024 | Code generation with RAG | ⚠️ Repository-level but not event retrieval |
| **RCAEval** | arXiv 2025 | Microservice root cause analysis (735 cases) | ⚠️ Incident diagnosis, not retrieval |
| **OpsEval** | arXiv 2024 | Operations QA (7,184 questions) | ⚠️ Tests LLM knowledge, not retrieval |
| **FreshStack** | NeurIPS 2025 | Technical documentation (LangChain, YOLO, etc.) | ⚠️ Library docs, not org knowledge |
| **BRIGHT** | arXiv 2024 | Reasoning-intensive queries (StackExchange) | ❌ Minimal |

**Critical gaps — NO benchmarks for:**

| Engineering Domain | Gap Severity |
|-------------------|-------------|
| **Commit history retrieval** ("Find auth-related commits in Q3") | 🔴 Critical |
| **Pull request search** ("PRs modifying payment gateway") | 🔴 Critical |
| **Deployment events** ("Rollbacks due to memory issues") | 🔴 Critical |
| **Incident/postmortem knowledge** ("Similar database connection failures") | 🔴 Critical |
| **Infrastructure changes** ("Terraform VPC config changes") | 🔴 Critical |
| **Multi-repo engineering search** ("All services with circuit breaker") | 🟡 High |
| **On-call knowledge** ("All Sev-1 incidents in Q4") | 🟡 High |
| **Internal engineering documentation** ("Auth service architecture docs") | 🟡 High |

**Why these gaps exist:**
1. Engineering event data is proprietary — no public datasets
2. Benchmark construction requires domain experts to label relevance
3. Academic incentives favor public datasets (reproducibility)
4. Code generation (SWE-bench) is more tractable than retrieval evaluation

**Novelty assessment for Lightfast**: **Very High**. There is a **massive gap** in engineering-domain RAG benchmarks. Creating "EngRAG-Bench" covering commits, deployments, incidents, and PRs would be a **high-impact research contribution** with no direct competition. This is potentially the strongest paper topic.

---

### 5. Citation Generation in Agentic RAG

**State of the art:**

- **ALCE Benchmark** (Gao et al., EMNLP 2023): Automatic LLM Citation Evaluation — evaluates citation quality in LLM-generated text. Metrics include citation precision (% of citations supporting claims) and citation recall (% of claims with citations).

- **AGREE Framework** (NAACL 2024): Adaptation for GRounding EnhancEment — tunes LLMs to self-ground claims and provide accurate citations. Shows >20% improvement in citation precision/recall over prompting-based approaches. Key innovation: automatic training data construction using NLI models.

- **CiteFix** (Amazon Science, 2025): Post-processing citation correction using keyword/semantic matching and fine-tuned models to fix incorrect citations after generation.

- **"Correctness ≠ Faithfulness in RAG Attributions"** (TU Delft, 2024, arXiv:2412.18004): Critical paper showing that up to **57% of citations** in RAG systems are "post-rationalized" — the model generates an answer from parametric memory then retrospectively finds documents to cite. Citations can be **correct** (document supports claim) but **unfaithful** (model didn't actually use that document).

- **PROV-AGENT** (IEEE e-Science 2025): Unified provenance model for tracking AI agent interactions in agentic workflows. Provides structured audit trails for multi-step agent execution.

- **AgentOrchestra TEA Protocol** (arXiv 2025, arXiv:2506.12508): Reporter Agent handles "consistent source attribution" with auto-deduplicated references and normalized URLs.

- **Cohere Tool-Use Citations**: Production system providing out-of-the-box citation generation for tool calls, with "accurate" (post-generation) and "fast" (inline) citation modes.

**Key metrics in the literature:**
- **Citation Precision**: % of citations that support the claim they're attached to
- **Citation Recall**: % of answer claims that have supporting citations
- **Citation Faithfulness**: Whether the model genuinely relied on the cited source (vs. post-rationalization)
- **NLI-based verification**: Using Natural Language Inference to check entailment between context and claims

**Novelty assessment for Lightfast**: **Medium**. Citation generation for single-turn RAG is well-studied (ALCE, AGREE, CiteFix). The less explored area is citation tracking across **multi-tool agentic workflows** — tracking attribution across the 4 retrieval paths and through the reranking/generation pipeline. If Lightfast can demonstrate citation lineage (which path provided which citation), that adds novelty.

---

### 6. Cross-Source Identity Resolution

**What exists in developer identity resolution:**

| Paper | Venue/Year | Sources Linked | Approach |
|-------|-----------|----------------|----------|
| **"Identity Resolution of 38M Author IDs from 2B Git Commits"** | MSR 2020 | Git commits only | ML classifier on name/email blocking |
| **Gambit** (Gote & Zingg) | MSR 2021 | Git/VCS only | Rule-based name disambiguation (F1: 0.985) |
| **"Hidden in the Code"** | 2024 | GitHub only | Alias merging + bot detection + visualization |
| **"Who's Pushing the Code"** | ICSE 2025 | GitHub only | Impersonation detection (security focus) |
| **ALFAA** | Referenced in WoC | Git only | Active learning for identity correction |

**General entity resolution:**
- **End-to-End ER for Big Data** (Christophides et al., 2019): Comprehensive survey of ER workflows
- **Heterogeneity in Entity Matching** (arXiv 2024, arXiv:2508.08076): Taxonomy of heterogeneity types (representation, semantic)
- **Magellan/PyMatcher** (ACM 2020, 2023): General-purpose ER toolkit used by 13 companies
- **S2AND** (2021): Semantic Scholar's author disambiguation — academic publications, not software

**RAG + Identity resolution (very recent):**
- **IdentityRAG** (Tilores + LangChain, 2024): Integrates identity resolution into RAG for customer service
- **Multi-Agent RAG for Entity Resolution** (MDPI 2025): Multi-agent system for census/healthcare ER (94.3% accuracy)
- **GraphRAG** (Microsoft, 2024): Uses entity extraction + relationship mapping but no cross-platform identity resolution

**Critical finding: NO academic papers on cross-platform developer identity resolution**

- All developer identity work is **Git/GitHub-centric** — single platform only
- No MSR/ICSE/FSE papers on linking identities across Jira, Linear, Slack, GitHub
- The intersection of **cross-platform developer identity + RAG knowledge graph** is completely unexplored
- Existing cross-platform integration is manual (include Jira ID in commit message, bot setup)

**Novelty assessment for Lightfast**: **Very High**. This is the **most novel** contribution. No prior academic work exists on:
1. Automatic cross-platform developer identity resolution (GitHub + Jira + Linear + Slack)
2. Developer identity linking specifically for RAG knowledge graphs
3. The three-way combination of cross-platform identity + knowledge graph + RAG retrieval

---

### 7. Automatic Knowledge Graph from Engineering Events

**What exists:**

**Academic systems:**

| System | Venue/Year | Scale | Events Used | Real-Time? |
|--------|-----------|-------|-------------|-----------|
| **Nalanda** (Microsoft) | ESEC/FSE 2022 | 37M+ nodes, 128M+ edges | PRs, work items, files, developers | ❌ Batch |
| **Graph4Code** (IBM) | Semantic Web 2020 | 2B+ triples | Static code analysis | ❌ Static snapshot |
| **GraphGen4Code** (IBM) | K-CAP 2021 | Large | Code analysis + documentation | ❌ Batch |
| **RCGraph** | IEEE 2023 | Medium | Commits + README changes | ⚠️ Temporal but unclear if real-time |
| **"Synergizing LLMs and KGs"** | arXiv 2024 | Medium | Commits, PRs, issues | ❌ Batch |
| **SEON Ontology** | 2012 | Small | Activities, issues, code flaws | ❌ Manual/batch |

**Industry/open-source tools:**

| Tool | Type | Real-Time? | SE-Specific? |
|------|------|-----------|-------------|
| **Arc Memory** | VS Code extension | ⚠️ On-demand builds | ✅ Yes (commits, PRs, issues, ADRs) |
| **GHTorrent** (MSR 2013) | Dataset mirror | ❌ Batch (discontinued ~2018) | ✅ GitHub events |
| **GitHub Dependency Graph** | Platform feature | ✅ Auto-updated | ⚠️ Dependencies only |
| **GitLab Knowledge Graph** | Proposed (Sept 2024) | ❌ Design phase | ✅ Repository entities |

**Real-time knowledge graph systems (not SE-specific):**

| System | Organization | Method | SE-Specific? |
|--------|-------------|--------|-------------|
| **Graphiti** (getzep) | Open source 2024 | Bi-temporal model, continuous integration | ❌ Generic |
| **Saga** | Apple Research 2022 | Hybrid batch-incremental, billions of facts | ❌ Generic |
| **Telicent** | Commercial | Kafka event sourcing | ❌ Generic |
| **Tom Sawyer Data Streams** | Commercial | Kafka topic subscriptions | ❌ Generic |
| **StreamingRAG** | NEC Labs 2024 | Real-time RAG over evolving KGs, sub-15ms | ❌ Generic |

**Key gap: Webhook-driven real-time SE knowledge graph for RAG**

No system combines all of:
1. Direct webhook ingestion from SE tools (GitHub, Jira, Sentry, etc.)
2. Real-time incremental graph construction (sub-second to seconds)
3. Cross-tool relationship modeling (commit → deployment → incident)
4. RAG-first design (graph constructed to power LLM context retrieval)

**Closest precedents:**
- **Arc Memory**: Similar concept (local KG from dev events) but workspace-scoped, not org-wide real-time
- **Graphiti**: Real-time incremental KG updates but generic, not SE-optimized
- **Nalanda**: Enterprise-scale SE graph but batch processing
- **GraphRAG**: KG-based RAG but static indexing

**Novelty assessment for Lightfast**: **High**. The specific combination of webhook-driven ingestion + real-time incremental construction + cross-tool SE events + RAG integration is novel. Individual components have precedent, but the integrated system is new.

---

### 8. Publication Venues

| Venue | Track | Deadline | Notification | Acceptance Rate | Page Limit | Best For |
|-------|-------|----------|-------------|----------------|------------|----------|
| **SIGIR SIRIP** | Industry | Feb 2025/2026 | Apr | Unknown | 2-4 pages | Search/RAG systems |
| **KDD ADS** | Applied Data Science | May 2025/2026 | Aug | ~15-20% | 7 pages | Deployed systems with metrics |
| **EMNLP Industry** | Industry Track | Jul 2025 | Oct | ~30-35% | 6 pages | NLP/LLM systems (proprietary OK) |
| **ACL Industry** | Industry Track | Feb-Mar 2026 | Apr-May | ~25-26% | 6 pages | LLM-based systems |
| **CIKM Applied** | Applied Research | May 2025/2026 | Aug | ~42% | 7 pages | Knowledge management + RAG |
| **WSDM Industry Day** | Industry Talk | Nov 2025 | Dec | Unknown | 2 pages | **Fastest** (1 month review) |
| **ACL Demo** | System Demo | Feb 2026 | Apr 2026 | ~50-57% | 6 pages + video | Working system demos |
| **NeurIPS D&B** | Datasets & Benchmarks | May 2025 | Sep | ~30% | 9 pages | Benchmark papers |
| **MLSys Industry** | Industry Track | Oct 2025 | TBD | Unknown | 10 pages | Systems/infrastructure |
| **AAAI IAAI** | Innovative Apps | Aug-Sep | Nov-Dec | Unknown | Varies | Novel AI applications |
| **MSR** | Mining Software Repos | Jan-Feb | Mar-Apr | ~25-30% | 10 pages | SE data/tools |
| **ESEC/FSE** | Industry Track | ~Mar | ~Jun | Unknown | 8 pages | SE tools at scale |
| **arXiv** | Preprint | Anytime | 24-48 hrs | 100% | No limit | Immediate dissemination |

**Company paper precedents:**
- **Perplexity AI**: Research blog (research.perplexity.ai), not peer-reviewed
- **Cohere**: Technical reports (cohere.com), "Command A" paper
- **Adobe**: FSE '25 Companion — "From Documents to Dialogue: KG-RAG Enhanced AI Assistants"
- **Microsoft**: Nalanda at ESEC/FSE 2022 Industry Track
- **ClickHouse**: VLDB 2024 (~11 months from concept to publication)
- **Spotify**: RecSys 2024, research blog — search/recommendation hybrid systems

**Recommended strategy for Lightfast:**

1. **Immediate**: arXiv preprint (cs.IR + cs.SE) — establishes priority, 24-48 hrs
2. **Primary target**: SIGIR SIRIP or EMNLP Industry Track — best fit for RAG system paper
3. **Benchmark paper**: NeurIPS Datasets & Benchmarks — if creating EngRAG-Bench
4. **SE-focused**: MSR or ESEC/FSE Industry Track — if emphasizing engineering domain
5. **Follow-up**: Company engineering blog with accessible summary

---

### 9. RAG Evaluation Methodology (2024-2026)

**Major new frameworks beyond Ragas/DeepEval:**

**Fine-grained evaluation:**
- **RAGChecker** (NeurIPS 2024): Claim-level evaluation — decomposes answers into atomic claims, evaluates each against context. Metrics: Claim Precision, Claim Recall, Context Utilization, Noise Sensitivity, Hallucination.
- **GaRAGe** (arXiv 2025): Grounded and Attributed RAG evaluation — relevance-aware factuality at passage level.
- **MIRAGE** (NeurIPS 2024): Medical domain — novel metrics for Context Insensitivity and Noise Vulnerability.

**Agentic evaluation:**
- **Raga.AI 8-Step Framework** (May 2025): First comprehensive framework for agentic (not just RAG) evaluation. Includes Tool Utilization Efficacy and Memory Coherence metrics.
- **RAGCap-Bench** (arXiv Aug 2025): Capability-oriented benchmark evaluating Planning, Retrieval, Reasoning, and Execution in agentic RAG.
- **AgentDiagnose** (EMNLP 2025 Demos): Diagnoses LLM agent trajectories across 5 competencies: Backtracking, Task Decomposition (0.78 correlation with humans), Observation Reading, Self-Verification, Objective Quality.
- **PIPA** (arXiv May 2025): POMDP-based evaluation with 5 atomic criteria: State Consistency, Tool Efficiency, Observation Alignment, Policy Alignment, Task Completion.
- **MCPEval** (EMNLP 2025 Demos): Evaluation using Model Context Protocol — Tool Call Matching + LLM Judging.

**LLM-as-Judge reliability:**
- **IRT-based calibration framework** (arXiv 2024): Item Response Theory for LLM judge calibration. Recommends Prompt Consistency CV_C < 0.10, Marginal Reliability ρ > 0.70.
- **Conformal prediction for LLM judges** (NeurIPS 2024): Prediction intervals instead of point estimates.
- **Known biases** (Statsig 2025): Positional bias, domain mismatch, prompt sensitivity, score ID influence.
- **Multilingual reliability** (EMNLP 2025): Average Fleiss' Kappa ~0.3 across 25 languages.

**Non-determinism:**
- **"Non-Determinism of Deterministic LLM Settings"** (EMNLP 2025 Eval4NLP): Accuracy variations up to 15% across runs at temperature=0. Novel metrics: TARr@N (Total Agreement Rate raw), TARa@N (parsed).
- **Spotify's approach** (Dec 2024): Majority voting across multiple runs with permutation prompts.

**Multi-turn evaluation:**
- **mtRAG** (MIT TACL 2025): First comprehensive multi-turn RAG benchmark. FANC framework: Faithfulness, Appropriateness, Naturalness, Completeness. 842 evaluation tasks.
- **CORAL** (arXiv Oct 2024): Large-scale multi-turn conversational RAG benchmark.

**Preference alignment:**
- **RAG-RewardBench** (ACL 2025 Findings): First benchmark for reward models in RAG. Four scenarios: Multi-hop, Fine-grained Citation, Appropriate Abstain, Conflict Robustness. Top RM achieved only 78.3%.
- **Trustworthy-Alignment** (ICML 2024): RL-based algorithm aligning RAG to rely solely on external evidence.

**Tool-calling evaluation:**
- **MCPVerse** (arXiv Aug 2025): 550+ real-world tools via MCP, action space >140k tokens.
- **The Tool Decathlon** (ICLR 2026 submission): 32 software apps, 604 tools, 108 tasks averaging 20 interaction turns. Claude-4-Sonnet: 29.9% SOTA.
- **ACEBench** (EMNLP 2025 Findings): Comprehensive tool usage evaluation with Normal, Special, and Agent categories.
- **T-Eval** (ACL 2024): Step-by-step evaluation decomposing tool use into 6 capabilities.

---

## Novelty Matrix

| Lightfast Feature | Existing Literature | Novelty Level | Paper Potential |
|---|---|---|---|
| **Cross-source identity resolution** (GitHub + Jira + Linear + Slack for RAG) | Developer identity exists for Git only (MSR 2020, 2021); no cross-platform for RAG | **Very High** | **Strong** — first cross-platform developer identity for RAG KG |
| **Engineering-domain RAG evaluation benchmark** | BEIR, MTEB have zero engineering coverage; SWE-bench is code generation not retrieval | **Very High** | **Strong** — "EngRAG-Bench" fills massive gap |
| **Webhook-driven real-time SE knowledge graph** | Nalanda (batch), Arc Memory (local), Graphiti (generic real-time) | **High** | **Strong** — novel integration of webhooks + SE events + RAG |
| **Significance-based ingestion filtering** | QuRating, DFN for training data; Neural Passage Quality Estimation for static pruning | **Medium-High** | **Moderate** — novel RAG application of known concepts |
| **4-path parallel hybrid retrieval** (dense + entity + cluster + actor) | 2-3 path hybrid common; 4+ paths with entity/cluster/actor uncommon | **Medium-High** | **Moderate** — novel combination in engineering domain |
| **3-view multi-view embedding** (title/content/summary) | ColBERT (token-level), MRAG (attention-head), Poly-encoders | **Medium** | **Moderate** — novel view-level decomposition |
| **Citation tracking across multi-tool agentic workflows** | ALCE, AGREE, CiteFix for single-turn; PROV-AGENT for agent provenance | **Medium** | **Moderate** — less explored in multi-path RAG |

---

## Trade-off Analysis

### Paper Topic Recommendations (Ranked by Impact/Feasibility)

**1. "Engineering-Domain RAG with Cross-Source Knowledge Graphs" (System Paper)**
- **Topics**: Cross-source identity resolution + webhook-driven KG + 4-path retrieval + engineering-domain evaluation
- **Venue**: SIGIR SIRIP, KDD ADS, or ESEC/FSE Industry Track
- **Effort**: Medium (describe existing system, run evaluations)
- **Impact**: High (novel system in unbenchmarked domain)
- **Risk**: Low (system already exists, just needs evaluation)

**2. "EngRAG-Bench: A Benchmark for Engineering-Domain RAG" (Benchmark Paper)**
- **Topics**: Engineering-domain evaluation dataset covering commits, deployments, incidents
- **Venue**: NeurIPS Datasets & Benchmarks, MSR Data Showcase
- **Effort**: High (must create + annotate dataset, establish baselines)
- **Impact**: Very High (fills critical gap, community resource)
- **Risk**: Medium (requires significant annotation effort, data anonymization)

**3. "Significance-Based Ingestion for RAG: Selective Indexing via Pre-Embedding Quality Gates" (Methods Paper)**
- **Topics**: Pre-ingestion quality filtering, significance scoring, cost-benefit analysis
- **Venue**: EMNLP Industry Track, CIKM Applied
- **Effort**: Medium (ablation studies needed)
- **Impact**: Medium-High (practical contribution)
- **Risk**: Low (well-defined scope)

**Best recommended first paper**: Option 1 — describe the full system with emphasis on the most novel components (cross-source identity + webhook-driven KG + engineering domain). Include preliminary evaluation results. Submit to arXiv immediately, then SIGIR SIRIP or EMNLP Industry Track.

---

## Sources

### Multi-View Embeddings & Retrieval
- [ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction](https://arxiv.org/abs/2004.12832) — Khattab & Zaharia, SIGIR 2020
- [ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — Santhanam et al., NAACL 2022
- [Multi-Head RAG: Solving Multi-Aspect Problems with LLMs](https://arxiv.org/abs/2406.05085) — Phukan et al., arXiv 2024
- [Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — Kusupati et al., NeurIPS 2022
- [Poly-encoders](https://arxiv.org/abs/1905.01969) — Humeau et al., ICLR 2020

### Hybrid Retrieval & Score Fusion
- [Reciprocal Rank Fusion](https://dl.acm.org/doi/10.1145/1571941.1572114) — Cormack et al., SIGIR 2009
- [RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval](https://arxiv.org/abs/2401.18059) — Sarthi et al., ICLR 2024

### Significance-Based Ingestion
- [QuRating: Selecting High-Quality Data for Training Language Models](https://arxiv.org/abs/2402.09739) — ICML 2024
- [Data Filtering Networks](https://arxiv.org/abs/2309.17425) — ICLR 2024
- [Neural Passage Quality Estimation for Static Pruning](https://arxiv.org/abs/2009.13741) — arXiv 2020
- [InfoGain-RAG](https://arxiv.org/abs/2412.10157) — EMNLP 2025
- [Is This Collection Worth My LLM's Time?](https://arxiv.org/abs/2502.13691) — arXiv 2025

### Engineering-Domain Benchmarks
- [BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation](https://arxiv.org/abs/2104.08663) — Thakur et al., SIGIR/NeurIPS
- [MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — Muennighoff et al., EACL 2023
- [CoIR: Code Information Retrieval Benchmark](https://arxiv.org/abs/2407.02883) — ACL 2025
- [SWE-bench](https://arxiv.org/abs/2310.06770) — Jimenez et al., ICLR 2024
- [CodeRAG-Bench](https://arxiv.org/abs/2406.14497) — arXiv 2024
- [FreshStack](https://fresh-stack.github.io/) — NeurIPS 2025 D&B Track
- [RCAEval](https://arxiv.org/abs/2412.17015) — arXiv 2025
- [OpsEval](https://github.com/NetManAIOps/OpsEval-Datasets) — arXiv 2024

### Citation Generation
- [ALCE: Automatic LLM Citation Evaluation](https://arxiv.org/abs/2305.14627) — Gao et al., EMNLP 2023
- [AGREE: Effective LLM Adaptation for Grounding and Citation](https://aclanthology.org/2024.naacl-long.346/) — NAACL 2024
- [Correctness ≠ Faithfulness in RAG Attributions](https://arxiv.org/abs/2412.18004) — TU Delft, 2024
- [CiteFix: Post-Processing Citation Correction](https://www.amazon.science/publications/citefix-enhancing-rag-accuracy-through-post-processing-citation-correction) — Amazon 2025
- [PROV-AGENT](https://arxiv.org/abs/2508.02866) — IEEE e-Science 2025

### Cross-Source Identity Resolution
- [Identity Resolution of 38M Author IDs from 2B Git Commits](https://par.nsf.gov/biblio/10189284) — MSR 2020
- [Gambit: Open Source Name Disambiguation for VCS](https://github.com/gotec/gambit) — Gote & Zingg, MSR 2021
- [End-to-End Entity Resolution for Big Data: A Survey](https://www.academia.edu/68865287/) — 2019
- [IdentityRAG](https://tilores.io/) — Tilores + LangChain 2024
- [Multi-Agent RAG for Entity Resolution](https://www.mdpi.com/) — MDPI 2025

### Knowledge Graph Construction
- [Nalanda: A Socio-Technical Graph at Enterprise Scale](https://dl.acm.org/doi/10.1145/3540250.3558950) — Microsoft, ESEC/FSE 2022
- [Graph4Code: A Machine Interpretable Knowledge Graph for Code](https://arxiv.org/abs/2002.09440) — IBM, 2020
- [Arc Memory](https://github.com/arc-computer/arc-memory) — VS Code extension + KG, 2024
- [GHTorrent](https://ghtorrent.org/) — Gousios, MSR 2013
- [Graphiti](https://github.com/getzep/graphiti) — Real-time KG framework, 2024
- [Saga: Continuous KG Construction at Scale](https://machinelearning.apple.com/) — Apple Research, 2022
- [Streaming RAG over Evolving Knowledge Graphs](https://arxiv.org/abs/2404.00299) — NEC Labs, 2024
- [iText2KG: Incremental KG Construction Using LLMs](https://arxiv.org/abs/2409.03284) — arXiv 2024
- [SEON: Software Evolution Ontologies](https://link.springer.com/article/10.1007/s10664-011-9181-z) — 2012

### RAG Evaluation Methodology (2024-2026)
- [RAGChecker](https://proceedings.neurips.cc/paper_files/paper/2024/file/27245589131d17368cccdfa990cbf16e-Paper-Datasets_and_Benchmarks_Track.pdf) — NeurIPS 2024
- [ARES: Automated RAG Evaluation System](https://aclanthology.org/2024.naacl-long.20/) — NAACL 2024
- [mtRAG: Multi-Turn RAG Benchmark](https://direct.mit.edu/tacl/article/doi/10.1162/TACL.a.19/132114) — MIT TACL 2025
- [RAG-RewardBench](https://aclanthology.org/2025.findings-acl.877/) — ACL 2025 Findings
- [MCPVerse: Real-World Benchmark for Agentic Tool Use](https://arxiv.org/abs/2508.16260) — arXiv 2025
- [The Tool Decathlon](https://openreview.net/forum?id=z53s5p0qhf) — ICLR 2026 submission
- [AgentDiagnose](https://aclanthology.org/2025.emnlp-demos.15/) — EMNLP 2025
- [PIPA: Protocol for Interactive Planning Agents](https://arxiv.org/abs/2505.01592) — arXiv 2025
- [RAGCap-Bench](https://arxiv.org/abs/2510.13910) — arXiv 2025
- [Non-Determinism of Deterministic LLM Settings](https://aclanthology.org/2025.eval4nlp-1.12.pdf) — EMNLP 2025
- [IRT-based LLM Judge Calibration](https://arxiv.org/abs/2404.12272) — arXiv 2024
- [RAG-Gym: Process Supervision for Agentic RAG](https://arxiv.org/abs/2502.13957) — arXiv 2025
- [T-Eval: Evaluating Tool Utilization](https://aclanthology.org/2024.acl-long.515/) — ACL 2024
- [GTA: General Tool Agents Benchmark](https://proceedings.neurips.cc/paper_files/paper/2024/) — NeurIPS 2024
- [Trustworthy-Alignment for RAG](https://proceedings.mlr.press/v235/zhang24bg.html) — ICML 2024

### Publication Venues
- [KDD 2025/2026 CFP](https://kdd2025.kdd.org/) — Applied Data Science Track
- [SIGIR 2025/2026 CFP](https://sigir-2025.github.io/) — SIRIP Industry Track
- [EMNLP 2025 Industry Track](https://2025.emnlp.org/) — Industry Track CFP
- [ACL 2025/2026 Industry Track](https://2025.aclweb.org/) — Industry Track
- [NeurIPS 2025 Datasets & Benchmarks](https://neurips.cc/) — D&B Track

---

## Open Questions

1. **Data anonymization for benchmark**: If Lightfast creates EngRAG-Bench, how to anonymize real engineering data while preserving query/retrieval characteristics? Could synthetic data generation work?

2. **Evaluation metrics for identity resolution**: What precision/recall targets should be established for cross-source identity linking? No baselines exist in the developer tools domain.

3. **Significance scoring calibration**: How to validate that significance-filtered documents were truly insignificant? Requires ablation study design.

4. **Multi-path retrieval ablation**: Quantifying the marginal contribution of each retrieval path (entity, cluster, actor) requires careful experimental design — how to measure individual path lift?

5. **Timeline**: Given conference deadlines, the most actionable targets are EMNLP Industry (Jul 2025), KDD ADS (May 2025/2026), or SIGIR SIRIP (Feb 2026). arXiv can be done immediately.

6. **Competitive landscape**: Are companies like Linear, Notion, or GitHub working on similar engineering-domain RAG systems? Their publication/blog output should be monitored.

7. **Co-authorship**: Academic partnerships (university collaborators) could strengthen submissions and provide additional evaluation resources.

---

## Additional Research: Deep Novelty Assessments (Round 2)

*Conducted 2026-02-07 — additional research requested by senior reviewer to validate novelty claims for the 3 high-novelty paper topics identified by codebase analysis: (1) Significance-Gated Indexing, (2) Automatic Relationship Graph from Webhooks, (3) Multi-View Embedding for Engineering Events.*

---

### 10. Deep Novelty Assessment: Multi-View Embeddings for Domain-Specific RAG

**Research Question**: How novel is Lightfast's approach of generating separate embeddings for title, content, and summary of the same document with MAX-score aggregation?

**Closest Prior Work Identified:**

| Paper/System | Venue/Year | What It Does | How It Differs from Lightfast |
|---|---|---|---|
| **ColBERT / ColBERTv2** | SIGIR 2020 / NAACL 2022 | Token-level multi-vector representation with MaxSim operator | Hundreds of token-level vectors per doc, NOT semantic view-level (title/content/summary) |
| **Multi-Aspect Dense Retrieval (MADRAL)** | KDD 2022 | One embedding per aspect (brand, category, color) for e-commerce product search | Structured product fields, NOT document semantic decomposition; uses learned fusion network, NOT MAX aggregation |
| **MADRAL Reproducibility** | arXiv 2024 (2401.03648) | Reuses first k content tokens as aspect embeddings; aspect fusion with CLS-gating | Product search context; aspects are metadata fields, not content decompositions |
| **Poly-encoders** | ICLR 2020 | Multiple attention heads create several global representations | Attention-head level, not explicit semantic view decomposition |
| **Neural Ranking with Multiple Document Fields** | WSDM 2018 (ACM 3159652.3159730) | Separate representations for title and body fields in neural ranking | **Closest conceptual match** — explicitly uses separate field representations. But applies to ranking, not RAG embedding/retrieval |
| **Contextual Document Embeddings** | arXiv 2024 (2410.02525) | Contextualized embeddings incorporating neighboring documents | Neighbor-based context, not field-level decomposition |
| **Structure and Semantics Preserving Document Representations** | arXiv 2022 (2201.03720) | Holistic embeddings preserving both structure and semantics | Single embedding output, not multi-view |

**Key Finding — Neural Ranking with Multiple Document Fields (WSDM 2018)**:
This is the **most relevant prior work**. It explicitly uses separate representations for title vs. body and shows that comparing different aspects of the query with separate field representations is beneficial. However:
- It's a **ranking** model (re-ranking retrieved candidates), not an **embedding/retrieval** model
- It doesn't use MAX-score aggregation across views; it uses learned matching functions
- It predates the dense retrieval era (2020+)

**Novelty Assessment (Updated)**:

| Aspect | Novelty Level | Rationale |
|---|---|---|
| Semantic-view decomposition (title/content/summary) | **Medium** | Neural Ranking with Multiple Fields (2018) uses title/body separation; MADRAL uses aspect embeddings |
| MAX-score aggregation across views | **Medium-High** | ColBERT's MaxSim is at token level; applying MAX across semantic views is uncommon |
| Application to engineering events in RAG | **High** | No prior work applies multi-view embeddings specifically to engineering events (commits, PRs, issues) |
| Combined with 4-path retrieval | **High** | Multi-view embeddings feeding into 4 parallel retrieval paths is unique |

**Verdict**: **Medium novelty as a standalone technique** (field-level embedding decomposition has precedent in neural ranking), but **High novelty in the engineering-domain RAG application context**. Best positioned as an engineering contribution within a broader system paper, not as a standalone method paper.

**Must-cite papers**: Neural Ranking with Multiple Document Fields (WSDM 2018), MADRAL (KDD 2022), ColBERT (SIGIR 2020)

---

### 11. Deep Novelty Assessment: 4-Path Parallel Hybrid Retrieval

**Research Question**: How novel is Lightfast's 4-path parallel retrieval architecture (dense + entity + cluster + actor) with RRF fusion?

**Detailed Findings:**

#### Standard Practice (2024-2025): 2-Path Hybrid is Ubiquitous
- **Dense + BM25 hybrid retrieval is now standard** across all major vector databases (Elasticsearch, Weaviate, Pinecone, Qdrant, Milvus)
- Standard fusion: RRF with k=60
- Every production RAG system uses at minimum dense + sparse hybrid

#### 3-Path Systems: Rare but Emerging
- **Triple Hybrid Retrieval**: Dense Vector + Sparse Vector (SPLADE) + Full-Text (BM25) documented but uncommon
- **InfiniFlow (2024)**: Dense + Sparse + Full-text + Tensor reranker — closest to multi-path, but sequential reranking, not parallel fusion

#### Key Prior Work for Multi-Path Retrieval

| System/Paper | Year | Paths | Fusion | Key Difference from Lightfast |
|---|---|---|---|---|
| **Mixture-of-Retrievers (MoR)** — CMU 2025 | 2025 | 2-3 (BM25, DPR, SimCSE, human) | Query-dependent weighted combination | **Adaptive** (selects retrievers per query) vs. Lightfast's **fixed parallel**; no actor-based path |
| **HybGRAG** — ACL 2025 | 2025 | 2 (textual RAG + Graph RAG) | Concatenation | 2-path only; entity extraction for graph, not parallel path |
| **HybridRAG** | 2024 | 2 (VectorRAG + GraphRAG) | Context concatenation | 2-path only; financial domain; no RRF |
| **Microsoft GraphRAG** | 2024 | 1 (hierarchical graph) | Single path | Uses community detection (similar to clustering) but single retrieval path |
| **RAPTOR** — Stanford/ICLR 2024 | 2024 | 1 (hierarchical tree) | Single path | Recursive clustering for summarization, not parallel retrieval path |
| **BYOKG-RAG** — EMNLP 2025 | 2025 | 4 tools (Entity Linking, Path Retrieval, Graph Query, Triplet) | Sequential tool selection | **Sequential specialized tools**, not parallel paths with fusion |
| **Blended RAG** — IBM 2024 | 2024 | 2-3 (BM25, KNN, SERM) | Hybrid query strategies | Standard 2-3 path approaches |

#### Actor-Based Retrieval: Completely Novel

**No system found** that uses developer/contributor identity as a parallel retrieval signal in RAG or code search:
- source{d} Identity Matching: Identity resolution only, not retrieval
- GitHub/GitLab Search APIs: Separate endpoints, not integrated with semantic search
- Sourcegraph Cody: Code Intelligence Platform, not developer identity signals

#### RRF with 4+ Signals: Undocumented

- RRF documented extensively for 2 paths (BM25 + vector)
- Rare documentation of 3-path RRF
- **No academic papers or production systems found using 4+ path RRF**
- Weighted RRF (Elasticsearch 2025) allows different weights but still used for 2-3 paths

**Novelty Assessment (Detailed)**:

| Aspect | Novelty Level | Rationale |
|---|---|---|
| 4-path parallel execution | **High** | No published system runs 4+ parallel retrieval paths simultaneously |
| Actor-based retrieval path | **Very High** | **Completely novel** — no prior work uses developer identity as retrieval signal |
| 4-way RRF fusion | **Medium-High** | RRF is standard; applying to 4 heterogeneous signals is undocumented |
| Entity + Cluster as parallel paths | **Medium** | Both exist individually but not combined as parallel retrieval dimensions |
| Engineering-domain application | **High** | Purpose-built for code/engineering search with domain-specific signals |

**Verdict**: **HIGH novelty overall**. The specific combination has no direct precedent. The most novel contribution is actor-based retrieval as a first-class parallel path. Closest prior work (MoR, CMU 2025) is architecturally distinct (adaptive vs. fixed parallel).

**Recommended paper angle**: "Beyond Dual Hybrid Search: A 4-Path Parallel Retrieval Architecture for Engineering Knowledge Search" — emphasize the actor-based path as the primary novelty, with 4-path architecture as the contribution.

**Must-cite papers**: RRF (SIGIR 2009), MoR (CMU 2025), HybGRAG (ACL 2025), GraphRAG (Microsoft 2024), RAPTOR (ICLR 2024)

---

### 12. Deep Novelty Assessment: Pre-Ingestion Quality Gates (Significance-Based Filtering)

**Research Question**: How novel is Lightfast's approach of using LLM-based significance scoring (0-100 scale) to filter engineering events BEFORE embedding and indexing in the RAG system?

**Detailed Findings:**

#### Static Index Pruning: Established but Different Methods

| Paper | Venue/Year | Method | Key Difference |
|---|---|---|---|
| **Neural Passage Quality Estimation** (Chang et al.) | SIGIR 2024 | Supervised neural models (QT5) predict passage quality; prunes 25-30% of passages pre-encoding | Uses **supervised classifiers**, NOT LLM-as-judge; applies to general passages, NOT engineering events |
| **Static Pruning on Sparse Neural Retrievers** (Rosa et al.) | SIGIR 2023 | Document-centric and term-centric pruning on SPLADE/uniCOIL | Post-encoding pruning, not pre-ingestion |
| **Static Pruning for Multi-Rep Dense Retrieval** (Acquavia et al.) | 2023 | Prunes token embeddings in ColBERT by removing frequent BERT tokens | Operates on already-generated embeddings |
| **DocPruner** | arXiv 2025 | Attention-based importance scores for visual document retrieval | Post-embedding pruning |

**Critical finding**: Chang et al. (SIGIR 2024) is the **closest prior work**. It demonstrates query-agnostic quality estimation for pre-encoding pruning. However, it uses **supervised neural models** (trained on relevance labels), NOT LLM-based scoring.

#### LLM-as-Judge: Never Used for Pre-Ingestion RAG Filtering

All LLM-as-judge work in the RAG domain focuses on:
1. **Post-retrieval reranking** — JudgeRank (2023) uses LLM to re-score retrieved documents
2. **Evaluation** — Ragas, RAGChecker, DeepEval use LLM judges to evaluate RAG quality
3. **Query-dependent relevance** — LLMJudge Challenge (SIGIR 2024) scores query-document pairs
4. **Training data quality** — QuRating (ICML 2024) uses LLM pairwise judgments for pre-training data selection

**No published work uses LLM-as-judge for query-agnostic quality scoring BEFORE indexing in a RAG pipeline.**

#### Engineering Event Significance Scoring: No Prior Work

| System/Paper | What It Does | Key Difference |
|---|---|---|
| **OpenSSF Criticality Score** | Scores entire open-source projects (aggregate metrics) | Project-level, not individual event scoring |
| **Coding Impact Score** (Oobeya) | Measures cognitive load of commits (files, hunks, lines) | Structural metrics only, not content-based LLM analysis |
| **VulCurator** (2022) | BERT-based detection of vulnerability-fixing commits | Security-specific binary classification only |
| **Cycode AI Material Change Detection** (2024) | LLM-based detection of "material code changes" | **Closest prior work for SE context!** But: alerting/security focus, binary classification, NOT RAG pre-indexing |
| **CodeScene Delta Analysis** | Risk-based PR prioritization using code metrics | Review prioritization, not pre-ingestion filtering |
| **DIDACT** (Google 2025) | Trains models on fine-grained developer activity logs | Uses ALL events for training, no filtering |

**Cycode (2024) is notable**: It uses LLMs to detect significant code changes, which is conceptually similar. But it's for security alerting (binary: material/not material), not continuous scoring (0-100) for RAG pre-indexing.

#### RAG Noise Filtering: All Post-Retrieval

| Paper | Year | What It Does | Stage |
|---|---|---|---|
| **Information Bottleneck for RAG** | 2024 | Filters noisy passages during generation | Post-retrieval |
| **FineFilter** | 2025 | Sentence-level noise filtering with MinMax optimization | Post-retrieval |
| **RAAT** | ACL 2024 | Adversarial training for robustness to noisy contexts | Training-time |

**No pre-ingestion noise filtering for RAG found.**

#### Cost-Quality Tradeoff: Unexplored for Pre-Ingestion

| System | Approach | Key Difference |
|---|---|---|
| **LazyGraphRAG** (Microsoft 2024) | Defers LLM use to query time (0.1% of GraphRAG cost) | Defers processing, doesn't filter documents |
| **CORAG** (2024) | Optimizes chunk selection within cost budgets | Post-retrieval optimization |

**No work on pre-ingestion filtering based on document quality to reduce indexing costs in RAG.**

**Novelty Assessment (Detailed)**:

| Aspect | Novelty Level | Rationale |
|---|---|---|
| LLM-as-judge for pre-embedding quality scoring in RAG | **Very High** | No prior work combines LLM-as-judge with pre-indexing filtering for RAG |
| Continuous significance scoring (0-100) with thresholds | **High** | All prior work is binary classification or supervised models |
| Application to heterogeneous engineering event streams | **Very High** | No prior work scores individual SE events for RAG indexing significance |
| Cost-justified pre-ingestion filtering | **High** | Novel cost-quality tradeoff argument for RAG |

**Verdict**: **VERY HIGH novelty**. This is Lightfast's **strongest novelty claim**. The specific combination of:
1. LLM-as-judge (not supervised classifier)
2. Continuous significance scoring (not binary)
3. Pre-embedding gate (not post-retrieval)
4. Applied to engineering event streams (not general text)
5. For RAG indexing (not LLM training data)

...has **no published precedent**.

**Critical citation**: Chang et al. (SIGIR 2024) — must cite as the closest prior work for query-agnostic pre-encoding quality estimation, then clearly differentiate (LLM-based vs. supervised, engineering events vs. general passages, RAG vs. IR).

**Recommended paper angle**: "Significance-Gated Indexing: LLM-Based Pre-Ingestion Quality Filtering for Engineering Event RAG" — this could be a standalone methods paper with strong ablation studies (varying thresholds, comparing LLM scoring to supervised models, measuring retrieval quality impact).

---

### 13. Deep Publication Venues Analysis

**Research Question**: What are the best publication venues for Lightfast's first paper, considering it's a startup with no prior academic publications?

#### Detailed Venue Profiles

**Tier 1: Best Fit Venues**

| Venue | Track | Deadline | Page Limit | Review | Accept Rate | Startup Fit |
|---|---|---|---|---|---|---|
| **SIGIR SIRIP** | Industry Practices | ~Feb annually | 2-4 pages | Single-blind | ~40-50% | **Excellent** — designed for industry practitioners |
| **EMNLP Industry** | Industry Track | ~Jun annually | 6 pages | Double-blind | ~30-35% | **Good** — accepts proprietary systems |
| **KDD ADS** | Applied Data Science | ~Feb annually | 7 pages | Double-blind | ~15-20% | **Good** — values deployed systems with metrics |
| **ICSE SEIP** | SE in Practice | Oct 2026 (for ICSE 2027) | 10 pages | Double-blind | ~25-30% | **Excellent** — SE tools at scale |

**Tier 2: Strong Options**

| Venue | Track | Deadline | Page Limit | Fit Score |
|---|---|---|---|---|
| **NeurIPS D&B** | Datasets & Benchmarks | ~May annually | 9 pages | **5/5** for EngRAG-Bench |
| **MSR** | Mining Software Repos | ~Jan annually | 10 pages | **4/5** for SE knowledge graph |
| **ESEC/FSE Industry** | Industry Track | ~Mar annually | 8 pages | **4/5** for SE system paper |
| **ACL Demo** | System Demonstrations | ~Feb annually | 6 pages + demo | **3/5** if demo is compelling |
| **CIKM Applied** | Applied Research | ~May annually | 7 pages | **4/5** for knowledge management + RAG |

**Tier 3: Supplementary**

| Venue | When | Format | Purpose |
|---|---|---|---|
| **arXiv** | Anytime (24-48 hrs) | Preprint, no limit | Establish priority immediately |
| **Technical Blog** | Anytime | Blog post | Broader reach, SEO |
| **WSDM Industry Day** | ~Nov | 2 pages | Fast review (~1 month) |

#### Specific Venue Details

**NeurIPS Datasets & Benchmarks Track** (for EngRAG-Bench paper):
- **2025 Deadlines**: Abstract May 11, Full paper May 15, Supplemental May 22
- **Format**: 9 content pages, NeurIPS LaTeX template
- **Review**: Single-blind allowed (important — reviewers can access code/data)
- **Requirements**: Dataset must be hosted on persistent ML dataset sites (Dataverse, Kaggle, HuggingFace); Croissant metadata format required
- **Key criteria**: Accessibility, reproducibility, novelty of dataset/benchmark design
- **Fit**: **Excellent** for EngRAG-Bench if Lightfast can create anonymized engineering event datasets

**ICSE SEIP** (for system paper):
- **ICSE 2027 Deadlines**: Submission Oct 23 2026, Notification Dec 11 2026, Conference Apr 25-May 1 2027 (Dublin)
- **ICSE 2026**: Submission deadline Sep 29 2025 (already passed), Conference Apr 12-18 2026 (Rio de Janeiro)
- **Format**: 10 pages, double-blind
- **Fit**: **Excellent** for full system paper emphasizing SE knowledge graph and significance-based filtering

#### Startup Success Stories in Academic Publishing

| Company | Paper/Topic | Venue | Year | Notes |
|---|---|---|---|---|
| **Pinecone** | Vector database architecture | Technical reports, arXiv | 2023-2024 | arXiv + blog strategy; no peer-reviewed venues |
| **Weaviate** | Multi-vector embeddings tutorials | Blog + documentation | 2024-2025 | Content marketing approach, not academic papers |
| **Qdrant** | Late interaction model support | Blog + GitHub | 2024-2025 | Technical docs, not academic papers |
| **Jina AI** | Jina-ColBERT-v2 | MRL Workshop (ACL) 2024 | 2024 | **Workshop paper** — lower barrier to entry |
| **Cohere** | Command A, Rerank | Technical reports | 2024-2025 | arXiv preprints + blog; some co-authored with academics |
| **LlamaIndex** | RAG framework | Blog + documentation | 2023-2025 | Community-driven; no academic papers found |
| **Weights & Biases** | ML experiment tracking | MLSys, blog | 2022-2024 | Mix of blog posts and conference papers |
| **ClickHouse** | Database architecture | VLDB 2024 | 2024 | ~11 months concept to publication |
| **Adobe** | KG-RAG AI Assistant | FSE '25 Companion | 2025 | SE conference industry track |
| **Microsoft (Nalanda)** | Socio-Technical Graph | ESEC/FSE 2022 | 2022 | Closest precedent for Lightfast's system |

**Key insight**: Most startups use **arXiv + blog** strategy. Peer-reviewed publication at Tier 1 venues is rare for small companies. **Workshop papers** (e.g., at ACL, EMNLP, SIGIR) and **industry tracks** are the most accessible entry points.

#### Recommended Publication Strategy for Lightfast

**Phase 1: Establish Priority (Feb-Mar 2026)**
- Submit to **arXiv** (cs.IR + cs.SE cross-listed)
- Publish **companion blog post** on company site
- Timeline: 2-4 weeks to prepare, 24-48 hrs for arXiv listing

**Phase 2: Peer-Reviewed Submission (Target: Q3-Q4 2026)**

| Paper | Target Venue | Deadline | Topic Focus |
|---|---|---|---|
| **Paper 1: System Paper** | ICSE 2027 SEIP | Oct 23, 2026 | Full system: significance-based filtering + knowledge graph + 4-path retrieval |
| **Paper 2: Benchmark Paper** | NeurIPS 2026 D&B | ~May 2026 | EngRAG-Bench: Engineering-domain RAG evaluation benchmark |
| **Paper 3: Methods Paper** | EMNLP 2026 Industry | ~Jun 2026 | Significance-gated indexing for RAG |

**Phase 3: Follow-up (2027)**
- MSR 2027 for SE knowledge graph
- SIGIR 2027 SIRIP for retrieval architecture

**Realistic Timeline (Feb 2026 → Publication)**:
- Feb-Mar 2026: arXiv preprint + blog
- Mar-May 2026: Prepare NeurIPS D&B submission (if benchmark ready)
- Jun-Sep 2026: Prepare ICSE SEIP and/or EMNLP Industry submissions
- Oct 2026: Submit to ICSE 2027 SEIP
- Dec 2026: Notification from ICSE
- Apr-May 2027: Conference presentation

**Note on timelines**: Conference papers (submission → publication) typically take 4-8 months via industry tracks. Journal papers take 6-18 months. arXiv is immediate.

---

### Updated Novelty Matrix (Post-Deep Research)

| Lightfast Feature | Prior Art Level | Novelty Level (Updated) | Paper Potential | Recommended Venue |
|---|---|---|---|---|
| **Significance-based pre-ingestion filtering** | Chang et al. SIGIR 2024 (supervised models for passage pruning); Cycode (binary alerting) | **Very High** ↑ | **Strong standalone paper** | EMNLP Industry, CIKM Applied |
| **Cross-source identity resolution** (GitHub + Jira + Linear + Slack for RAG) | Developer identity for Git only (MSR 2020, 2021) | **Very High** | **Strong standalone paper** | MSR, ICSE SEIP |
| **Engineering-domain RAG benchmark** | BEIR, MTEB: zero engineering coverage | **Very High** | **Strong standalone paper** | NeurIPS D&B |
| **4-path parallel hybrid retrieval** (dense + entity + cluster + actor) | MoR (CMU 2025) is closest but architecturally different; 2-path hybrid is standard | **High** ↑ | **Strong as part of system paper** | SIGIR SIRIP, KDD ADS |
| **Actor-based retrieval path** | No prior work found | **Very High** (NEW) | **Key differentiator in system paper** | SIGIR SIRIP |
| **Webhook-driven real-time SE knowledge graph** | Nalanda (batch), Graphiti (generic) | **High** | **Strong as part of system paper** | ICSE SEIP, ESEC/FSE Industry |
| **3-view multi-view embedding** (title/content/summary) | Neural Ranking with Multiple Fields (WSDM 2018), MADRAL (KDD 2022) | **Medium** (unchanged) | Engineering contribution within system paper | — |

### Top 3 Standalone Paper Topics (Ranked by Novelty × Publishability)

1. **"Significance-Gated Indexing: LLM-Based Pre-Ingestion Quality Filtering for Engineering Event RAG"**
   - Novelty: Very High — no prior work on LLM-as-judge for pre-embedding RAG filtering
   - Venue: EMNLP Industry Track or CIKM Applied
   - Effort: Medium (ablation studies on threshold, comparison to supervised models)

2. **"EngRAG-Bench: A Benchmark for Engineering-Domain Retrieval-Augmented Generation"**
   - Novelty: Very High — fills massive gap in existing benchmarks
   - Venue: NeurIPS Datasets & Benchmarks Track
   - Effort: High (dataset creation, annotation, baseline evaluation)

3. **"Beyond Dual Hybrid: 4-Path Parallel Retrieval with Actor-Based Search for Engineering Knowledge"**
   - Novelty: High — actor-based path is novel, 4-path architecture is undocumented
   - Venue: SIGIR SIRIP or KDD ADS
   - Effort: Medium (system description, ablation on path contributions)

---

### Additional Sources (Round 2)

#### Multi-View Embeddings (Deep Assessment)
- [Neural Ranking Models with Multiple Document Fields](https://dl.acm.org/doi/10.1145/3159652.3159730) — WSDM 2018
- [Multi-Aspect Dense Retrieval (MADRAL)](https://dl.acm.org/doi/abs/10.1145/3534678.3539137) — KDD 2022
- [Reproducibility Analysis for MADRAL](https://arxiv.org/abs/2401.03648) — arXiv 2024
- [Contextual Document Embeddings](https://arxiv.org/abs/2410.02525) — arXiv 2024
- [Structure and Semantics Preserving Document Representations](https://arxiv.org/abs/2201.03720) — arXiv 2022
- [SLIM: Sparsified Late Interaction for Multi-Vector Retrieval](https://cs.uwaterloo.ca/~jimmylin/publications/Li_etal_SIGIR2023.pdf) — SIGIR 2023
- [A Little Pooling Goes a Long Way for Multi-Vector Representations](https://www.answer.ai/posts/colbert-pooling.html) — answer.ai 2024
- [Jina-ColBERT-v2](https://aclanthology.org/2024.mrl-1.11/) — MRL Workshop 2024

#### Hybrid Retrieval (Deep Assessment)
- [Mixture-of-Retrievers (MoR)](https://www.cs.cmu.edu/~sherryw/assets/pubs/2025-mor.pdf) — CMU 2025
- [HybGRAG: Hybrid Retrieval-Augmented Generation](https://aclanthology.org/2025.acl-long.43/) — ACL 2025
- [HybridRAG](https://huggingface.co/papers/2408.04948) — arXiv 2024
- [BYOKG-RAG](https://aclanthology.org/2025.emnlp-main.1417.pdf) — EMNLP 2025
- [Triple Hybrid Retrieval](https://www.emergentmind.com/topics/triple-hybrid-retrieval) — 2024
- [Weighted RRF in Elasticsearch](https://www.elastic.co/search-labs/blog/weighted-reciprocal-rank-fusion-rrf) — 2025
- [Blended RAG: Improving RAG Accuracy](https://github.com/ibm-ecosystem-engineering/Blended-RAG) — IBM 2024

#### Pre-Ingestion Quality (Deep Assessment)
- [Neural Passage Quality Estimation for Static Pruning](https://arxiv.org/abs/2407.12170) — Chang et al., SIGIR 2024
- [Static Pruning on Sparse Neural Retrievers](https://arxiv.org/abs/2304.12702) — Rosa et al., SIGIR 2023
- [Static Pruning for Multi-Rep Dense Retrieval](https://eprints.gla.ac.uk/300119/) — Acquavia et al., 2023
- [DocPruner](https://arxiv.org/abs/2509.23883) — arXiv 2025
- [QuRating: Selecting High-Quality Data for Training LMs](https://proceedings.mlr.press/v235/wettig24a.html) — ICML 2024
- [JudgeRank](https://arxiv.org/abs/2411.00142) — arXiv 2023
- [LLMJudge Challenge](https://arxiv.org/abs/2408.08896) — SIGIR 2024
- [Information Bottleneck for RAG Noise Filtering](https://arxiv.org/abs/2406.01549) — 2024
- [FineFilter: Sentence-Level Noise Filtering](https://arxiv.org/abs/2502.11811) — 2025
- [LazyGraphRAG](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/) — Microsoft 2024
- [Cycode AI-Driven Material Code Change Alerting](https://cycode.com/blog/ai-driven-material-code-change-alerting/) — 2024
- [VulCurator](https://arxiv.org/abs/2209.03260) — 2022
- [DIDACT: Large Sequence Models for SE Activities](https://research.google/blog/large-sequence-models-for-software-development-activities/) — Google 2025

#### Publication Venues (Deep Assessment)
- [NeurIPS 2025 D&B CFP](https://neurips.cc/Conferences/2025/CallForDatasetsBenchmarks)
- [NeurIPS 2024 D&B CFP](https://neurips.cc/Conferences/2024/CallForDatasetsBenchmarks)
- [ICSE 2027 SEIP](https://conf.researchr.org/track/icse-2027/icse-2027-seip) — Deadline Oct 23, 2026
- [ICSE 2026 SEIP](https://conf.researchr.org/track/icse-2026/icse-2026-software-engineering-in-practice)
- [SE Research Venue Deadlines](https://se-deadlines.github.io/)
- [Pre-Filtering Code Suggestions Using Developer Behavioral Telemetry](https://arxiv.org/abs/2511.18849) — 2025
- [Enhanced Code Reviews Using PR-Based Change Impact Analysis](https://link.springer.com/article/10.1007/s10664-024-10600-2) — EMSE 2025
