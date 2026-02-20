---
date: 2026-02-19
researcher: architect-agent
topic: "Lightfast pitch deck — architecture design"
tags: [research, architecture, pitch-deck, lightfast, vc]
status: complete
based_on:
  - 2026-02-19-pitch-deck-codebase-deep-dive.md
  - 2026-02-19-pitch-deck-external-research.md
---

# Pitch Deck Architecture Design: Lightfast

## Research Question

Design an 11-slide early-stage pitch deck for Lightfast (the memory layer for engineering teams) that follows proven VC frameworks, tells a compelling story, and positions Lightfast as the context infrastructure layer for the $24B+ AI coding tools market. The deck targets top-tier VCs (Sequoia, a16z, YC) for a $300K pre-seed raise.

## Executive Summary

Lightfast is the missing context layer for software teams and AI agents. While every AI coding tool (Cursor, Copilot, Devin, Claude Code) understands **what** code does, none understand **why** it was built that way — the decisions, discussions, and institutional knowledge that live across 8+ disconnected tools. Lightfast ingests engineering events from GitHub, Vercel, Linear, and Sentry, transforms them through a neural observation pipeline (classification, multi-view embedding, entity extraction, relationship detection), and makes everything searchable via two-key retrieval (vector + LLM reranking) that achieves 90%+ precision where vector-only gets 60-70%. This is infrastructure, not application — the context layer that makes every AI coding tool more effective.

## Lightfast's Core Value Proposition

**Synthesized from codebase deep dive + external research:**

The AI coding revolution has a blind spot. Cursor reached $29.3B valuation and $1B+ ARR — the fastest-growing SaaS company of all time. 97% of enterprise developers use AI coding tools daily. 41% of code is now written by AI. But these tools share a fundamental limitation: they operate on code in isolation, disconnected from the organizational context that explains *why* code exists.

Developers spend 57.6% of their time on program comprehension and only 5% editing code. AI agents without semantic search burn 40%+ excess tokens on brute-force grep navigation. Knowledge walks out the door when engineers leave. The problem isn't code generation — it's that AI agents are operating blind.

Lightfast solves this by creating a **neural memory layer** — an always-on, auto-enriching knowledge graph built from real engineering events. It doesn't just index documents; it extracts entities, detects cross-source relationships (8 types, automatic), resolves actor identities across platforms, and serves results through a two-key retrieval system that engineers and AI agents can actually trust.

**The positioning:** Lightfast is to AI coding agents what Google was to the web. Without search, the web was just files. Without a context layer, AI agents are just autocomplete.

---

## The 11-Slide Structure

### Slide 1: Title
**Purpose**: Brand moment. Set the visual tone. Create anticipation.

**Headline**: LIGHTFAST

**Supporting Content**:
- Pitch Deck 2026
- Logo + wordmark centered on branded red grid

**Data Point**: None (this is pure brand)

**Visual Direction**: Keep the existing CustomTitleSlide design — the red grid with hoverable squares is distinctive and memorable. The 16x9 grid overlay is clean and signals technical precision. The design is Flabbergast-inspired, differentiated from generic pitch deck aesthetics.

**The One Thing**: This brand is built with care and technical taste.

**Component Type**: `title` (CustomTitleSlide) — no changes needed

---

### Slide 2: The Problem
**Purpose**: Make the investor feel the pain. Establish that this is a massive, urgent, quantifiable problem — not a nice-to-have.

**Headline**: Engineers are drowning in context.

**Supporting Content** (leftText label: `THE $40K PROBLEM`):
- Developers spend 58% of their time understanding code — only 5% actually writing it. AI doesn't help because it can't access the "why."
- Knowledge lives across 8+ tools — GitHub, Slack, Linear, Notion, Sentry — each with search that doesn't understand meaning.
- When engineers leave, their understanding of "why things were built this way" walks out with them. At 250 people, the expert-to-team ratio drops to 1:49.
- AI coding agents hallucinate because they operate on code in isolation, disconnected from your team's history and decisions.

