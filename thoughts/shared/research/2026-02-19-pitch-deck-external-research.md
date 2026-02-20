---
date: 2026-02-19
researcher: external-agent
topic: "Lightfast pitch deck — external research"
tags: [research, web-analysis, pitch-deck, vc-frameworks, context-graphs]
status: complete
confidence: high
sources_count: 47
---

# External Research: Lightfast Pitch Deck

## Executive Summary

This research covers five areas critical to building Lightfast's early-stage pitch deck: VC frameworks, the problem space of organizational context loss, AI coding agent compute inefficiency, market opportunity data, and competitive landscape analysis.

**Key takeaways:**

1. **Use the Sequoia 10-slide format** — it's the gold standard. Sequoia's structure (Purpose, Problem, Solution, Why Now, Market Size, Competition, Product, Business Model, Team, Financials) is used by the majority of successful early-stage decks and maps perfectly to Lightfast's story.

2. **The problem is quantifiably massive** — developers spend only 5% of their time editing code (the rest is comprehension and navigation). AI coding agents waste 40%+ of tokens on brute-force grep navigation. Organizations lose 20% of engineering time to tool-switching and context collapse.

3. **"Why Now" is compelling** — AI coding agent spending hit $4B in 2025 (55% of all departmental AI spend). Cursor reached $1B ARR in under 2 years. 97% of enterprise developers use AI coding tools daily. The infrastructure layer is the next frontier.

4. **The market is enormous** — AI code tools market growing at 27% CAGR to $24-26B by 2030. Total developer tools market reaching $13.7B by 2030. AI consumed 50% of all global VC funding in 2025 ($211B of $425B).

5. **Competitors solve the wrong problem** — Current tools (Cursor, Copilot, Devin) focus on code generation but lack organizational context. They understand files, not decisions. There's a clear gap between "code search" and "context understanding."

---

## VC Pitch Deck Frameworks

### Sequoia Framework

Sequoia Capital's pitch deck format is the industry gold standard. It consists of **10 slides**:

