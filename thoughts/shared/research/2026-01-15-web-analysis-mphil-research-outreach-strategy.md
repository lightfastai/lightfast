---
date: 2026-01-15T14:30:00+11:00
researcher: Claude Code (Opus 4.5)
topic: "MPhil Research Outreach Strategy - Lab Analysis, Email Best Practices, and Lightfast-to-Research Positioning"
tags: [research, mphil, agent-memory, academic-outreach, rag, hybrid-retrieval, unimelb, monash]
status: complete
created_at: 2026-01-15
confidence: high
sources_count: 45+
related_document: thoughts/shared/research/2026-01-15-agent-memory-research-pitch-architecture-extraction.md
---

# Web Research: MPhil Research Outreach Strategy

**Date**: 2026-01-15T14:30:00+11:00
**Topic**: Lab analysis, email outreach best practices, and positioning Lightfast for academic research
**Confidence**: High - Based on official university pages, Google Scholar profiles, and peer-reviewed methodology guides

## Research Question

Based on the agent memory architecture extraction document, we need to:
1. Understand each target research lab deeply (UniMelb, Monash)
2. Analyze what each supervisor actually researches
3. Determine optimal email outreach structure for each
4. Understand how Lightfast's production system can become valuable research
5. Refine positioning strategies for each lab

---

## Executive Summary

**Key Findings:**

1. **Tim Miller has moved to UQ** (2022) - still honorary at UniMelb but primarily at University of Queensland. His "Evaluative AI" research (hypothesis-driven decision support) remains highly relevant to agent memory explainability.

2. **Monash has the strongest direct fit** - Teresa Wang's work on "Personalized LLM-based IR on Textual and Relational Knowledge Bases" and Yuan-Fang Li's "Reasoning on Graphs" research directly address hybrid retrieval over structured+unstructured data.

3. **Aldeida Aleti has a project titled exactly "LLM models for learning and retrieving software knowledge"** - exceptional alignment with Lightfast's domain.

4. **Academic email structure must lead with research question, not system** - Frame Lightfast as evidence of research capability, cite specific papers, and propose how your work addresses gaps they've identified.

5. **Evaluation is the key research gap** - Enterprise RAG evaluation frameworks are underrepresented in literature. Lightfast's unmeasured retrieval quality represents a publishable research agenda.

---

## Part 1: University of Melbourne - Lab Analysis

### Critical Update: Tim Miller Now at UQ

**Current Status**: Moved to University of Queensland (2022) as TIET-UQ Chair of Data Science
- **UQ Profile**: https://about.uq.edu.au/experts/41328
- **UQ Lab**: https://uqtmiller.github.io/
- **Melbourne Status**: Honorary Professor (supervising capacity unclear)

**Implication**: If targeting Tim Miller specifically, consider UQ application pathway instead.

### AgentLab Research Themes

**URL**: https://cis.unimelb.edu.au/research/agentlab

**Current Focus Areas**:
1. Explainable AI (XAI) - Human-centered explanation as interaction
2. Multi-agent collaboration and teamwork
3. Human-agent teaming (shared mental models)
4. Mine scheduling optimization

**Research Gap for Agent Memory**: No explicit work on "agent memory" in LLM contexts - this is an opportunity to propose novel research combining their XAI expertise with memory system explainability.

### Supervisor Analysis: UniMelb

#### Tim Miller (UQ, Honorary UniMelb)

| Aspect | Details |
|--------|---------|
| **Research Focus** | Explainable AI, hypothesis-driven decision support, human-agent interaction |
| **Key Recent Paper** | "Explainable AI is Dead, Long Live Explainable AI!" (2023, 228 citations) |
| **Distinctive Angle** | "Evaluative AI" - systems provide evidence for/against human decisions rather than recommendations |
| **Student Availability** | No funded positions at UQ; must demonstrate strong alignment |
| **Google Scholar** | https://scholar.google.com/citations?user=7koVt4EAAAAJ |

**Relevance to Agent Memory**: His evaluative AI framework maps directly to how agent memory systems should present retrieved information - not as black-box answers but as evidence supporting/refuting hypotheses.

**Pitch Angle**: "How should agent memory systems present retrieved evidence to support human hypothesis evaluation?"

