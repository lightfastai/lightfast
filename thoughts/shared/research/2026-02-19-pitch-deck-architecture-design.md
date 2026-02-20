---
date: 2026-02-20
researcher: architect-agent
topic: "Lightfast pitch deck — architecture design (v4, Sequoia-aligned)"
tags: [research, architecture, pitch-deck, lightfast, vc, independence, beachhead, sequoia]
status: complete
based_on:
  - 2026-02-19-pitch-deck-codebase-deep-dive.md
  - 2026-02-19-pitch-deck-external-research.md
  - 2026-02-19-pitch-deck-v3-external-research.md
  - 2026-02-20-pitch-deck-v3-persona-reviews.md
revision: v4
changes:
  - "Consolidated v1 → v3 → persona reviews into single authoritative document"
  - "Realigned to actual Sequoia 10-slide framework as backbone"
  - "Team at position 10 (Sequoia's 9) — build conviction in opportunity first"
  - "Solution at position 3 (Sequoia's 3) — immediately after Problem"
  - "Business Model standalone at position 9 (Sequoia's 8)"
  - "Traction woven into Team (at pre-seed, traction IS the team story)"
  - "11 slides total: Sequoia 10 + Our Insight (non-obvious truth earns its place)"
  - "Toned down 'neural' branding — honest about rule-based vs ML components"
  - "Resolved pricing: $20/user/month consistently, ~$300/month = 15-user team average"
  - "Kept independence thesis + Segment analogy (10/10 persona praise)"
  - "Kept bottom-up market math (9/10 praise) — $180M+ beachhead over $200B TAM"
  - "Deleted v3 document — this is now the single source of truth"
---

# Pitch Deck Architecture Design v4: Lightfast

## Research Question

Design an 11-slide early-stage pitch deck for Lightfast — the independent context layer for engineering teams — that follows the Sequoia framework as its structural backbone, incorporates critical feedback from 10 investor persona reviews, and positions Lightfast for a $300K pre-seed raise. The deck must lead with evidence over vision and be honest about what exists today versus what's planned.

## Sequoia Alignment

The Sequoia 10-slide format is the structural backbone. v4 maps directly to it with one justified addition:

| # | Sequoia Framework | v4 Slide | Deviation |
|---|---|---|---|
| 1 | Company Purpose | Title | None |
| 2 | Problem | Problem | None |
| 3 | Solution | Solution | None |
| 4 | Why Now | Why Now | None |
| 5 | Market Size | How It Works | Swapped — product understanding needed before market |
| 6 | Competition | Our Insight | **Added** — non-obvious truth earns its place (YC: "show non-obvious insights") |
| 7 | Product | Market Opportunity | Swapped with Market — natural flow from Insight |
| 8 | Business Model | Competition | Moved after Market (independence argument needs market context) |
| 9 | Team | Business Model | Sequoia's exact position |
| 10 | Financials | Team + Traction | Team at Sequoia's position; traction woven in |
| 11 | — | The Ask | Sequoia's Financials expanded into closing ask |

**Justification for deviations:**
- **How It Works before Market** (Sequoia puts Market at 5, Product at 7): Lightfast's Market slide references the enrichment pipeline and two-key retrieval. Investors need to understand the product before the market math makes sense.
- **Our Insight added**: Sequoia doesn't have this, but YC explicitly says "show non-obvious insights." The two-key retrieval insight (90%+ vs 60-70%) is Lightfast's strongest technical differentiation and was praised by 6/10 personas. It earns a standalone slide.
- **Competition after Market** (Sequoia puts Competition at 6): The independence argument requires understanding both the product AND the market opportunity to land. "Why not them?" hits harder after "here's how big this is."
- **Traction woven into Team** (not standalone): At pre-seed, traction IS the team story. "16 months, 3,930 commits, $0 funding, 15 interviews" is evidence of the TEAM's capability. A standalone Traction slide with zero users would feel empty.

---

## Executive Summary

Lightfast is the independent context layer for engineering teams. It makes everything your team knows searchable via a single API for humans and AI agents. Connect GitHub, Vercel, Linear, and Sentry in 5 minutes. Every engineering event is automatically enriched: classified, embedded across 3 views, entities extracted, relationships detected across sources. Two-key retrieval (vector + LLM reranking) achieves 90%+ precision where vector-only gets 60-70%.

**Why this matters now:** AI coding agent spending hit $4B in 2025. 97% of enterprise developers use AI tools daily. But these tools operate blind to organizational context — they understand what code does, not why it was built. Agents waste 40%+ of tokens on brute-force grep navigation because no context infrastructure exists.

**Why independence matters:** 94% of IT leaders fear AI vendor lock-in. 81% of enterprise CIOs use 3+ model families. OpenAI's Memory is per-user only — no organizational context. Anthropic is racing to own compute, not building neutral infrastructure. The context layer must be separate from the model layer, just as Segment separated customer data from analytics providers. Segment was acquired for $3.2B.

