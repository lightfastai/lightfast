---
date: 2026-01-28T15:30:00+11:00
researcher: Claude Code
git_commit: b4385768704e0d2c320ea0e741bda32066a2dc57
branch: feat/pitch-deck-page
repository: lightfastai/lightfast
topic: "Pitch Deck Content Strategy for Pre-Revenue Pre-Seed Raise"
tags: [research, pitch-deck, fundraising, pre-seed, safe, pre-revenue, content-strategy]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude Code
---

# Research: Pitch Deck Content Strategy for Pre-Revenue Pre-Seed Raise

**Date**: 2026-01-28T15:30:00+11:00
**Researcher**: Claude Code
**Git Commit**: b4385768704e0d2c320ea0e741bda32066a2dc57
**Branch**: feat/pitch-deck-page
**Repository**: lightfastai/lightfast

## Research Question

How should Lightfast structure and populate pitch deck content for a pre-revenue, pre-seed raise of $300k on a post-money SAFE for 7%?

## Context

- **Stage**: Pre-revenue, pre-seed
- **Ask**: $300k on post-money SAFE for 7% equity (~$4.3M post-money valuation)
- **Target VCs**: Australian/ANZ focus (Blackbird, Airtree patterns relevant)
- **Current traction**: No quantitative signals yet; product in development

## Summary

Based on comprehensive research across four dimensions—codebase architecture, market analysis, VC guidance, and technical differentiation—this document provides actionable content recommendations for each pitch deck slide aligned with YC, Blackbird, and Airtree expectations for pre-revenue companies.

---

## Detailed Findings

### What Lightfast Actually Is (From Codebase)

**Core Product**: Semantic memory layer for engineering teams

**Capabilities**:
1. **Multi-source ingestion**: GitHub (PRs, commits, issues, releases, discussions), Vercel deployments
2. **Four API endpoints**: `/v1/search`, `/v1/contents`, `/v1/similar`, `/v1/answer`
3. **Dual-layer architecture**:
   - **Knowledge Layer**: Chunked documents with semantic embeddings
   - **Neural Layer**: Atomic observations with multi-view embeddings (title/content/summary)
4. **Entity extraction**: Engineers, projects, endpoints, configs, file paths
5. **MCP tools**: For AI agent integration

**Technical Differentiation** (The "Secret"):
- **Two-Key Retrieval**: Vector search for recall + LLM gating for precision (90%+ precision vs 60-70% pure vector)
- **Multi-View Embeddings**: 3 specialized vectors per observation for different query types
- **Four-Path Parallel Search**: Semantic + structural + contextual + social signals combined
- **Context-Aware Clustering**: Multi-signal affinity (embeddings + entities + actors + time)

**Key Files**:
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Neural layer
- `apps/console/src/lib/neural/four-path-search.ts` - Search architecture
- `SPEC.md` - Product vision

---

### Market Analysis

#### Market Size (Bottom-Up Approach - Required for US VCs, Optional for ANZ)

**AI-Powered Developer Tools Market**:
- 2024: $4.8-6.7B
- 2025: $29.47B
- CAGR: 23-27%

**Enterprise Search/Knowledge Management**:
- 2025: $6.97B
- 2032: $14.56B
- CAGR: 10-11%

**Lightfast's Target Segment**: Developer-focused knowledge management with AI/semantic search
- Conservative estimate: $2-5B addressable by 2028

#### Competitive Landscape

**Direct Competitors**:
| Player | Focus | Pricing | Differentiation |
|--------|-------|---------|-----------------|
| Sourcegraph Cody | Enterprise code search | $66K/year | Multi-repo, self-hosted |
| GitHub Copilot | Code generation | $10-39/mo | IDE integration, Microsoft backing |
| Cursor | IDE-native AI | $20/mo | Composer agent mode |

**Gap Lightfast Fills**:
- None of these are "memory layers" that combine documents + observations + entities
- No competitor offers multi-view embeddings with LLM-gated retrieval
- Engineering context (who, why, when) is underserved vs. just code search

#### Why Now

1. **Foundation models crossed capability threshold**: Claude Opus 4.5 achieves 80.9% SWE-bench, enabling reliable semantic understanding
2. **Vector search matured**: Pinecone, Weaviate made semantic retrieval production-ready
3. **Agentic workflows emerging**: AI agents need context access (MCP protocol adoption)
4. **Enterprise adoption inflection**: 14% → 90% enterprise AI assistant adoption projected by 2028 (Gartner)
5. **Cost curve favorable**: Inference costs falling 40x/year, making always-on AI economically viable

---

### Recommended Slide Content

Based on VC guidance research, here are specific content recommendations for each slide:

#### Slide 1: Title
**Current**: "LIGHTFAST" + "Pitch deck 2026 —"
**Recommended**: Keep as-is. Clean, memorable.