#### Liz Sonenberg (UniMelb)

| Aspect | Details |
|--------|---------|
| **Position** | Professor, PVC Systems Innovation |
| **Research Focus** | Multi-agent systems, collaboration, BDI agents, shared mental models |
| **Key Work** | "Argumentation-based negotiation" (761 citations), "Towards socially sophisticated BDI agents" (260 citations) |
| **Distinctive Angle** | Social reasoning in agent architectures |
| **Profile** | https://findanexpert.unimelb.edu.au/profile/16012-liz-sonenberg |

**Relevance to Agent Memory**: Collaborative agent settings where memory must be shared across agents; how agents maintain shared understanding of engineering knowledge.

**Pitch Angle**: "How do AI coding agents share and maintain collective memory of engineering decisions?"

#### Tim Baldwin (UniMelb + MBZUAI)

| Aspect | Details |
|--------|---------|
| **Position** | Provost at MBZUAI, Melbourne Laureate Professor |
| **Research Focus** | LLM safety/evaluation, uncertainty quantification, tool retrieval |
| **Key Recent Paper** | "ToolGen: Unified Tool Retrieval and Calling via Generation" (2024) |
| **Distinctive Angle** | Knowing when to trust AI outputs (uncertainty quantification) |
| **Profile** | https://eltimster.github.io/www/ |

**Relevance to Agent Memory**: Critical for knowing when retrieved information is reliable. His work on LLM truthfulness directly applies to grounded answer generation.

**Pitch Angle**: "How can uncertainty quantification improve reliability of retrieved engineering knowledge?"

#### Trevor Cohn (UniMelb)

| Aspect | Details |
|--------|---------|
| **Research Focus** | Multilingual NLP, model security (backdoor attacks), knowledge graphs |
| **Key Recent Paper** | "Pre-training Cross-lingual Open Domain Question Answering with Large-scale Synthetic Supervision" (2024) |
| **Distinctive Angle** | Security and robustness in NLP systems |
| **Profile** | https://trevorcohn.github.io/ |

**Relevance to Agent Memory**: Cross-lingual knowledge retrieval, knowledge graph completion, security of retrieval systems.

**Pitch Angle**: "Robust retrieval systems that resist adversarial manipulation of engineering knowledge"

#### Jey Han Lau (UniMelb)

| Aspect | Details |
|--------|---------|
| **Position** | Senior Lecturer |
| **Research Focus** | Factual consistency, dialogue summarization, misinformation detection |
| **Key Recent Paper** | "Factual Dialogue Summarization via Learning from Large Language Models" (COLING 2025) |
| **Distinctive Angle** | Maintaining factual accuracy when compressing/retrieving conversational history |
| **Profile** | https://jeyhan.my/ |

**Relevance to Agent Memory**: Directly applicable - how to compress and retrieve conversational/engineering history while maintaining factual accuracy.

**Pitch Angle**: "Factually faithful summarization of engineering decisions and incidents for agent memory"

### UniMelb MPhil Requirements

| Requirement | Details |
|-------------|---------|
| **Academic** | 4-year Bachelor's or equivalent, >75% in final year, 25%+ research component |
| **Duration** | 2 years (thesis: 30,000-40,000 words) |
| **Supervision** | Minimum 2 supervisors required |
| **Process** | Find supervisor FIRST → secure in-principle support → formal application |
| **Research Proposal** | 600 words required |
| **Funding** | RTP (Research Training Program) for domestic; competitive |

**Application Portal**: https://study.unimelb.edu.au/find/courses/graduate/master-of-philosophy-engineering-and-it/

---

## Part 2: Monash University - Lab Analysis

### Monash Has Strongest Direct Alignment

Monash's Faculty of IT has researchers working on exactly the problems Lightfast addresses:
- Hybrid retrieval over textual + relational knowledge
- Neuro-symbolic reasoning
- LLMs for software engineering knowledge

### Supervisor Analysis: Monash

#### Teresa Wang (Senior Lecturer)

