---
title: Profound AEO & Lightfast SEO/AEO Analysis
description: Analysis of Profound’s AEO patterns and a repo‑tied SEO/AEO plan for Lightfast.
status: draft
owner: marketing
audience: engineering
last_updated: 2025-12-05
tags: [seo, aeo, research, lightfast]
---

# Overview

This document summarizes what we can learn from **Profound’s AEO patterns** and applies those learnings to **Lightfast’s current marketing and docs surface**. It is grounded in the current monorepo and proposes an implementation‑ready SEO + AEO plan tied directly to files and routes.

The goal is to make Lightfast easy for **answer engines** (ChatGPT, Claude, Perplexity, Google AI Overviews, etc.) to:

- Understand what Lightfast is and who it’s for.
- Lift clean, canonical snippets that answer common questions about Lightfast.
- Discover a coherent set of entities (product, features, concepts) across marketing, docs, and blog.

> **Important**: Lightfast is **internal/team memory**, not an AEO tooling platform. We optimize for answer engines to understand Lightfast, not to reposition Lightfast as an AEO product.

---

## 0. Lightfast Grounding

**Canonical positioning (from `SPEC.md` and docs):**

- **One sentence:**  
  Lightfast is memory built for teams, helping people and agents search everything their organization knows by meaning, get answers with sources, and trace decisions across code, docs, and tools.

- **Core bullets:**  
  - **Search by meaning, not keywords** via four simple API routes and MCP tools for agents.  
  - **Always cite sources** and show ownership, dependencies, and rationale so answers are trustworthy and explainable.  
  - **Index broad team knowledge**—documents, code, tickets, conversations—from tools like GitHub, Linear, Notion, Slack, and more, with tenant‑isolated, privacy‑first architecture.

**Who Lightfast is for:**

- Engineering and platform teams who want reliable, explainable team memory.
- Developers and agent builders who need a simple, developer‑first API and MCP tools for retrieval and answering with citations.
- Organizations that want to reduce context loss and speed up onboarding, incident response, and decision tracing.

**Core promise (in SPEC language):**

- **Memory built for teams**: durable, evidence‑backed context spanning code, docs, tickets, and conversations.
- **Search by meaning**: hybrid retrieval that understands intent, not just keywords.
- **Answers with sources**: every answer cites its sources; no black‑box summaries.
- **Explainable by design**: short‑hop graph of entities and relationships; can see who owns what, what depends on what, and why.

Keep this mental model consistent across all marketing, docs, and metadata. Avoid repositioning Lightfast as an AEO or GEO product.

---

## 1. Profound AEO Patterns (Summary)

This section distills how Profound structures its blog and product content for answer engines, based on posts like **Profound Index**, **Prompt Volumes**, **AI Search Volatility**, **AI Search Shift**, **AI Platform Citation Patterns**, and **Zero Click NYC**.

### 1.1 Entity‑First Framing

- Each asset is anchored on a **named entity**:
  - Product/feature entities: **Profound Index**, **Prompt Volumes**, **Agent Analytics**.
  - Concept/research entities: **AI Search Volatility**, **AI Search Shift**, **AI Platform Citation Patterns**, **Zero‑click**.
- Titles typically follow an **“Entity: Why/How/What”** format:
  - “AI Search Volatility: Why AI search results keep changing”
  - “AI Search Shift: ChatGPT’s growing alignment with Google’s index”
  - “AI Platform Citation Patterns: How ChatGPT, Google AI Overviews, and Perplexity Source Information”
- Intros **immediately define the entity**, who it’s for (brands/marketers), and why it matters in AI Search/AEO.

### 1.2 Answer‑Engine‑Oriented Page Structure

- Pages answer the core questions **very high on the page**:
  - “What is X?”
  - “Why does X matter now?”
  - “Who is X for?”
  - Often, “How does X work?” or “How did we measure X?”
- Common pattern:
  - 1–3 sentence abstract.
  - A short list of **Key findings** or **Key metrics**.
  - Methodology section (“How we measured it”).
  - “What this means for you” section.
- **Question‑style headings** are used throughout:
  - “What is AI Search Volatility?”
  - “How we measured volatility across platforms”
  - “What this means for your AI visibility strategy”
- This gives answer engines clear section boundaries and quotable blocks.

### 1.3 Data as a Citation Magnet