**Data Point**: "Developers spend 57.6% of time on comprehension, only 5% editing code." — IEEE TSE large-scale field study. "$40K+/engineer/year lost to context searching."

**Visual Direction**: `content` type (ContentSlideContent). Keep the clean two-column layout. The leftText label "THE $40K PROBLEM" creates immediate financial urgency. Consider using a slightly bolder weight or red accent on the $40K figure to make it pop.

**The One Thing**: The problem is quantifiably massive — every engineering team feels it, and existing tools don't solve it.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 3: Why Now
**Purpose**: Prove this isn't a "could have been done 10 years ago" idea. Show that a specific convergence of trends makes RIGHT NOW the only time this can work. (a16z: "Your pitch has to be timely — an idea that could have been done 10 years ago would have been done.")

**Headline**: AI agents hit an inflection point.

**Supporting Content** (4 columns):

| AI Spending | Agent Adoption | Infrastructure | Protocol |
|---|---|---|---|
| $4B on AI coding tools in 2025 — 55% of all departmental AI spend | 97% of enterprise devs use AI tools daily. 41% of code is AI-written. | Vector DBs production-ready. LLM reranking viable at scale. Embedding costs dropped 10x. | MCP creating universal standard for AI agent context access. |

**Data Point**: "Cursor: $0 → $1B ARR in under 2 years. $29.3B valuation. Fastest SaaS growth ever." This proves the market is explosive and infrastructure needs are urgent.

**Visual Direction**: `columns` type (ColumnsSlideContent) with 4 columns. Each column header is uppercase with underline, items below. This format worked well in the existing "Why Now" slide. Make the Cursor stat the anchor — it's the most impressive single data point.

**The One Thing**: The AI coding revolution is here. The infrastructure layer is the next frontier. This is a once-in-a-decade timing window.

**Component Type**: `columns` (ColumnsSlideContent)

---

### Slide 4: The Solution
**Purpose**: Show what Lightfast does — clearly, concretely, in terms of outcomes. Not features, but what changes for the customer. (Sequoia: "Demonstrate your value proposition to make the customer's life better.")

**Headline**: The memory layer for engineering teams.

**Supporting Content** (leftText label: `CONNECT → ENRICH → SEARCH → CITE`):
- Connect GitHub, Vercel, Linear, Sentry in 5 minutes with OAuth. No config files, no setup scripts.
- Every engineering event is automatically enriched: classified, embedded across 3 views, entities extracted, relationships detected across sources.
- Semantic search understands "authentication flow changes last quarter" — not just keyword "auth." Two-key retrieval delivers 90%+ precision.
- Every answer cites its source — PR, commit, deployment, incident. No black-box responses. MCP tools give AI agents native access.

**Data Point**: "5-minute setup. 90%+ precision. Every answer cites its source."

**Visual Direction**: `content` type (ContentSlideContent). The leftText label `CONNECT → ENRICH → SEARCH → CITE` creates a clear pipeline metaphor that investors can immediately grasp. Each bullet maps to one step. This is the "how it works in plain English" slide — the next slide shows the technical architecture.

**The One Thing**: Lightfast is simple to set up, powerful in what it delivers, and trustworthy in how it presents answers.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 5: How It Works
**Purpose**: The "wow" technical slide. Show that Lightfast isn't just a wrapper — it's a genuinely sophisticated system with deep technical moat. This is where technical investors lean in. (a16z invests in infrastructure, not applications — this slide proves Lightfast IS infrastructure.)

**Headline**: The neural observation pipeline.

**Supporting Content** (leftText label: `FROM EVENT TO KNOWLEDGE`):
- Every webhook event passes through a multi-stage enrichment pipeline: significance scoring → LLM classification → multi-view embedding (3 vectors per event) → entity extraction → relationship detection → actor resolution.
- Cross-source relationships are detected automatically — a Sentry error links to the commit that caused it, to the PR, to the Linear issue, to the Vercel deployment. 8 relationship types, zero manual tagging.
- Not CRUD indexing. A neural knowledge graph that understands what happened, who did it, what it relates to, and why it matters. Noise is filtered; only significant engineering moments enter the memory layer.