| Aspect | Details |
|--------|---------|
| **Research Focus** | Entity/user modeling, relational ML, graph networks, recommender systems |
| **Key Active Project** | "Personalized LLM based Information Retrieval/Recommendation on Textual and Relational Knowledge Bases" |
| **Distinctive Angle** | Hybrid KB retrieval (structured + unstructured) for personalization |
| **Profile** | https://supervisorconnect.it.monash.edu/supervisors/teresa-wang |
| **Google Scholar** | http://scholar.google.com/citations?user=jCziD10AAAAJ |

**Key Recent Publications**:
- "Multi-hop knowledge graph reasoning in few-shot scenarios" (IEEE TKDE, 2024)
- "HiTSKT: hierarchical transformer model for session-aware knowledge tracing" (KBS, 2024)
- "Neural epistemic network analysis" (LAK, 2024)

**Why This Is Strong Fit**:
Her project description: "leverage LLMs to handle complex queries requiring retrieval from knowledge bases blending unstructured (textual) and structured (relational) information, especially for private knowledge sources."

This is literally what Lightfast does.

**Pitch Angle**: "Production hybrid retrieval over private engineering knowledge - evaluation and optimization strategies"

#### Lizhen Qu (Senior Lecturer)

| Aspect | Details |
|--------|---------|
| **Research Focus** | Neuro-symbolic AI, causality, trustworthy AI, privacy-preserving AI |
| **Key Project** | HARNESS: Hierarchical Abstractions and Reasoning for Neuro-Symbolic Systems (2023-2027) |
| **Distinctive Angle** | Compositional reasoning combining neural and symbolic approaches |
| **Profile** | https://supervisorconnect.it.monash.edu/supervisors/lizhen-qu |
| **Google Scholar** | https://scholar.google.com/citations?user=cHXZgHUAAAAJ |

**Key Recent Publications**:
- "NEUSIS: A Compositional Neuro-Symbolic Framework for Autonomous Perception, Reasoning, and Planning" (IEEE RA-L, 2025)
- "IRIS: An Iterative and Integrated Framework for Verifiable Causal Discovery" (2025)
- "Scalable Frame-based Construction of Sociocultural NormBases for Socially-Aware Dialogues" (2024)

**Why This Is Relevant**:
Lightfast's entity extraction + graph-like references + vector retrieval is implicitly neuro-symbolic. His work on verification and trustworthy AI addresses faithfulness concerns.

**Pitch Angle**: "Verifiable retrieval in neuro-symbolic agent memory systems"

#### Yuan-Fang Li (Associate Professor) - Additional Key Researcher

| Aspect | Details |
|--------|---------|
| **Research Focus** | Knowledge graphs + LLM reasoning |
| **Key Paper** | "Reasoning on Graphs: Faithful and Interpretable LLM Reasoning" (ICLR 2024) |
| **Breakthrough** | "Graph-constrained Reasoning" (ICML 2025) - 100% faithful reasoning ratio |
| **Profile** | https://users.monash.edu.au/~yli/ |
| **Google Scholar** | https://scholar.google.com/citations?user=wufXO1kAAAAJ |

**Why This Is Critical**:
His GCR framework eliminates hallucinations by constraining LLM decoding with KG structure. Directly addresses Lightfast's grounded answer generation goals.

**Pitch Angle**: "Graph-constrained reasoning for faithful software engineering knowledge retrieval"

#### Aldeida Aleti (Professor)

| Aspect | Details |
|--------|---------|
| **Position** | Full Professor, Associate Dean of Engagement and Impact |
| **Research Focus** | LLMs for SE, automated testing, program repair |
| **Exact Project Match** | "LLM models for learning and retrieving software knowledge" |
| **Profile** | https://supervisorconnect.it.monash.edu/supervisors/aldeida-aleti |
| **Google Scholar** | https://scholar.google.com.au/citations?hl=en&user=BfyTWc8AAAAJ |

**Key Recent Publications**:
- "From Domain Documents to Requirements: Retrieval-Augmented Generation in the Space Industry" (2025)
- "Enabling Cost-Effective UI Automation Testing with Retrieval-Based LLMs" (2024)
- "Artificial Intelligence for Software Engineering: The Journey So Far and the Road Ahead" (TOSEM, 2025)

**Her Active Project Description**:
> "Fine-tune existing LLMs using data from software repositories so they can answer queries related to software development tasks, such as selecting design patterns, identifying quality attributes, and timing refactoring actions."

