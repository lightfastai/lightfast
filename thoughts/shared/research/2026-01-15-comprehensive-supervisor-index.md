---
date: 2026-01-15T17:00:00+11:00
researcher: Claude Code (Opus 4.5)
topic: "Comprehensive Australian Supervisor Index for Agent Memory Research"
tags: [research, mphil, supervisors, agent-memory, agentic-workflows, australia, unimelb, monash, uq, rmit, unsw, anu]
status: complete
created_at: 2026-01-15
confidence: high
sources_count: 100+
related_documents:
  - thoughts/shared/research/2026-01-15-agent-memory-research-pitch-architecture-extraction.md
  - thoughts/shared/research/2026-01-15-web-analysis-mphil-research-outreach-strategy.md
---

# Comprehensive Australian Supervisor Index

**Date**: 2026-01-15
**Purpose**: Complete index of potential MPhil/PhD supervisors across Australian universities, ranked by alignment with agent memory research for agentic workflows

## Core Research Framing

**Lightfast is a memory subsystem for agentic workflows** - enabling AI coding agents and engineering teams to search, retrieve, and reason over engineering knowledge (code, PRs, incidents, decisions).

The research question is NOT just "how to build better RAG" but:

> **"What memory architecture enables effective AI agents for software engineering?"**

This reframes the problem from retrieval optimization to **agent capability research**.

## Alignment Criteria (Agent-Centric)

Supervisors are evaluated against these research dimensions:

### Primary (Agent Architecture)
1. **Agent memory as capability** - How memory enables agent behavior
2. **Agent planning & reasoning** - How retrieval integrates with agent decision-making
3. **Multi-agent collaboration** - How agents share and synchronize knowledge
4. **Explainable agent decisions** - How agents explain memory-based reasoning

### Secondary (Memory Implementation)
5. **Hybrid retrieval systems** - Dense + lexical + graph + actor search
6. **Knowledge representation** - How to structure engineering knowledge
7. **Grounded generation** - Faithful answers with source citations
8. **Software engineering domain** - Code, PRs, incidents, architectural decisions

### Tertiary (Evaluation & Quality)
9. **Evaluation methodology** - How to measure agent memory effectiveness
10. **Faithfulness & trust** - Ensuring agents retrieve and use knowledge correctly

---

## TIER 1: EXCEPTIONAL ALIGNMENT (Priority Outreach)

These researchers work directly on agent architectures, memory, or closely related problems.

