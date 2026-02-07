---
date: 2026-02-07
researcher: external-agent
topic: "Architecture evaluation pipeline for Lightfast"
tags: [research, web-analysis, architecture, evaluation, pipeline, meta-evaluation]
status: complete
confidence: high
sources_count: 87
---

# External Research: Architecture Evaluation Pipeline

## Research Question

How to build an end-to-end pipeline for evaluating Lightfast's architecture — both the technical evaluation and the creation of research methods — with iterative improvement and pipeline versioning.

## Executive Summary

Architecture evaluation has matured from heavyweight one-time assessments (ATAM, QAW) into continuous, automated practices driven by fitness functions, DORA metrics, and AI-assisted analysis. The most effective modern approaches combine: (1) automated fitness functions embedded in CI/CD pipelines for continuous guardrails, (2) DORA metrics for delivery performance tracking, (3) Architecture Decision Records for capturing evolution context, and (4) monorepo-specific tooling for dependency and boundary enforcement.

For Lightfast specifically — a TypeScript/pnpm Turborepo monorepo with 14+ packages — the recommended approach is a layered evaluation pipeline that combines dependency-cruiser for package boundary enforcement, automated fitness functions for quality attributes, DORA metrics for delivery health, and AI-assisted analysis for architecture smell detection. Pipeline versioning should follow an event-sourced, immutable-results pattern with feature flags for incremental rollout of new evaluation criteria.

---

## Key Findings

### 1. Architecture Evaluation Frameworks

#### ATAM (Architecture Tradeoff Analysis Method)

ATAM is the gold standard for scenario-based architecture evaluation, developed by the Software Engineering Institute (SEI) at Carnegie Mellon. It works through a structured, multi-phase process:

**Process Steps:**
1. **Present ATAM** — Explain the method to stakeholders
2. **Present business drivers** — What the system must achieve
3. **Present architecture** — Current system overview
4. **Identify architectural approaches** — Patterns and tactics used
5. **Generate quality attribute utility tree** — Prioritize quality attributes (performance, modifiability, security, etc.)
6. **Analyze architectural approaches** — Map scenarios to architecture decisions
7. **Brainstorm and prioritize scenarios** — Stakeholder-driven scenario generation
8. **Analyze architectural approaches (repeat)** — Deep analysis of highest-priority scenarios
9. **Present results** — Document risks, tradeoffs, sensitivity points, and non-risks

**Key Outputs:**
- **Risks**: Architecture decisions that may lead to undesirable consequences
- **Sensitivity Points**: Parameters where small changes cause large effects
- **Tradeoffs**: Decisions that affect multiple quality attributes
- **Non-risks**: Decisions validated as sound

**Practical Application:**
- ATAM is heavyweight (typically 2-4 day workshops with 10-30 stakeholders)
- Lightweight variants exist for smaller teams: "mini-ATAM" or LAAAM (Lightweight Architecture Alternative Analysis Method)
- Most effective when combined with Quality Attribute Workshops (QAW) that feed scenarios into ATAM
- The utility tree concept is universally applicable — prioritizing (H,H), (H,M), (M,H) scenarios

**Quality Attribute Workshops (QAW):**
QAW is a lighter-weight precursor to ATAM, used *before* architecture exists to elicit quality attribute requirements. It follows an 8-step process: presentation → business drivers → architectural plan → identify drivers → scenario brainstorming → consolidation → prioritization (voting) → refinement (6-part structure). QAW scenarios feed directly into ATAM's utility tree, reducing ATAM setup time.

**The Value Chain:**
```
Business Goals → [QAW] → Quality Attribute Scenarios →
[Architecture Design] → Architecture Decisions →
[ATAM] → Risks/Tradeoffs/Sensitivity Points
```

**Relevance to Lightfast:** ATAM's utility tree and scenario-based approach can be automated as fitness functions. Rather than running full ATAM workshops, extract the key quality attribute scenarios and encode them as continuous checks.