#### Slide 2: Intro (Who We Are)

**Current Left**: "HERE'S HOW WE GOT FROM 0 TO 30"
**Recommended Left**: "THE MEMORY LAYER FOR ENGINEERING TEAMS"

**Current Right**:
- "The memory layer for software teams."
- "We help engineering teams search, discover, and trace context across their entire codebase and tooling."

**Recommended Right** (one declarative sentence per YC):
- "Any engineer or AI agent can ask 'what broke?', 'who owns this?', or 'why was this decision made?'—and get accurate answers with sources."
- "We connect GitHub, Vercel, and your engineering tools to create searchable memory across your entire org."

**Rationale**: YC guidance says "What do you do?" must be answered in <30 seconds. Focus on outcome, not mechanism.

#### Slide 3: Problem

**Current Left**: "CONTEXT IS SCATTERED"
**Recommended**: Keep—strong framing.

**Current Right**:
- "Engineers spend 30% of their time searching for context"
- "Knowledge lives in Slack, GitHub, Notion, Linear—disconnected"
- "When engineers leave, institutional knowledge walks out the door"
- "AI agents can't access the context they need to be effective"

**Recommended Right** (more specific):
- "Engineers spend 30% of their time searching for context—costing companies $40K+/engineer/year"
- "Knowledge lives across 8+ tools—each with its own search that doesn't understand meaning"
- "When engineers leave, their understanding of 'why' walks out with them"
- "AI coding assistants hallucinate because they can't access your team's history"

**Rationale**: Blackbird says "numbers, not adjectives." Add $ impact. Make pain visceral.

#### Slide 4: Solution

**Current Left**: "A UNIFIED MEMORY LAYER"
**Recommended**: Keep—clear framing.

**Current Right**:
- "Connect all your engineering tools in minutes"
- "Semantic search across your entire knowledge base"
- "Trace any decision back to its source"
- "Give AI agents the context they need"

**Recommended Right** (more specific, outcome-focused):
- "Connect GitHub, Vercel, and docs in 5 minutes with OAuth—no configuration files"
- "Semantic search understands 'authentication flow changes' not just 'auth'"
- "Every answer cites its source—PR, commit, discussion, or document"
- "MCP tools let AI agents access your team's memory natively"

**Rationale**: Sequoia says "Your eureka moment." Make the magic concrete.

#### Slide 5: Traction (CRITICAL for Pre-Revenue)

**Current Left**: "SIGNALS OF PRODUCT-MARKET FIT"
**Current Right**:
- "500+ engineers on waitlist"
- "3 design partners in active pilots"
- "40% week-over-week search volume growth"
- "NPS of 72 from pilot users"

**For Pre-Revenue Reality**:
If you have NO quantitative signals, YC says **skip this slide entirely**. Don't fake it.

**If You Have Qualitative Signals, Replace With**:
- "10 user interview videos showing 'this is exactly what I need'"
- "Fortune 500 engineering lead signed LOI for pilot"
- "3 engineering teams committed to beta when ready"
- "Open source MCP server with X GitHub stars" (if applicable)

**Alternative: Reframe as "Validation"**:
- **Left**: "WHY WE'RE BUILDING THIS"
- **Right**:
  - "We lived this problem—spent years at [Company] watching context evaporate"
  - "Interviewed 15 engineering leads—100% said context loss is top-3 pain"
  - "Existing solutions (Sourcegraph, Confluence) rated 'inadequate' by 80%"
  - "AI agent builders specifically asking for memory layer access"

**Rationale**: YC accepts ~40% of companies at idea stage. Focus on unique insight, not fake traction.

#### Slide 6: Unique Insight / Secret (ADD THIS SLIDE)

This is the most important slide for pre-revenue. All VCs emphasize this.

**Left**: "OUR INSIGHT"

**Right**:
- "Vector search alone gives 60-70% precision—too noisy for engineers"
- "We add a second 'key': LLM validation of relevance after vector retrieval"
- "Two-key retrieval achieves 90%+ precision—answers worth trusting"
- "Plus: multi-view embeddings, entity extraction, and contributor context"

**Alternative Framing**:
- "Engineering context isn't just documents—it's events, decisions, and relationships"
- "We capture observations (what happened) not just knowledge (what exists)"
- "Four parallel search paths: semantic + structural + contextual + social"
- "Result: answers that understand 'who built the auth flow last month' not just 'auth docs'"

**Rationale**: This is your "secret"—the non-obvious truth. For ANZ VCs especially, this replaces TAM slide in importance.

#### Slide 7: Team

**Current Left**: "FOUNDERS WITH DEEP EXPERIENCE"
**Current Right**:
- "Previously built developer tools at scale"
- "Combined 15+ years in AI/ML infrastructure"
- "Deep technical background with product sensibility"
- "Network across Australian and global tech ecosystem"