- Research posts publish specific, memorable stats:
  - Citation drift ranges (e.g., **40–60%** month‑to‑month, ~**70–90%** over half‑year windows).
  - ChatGPT vs Google AI Overviews vs Perplexity alignment percentages.
  - Domain share (Wikipedia/Reddit/etc.) in citation patterns.
- Data is structured in **lists or simple tables**, making it easy for LLMs to lift as evidence.
- Product value is tied directly to these metrics:
  - “You need continuous AI visibility tracking because volatility is 50%+.”
  - “Prompt Volumes shows which conversations matter based on how often they appear in real AI prompts.”

### 1.4 Answer Engines as the Explicit Audience

- Copy explicitly references:
  - “AI answers”, “Answer Engines”, “AI Search”, “AI Search Volatility/Shift”, “zero‑click”.
  - AI platforms by name: ChatGPT, Google AI Overviews, Perplexity, Gemini, Claude, Grok.
- They contrast **AEO vs SEO/GEO**:
  - SEO is about ranking in SERPs.
  - AEO is about being cited in AI answers, despite volatility and citation drift.
- Product features are always framed as tools to **influence or understand answer engines**, not just traditional search.

### 1.5 Structured Content for Clean Snippets

- Consistent layout that answer engines can easily chunk:
  - Short abstract.
  - Bullet “Key findings”.
  - Methodology.
  - “What this means for you” / recommendations.
- Many posts are essentially **long FAQ answers** about the AI search ecosystem:
  - “Why do AI search results keep changing?”
  - “How do AI platforms choose citations?”
  - “How aligned is ChatGPT with Google’s index?”
- Content is structured so that ChatGPT/Perplexity can lift:
  - A definition paragraph.
  - A list of key metrics.
  - A concluding “what to do about it” answer.

---

## 2. Current Lightfast SEO/AEO State (Summary)

This section describes the current marketing and docs surface in the monorepo and how it appears to answer engines.

### 2.1 Page Structure & Main Routes

**Marketing site (`apps/www`, domain `lightfast.ai`)**

