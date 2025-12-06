---
title: Lightfast Brand Kit
description: Shared brand, ICP, and writing guidelines for content and agents that write about Lightfast.
status: draft
owner: marketing
audience: marketing, product, engineering
last_updated: 2025-12-05
tags: [brandkit, lightfast, seo, aeo, content]
---

# Lightfast Brand Kit

This brand kit is used by internal teams and agents to generate and evaluate content about **Lightfast**.  
It must stay in sync with our internal positioning and the blog writer agent (`.claude/agents/blog-writer.md`).

---

## 1. About the Brand

**Short definition**

> **Lightfast is a memory system built for teams.** It indexes your code, docs, tickets, and conversations so people and AI agents can search by meaning, get answers with sources, and trace decisions across your organization.

**What Lightfast actually does**

- Connects to tools like GitHub, Linear/Jira, Slack/Discord, Notion, and more.
- Turns PRs, issues, discussions, incidents, and docs into **team memory**—not just a pile of documents.
- Provides **four simple API routes** and **MCP tools** so developers and agents can:
  - Search by meaning (not just keywords).
  - Fetch contents and relationships.
  - Find similar context.
  - Get answers with citations to the original sources.
- Surfaces **ownership and decisions**:
  - Who worked on what.
  - What depends on what.
  - Why certain decisions were made.

**What Lightfast is _not_**

- Not primarily an “agent execution engine” (execution exists to make memory useful to agents, not as a standalone story).
- Not a generic data warehouse or BI tool.

---

## 2. Ideal Customer Profile (Current Focus)

We are early; this ICP is intentionally narrow and focused on where we can win **right now**.

**Company profile**

- Early‑stage startups, typically **1–10 people** (up to ~15).
- 1–5 engineers; shipping quickly, minimal process, lots of implicit context.
- Heavy usage of:
  - GitHub (or similar) for code, PRs, and issues.
  - Linear/Jira for tickets.
  - Slack/Discord for day‑to‑day decisions.

**Core buyers / champions**

- **Technical founders** (solo or co‑founders who still write code).
- **Founding engineers** (first 1–3 engineers).
- YC / accelerator founders who are already AI‑curious and comfortable with APIs.

**Primary users**

- Founders who currently hold most of the context in their heads (“founder brain”).
- First engineers who need to understand past decisions and ownership quickly.
- Anyone doing support/on‑call and building at the same time.

**Key problems they feel**

- Context lives in a few brains + scattered PRs, tickets, and Slack threads.
- No one has time to write or maintain formal docs.
- New hires/contractors spend days asking repeat questions:
  - “How does auth work?”
  - “Who owns billing?”
  - “Why did we choose this database?”
- Early AI experiments (bots, agents, copilots) are brittle because they rely on ad‑hoc retrieval or manual copy‑paste.

**What Lightfast unlocks for them**

- Turns the messy early history—PRs, issues, incidents, Slack threads—into **searchable team memory** with sources.
- Lets founders and first engineers answer “what/why/who” in seconds instead of re‑explaining from scratch.
- Gives early agents and internal tools a **single memory substrate** instead of one‑off vector DBs and RAG hacks.

---

## 3. Competitors

We think in **buckets**, not just single logos.

### 3.1 Team Note / Knowledge Tools with AI

- Examples: **mem.ai**, Notion AI, Slite, Almanac, Guru.
- Positioning: personal + team notes, docs, and “second brain” with AI layered on top.
- Where Lightfast differs:
  - Focused on **real engineering work** (PRs, incidents, tickets, discussions) rather than just notes and pages.
  - Opinionated about **citations, ownership, and decisions** as first‑class concepts.
  - Developer‑first APIs and MCP tools, not just in‑app assistants.

### 3.2 Agent Memory APIs / Universal Memory Layers

- Examples: **mem0**, **supermemory**.
- Positioning: “Memory API for the AI era”, “universal memory layer for AI agents”.
- Where Lightfast differs:
  - Built as **team memory** first, agent memory second.
  - Focuses on **engineering teams**, not generic personalization.
  - Ships **batteries‑included integrations** for GitHub/Linear/Slack/etc. and surfaces ownership/decisions out of the box.

### 3.3 Internal Search / Enterprise Knowledge (Adjacent)

- Examples: Elastic/enterprise search, Confluence/SharePoint search.
- Positioning: keyword or document search across enterprise content.
- Where Lightfast differs:
  - **Semantic search with citations** over code, tickets, and incidents.
  - Understands ownership and relationships, not just documents.
  - Designed for **explainable AI answers**, not just result lists.

### 3.4 Data / Labeling Platforms (Loosely Adjacent)

- Example: **V7** (training data labeling, RLHF/RLAIF workflows).
- Positioning: workflows for data labeling and training data quality.
- Where Lightfast differs:
  - V7 is about **training data** for models; Lightfast is about **operational memory and retrieval** for teams + agents.

**Short competitive POV**

> If mem.ai is a second brain for notes, and supermemory is a memory API for agents, Lightfast is **team memory rooted in real engineering work**—PRs, incidents, tickets, and docs—with APIs and MCP tools that make that memory usable by both humans and agents.

---

## 4. Brand Point of View

**Core beliefs**

1. **Teams don’t need more docs; they need memory of what actually happened.**  
   The real record lives in PRs, incidents, tickets, and chats. The job is to make that history searchable and explainable, not guilt everyone into writing more long‑form docs.

2. **Search by meaning plus citations beats dashboards and keyword search.**  
   Engineers want “why did we do this?” and “who owns this?”, not just string matches. Every answer should show its sources so people can verify and dig deeper.