**Why This Is Exceptional Alignment**:
Her project is exactly about software engineering knowledge retrieval - the Lightfast domain.

**Pitch Angle**: "Team-scale software knowledge retrieval - beyond individual developer to organizational memory"

### Monash MPhil Requirements

| Requirement | Details |
|-------------|---------|
| **Academic** | 4-year Bachelor's with H2B (65%+) in honours year, or Master's with research component |
| **English** | IELTS 6.5 overall (no band <6.0) |
| **Process** | Submit EOI via Supervisor Connect → prepare cover letter + CV + transcripts → contact supervisor |
| **Proposal** | 5 pages maximum |
| **Supervision** | Principal + co-supervisor required |

**Application Portal**: https://supervisorconnect.it.monash.edu/

---

## Part 3: Email Outreach Best Practices

### The AIDA Framework for Academic Emails

| Section | Purpose | Word Count |
|---------|---------|------------|
| **Anchor** | Who you are | 1 sentence |
| **Bridge** | Specific point from their work that grabbed you | 1-2 sentences |
| **Value** | What you bring (specific, quantifiable) | 1-2 sentences |
| **Ask** | Clear request | 1 sentence |

**Total Target**: 120-200 words (max 300)

### What Professors Want to See

**DO**:
- Cite a specific recent paper and explain connection to your work
- Identify a gap/limitation they mentioned and propose how you address it
- Use quantifiable metrics about your system
- Ask 1-2 thoughtful questions about their research
- Attach CV (always)

**DON'T**:
- Say "I admire your work" without specifics
- Send a long autobiography
- Ask questions answered on their website
- Mass-mail (professors can tell)
- Focus only on your achievements without connecting to their work

### Industry Professional Positioning

**Lead with research question, not system**:

❌ Wrong: "I built Lightfast, a production RAG system..."

✅ Right: "I read your ICML paper on graph-constrained reasoning. You noted that enterprise retrieval evaluation remains challenging. In building a production memory system for software teams, I've implemented hybrid retrieval with entity grounding but identified several open questions around evaluation methodology..."

**Frame system as evidence**:
- "I've implemented this at scale (handling X requests/day), which gives me a strong foundation to investigate [research question] rigorously"
- Use the system to demonstrate capability, not as the contribution itself

### Subject Line Best Practices

**Good Examples**:
- "Prospective MPhil: Hybrid Retrieval Evaluation Methodology"
- "MPhil Inquiry: Alignment on Graph-Constrained Reasoning for Enterprise RAG"
- "Research Inquiry: Agent Memory Evaluation Frameworks"

**Avoid**:
- "Research Opportunity Please"
- "Question"
- "PhD/MPhil Application"

### Australian-Specific Considerations

| Factor | Australian System |
|--------|-------------------|
| **Coursework** | None - immediate research start |
| **Duration** | 2 years MPhil |
| **Supervision** | 2+ supervisors required |
| **Examination** | Written defence (no oral viva) |
| **Application** | Year-round, but scholarship rounds have deadlines |
| **Funding** | RTP scholarships (competitive), self-funding allowed |

**Scholarship Deadlines**:
- Round 1: Late October
- Round 2: Late January
- Round 3: Mid-May

---

## Part 4: Positioning Lightfast for Research

### What Makes Production Systems Publishable

**Three Contribution Types**:

1. **Empirical Contribution**: Systematic analysis of production data/patterns
   - Example: Google's analysis of 10,000+ ML pipelines (SIGMOD 2021)
   - For Lightfast: Patterns in software engineering knowledge retrieval

2. **Methodological Contribution**: Novel algorithm validated in production
   - Example: Meta's Dynamic Communication Thresholding (KDD)
   - For Lightfast: Four-path hybrid retrieval, multi-view embeddings

3. **Testbed/System Contribution**: Infrastructure enabling future research
   - Example: EnronQA benchmark for personalized RAG
   - For Lightfast: Benchmark for team engineering knowledge retrieval

### Key Research Gap: Evaluation

**The Critical Opportunity**:
Your document notes: "No systematic evaluation framework has been implemented - retrieval quality, faithfulness, and user utility remain unmeasured."

This IS the research contribution.