### 1.1 University of Melbourne - AI and Autonomy Lab

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **1** | **Adrian Pearce** | Professor | Multi-agent planning, epistemic reasoning, RL | AgentLab co-director, belief-based planning | [Profile](https://people.eng.unimelb.edu.au/adrianrp/) |
| **2** | **Liz Sonenberg** | Professor | Multi-agent collaboration, shared mental models, BDI agents | "Towards socially sophisticated BDI agents", joint intention | [Profile](https://people.eng.unimelb.edu.au/lizs/) |
| **3** | **Nir Lipovetzky** | Assoc Professor | Automated planning, heuristic search, width-based planning | How planning integrates with knowledge retrieval | [Website](https://nirlipo.github.io/) |

**Why AgentLab is Tier 1**:
- They understand what agents need to function effectively
- Memory is a foundational capability for agent planning and collaboration
- Research angle: "How does memory architecture affect agent behavior?"
- You bring the memory implementation; they bring the agent theory

**Research Questions for AgentLab**:
- How should agents organize long-term engineering knowledge?
- What memory retrieval strategies support different agent tasks (debugging vs. architecture)?
- How does memory structure affect collaboration between human and AI agents?
- How do agents decide what to remember, forget, or summarize?

### 1.2 University of Queensland - XAI & Agent Decision Support

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **4** | **Tim Miller** | Professor | Explainable AI, hypothesis-driven decision support, human-agent interaction | "Evaluative AI" framework, 7400+ citations on XAI | [Lab](https://uqtmiller.github.io/) |
| **5** | **Guido Zuccon** | Professor | Information retrieval, dense retrieval, LLMs for systematic reviews | ielab director, collaborates with Miller | [ielab](https://ielab.io/people/guido-zuccon.html) |
| **6** | **Joel Mackenzie** | Senior Lecturer | Efficient retrieval, search evaluation | Human-centered verification of LLM outputs (with Miller) | [ielab](https://ielab.io/people/joel-mackenzie.html) |
| **7** | **Gianluca Demartini** | Professor | Human-in-the-loop AI, crowdsourcing, fact-checking | Collaborates with Miller on decision support | [Profile](https://eecs.uq.edu.au/profile/392/gianluca-demartini) |

**Why UQ XAI Group is Tier 1**:
- Tim Miller's "Evaluative AI" is exactly how agent memory should work: present evidence for/against decisions, not black-box answers
- Strong collaboration between XAI (Miller) and IR (Zuccon) teams
- Research angle: "How should agents explain their memory-based reasoning?"

**Research Questions for UQ**:
- How should agent memory systems present retrieved evidence to support human hypothesis evaluation?
- What makes agent memory retrieval decisions explainable?
- How do we evaluate whether agent memory improves human-agent collaboration?

### 1.3 Monash University - Hybrid Knowledge & SE+AI

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **8** | **Teresa Wang** | Senior Lecturer | Hybrid KB retrieval (textual + relational), personalization | "Personalized LLM-based IR on Textual and Relational KBs" project | [Supervisor Connect](https://supervisorconnect.it.monash.edu/supervisors/teresa-wang) |
| **9** | **Aldeida Aleti** | Professor | SE + LLM, software knowledge retrieval | "LLM models for learning and retrieving software knowledge" project | [Supervisor Connect](https://supervisorconnect.it.monash.edu/supervisors/aldeida-aleti) |
| **10** | **Yuan-Fang Li** | Assoc Professor | KG + LLM reasoning, faithful generation | "Reasoning on Graphs" (ICLR 2024), 100% faithful reasoning | [Profile](https://users.monash.edu.au/~yli/) |
| **11** | **Lizhen Qu** | Senior Lecturer | Neuro-symbolic AI, verification, causal reasoning | HARNESS project, trustworthy LLMs | [Profile](https://research.monash.edu/en/persons/lizhen-qu/) |

**Why Monash is Tier 1**:
- Teresa Wang's project is literally "retrieval from knowledge bases blending unstructured and structured information for private knowledge sources"
- Aldeida Aleti has the exact SE domain focus
- Yuan-Fang Li's graph-constrained reasoning ensures faithful agent outputs

### 1.4 UNSW / CSIRO Data61 - Agent Architectures

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **12** | **Qinghua Lu** | Principal Scientist | SE for AI, agent architectures, RAG engineering | Books on AI Engineering, agent reference architectures | Data61 SE4AI Team |
| **13** | **Xingyu Tan** | PhD Candidate | Agent memory + RAG + KG | MemoTime (memory-augmented RAG), HydraRAG | [Website](https://stevetantan.github.io/) |

**Why Data61 is Tier 1**:
- Qinghua Lu leads SE4AI team working on agent architectures
- Xingyu Tan is literally working on "agent memory" - MemoTime paper
- Strong industry connection through CSIRO

### 1.5 RMIT University - RAG Implementation Excellence

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **14** | **Damiano Spina** | Researcher | RAG systems, retrieval optimization | **Winner**: SIGIR 2025 LiveRAG, NeurIPS 2025 MMU-RAG | ADM+S RMIT |
| **15** | **Mark Sanderson** | Professor | Information retrieval leadership | Dean of Research, strongest IR group in southern hemisphere | [Website](https://marksanderson.org/) |

**Why RMIT is Tier 1**:
- They've proven they can build state-of-the-art RAG systems (competition winners)
- If you need retrieval implementation expertise, they're the best

---

## TIER 2: STRONG ALIGNMENT (Secondary Outreach)

These researchers work on closely related problems that intersect with agent memory.

### 2.1 University of Melbourne - NLP & Knowledge

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **16** | **Jey Han Lau** | Senior Lecturer | Factual consistency, dialogue summarization | Factual Dialogue Summarization (COLING 2025) | [Website](https://jeyhan.my/) |
| **17** | **Tim Baldwin** | Laureate Professor | Uncertainty quantification, tool retrieval | ToolGen (2024), LLM truthfulness | [Website](https://eltimster.github.io/www/) |
| **18** | **Jianzhong Qi** | Senior Lecturer | Knowledge graphs, spatial ML | AutoAlign KG alignment (2024) | [Profile](https://people.eng.unimelb.edu.au/jianzhongq/) |
| **19** | **Trevor Cohn** | Professor | Cross-lingual QA, KG completion | Security, multilingual NLP | [Website](https://trevorcohn.github.io/) |
| **20** | **Lea Frermann** | Senior Lecturer | Cultural knowledge graphs, bias/fairness | NLP for narratives | [Website](https://www.frermann.de/) |
| **21** | **Eduard Hovy** | Executive Director | Semantic NLP, information extraction | Melbourne Connect, 68k citations | [Profile](https://www.melbconnect.com.au/eduard-hovy) |
| **22** | **Michael Kirley** | Professor | Multi-agent RL, evolutionary computation | MCDS co-director | [Profile](https://people.eng.unimelb.edu.au/mkirley/) |

**UniMelb Tier 2 Research Angles**:
- Jey Han Lau: How to maintain factual consistency when agents compress/summarize memory
- Tim Baldwin: When should agents trust retrieved information?
- Jianzhong Qi: Knowledge graph structures for agent memory

### 2.2 Monash University - Additional Researchers

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **23** | **Reza Haffari** | Professor | NLP, multilingual LLMs, dense retrieval | Former Vision & Language Group director | [Homepage](https://rezahaffari.github.io/) |
| **24** | **Ingrid Zukerman** | Professor | Dialogue systems, negotiation, user modeling | "Let's negotiate!" survey (2024) | [Homepage](https://users.monash.edu/~ingrid/) |
| **25** | **Philip Cohen** | Adjunct Professor | Dialogue systems, multi-agent, joint intention | Laboratory for Dialogue Research | [Profile](https://research.monash.edu/en/persons/philip-cohen) |
| **26** | **Chakkrit Tantithamthavorn** | Assoc Professor | AI for code, defect prediction, LLM security | RAISE project PI | [Website](https://chakkrit.com/) |
| **27** | **John Grundy** | Professor | Human-centric SE, responsible AI | HumaniSE Lab director | [Website](https://sites.google.com/site/johncgrundy/) |
| **28** | **Rashina Hoda** | Professor | Agile + AI, human-AI collaboration | "Augmented Agile" (ICSE 2024 keynote) | [Profile](https://research.monash.edu/en/persons/rashina-hoda) |
| **29** | **Xiaoning Du** | Lecturer | AI/ML testing, DevOps for AI | Google Research Scholar 2024 | [Website](https://xiaoningdu.github.io/) |
| **30** | **Hamid Rezatofighi** | Lecturer | Neuro-symbolic AI, robotics | **2-3 funded PhD positions**, NEUSIS | [Profile](https://research.monash.edu/en/persons/hamid-rezatofighi) |
| **31** | **Alexey Ignatiev** | Assoc Professor | XAI, neuro-symbolic reasoning | HARNESS project | [Profile](https://research.monash.edu/en/persons/aleksei-ignatiev/) |
| **32** | **Dinh Phung** | Professor | Generative AI, LLMs, deep learning | Head of ML Group | [Profile](https://research.monash.edu/en/persons/dinh-phung/) |
| **33** | **Lan Du** | Assoc Professor | NLP, knowledge distillation | Text analytics | [Homepage](https://dulann.github.io/) |

### 2.3 University of Queensland - Additional Researchers

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **34** | **Shuai Wang** | Research Officer | RAG evaluation, federated search | FeB4RAG, BERGEN benchmarking | [Profile](https://about.uq.edu.au/experts/48930) |
| **35** | **Ekaterina Khramtsova** | Researcher | Dense retrieval, RAG evaluation | FeB4RAG, LLM-based ranking | [Profile](https://eecs.uq.edu.au/profile/2267/ekaterina-khramtsova) |
| **36** | **Hongzhi Yin** | Professor | Recommender systems, GNNs, trustworthy ML | RBDI Lab | [Profile](https://eecs.uq.edu.au/profile/2696/hongzhi-yin) |
| **37** | **Ruihong Qiu** | Lecturer | LLMs, GNNs | Seeking PhD students 2025 | [Profile](https://eecs.uq.edu.au/profile/1616/ruihong-qiu) |
| **38** | **Shane Culpepper** | Professor | IR, NLP at scale | Director AI Research Partnerships | [Homepage](https://culpepper.io/) |
| **39** | **Jen Jen Chung** | Assoc Professor | Multi-agent learning, robot coordination | RL for robotics | [Homepage](https://jenjenchung.github.io/anthropomorphic/) |
| **40** | **Sen Wang** | Assoc Professor | Explainable ML, time series | XAI research | [Profile](https://about.uq.edu.au/experts/9445) |

---

## TIER 3: RELEVANT ALIGNMENT (Broader Ecosystem)

### 3.1 Australian National University

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **41** | **Zhenchang Xing** | Professor | LLM agent evaluation | Agent architecture research | ANU |
| **42** | **Bowen Zhang** | Researcher | KG-enhanced RAG | StructRAG, ASKG | Former ANU |
| **43** | **Lexing Xie** | Professor | ML on graphs, multimedia KGs | Computational Media Lab | [Website](https://users.cecs.anu.edu.au/~xlx/) |

### 3.2 Macquarie University

| Rank | Name | Title | Research Fit | Key Work | Profile |
|------|------|-------|--------------|----------|---------|
| **44** | **Jia Wu** | Assoc Professor | Knowledge graphs, GNNs, LLMs | **Actively recruiting PhD students** | [Website](https://web.science.mq.edu.au/~jiawu/) |

### 3.3 Other Universities

| Rank | Name | Title | University | Research Fit | Profile |
|------|------|-------|------------|--------------|---------|
| **45** | **Massimo Piccardi** | Professor | UTS | NLP, deep learning | [Profile](https://profiles.uts.edu.au/Massimo.Piccardi) |
| **46** | **Miao Xu** | Lecturer | UQ | Trustworthy AI | [Profile](https://about.uq.edu.au/experts/26509) |

---

## PRIORITY CONTACT MATRIX

### By Research Framing

| If Your Pitch Is... | Priority Supervisors | University |
|---------------------|---------------------|------------|
| **Agent memory architecture** | Adrian Pearce, Liz Sonenberg, Nir Lipovetzky | UniMelb AgentLab |
| **Explainable agent memory** | Tim Miller, Gianluca Demartini | UQ |
| **Hybrid retrieval for agents** | Teresa Wang, Yuan-Fang Li | Monash |
| **SE knowledge for agents** | Aldeida Aleti, John Grundy | Monash |
| **RAG implementation** | Damiano Spina, Mark Sanderson | RMIT |
| **Agent architecture engineering** | Qinghua Lu, Xingyu Tan | Data61 |

### Recommended Outreach Order

**Week 1-2: Agent Architecture Focus**

| Priority | Supervisor | University | Pitch Focus |
|----------|------------|------------|-------------|
| **1** | Adrian Pearce | UniMelb | Memory as capability for agent planning |
| **2** | Liz Sonenberg | UniMelb | Memory for multi-agent collaboration |
| **3** | Tim Miller | UQ | Explainable memory retrieval decisions |

**Week 2-3: Implementation + Domain Focus**

| Priority | Supervisor | University | Pitch Focus |
|----------|------------|------------|-------------|
| **4** | Teresa Wang | Monash | Hybrid knowledge retrieval |
| **5** | Aldeida Aleti | Monash | Software engineering domain |
| **6** | Yuan-Fang Li | Monash | Faithful reasoning over memory |

**Week 3-4: Retrieval Expertise**

| Priority | Supervisor | University | Pitch Focus |
|----------|------------|------------|-------------|
| **7** | Damiano Spina | RMIT | RAG implementation excellence |
| **8** | Guido Zuccon | UQ | Retrieval evaluation |
| **9** | Qinghua Lu | Data61 | Agent architecture engineering |

---

## RESEARCH QUESTION FRAMEWORK

### Agent-Centric Questions (Tier 1 Focus)

**For AgentLab (UniMelb)**:
1. How does memory architecture affect agent planning effectiveness?
2. What memory structures support effective human-agent collaboration?
3. How should agents decide what to remember vs. forget vs. summarize?
4. What role does shared memory play in multi-agent software engineering?

**For Tim Miller (UQ)**:
1. How should agent memory systems present evidence for hypothesis evaluation?
2. What makes agent memory retrieval decisions explainable to users?
3. How do we measure whether agent memory improves decision quality?

**For Teresa Wang / Yuan-Fang Li (Monash)**:
1. How to retrieve effectively from hybrid knowledge bases (structured + unstructured)?
2. How does graph-constrained reasoning ensure faithful agent outputs?
3. What fusion strategies optimize retrieval for different agent tasks?

### Implementation Questions (Tier 2 Focus)

**For SE Researchers (Monash)**:
1. What knowledge representation best captures software engineering artifacts?
2. How should agent memory handle temporal evolution of codebases?
3. What evaluation metrics measure utility for software engineering tasks?

**For RAG Researchers (RMIT/UQ)**:
1. How to evaluate retrieval quality for agent-facing use cases?
2. What retrieval strategies support different agent task types?
3. How to balance precision vs. recall for agent decision support?

---

## PITCH TEMPLATES BY FRAMING

### Pitch A: Agent Memory Architecture (UniMelb AgentLab)

**Subject**: Prospective MPhil: Memory Architecture for AI Coding Agents

> Dear Professor Pearce,
>
> I am [Name], writing to inquire about MPhil supervision on **memory systems for agentic workflows**.
>
> AI coding agents need reliable memory to be effective - yet we lack understanding of how memory architecture affects agent behavior. I've built a production memory system serving engineering teams: multi-view embeddings, hybrid retrieval across code/PRs/incidents, entity extraction, and actor profiles. The system operates at scale, but critical questions remain unanswered.
>
> Under your supervision, I want to study: **How does memory architecture affect agent planning and collaboration?** Specifically:
> - What memory structures support different agent tasks (debugging vs. architecture decisions)?
> - How should agents decide what to remember, forget, or summarize?
> - What role does shared memory play in human-agent collaboration?
>
> I believe my production system provides a testbed for rigorous research on agent memory, and your expertise in multi-agent planning would be invaluable.
>
> I have attached my CV and would welcome the opportunity to discuss alignment with AgentLab's research.

### Pitch B: Explainable Agent Memory (UQ - Tim Miller)

**Subject**: Prospective MPhil: Explainable Memory Retrieval for AI Agents

> Dear Professor Miller,
>
> Your work on "Evaluative AI" resonated strongly with challenges I've encountered building memory systems for AI coding agents.
>
> You propose that AI should present evidence for/against human hypotheses rather than black-box recommendations. I believe agent memory systems should work the same way - not just returning search results, but presenting evidence that supports human reasoning about software decisions.
>
> I've built a production memory system with hybrid retrieval over engineering artifacts. But the system lacks explainability: users don't understand why certain results were retrieved or how confident the agent should be in its answers.
>
> I am seeking to investigate: **How should agent memory systems support hypothesis-driven decision making?** Your expertise in XAI and human-agent interaction would be invaluable for this research.
>
> I have attached my CV and would welcome discussion of potential alignment.

### Pitch C: Hybrid Knowledge Retrieval (Monash - Teresa Wang)

**Subject**: Prospective MPhil: Hybrid Retrieval for Agent Memory Systems

> Dear Dr Wang,
>
> Your project on "Personalized LLM-based Information Retrieval on Textual and Relational Knowledge Bases" directly addresses challenges I've encountered building memory for AI coding agents.
>
> Engineering knowledge is inherently hybrid: unstructured (PR descriptions, incident postmortems) and structured (entity references, actor relationships, code dependencies). I've implemented a four-path hybrid retrieval system, but lack rigorous understanding of optimal fusion strategies and evaluation methodology for private corpora.
>
> I am seeking to investigate hybrid retrieval architectures that serve agent memory effectively, and I believe your expertise in textual + relational knowledge bases would be invaluable.
>
> I have attached my CV and would welcome the opportunity to discuss alignment with your current work.

---

## SUPERVISOR COMPARISON BY STRENGTH

### What Each Brings

| Supervisor | They Bring | You Bring |
|------------|-----------|-----------|
| **Pearce/Sonenberg** (UniMelb) | Agent theory, planning, collaboration | Memory implementation, retrieval |
| **Tim Miller** (UQ) | XAI, human-agent interaction | Production system, agent use case |
| **Teresa Wang** (Monash) | Hybrid retrieval theory | Agent framing, production scale |
| **Aldeida Aleti** (Monash) | SE domain expertise | Memory architecture, retrieval |
| **Yuan-Fang Li** (Monash) | Graph reasoning, faithfulness | Agent memory context |
| **Damiano Spina** (RMIT) | RAG implementation expertise | Agent architecture framing |
| **Qinghua Lu** (Data61) | Agent architecture patterns | Production memory system |

### Potential Dual Supervision

| Primary | Secondary | Research Angle |
|---------|-----------|----------------|
| Adrian Pearce (UniMelb) | Teresa Wang (Monash) | Agent planning + hybrid retrieval |
| Tim Miller (UQ) | Guido Zuccon (UQ) | Explainable retrieval for agents |
| Liz Sonenberg (UniMelb) | Aldeida Aleti (Monash) | Collaborative agent memory for SE |
| Yuan-Fang Li (Monash) | Nir Lipovetzky (UniMelb) | Graph reasoning + planning integration |

---

## FUNDING OPPORTUNITIES

### Currently Funded Positions

| Position | Supervisor | University | Details |
|----------|------------|------------|---------|
| SE for Social Good PhD | Aldeida Aleti | Monash | A$143,500 over 4 years |
| Neuro-symbolic PhD (2-3) | Hamid Rezatofighi | Monash | Fully funded |
| RAISE Program | Multiple | Monash | 11 graduates planned |
| AI/ML PhD | Xiaoning Du | Monash | Full scholarships |
| KG + LLM PhD | Jia Wu | Macquarie | Active recruitment |
| QUEX Joint PhD | Multiple | UQ-Exeter | 8 positions Jan 2026 |

### Scholarship Rounds

| University | Round | Deadline | Notes |
|------------|-------|----------|-------|
| UniMelb | Round 1 | Oct 31 | Most scholarships |
| UniMelb | Round 2 | Jan 31 | Secondary |
| Monash | Main | August | Primary round |
| UQ | Various | Rolling | Check specific programs |

---

## APPENDIX: KEY PUBLICATIONS TO READ

### Agent Architecture & Planning
1. "Explainable AI is Dead, Long Live Explainable AI!" (Miller, 2023) - Evaluative AI framework
2. "Towards socially sophisticated BDI agents" (Sonenberg et al.) - Agent collaboration
3. Width-based planning papers (Lipovetzky) - Planning foundations

### Memory & Retrieval
4. "Reasoning on Graphs: Faithful and Interpretable LLM Reasoning" (Li et al., ICLR 2024)
5. "MemoTime: Memory-Augmented Temporal KG Enhanced LLM Reasoning" (Tan et al.)
6. G-RAG system (Spina et al., arXiv:2506.14516)
7. "Personalized LLM-based IR" project description (Wang)

### SE + AI
8. "AI for SE: The Journey So Far and Road Ahead" (Aleti et al., TOSEM 2025)
9. "LLM models for learning and retrieving software knowledge" project (Aleti)
10. "Augmented Agile" (Hoda, ICSE 2024 keynote)

---

## SUMMARY: TOP 10 PRIORITY CONTACTS

| Rank | Supervisor | University | Research Angle | Why Priority |
|------|------------|------------|----------------|--------------|
| **1** | Adrian Pearce | UniMelb | Agent planning + memory | AgentLab expertise |
| **2** | Liz Sonenberg | UniMelb | Multi-agent collaboration + shared memory | Collaboration theory |
| **3** | Tim Miller | UQ | Explainable agent memory | Evaluative AI framework |
| **4** | Teresa Wang | Monash | Hybrid knowledge retrieval | Direct project match |
| **5** | Aldeida Aleti | Monash | SE domain + agent tooling | Funded positions, SE focus |
| **6** | Yuan-Fang Li | Monash | Faithful reasoning | Graph-constrained generation |
| **7** | Nir Lipovetzky | UniMelb | Planning integration | Memory for planning |
| **8** | Damiano Spina | RMIT | RAG implementation | Competition winner |
| **9** | Qinghua Lu | Data61 | Agent architecture | SE4AI leadership |
| **10** | Guido Zuccon | UQ | Retrieval evaluation | ielab, Miller collaboration |

---

**Last Updated**: 2026-01-15
**Total Supervisors Indexed**: 46+
**Universities Covered**: 8
**Research Groups Mapped**: 15+
**Primary Framing**: Agent memory as capability for agentic workflows