3. **Shared memory is core infrastructure, not a sidecar bot.**  
   Humans and agents should share the same memory layer. Bots glued onto random data sources, without first‑class memory, will stay fragile and hard to trust.

4. **Explainability is a feature, not a nice‑to‑have.**  
   If you can’t see where an answer came from and why it ranked, it’s just another hallucination. Memory systems must expose ownership, dependencies, and rationale.

5. **Developer experience matters.**  
   A memory platform only works if it’s trivial to integrate. Four simple routes and MCP tools beat bespoke query languages and DIY retrieval infrastructure.

---

## 5. Author Persona

The “voice” of Lightfast content should feel like:

> A senior engineer or platform lead at a small startup who has lived through broken on‑call rotations, undocumented services, and “founder‑brain” bottlenecks. They’re technical, pragmatic, and allergic to hype. They enjoy explaining complex systems clearly, showing trade‑offs, and only pitching Lightfast once the problem and context are well understood.

Attributes:

- Feels like a **staff‑level engineer, founding engineer, or technical founder**, not a generic marketer.
- Comfortable talking about:
  - Architecture and retrieval.
  - Incidents, migrations, and messy real‑world history.
  - Agents, MCP tools, and APIs.
- Honest about:
  - What’s shipping vs experimental vs planned.
  - Trade‑offs between DIY RAG, wikis, and team memory.

---

## 6. Tone of Voice

**Overall tone**

- **Technical and clear**  
  Assume a smart technical audience (founders, founding engineers). No need to “explain what an API is”, but don’t drown them in jargon.

- **Direct and concise**  
  Short, precise sentences. Avoid fluffy intros or vague claims.

- **Evidence‑driven**  
  Prefer concrete examples (PRs, incidents, specific queries) and simple diagrams in text over abstract benefits.

- **Honest, non‑hypey**  
  Avoid “revolutionize”, “unprecedented”, and vague superlatives. Talk about real capabilities and constraints.

- **Helpful and respectful**  
  Respect existing tools (wikis, RAG stacks, search). Show where Lightfast fits and when it might not be the right choice yet.

- **No emojis**  
  Professional, calm tone.

---

## 7. Writing Rules

These rules should be followed by all content and documentation about Lightfast, including our blog writer agent and other AI-assisted workflows.

### 7.1 Positioning Guardrails

- Always keep Lightfast’s category clear:
  - “Lightfast is a memory system built for teams…” (or a very close paraphrase).
- Do **not** reposition Lightfast as:
  - A generic analytics/rankings platform.
  - A generic agent execution platform unrelated to memory.
- When mentioning AEO, answer engines, or AI search:
  - Frame Lightfast as the **team memory substrate** that makes AI answers explainable and trustworthy via citations, not as the analytics layer tracking citations or rankings.

### 7.2 Structure & Headings

- Lead with the **problem**, then define the entity:
  - First 2–3 paragraphs: describe the pain (onboarding, incidents, decision tracing, founder‑brain).
  - Then a clear “What is X?” section:
    - Examples: “What is team memory?”, “What is hybrid retrieval?”, “What is a memory layer for agents?”.
- Use **question‑style headings** where natural:
  - “What is team memory?”
  - “How do agents use Lightfast as shared memory?”
  - “When should you use Lightfast instead of your own RAG stack?”
  - “What does this mean for your team?”
- Include “Who is this for?” when it helps disambiguate:
  - Especially for content that could apply to technical founders vs platform engineers vs SREs.

### 7.3 Claims & Evidence

- Fact‑check against:
  - `SPEC.md`
  - `docs` (especially `/docs/get-started/overview`)
  - Implementation / architecture docs provided in prompts.
- If something is:
  - **Implemented** → Describe it concretely.
  - **In beta/experimental** → Label it as such.
  - **Planned/idea** → Either mark clearly (“planned”) or omit.
- Prefer:
  - “Currently supports X, Y; Z is planned” over fuzzy “supports everything”.

### 7.4 Style Details

- Avoid generic “Conclusion” headings:
  - Use outcome‑oriented endings like “Putting team memory into practice”, “Start wiring your agents into team memory”.
- Use:
  - H2/H3 sections.
  - Bullet lists for key takeaways and comparisons.
  - Short paragraphs (2–4 sentences).
- When discussing answers:
  - Emphasize citations, ownership, and traceability.
  - Avoid implying opaque, black‑box summarization.

### 7.5 SEO & Answer Engine Alignment (for blog and docs‑adjacent content)

When the content is intended for the public web (blog, docs landing pages) and may be consumed by answer engines:

- Use key phrases naturally:
  - “team memory”, “neural memory for teams”, “search by meaning”, “answers with sources”, “explainable AI answers”.
- For answer‑engine / AI‑search‑adjacent topics:
  - Include at least one phrase like “team memory for AI agents”, “semantic search with sources”, or “Lightfast neural memory”.
- Make pages snippet‑friendly:
  - Early definition paragraphs.
  - Clear “What is X?” and “Who is X for?” sections.
  - Compact “Key takeaways” sections when writing research/analysis.

### 7.6 CTAs

- Match CTA to intent:
  - **Awareness** → “Read the docs”, “Explore examples of team memory in action”.
  - **Consideration** → “Try wiring your repo into Lightfast”, “Connect your first source”.
  - **Conversion** → “Start a trial”, “Book a demo”, “Join early access”.
  - **Retention** → “Enable this feature”, “Index another source”, “Invite your team”.
- CTAs should be **specific and concrete**, not generic “Learn more”.

---

This brandkit should be treated as the single source of truth for:

- The `.claude/agents/blog-writer.md` agent’s positioning and tone.
- Other agents that describe or position Lightfast.

If you change this doc, update any dependent agents and templates together.