*Sources:*
- [SEI ATAM Method](https://resources.sei.cmu.edu/library/asset-view.cfm?assetID=5177) — Carnegie Mellon SEI
- [Methods for Evaluating Software Architecture: A Survey](https://research.cs.queensu.ca/TechReports/Reports/2008-545.pdf) — Queen's University, 2008
- [QUASAR Method](https://sei.cmu.edu/library/quasar-a-method-for-the-quality-assessment-of-software-intensive-system-architectures) — SEI, 2006
- [Lightweight Architecture Evaluation for Industry](https://pmc.ncbi.nlm.nih.gov/articles/PMC8838159/) — PMC, 2022

#### DORA Metrics

DORA (DevOps Research and Assessment) defines four key metrics that correlate strongly with organizational performance:

| Metric | Elite (19%) | High (22%) | Medium (35%) | Low (25%) |
|--------|-------------|------------|--------------|-----------|
| **Deployment Frequency** | On-demand (multiple/day) | Daily-Weekly | Weekly-Monthly | Monthly-6 months |
| **Lead Time for Changes** | < 1 day | 1 day - 1 week | 1 week - 1 month | 1-6 months |
| **Mean Time to Recovery** | < 1 hour | < 1 day | < 1 day | 1 week - 1 month |
| **Change Failure Rate** | ~5% | 10-20% | 10-15% | 40-64% |

*Based on 2024 DORA Accelerate State of DevOps Report (39,000+ professionals surveyed). Key finding: Elite teams deploy 182x more frequently and recover 2,293x faster than low performers.*

**Tools for Measuring DORA:**
- **LinearB** — Git analytics, DORA dashboards, workflow automation, PR analytics, gitStream engine
- **Swarmia** — Engineering effectiveness, DORA + SPACE framework, developer experience focus
- **Sleuth** — Deployment tracking, DORA metrics, CI/CD integration
- **Jellyfish** — Engineering analytics, DORA + investment alignment
- **Apache DevLake** — Open-source DORA metrics aggregation
- **GitLab** — Built-in DORA dashboards (native)
- **Datadog** — DORA metrics monitoring and tracking
- **CodeMetrics.ai** — Automated DORA calculation from Git activity

**Key Insight:** DORA metrics serve as *outcome metrics* that indicate architecture health indirectly. High deployment frequency with low change failure rate suggests well-decoupled, independently deployable components. Poor lead time often indicates tight coupling or missing automation.

**For Lightfast:** Track DORA per-package in the monorepo where possible. Deployment frequency of individual apps (console, www, auth, docs) and change failure rate by package would reveal architectural coupling issues.

*Sources:*
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/) — Google DORA Team
- [Accelerate: State of DevOps Report](https://dora.dev/research/) — Google, 2023-2025

#### Architecture Fitness Functions

Fitness functions are "any mechanism that provides an objective integrity assessment of some architectural characteristic(s)" — from Neal Ford, Rebecca Parsons, and Patrick Kua's "Building Evolutionary Architectures."

**Classification Matrix:**

| Dimension | Options | Examples |
|-----------|---------|----------|
| **Scope** | Atomic (single concern) vs Holistic (multiple concerns) | Atomic: cyclomatic complexity check. Holistic: security + performance combined |
| **Trigger** | Triggered (event-based) vs Continuous (always running) | Triggered: pre-commit hook. Continuous: production monitoring |
| **Nature** | Static (fixed threshold) vs Dynamic (sliding/contextual) | Static: "no circular deps." Dynamic: "P95 latency within 10% of last week" |
| **Automation** | Automated vs Manual | Automated: CI check. Manual: quarterly review |

**Real-World Examples:**

1. **Dependency Rules** — No circular dependencies, no imports from higher layers to lower
   - Tool: `dependency-cruiser` (TypeScript/JavaScript), ArchUnit (Java)
2. **Performance Budgets** — Bundle size < 250KB, LCP < 2.5s, P95 API latency < 200ms
   - Tool: Lighthouse CI, custom CI checks
3. **Security Scans** — No known CVEs in dependencies, no secrets in code
   - Tool: Snyk, npm audit, gitleaks
4. **Coupling Metrics** — Package instability and abstractness ratios
   - Tool: dependency-cruiser, custom scripts
5. **Code Quality Gates** — Cyclomatic complexity, duplication, test coverage
   - Tool: SonarQube, ESLint rules
6. **API Compatibility** — No breaking changes in public interfaces
   - Tool: @microsoft/api-extractor, TypeScript compiler

**Implementation in CI/CD:**
- Run atomic fitness functions as pre-commit hooks or PR checks
- Run holistic fitness functions as nightly builds or deployment gates
- Track fitness function results over time to detect architectural drift
- Use fitness functions as architectural guardrails, not blockers (warn first, then block)

**Key Quote (Ben Morris, 2025):** "The most valuable fitness measures are often derived from how the system is actually used and whether it meets commercial expectations, such as feature delivery time, deployment failure rates, and customer onboarding time."

*Sources:*
- [Fitness Functions for Your Architecture](https://infoq.com/articles/fitness-functions-architecture) — InfoQ, 2025
- [Continuous Architecture: Fitness Functions](https://www.continuous-architecture.org/practices/fitness-functions/) — Continuous Architecture
- [Fitness Functions: Unit Tests For Your Architecture](https://trailheadtechnology.com/fitness-functions-unit-tests-for-your-architecture/) — Trailhead Technology, 2024
- [Using Fitness Functions as a Guide to System Design](https://www.ben-morris.com/using-architectural-fitness-functions-as-a-guide-to-system-design/) — Ben Morris, 2025
- [Architectural Fitness Functions - Patrick Kua - CodeCrafts 2022](https://www.youtube.com/watch?v=aq8XTTxoslE) — YouTube

---

### 2. Pipeline Versioning & Migration Patterns

#### Versioning Evaluation Pipelines

The key challenge: as evaluation criteria evolve, how do you compare results across pipeline versions?

**Pattern 1: Immutable Results + Schema Versioning**
- Every evaluation run produces immutable results tagged with pipeline version
- Results schema includes: `pipeline_version`, `timestamp`, `criteria_version`, `raw_scores`, `normalized_scores`
- Schema evolution follows Avro/Protobuf patterns: additive-only fields, default values for new fields
- Historical results are never modified; new pipeline versions produce new result sets

**Pattern 2: Event-Sourced Evaluation History**
- Store every evaluation as an immutable event: `EvaluationRequested`, `EvaluationCompleted`, `CriteriaUpdated`, `ThresholdChanged`
- Replay events to reconstruct evaluation state at any point in time
- Enables "what-if" analysis: re-run old evaluations with new criteria
- Inspired by ML experiment tracking (MLflow, Weights & Biases)

**Pattern 3: Pipeline-as-Code (Dagster/Prefect Pattern)**
- Define evaluation pipeline as code with explicit versioning
- Each pipeline version is a git commit / tag
- Configuration as code: evaluation criteria, thresholds, weights
- Inspired by MLOps: DVC for data versioning, MLflow for experiment tracking
- Dagster's "software-defined assets" pattern maps well to evaluation artifacts

**Pattern 4: Blue-Green Pipeline Evaluation**
- Run old and new pipeline versions in parallel during transition
- Compare results: if new pipeline identifies same issues plus additional ones, it's an improvement
- Shadow mode: new pipeline runs but doesn't affect scoring/reporting
- Graduate to new pipeline after confidence period

**Pattern 5: Feature Flags for Criteria**
- Use feature flags to incrementally enable new evaluation criteria
- LaunchDarkly / Unleash / environment variables for toggling
- A/B testing: run subset of evaluations with new criteria, compare actionability
- Roll back criteria that produce noise without signal

#### Schema Migration for Evaluation Data

- **Backward compatibility**: New pipeline can read old results
- **Forward compatibility**: Old pipeline can read new results (via default values)
- **Additive-only evolution**: New fields are always optional with defaults
- **Versioned views**: Generate reports from latest pipeline version, with fallback to historical data
- **Migration scripts**: When breaking changes are necessary, provide explicit migration

*Sources:*
- [Dagster Software-Defined Assets](https://docs.dagster.io/concepts/assets/software-defined-assets) — Dagster docs
- [MLflow Experiment Tracking](https://mlflow.org/docs/latest/tracking.html) — MLflow docs
- [Schema Evolution in Avro](https://avro.apache.org/docs/current/specification/) — Apache Avro
- [DVC Data Version Control](https://dvc.org/) — Iterative AI
- [Prefect Workflow Orchestration](https://www.prefect.io/) — Prefect

---

### 3. Meta-Evaluation: Measuring Research Quality

#### What is Meta-Evaluation?

Meta-evaluation — the evaluation of evaluations — was formalized by Michael Scriven (1969) and further developed by Daniel Stufflebeam with the Meta-Evaluation Checklist. The Joint Committee on Standards for Educational Evaluation (3rd Edition, 2010) defines five properties of good evaluations (30 standards total):

1. **Utility** (8 standards) — Does the evaluation serve practical information needs? (stakeholder identification, evaluator credibility, report clarity, evaluation impact)
2. **Feasibility** (4 standards) — Is the evaluation realistic, prudent, and cost-effective? (project management, practical procedures, resource use)
3. **Propriety** (7 standards) — Is the evaluation conducted fairly and ethically? (human rights, transparency, conflicts of interest)
4. **Accuracy** (8 standards) — Does the evaluation convey technically adequate information? (justified conclusions, valid/reliable information, sound designs)
5. **Evaluation Accountability** (3 standards) — Is the evaluation process itself documented and evaluated? (evaluation documentation, internal meta-evaluation, external meta-evaluation)

**Scriven's Meta-Evaluation Checklist (MEC)** identifies six core criteria: Validity (coverage, correctness, values), Double Needs Assessment, Triangulation, Field-Specific Standards, Evidence Quality, and Inference Quality.

**Stufflebeam's approach** distinguishes between formative meta-evaluations (during planning) and summative meta-evaluations (after completion), with critical standards that cause automatic failure if scored poorly (P1: Responsive Orientation, A1: Justified Conclusions, A2: Valid Information, A8: Communication).

#### Metrics for Architecture Evaluation Quality

| Metric | Definition | Measurement |
|--------|-----------|-------------|
| **Completeness** | % of architecture concerns covered | Map findings to ATAM quality attributes; track uncovered areas |
| **Accuracy** | % of findings validated as true positives | Sample findings, verify with manual review; track false positive rate |
| **Actionability** | % of findings that lead to concrete improvements | Track findings → tickets → merged PRs pipeline |
| **Timeliness** | Lag between architecture change and detection | Measure time from commit to evaluation alert |
| **Signal-to-Noise Ratio** | Ratio of actionable findings to total findings | (Tier 1 + Tier 2 findings) / Total findings; target > 60% |
| **Consistency** | Same input produces same output across runs | Run evaluations multiple times, measure result variance |

#### The Signal-to-Noise Framework (from AI Code Review Research)

A framework for classifying findings by severity:
- **Tier 1 (Critical Signal):** Issues causing production failures — breaking changes, security holes, data loss
- **Tier 2 (Important Signal):** Maintainability issues — architectural violations, performance regressions, coupling increases
- **Tier 3 (Noise):** Subjective suggestions — style preferences, micro-optimizations, cosmetic changes

**Target: Signal Ratio > 60%** (Tier 1 + Tier 2 / Total)

#### Feedback Loops for Continuous Improvement

**Single-Loop Learning:** Detect issue → fix issue → verify fix
- Track: Were findings addressed? Did fixes hold?

**Double-Loop Learning (Chris Argyris):** Detect issue → question evaluation criteria → improve evaluation
- Track: Are we asking the right questions? Are our thresholds appropriate?

**Practical Implementation (5-Phase Meta-Evaluation Process):**

1. **Establish Baseline** (Joint Committee Standards) — Map current evaluation against utility, feasibility, propriety, accuracy, and accountability standards
2. **Define Quality Metrics** — Set quantifiable targets for completeness, accuracy, actionability, timeliness, signal-to-noise
3. **Experimental Validation** — A/B test methodology changes (controlled experiments on same codebase with different methods; measure statistical significance)
4. **Closed-Loop Feedback** — Sense (collect outcome data) → Infer (analyze patterns) → Execute (implement improvements) → Track (measure results)
5. **Double-Loop Learning Retrospectives** — Monthly: review evaluation effectiveness. Quarterly: meta-evaluation of methodology. Annually: strategic rethinking of approach

**Key Feedback Pattern (Braintrust):** Connect real-world log data to evaluations — production issues missed by evaluation get added to test set; false positives refine detection rules; successful remediations reinforce effective patterns.

#### Information Retrieval Metrics Applied to Architecture

- **Precision**: Of all architecture issues flagged, what % are real issues?
- **Recall**: Of all real architecture issues, what % did we detect?
- **F1 Score**: Harmonic mean of precision and recall
- **Coverage**: What % of the codebase/packages are evaluated?

For architecture evaluation, **high precision is more valuable than high recall** — false positives erode trust and create noise. Start conservative, expand gradually.

**Industry False Positive Benchmarks:**
- Static analysis tools (SonarQube, PMD, SpotBugs): >76% false positive rate at Tencent scale
- Best AI code review systems: 5-15% false positive rate (Graphite reports 5-8%)
- Individual vulnerability detection tools: miss 47-80% of vulnerabilities (false negatives)
- Combining tools: reduces FN to 30-69% but increases FP by ~15 percentage points
- LLM-based hybrid techniques: eliminate 94-98% of false positives while maintaining high recall (arXiv 2026)

*Sources:*
- [Drowning in AI Code Review Noise? A Framework](https://jetxu-llm.github.io/posts/low-noise-code-review/) — 2025
- [MITRE Architecture Quality Assessment](https://www.mit.edu/~richh/writings/aqa-swee.pdf) — MITRE/MIT
- [Assessing the Quality of Architectural Design Quality Metrics](https://inria.hal.science/hal-01664311v1/document) — INRIA, 2018
- [Code Quality Metrics: Separating Signal from Noise](https://blog.ndepend.com/code-quality-metrics-signal-noise/) — NDepend Blog, 2017
- [CodeMetrics](https://code-metrics-project.github.io/docs/) — CodeMetrics Project

---

### 4. Continuous Architecture Practices

#### Architecture Decision Records (ADRs)

ADRs are short documents that capture individual architectural decisions. Introduced by Michael Nygard in 2011, they've become a standard practice.

**ADR Format (MADR - Markdown Any Decision Records):**
```markdown
# ADR-001: Use tRPC for API layer

## Status
Accepted (2024-06-15)

## Context
Need type-safe API communication between Next.js frontend and backend services.

## Decision
Use tRPC with Zod validation for all API routes.

## Consequences
- Positive: End-to-end type safety, no code generation step
- Positive: Automatic inference of input/output types
- Negative: Tightly couples frontend/backend TypeScript versions
- Negative: Not usable by non-TypeScript clients
```

**ADR Lifecycle:** Draft → Proposed → Accepted → Deprecated / Superseded / Amended

**Tools:**
- **adr-tools** — CLI for managing ADRs in a directory
- **log4brains** — ADR management with a web UI and architecture knowledge base
- **ADR Manager** — VS Code extension for ADR management
- **Decentraland ADR System** — Real-world example with ADR states including Deprecated, Stagnant, Withdrawn

**Key Insight (m7y.me, 2025):** "Most teams fall into two camps: they either don't document decisions at all, or they have a heavyweight process that everyone quietly ignores. ADRs solve this — every significant technical decision gets a short document explaining what was decided and why."

**Connection to Evaluation:** ADRs provide the *context* for evaluation. When an evaluation flags an architectural concern, the corresponding ADR explains *why* that decision was made, enabling informed trade-off analysis rather than blind refactoring.

#### C4 Model & arc42

**C4 Model (Simon Brown):**
- Level 1: System Context — how the system fits in the world
- Level 2: Container — high-level technology choices (apps, databases, message queues)
- Level 3: Component — within a container, key abstractions
- Level 4: Code — class/module level (usually auto-generated)

**arc42:** Template for architecture documentation with 12 sections covering introduction, constraints, context, building blocks, runtime, deployment, cross-cutting concerns, decisions, quality, risks, glossary, and technical debt.

#### Evolutionary Architecture

Key principles from Neal Ford et al.:

1. **Incremental Change**: Small, reversible changes over big-bang rewrites
2. **Guided Change**: Fitness functions as guardrails, not gatekeepers
3. **Multiple Dimensions**: Evaluate across technical, data, security, and operational dimensions simultaneously
4. **Last Responsible Moment**: Defer architectural decisions until you have enough information

**Sacrificial Architecture Pattern:** Build with the intention that some components will be replaced. Design boundaries that allow swapping implementations without cascading changes.

#### Company Case Studies

**Netflix — "Paved Road" + Post-facto ADR Governance:**
- Internal platform teams provide "paved roads" — golden paths for common patterns (service discovery, monitoring, logging, security, RPC)
- Architecture evaluation happens through automated compliance checks on the paved road
- Teams can go "off-road" but must justify and accept additional operational burden
- **Eliminated traditional Architecture Review Boards** — replaced with ADRs and automated governance
- Governance happens asynchronously through documentation: humans review ADRs *after the fact* rather than before
- Post-facto review enables speed vs pre-approval bottleneck

**Spotify — Backstage + Soundcheck:**
- Backstage is Spotify's open-source developer portal (now a CNCF project)
- **Soundcheck Plugin** (Tech Health Scorecards): Measures component health against standards with 5 elements — Check, Check Result, Track, Level, Certification. Displays pass rate %, aggregates by checks/tracks/entities/teams, exports CSV, 90-day trend monitoring
- **Software Catalog**: Central registry of all services, libraries, and teams with ownership tracking
- **Golden Paths**: Onboarding tutorials for standard approaches. **Golden Technologies**: Standard supported languages/frameworks. **Golden State**: Desired state for components tracked via Soundcheck
- **Governance**: TAG (Technical Architecture Group) + XABs (Cross-mission Advisory Boards) + TSGs (Technical Special Groups) — federated approach with central guidance + team autonomy

**Shopify — Modular Monolith:**
- Migrated from Rails monolith to "modular monolith" using component-based architecture
- Enforced package boundaries using custom tooling (Packwerk for Ruby)
- Architecture evaluation through dependency analysis and boundary violation detection
- Continuous monitoring of coupling between modules

**Google — Architecture Review:**
- Centralized review board for large-scale design changes
- Design documents (design docs) as the primary artifact
- Automated enforcement via Bazel build system and code review tools
- Monorepo analysis tools measure dependency health at massive scale

#### Architecture Observability Tools

| Tool | Language | Purpose | Open Source |
|------|----------|---------|-------------|
| **ArchUnit** | Java | Architecture rules as unit tests | Yes |
| **ArchUnitTS** | TypeScript | Architecture rules as tests (ArchUnit for TS) | Yes |
| **ts-arch** | TypeScript | Architecture testing with PlantUML adherence | Yes |
| **dependency-cruiser** | JS/TS | Dependency rule enforcement, visualization | Yes |
| **Structurizr** | Multi | Architecture-as-code, C4 model diagrams | Partially |
| **Backstage** | Multi | Developer portal, service catalog, tech health | Yes (CNCF) |
| **Packwerk** | Ruby | Package boundary enforcement (Shopify) | Yes |
| **knip** | JS/TS | Unused dependencies, exports, files | Yes |
| **madge** | JS/TS | Circular dependency detection, visualization | Yes |
| **SonarQube** | Multi | Code quality, security, maintainability | Community/Enterprise |
| **CodeScene** | Multi | Behavioral code analysis, hotspot detection | Commercial |

*Sources:*
- [Architecture Decision Records: Actually Using Them](https://m7y.me/post/2025-12-23-architecture-decision-records/) — m7y.me, 2025
- [ADR Specification & Process (Decentraland)](https://adr.decentraland.org/adr/ADR-1) — Decentraland, 2020
- [ADR-277: Introducing Deprecated State](https://adr.decentraland.org/adr/ADR-277) — Decentraland, 2024
- [InnerSource Patterns](https://innersourcecommons.org/learn/patterns/) — InnerSource Commons, 2025
- [Backstage.io](https://backstage.io/) — Spotify/CNCF

---

### 5. AI-Assisted Architecture Evaluation

#### LLMs for Architecture Analysis

The 2026 landscape is rapidly evolving toward agentic architecture evaluation:

**Current Capabilities:**
- **Code review**: CodeRabbit, Sourcery, Qodo (CodiumAI) provide AI-powered PR reviews that can detect architectural violations
- **Architecture analysis**: Claude Code and GitHub Copilot Workspace can analyze multi-file relationships and suggest refactoring
- **Documentation generation**: Mintlify, Swimm auto-generate and maintain architecture docs
- **Staleness detection**: AI can compare documentation against code to flag drift

**Emerging Patterns (2026):**
- **Multi-agent evaluation**: Teams of AI agents analyzing different architecture dimensions in parallel (Anthropic's 2026 Agentic Coding Trends Report)
- **Agentic quality control**: AI agents reviewing large surface areas of code that humans can't feasibly inspect
- **From coder to architect**: Engineers shifting to "orchestrator" role, managing AI agents that implement and evaluate architecture
- **AI auditing tools**: CodeRabbit-style tools acting as "Editor-in-Chief" to catch security hallucinations and logic flaws in AI-generated code

**Limitations (Quantified):**
- **Hallucination**: 29-45% of AI-generated code contains security vulnerabilities; 19.7% of package recommendations don't exist (CodeHalu study). Mitigations: RAG reduces hallucinations 40-60%; Microsoft CORE multi-agent achieves 96% reduction
- **Context windows**: Even 200K tokens insufficient for large monorepos. Tree-sitter AST parsing for syntax-level chunking outperforms naive text chunking
- **Consistency**: LLMs show significant run-to-run inconsistency on identical inputs (EMNLP 2025 study). Logit-based ensemble methods help but human validation still needed
- **Semantic gap**: Code and natural language are not semantically similar — translating code to NL before embedding yields 30-40% better search results (Greptile 2025)

**Prompt Engineering Patterns for Architecture:**
1. **Code Intent Pattern** — Capture the "why" before generating the "what"
2. **Test-Driven Specification Pattern** — Define tests before implementation to reduce hallucinations
3. **Code Review Pattern** — Structured checklist: security risks, performance, anti-patterns
4. **Chain-of-Thought** — Step-by-step reasoning; GPT-4o with CoT achieved F1=0.9072 for vulnerability detection
5. **Context Priming** — Pre-load system topology, design principles, tech stack

**AI Code Review Tools Comparison:**

| Tool | Approach | Architecture Awareness | Key Strength |
|------|----------|----------------------|--------------|
| **Qodo** (CodiumAI) | Multi-agent (15+ agents), persistent context | Cross-repo, system-level | Deep codebase understanding, 6x accuracy over Copilot |
| **CodeRabbit** | Diff-level analysis | Limited to PR scope | Fast, easy setup |
| **Sourcery** | Smart comment filtering | Code quality patterns | Low noise, high signal |
| **Claude Code** | Agentic loop, 200K context | Full project awareness | Long-running refactoring tasks |
| **GitHub Copilot** | Workspace-level planning | Multi-file | Integrated GitHub ecosystem |

**Best Practices for AI-Assisted Evaluation:**
1. Use AI as a complement to automated fitness functions, not a replacement
2. Always validate AI findings with manual review initially
3. Track AI evaluation accuracy over time (precision/recall)
4. Use structured prompts with explicit quality attribute scenarios
5. Feed codebase context through RAG with tree-sitter AST parsing, not whole-file dumps
6. Treat prompts as code: version-controlled, tested, monitored

#### Automated Architecture Smell Detection

**Common Architecture Smells:**
- God Component — a component that does too much
- Cyclic Dependencies — packages depending on each other circularly
- Unstable Dependencies — stable packages depending on unstable ones
- Feature Envy — component heavily using another component's internals
- Scattered Functionality — related logic spread across unrelated packages

**ML-Based Detection (Academic Research 2024-2025):**
- **InSet tool** — Uses ML to identify Unstable Dependency and God Component smells; achieved good F1 scores using feature-based classification (SBES 2020, citations through 2025)
- **MLpylint** — Static analysis for ML-specific code smells (arXiv, 2025)
- **Architecture erosion detection via code reviews** — LLM-based classifiers (GPT-4o) outperform traditional ML with F1 of 0.851 for identifying violation symptoms (arXiv, 2025)
- **ML-based code smell surveys** show SVM, J48, Naive Bayes, and Random Forest as most common classifiers (MDPI, 2024)

**Key Finding:** LLM-based approaches are now outperforming traditional ML for architecture smell detection, particularly for detecting erosion symptoms in textual artifacts (code reviews, commit messages).

#### Embeddings for Architecture Drift Detection

An emerging approach uses code embeddings to detect when new code deviates from established architectural patterns:

- **SCALE (Semantic Code Analysis via Learned Embeddings)** — Uses LLM embeddings to determine functional code similarity; SCALE-FT achieved state-of-the-art on CodeNet Python800
- **Drift-Lens** (IEEE TKDE 2025) — Unsupervised framework using Frechet Distance between embedding distributions to detect concept drift in real-time
- **Detection methods**: Distance metrics (Euclidean/Cosine between centroids), domain classifiers (distinguish reference vs current), component-level drift (per-dimension analysis)
- **Open challenge**: Distinguishing architectural drift (bad) from legitimate evolution (good) remains unsolved

#### Continuous Architecture Monitoring Tools

- **Mintlify Autopilot** — Self-updating documentation engine: monitors codebase for user-facing changes, surfaces PRs needing doc updates, generates context-aware drafts
- **Swimm Auto-sync** — Deterministic staleness detection using static analysis (not pure LLM); CI integration marks docs as "potentially out of date" when impactful code changes occur
- **Dynatrace** — AI-powered application topology discovery, auto-detects dependencies in real-time
- **Teamscale** — Continuous, incremental (not periodic) real-time quality analysis

*Sources:*
- [2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf) — Anthropic, 2026
- [From Coder to Architect: Surviving the 2026 AI Shift](https://sequoia-connect.com/from-coder-to-architect-surviving-the-2026-ai-shift/) — 2026
- [Future of Agentic Coding: Conductors to Orchestrators](https://addyosmani.com/blog/future-agentic-coding/) — Addy Osmani
- [Machine Learning-Based Methods for Code Smell Detection: A Survey](https://www.mdpi.com/2076-3417/14/14/6149) — MDPI, 2024
- [Towards Automated Identification of Architecture Erosion](https://arxiv.org/pdf/2306.08616) — arXiv, 2025
- [InSet: Architecture Smell Detection Using ML](https://dl.acm.org/doi/10.1145/3422392.3422507) — ACM, 2020
- [Semantic Codebase Search](https://greptile.com/blog/semantic-codebase-search) — Greptile, 2025
- [SCALE Code Embeddings](https://github.com/jaso1024/semantic-code-embeddings) — GitHub
- [Drift-Lens Framework](https://github.com/grecosalvatore/drift-lens) — GitHub
- [Qodo AI Code Review](https://www.qodo.ai/) — Qodo
- [Mintlify Autopilot](https://www.mintlify.com/blog/autopilot) — Mintlify, 2025
- [Swimm Auto-sync](https://docs.swimm.io/features/keep-docs-updated-with-auto-sync) — Swimm

---

### 6. Monorepo-Specific Evaluation Tooling

#### Turborepo Analysis

**Built-in Capabilities:**
- `turbo run --dry-run` — Shows task dependency graph without executing
- `turbo run --summarize` — Generates JSON metadata in `.turbo/runs/` with cache stats, task timings, and affected packages
- `turbo boundaries` — Checks for importing files outside package directory, verifies deps declared in `package.json`, supports tag-based allow/deny rules
- `turbo ls` — List packages and their relationships
- Task hash-based caching — Cache hit rates indicate package isolation quality
- Remote caching — Vercel Remote Cache for CI/CD performance (free for Vercel-linked repos)

**Performance Benchmarks:**
- Turborepo shows 2.8s cold builds vs Nx 8.3s in benchmarks (3x faster for small repos)
- Cache hit speedups: 17x faster (296ms vs 5s) for unchanged code
- Target cache hit rate: 70%+ locally, 90%+ in CI
- For repos with 30+ apps, Nx shows 7x better performance than Turborepo

**Architecture Metrics from Turborepo:**
- **Cache hit rate**: Higher hit rates = better package isolation. Target > 90% for mature monorepos
- **Task graph depth**: Deeper graphs = more sequential dependencies = slower builds
- **Package fan-out**: Number of packages affected by a single change
- **Build time trends**: Track build times over time as an architecture health indicator

**Turborepo vs Nx for Analysis:**

| Feature | Turborepo | Nx |
|---------|-----------|-----|
| Dependency graph visualization | Basic (`--graph`, DOT output) | Rich (interactive Nx Graph UI) |
| Affected analysis | Via caching | `nx affected` command |
| Module boundary enforcement | `turbo boundaries` (tag-based) | `@nx/enforce-module-boundaries` (ESLint) |
| Architecture constraints | Tag-based allow/deny | Built-in tag system with regex |
| Performance analytics | `--summarize` JSON + turborepo-summary | Nx Cloud Task Analytics (Enterprise) |
| Custom generators | No | Yes (Nx generators) |
| Build performance insights | Cache stats | Nx Cloud analytics + flaky test detection |
| Best for | Small-medium repos (<15 apps) | Large repos (30+ apps) |

#### Package Boundary Enforcement

**dependency-cruiser (Recommended for TypeScript/JS):**
```javascript
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true },
      to: {}
    },
    {
      name: 'vendor-abstractions-only',
      comment: 'Never import @planetscale/* directly - use @vendor/db',
      severity: 'error',
      from: { pathNot: '^vendor/' },
      to: { path: '@planetscale' }
    }
  ]
};
```

**ArchUnitTS (Architecture tests for TypeScript):**
```typescript
import { projectFiles } from 'archunit';

it('should not have circular dependencies', async () => {
  const rule = projectFiles()
    .inFolder('src/**')
    .should()
    .haveNoCycles();
  await expect(rule).toPassAsync();
});

it('should respect layer boundaries', async () => {
  const rule = projectFiles()
    .inFolder('src/presentation/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/data/**');
  await expect(rule).toPassAsync();
});
```
- Integrates with Jest, Vitest, Jasmine — runs as normal test suite
- No special syntax; architecture rules become standard test assertions

**eslint-plugin-boundaries:**
- Define element types (apps, packages, vendor, api)
- Define allowed dependency rules between types
- Enforce in ESLint configuration
- CI integration for boundary violation detection

**knip (Unused Code Detection):**
- Detects unused files, dependencies, exports, types, enum members
- Monorepo-aware: works with workspaces
- Configurable entry points per workspace
- Fast: uses TypeScript compiler API

#### Dependency Graph Analysis

**Tools Comparison:**

| Tool | Detects Unused | Circular Deps | Visualization | Monorepo Support |
|------|---------------|---------------|---------------|-----------------|
| **dependency-cruiser** | No | Yes | DOT/SVG/HTML | Yes |
| **knip** | Yes (files, deps, exports) | No | No | Yes (workspaces) |
| **madge** | No | Yes | SVG/DOT | Partial |
| **depcheck** | Yes (deps only) | No | No | Limited |
| **better-deps** | Partial | No | No | Yes (designed for) |

#### Build Performance as Architecture Metric

**Key Metrics to Track:**
1. **Total build time** — Trend over time, alert on regressions
2. **Cache hit rate** — Per-package and overall; drops indicate boundary violations
3. **Affected package count** — How many packages does a typical PR touch?
4. **CI pipeline duration** — Including test, lint, typecheck, build steps
5. **Install time** — `pnpm install` duration as proxy for dependency health

**Benchmarks (from industry):**
- Uber achieved 50% build time reduction with Buildkite + Bazel remote cache
- Pants Build Tool reports 92% build speedup with remote caching, 94.5% cache hit rate
- Gradle reports hourly monitoring of build performance to detect regressions
- PayFit reduced deployment from 2-5 days to 20 minutes using Nx
- Hetzner Cloud cut CI time from 45 minutes to 6 minutes with 85% cache hit rate (Nx)
- Target cache hit rate: > 90% for mature monorepos; < 85% indicates configuration problems

*Sources:*
- [How Uber Halved Monorepo Build Times with Buildkite](https://buildkite.com/resources/blog/how-uber-halved-monorepo-build-times-with-buildkite/) — Buildkite, 2024
- [Monitoring Build Performance at Scale](https://gradle.com/blog/monitoring-build-performance-at-scale/) — Gradle, 2024
- [Extracting Build Performance Metrics](https://bazel.build/advanced/performance/build-performance-metrics) — Bazel, 2025
- [How We Organize Our Monorepo to Ship Fast](https://graphite.dev/blog/how-we-organize-our-monorepo-to-ship-fast) — Graphite, 2025
- [better-deps CLI](https://github.com/ecraig12345/better-deps) — GitHub
- [Finding Unused npm Dependencies with depcheck](https://sapegin.me/blog/finding-unused-npm-dependencies-with-depcheck/) — Sapegin
- [Pick Your Monorepo Poison](https://toolstac.com/compare/nx/lerna/rush/bazel/turborepo/monorepo-tools-comparison) — Toolstac, 2025

---

## Trade-off Analysis

| Factor | Lightweight (Fitness Functions + CI) | Medium (+ DORA + ADRs) | Heavy (+ ATAM + AI Analysis) |
|--------|--------------------------------------|------------------------|-------------------------------|
| **Setup Cost** | Low (1-2 days) | Medium (1-2 weeks) | High (2-4 weeks) |
| **Ongoing Cost** | Minimal (automated) | Low (monthly review) | Medium (quarterly review + AI costs) |
| **Coverage** | Code structure only | Structure + delivery + decisions | Full architecture quality |
| **Actionability** | High (immediate CI feedback) | High (metrics + context) | Medium (requires interpretation) |
| **False Positive Rate** | Low (deterministic rules) | Low | Medium (AI-generated findings) |
| **Evolution Detection** | Drift only | Drift + trends | Drift + trends + smell detection |
| **Best For** | Teams starting out | Growing teams | Teams at scale with complex architecture |

---

## Recommended Approach for Lightfast

### Phase 1: Foundation (Week 1-2)
1. **dependency-cruiser** — Enforce package boundaries (vendor abstractions, layer rules, no circular deps)
2. **knip** — Detect unused code across the monorepo
3. **Basic fitness functions** — Bundle size budgets, TypeScript strict mode, no `any` types in shared packages
4. **ADR directory** — Start capturing architectural decisions in `thoughts/shared/adrs/`

### Phase 2: Metrics (Week 3-4)
1. **DORA metrics** — Track deployment frequency and change failure rate per app
2. **Build performance tracking** — Cache hit rates, build times, affected package counts
3. **Evaluation results storage** — Immutable, versioned results in a structured format
4. **Signal-to-noise baseline** — Classify initial findings, establish baseline ratio

### Phase 3: Intelligence (Week 5-8)
1. **AI-assisted analysis** — Claude Code-powered architecture review on PRs
2. **Architecture smell detection** — Automated detection of God Components, unstable dependencies
3. **Pipeline versioning** — Feature flags for new evaluation criteria
4. **Meta-evaluation loop** — Monthly retrospective on evaluation quality

### Phase 4: Evolution (Ongoing)
1. **Continuous improvement** — Double-loop learning on evaluation criteria
2. **Backstage-style catalog** — Service/package registry with health scores
3. **Architecture observability** — Real-time dashboards for architecture health
4. **Automated ADR generation** — AI-assisted documentation of decisions detected in PRs

### Pipeline Versioning Strategy

```
evaluation-pipeline/
├── v1.0.0/
│   ├── criteria.json          # Evaluation criteria + thresholds
│   ├── fitness-functions/     # Automated checks
│   └── README.md              # What changed, why
├── results/
│   ├── 2026-02-07-v1.0.0.json # Immutable results
│   └── 2026-02-14-v1.0.0.json
└── meta/
    ├── signal-noise-log.json  # Track finding quality
    └── retrospectives/        # Monthly evaluation reviews
```

---

## Sources

### Architecture Evaluation Frameworks
- [SEI ATAM Method](https://resources.sei.cmu.edu/library/asset-view.cfm?assetID=5177) — Carnegie Mellon SEI
- [QUASAR Method](https://sei.cmu.edu/library/quasar-a-method-for-the-quality-assessment-of-software-intensive-system-architectures) — SEI, 2006
- [MITRE Architecture Quality Assessment](https://www.mit.edu/~richh/writings/aqa-swee.pdf) — MITRE/MIT
- [Methods for Evaluating Software Architecture: A Survey](https://research.cs.queensu.ca/TechReports/Reports/2008-545.pdf) — Queen's University, 2008
- [Lightweight Architecture Evaluation for Industry](https://pmc.ncbi.nlm.nih.gov/articles/PMC8838159/) — PMC, 2022
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/) — Google
- [Accelerate: State of DevOps](https://dora.dev/research/) — Google

### Fitness Functions
- [Fitness Functions for Architecture](https://infoq.com/articles/fitness-functions-architecture) — InfoQ, 2025
- [Continuous Architecture: Fitness Functions](https://www.continuous-architecture.org/practices/fitness-functions/) — Continuous Architecture
- [Unit Tests for Architecture](https://trailheadtechnology.com/fitness-functions-unit-tests-for-your-architecture/) — 2024
- [Fitness Functions as Guide to Design](https://www.ben-morris.com/using-architectural-fitness-functions-as-a-guide-to-system-design/) — Ben Morris, 2025

### Pipeline & Versioning
- [Dagster Software-Defined Assets](https://docs.dagster.io/concepts/assets/software-defined-assets) — Dagster
- [MLflow Experiment Tracking](https://mlflow.org/docs/latest/tracking.html) — MLflow
- [DVC Data Version Control](https://dvc.org/) — Iterative AI

### Meta-Evaluation
- [AI Code Review Signal-to-Noise Framework](https://jetxu-llm.github.io/posts/low-noise-code-review/) — 2025
- [MITRE AQA v2.0](https://www.mit.edu/~richh/writings/aqa-v2.pdf) — MITRE/MIT, 1996
- [Assessing Architectural Design Quality Metrics](https://inria.hal.science/hal-01664311v1/document) — INRIA, 2018
- [Code Quality Metrics: Signal from Noise](https://blog.ndepend.com/code-quality-metrics-signal-noise/) — NDepend, 2017
- [CodeMetrics Project](https://code-metrics-project.github.io/docs/) — CodeMetrics
- [Joint Committee Program Evaluation Standards](https://evaluationstandards.org/program/) — JCSEE, 2010
- [Scriven's Meta-Evaluation Checklist](https://www.cobblestoneeval.com/wp-content/uploads/2013/05/EVALUATING_EVALUATIONS_8.16.11.pdf) — Scriven
- [Stufflebeam's Program Meta-evaluation Checklist](https://files.wmich.edu/s3fs-public/attachments/u350/2014/program_metaeval_long.pdf) — WMU, 2012
- [Double-Loop Learning in Organizations](https://hbr.org/1977/09/double-loop-learning-in-organizations) — Argyris, HBR 1977
- [Eval Feedback Loops](https://www.braintrust.dev/blog/eval-feedback-loops) — Braintrust, 2024
- [Reducing False Positives with LLMs](https://arxiv.org/html/2601.18844v1) — arXiv, 2026
- [False Negatives/Positives of Static Analyzers](https://arxiv.org/html/2408.13855v1) — arXiv, 2024
- [A/B Testing Systematic Literature Review](https://www.sciencedirect.com/science/article/pii/S0164121224000542) — ScienceDirect, 2024
- [Microsoft Experimentation Platform](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/) — Microsoft Research

### Architecture Practices & ADRs
- [ADRs: Actually Using Them](https://m7y.me/post/2025-12-23-architecture-decision-records/) — m7y.me, 2025
- [Decentraland ADR Process](https://adr.decentraland.org/adr/ADR-1) — 2020
- [InnerSource Patterns](https://innersourcecommons.org/learn/patterns/) — InnerSource Commons
- [InnerSource Circumplex Model](https://arxiv.org/abs/2502.15747) — arXiv, 2025
- [ArchUnitTS](https://github.com/LukasNiessen/ArchUnitTS) — Architecture testing for TypeScript
- [ts-arch](https://github.com/ts-arch/ts-arch) — TypeScript architecture tests with PlantUML
- [Spotify Soundcheck](https://backstage.spotify.com/docs/plugins/soundcheck/) — Tech Health Scorecards
- [Netflix Paved Road](https://seifrajhi.github.io/blog/paved-roads-netflix-developers/) — Developer Enablement
- [Shopify Modular Monolith](https://shopify.engineering/shopify-monolith) — Shopify Engineering
- [Google Design Reviews](https://research.google/pubs/improving-design-reviews-at-google/) — Google Research
- [Structurizr DSL](https://docs.structurizr.com/dsl) — Architecture as Code

### AI-Assisted Evaluation
- [2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf) — Anthropic, 2026
- [From Coder to Architect](https://sequoia-connect.com/from-coder-to-architect-surviving-the-2026-ai-shift/) — 2026
- [Future of Agentic Coding](https://addyosmani.com/blog/future-agentic-coding/) — Addy Osmani
- [Software Development in 2026: AI Agents](https://www.techtarget.com/searchapparchitecture/opinion/A-hands-on-look-at-AI-agents) — TechTarget, 2026
- [ML-Based Code Smell Detection Survey](https://www.mdpi.com/2076-3417/14/14/6149) — MDPI, 2024
- [Automated Architecture Erosion Detection](https://arxiv.org/pdf/2306.08616) — arXiv, 2025
- [InSet: Architecture Smell Detection](https://dl.acm.org/doi/10.1145/3422392.3422507) — ACM, 2020
- [Python Code Smell Detection Using ML](https://dl.acm.org/doi/full/10.1145/3728985.3728993) — ACM, 2025

### Monorepo Tooling
- [Uber Monorepo Build Times](https://buildkite.com/resources/blog/how-uber-halved-monorepo-build-times-with-buildkite/) — Buildkite, 2024
- [Build Performance Monitoring](https://gradle.com/blog/monitoring-build-performance-at-scale/) — Gradle, 2024
- [Bazel Build Performance Metrics](https://bazel.build/advanced/performance/build-performance-metrics) — Bazel, 2025
- [Graphite Monorepo Organization](https://graphite.dev/blog/how-we-organize-our-monorepo-to-ship-fast) — Graphite, 2025
- [better-deps CLI](https://github.com/ecraig12345/better-deps) — GitHub
- [Monorepo Tool Comparison](https://toolstac.com/compare/nx/lerna/rush/bazel/turborepo/monorepo-tools-comparison) — Toolstac, 2025
- [Google Code Coverage Infrastructure](https://homes.cs.washington.edu/~rjust/publ/google_coverage_fse_2019.pdf) — Google/UW, 2019

---

## Addendum: Deep Dive — Dependency-Cruiser for pnpm Monorepos & Turbo Boundaries Maturity

*Added in response to revision request from senior dev review.*

### A1. dependency-cruiser in pnpm Workspaces at Scale (80+ Packages)

#### Configuration Strategy: Per-Package vs Root

There are two approaches for running dependency-cruiser in a pnpm monorepo:

**Approach 1: Root-level configuration (Recommended for <30 packages)**
```javascript
// .dependency-cruiser.cjs at monorepo root
module.exports = {
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json', // root tsconfig with project references
    },
    // IMPORTANT: combinedDependencies merges root + package deps
    // Required when shared deps live in root package.json
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
  forbidden: [/* rules */],
};
```

**Approach 2: Per-package configuration (Recommended for 30+ packages)**
```javascript
// packages/ui/.dependency-cruiser.cjs
module.exports = {
  extends: '../../.dependency-cruiser-base.cjs', // shared base rules
  options: {
    tsConfig: {
      fileName: './tsconfig.json', // package-level tsconfig
    },
  },
  forbidden: [
    // package-specific rules can override or extend base
  ],
};
```

Run per-package via Turborepo task:
```json
// turbo.json
{
  "tasks": {
    "lint:deps": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", ".dependency-cruiser.cjs"]
    }
  }
}
```
```json
// Each package's package.json
{
  "scripts": {
    "lint:deps": "depcruise src --config .dependency-cruiser.cjs"
  }
}
```

**Why per-package wins at scale:**
- Turborepo parallelizes and caches each package's `lint:deps` independently
- Avoids the `combinedDependencies` bug (GitHub issue #859, #947) where root-level runs misinterpret `baseDir` for nested packages
- Each package's tsconfig is resolved correctly without path mapping conflicts
- Cache hits skip unchanged packages entirely — critical for 80+ package repos

#### Known Issues at Scale

| Issue | GitHub | Status | Workaround |
|-------|--------|--------|------------|
| `combinedDependencies` baseDir error | [#859](https://github.com/sverweij/dependency-cruiser/issues/859) | Partially fixed | Use per-package configs |
| Path resolution in nested workspaces | [#862](https://github.com/sverweij/dependency-cruiser/issues/862) | Open | Explicit `tsConfig.fileName` per package |
| `no-non-package-json` false positives | [#947](https://github.com/sverweij/dependency-cruiser/issues/947) | Fixed in v16+ | Upgrade or use `combinedDependencies: true` with v16+ |

#### Enforcing `@vendor/*` Abstraction Layers

Lightfast uses a vendor abstraction pattern (e.g., `@vendor/db` wraps `@planetscale/*`). dependency-cruiser can enforce this with `forbidden` rules:

```javascript
// .dependency-cruiser-base.cjs — shared across all packages
module.exports = {
  forbidden: [
    // === VENDOR ABSTRACTION ENFORCEMENT ===
    {
      name: 'vendor-only-planetscale',
      comment: 'Use @vendor/db instead of @planetscale/* directly (CLAUDE.md rule)',
      severity: 'error',
      from: { pathNot: '^vendor/db/' },
      to: { path: '^@planetscale' }
    },
    {
      name: 'vendor-only-clerk',
      comment: 'Use @vendor/clerk instead of @clerk/* directly',
      severity: 'error',
      from: { pathNot: '^vendor/clerk/' },
      to: { path: '^@clerk' }
    },
    {
      name: 'vendor-only-upstash',
      comment: 'Use @vendor/upstash instead of @upstash/* directly',
      severity: 'error',
      from: { pathNot: '^vendor/upstash/' },
      to: { path: '^@upstash' }
    },
    // === LAYER RULES ===
    {
      name: 'no-app-to-app-imports',
      comment: 'Apps must not import from other apps',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^apps/', pathNot: '$from.dir' }
    },
    {
      name: 'no-package-to-app-imports',
      comment: 'Packages must not import from apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' }
    },
    {
      name: 'no-circular-packages',
      comment: 'No circular dependencies between workspace packages',
      severity: 'error',
      from: {},
      to: { circular: true, path: '^(packages|vendor|api|db)/' }
    },
    // === SCOPE RULES ===
    {
      name: 'console-packages-only',
      comment: '@repo/console-* packages only importable by apps/console',
      severity: 'error',
      from: { pathNot: '^(apps/console|packages/console-)' },
      to: { path: '^@repo/console-' }
    }
  ]
};
```

**Pattern for adding new vendor abstractions:**
1. Create `vendor/<name>/` package with re-exports
2. Add `forbidden` rule: `from: { pathNot: '^vendor/<name>/' }, to: { path: '^@<sdk-vendor>' }`
3. Run `depcruise` to find existing direct imports
4. Migrate direct imports to use `@vendor/<name>`

#### Performance Characteristics

**No published benchmarks exist** for dependency-cruiser at 80+ package scale. Based on the codebase analysis and community reports:

- **Single package analysis**: Typically 1-5 seconds for a medium TypeScript package (500-2000 files)
- **Full monorepo scan** (root-level): Can exceed 30-60 seconds for large repos due to full dependency graph traversal
- **Per-package via Turborepo**: Each package runs in 1-5s, parallelized across packages, with Turborepo caching. For 80 packages with 90%+ cache hit rate, expect <10s in CI after initial run
- **Memory**: dependency-cruiser loads the full AST; for very large packages, memory can peak at 500MB+. Per-package runs keep this bounded
- **Visualization**: Generating SVG/DOT graphs for 80+ packages is impractical — use `--include-only` to scope to specific package subsets

**Recommendation for Lightfast (14+ packages, growing):**
- Start with root-level config now (manageable at current scale)
- Extract to per-package configs when hitting 25-30 packages
- Always run via `turbo run lint:deps` for parallelization and caching

#### TypeScript Monorepo Boundary Enforcement Best Practices

**Layered defense approach (ordered by ease of adoption):**

| Layer | Tool | What It Catches | CI Integration |
|-------|------|-----------------|----------------|
| 1. Package boundaries | `turbo boundaries` | Missing `package.json` deps, cross-package file imports | `turbo boundaries` in CI |
| 2. Dependency rules | `dependency-cruiser` | Vendor abstraction violations, layer rules, circular deps | `depcruise src --config` per package |
| 3. Architecture tests | `ArchUnitTS` | Layer violations, naming conventions, code organization | Jest/Vitest test suite |
| 4. Unused code | `knip` | Dead exports, unused dependencies, orphaned files | `knip` in CI |
| 5. Import restrictions | `eslint-plugin-boundaries` | Element type restrictions (apps, packages, vendor) | ESLint |

**For Lightfast specifically:**
- **Layer 1** (`turbo boundaries`): Free, already in Turborepo — enable immediately for basic hygiene
- **Layer 2** (`dependency-cruiser`): Primary enforcement tool — vendor abstractions, no-circular, layer rules
- **Layer 3** (`ArchUnitTS`): Optional — add if team wants architecture rules as testable assertions
- **Layer 4** (`knip`): High value — catches dead code as packages evolve
- **Layer 5** (`eslint-plugin-boundaries`): Alternative to dependency-cruiser if ESLint-native workflow preferred

### A2. Turbo Boundaries: Version History & Maturity Assessment

#### Timeline

| Date | Version | Milestone |
|------|---------|-----------|
| Nov 14, 2024 | — | [RFC published](https://github.com/vercel/turborepo/discussions/9435) as GitHub Discussion #9435 |
| Jan 31, 2025 | Turborepo 2.4 | First experimental release of `turbo boundaries` |
| Feb 2025 – present | 2.4+ | Still marked **Experimental**, actively seeking feedback via RFC |

#### What It Checks (v2.4)

Two types of violations:
1. **Cross-package file imports**: Importing a file outside of the package's directory (e.g., `import { foo } from '../../other-pkg/src/utils'` instead of proper package imports)
2. **Undeclared dependencies**: Importing a package that is not specified as a dependency in the package's `package.json`

#### Tag-Based Rules (v2.4)

Tags allow dependency graph constraints at the package level:

```jsonc
// packages/ui/turbo.json — assign tag
{ "tags": ["internal"] }

// turbo.json — root-level rules
{
  "boundaries": {
    "tags": {
      "public": {
        "dependencies": {
          "deny": ["internal"]  // public packages cannot depend on internal
        }
      },
      "private": {
        "dependents": {
          "deny": ["public"]    // public packages cannot import private ones
        }
      }
    }
  }
}
```

Key capabilities:
- **Allow/deny lists** for both `dependencies` (what a tagged package can import) and `dependents` (who can import a tagged package)
- **Transitive enforcement**: Rules apply even for dependencies-of-dependencies
- **Package name targeting**: Can use package names (e.g., `@repo/my-pkg`) in place of tags in allow/deny lists

#### Maturity Assessment

| Criterion | Rating | Notes |
|-----------|--------|-------|
| **API stability** | Low | Explicitly marked "Experimental" with active RFC |
| **Feature completeness** | Medium | Basic violations + tag rules work, but limited compared to dependency-cruiser's regex-based rules |
| **Community adoption** | Low | RFC has 16 comments + 18 replies as of early 2025 |
| **Breaking change risk** | High | Vercel states: "This feature is experimental, and we're looking for your feedback on the Boundaries RFC" — API may change |
| **Production readiness** | Not recommended for sole enforcement | Good as supplementary check alongside dependency-cruiser |
| **Performance** | Excellent | Rust-based, runs in milliseconds even on large repos |
| **pnpm workspace support** | Yes | Built on Turborepo's workspace resolution which supports pnpm |

#### Comparison: `turbo boundaries` vs `dependency-cruiser`

| Capability | `turbo boundaries` | `dependency-cruiser` |
|-----------|-------------------|---------------------|
| Missing dependency detection | Yes | Yes (`no-non-package-json`) |
| Cross-package file imports | Yes | Yes (with path rules) |
| Vendor abstraction enforcement | Via tags only (coarse) | Via regex path rules (precise) |
| Circular dependency detection | No | Yes |
| Custom regex rules | No | Yes (full regex on paths) |
| Layer architecture rules | Via tags (limited) | Yes (path-based `from`/`to`) |
| Visualization | No | Yes (DOT/SVG/HTML/Mermaid) |
| Stability metrics | No | Yes (`--metrics` flag) |
| Performance at scale | Excellent (Rust) | Good (Node.js, parallelize via Turbo) |
| Maturity | Experimental (3 months) | Stable (6+ years, 945K weekly downloads) |
| Configuration complexity | Low (JSON tags) | Medium (JS rules with regex) |

#### Recommendation for Lightfast

**Use both tools in a complementary manner:**

1. **`turbo boundaries`** — Enable now as a lightweight first-pass check:
   - Zero config for basic violations (undeclared deps, cross-package file imports)
   - Tag `@vendor/*` packages as `"vendor"` and apps as `"app"` for basic guardrails
   - Runs in milliseconds, no extra dependency needed
   - Accept that the API may change — config is minimal so migration cost is low

2. **`dependency-cruiser`** — Primary enforcement tool:
   - Vendor abstraction rules with precise regex patterns
   - Circular dependency detection
   - Layer architecture rules (apps → packages → vendor flow)
   - Stability metrics for architecture drift monitoring
   - Visualization for architecture reviews

### Addendum Sources

- [dependency-cruiser FAQ — Monorepo usage](https://github.com/sverweij/dependency-cruiser/blob/main/doc/faq.md) — GitHub
- [dependency-cruiser Issue #859 — Monorepo configuration](https://github.com/sverweij/dependency-cruiser/issues/859) — GitHub, 2023
- [dependency-cruiser Issue #947 — combinedDependencies bugs](https://github.com/sverweij/dependency-cruiser/issues/947) — GitHub
- [dependency-cruiser Options Reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md) — GitHub
- [dependency-cruiser NPM — 945K weekly downloads](https://www.npmjs.com/package/dependency-cruiser) — NPM, v17.3.7
- [Turborepo 2.4 Release — Boundaries experimental](https://turborepo.dev/blog/turbo-2-4) — Vercel, Jan 31, 2025
- [Turbo Boundaries RFC — Discussion #9435](https://github.com/vercel/turborepo/discussions/9435) — GitHub, Nov 14, 2024
- [Turbo Boundaries API Reference](https://turborepo.dev/docs/reference/boundaries) — Turborepo Docs
- [Learning dependency-cruiser with Misskey](https://www.algonote.com/entry/dependency-cruiser) — Algonote, 2025

---

## Open Questions

1. **Lightfast-specific fitness functions**: What are the critical quality attributes for Lightfast? (Performance budgets, bundle sizes, API latency targets need to be defined by the team)
2. **DORA measurement tooling**: Which tool best integrates with Lightfast's GitHub + Vercel deployment pipeline? (LinearB, Sleuth, or custom GitHub Actions?)
3. **AI evaluation consistency**: How to make LLM-based architecture analysis reproducible across runs? (Temperature=0, structured outputs, deterministic prompts?)
4. **Cost-benefit threshold**: At what team size / codebase size does the full pipeline become cost-effective vs lightweight fitness functions only?
5. **Monorepo-specific DORA**: How to meaningfully measure deployment frequency per-package in a monorepo that deploys as a single unit via Vercel?