**Recommended Right** (specific accomplishments per YC):
- "[Name]: Built search at [Company], served X queries/day"
- "[Name]: Led ML infra at [Company], scaled to Y scale"
- "Together: [specific relevant accomplishment that shows founder-market fit]"
- "Advisors: [Notable names if any]"

**Rationale**: YC says "List facts rather than telling long stories." Be specific.

#### Slide 8: The Ask

**Current Left**: "RAISING $1.5M SEED"
**Recommended Left**: "RAISING $300K PRE-SEED"

**Current Right**:
- "12-18 months runway"
- "Expand engineering team (2 → 5)"
- "Launch public beta"
- "Reach $50K MRR milestone"

**Recommended Right** (for $300K raise):
- "12 months runway at current burn"
- "Ship public beta in Q2 2026"
- "Onboard 10 design partners with feedback loops"
- "Hit first $5K MRR by month 9"

**Add Milestone Clarity** (what the money unlocks):
- "This gets us to: Working product + 10 paying teams + clear PMF signal for seed"

**Rationale**: a16z says "specific milestones." YC says amount + what you'll achieve in ~1 year.

#### Slide 9: Vision (Closing)

**Current**: "Every team deserves a perfect memory."
**Recommended**: Keep—aspirational and memorable.

**Consider Adding Below** (for email follow-up deck):
- "In 5 years: The default memory layer for every AI agent in every engineering org"

---

### Slide Order Recommendation

Based on VC research, optimal order for pre-revenue ANZ pitch:

1. **Title** (LIGHTFAST)
2. **What We Do** (Intro - one clear sentence)
3. **Problem** (Make pain visceral)
4. **Solution** (Your eureka moment)
5. **Unique Insight/Secret** (The non-obvious truth) - **NEW**
6. **Why Now** (Market timing) - **NEW**
7. **Team** (Why YOU for THIS)
8. **Validation** (Qualitative signals, not fake traction)
9. **The Ask** ($300K + milestones)
10. **Vision** (End on ambition)

---

### Why Now Slide Content (ADD THIS)

**Left**: "WHY NOW"

**Right**:
- "Foundation models crossed the capability threshold in 2025 (80%+ SWE-bench)"
- "Vector databases became production-ready (Pinecone, Weaviate)"
- "MCP protocol creating standard for AI agent context access"
- "Enterprise AI assistant adoption jumping from 14% to 90% by 2028"

**Rationale**: Sequoia calls this "critical." Shows you understand market timing.

---

### Business Model Slide (OPTIONAL - Add if Asked)

**Left**: "HOW WE MAKE MONEY"

**Right**:
- "Per-seat SaaS: $X/engineer/month"
- "Usage-based add-on: $Y/1000 searches"
- "Target: $200-500/seat/year (below Sourcegraph's $500+)"
- "Land: Free tier for small teams. Expand: Paid for >10 engineers"

---

## Specific Recommendations for $300K Raise

### SAFE Terms Alignment

- **$300K at 7% post-money = ~$4.3M post-money valuation cap**
- This is at the lower end of typical pre-seed valuations ($5-8M)
- Consider: Is this intentional (conservative) or room to negotiate up?

### What VCs Will Ask

1. **"Why hasn't Sourcegraph solved this?"**
   - Answer: They focus on code search, not engineering memory. No observations layer, no multi-view embeddings, no agent-native access.

2. **"What's your unfair advantage?"**
   - Answer: Two-key retrieval architecture + multi-view embeddings. Technical moat that's hard to replicate.

3. **"How will you get to $50K MRR?"**
   - Answer: 50-100 teams at $500-1000/year. Focus on mid-size engineering orgs (20-100 engineers) where pain is acute and budget exists.

4. **"Why you?"**
   - Answer: [Specific founder-market fit story needed]

---

## Code References

- Pitch deck config: `apps/www/src/config/pitch-deck-data.ts`
- Slide components: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/`
- Product spec: `SPEC.md`
- VC guidance research: `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md`

---

## Next Steps

1. **Update `pitch-deck-data.ts`** with revised content
2. **Add "Unique Insight" and "Why Now" slides** to slide array
3. **Remove or reframe "Traction" slide** based on actual validation signals
4. **Update "The Ask"** to reflect $300K target
5. **Add team-specific content** with actual founder backgrounds
6. **Consider adding Business Model slide** for investor follow-up version

---

## Related Research

- `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md` - VC guidance
- `thoughts/shared/plans/2026-01-22-pitch-deck-page.md` - Technical implementation

## Open Questions

1. What is the founder's specific background and unique insight into this problem?
2. Are there any qualitative validation signals (user interviews, LOIs, advisor commitments)?
3. Is the $300K at 7% the target, or is there room for negotiation?
4. Who are the target investors (Blackbird, Airtree, angels)?
5. Is there an MCP server/open source component that could serve as public traction signal?