**Data Point**: "8 relationship types auto-detected. 3 embeddings per observation. Zero manual configuration."

**Visual Direction**: This slide NEEDS a custom component — an architecture diagram. The existing component types can't do this justice. Recommendation: create a `custom-architecture-slide` component that renders a simplified version of the pipeline:

```
Webhooks (GitHub, Vercel, Linear, Sentry)
         ↓
  Neural Observation Pipeline
  ┌─────────────────────────────────┐
  │ Classify → Embed(x3) → Extract │
  │ → Relate → Resolve             │
  └─────────────────────────────────┘
         ↓
  Knowledge Graph + Vector Store
         ↓
  REST API / MCP Tools / Console
         ↓
  Two-Key Search: Vector → Rerank → Cite
```

Use the branded red for pipeline stages, warm gray for storage/output. Keep it minimal — the diagram should be readable at a glance, not a detailed system diagram. Think of it as a visual napkin sketch, not a Lucidchart.

**The One Thing**: Lightfast has a genuinely sophisticated technical architecture that creates compounding defensibility.

**Component Type**: New custom component needed (`custom-architecture-slide`). Falls back to `content` if custom component isn't built.

---

### Slide 6: Our Insight
**Purpose**: The non-obvious truth that makes Lightfast defensible. This is the slide that separates a good pitch from a fundable one. (YC: "Show non-obvious insights about your market.") The insight is WHY this works better than everything else — not what Lightfast does, but what Lightfast understands that competitors don't.

**Headline**: Two keys are better than one.

**Supporting Content** (leftText label: `THE NON-OBVIOUS TRUTH`):
- Vector search alone gives 60-70% precision — too noisy for engineers to trust. This is why enterprise search tools have low adoption.
- We add a second "key": LLM-based semantic validation after vector retrieval. The weighted combination (60% LLM + 40% vector) achieves 90%+ precision.
- But that's only half the insight. The other half: multi-view embeddings (3 vectors per observation: title, content, summary) mean queries match the right *aspect* of each event. Combined with cross-source relationship detection, Lightfast doesn't just find documents — it understands the web of decisions behind them.
- Competitors understand *what* code does. Lightfast understands *why* it was built that way.

**Data Point**: "Vector-only: 60-70%. Two-key retrieval: 90%+. The gap is trust."

**Visual Direction**: `content` type (ContentSlideContent). This slide benefits from the clean, text-heavy layout. The data is the star — let the numbers do the talking. Consider adding a subtle visual comparison (a simple bar chart or two-bar comparison) showing 65% vs 90%+ precision, but this would require a custom component. The existing content layout works well as-is.

**The One Thing**: Two-key retrieval is the technical moat that makes search results worth trusting.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 7: Market Opportunity
**Purpose**: Show this is a large, growing market with clear segmentation. Pre-seed investors need to believe the market can support a billion-dollar outcome. (Sequoia: "Calculate TAM top-down, SAM bottoms-up, SOM.")

**Headline**: A $24B market by 2030.

**Supporting Content** (3 columns):

| TAM | SAM | SOM |
|---|---|---|
| **$24B** — AI code tools market (2030), growing at 27% CAGR from $7.4B today | **$6B** — Developer productivity infrastructure: search, context, knowledge management tools for engineering teams | **$150M** — Teams with 10-250 engineers using 3+ engineering tools, actively adopting AI coding assistants. PLG entry → enterprise expansion. |

Bottom row or additional context:
- Adjacent: Developer tools market reaching $13.7B by 2030 (16.4% CAGR)
- Signal: AI consumed 50% of all global VC funding in 2025 ($211B of $425B)
- Comp: Cursor at $29.3B valuation. Sourcegraph valued at $2.6B. The infrastructure layer is next.

#### Bottom-Up Validation

The top-down TAM tells one story. The bottom-up math tells a more credible one:

- **Vercel AI Accelerator**: 2,275 startup applications — all deploying on the exact stack Lightfast integrates with (GitHub + Vercel). These are pre-qualified ICPs. Source: Guillermo Rauch (@rauchg), [Twitter/X](https://x.com/rauchg/status/2023513908750004513).
- **YC batch size**: Recent YC batches attracted ~30K applications (W23 had 20K), with thousands of funded companies at the 30-50 person stage — the sweet spot for Lightfast.
- **The ICP math**: Tens of thousands of early-stage startups (30-50 person teams) use GitHub + Vercel + Linear + similar tooling daily. At Lightfast's Team pricing of $20/user/month, a 40-person team = **$800/month**. Even capturing 1% of 10,000 such companies = **$960K ARR** at seed stage. 5% = **$4.8M ARR**.
- **Enterprise expansion**: These same companies adopt Jira, Confluence, Sentry, etc. as they scale past 100 people — implying natural expansion revenue as teams grow into the Business tier.

**Path to Initial ARR Milestones**:
| Scenario | Companies | Avg Team Size | Price/User/Mo | ARR |
|---|---|---|---|---|
| Conservative (1%) | 100 | 40 | $20 | $960K |
| Moderate (3%) | 300 | 40 | $20 | $2.88M |
| Optimistic (5%) | 500 | 40 | $20 | $4.8M |

**Acquisition Channels**: The Vercel ecosystem and YC founder network are the primary channels — these are not hypothetical markets but identifiable, reachable clusters of ICPs. (See Slide 11: Go-To-Market for the full GTM strategy.)

**Data Point**: "$7.4B → $24B at 27% CAGR. AI took 50% of all VC funding in 2025. Bottom-up: 1% of addressable startups = $960K ARR."

**Visual Direction**: `columns` type (ColumnsSlideContent) with 3 columns (TAM / SAM / SOM). Each column header is the market segment, with dollar figures as the leading items. The three-column layout maps naturally to the TAM/SAM/SOM framework that investors expect. Consider making the dollar amounts visually prominent (larger text or red accent). The bottom-up validation can appear as a secondary row beneath the TAM/SAM/SOM columns, or as a callout box.

**The One Thing**: This is a massive, fast-growing market and Lightfast sits at the infrastructure layer — picks and shovels in a gold rush. The bottom-up math shows a credible path to meaningful ARR from identifiable customer clusters.

**Component Type**: `columns` (ColumnsSlideContent) — 3 columns

---

### Slide 8: Competitive Landscape
**Purpose**: Show you understand the competitive landscape and have a clear, defensible positioning. Don't trash competitors — acknowledge their value and show the gap Lightfast fills. (Sequoia: "Focus on competitors and what differentiates your product.")

**Headline**: Everyone understands code. No one understands why.

**Supporting Content** (leftText label: `THE UNIVERSAL GAP`):
- **GitHub Copilot / Cursor**: Best-in-class code generation and codebase indexing. But limited to code-level context — they don't know why code was built, what decisions drove it, or what broke last time.
- **Sourcegraph / Cody**: Semantic code search with graph-based understanding. But $66K+ median enterprise cost, code-only, and no cross-system context linking.
- **Glean / Notion AI**: Enterprise knowledge search across documents. But no engineering-specific enrichment, no entity extraction, no relationship detection across engineering tools.
- **Lightfast**: The only tool that connects code (what exists) → decisions (why it exists) → people (who decided) → priorities (what matters now). Infrastructure, not application.

**Data Point**: "80% of engineering leads rate existing solutions 'inadequate' for cross-tool context search." — Lightfast customer discovery (15+ interviews).

**Visual Direction**: `content` type (ContentSlideContent). The two-column layout works well here — leftText as the positioning label, rightText as the competitive analysis. Each bullet starts with a bold competitor name, then their strength, then their gap. The last bullet (Lightfast) is the punchline. This avoids the typical 2x2 matrix which feels cliched — the text-based approach is more Sequoia/YC aligned (clear, large text > complicated charts).

**The One Thing**: Every competitor solves "what does this code do?" — Lightfast solves "why was it built this way?"

**Component Type**: `content` (ContentSlideContent)

---

### Slide 9: The Team
**Purpose**: The most important slide for pre-seed. Investors invest in teams, not products. Show founder-market fit — why these specific people are uniquely qualified to build THIS product. (YC: "Investors invest in teams, not slides." a16z: "The real question is why you're the right team.")

**Headline**: Built by engineers who lived the problem.

**Supporting Content** (leftText label: `WHY US`):
- **[Founder Name]**: [Role at Company], [specific relevant accomplishment — e.g., "Built search infrastructure serving X queries/day" or "Led engineering at a Y-person team"]
- **[Founder Name]**: [Role at Company], [specific relevant accomplishment — e.g., "ML infrastructure at scale" or "Shipped AI products used by Z users"]
- **Together**: [Specific sentence about why THIS combination of people is uniquely positioned — e.g., "We spent 5 years watching context evaporate across engineering teams. We built internal tools to solve it. Now we're building it for everyone."]
- **Advisors**: [Notable names if any, or remove this bullet]

**Data Point**: The validation evidence should be woven in here — "Interviewed 15+ engineering leads. 100% confirmed context loss as top-3 pain. We didn't research a problem — we lived it."

**Visual Direction**: `content` type (ContentSlideContent). Clean, text-focused. No headshots at this stage (YC advises against — "slides should be visually boring with clear, large text"). The credibility comes from the words, not the photos.

**CRITICAL FLAG**: This slide has placeholder data ("[Name]", "[Company]", "[accomplishment]"). This MUST be filled with real founder credentials before any investor meeting. The team slide is the single most important slide for pre-seed — it cannot remain a template.

**The One Thing**: These founders have deep domain expertise and personal conviction built from lived experience.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 10: The Ask
**Purpose**: Close with clarity. State exactly what you want, what you'll do with it, and leave a lasting impression. Then sit back and let the conversation start. (YC: "Ask directly for investment with clear milestones for the next 18-24 months.")

**Headline**: Every team deserves a memory layer.

**Supporting Content** (showcase format with metadata table):

| Label | Value |
|---|---|
| RAISING | $300K Pre-Seed |
| RUNWAY | 12 Months |
| MILESTONE | Q2 2026 Beta Launch |
| TARGET | $5K MRR by Month 12 |
| MODEL | Free / $20 per user per month / Enterprise |
| CONTACT | jp@lightfast.ai |

**Data Point**: The business model is embedded in the metadata: Free tier (PLG entry) → $20/user/month (Team) → Enterprise (Contact). This signals understanding of developer go-to-market without needing a separate slide.

**Visual Direction**: `showcase` type (ShowcaseSlideContent). The title "Every team deserves a memory layer" is the vision statement — aspirational and memorable. The branded red block on the left provides visual weight. The metadata table on the right gives investors the concrete numbers they need. This is the slide that stays up during Q&A, so it should be both inspiring (title) and practical (ask details). Consider adding the address (51 Grosvenor St, South Yarra) to the metadata or as subtle bottom text.

**The One Thing**: This is a capital-efficient raise with clear milestones and a credible path to revenue.

**Component Type**: `showcase` (ShowcaseSlideContent) — add MODEL and CONTACT rows to existing metadata

---

### Slide 11: Go-To-Market
**Purpose**: Show VCs there's a clear, credible acquisition strategy rooted in existing ecosystems — not a vague "we'll do content marketing and sales." Every channel is tied to an identifiable cluster of ICPs that already exist today.

**Headline**: We grow where engineers already live.

**Supporting Content** (3 columns):

| VERCEL ECOSYSTEM | YC / FOUNDER NETWORKS | MCP ECOSYSTEM |
|---|---|---|
| 2,275+ AI accelerator startups are the exact ICP — deploying on GitHub + Vercel, the stack Lightfast integrates with natively. | 30K recent YC applications = a dense cluster of technical founders building on modern dev tooling. | As the MCP standard matures, every AI agent tool integrating MCP needs a context source. Lightfast is purpose-built for this. |
| Partner with Vercel Marketplace. Participate in AI accelerator batches. | YC deals, demo days, founder community word-of-mouth. | Position as the reference implementation for MCP-compatible engineering context. |
| Bottom-up PLG: free tier for 3 users, self-serve upgrade to Team at $20/user/month. | These teams scale from 5 → 50 people and Lightfast grows with them — natural seat expansion. | Any agent framework (Claude Code, Cursor, Devin) that speaks MCP can connect to Lightfast out of the box. |

**Expansion Motion**: Startups that start on $20/user/month naturally expand to Business tier as they add Jira, Confluence, Sentry, and more sources at 100+ people. Land with 5 engineers, expand to the whole org.

**Data Point**: "Our first 100 customers exist right now in the Vercel AI Accelerator alumni network."

**Visual Direction**: `columns` type (ColumnsSlideContent) with 3 columns — one per channel. Each column header is the channel name (uppercase, tracking-wider), items below describe the strategy and evidence. The three-column layout mirrors the Market slide (Slide 7), creating visual consistency. Alternative: a funnel/flywheel diagram showing Ecosystem Discovery → Free Tier → Team Tier → Business Tier, but this would require a custom component. The columns layout works well as a v1.

**The One Thing**: We don't need to find customers — they're already clustered in ecosystems we can access. The GTM is ecosystem-native, not cold outbound.

**Component Type**: `columns` (ColumnsSlideContent) — 3 columns

---

## Narrative Arc

The deck tells a complete story in three acts:

### Act 1: The World Is Broken (Slides 1-3)
**Title → Problem → Why Now**

Opens with brand confidence (Lightfast), immediately hits the investor with quantified pain ($40K/engineer, 58% time wasted, knowledge walking out the door), then proves this isn't a "someday" problem — AI coding agents hit an inflection point in 2025 and the infrastructure layer is the bottleneck NOW.

*Emotional beat: urgency. "This is happening and there's a massive gap."*

### Act 2: We Have the Answer (Slides 4-7)
**Solution → How It Works → Insight → Market**

Shows what Lightfast does in plain English (connect, enrich, search, cite), then reveals the technical depth of the neural observation pipeline (the "wow" moment for technical investors), then delivers the non-obvious insight that makes it defensible (two-key retrieval), then zooms out to show the $24B market opportunity.

*Emotional beat: conviction. "This is real, it's sophisticated, and the market is massive."*

### Act 3: We Will Win (Slides 8-11)
**Competition → Team → Ask → Go-To-Market**

Shows the universal gap that no competitor fills (code vs. decisions), introduces the team that lived the problem and is uniquely positioned to solve it, makes a clear capital-efficient ask with concrete milestones, then closes with a credible go-to-market strategy rooted in existing ecosystems (Vercel, YC, MCP) — proving that the first 100 customers are identifiable and reachable today.

*Emotional beat: confidence. "We understand the landscape, we're the right team, here's exactly what we need, and here's exactly how we'll get customers."*

### Story in One Sentence
"AI coding agents are generating 41% of code but operating blind to organizational context — Lightfast is the memory layer that gives them eyes, built on a neural pipeline that achieves 90%+ search precision where others get 60-70%."

---

## Visual Design Direction

### Overall Aesthetic
The current design is strong and should be preserved. It follows YC's principles of **legibility, simplicity, and obviousness**:

- **Background**: Warm off-white `bg-[#F5F5F0]` for all content slides. This is distinctive — most pitch decks use stark white or dark backgrounds. The warm tone signals sophistication without being distracting.
- **Accent**: Branded red `var(--pitch-deck-red)` for title slide and accent elements. Used sparingly for maximum impact.
- **Typography**: Clean, normal-weight headings. No bold decorative fonts. Large text that's readable at distance.
- **Layout**: Two-column grid (content slides) with uppercase tracking labels on the left and detailed content on the right. This is a distinctive layout that sets Lightfast apart from generic pitch decks.
- **Dividers**: `border-b border-neutral-300` between content items. Subtle, structured, professional.

### Color Palette
- Primary: `--pitch-deck-red` (branded red, used for title and accents only)
- Background: `#F5F5F0` (warm off-white)
- Text: `oklch(0.205 0 0)` (near-black)
- Secondary text: `text-neutral-500` (for labels/headers)
- Content text: `text-neutral-700` (for body copy)

### Diagram Style (for architecture slide)
- Minimal line art, not detailed system diagrams
- Use branded red for pipeline stages/active components
- Use neutral gray for storage/passive components
- Rounded corners, generous spacing
- Think "napkin sketch made beautiful" — clarity over complexity
- No drop shadows, gradients, or 3D effects

### Typography Hierarchy
1. Slide title: `text-5xl` (fixed) / responsive scaling (desktop)
2. Left label: `text-base` uppercase tracking-wider, `text-neutral-500`
3. Right body: `text-xl` (fixed), `text-neutral-700`, `border-b` dividers
4. Column headers: `text-sm` uppercase tracking-wider, `text-neutral-500`
5. Column items: `text-lg`, `text-neutral-700`

---

## Content That Must Be Included

### Critical Data Points (must appear somewhere in the deck)
1. **57.6% of developer time** on program comprehension, **only 5% editing** — IEEE TSE study (Slide 2)
2. **$40K+/engineer/year** lost to context searching (Slide 2)
3. **40%+ token waste** from grep-based navigation in AI agents (Slide 2 or 3)
4. **90%+ precision** from two-key retrieval vs. 60-70% vector-only (Slide 6)
5. **Cursor at $29.3B valuation**, fastest SaaS growth ever (Slide 3)
6. **$7.4B → $24B+** AI code tools market at 27% CAGR (Slide 7)
7. **97% enterprise developers** using AI coding tools daily (Slide 3)
8. **AI consumed 50% of all global VC** in 2025 — $211B of $425B (Slide 7)
9. **8 relationship types** auto-detected, zero manual tagging (Slide 5)
10. **3 embeddings per observation** (multi-view: title, content, summary) (Slide 5)

### Critical Quotes/Framings
- "Developers spend 58% of time understanding code, 5% writing it. AI doesn't help because it can't access the 'why.'"
- "Every tool understands what code does. None understand why it was built that way."
- "Two keys are better than one." (Insight headline)
- "The memory layer for engineering teams." (Positioning statement)
- "Every team deserves a memory layer." (Vision/closing)

### Things That Must NOT Be Included
- Technical jargon without plain-English explanation (no "cosine similarity", "Cohere embed-english-v3.0", "Pinecone namespace isolation" in the deck — save these for technical deep-dives if asked)
- Competitive trash-talk (acknowledge competitor strengths, then show the gap)
- Fake traction (the validation is qualitative — own it honestly, don't inflate numbers)
- Complex charts or dashboards (YC: "complicated charts" hurt seed-stage pitches)

---

## Integration with Existing Slide Components

### Component Mapping

| Slide | Component | Changes Needed |
|---|---|---|
| 1. Title | `CustomTitleSlide` | None — keep existing design |
| 2. Problem | `ContentSlideContent` | Update `leftText` and `rightText` content |
| 3. Why Now | `ColumnsSlideContent` | Update column content with market data |
| 4. Solution | `ContentSlideContent` | Update content, new leftText label |
| 5. How It Works | **New: `CustomArchitectureSlide`** | New custom component with architecture diagram |
| 6. Insight | `ContentSlideContent` | Refine existing content |
| 7. Market | `ColumnsSlideContent` | New slide — 3 columns (TAM/SAM/SOM) |
| 8. Competition | `ContentSlideContent` | New slide — competitive positioning |
| 9. Team | `ContentSlideContent` | Existing slide — **needs real data** |
| 10. Ask | `ShowcaseSlideContent` | Merge current Ask + Vision, add MODEL/CONTACT rows |
| 11. GTM | `ColumnsSlideContent` | New slide — 3 columns (Vercel / YC / MCP channels) |

### Data Changes Required in `pitch-deck-data.ts`

1. **Remove**: `intro` slide (merged into Problem) — or repurpose as Problem
2. **Add**: Market slide (columns type, 3 columns)
3. **Add**: Competition slide (content type)
4. **Modify**: Why Now slide (update column data with specific numbers)
5. **Modify**: Ask slide (add business model + contact metadata rows)
6. **Remove**: `vision` closing slide (merged into Ask slide)
7. **Add**: Architecture slide (requires new custom component or use content type as fallback)

### New Component: `CustomArchitectureSlide`

A new custom slide component is recommended for Slide 5 (How It Works). This would render a simplified architecture diagram using pure CSS/HTML (no external image dependency). The component should:

- Accept the same `slide` and `variant` props as other components
- Render a minimal pipeline diagram with labeled stages
- Use branded red for active/pipeline elements
- Use neutral colors for storage/output elements
- Be responsive (work in both `responsive` and `fixed` variants)
- Degrade gracefully to a `ContentSlideContent` layout if the diagram isn't ready

If building a custom component is out of scope for v1, the architecture slide can use the `content` type with descriptive text instead of a diagram. The content would still be effective — just less visually impactful.

---

## Slide-by-Slide Data Specification

For direct use in `pitch-deck-data.ts`:

```typescript
// Slide 1: Title — no changes
// Slide 2: Problem
{ id: "problem", type: "content", title: "The Problem.", leftText: "THE $40K PROBLEM", rightText: [...] }
// Slide 3: Why Now
{ id: "why-now", type: "columns", title: "Why Now.", columns: [{ header: "AI SPENDING", items: [...] }, ...] }
// Slide 4: Solution
{ id: "solution", type: "content", title: "Our Solution.", leftText: "CONNECT \u2192 ENRICH \u2192 SEARCH \u2192 CITE", rightText: [...] }
// Slide 5: How It Works
{ id: "architecture", type: "content", title: "How It Works.", leftText: "FROM EVENT TO KNOWLEDGE", rightText: [...] }
// Slide 6: Insight
{ id: "insight", type: "content", title: "Our Insight.", leftText: "THE NON-OBVIOUS TRUTH", rightText: [...] }
// Slide 7: Market
{ id: "market", type: "columns", title: "Market Opportunity.", columns: [TAM, SAM, SOM] }
// Slide 8: Competition
{ id: "competition", type: "content", title: "Competitive Landscape.", leftText: "THE UNIVERSAL GAP", rightText: [...] }
// Slide 9: Team
{ id: "team", type: "content", title: "The Team.", leftText: "WHY US", rightText: [...] }
// Slide 10: Ask
{ id: "ask", type: "showcase", title: "Every team deserves a memory layer.", metadata: [...] }
// Slide 11: Go-To-Market
{ id: "gtm", type: "columns", title: "Go-To-Market.", columns: [{ header: "VERCEL ECOSYSTEM", items: [...] }, { header: "YC / FOUNDER NETWORKS", items: [...] }, { header: "MCP ECOSYSTEM", items: [...] }] }
```

---

## Open Questions

1. **Team credentials**: Slide 9 has placeholder data. Real founder names, roles, and accomplishments must be provided before implementation. This is the highest-priority gap.

2. **Architecture diagram**: Should Slide 5 use a new custom component with a visual pipeline diagram, or should it use the standard `content` type with descriptive text? Custom component is more impactful but requires more development effort.

3. **Validation data**: The current deck claims "15+ engineering leads interviewed" and "80% rate existing solutions inadequate." Are there additional traction signals (waitlist signups, GitHub stars, design partners, LOIs) that should be included?

4. **Pricing in the Ask**: The current business model is Free / $20/user/month / Enterprise. Should this be explicitly shown in Slide 10, or addressed verbally during Q&A?

5. **Closing slide**: The current deck has a separate closing/vision slide with address and contact info. The proposed design merges this into the Ask slide. The deck is now 11 slides with the addition of the GTM slide — this is a deliberate choice to close with a credible acquisition strategy after the ask, which strengthens the investor conversation.

6. **Product screenshots**: No product visuals exist in the current deck. Should a console screenshot or demo recording be embedded in the Architecture slide or Solution slide? This would require a custom component.

7. **Raise amount**: $300K pre-seed with 12-month runway and $5K MRR target. Is this still the correct ask, or has it changed?
