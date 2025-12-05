---
title: Profound AEO & Lightfast SEO Analysis Prompt
description: Prompt for Claude Code to analyze tryprofound.com/blog and propose SEO/AEO improvements for Lightfast based on the current monorepo.
status: draft
owner: marketing
audience: engineering
last_updated: 2025-12-05
tags: [seo, aeo, research, prompts]
---

You are Claude Code, running inside the **Lightfast** monorepo. Your job is to learn from **Profound’s blog** (tryprofound.com) and then do a deep, repo-aware investigation of Lightfast to propose **SEO + AEO (Answer Engine Optimization)** improvements for distribution and marketing.

Follow these instructions carefully.

---

## 0. Grounding: What Lightfast Is

1. From the repo root, read at least:
   - `SPEC.md`
   - `README.md` (root)
2. Build a short internal summary of:
   - What Lightfast is (one sentence + 3 bullets).
   - Who it is for.
   - The *core promise* in the language of `SPEC.md` (memory, explainability, citations, search by meaning).

Keep this summary visible and reuse its wording; do **not** accidentally reposition Lightfast as an AEO/GEO platform. Lightfast is **internal/team memory**, not an external visibility tool.

---

## 1. Analyze Profound’s Blog for AEO/SEO Patterns

Use web tools to fetch and analyze **tryprofound.com/blog** and key posts.

1. Fetch:
   - Blog index: `https://www.tryprofound.com/blog`
   - And, if available, deeper posts such as:
     - Prompt Volumes / AI search volume
     - Profound Index
     - AI Search Volatility
     - AI Platform Citation Patterns
     - AI Search Shift
     - Zero-click / future of AI answers
     - Agency Mode / Shopping Analysis / HIPAA posts (only if relevant to content patterns)
2. For each relevant post:
   - Capture **title**, **URL**, and a few-sentence **summary**.
   - Note how the page is structured for AEO:
     - How quickly it answers: “What is X?” and “Who is it for?”
     - Use of **question-style headings**.
     - Short, quotable explanations high on the page.
     - FAQs / Q&A blocks.
   - Note how Profound talks to **answer engines**, not just search:
     - Emphasis on questions, use cases, “zero click” framing, entity consistency.

3. Synthesize a **general AEO/SEO pattern** from Profound:
   - How they frame entities (product, features, concepts).
   - How they write headings and intros.
   - How they structure content so ChatGPT/Perplexity can lift clean snippets.
   - How they embed data/insights to make themselves a “desirable citation”.

Output a concise section called:

> **Profound AEO Patterns (Summary)**

---

## 2. Deep Investigation of Lightfast’s Current Marketing Surface

Work inside the repo to understand the current site and docs structure and how they affect SEO/AEO.

1. **Marketing site (`apps/www`)**
   - Read:
     - `apps/www/README.md`
     - Key entry points: `apps/www/src/app/page.tsx` and other main routes (e.g. `/`, `/product`, `/pricing`, `/blog` or similar).
     - Any layout/head config (e.g. `apps/www/src/app/layout.tsx`, SEO helpers, Head components).
   - Identify:
     - Current homepage headline, subhead, and 1–2 sentence “what is Lightfast” explanation.
     - Existing meta tags: title, description, Open Graph, canonical URLs.
     - Route structure (what main pages exist, especially for product/solution/overview).
     - Any FAQ-style or question-structured content already present.

2. **Docs site (`apps/docs`)**
   - Read:
     - `apps/docs/README.md`
     - `apps/docs/src/content/docs/index.mdx` (docs landing).
     - Overview & getting started sections (titles, headings, descriptions).
   - Identify:
     - How Lightfast is explained to developers.
     - What question-like headings already exist.
     - Any overlap/conflict with marketing positioning.

3. **Other relevant files**
   - Any `next.config.ts`, `vercel.json`, or sitemap/robots generation related to SEO.
   - Any `AGENTS.md` that might constrain how code or content should be updated (obey these if present).

Output a concise section called:

> **Current Lightfast SEO/AEO State (Summary)**

with bullets for:

- Page structure & main routes.
- How clearly “What is Lightfast?” is answered.
- Current meta and head usage.
- Existing question-based or FAQ-like content.

---

## 3. Gaps & Opportunities (Based on Profound Learnings)