**Published Evaluation Frameworks**:
- ARES (NAACL 2024): Synthetic training + prediction-powered inference
- VERA (2024): Cross-encoder mechanism + bootstrap statistics
- CoFE-RAG (2024): Multi-granularity keywords across pipeline
- RAGBench + TRACe (2024): 100k examples across 5 domains

**What's Missing** (Your Opportunity):
- Enterprise/private data RAG evaluation
- Software engineering domain benchmarks
- Team-scale (vs. individual developer) knowledge retrieval
- Temporal knowledge evolution evaluation

### Lightfast → Research Paper Pathways

#### Pathway 1: Evaluation Framework Paper

**Target Venues**: SIGIR, ACL workshops, EMNLP
**Contribution Type**: Methodological

**Framing**: "EKRAG-SE: An Evaluation Framework for Enterprise Software Engineering Knowledge Retrieval"
- Define metrics for retrieval quality in SE domain
- Compare existing frameworks on software corpus
- Propose domain-specific evaluation dimensions

**Required Work**:
- Implement evaluation pipeline in Lightfast
- Create sanitized benchmark dataset (or use public SE data)
- Compare to ARES, VERA, CoFE-RAG baselines

#### Pathway 2: Multi-View Embeddings Study

**Target Venues**: SIGIR, EMNLP
**Contribution Type**: Empirical

**Framing**: "Multi-View Embeddings for Software Engineering Knowledge: A Production Study"
- When do title/content/summary views differ in utility?
- Optimal view combination strategies
- Domain-specific findings for SE

**Required Work**:
- A/B testing on view selection
- Ablation studies (single view vs. multi-view)
- Analysis of query types and optimal views

#### Pathway 3: Hybrid Retrieval Analysis

**Target Venues**: SIGIR, WWW, WSDM
**Contribution Type**: Empirical/Methodological

**Framing**: "Four-Path Hybrid Retrieval: Lessons from Production Software Knowledge Search"
- Which paths contribute most for which query types?
- Optimal fusion strategies (score vs. rank vs. learned)
- When does entity/actor/cluster search add value?

**Required Work**:
- Path contribution analysis
- Fusion strategy comparison
- Efficiency vs. accuracy trade-offs

#### Pathway 4: Benchmark Dataset (Resource Track)

**Target Venues**: SIGIR resource track, ACL
**Contribution Type**: Testbed

**Framing**: "SEMemory: A Benchmark for Team Software Engineering Knowledge Retrieval"
- Sanitized/synthetic dataset from SE domain
- Query types: debugging, architecture decisions, incident resolution
- Baseline results and evaluation protocol

**Required Work**:
- Data sanitization/synthesis pipeline
- Query taxonomy for SE
- Baseline implementations
- Public release

### Specific Research Questions by Lab

#### For Teresa Wang (Monash RAG/IR)

1. How to evaluate retrieval quality over private engineering corpora without public benchmarks?
2. What fusion strategy optimizes recall vs. precision across heterogeneous retrieval paths?
3. How does personalization (actor profiles) affect retrieval relevance in team settings?

#### For Lizhen Qu (Monash Neuro-Symbolic)

1. Can entity-grounded retrieval reduce hallucination in answer generation?
2. How to extend short-hop graph reasoning (1-2 hops) to deeper causal chains?
3. What verification mechanisms can ensure faithfulness of retrieved answers?

#### For Yuan-Fang Li (Monash KG+LLM)

1. How to apply graph-constrained reasoning to implicit entity graphs (without explicit graph DB)?
2. Can knowledge graph completion improve cross-reference linking in observations?
3. What's the optimal structure for representing software engineering knowledge as graphs?

#### For Aldeida Aleti (Monash SE+LLM)

1. How do multi-view embeddings improve software knowledge retrieval over single-view?
2. What evaluation frameworks measure utility of SE knowledge retrieval for developers?
3. How should team-scale knowledge differ from individual developer code retrieval?

#### For Tim Baldwin (UniMelb NLP)

1. How to quantify uncertainty in retrieved software engineering knowledge?
2. When should agents trust retrieved information vs. seek clarification?
3. What are the truthfulness guarantees for grounded answer generation?

---

## Part 5: Revised Positioning Strategies

### Original Pitch Analysis

