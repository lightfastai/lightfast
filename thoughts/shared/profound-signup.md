# Lightfast — Profound Platform Signup

_Generated: 2026-02-19_

---

## 1. About the Brand

Lightfast is the memory layer for software teams. We help engineers and AI agents search everything an engineering organisation knows—code, PRs, docs, decisions, incidents, deployments—and get answers that always cite their sources.

Most engineering problems are actually context problems: "Who owns this?", "Why was this chosen?", "What broke last deploy?" Lightfast makes your team's entire history instantly searchable by meaning, not keywords. Every answer includes verifiable sources, so engineers trust what they find and agents don't hallucinate.

We provide four simple API routes (search, contents, similar, answer) and MCP tools for AI agent runtimes. Integrations start with GitHub and Vercel, with Linear, Sentry, Slack, Notion, and more coming.

**Status:** Early Access (Alpha). Developer-first. Privacy by default—complete tenant isolation.

---

## 2. ICP (Ideal Customer Profile)

**Primary: Engineering teams at software companies (5–500+ engineers)**
- Use multiple tools: GitHub/GitLab, Vercel/Railway, Sentry, Linear, Slack
- Experience onboarding friction—new hires can't find "why" behind decisions
- Lose context when team members leave or repos grow complex
- Build or use AI assistants that need reliable organizational context

**Secondary: Engineering leaders & DevOps**
- Need visibility into ownership and system knowledge
- Want to reduce incident resolution time with better context
- Require audit trails for compliance and postmortems

**Tertiary: AI agent platform teams**
- Building agents that need access to real, citable engineering context
- Integrating MCP tools into their LLM workflows
- Want to ground AI answers in actual organizational data, not hallucinations

**Pain points they voice:**
- "Who last worked on this?"
- "Why did we move away from Postgres?"
- "What PRs touched this file before the incident?"
- "We keep rebuilding knowledge that already exists somewhere."

---

## 3. Competitors

| Category | Examples | Why Lightfast is Different |
|---|---|---|
| Keyword-based code search | GitHub Search, Sourcegraph | Semantic understanding; searches decisions and context, not just files |
| Internal wikis / knowledge bases | Confluence, Notion | Automatic capture—no manual documentation required |
| Enterprise search platforms | Elastic, Algolia | Purpose-built for engineering teams; MCP-native; cites sources |
| Generic RAG frameworks | LlamaIndex, LangChain | Production-ready out of the box; 4 API routes vs. DIY pipelines |
| AI code assistants | GitHub Copilot, Cursor | Focused on organizational memory and search, not code generation |

**Lightfast's single most defensible differentiator:** Every answer cites its source. That is non-negotiable. No black-box summaries.

---

## 4. Brand Point of View

Engineering organisations run on memory. The best teams know why decisions were made, who owns what, and how systems evolved. Today, that memory lives scattered across tools, lost in DM threads, or walks out the door when someone leaves.

We believe organisational memory should be:
- **Automatic** — captured as work happens, not written separately
- **Searchable by meaning** — understand intent, not just match keywords
- **Always trusted** — every answer shows where it came from
- **Available to agents too** — AI tools need context as much as humans do

The shift we're driving:
- From "who knows?" → sources show us
- From keyword search → semantic retrieval
- From manual documentation → automatic context capture
- From black-box AI → explainable, citable answers

We're not building a search box. We're building the memory layer that makes engineering teams—and their agents—reliably effective.

---

## 5. Author Persona

**Name:** Jeevan Pillay
**Role:** Founder, Lightfast
**Expertise:** Search systems, developer tooling, API design, retrieval-augmented generation
**Background:** Built production-grade retrieval systems; deep practitioner experience with semantic search, vector databases, and agent architectures
**Perspective:** Founder who codes—writes from first-hand implementation experience, not theory
**Credibility signals:** Shipping in public (changelogs, technical posts); transparent about alpha status and limitations

---

## 6. Tone of Voice

**Overall:** Authoritative, pragmatic, technically honest.

We sound like a senior engineer who has built this, knows its edges, and will tell you what works and what doesn't. We don't sound like a marketing team.

**In practice:**
- **Lead with what readers gain.** Not "we're excited to announce"—instead "You can now search across all your PRs by meaning."
- **Data before opinion.** If we make a claim, we show the number or the source.
- **Honest about limitations.** "Currently supports GitHub and Vercel; Linear coming in v0.2." Transparency builds trust.
- **Active voice.** "You can now..." not "Users are able to..."
- **No emoji.** Professional, technical, serious.
- **No corporate filler.** "Pleased to announce", "thrilled to share", "industry-leading"—never.

**By content type:**
- *Guides/tutorials:* Problem-aware, step-by-step, benefit-oriented. Lead with the pain.
- *Technical deep-dives:* Authoritative, opinionated, data-driven. Assumes technical knowledge.
- *Product announcements:* Visionary but grounded. Bold reframing, not puff.

---

## 7. Writing Rules

### Accuracy is non-negotiable
- Verify every claim. If citing a number, confirm the source.
- If mentioning a feature, confirm it exists in production.
- Disclose limitations and beta status explicitly.

### Structure every piece for scanning
- Short paragraphs (3–4 sentences max)
- Bullet points for features and lists, not for prose
- H2/H3 headers to break every major idea
- Bold key terms, not italic
- TL;DR block (80–100 words) at the top of every post—self-contained, no bullets

### AEO-first writing
- Every post includes a FAQ section (3–5 questions matching real search queries)
- Answers in FAQ are self-contained (no "see above")
- SEO meta description: 150–160 characters with primary keyword
- Internal links to 3–5 related docs
- 5+ external citations for E-E-A-T credibility