Using the Profound patterns (step 1) and the current Lightfast state (step 2):

1. Identify **content gaps**:
   - Missing or weak answers to questions like:
     - “What is Lightfast?”
     - “Who is Lightfast for?”
     - “How does Lightfast work?”
     - “When should I use Lightfast vs my own RAG stack?”
     - “How can agents use Lightfast as shared memory?”
   - Pages that are too vague or jargon-heavy for AI to summarize cleanly.
   - Missing FAQ/Q&A blocks around key concepts.

2. Identify **structural/technical gaps** affecting SEO/AEO:
   - Inconsistent entity naming or taglines.
   - Lack of question-style headings.
   - Missing or weak meta titles/descriptions.
   - Missing internal links that clarify relationships (e.g., homepage → docs → API reference).

3. Map Profound’s patterns to Lightfast:
   - How Lightfast pages could emulate Profound’s clarity and structure **without** copying text or turning Lightfast into an AEO product.
   - Specific examples (e.g., “Profound’s Prompt Volumes post introduces X in 1 short paragraph, then adds 3 bullet use cases; Lightfast’s homepage should do the same for ‘team memory’”).

Output a section:

> **Gaps & Opportunities**

with 8–15 concise bullets split into:

- `Content/Positioning Gaps`
- `Structural/Technical Gaps`

---

## 4. Concrete SEO + AEO Plan for Lightfast

Now produce an actionable plan tied directly to **files and routes in this repo**.

### 4.1 Page-Level Strategy

For the most important pages (at minimum):

- `apps/www` homepage (`/`)
- Key product/overview pages (if present)
- Docs landing (`/docs`)

For each, provide:

- **Target questions to “own”** for answer engines (5–10 per page).
- **Proposed**:
  - Page title (SEO + AEO friendly).
  - Meta description.
  - 1–2 sentence canonical answer to “What is Lightfast?” or the page’s core question.

### 4.2 Content Structure Changes

For each key page, propose concrete structural changes inspired by Profound:

- New or updated **H2/H3 headings written as questions**, with 1–3 sentence direct answers.
- A compact **FAQ/Q&A block** (3–7 QA pairs) that can be lifted verbatim into AI answers.
- Recommended internal links (e.g., homepage → “Architecture & Security” doc).

Tie each recommendation to specific files, e.g.:

- “Update hero and intro in `apps/www/src/app/page.tsx` to X.”
- “Add FAQ section to docs landing `apps/docs/src/content/docs/index.mdx` with Y questions.”

### 4.3 Technical SEO/AEO Enhancements

List implementation-ready suggestions, such as:

- Where to define or improve `Head`/`metadata` in Next.js (with file paths).
- Whether to add/adjust:
  - Canonical URLs.
  - Open Graph / Twitter meta.
  - `sitemap.xml` / `robots.txt` if applicable.
- Any JSON-LD or structured data that could help answer engines (e.g., FAQ schema) — only if realistic for this stack.

Output a section:

> **Implementation Plan (Tied to Repo)**

with bullet points of the form:

- `apps/www/src/app/page.tsx`: [change]
- `apps/docs/src/content/docs/index.mdx`: [change]
- `...`

Be concrete enough that an engineer can implement without guessing.

---

## 5. Optional: Draft Copy (If There’s Room)

If space and time allow, include draft copy snippets for the most important changes:

- New hero or “What is Lightfast?” block.
- 5–7 FAQ questions and answers for the homepage.
- 3–5 FAQ questions and answers for the docs landing.

Keep copy aligned with `SPEC.md` language: “memory built for teams”, “search by meaning”, “answers with sources”, “trustworthy, explainable context”, “developer-first API & MCP tools”.

---

## Output Format

Return your findings in this structure:

1. `Profound AEO Patterns (Summary)`
2. `Current Lightfast SEO/AEO State (Summary)`
3. `Gaps & Opportunities`
   - `Content/Positioning Gaps`
   - `Structural/Technical Gaps`
4. `Implementation Plan (Tied to Repo)`
   - Per-file, per-route recommendations
5. `Optional: Draft Copy Snippets`

Do **not** execute any code changes yourself; focus on deep analysis and a precise, implementable plan.

You may now begin by reading `SPEC.md` and then analyzing Profound’s blog.