**The beachhead:** 14K-20K teams use GitHub + Vercel + Linear + Sentry together today. At $20/user/month (~$300/month per team), that's $180M+ ARR before expanding beyond engineering.

**The capital efficiency story:** One founder. 16 months. 3,930 commits. $0 external funding. The product exists. $300K is to build a business, not a product.

---

## Core Design Principles (Lessons from Persona Reviews)

10 Australian investor personas and 3 VC framework validations (YC, a16z, Sequoia) reviewed the prior deck version. 0/10 would write a check. 8/10 would take the meeting. The thesis is fundable; the deck was not.

**Key corrections applied in v4:**

1. **Sequoia backbone.** Prior versions drifted from proven frameworks. v4 follows Sequoia's exact structure with minimal, justified deviations.

2. **Opportunity first, then team.** Sequoia's logic: build conviction in the problem and market before asking investors to evaluate the people. Team at position 10 (Sequoia's 9), not position 4.

3. **Business Model standalone.** All 3 frameworks and 6/10 personas flagged the missing Business Model slide. Extracted from Ask metadata into its own slide (position 9, Sequoia's 8).

4. **Beachhead focus.** 6/10 personas flagged scope creep from v3's "full company stack" expansion. v4 leads with engineering beachhead. Expansion is one line, not one slide.

5. **Honest technical claims.** The Technical DD Skeptic found significance scoring is rule-based, entity extraction at ingest is regex-based, and the public API lacks reranking. v4 drops "neural" branding where it's not accurate.

6. **Resolved pricing.** $20/user/month is the price. $300/month is the average team spend at ~15 users. Stated consistently throughout.

7. **Capital efficiency as narrative weapon.** "You are a capital efficiency success story masquerading as a vision deck. Flip the emphasis." (Capital Efficiency Zealot). Woven into Team slide as the proof of execution.

---

## The 11-Slide Structure

### Slide 1: Title
**Sequoia mapping**: Company Purpose

**Purpose**: Brand moment + one-sentence mission. Sequoia calls this "the most important part of your pitch."

**Headline**: LIGHTFAST

**Supporting Content**:
- Pitch Deck 2026
- Logo + wordmark centered on branded red grid

**Visual Direction**: Keep existing CustomTitleSlide — the red grid with hoverable squares is distinctive. The 16x9 grid overlay signals technical precision.

**The One Thing**: This brand is built with care and technical taste.

**Component Type**: `title` (CustomTitleSlide) — no changes needed

---

### Slide 2: The Problem
**Sequoia mapping**: Problem — "Describe the pain of the customer. Outline how the customer addresses the issue today."

**Purpose**: Make the investor feel the pain. Start with engineering (specific, quantified), zoom out briefly to show universality.

**Headline**: Every growing company is drowning in context.

**Supporting Content** (leftText label: `THE INVISIBLE COST`):
- Developers spend 58% of their time understanding code — only 5% writing it. AI doesn't help because it can't access the "why." That's $40K+/engineer/year lost to context searching.
- Knowledge lives across 8+ tools — GitHub, Slack, Linear, Notion, Sentry — each with search that doesn't understand meaning. The average company now uses 101 apps (Okta 2025). Workers toggle between them 1,200 times per day.
- When engineers leave, their understanding of "why things were built this way" walks out with them. 42% of institutional knowledge is unique to the individual. At 250 people, the expert-to-team ratio drops to 1:49.
- AI coding agents hallucinate because they operate on code in isolation, disconnected from your team's history and decisions. They waste 40%+ of tokens on brute-force grep navigation.

**Data Point**: "58% comprehension, 5% editing. 101 apps per company. 42% of knowledge walks out the door. $40K+/engineer/year."

**Visual Direction**: `content` type (ContentSlideContent). The leftText label "THE INVISIBLE COST" frames context loss as universal but every bullet is grounded in specific, quantified engineering pain.

**The One Thing**: Context fragmentation is quantifiably massive, gets exponentially worse as companies scale, and AI makes it worse, not better.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 3: The Solution
**Sequoia mapping**: Solution — "Demonstrate your value proposition to make the customer's life better. Show where your product physically sits."

**Purpose**: Immediately after the problem, show the answer. Clear outcomes, not features. Beachhead first, expansion in one line.

**Headline**: One API for everything your engineering team knows.

**Supporting Content** (leftText label: `THE CONTEXT LAYER`):
- **Connect** GitHub, Vercel, Linear, Sentry in 5 minutes with OAuth. No config files, no setup scripts. Every engineering event is automatically enriched: classified, embedded across 3 views, entities extracted, relationships detected across sources.
- **Search** by meaning, not keywords. "Authentication flow changes last quarter" returns relevant PRs, commits, deployments, and incidents — not keyword matches. Two-key retrieval (vector + LLM reranking) delivers 90%+ precision. Every answer cites its source.
- **Serve** humans and AI agents through one API. REST endpoints for human applications. MCP tools give AI agents (Claude Code, Cursor, any MCP-compatible tool) native access to your team's context. Works with ANY AI model — Claude, GPT, Gemini, open source.
- **Expand** beyond engineering. The same enrichment pipeline that connects a Sentry error to the PR that caused it can connect a support ticket to the customer's renewal timeline. Engineering is the beachhead, not the ceiling.

**Data Point**: "5-minute setup. 90%+ precision. Works with any AI model. Every answer cites its source."

**Visual Direction**: `content` type (ContentSlideContent). The leftText label `THE CONTEXT LAYER` positions as infrastructure, not application. The 4th bullet mentions expansion in one line — no separate slide, no department diagrams.

**The One Thing**: Lightfast is simple to set up, powerful in what it delivers, trustworthy in how it presents answers, and independent of any AI provider.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 4: Why Now
**Sequoia mapping**: Why Now — "Set up the historical evolution of your category. Define recent trends that make your solution possible."

**Purpose**: Prove this isn't a "could have been done 10 years ago" idea. Show specific convergence of trends.

**Headline**: AI agents hit an inflection point.

**Supporting Content** (4 columns):

| AI SPENDING | AGENT ADOPTION | INFRASTRUCTURE | INDEPENDENCE |
|---|---|---|---|
| $4B on AI coding tools in 2025 — 55% of all departmental AI spend | 97% of enterprise devs use AI tools daily. 41% of code is AI-written. | Vector DBs production-ready. LLM reranking viable at scale. Embedding costs dropped 10x. | 81% of CIOs use 3+ model families. 94% of IT leaders fear vendor lock-in. The multi-model future demands neutral context infrastructure. |

**Data Point**: "Cursor: $0 → $1B ARR in under 2 years. $29.3B valuation. Fastest SaaS growth ever."

**Visual Direction**: `columns` type (ColumnsSlideContent) with 4 columns. The 4th column (INDEPENDENCE) plants the seed for the competitive argument in Slide 8.

**The One Thing**: The AI coding revolution is here, infrastructure is ready, and the market is demanding vendor-neutral solutions. Once-in-a-decade timing window.

**Component Type**: `columns` (ColumnsSlideContent) — 4 columns

---

### Slide 5: How It Works
**Sequoia mapping**: Product — "Product line-up, functionality, features, architecture, intellectual property."

**Purpose**: The technical depth slide. Show this isn't a wrapper — it's genuine infrastructure with compounding defensibility. Where technical investors lean in.

**Why position 5 (not Sequoia's 7)**: The Market slide (Slide 7) references the enrichment pipeline and two-key retrieval. Investors need to understand the product before the market math makes sense. Sequoia's own guidance says "show where your product physically sits" — this does that, immediately after Why Now.

**Headline**: The enrichment pipeline.

**Supporting Content** (leftText label: `FROM EVENT TO KNOWLEDGE`):
- Every webhook event passes through a multi-stage enrichment pipeline: significance scoring → LLM classification → multi-view embedding (3 vectors per event: title, content, summary) → entity extraction → relationship detection → actor resolution.
- Cross-source relationships are detected automatically — a Sentry error links to the commit that caused it, to the PR, to the Linear issue, to the Vercel deployment. 8 relationship types, zero manual tagging.
- Not document indexing. A knowledge graph that understands what happened, who did it, what it relates to, and why it matters. Noise is filtered; only significant engineering moments enter the context layer.

**Data Point**: "8 relationship types auto-detected. 3 embeddings per observation. Zero manual configuration."

**Technical honesty note**: The headline is "The enrichment pipeline" not "The neural observation pipeline." Significance scoring uses rule-based keyword matching. Entity extraction at ingest uses regex (LLM only for content >200 chars). The ML components are classification, embedding, and reranking. Don't brand rule-based systems as "neural" — investors who do technical DD will find out.

**Visual Direction**: This slide benefits from a custom architecture diagram component. Recommendation: create `CustomArchitectureSlide` with a simplified pipeline visualization:

```
Webhooks (GitHub, Vercel, Linear, Sentry)
         ↓
  Enrichment Pipeline
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

Falls back to `content` type if custom component isn't built.

**The One Thing**: Genuine technical depth that creates compounding defensibility — but honest about which parts are ML and which are rule-based.

**Component Type**: New custom component (`CustomArchitectureSlide`) or `content` (ContentSlideContent) fallback

---

### Slide 6: Our Insight
**Sequoia mapping**: None — this is the one addition to Sequoia's framework.

**Purpose**: The non-obvious truth that makes Lightfast defensible. YC explicitly says "show non-obvious insights about your market or customers." This earns its place because two-key retrieval is Lightfast's strongest technical differentiator (praised by 6/10 personas).

**Headline**: Two keys are better than one.

**Supporting Content** (leftText label: `THE NON-OBVIOUS TRUTH`):
- Vector search alone gives 60-70% precision — too noisy for engineers to trust. This is why enterprise search tools have low adoption.
- We add a second "key": LLM-based semantic validation after vector retrieval. The weighted combination (60% LLM + 40% vector) achieves 90%+ precision.
- But that's only half the insight. Multi-view embeddings (3 vectors per observation: title, content, summary) mean queries match the right *aspect* of each event. Combined with cross-source relationship detection, Lightfast doesn't just find documents — it understands the web of decisions behind them.
- Competitors understand *what* code does. Lightfast understands *why* it was built that way.

**Data Point**: "Vector-only: 60-70%. Two-key retrieval: 90%+. The gap is trust."

**Benchmark action item**: The 90%+ claim is currently unbenchmarked (8/10 personas flagged). Before investor meetings: build a labeled test dataset, measure precision@k and NDCG, and show real numbers. "90%+" with methodology is credible. "90%+" without methodology is a red flag.

**Visual Direction**: `content` type (ContentSlideContent). The data is the star — let the numbers talk.

**The One Thing**: Two-key retrieval is the technical moat that makes search results worth trusting.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 7: Market Opportunity
**Sequoia mapping**: Market Size — "Identify/profile the customer you cater to. Calculate the TAM (top down), SAM (bottoms up) and SOM."

**Purpose**: Show a large, growing market with a clear, bottom-up beachhead. Lead with overlap data, not generic TAM/SAM/SOM. Pre-seed investors are tired of top-down fantasies.

**Why position 7 (not Sequoia's 5)**: Follows naturally from the Insight slide. The investor now understands the product AND the technical differentiator — they're ready to hear "and this is how big the opportunity is."

**Headline**: $180M+ in the beachhead alone.

**Supporting Content** (3 columns):

| BEACHHEAD (ALL 4 TOOLS) | SAM (3+ TOOLS) | EXPANSION |
|---|---|---|
| **14K–20K teams** use GitHub + Vercel + Linear + Sentry together. Highest-quality ICPs — modern engineering teams on the exact stack Lightfast integrates with. | **50K+ engineering teams** use GitHub, Vercel, and Sentry together, generating millions of events weekly with no unified context layer. | **300K+ teams** on any two-tool combination in the engineering stack alone. Adjacent markets: Knowledge Management ($62B), CRM ($113B), Workflow Automation ($41B). |
| Linear-first teams (30K+) are the ICP filter: 90% use GitHub, 40-60% use Vercel, 55-70% use Sentry → 15-20% use all four. | Vercel Marketplace Sentry integration: 50K+ installs — direct evidence of two-tool co-adoption. | Dev tools ($24B by 2030, 27% CAGR) is the wedge. Full context infrastructure is 10x larger. |
| At $20/user/month (~$300/month per 15-user team): **$180M+ ARR** before expanding beyond the beachhead. | At same pricing: scaling to **$500M+** with 3-tool teams. | Engineering is the beachhead. The expansion path follows the product, not the pitch deck. |

**Path to Initial ARR Milestones** (appendix/backup):

| Scenario | Companies | Avg Revenue/Mo | ARR |
|---|---|---|---|
| Conservative (0.5% of beachhead) | 75-100 | $300 | $270K–$360K |
| Moderate (2% of beachhead) | 280-400 | $300 | $1M–$1.44M |
| Optimistic (5% of beachhead) | 700-1,000 | $300 | $2.5M–$3.6M |

**Data Point**: "14K-20K beachhead teams. 50K+ three-tool teams. $20/user/month. $180M+ ARR from beachhead alone."

**Visual Direction**: `columns` type (ColumnsSlideContent) with 3 columns. Beachhead → SAM → Expansion funnel from concrete to ambitious. BEACHHEAD should feel grounded (specific numbers, specific tools). EXPANSION should feel like upside, not the headline.

**Why this works better than generic TAM/SAM/SOM**: The overlap data is specific, verifiable (Vercel Marketplace data), and tells a bottoms-up story. 9/10 personas praised this approach.

**The One Thing**: The beachhead is a real, identifiable, bottom-up market — not a top-down TAM fantasy.

**Component Type**: `columns` (ColumnsSlideContent) — 3 columns

---

### Slide 8: Competitive Landscape
**Sequoia mapping**: Competition — "Focus on competitors and what differentiates your product."

**Purpose**: Show you understand the landscape and have a structural differentiator no competitor can easily replicate. The independence argument is the deck's strongest asset (10/10 personas praised it).

**Why position 8 (not Sequoia's 6)**: The independence argument requires understanding both the product (Slide 5) and the market (Slide 7). "Why not them?" hits harder after "here's how big this is."

**Headline**: The context layer must be independent.

**Supporting Content** (leftText label: `WHY NOT THEM`):
- **AI coding tools (Cursor, Copilot, Cody)**: Best-in-class code generation and codebase indexing. But limited to code-level context — they don't know why code was built, what decisions drove it, or what broke last time. They read code. They don't read your team.
- **Enterprise search (Glean, Notion AI)**: Knowledge search across documents and email. But no engineering-specific enrichment, no entity extraction, no cross-source relationship detection. They search documents. They don't understand the web of decisions between them.
- **AI model providers (OpenAI, Anthropic)**: OpenAI's Memory is per-user only — memories can't be shared across users even in the same workspace. Zero answer for organizational context. Anthropic is racing to own compute and inference, not building neutral context infrastructure. Both have structural incentives to increase lock-in, not reduce it.
- **Lightfast**: Provider-agnostic context infrastructure. One API that works with ANY AI model. The Segment argument: Segment built the neutral customer data platform that made data portable across analytics providers. Acquired for $3.2B. We're building the Segment for engineering context. Context is your company's crown jewels — it shouldn't live in a model provider's system.

**Data Point**: "94% of IT leaders fear vendor lock-in. 81% use 3+ model families. OpenAI Memory is per-user only. Segment (neutral CDP) acquired for $3.2B."

**Technical honesty note**: The independence claim must be tempered. Current architecture depends on Anthropic Claude for classification/reranking and Cohere for embeddings. "Provider-agnostic architecture" (the API works with any downstream AI model) is accurate. "Born independent" is aspirational — the supply chain has real dependencies. Be prepared for this question in DD.

**The two competitive axes**:
1. Understanding depth: Code-only (Cursor/Copilot) → Document search (Glean) → Cross-source context with relationships (Lightfast)
2. Independence: Owned by AI provider (Copilot/Microsoft, ChatGPT Memory/OpenAI) → Provider-agnostic (Lightfast)

**Visual Direction**: `content` type (ContentSlideContent). Each bullet acknowledges competitor strengths, then shows the gap. The Lightfast bullet is the longest — the punchline should be the most detailed.

**The One Thing**: Every competitor either reads code, reads documents, or reads your data inside their model ecosystem. Lightfast is the only provider-agnostic context layer.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 9: Business Model
**Sequoia mapping**: Business Model — "How you make money and unit economics."

**Purpose**: Show you understand how this becomes a business. Even pre-revenue, demonstrate unit economics thinking. All 3 VC frameworks and 6/10 personas flagged the missing standalone Business Model.

**Headline**: Built for developer adoption.

**Supporting Content** (3 columns):

| FREE | TEAM — $20/USER/MONTH | ENTERPRISE |
|---|---|---|
| Up to 3 users. 2 integrations. Core search. | Unlimited users. All integrations. MCP tools. Priority enrichment. Advanced search filters. | Custom deployment. SSO/SAML. Dedicated support. SLA. Volume pricing. |
| **Purpose**: PLG entry. Zero-friction adoption. Engineer connects GitHub, sees value in 5 minutes. | **Purpose**: Revenue capture. Team of 15 = ~$300/month. Natural seat expansion as team grows. | **Purpose**: Expansion revenue. Teams that scale past 100 people need enterprise features. |
| **Conversion trigger**: Hit user limit or need team-wide search. | **Expansion trigger**: Add more integrations (Linear, Sentry). More teammates join. | **Expansion trigger**: Security review, compliance requirements, multi-team rollout. |

**Unit Economics Thinking** (pre-revenue, directional):
- Cost per observation: embedding (Cohere) + classification (Claude Haiku) + storage (Pinecone + PlanetScale). Estimated $0.001-$0.005 per enriched observation at scale.
- A 15-user team generating ~500 observations/week = ~2,000/month. At $300/month revenue and ~$10/month compute cost, gross margin is 95%+.
- LLM costs are the variable — reranking at search time is the most expensive operation. But reranking only runs on the top-k vector results (not all observations), keeping per-query cost low.

**GTM Channels** (summary — detail in verbal pitch):
- Vercel Marketplace + AI accelerator alumni (2,275+ ICPs on exact stack)
- YC founder networks (30K applications, dense cluster of technical founders)
- MCP ecosystem (any AI agent tool integrating MCP needs a context source)
- Bottom-up PLG: free tier drives adoption, team tier captures value

**Data Point**: "Free → $20/user/month → Enterprise. 95%+ gross margin at scale. PLG entry, seat expansion, enterprise upsell."

**Visual Direction**: `columns` type (ColumnsSlideContent) with 3 columns. Free → Team → Enterprise is a natural progression investors immediately understand. The unit economics can appear as a secondary section or be delivered verbally.

**The One Thing**: The business model is capital-efficient with strong unit economics, proven PLG mechanics, and natural expansion triggers at every tier.

**Component Type**: `columns` (ColumnsSlideContent) — 3 columns

---

### Slide 10: The Team
**Sequoia mapping**: Team — "Founding team and their qualifications."

**Purpose**: At Sequoia's position 9. By now the investor is convinced about the opportunity — Problem, Solution, Why Now, Product, Insight, Market, Competition, Business Model. The question becomes: "Can this team execute?" The answer is the capital efficiency story + validation evidence. At pre-seed, traction IS the team story.

**Headline**: Built by an engineer who lived the problem.

**Supporting Content** (leftText label: `WHY ME`):
- **[Founder Name]**: [Role], [specific relevant accomplishment]. [One sentence of personal narrative — not polished bio, raw conviction.]
- **The build**: 16 months. 3,930 commits. $0 external funding. One founder. Real enrichment pipeline processing real webhook events. Real search with cited sources. Real MCP tools. This isn't a prototype — it's a product waiting for users. [PRODUCT SCREENSHOT OR DEMO LINK HERE]
- **Validation**: Interviewed 15+ engineering leads. 100% confirmed context loss as a top-3 pain point. [X design partners using the product / targeted for next 90 days]. I didn't research a problem — I lived it, built the solution, and now I need capital to turn it into a business.
- **What I need beyond capital**: Customer introductions to engineering teams. Hiring network for first engineering hire. Strategic guidance on enterprise sales motion. "I built the product alone. I need a team to build the company."

**Data Point**: "16 months. 3,930 commits. $0 funding. 15+ interviews. 100% confirmed the pain."

**Visual Direction**: `content` type (ContentSlideContent). The capital efficiency story IS the credibility. The "what I need beyond capital" bullet signals coachability and self-awareness (5/10 personas flagged the purely transactional ask as a red flag).

**Why traction belongs here, not standalone**: At pre-seed with zero users, a standalone Traction slide would feel thin. But woven into the Team slide, the same facts become powerful evidence of execution capability: "One person built all of this with no money. Imagine what happens with $300K and a team." The product screenshot goes here — it's proof of what this founder built.

**CRITICAL FLAG**: This slide has placeholder data for founder credentials. This MUST be filled with real name, role, and personal narrative before any investor meeting. This is the single highest-priority gap.

**Solo founder risk**: Pre-seed investors will ask. Be prepared: co-founder search plan, first hire profile, advisory board targets. Own it — don't hide from it.

**The One Thing**: This founder has deep domain expertise, has already built the product with zero external capital, and is honest about what they need.

**Component Type**: `content` (ContentSlideContent)

---

### Slide 11: The Ask
**Sequoia mapping**: Financials — "Investment ask and projections."

**Purpose**: Close with clarity. State what you want and what you'll do with it. This is the slide that stays up during Q&A.

**Headline**: Every team deserves a context layer.

**Supporting Content** (showcase format with metadata table):

| Label | Value |
|---|---|
| RAISING | $300K Pre-Seed |
| RUNWAY | 12-18 Months (equity + R&D Tax Incentive) |
| USE OF FUNDS | 60% Engineering (first hire + infrastructure), 25% GTM (design partners, Vercel Marketplace), 15% Operations |
| MILESTONE | Design partners by Month 3. Public beta by Month 6. $5K MRR by Month 12. |
| CONTACT | jp@lightfast.ai |

**Data Point**: R&D Tax Incentive (43.5% refundable offset on eligible technical work) extends effective runway to 18+ months — the non-dilutive capital story strengthens the equity ask.

**Visual Direction**: `showcase` type (ShowcaseSlideContent). The title "Every team deserves a context layer" is the vision statement — aspirational and memorable. The metadata table gives investors every concrete number they need.

**Key changes from prior versions**:
- Added USE OF FUNDS breakdown (7/10 personas flagged this gap)
- Extended runway to 12-18 months via R&D Tax Incentive mention
- Added interim milestones (Month 3, Month 6, Month 12)
- Business model moved to standalone Slide 9 (no longer buried in metadata)

**The One Thing**: Capital-efficient raise with clear milestones and a credible path to revenue.

**Component Type**: `showcase` (ShowcaseSlideContent)

---

## Narrative Arc

The deck tells a complete story following Sequoia's three-question framework: **Can I understand this? Is this a big market? Why will this team win?**

### Act 1: The World Is Broken (Slides 1-4)
**Title → Problem → Solution → Why Now**

Opens with brand confidence, immediately hits the investor with quantified pain (58% comprehension, 101 apps, $40K/engineer, 42% knowledge loss), shows the solution immediately after the problem (Sequoia's pairing), then proves the timing is right — AI agents hit an inflection point and 94% of IT leaders are demanding vendor-neutral infrastructure.

*Sequoia question answered: "Can I understand this in 3 minutes?" Yes — problem and solution in slides 2-3.*

### Act 2: This Is Massive and Defensible (Slides 5-9)
**How It Works → Insight → Market → Competition → Business Model**

Shows the technical depth of the enrichment pipeline, delivers the non-obvious insight (two-key retrieval), reveals the $180M+ beachhead with bottom-up math, differentiates through the independence argument, then shows a capital-efficient business model with PLG mechanics.

*Sequoia question answered: "Is this a big market?" Yes — $180M+ beachhead, $500M+ SAM, massive expansion beyond engineering.*

### Act 3: This Team Will Win (Slides 10-11)
**Team + Traction → Ask**

Introduces the founder who lived the problem and built the solution with zero external capital, shows product evidence and validation, then closes with a clear, capital-efficient ask.

*Sequoia question answered: "Why will this team win?" 16 months, 3,930 commits, $0 funding — the product already exists. $300K is to build a business, not a product.*

### Story in One Sentence
"AI coding agents generate 41% of code but operate blind to organizational context — Lightfast is the independent context layer that gives them eyes, built by one founder over 16 months with $0, achieving 90%+ search precision where others get 60-70%, with 14K-20K teams already on the exact tool stack it integrates with."

---

## Visual Design Direction

### Overall Aesthetic
The existing design follows YC's principles of **legibility, simplicity, and obviousness**:

- **Background**: Warm off-white `bg-[#F5F5F0]` for all content slides
- **Accent**: Branded red `var(--pitch-deck-red)` for title slide and accent elements — used sparingly
- **Typography**: Clean, normal-weight headings. Large text readable at distance.
- **Layout**: Two-column grid (content slides) with uppercase tracking labels on the left, detailed content on the right
- **Dividers**: `border-b border-neutral-300` between content items

### Color Palette
- Primary: `--pitch-deck-red` (branded red, title and accents only)
- Background: `#F5F5F0` (warm off-white)
- Text: `oklch(0.205 0 0)` (near-black)
- Secondary: `text-neutral-500` (labels/headers)
- Body: `text-neutral-700` (content text)

### Typography Hierarchy
1. Slide title: `text-5xl` / responsive scaling
2. Left label: `text-base` uppercase tracking-wider, `text-neutral-500`
3. Right body: `text-xl`, `text-neutral-700`, `border-b` dividers
4. Column headers: `text-sm` uppercase tracking-wider, `text-neutral-500`
5. Column items: `text-lg`, `text-neutral-700`

### Diagram Style (architecture slide)
- Minimal line art, not detailed system diagrams
- Branded red for pipeline stages, neutral gray for storage/output
- Rounded corners, generous spacing
- "Napkin sketch made beautiful" — clarity over complexity

---

## Content That Must Be Included

### Critical Data Points
1. **58% of developer time** on comprehension, **only 5% editing** — IEEE TSE study (Slide 2)
2. **$40K+/engineer/year** lost to context searching (Slide 2)
3. **101 apps per company** — Okta 2025 (Slide 2)
4. **42% of institutional knowledge** unique to the individual (Slide 2)
5. **90%+ precision** from two-key retrieval vs. 60-70% vector-only (Slides 3, 6)
6. **Cursor at $29.3B valuation**, fastest SaaS growth ever (Slide 4)
7. **97% enterprise developers** using AI coding tools daily (Slide 4)
8. **94% of IT leaders fear vendor lock-in** — Parallels, Feb 2026 (Slides 4, 8)
9. **81% of enterprise CIOs use 3+ model families** — a16z (Slides 4, 8)
10. **8 relationship types** auto-detected, zero manual tagging (Slide 5)
11. **3 embeddings per observation** — multi-view (Slide 5)
12. **14K-20K beachhead teams** using all 4 tools (Slide 7)
13. **$180M+ ARR** at $20/user/month from beachhead (Slide 7)
14. **16 months, 3,930 commits, $0 funding** — capital efficiency (Slide 10)
15. **Segment acquired for $3.2B** — precedent for neutral data infrastructure (Slide 8)

### Critical Framings
- "Every growing company is drowning in context." (Problem headline)
- "One API for everything your engineering team knows." (Solution headline)
- "Two keys are better than one." (Insight headline)
- "The context layer must be independent." (Competition headline)
- "The Segment for engineering context." (Competition punchline)
- "Built for developer adoption." (Business Model headline)
- "Built by an engineer who lived the problem." (Team headline)
- "Every team deserves a context layer." (Closing)

### Things That Must NOT Be Included
- "Neural" branding on rule-based components
- $200B+ TAM as a headline (keep as brief expansion mention)
- Department-by-department Company Stack diagrams (save for verbal/appendix)
- EU regulatory arguments (irrelevant for AU/US pre-seed)
- Competitive trash-talk (acknowledge strengths, show gaps)
- Unbenchmarked precision claims without methodology caveat
- Complex charts or dashboards

---

## Integration with Existing Slide Components

### Component Mapping

| Slide | Component | Changes from Current |
|---|---|---|
| 1. Title | `CustomTitleSlide` | None |
| 2. Problem | `ContentSlideContent` | New content — expanded pain, "THE INVISIBLE COST" label |
| 3. Solution | `ContentSlideContent` | **Moved to position 3.** "THE CONTEXT LAYER" label. |
| 4. Why Now | `ColumnsSlideContent` | **Moved to position 4.** 4th column: "INDEPENDENCE" |
| 5. How It Works | `CustomArchitectureSlide` or `ContentSlideContent` | Headline: "enrichment pipeline" not "neural observation pipeline" |
| 6. Insight | `ContentSlideContent` | No content changes. Add benchmark action item. |
| 7. Market | `ColumnsSlideContent` | Major rewrite — overlap table data, $180M+ beachhead |
| 8. Competition | `ContentSlideContent` | Major rewrite — independence argument, Segment analogy |
| 9. Business Model | `ColumnsSlideContent` | **NEW SLIDE** — Free / Team / Enterprise columns |
| 10. Team | `ContentSlideContent` | Capital efficiency + validation woven in. Product screenshot. |
| 11. Ask | `ShowcaseSlideContent` | Use of funds added. Business model removed (now Slide 9). |

### Slide-by-Slide Data Specification

```typescript
// Slide 1: Title — no changes
// Slide 2: Problem
{ id: "problem", type: "content", title: "The Problem.", leftText: "THE INVISIBLE COST", rightText: [...] }
// Slide 3: Solution (MOVED TO POSITION 3)
{ id: "solution", type: "content", title: "Our Solution.", leftText: "THE CONTEXT LAYER", rightText: [...] }
// Slide 4: Why Now (MOVED TO POSITION 4)
{ id: "why-now", type: "columns", title: "Why Now.", columns: [{ header: "AI SPENDING" }, { header: "AGENT ADOPTION" }, { header: "INFRASTRUCTURE" }, { header: "INDEPENDENCE" }] }
// Slide 5: How It Works
{ id: "architecture", type: "content", title: "How It Works.", leftText: "FROM EVENT TO KNOWLEDGE", rightText: [...] }
// Slide 6: Insight
{ id: "insight", type: "content", title: "Our Insight.", leftText: "THE NON-OBVIOUS TRUTH", rightText: [...] }
// Slide 7: Market
{ id: "market", type: "columns", title: "Market Opportunity.", columns: [{ header: "BEACHHEAD (ALL 4 TOOLS)" }, { header: "SAM (3+ TOOLS)" }, { header: "EXPANSION" }] }
// Slide 8: Competition
{ id: "competition", type: "content", title: "Competitive Landscape.", leftText: "WHY NOT THEM", rightText: [...] }
// Slide 9: Business Model (NEW SLIDE)
{ id: "business-model", type: "columns", title: "Business Model.", columns: [{ header: "FREE" }, { header: "TEAM — $20/USER/MONTH" }, { header: "ENTERPRISE" }] }
// Slide 10: Team (with traction woven in)
{ id: "team", type: "content", title: "The Team.", leftText: "WHY ME", rightText: [...] }
// Slide 11: Ask
{ id: "ask", type: "showcase", title: "Every team deserves a context layer.", metadata: [...] }
```

---

## Pre-Deck Action Items

From persona reviews — ranked by impact and persona consensus:

| Priority | Action | Personas Satisfied | Status |
|---|---|---|---|
| **P0** | Complete Team slide with real credentials + personal narrative | 10/10 | BLOCKING |
| **P0** | Get 3-5 design partners using the product | 10/10 | BLOCKING |
| **P1** | Add product screenshot / demo link to Team slide | 9/10 | Before pitch |
| **P1** | Build search quality benchmark (validate 90%+ claim with precision@k, NDCG) | 8/10 | Before pitch |
| **P2** | Explore R&D Tax Incentive (~$100K-$130K non-dilutive, 43.5% refundable offset) | 5/10 | Before pitch |
| **P2** | Prepare solo founder risk mitigation talking points | 5/10 | Before pitch |
| **P3** | Prepare supply chain independence talking points (Anthropic/Cohere dependencies) | 4/10 | For DD |
| **P3** | Add geographic GTM note ("global infrastructure from day one") | 4/10 | Optional |

---

## Open Questions

1. **Team credentials**: Slide 10 has placeholder data. Single highest-priority gap.

2. **Architecture diagram component**: Should Slide 5 use a custom `CustomArchitectureSlide` or fall back to `content` type?

3. **Product screenshots**: No product visuals exist in the deck. One screenshot of a search result with cited sources would strengthen Slide 10 dramatically.

4. **Raise amount**: $300K pre-seed with 12-18 month runway (including R&D Tax Incentive). Still correct?

5. **Design partners**: Who from the 15 interviewees is most likely to use the product? Can they be contacted this week?

6. **Search benchmark**: What test dataset would validate the 90%+ precision claim? How quickly can this be built?

7. **R&D Tax Incentive**: Has a specialist been engaged? The 43.5% refundable offset could add $100K-$130K non-dilutive.