### Word counts by content type
- Technical guide / deep-dive: 800–1,500 words
- Product announcement / tutorial: 500–1,000 words
- Company announcement: 300–800 words

### Forbidden patterns
- "Coming soon" without specific version or timeline
- Vague feature descriptions ("improved performance")
- Passive voice
- Marketing superlatives without proof ("best-in-class", "cutting-edge")
- The excerpt and meta description must differ from each other

### Required at end of every post
- Author bio: name, role, years of relevant experience
- FAQ section
- Links to relevant docs

---

## 8. CTA Text

**Primary (early access):**
- "Get early access to Lightfast"
- "Request access"
- "Join the waitlist"

**Secondary (docs / try it):**
- "Read the documentation"
- "See the API reference"
- "Get started with: `npm install @lightfast/sdk`"

**Soft (community / newsletter):**
- "Join our Discord"
- "Follow along as we build"

**Three-CTA pattern in long-form posts:**
1. After TL;DR — "Get early access"
2. Mid-content (most relevant section) — contextual link to docs or feature
3. End of post — hard conversion: "Request access" or "Schedule a demo"

---

## 9. CTA Destination (Early Access)

**Primary:** `https://lightfast.ai/early-access`

**Supporting destinations:**
- Website: `https://lightfast.ai`
- Docs: `https://lightfast.ai/docs/get-started/overview`
- Changelog: `https://lightfast.ai/changelog`
- Discord: `https://discord.gg/YqPDfcar2C`

---

## 10. Writing Sample

### URL
`https://lightfast.ai/changelog`

### Title
"Search API, Hybrid Retrieval, Cross-Encoder Reranking"

### Body
This release ships production-ready semantic search: a REST API endpoint, four-path hybrid retrieval, and three configurable reranking modes that let teams tune quality against latency.

**Search API.** The `/v1/search` endpoint accepts natural language queries with optional filtering by source, type, and date range. Results include full metadata, entity extraction, and contextual information with detailed latency breakdowns per pipeline stage.

**Four-path hybrid retrieval.** Results are assembled from four signals in parallel: vector similarity (Pinecone), entity pattern matching, topic-based cluster context, and contributor expertise scoring. Entity matches receive a +0.2 boost to base scores; entity-only results score at 0.85 × confidence.

**Three reranking modes:**
- **Fast** — passthrough, ~0ms
- **Balanced** — Cohere rerank-v3.5, ~130ms
- **Thorough** — Claude Haiku 4.5, ~300–500ms (60% LLM weight + 40% vector weight, 0.4 relevance threshold)

Every result returns observation IDs, titles, URLs, snippets, scores, sources, types, entity tags, cluster topics, and relevant actor expertise domains—plus full performance metrics so you can see exactly where latency comes from.

### Outline

```
1. What's shipping
   - /v1/search endpoint overview
   - Filtering options

2. How retrieval works
   - Four-path hybrid pipeline
   - Entity scoring boosts
   - Cluster context integration

3. Reranking modes
   - Fast (passthrough)
   - Balanced (Cohere)
   - Thorough (Claude Haiku)

4. Response structure
   - Fields returned
   - Latency metrics

5. Get started
   - API reference link
   - Early access CTA
```

---

## 11. Audience Segments

### Agent Builders

**Name:** Agent Builders

**Description:**
Developers building AI agents that need real-time, citable access to engineering context—stack health, deployment history, incident patterns, and code ownership. They use Lightfast to ground their agents with searchable organisational memory so answers don't hallucinate. Their work spans risk scoring, root cause tracing, tech debt classification, and dependency discovery—all requiring a reliable retrieval layer underneath.

---

### Engineering Leaders

**Name:** Engineering Leaders

**Description:**
Engineering managers, VPs, and CTOs who need visibility into how their teams actually operate—not just what gets shipped, but cognitive load, knowledge gaps, on-call equity, and cross-team bottlenecks. They use Lightfast to surface team health signals, trace decisions from meeting to merge, and plan capacity based on real context rather than gut instinct.

---

### Technical Founders

**Name:** Technical Founders

**Description:**
Founders who care deeply about the connection between engineering output and business outcomes—customer impact, revenue per deploy, churn risk from incidents, and ROI by initiative. They use Lightfast to trace from infrastructure changes to business metrics, generate due diligence reports, and make build-vs-buy decisions grounded in actual historical data.

---

### Platform Engineers

**Name:** Platform Engineers

**Description:**
DevOps, SRE, and infrastructure engineers responsible for reliability, cost, and security across the entire stack. They use Lightfast to trace CVE blast radius, detect drift between declared and actual infrastructure, forecast scaling events, and auto-generate incident runbooks from historical resolution patterns—keeping systems observable and surprises rare.

---

## Notes for Profound Setup

**Content focus:** Guides, tutorials, and technical articles—not product documentation. Posts should help engineering teams understand *how* to use semantic search effectively, *why* retrieval quality matters, and *how* to integrate AI memory into their workflows.

**Content pillars:**
1. **How-to guides** — "How to search your PR history by meaning", "How to give your AI agent access to your codebase context"
2. **Technical explainers** — "How hybrid retrieval works", "Why cross-encoder reranking improves answer quality"
3. **Thought leadership** — "Why engineering teams lose context and what to do about it", "The shift from keyword search to semantic memory"
4. **Use case walkthroughs** — "How to find who owns a service using Lightfast", "Debugging incidents faster with searchable deployment history"