From your document:

**Option A (UniMelb AgentLab)**: "I've built a production memory system for AI coding agents..."
**Option B (Monash RAG/IR)**: "I've built a hybrid retrieval system combining dense vectors, entity search..."
**Option C (Monash SE+LLMs)**: "I've built a memory layer for software teams..."

**Problem**: All three lead with "I've built" - engineering framing, not research framing.

### Revised Positioning

#### For Teresa Wang (Monash - Recommended First Contact)

**Subject**: Prospective MPhil: Evaluation Methods for Hybrid Knowledge Retrieval

**Email**:

Dear Dr Wang,

I am [Name], a software engineer at [Company], writing to inquire about MPhil supervision in retrieval over hybrid knowledge bases.

Your current project on "Personalized LLM-based Information Retrieval on Textual and Relational Knowledge Bases" directly addresses challenges I've encountered in production: how to retrieve effectively when queries require both semantic similarity and entity/relational matching across private engineering data.

Over the past year, I've implemented a four-path hybrid retrieval system combining dense vectors, entity-grounded search, topic clusters, and actor profiles. The system operates at scale (N observations, K queries/day), but I've identified a critical gap: no rigorous evaluation framework exists for team-scale software engineering knowledge retrieval.

I am seeking to investigate evaluation methodology for hybrid retrieval over private corpora, and I believe my production foundation combined with your expertise in relational knowledge bases would enable rigorous research in this space.

I have attached my CV and would welcome the opportunity to discuss alignment with your current work.

Best regards,
[Name]

**Word count**: ~175

#### For Yuan-Fang Li (Monash - If Interested in Graph Reasoning)

**Subject**: MPhil Inquiry: Graph-Constrained Reasoning for Engineering Knowledge

**Email**:

Dear Associate Professor Li,

I read your ICLR 2024 paper on "Reasoning on Graphs" and was particularly struck by your finding that explicit KG structure enables faithful LLM reasoning with interpretable paths.

I am exploring how these principles apply to implicit knowledge graphs. In building a memory system for software engineering teams, I've implemented entity extraction and typed references that create graph-like structure without an explicit graph database (observations linked via commit references, PR mentions, actor profiles). Current reasoning is limited to 1-2 hops via database JOINs.

Your recent GCR framework achieving 100% faithful reasoning suggests potential for extending this to deeper causal chains in software engineering contexts (e.g., "why did this deployment fail?" requiring multi-hop traversal across incidents, code changes, and decisions).

I am seeking MPhil supervision to investigate graph-constrained reasoning over implicit knowledge graphs, and I believe my production system provides a strong empirical foundation.

I have attached my CV and would be grateful for the opportunity to discuss potential alignment.

Best regards,
[Name]

**Word count**: ~170

#### For Aldeida Aleti (Monash SE - If Interested in SE Domain)

**Subject**: MPhil Inquiry: Team-Scale Software Knowledge Retrieval

**Email**:

Dear Professor Aleti,

Your project on "LLM models for learning and retrieving software knowledge" resonated strongly with challenges I've been tackling in production.

I read your recent TOSEM paper on "AI for Software Engineering" and noted the emphasis on retrieval-augmented approaches. In my work, I've built a system that ingests GitHub events, deployments, and incidents, creating multi-view embeddings and extracting entities to serve hybrid search over team engineering knowledge.

However, I've identified a gap: current SE+LLM research focuses on individual developer code retrieval, while team-scale knowledge (decisions, incidents, architectural context) remains underexplored. My system serves team queries but lacks rigorous evaluation frameworks.

I am seeking to investigate evaluation and optimization of team-scale software knowledge retrieval, extending beyond individual code search to organizational engineering memory. Your expertise in SE+AI would be invaluable.

I have attached my CV and would welcome discussion of potential alignment with your research agenda.

Best regards,
[Name]

**Word count**: ~165

---

## Part 6: Recommended Action Plan

### Priority Order (Based on Fit)