- Built with Next.js App Router.
- Key routes (server components):
  - `/` (homepage / landing):  
    - File: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
  - `/pricing`:  
    - File: `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx`
  - `/blog` (listing) and `/blog/[slug]` (posts):  
    - Files:  
      - `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`  
      - `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
  - `/changelog` and `/changelog/[slug]` (CMS‑backed changelog).
  - `/early-access`, `/legal/[slug]`, `/search` (via microfrontends).
- Shared layout:
  - Global layout + metadata in `apps/www/src/app/layout.tsx`.
  - Marketing wrapper layout in `apps/www/src/app/(app)/(marketing)/layout.tsx`.
  - Navbar/footer components in `apps/www/src/components/app-navbar.tsx` and `app-footer.tsx`.

**Docs site (`apps/docs`, domain `docs.lightfast.ai`, served at `/docs`)**

- Built with Next.js + Fumadocs.
- Routes:
  - `/docs` redirects to `/docs/get-started/overview` via:
    - `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx`
  - `/docs/get-started/overview` (core conceptual overview).
  - Other pages under:
    - `apps/docs/src/content/docs/index.mdx`
    - `apps/docs/src/content/docs/get-started/*.mdx`
    - `apps/docs/src/content/docs/features/*.mdx`
- Shared layout and metadata:
  - `apps/docs/src/app/layout.tsx`
  - `apps/docs/src/lib/site-config.ts`

### 2.2 Clarity of “What is Lightfast?”

**Marketing homepage (`/`)**

- Hero (`apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`):
  - H1: **“Memory built for teams”** (good alignment with SPEC/docs).
  - Subtext: “Search everything your team knows. Get answers with sources.”
  - Strong but not explicitly labeled “What is Lightfast?”; it’s more a tagline than a definition block.
- There is **no explicit “What is Lightfast?” section at the very top**; answer engines must infer from hero copy and deeper sections.

**Homepage FAQ (`apps/www/src/components/faq-section.tsx`)**

- Contains a clear Q: **“What is Lightfast?”** with a well‑written answer:
  - Positions Lightfast as a knowledge search platform that indexes everything a team knows, emphasizes semantic search and citations.
- Other FAQs cover:
  - “How is this different from regular search?”
  - “What is Neural Memory?”
  - Integrations.
  - Agent usage.
  - Security, speed to value, trustworthiness.
- These are excellent AEO‑style Q&As but live relatively low on the page and lack JSON‑LD FAQ schema.

**Docs**

- `apps/docs/src/content/docs/index.mdx`:
  - Intro: “Lightfast is **memory built for teams**.”
  - Explicit section “What Lightfast Does” with bullet points.
- `apps/docs/src/content/docs/get-started/overview.mdx`:
  - YAML frontmatter description: “Memory built for teams…”
  - H1: “Memory built for teams”.
  - H2: “What is Lightfast?” with bullets directly aligned to SPEC.md.
- Together, docs provide a very clear and consistent definition, especially for developers.

**Repo metadata (conflicting signals)**

- `SPEC.md` and docs describe Lightfast as **team memory / neural memory**.
- Root `README.md` currently positions Lightfast as:
  - “A cloud‑native agent execution engine that abstracts infrastructure complexity…”
- `apps/www/README.md` describes Lightfast as:
  - “AI Workflow Assistant Platform for Creative Professionals.”
- `packages/site-config/src/configs/site.ts` uses a description focused on:
  - “Build production‑ready AI agents with cloud‑native execution engine…”

These conflicting descriptions can confuse answer engines about the **core entity**. Some surfaces say “team memory”, others say “agent execution engine” or “creative workflows”.

### 2.3 Current Meta and Head Usage

**Global marketing metadata (`apps/www/src/app/layout.tsx`)**

- Uses `createMetadata` with:
  - **Title**: “Lightfast – Neural Memory for Teams”.
  - **Description**: “Neural memory built for teams. Search by meaning with sources. Capture decisions, context, and ownership across code, docs, and tools. Developer‑first API and MCP tools.”
  - `metadataBase` set to `siteConfig.url` (`https://lightfast.ai`).
  - `openGraph` and `twitter` blocks:
    - Title and description aligned with team memory.
  - `robots` configured for full indexing.
  - `verification.google` placeholder.
  - Rich icons/manifest and `alternates.canonical` pointing to `https://lightfast.ai`.
- JSON‑LD via `<JsonLd>`:
  - `Organization` and `WebSite` schema.
  - `SearchAction` pointing to `/search?q={search_term_string}`.

**Blog listing (`/blog`)**

- `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`:
  - **Metadata title**: “Blog - Lightfast | AI-Powered Team Memory & Knowledge Management”.
  - **Meta description** emphasizes:
    - AI‑powered team memory.
    - Semantic search.
    - Organizational knowledge management.
  - Includes keywords array with relevant terms, including “answer engine optimization”.
  - `openGraph`, `twitter`, `alternates.canonical` set to `https://lightfast.ai/blog`.
- JSON‑LD via `JsonLd`:
  - `Organization`, `WebSite`, and `Blog` entities.
  - `Blog.blogPost` with up to 10 `BlogPosting` references.

**Blog posts (`/blog/[slug]`)**

- `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`:
  - `generateMetadata` builds per‑post:
    - Title, description (fallback to body snippet).
    - Canonical URL.
    - Open Graph `article` object with published time and authors.
    - Twitter card.
  - JSON‑LD `BlogPosting` constructed per post.
  - In‑page `Breadcrumbs` component (not yet encoded as `BreadcrumbList` schema).

**Pricing (`/pricing`)**

- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx`:
  - Metadata via `createMetadata`:
    - Title: “Pricing - Simple Plans That Scale”.
    - Description: “Start free with up to 3 users. Scale with transparent per-user pricing…”
  - `openGraph` and `twitter` set for the pricing page.
  - `alternates.canonical` set to `https://lightfast.ai/pricing`.
  - JSON‑LD `SoftwareApplication` with multiple `Offer` entries representing plans.

**Docs metadata (`apps/docs`)**

- `apps/docs/src/app/layout.tsx` + `apps/docs/src/lib/site-config.ts`:
  - Title: “Lightfast – Neural Memory for Teams”.
  - Description: “Documentation for Lightfast Neural Memory — Learn how to integrate team memory via simple REST API and MCP tools. Build search by meaning with sources.”
  - `metadataBase` set to `https://docs.lightfast.ai`.
  - `openGraph` and `twitter` consistent with docs domain.
  - Icons configured for docs site.

**Global site config (`packages/site-config/src/configs/site.ts`)**

- `siteConfig`:
  - `name`: “Lightfast”.
  - `url`: `https://lightfast.ai`.
  - `ogImage`: `https://lightfast.ai/og.jpg`.
  - **Description** (currently):  
    “Build production-ready AI agents with cloud-native execution engine. State-machine orchestration, resource scheduling, and infinitely scalable agent deployment.”
- This description is out of sync with the **team memory** positioning and will leak into:
  - Site manifests.
  - Components relying on `siteConfig.description`.

### 2.4 Existing Question‑Based / FAQ‑Like Content

**Homepage FAQs**

- `apps/www/src/components/faq-section.tsx` defines a `faqs` array:
  - “What is Lightfast?”
  - “How is this different from regular search?”
  - “What is Neural Memory?”
  - “What tools and platforms do you integrate with?”
  - “How do agents and AI assistants use Lightfast?”
  - “Is our data secure and private?”
  - “How quickly can we get started?”
  - “What makes answers trustworthy?”
  - “How does pricing work?”
- Answers are strong, descriptive paragraphs that map well to AEO needs.
- Currently there is **no JSON‑LD FAQ schema** attached to these.

**Pricing FAQs**

- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx` contains another FAQ block focused on:
  - Value framing (“What makes Lightfast worth $12/user?”).
  - Search allowance and sources.
  - Neural Memory, plans, overages, plan selection.
- Also no JSON‑LD FAQ schema; answers are present only in HTML.

**Docs**

- `apps/docs/src/content/docs/get-started/overview.mdx`:
  - Explicit H2: “What is Lightfast?”
  - Additional H2/H3 sections (“How It Works”, “The Four API Routes”, “Key Features”, “Use Cases”) with code examples.
- `apps/docs/src/content/docs/index.mdx`:
  - “What Lightfast Does” with bullet points and multiple internal links.
- These headings are already very AEO‑friendly but could add more explicit question wording.

---

## 3. Gaps & Opportunities

Using Profound’s patterns and the current state above, we can see the following gaps.

### 3.1 Content / Positioning Gaps

- **Inconsistent product story across surfaces**
  - `SPEC.md`, docs, homepage hero, and FAQs: Lightfast is **team memory / neural memory**.
  - Root `README.md`: Lightfast is a **cloud‑native agent execution engine**.
  - `apps/www/README.md`: Lightfast as **AI workflow assistant for creative professionals**.
  - `packages/site-config/src/configs/site.ts`: description focused on **agent execution platform**.
  - This inconsistency makes it harder for answer engines to learn a stable entity definition.

- **Missing canonical “What is Lightfast?” block on homepage**
  - Hero tagline is strong but there is no dedicated, early section explicitly labeled “What is Lightfast?” with:
    - 1–2 sentence answer.
    - 3 bullet use cases.
  - Profound‑style pages always define the main entity near the top.

- **Weak framing of “Who is Lightfast for?” and “When should I use it?”**
  - FAQ content hints at the audience but there’s no compact early section answering:
    - “Who is Lightfast for?”
    - “When should I use Lightfast instead of my own RAG stack?”
  - These are key discoverable questions for answer engines.

- **Agents use‑case not front‑and‑center**
  - Docs mention MCP tools and agents.
  - Homepage hints at agents in metadata but doesn’t clearly answer:
    - “How can agents use Lightfast as shared memory?”
  - Profound is explicit about its audience (“brands”, “marketers”, “AEO teams”); Lightfast should be similarly explicit about “engineering teams” and “agent builders”.

- **Limited “research‑style” content that can act as anchor entities**
  - Current blog structure is good, but there are no flagship posts equivalent to:
    - “AI Search Volatility…”
    - “AI Platform Citation Patterns…”
  - Lightfast could publish research around:
    - Memory quality.
    - Citation faithfulness.
    - Hybrid retrieval performance.
    - “Team memory vs RAG” tradeoffs.

- **Docs overview strong but not fully question‑structured**
  - `get-started/overview.mdx` is very good for devs, but:
    - Could be even more explicit with headings like:
      - “What does Lightfast remember?”
      - “What doesn’t Lightfast do?”
      - “How do agents query Lightfast?”

### 3.2 Structural / Technical Gaps

- **Entity metadata drift**
  - `packages/site-config/src/configs/site.ts` and `apps/www/README.md` still describe Lightfast as an agent execution engine / creative workflows platform.
  - This conflicts with the team memory story in `SPEC.md` and docs and will be picked up by answer engines.

- **No FAQ JSON‑LD for key Q&A content**
  - Homepage and pricing FAQs are great, but not surfaced as `FAQPage` structured data.
  - Profound uses question‑style headings and likely benefits from FAQ‑like structures; Lightfast can do the same.

- **Homepage lacks question‑style headings**
  - Components like `SearchDemo`, `IntegrationShowcase`, and `PlatformAccessCards` are descriptive but not organized under headings like:
    - “How does Lightfast work?”
    - “What tools does Lightfast integrate with?”
    - “How do I get access to Lightfast?”
  - Adding question headings improves snippet extraction.

- **Sitemap/robots not explicitly defined in source for `apps/www`**
  - `.next` artifacts indicate there is a sitemap/robots, but there’s no `apps/www/src/app/sitemap.ts` or `robots.ts` in source.
  - Having explicit source definitions makes it easier to:
    - Prioritize `/`, `/pricing`, `/blog`, `/blog/*`, and `/docs/*` (via microfrontends).
    - Evolve crawl strategy over time.

- **Blog article structure not enforced for AEO patterns**
  - Templates are SEO‑ready, but there’s no systematic requirement that each article includes:
    - An early “What is X?” definition.
    - “Who is X for?”
    - “Why X matters now.”
  - Implementing CMS guidelines or components to enforce this would mirror Profound’s approach.

- **GitHub‑facing story diverges from marketing/docs**
  - Root `README.md` sells “agent execution platform” first, with no mention of “memory built for teams” until later (if at all).
  - Many answer engines crawl GitHub heavily; this increases risk that Lightfast is interpreted as an agent platform, not a team memory system.

---

## 4. Implementation Plan (Tied to Repo)

Below is an actionable plan mapped directly to files and routes. It assumes no backend changes—only content, metadata, and structured data updates.

### 4.1 Homepage `/` – Canonical Entity & FAQs

**Target questions for answer engines:**

- What is Lightfast?  
- Who is Lightfast for?  
- How does Lightfast work for teams?  
- How is Lightfast different from regular search or a custom RAG stack?  
- How can agents use Lightfast as shared memory?  
- What tools and platforms does Lightfast integrate with?  
- Is Lightfast secure and private?  
- How quickly can we get value from Lightfast?

**Planned changes:**

- `apps/www/src/app/layout.tsx`
  - Keep title “Lightfast – Neural Memory for Teams”.
  - Align description with SPEC/docs; suggested:
    > “Lightfast is neural memory built for teams. Search everything your organization knows by meaning, get answers with sources, and trace decisions across code, docs, and tools via a developer‑first API and MCP tools.”
  - Ensure `openGraph.description` and `twitter.description` use the same wording for entity consistency.

- `packages/site-config/src/configs/site.ts`
  - Replace agent‑execution description with team‑memory description:
    > “Lightfast is neural memory for teams — search everything your organization knows by meaning, get answers with sources, and trace decisions across code, docs, and tools via a simple API and MCP tools.”
  - This ensures all `siteConfig` consumers (manifest, footer, etc.) reflect the same narrative.

- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
  - Add an explicit “What is Lightfast?” section near the top (right below hero):
    - H2: `What is Lightfast?`
    - 1–2 sentence canonical answer (see draft copy below).
    - 3 bullet use cases or benefits.
  - Add two more question‑style sections, e.g.:
    - `Who is Lightfast for?`  
      - Bullets for engineering teams, platform teams, agent builders.
    - `How can agents use Lightfast as shared memory?`  
      - Short explanation referencing `/v1/search`, `/v1/answer`, and MCP tools.
  - Ensure at least one clear link to docs:
    - “Learn how Lightfast works” → `/docs/get-started/overview`.

- `apps/www/src/components/faq-section.tsx`
  - Keep existing `faqs` array; optionally:
    - Tighten the first sentence of each answer so it’s a clean snippet.
    - Ensure the first FAQ (“What is Lightfast?”) uses exactly the canonical definition in its opening line.

- **Homepage FAQ JSON‑LD (new)**
  - Add a new component, e.g. `apps/www/src/components/home-faq-jsonld.tsx`:
    - Imports the `faqs` array from `faq-section.tsx`.
    - Maps questions/answers into `FAQPage` schema and renders `<JsonLd code={faqSchema} />`.
  - Include this component at the end of `HomePage` in `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`.

### 4.2 Pricing `/pricing` – Pricing & Value Q&A

**Target questions:**

- How much does Lightfast cost?  
- Does Lightfast have a free plan?  
- What’s included in each plan?  
- How do searches, sources, and retention work?  
- Is Neural Memory included in all plans?

**Planned changes:**

- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx`
  - Slightly adjust metadata:
    - Title: “Lightfast Pricing – Team Memory That Scales”.
    - Description:
      > “Start with a free team memory plan for up to 3 users. Scale Lightfast neural memory across your organization with simple per‑user pricing and generous search allowances.”
  - In the hero section, mention “team memory” explicitly (e.g. “Simple pricing for neural memory built for teams.”).
  - Ensure the first FAQ answer is a concise, data‑rich sentence followed by elaboration.

- **Pricing FAQ JSON‑LD (new)**
  - Similar to homepage:
    - Export `faqs` from this file or a shared module.
    - Create a small wrapper component that renders `<JsonLd>` for a `FAQPage` with these Q&As.
  - Include it within `PricingPage` so answer engines can directly answer pricing questions.

### 4.3 Docs `/docs` & `/docs/get-started/overview` – Developer Canonical Answers

**Target questions:**

- How do I integrate Lightfast into my stack?  
- What does Lightfast remember from my tools?  
- How does search by meaning work?  
- What are the four Lightfast API routes?  
- How does Lightfast handle privacy and permissions?  
- How do agents query Lightfast (REST + MCP)?

**Planned changes:**

- `apps/docs/src/app/layout.tsx` and `apps/docs/src/lib/site-config.ts`
  - Confirm metadata remains aligned with team‑memory positioning and use the same canonical description language as marketing.
  - Ensure `docsMetadata.keywords` emphasize:
    - “team memory”, “semantic search”, “answers with sources”, “developer API”, “MCP tools”.

- `apps/docs/src/content/docs/index.mdx`
  - Add a short, explicit Q&A section near the top:
    - H2: `What is Lightfast for developers?`
    - 2–3 sentences explaining Lightfast as a developer‑first API for team memory and agent retrieval.
  - Ensure Quick Links prominently surface:
    - `/docs/get-started/overview`
    - `/docs/get-started/quickstart`
    - `/docs/api-reference/overview`

- `apps/docs/src/content/docs/get-started/overview.mdx`
  - Keep existing sections but:
    - Make the first sentence under “What is Lightfast?” match the canonical definition exactly.
  - Add explicit question headings, for example:
    - `What does Lightfast remember?`
      - Bullets for GitHub, Linear, Notion, Slack, Discord, custom sources.
    - `How do agents query Lightfast?`
      - Short explanation referencing REST and MCP tools.
    - `What doesn’t Lightfast do?`
      - Clarify that it’s not a BI tool or deep graph analytics engine.

### 4.4 Blog `/blog` & `/blog/[slug]` – Concept & Research Entities

**Blog index target questions:**

- What is the Lightfast blog about?  
- Who is the Lightfast blog for?  
- Where can I find updates and research about Lightfast team memory?

**Planned changes:**

- `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`
  - Keep existing metadata, but refine description to lead with:
    > “The Lightfast blog covers team memory, semantic search, and answer‑with‑sources systems for engineering and platform teams.”
  - Add a short intro section above the posts list:
    - H1: “Lightfast Blog – Team Memory & Semantic Search”.
    - 2–3 sentences summarizing topics (team memory, retrieval, quality, architecture, agents).

- `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`
  - Add structured `BreadcrumbList` JSON‑LD derived from the existing `Breadcrumbs` items (Home → Blog → [Category] → [Post]).
  - Optionally define a CMS guideline that each post must:
    - Start with a short **“What is X?”** paragraph.
    - Include at least one question heading like:
      - “What is team memory?”
      - “How does semantic search reduce incident response time?”

**Flagship research content (future CMS work):**

- Plan 1–2 anchor posts:
  - “Team Memory vs RAG: When to use a memory system instead of a bespoke RAG stack.”
  - “Measuring Memory Quality: How we evaluate search by meaning and citation faithfulness in Lightfast.”
- Structure them like Profound’s research:
  - Definition → Key metrics → Methodology → “What this means for teams.”

### 4.5 Global Consistency & Technical SEO

- `README.md`
  - Update the top‑level description to match team‑memory positioning:
    - Replace “cloud‑native agent execution engine…” with a one‑sentence team‑memory definition.
  - Optionally add a short paragraph clarifying that the agent execution capabilities exist to let agents **use Lightfast memory**, not as a standalone product identity.

- `apps/www/README.md`
  - Update from “AI Workflow Assistant Platform for Creative Professionals” to:
    - “Marketing site for Lightfast, neural memory built for teams.”

- `apps/www/src/app/sitemap.ts` (new)
  - Implement a typed Next.js sitemap that:
    - Lists `/`, `/pricing`, `/blog`, `/blog/[slug]`, `/changelog`, and other key marketing pages.
    - Optionally includes pointer routes for `/docs/*` if needed via microfrontends.

- `apps/www/src/app/robots.ts` (new)
  - Explicitly configure robots to:
    - Allow crawling of core marketing/blog pages.
    - Disallow any internal/console/auth routes as needed.

- Internal linking
  - Ensure:
    - Homepage “What is Lightfast?” section links to `/docs/get-started/overview`.
    - Pricing page links to docs explaining usage, search allowances, and retention.
    - Docs overview links back to marketing pages where relevant (e.g., pricing).

---

## 5. Optional: Draft Copy Snippets

These snippets are aligned with `SPEC.md` language and can be used or adapted in the homepage, docs, or blog.

### 5.1 Canonical “What is Lightfast?” Definition

> **What is Lightfast?**  
> Lightfast is a memory system built for teams. It indexes your code, docs, tickets, and conversations so people and AI agents can search by meaning, get answers with sources, and trace decisions across your organization.

Use this exact wording wherever possible to keep the entity consistent (hero subtext, FAQs, docs overview).

### 5.2 Homepage FAQ Additions (Examples)

**Q: When should I use Lightfast instead of building my own RAG stack?**  
Lightfast is the right choice when you want a production‑ready memory layer that already handles indexing, retrieval, and citations across your tools. You still control prompts and agents, but Lightfast manages search by meaning, source tracking, and evolution over time so you don’t have to maintain a bespoke RAG stack.

**Q: How can agents use Lightfast as shared memory?**  
Agents call Lightfast’s four routes—`/v1/search`, `/v1/contents`, `/v1/similar`, and `/v1/answer`—or use our MCP tools to ask questions, fetch context, and get answers with sources. Instead of stuffing entire codebases into context, agents search for what they need and get verified snippets tied to real documents and decisions.

**Q: What does Lightfast remember and what doesn’t it do?**  
Lightfast remembers documents, code changes, tickets, discussions, and decisions from tools like GitHub, Linear, Notion, Slack, and Discord. It’s built for memory and context, not BI dashboards or deep graph analytics. Lightfast focuses on short‑hop relationships that are explainable and easy to trust, so you always know why a result appears.

### 5.3 Docs Overview Enhancements

On `/docs/get-started/overview` you can embed these Q&A‑style sections:

- **What does Lightfast remember?**  
  Lightfast automatically indexes your team’s knowledge from tools like GitHub, Linear, Notion, Slack, and Discord. It tracks documents, code changes, issues, discussions, and decision points so you can see not just what changed, but who changed it and why.

- **How do agents query Lightfast?**  
  Agents use the same four routes as humans: `search` to find relevant items by meaning, `contents` to fetch full documents and relationships, `similar` to explore related context, and `answer` to get synthesized answers with citations. MCP tools make this available directly inside modern agent runtimes.

- **How does Lightfast keep data private?**  
  Each workspace is fully isolated with separate database schemas, vector namespaces, and storage buckets. Lightfast never trains models on your data and enforces source permissions in every query, so people and agents only see what they’re allowed to see.

---

## 6. Next Steps

1. Align core descriptions in `README.md`, `packages/site-config`, and `apps/www/README.md` with the team‑memory narrative.  
2. Implement homepage and docs structural changes (question‑style headings, canonical “What is Lightfast?” block).  
3. Add FAQ JSON‑LD for homepage and pricing pages.  
4. Introduce explicit sitemap/robots for `apps/www`.  
5. Plan and publish 1–2 flagship research posts that mirror Profound’s AEO‑optimized patterns, but focused on **team memory**, **search by meaning**, and **answers with sources**.