1. **Company Purpose** — The mission distilled into one clear, memorable sentence. Sequoia calls this the most important part of your pitch. If you can't explain your purpose simply, it's a red flag.
2. **Problem** — Describe the pain of the customer (or the customer's customer). Outline how the customer addresses the issue today.
3. **Solution** — Demonstrate your company's value proposition to make the customer's life better. Show where your product physically sits. Provide use cases.
4. **Why Now** — Set up the historical evolution of your category. Define recent trends that make your solution possible.
5. **Market Size** — Identify/profile the customer you cater to. Calculate the TAM (top down), SAM (bottoms up) and SOM.
6. **Competition** — Focus on competitors and what differentiates your product.
7. **Product** — Product line-up (form factor, functionality, features, architecture, intellectual property) and development roadmap.
8. **Business Model** — How you make money and unit economics.
9. **Team** — Founding team and their qualifications.
10. **Financials** — Investment ask and projections.

**Why this format works:** The structure is designed around how investors evaluate opportunities: Can I understand this in 3 minutes? Is this a big market? Why will this team win? Why now?

**Source:** [Sequoia Capital Pitch Deck Template](https://pitchbuilder.io/blogs/news/what-is-the-sequoia-pitch-deck-model) | [Sequoia & YC Formats](https://www.inknarrates.com/post/pitch-deck-format-sequoia-yc-guy-kawasaki)

### a16z Framework

a16z evaluates across three risk dimensions: **Market Risk** (large, growing market?), **Product Risk** (compelling product with sustainable competitive advantages?), and **Execution Risk** (right team?).

**Key principles from a16z:**
- "We invest in problems, not products" — if the problem doesn't matter, neither does your solution
- "Go as simple as possible. Don't use complicated lingo, don't use complicated charts, don't try to sound sophisticated"
- "Your pitch has to be timely — why now? An idea that could have been done 10 years ago would have been done."
- They invest in people as much as ideas — "the real question is why you're the right team"
- Use data but don't overload — "one great stat is better than five forgettable ones"
- If pre-launch, show momentum: waiting list growth, partnerships, working prototype

**AI Infrastructure thesis specifically:** a16z raised a $1.7B AI infrastructure fund (36% increase from $1.25B in 2024), led by Jennifer Li. The thesis: exponential AI growth is straining existing computational and data paradigms. They prioritize **foundational technologies over application-layer solutions** — "the heartbeat of AI development." Portfolio includes OpenAI, ElevenLabs, Cursor, and emerging companies.

**For Lightfast:** This is directly relevant. Lightfast is infrastructure, not application layer. Position as the "context layer" that makes all AI coding tools more efficient.

**Source:** [a16z AI Infrastructure Fund: $1.7B](https://bitcoinworld.co.in/a16z-ai-infrastructure-fund-2025/) | [a16z Pitch Deck Guidelines](https://www.inknarrates.com/post/andreessen-horowitz-pitch-deck-guidelines) | [How to Pitch Your Startup - a16z](https://speedrun.substack.com/p/how-to-pitch-your-startup)

### YC Framework

YC's core philosophy: **Investors invest in teams, not slides.** Your slides should make your ideas more clear.

**Key YC principles:**
- Lead with whatever is most impressive about your company, not what comes first in a template
- Describe your startup in 2 sentences + one specific example
- Slides should be "visually boring with clear, large text" — stunning design hurts seed-stage pitches
- Three fundamental design principles: **Legibility, Simplicity, Obviousness**
- A successful pitch is a conversation starter — the more the investor talks, the more likely they invest
- Show non-obvious insights about your market or customers
- Ask directly for investment with clear milestones for the next 18-24 months

**Source:** [YC: How to design a better pitch deck](https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck) | [YC: How to build your seed round pitch deck](https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck)

### Common Success Patterns from Famous Decks

**Airbnb ($600K seed, 2008):**
- Cover slide: "Book rooms with locals, rather than hotels." — entire business explained in one sentence
- Problem statement clear and relatable (hotel cost + cultural disconnection)
- Business model in one line: "We take a 10% commission on each transaction"
- Market validation via existing behavior (17K weekly Craigslist listings in SF+NY proved demand)
- Showed early traction with real usage data
- Asked for $600K to make $2M revenue in 12 months

**Dropbox ($1.2M seed, 2007):**
- Connected investors to common pain points of file sharing/storage
- Straightforward design and clean layout
- Early emphasis on word-of-mouth growth as acquisition strategy

**LinkedIn (Series B, 2004):**
- Positioned as "professional people search 2.0"
- Highlighted revenue as priority despite no revenue yet
- Showed strategic vision for monetization

**Figma ($3.8M pre-seed, 2013):**
- Raised before even having a working product
- Sold the vision and team credibility

**Common thread:** Simplicity, clarity, one-sentence value propositions, showing demand through existing behavior, and credible teams.

**Source:** [CB Insights: Billion-Dollar Pitch Decks](https://www.cbinsights.com/research/billion-dollar-startup-pitch-decks/) | [Airbnb Pitch Deck Analysis](https://www.founderoo.co/resources/the-famous-airbnb-pitch-deck) | [Slidebean: Best Pitch Decks](https://slidebean.com/blog/best-startup-pitch-decks-of-all-time)

### What VCs Want to See for AI Infrastructure (2025-2026)

1. **Infrastructure > Applications** — a16z, Sequoia, and others are prioritizing foundational technologies. "When there's a gold rush, invest in picks and shovels."
2. **Clear "Why Now"** — what changed in the last 12 months that makes this possible/necessary?
3. **Unit economics thinking** — even pre-revenue, show you understand how you'll make money
4. **Capital efficiency** — not just "we'll burn less," but "our architecture is inherently more efficient"
5. **Timing with AI adoption** — 97% of enterprise developers now use AI tools daily; the infrastructure layer is the bottleneck
6. **AI consumed 50% of all global VC funding in 2025** ($211B of $425B total) — investors are actively looking for the next wave

---

## The Problem Space: Context Graphs in Organizations

### Why Teams Lose Context as They Scale

**The Expert Bottleneck Problem:**
- In a 50-person team: ~5 true experts, 1:9 expert-to-team ratio
- At 250 people: still ~5 experts, ratio drops to 1:49
- When any expert leaves, the knowledge gap grows dramatically
- **20% of engineering time is lost to tool-switching and context collapse**

**The Comprehension Problem:**
A comprehensive field study of professional developers found:
- **57.62%** of developer time goes to **program comprehension** (understanding code)
- **23.96%** goes to **navigation** (finding code)
- **13.40%** goes to other activities
- **Only 5.02%** goes to **editing** (actually writing code)

This means ~82% of a developer's time is spent understanding and finding code, not writing it.

**The Reading-to-Writing Ratio:**
- The ratio of time reading code vs writing code is **7:1 to 200+:1** depending on analysis method
- Engineers write code for approximately 1-10 minutes per day on average
- 61.5% of developers spend 4 hours or less per day "coding" (which includes reading, debugging, etc.)
- Only about 10% of developers spend more than 2 hours per day actually writing new code

**Source:** [Measuring Program Comprehension: Large-Scale Field Study](https://baolingfeng.github.io/papers/tsecomprehension.pdf) | [Software.com Code Time Report](https://www.software.com/reports/code-time-report) | [Sonarsource: Time Spent Coding](https://www.sonarsource.com/blog/how-much-time-do-developers-spend-actually-writing-code/)

### Linear/Jira/Confluence Failures

**Why Jira is hated by developers:**
- Performance is the #1 complaint — "you can make yourself a cup of tea while waiting for issues to load"
- Adding a single custom field can take 6+ pages and 30+ clicks
- Configuration demands technical knowledge that project managers often lack
- Systemic bloat accumulates over time, making the tool progressively slower
- "Emphasizes process over actual work" — moving a Jira card feels like progress regardless of tangible outcomes
- Features are hidden in multi-layered menus; users can't find capabilities they need

**Why Confluence fails at knowledge management:**
- Steep learning curve deters adoption
- Executives view it as a technical tool rather than a strategic enabler
- Many employees prefer Google Docs, Notion, or Slack for documentation
- Knowledge management requires a cultural shift most enterprises can't enforce
- Decision context gets lost between systems — the "why" behind decisions lives in Slack threads, meeting recordings, and people's heads

**The Shadow IT problem:**
- Teams adopt unauthorized tools when official ones are cumbersome
- Knowledge fragments across Slack, Notion, Linear, Google Docs, email, and ad hoc tools
- No single system captures the full context graph of decisions, discussions, and outcomes

**Source:** [Why People Hate Jira](https://deviniti.com/blog/enterprise-software/why-hate-jira/) | [Why Confluence/Jira Underutilized](https://sasichandru.medium.com/why-atlassian-confluence-and-jira-were-least-utilized-at-the-enterprise-level-my-experience-9b38e2413583) | [Herdr: Top 5 Issues with Jira](https://blog.herdr.io/work-management/simple-easy-project-management-the-top-5-issues-with-jira/)

### Research on Organizational Memory

**Knowledge Management Failure Factors:**
- Lack of clear ownership is the most common reason knowledge management fails
- "When businesses leave responsibility to everyone, no one will be accountable"
- Different facets of knowledge-sharing require contradictory strategies, making it extremely difficult for teams to work effectively on all aspects simultaneously
- None of the intranet-implementation projects studied actually managed to encourage knowledge-sharing as intended

**The Cost of Knowledge Loss:**
- Knowledge loss happens when expertise and context depart with employees
- Caused by employee turnover, poor documentation, and disconnected systems
- Organizations must treat knowledge management as a technical problem, not just a cultural one

**Source:** [Synthesis of Knowledge Management Failure Factors](https://www.dau.edu/sites/default/files/Migrated/CopDocuments/A_Synthesis_of_Knowledge_Management_Failure_Factors-2014.pdf) | [Why Knowledge Management Fails](https://bloomfire.com/blog/why-knowledge-management-fails/) | [Cost of Organizational Knowledge Loss](https://www.iteratorshq.com/blog/cost-of-organizational-knowledge-loss-and-countermeasures/)

### The Fundamental Gap

**The "Context Window" Analogy for Organizations:**
Just as LLMs have limited context windows (~1M tokens), organizations have limited "context capacity." A typical enterprise monorepo spans thousands of files and millions of tokens, but there are also **millions of tokens of organizational context** that lives outside the codebase — in Slack, Jira, Notion, meetings, and people's heads.

**The Core Insight:** Current tools treat code as isolated files. But software is built through decisions, discussions, and context that spans multiple systems. When an AI agent tries to work on a codebase without this organizational context, it's like a new hire who can see the code but doesn't know why anything was built the way it was.

**The Scale Problem:** "The more context you add, the less stable your AI system becomes." Research from Chroma found that "models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows." This means naive "stuff more context" approaches fail — you need intelligent context curation.

**Source:** [Factory.ai: The Context Window Problem](https://factory.ai/news/context-window-problem) | [Context Engineering Challenges](https://langwatch.ai/blog/the-6-context-engineering-challenges-stopping-ai-from-scaling-in-production) | [Context Engineering: Why Agents Fail](https://inkeep.com/blog/context-engineering-why-agents-fail)

---

## AI Coding Agents: The Compute Inefficiency Problem

### How Claude Code Works and Its Limitations

**Architecture:**
- Claude Code is an agentic assistant that runs in your terminal
- Works through three phases: **gather context, take action, verify results**
- Uses tools (Glob, Grep, Read, Bash) to search files, edit code, run commands
- Each search is literal string matching via grep/ripgrep — **no indexes, no embeddings, no semantic understanding**

**The Navigation Problem:**
When Claude Code receives a task like "fix the authentication bug," it:
1. Searches for relevant files using grep (multiple rounds)
2. Reads multiple files to understand context
3. Makes coordinated edits
4. Runs tests to verify

Steps 1-2 consume the vast majority of tokens. Each grep search returns results that must be processed by the LLM, often including irrelevant matches that waste context window space.

**Mitigation Strategies Built In:**
- Subagents get their own fresh context (isolation prevents context bloat)
- CLAUDE.md provides persistent project-specific memory
- `/compact` command summarizes conversation to reduce token count
- Skills load on demand, not at session start

**Source:** [How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works) | [Save 95% of Tokens](https://medium.com/@simonsruggi/youre-using-claude-code-wrong-here-s-how-to-save-95-of-tokens-db6114c1f4d6) | [Optimize Claude Code Context by 60%](https://medium.com/@jpranav97/stop-wasting-tokens-how-to-optimize-claude-code-context-by-60-bfad6fd477e5)

### Token Budget Waste on Navigation/Search

**The Grep Problem (Milvus/Zilliz Analysis):**
- Claude Code relies on grep-only retrieval — "no understanding of structure or semantics"
- Developers "end up sifting through haystacks of irrelevant matches before finding the one needle they need"
- Critics: grep "drowns you in irrelevant matches, burns tokens, and stalls your workflow"
- Replacing grep with semantic vector search via RAG **reduces token usage by 40%+** without any loss in recall
- This translates directly into lower API costs and faster responses

**Token Consumption Research (OpenReview):**
- Input tokens dominate overall consumption and cost in agentic coding, even with token caching
- More complex tasks consume more tokens, but variance is huge — some runs use **10x more tokens** than others for the same task
- A standard "tools in prompt" approach required ~150,000 tokens for one task; a code execution approach achieved the same result with ~2,000 tokens — a **98.7% reduction**

**Google's BATS Framework:**
- Google Research found that simply granting agents a larger tool-call budget **fails to improve performance** — agents lack "budget awareness" and quickly hit a performance ceiling
- Without budget sense, agents "spend 10 or 20 tool calls digging into a lead, only to realize the entire path was a dead end"
- Their Budget Tracker module provides agents with continuous resource awareness
- Budget-aware methods produce more favorable scaling curves and push the cost-performance Pareto frontier
- **92% of enterprise decision makers reported AI agent costs higher than expected**
- **68% of digital leaders experienced major budget overruns during first deployments**, often driven by runaway tool loops

**Source:** [Milvus: Claude Code's Grep Burns Too Many Tokens](https://zilliz.com/blog/why-im-against-claude-codes-grep-only-retrieval-it-just-burns-too-many-tokens) | [Google BATS Framework](https://venturebeat.com/ai/googles-new-framework-helps-ai-agents-spend-their-compute-and-tool-budget) | [Budget-Aware Tool-Use Paper](https://arxiv.org/abs/2511.17006) | [OpenReview: Coding Agent Token Consumption](https://openreview.net/forum?id=1bUeVB3fov)

### The "Finding Things" Problem

**At Google Scale:**
- A large number of code searches are for navigation — finding desired files or symbols
- About one-third of searches are about seeing examples of how others have done something
- Developers search through code at least 5 sessions per day

**The Fundamental Inefficiency:**
Current AI coding agents approach code search the same way a developer with `grep` does — pattern matching. But code has structure:
- Abstract Syntax Trees (ASTs) encode hierarchy
- Data-flow graphs show how values propagate
- Dependency graphs map relationships between modules
- Call graphs trace execution paths

**Graph-Based RAG approaches** leverage this structure:
- Nodes represent code entities (functions, classes, variables)
- Edges encode relationships (function calls, inheritance, imports, data/control flow)
- This allows "conceptual similarity" retrieval rather than keyword matching

**Source:** [Google SWE Book: Code Search](https://abseil.io/resources/swe-book/html/ch17.html) | [How Cursor Indexes Your Codebase](https://towardsdatascience.com/how-cursor-actually-indexes-your-codebase/) | [Retrieval-Augmented Code Generation Survey](https://arxiv.org/pdf/2510.04905)

### Opportunities for Better Retrieval

**What Cursor Does (and its limits):**
- Cursor automatically synchronizes its code index through periodic checks (~every 5 minutes)
- Detects changes and refreshes only affected files by removing outdated embeddings and generating new ones
- Uses semantic code chunking based on Tree-sitter syntax analysis
- BUT: focused on the current codebase only — no organizational context, no cross-repo understanding

**What Augment Code Does:**
- Processes 400,000+ files through semantic dependency graph analysis
- Understands relationships between services and call chains across repositories
- Real-time indexing of changes

**What Sourcegraph Cody Does:**
- Approaches context as a search and discovery problem
- Builds on Sourcegraph's semantic code graph using embeddings
- Maps every definition and reference in your codebase
- But: $66,600 median enterprise cost, documented reliability issues

**The Gap:** All of these focus on code-level context. None integrate organizational context — the decisions, discussions, and rationale behind the code.

**Source:** [How Cursor Indexes](https://towardsdatascience.com/how-cursor-actually-indexes-your-codebase/) | [Augment Code: 7 AI Agent Tactics](https://www.augmentcode.com/guides/7-ai-agent-tactics-for-multimodal-rag-driven-codebases) | [RAG for 10k Repos](https://www.qodo.ai/blog/rag-for-large-scale-code-repos/)

---

## Market Opportunity

### Market Size Data

| Metric | Value | Source |
|--------|-------|--------|
| AI Code Tools Market (2025) | $7.37B | Virtue Market Research |
| AI Code Tools Market (2030, projected) | $23.97-26.03B | Multiple sources |
| AI Code Tools CAGR | 26.6-27.1% | Grand View Research / Mordor Intelligence |
| Software Dev Tools Market (2025) | $6.41B | Mordor Intelligence |
| Software Dev Tools Market (2030) | $13.70B | Mordor Intelligence |
| Software Dev Tools CAGR | 16.4% | Mordor Intelligence |
| AI Code Generation Market (2024) | $4.91B | SNS Insider |
| AI Code Generation Market (2032, projected) | $30.1-37.34B | Yahoo Finance / SNS Insider |

### Key Adoption Metrics

| Metric | Value | Source |
|--------|-------|--------|
| Enterprise devs using AI coding tools daily | 97% | GitHub Survey 2024 |
| Developers using AI coding tools daily | 50% (65% in top-quartile orgs) | Multiple |
| % of code now written by AI (2026) | 41% | Index.dev |
| GitHub Copilot revenue (2025) | $400M (248% YoY growth) | Industry reports |
| Coding as % of departmental AI spend | 55% ($4.0B of $7.3B) | Menlo Ventures |
| Projects completed per week with Copilot | 126% more | GitHub |
| Developer time saved with AI tools | 30-75% on coding/testing/docs | Multiple |

### Growth Projections

- AI consumed **50% of all global VC funding in 2025** — $211B out of $425B total
- Global venture investment up 32% from H1 2024, on pace for third-highest year on record
- Engineering leaders allocating 1-3% of total engineering budgets to AI tools
- Average spending: $101-500 per developer per year on AI developer tools (2025)

**Source:** [Virtue Market Research](https://virtuemarketresearch.com/report/ai-developer-tools-market) | [Grand View Research](https://www.grandviewresearch.com/industry-analysis/ai-code-tools-market-report) | [Menlo Ventures: State of GenAI](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) | [DX: Engineering AI Budgets 2026](https://getdx.com/blog/how-are-engineering-leaders-approaching-2026-ai-tooling-budget/)

### Recent Investments in Space

| Company | Round | Valuation | ARR | Date |
|---------|-------|-----------|-----|------|
| Cursor (Anysphere) | Series D, $2.3B | $29.3B | $1B+ | Nov 2025 |
| Cursor (Anysphere) | Series C, $900M | $9.9B | $500M+ | Jun 2025 |
| Cursor (Anysphere) | Series B | $2.5B | — | Dec 2024 |
| Cursor (Anysphere) | Series A | $400M | — | Aug 2024 |
| Cognition (Devin) | $400M round | $10.2B | $73M (pre-acquisition) | Sep 2025 |
| Windsurf | Acquired by Cognition | $3B (last valuation) | $82M | Jul 2025 |

**Cursor is the fastest-growing SaaS company of all time** — from $1M to $500M ARR, with revenue doubling approximately every two months, surpassing records set by Wiz, Deel, and Ramp. Backed by Accel, Thrive Capital, a16z, DST, Coatue, Nvidia, and Google.

**Source:** [CNBC: Cursor $29.3B](https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html) | [TechCrunch: Anysphere $9.9B](https://techcrunch.com/2025/06/05/cursors-anysphere-nabs-9-9b-valuation-soars-past-500m-arr/) | [CNBC: Cognition $10.2B](https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html)

---

## Competitive Landscape

### Current Tools and Their Gaps

**GitHub Copilot:**
- Primarily focuses on current file context
- Struggles with cross-file context — doesn't know about helper functions in other packages unless imported
- Expanded beyond original 100-line context window but still struggles with large, interconnected codebases
- Best for: real-time inline code suggestions, quick completions
- Gap: No project-wide understanding, no organizational context

**Cursor AI:**
- Best-in-class codebase understanding via semantic indexing
- Indexes refresh every ~5 minutes using Tree-sitter syntax analysis
- Handles multi-file projects well
- Gap: Limited to code-level context. No understanding of why code was written, what decisions led to it, or organizational priorities

**Devin (Cognition):**
- Autonomous multi-file agent
- "Large or complex tasks may cause Devin to lose clarity, sometimes resulting in incomplete or repetitive solutions"
- "Struggles if the task requires advanced planning or deep codebase knowledge"
- Gap: Autonomous but without organizational context, making it prone to confident but wrong decisions

**Claude Code:**
- Powerful agentic terminal assistant with tool use
- Grep-only retrieval burns excessive tokens
- No persistent codebase index between sessions
- Gap: Every session starts with zero project understanding; must re-discover context each time

**Augment Code:**
- Processes 400K+ files through semantic dependency graph analysis
- Real-time indexing
- Gap: Enterprise-focused, expensive; still code-only context

**Sourcegraph Cody:**
- Semantic code graph with embeddings
- Maps definitions and references across codebase
- Gap: $66.6K median enterprise cost; documented reliability issues; code-only context

### What's Missing

**The universal gap across all competitors:** None of them integrate organizational context — the decisions, discussions, rationale, and institutional knowledge that lives outside the codebase. They understand **what** the code does but not **why** it was built that way.

**Lightfast's opportunity:** Build the context layer that connects:
- Code (what exists) → Decisions (why it exists) → People (who decided) → Priorities (what matters now)

This makes every AI coding tool more effective because it provides the organizational context they all lack.

---

## Trade-off Analysis

### Framework Choice: Sequoia vs. a16z vs. YC

| Criterion | Sequoia | a16z | YC |
|-----------|---------|------|----|
| Structure | 10 slides, rigid | Flexible, problem-first | Lead with strongest asset |
| Best for | Clear narrative arc | Deep technical thesis | Early traction stories |
| Recommended for Lightfast? | **Yes** — primary | Borrow "Why Now" emphasis | Borrow simplicity principles |

**Recommendation:** Use Sequoia's 10-slide structure as the backbone, but incorporate a16z's emphasis on "why now" timing and YC's principles of simplicity and leading with non-obvious insights.

### Positioning: Infrastructure vs. Application

a16z explicitly prioritizes "foundational technologies over application-layer solutions." Lightfast should position as **infrastructure** — the context layer that makes all AI coding tools better — not as another coding assistant.

### Narrative: Problem-First vs. Solution-First

Following both Airbnb's and a16z's approach: **lead with the problem**. The problem statement should be visceral and relatable to any technical investor:

> "AI coding agents waste 40% of their compute searching for context that should already be indexed. Meanwhile, organizations lose 20% of engineering productivity to context fragmentation across tools. The problem isn't code generation — it's that AI agents are operating blind."

---

## Sources

### VC Frameworks
- [Sequoia Pitch Deck Template](https://pitchbuilder.io/blogs/news/what-is-the-sequoia-pitch-deck-model) — PitchBuilder
- [Sequoia Capital Pitch Deck (PDF)](https://www.slideshare.net/slideshow/sequoia-capital-pitchdecktemplate/46231251) — SlideShare
- [a16z AI Infrastructure Fund](https://bitcoinworld.co.in/a16z-ai-infrastructure-fund-2025/) — BitcoinWorld, 2025
- [a16z Pitch Deck Guidelines](https://www.inknarrates.com/post/andreessen-horowitz-pitch-deck-guidelines) — Ink Narrates
- [How to Pitch Your Startup - a16z Speedrun](https://speedrun.substack.com/p/how-to-pitch-your-startup) — Substack
- [YC: How to Design a Better Pitch Deck](https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck) — Y Combinator
- [YC: How to Build Your Seed Round Pitch Deck](https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck) — Y Combinator
- [YC Pitch Deck Framework: 50+ Decks](https://theventurecrew.substack.com/p/y-combinator-pitch-deck-framework) — The Venture Crew

### Famous Pitch Decks
- [CB Insights: Billion-Dollar Startup Pitch Decks](https://www.cbinsights.com/research/billion-dollar-startup-pitch-decks/) — CB Insights
- [The Famous Airbnb Pitch Deck](https://www.founderoo.co/resources/the-famous-airbnb-pitch-deck) — Founderoo
- [Slidebean: Best Startup Pitch Decks](https://slidebean.com/blog/best-startup-pitch-decks-of-all-time) — Slidebean
- [Airbnb Pitch Deck Analysis](https://www.spectup.com/resource-hub/airbnb-pitch-deck-analysis) — Spectup

### Problem Space & Knowledge Management
- [Measuring Program Comprehension: Large-Scale Field Study](https://baolingfeng.github.io/papers/tsecomprehension.pdf) — IEEE TSE
- [Software.com Code Time Report](https://www.software.com/reports/code-time-report) — Software.com
- [How Much Time Developers Spend Writing Code](https://www.sonarsource.com/blog/how-much-time-do-developers-spend-actually-writing-code/) — SonarSource
- [Developers Spend Less Than 10% of Time Coding](https://drpicox.medium.com/developers-spend-less-than-10-of-time-coding-51c36c73a93b) — Medium
- [Why People Hate Jira](https://deviniti.com/blog/enterprise-software/why-hate-jira/) — Deviniti
- [Why Confluence/Jira Underutilized](https://sasichandru.medium.com/why-atlassian-confluence-and-jira-were-least-utilized-at-the-enterprise-level-my-experience-9b38e2413583) — Medium
- [Synthesis of Knowledge Management Failure Factors](https://www.dau.edu/sites/default/files/Migrated/CopDocuments/A_Synthesis_of_Knowledge_Management_Failure_Factors-2014.pdf) — DAU, 2014
- [Why Knowledge Management Fails](https://bloomfire.com/blog/why-knowledge-management-fails/) — Bloomfire
- [Cost of Organizational Knowledge Loss](https://www.iteratorshq.com/blog/cost-of-organizational-knowledge-loss-and-countermeasures/) — Iterators
- [Your Team Isn't Scaling Because You're Solving the Wrong Problem](https://gocrossbridge.com/blog/scaling-engineering-team/) — Crossbridge
- [Knowledge Loss in Organizations](https://www.golinks.com/blog/knowledge-loss/) — GoLinks

### AI Agent Compute & Token Efficiency
- [Milvus: Claude Code's Grep Burns Too Many Tokens](https://zilliz.com/blog/why-im-against-claude-codes-grep-only-retrieval-it-just-burns-too-many-tokens) — Zilliz/Milvus
- [Google BATS Framework](https://venturebeat.com/ai/googles-new-framework-helps-ai-agents-spend-their-compute-and-tool-budget) — VentureBeat, 2025
- [Budget-Aware Tool-Use Paper](https://arxiv.org/abs/2511.17006) — Google Research, 2025
- [OpenReview: Coding Agent Token Consumption](https://openreview.net/forum?id=1bUeVB3fov) — OpenReview
- [Token Cost Trap](https://medium.com/@klaushofenbitzer/token-cost-trap-why-your-ai-agents-roi-breaks-at-scale-and-how-to-fix-it-4e4a9f6f5b9a) — Medium
- [Hidden Economics of AI Agents](https://online.stevens.edu/blog/hidden-economics-ai-agents-token-costs-latency/) — Stevens Institute
- [Factory.ai: The Context Window Problem](https://factory.ai/news/context-window-problem) — Factory.ai
- [Context Engineering Challenges](https://langwatch.ai/blog/the-6-context-engineering-challenges-stopping-ai-from-scaling-in-production) — LangWatch

### Codebase Indexing & RAG
- [How Cursor Indexes Your Codebase](https://towardsdatascience.com/how-cursor-actually-indexes-your-codebase/) — Towards Data Science
- [Augment Code: 7 AI Agent Tactics](https://www.augmentcode.com/guides/7-ai-agent-tactics-for-multimodal-rag-driven-codebases) — Augment Code
- [RAG for 10k Repos](https://www.qodo.ai/blog/rag-for-large-scale-code-repos/) — Qodo
- [Google SWE Book: Code Search](https://abseil.io/resources/swe-book/html/ch17.html) — Google/Abseil
- [Building RAG on Codebases](https://lancedb.com/blog/building-rag-on-codebases-part-1/) — LanceDB
- [Retrieval-Augmented Code Generation Survey](https://arxiv.org/pdf/2510.04905) — arXiv, 2025

### Market Data
- [AI Developer Tools Market Report](https://virtuemarketresearch.com/report/ai-developer-tools-market) — Virtue Market Research
- [AI Code Tools Market](https://www.grandviewresearch.com/industry-analysis/ai-code-tools-market-report) — Grand View Research
- [AI Code Tools Market to $37.34B](https://finance.yahoo.com/news/ai-code-tools-market-hit-133000576.html) — Yahoo Finance / SNS Insider
- [Menlo Ventures: State of GenAI 2025](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) — Menlo Ventures
- [DX: Engineering AI Budgets 2026](https://getdx.com/blog/how-are-engineering-leaders-approaching-2026-ai-tooling-budget/) — DX
- [Developer Productivity Statistics 2026](https://www.index.dev/blog/developer-productivity-statistics-with-ai-tools) — Index.dev
- [AI Coding Assistant Statistics 2025](https://www.secondtalent.com/resources/ai-coding-assistant-statistics/) — Second Talent

### Competitive Landscape & Funding
- [CNBC: Cursor $29.3B Valuation](https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html) — CNBC, Nov 2025
- [TechCrunch: Anysphere $9.9B](https://techcrunch.com/2025/06/05/cursors-anysphere-nabs-9-9b-valuation-soars-past-500m-arr/) — TechCrunch, Jun 2025
- [CNBC: Cognition $10.2B](https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html) — CNBC, Sep 2025
- [Cognition Acquires Windsurf](https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/) — TechCrunch, Jul 2025
- [Cursor vs GitHub Copilot](https://www.builder.io/blog/cursor-vs-github-copilot) — Builder.io
- [State of AI: 100T Token Study](https://a16z.com/state-of-ai/) — a16z

---

## Open Questions

1. **Exact token breakdown by activity type** — The OpenReview paper on coding agent token consumption has detailed breakdowns, but the full paper wasn't accessible for extraction. The claim is that input tokens dominate cost and variance is 10x across runs.

2. **Lightfast-specific competitive positioning** — How exactly does Lightfast's context graph differ from Augment Code's dependency graph analysis? What makes it organizational vs. code-structural?

3. **Pricing strategy benchmarks** — What price point works for developer infrastructure tools? Cursor is $20/month individual, enterprise pricing varies. Sourcegraph Cody is $66.6K median enterprise. Where does Lightfast sit?

4. **Academic research on organizational knowledge graphs** — While industry sources are abundant, peer-reviewed research specifically on "context graphs" in software teams was harder to find. The closest analog is research on organizational memory and knowledge management failure factors.

5. **Specific compute cost savings** — Can we quantify exactly how much a pre-built context index saves vs. grep-based discovery? The Milvus/Zilliz data suggests 40%+ token reduction, but Lightfast-specific benchmarks would be more compelling.