1. **Teresa Wang** (Monash) - Direct project alignment, accessible via Supervisor Connect
2. **Aldeida Aleti** (Monash) - Exact domain match, actively accepting students
3. **Yuan-Fang Li** (Monash) - Strong theoretical fit if interested in graph reasoning
4. **Lizhen Qu** (Monash) - If interested in neuro-symbolic/verification angle
5. **Jey Han Lau** (UniMelb) - If interested in factual consistency angle
6. **Tim Baldwin** (UniMelb/MBZUAI) - If interested in uncertainty quantification

### Timeline

| Date | Action |
|------|--------|
| **Week 1** | Read 2-3 recent papers from top 3 supervisors |
| **Week 1-2** | Draft tailored emails for each |
| **Week 2** | Send first 3 emails (Monash priority) |
| **Week 3-4** | Follow up if no response after 10 days |
| **Late Jan** | If seeking Round 2 scholarship: prepare formal application |
| **Ongoing** | Implement evaluation framework in Lightfast (strengthens position) |

### Preparation Checklist

- [ ] Read Teresa Wang's hybrid knowledge base paper (2024)
- [ ] Read Yuan-Fang Li's ICLR 2024 "Reasoning on Graphs"
- [ ] Read Aldeida Aleti's TOSEM 2025 AI for SE paper
- [ ] Prepare 2-page research proposal draft
- [ ] Update CV with Lightfast technical details framed as research
- [ ] Prepare GitHub/demo if possible to share
- [ ] Draft 5-page Monash research proposal

### What Would Strengthen Your Position

1. **Implement basic evaluation** in Lightfast now - even simple metrics strengthen credibility
2. **Write an arXiv preprint** about multi-view embeddings or hybrid retrieval findings
3. **Prepare sanitized benchmark** - even 1000 queries/answers over public SE data
4. **Quantify production metrics** - actual numbers (queries/day, latency, recall@k if measured)

---

## Sources

### University of Melbourne

- AgentLab: https://cis.unimelb.edu.au/research/agentlab
- NLP Group: https://cis.unimelb.edu.au/research/artificial-intelligence/research/Natural-Language-Processing/
- MPhil Application: https://study.unimelb.edu.au/find/courses/graduate/master-of-philosophy-engineering-and-it/
- Find a Supervisor: https://research.unimelb.edu.au/study/supervisors

### Monash University

- Supervisor Connect: https://supervisorconnect.it.monash.edu/
- Teresa Wang Profile: https://research.monash.edu/en/persons/teresa-wang/
- Lizhen Qu Profile: https://research.monash.edu/en/persons/lizhen-qu/
- Yuan-Fang Li: https://users.monash.edu.au/~yli/
- Aldeida Aleti: https://research.monash.edu/en/persons/aldeida-aleti/
- How to Approach Supervisors: https://www.monash.edu/__data/assets/pdf_file/0011/1442846/How-to-approach-potential-supervisors.pdf

### Tim Miller (UQ)

- UQ Profile: https://about.uq.edu.au/experts/41328
- Lab Page: https://uqtmiller.github.io/
- Student Guidance: https://uqtmiller.github.io/students/

### Academic Email Best Practices

- Medium Guide: https://medium.com/@sibgat2/how-to-email-professors-for-graduate-school-dos-and-don-ts
- Columbia Template: https://e3b.columbia.edu/wp-content/uploads/2022/05/Email-Template-for-Prospective-Grad-Students-to-PI.pdf
- Kshitij Tiwari Cold Email: https://kshitijtiwari.com/cold-email/

### Research Publications

- "Reasoning on Graphs" (ICLR 2024): https://arxiv.org/abs/2310.01061
- "Graph-constrained Reasoning" (ICML 2025): https://proceedings.mlr.press/v267/luo25t.html
- ARES Framework (NAACL 2024): https://arxiv.org/abs/2311.09476
- Multi-View Document Representation (ACL 2022): https://aclanthology.org/2022.acl-long.349/

### RAG Evaluation Frameworks

- VERA (2024): Cross-encoder + bootstrap evaluation
- RAGBench + TRACe (2024): 100k examples, 5 domains
- CoFE-RAG (2024): Multi-granularity evaluation
- EKRAG (ACL 2025): Enterprise knowledge RAG benchmark

---

**Last Updated**: 2026-01-15
**Confidence Level**: High - Based on official profiles, published papers, and verified application requirements
**Next Steps**: Draft personalized emails, read recommended papers, prepare research proposal
