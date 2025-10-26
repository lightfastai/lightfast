# Lightfast Specification

**Last Updated:** 2025-01-26

---

## Mission

Build the knowledge infrastructure layer for technical founders scaling startups from 0 → $100M ARR.

Every startup accumulates knowledge across dozens of tools - GitHub issues, Discord conversations, Linear tickets, Notion docs, Slack threads. This fragmentation creates friction: engineers can't find that discussion about the auth refactor, PMs don't know what's blocking the milestone, designers lose track of feedback buried in Discord.

Lightfast solves this by providing real-time, AI-accessible search across all company data. We're building the knowledge layer that makes every AI tool - from Claude Code to Cursor to custom agents - instantly context-aware about your entire company.

**Vision:** Make company knowledge instantly accessible to any AI tool, anywhere.

---

## Product

Lightfast is a knowledge infrastructure platform that provides real-time semantic search across all your company's data sources through a universal MCP interface.

### What We Built

**Knowledge Infrastructure for AI Tools**

Lightfast connects to your company's data sources (GitHub, Discord, Slack, Linear, Notion, Google Drive) and maintains a real-time, searchable knowledge base. AI tools access this knowledge through our MCP server, which provides semantic search, entity context, relationship mapping, and natural language Q&A.

We offer three ways to interact with this knowledge:

**1. MCP Interface**
AI tools like Claude Code, Cursor, and Windsurf integrate directly through our MCP server. Developers install `@lightfast/mcp` and their AI tools gain instant access to all company context. When a developer asks Claude Code "show me PRs related to the auth refactor," Claude queries Lightfast and returns results from GitHub, Linear, Discord, and Notion in one response.

**2. Direct API**
Developers building custom tools or integrations use our REST API. The API provides the same capabilities as MCP: semantic search, entity context, relationship traversal, and timeline queries. Teams building internal dashboards, Slack bots, or custom agents use the API to power their tools with company knowledge.

**3. Web Application**
Teams use our web app to configure integrations, search visually, explore the knowledge graph, and manage team access. Non-technical team members can search across all company data without touching code. The web app also provides a visual knowledge graph explorer showing how entities relate (which PRs close which issues, which discussions mention which features).

**4. Chat Bots**
Teams install Lightfast bots in Slack and Discord. Anyone can ask questions like "@lightfast what's blocking the auth milestone?" and get answers synthesized from Linear, GitHub, and recent discussions. The bot understands context and can link related entities across tools.

### How It Works

**Configuration**
Teams define what to index through a `lightfast.json` config file (similar to `vercel.json`) or through our web UI. The config specifies which repos, Discord servers, Slack channels, Linear teams, and Notion spaces to index. Teams set sync preferences (realtime vs periodic), history depth (3 months vs all time), and filter rules (exclude bots, archived content, specific labels).

**Real-Time Sync**
Lightfast connects to each data source via webhooks and APIs. When someone creates a GitHub PR, posts in Discord, updates a Linear issue, or edits a Notion doc, Lightfast receives the event within seconds. We extract the content, generate semantic embeddings, update our vector database, and refresh the knowledge graph. Search results reflect changes in real-time.

**Semantic Search**
When someone searches, we convert their query to embeddings and search across all indexed content. Results are ranked by semantic relevance (not just keyword matching). We apply reranking to boost quality, filter by source/time/author if requested, and return results with snippets and metadata. Searches complete in under 100ms.

**Knowledge Graph**
We maintain a graph of entity relationships: which PRs close which issues, which messages mention which PRs, which Linear tickets reference which Notion docs. This powers context queries like "show me everything related to this PR" which returns the PR itself, linked issues, discussions that mentioned it, commits included, and the Linear ticket it implements.

**Natural Language Q&A**
For questions like "what's blocking the auth milestone?", we parse the intent, search relevant entities, traverse the knowledge graph to understand relationships, and synthesize an answer with sources. This goes beyond simple search to provide actual answers based on understanding the knowledge graph.

---

## Target Market

### Primary: Technical Founders with Small Teams (1-10 people)

**Who They Are**

Technical founders running early-stage startups with small, high-velocity teams. The founder is technical (often solo or with 1-2 other engineers initially), but the team quickly becomes mixed as they hire their first PM, designer, or support person. These teams value developer experience and move fast - they're the same people who love Vercel, Linear, and Notion for their quality and speed.

They communicate primarily in Discord or Slack (Discord for dev-heavy teams, Slack as they professionalize). They use GitHub for code, Linear or Notion for project management, and Notion for docs. They're adding tools rapidly as they grow - Figma for design, Sentry for errors, PostHog for analytics.

**Their Pain**

These teams experience intense context fragmentation. Knowledge scatters across tools faster than they can document it. The auth refactor was discussed in Discord last week, documented in a Notion page, has a Linear ticket, and three GitHub PRs - but no one remembers where that key decision about session storage was made.

Engineering becomes bottlenecked answering "where is X?" questions from non-technical team members. The PM asks "what's blocking the auth milestone?" The designer asks "where's that mobile feedback from last week?" The support person asks "is there a bug report about login issues?" Every question pulls engineers away from building.

AI tools like Claude Code and Cursor help with coding but lack company context. When the developer asks Claude Code "refactor the auth system," Claude doesn't know about the existing Linear tickets, the Discord discussion about requirements, or the Notion doc with the architecture decision. The developer must manually gather all this context.

Search is painful. GitHub search only covers code. Discord search is slow and keyword-only. Linear search misses related discussions in Discord. Notion search doesn't know about the relevant GitHub issues. Every search requires checking multiple tools and manually connecting related information.

**What They Need**

A single search that spans all their tools. When they search "auth refactor", they want to see the Linear ticket, related GitHub PRs, Discord discussions, and Notion architecture doc in one result set - ranked by relevance, not scattered across five tools.

AI tools that understand company context. When using Claude Code or Cursor, the AI should know about existing Linear tickets, past Discord discussions, and documented decisions in Notion. This eliminates the manual context-gathering that currently slows down every AI-assisted task.

A way to unblock non-technical team members without engineering involvement. When the PM asks "what's blocking auth?", they should be able to get the answer themselves by asking the Lightfast bot in Slack. When the designer searches for "mobile feedback", they should find it across Discord, Linear, and Notion without bothering engineers.

Fast, config-driven setup like Vercel. They want to add their GitHub org, Discord server, and Linear workspace in 5 minutes, not spend 5 hours configuring an enterprise search platform. They want `lightfast.json` config, not complex UI builders.

Affordable pricing for small teams. They're not paying $500-1000/month for enterprise search. They need something in the $49-99/month range that grows with them.

**How They Use Lightfast**

A developer using Claude Code asks "show me all PRs related to the auth refactor." Claude Code calls `lightfast_search` via MCP and returns PR #127 (merged yesterday), Issue #89 (closed by that PR), Linear AUTH-12 (the original ticket), and the Discord thread where they discussed the approach. The developer has full context instantly.

A PM in Slack types "@lightfast what's blocking the auth milestone?" The bot searches Linear for auth milestone tickets, finds AUTH-15 is waiting for design review and AUTH-18 is blocked on external API approval, and responds with a summary and links. The PM gets their answer without pulling engineers into a meeting.

A designer opens the Lightfast web app and searches "mobile redesign". Results include the Figma file (via link in Notion), the Notion spec doc, Discord discussion thread, Linear tickets for implementation, and GitHub PRs. Everything related to mobile redesign in one view.

A support person searching for "login bug reports" finds Sentry errors, related GitHub issues, Linear tickets, Discord user complaints, and Slack support threads - all ranked by relevance. They can see if the bug is known, being worked on, or already fixed.

### Secondary: Developers Building AI Agent Products

**Who They Are**

Companies building agent-first products like v0.dev (code generation), CodeRabbit (code review), Lovable (app building), or HumanLayer (agent coordination). They're creating AI tools that need to understand company context to be useful.

**What They Need**

A knowledge infrastructure layer they can integrate rather than building themselves. They want to focus on their agent's unique value (code review logic, UI generation, etc) without building embedding pipelines, vector databases, real-time sync, and knowledge graphs.

An API-first product with excellent developer experience. They'll integrate Lightfast's search API into their agents so when a code review agent analyzes a PR, it can find related issues, discussions, and documentation automatically.

**How They Use Lightfast**

A code review agent uses Lightfast's API to search for related issues and discussions when reviewing a PR. This context helps it provide better, more relevant feedback.

An issue triage agent queries Lightfast to find similar past issues and their resolutions, helping it categorize and route new issues more intelligently.

A documentation agent uses Lightfast to find all discussions, decisions, and implementations related to a topic when generating or updating docs.

---

## Competitive Landscape

The market has several categories of adjacent products, each with different strengths and gaps.

### Embeddings API Providers (mixedbread.ai, Voyage AI, Cohere)

**Their Strength**
These companies provide excellent embedding models at competitive prices. mixedbread.ai offers multimodal embeddings at $0.01 per million tokens. Voyage AI has the best-performing models on benchmarks. Cohere provides strong multilingual support and reranking APIs.

**Where We Differ**
Lightfast provides the complete knowledge infrastructure, not just embeddings. We handle data source integration, real-time sync, vector storage, knowledge graph construction, and search APIs. Teams using embeddings providers still need to build all this infrastructure themselves. We use these providers (Voyage AI for quality, mixedbread.ai for cost efficiency) as components within our full solution.

### Enterprise Search Platforms (Glean, Qatalog)

**Their Strength**
Glean is the category leader in enterprise search with deep integrations and a polished UI. They serve large enterprises with 500+ employees and dedicated search teams. Their knowledge graph and AI-powered suggestions are sophisticated.

**Where We Differ**
Lightfast targets startups and small teams, not enterprises. We're API/MCP-first where they're UI-first. Our pricing starts at $49/month versus their $500-1000+/month enterprise contracts. We offer config-driven setup (5 minutes) versus their weeks-long implementation with customer success teams. We position as infrastructure for AI tools, not a destination search UI for humans.

### Developer Search Tools (Algolia)

**Their Strength**
Algolia provides excellent search APIs with great developer experience. They power search for thousands of apps and websites with fast, relevant results.

**Where We Differ**
Algolia is built for app/website search, not company knowledge search. They don't provide data source integrations or real-time sync from GitHub, Discord, Slack, etc. Teams would need to build all the ingestion infrastructure themselves. We're purpose-built for company data with integrations included.

### Vector Databases (Pinecone, Qdrant, Weaviate)

**Their Strength**
These platforms provide scalable vector storage and search. Pinecone has excellent developer experience and managed infrastructure. Qdrant offers high performance and advanced filtering. Weaviate provides knowledge graph capabilities.

**Where We Differ**
Lightfast is a higher-level abstraction. Vector databases are infrastructure components - teams still need to build the embedding pipeline, data source integrations, sync logic, and search APIs. We provide the complete solution where vector databases are one component of our stack. Teams using vector databases directly are building what we sell as a service.

### Our Position

Lightfast occupies the space between low-level infrastructure (embeddings APIs, vector databases) and high-cost enterprise search (Glean). We provide a complete, API-first solution at startup-friendly pricing with Vercel-style developer experience.

We're the only product that combines:
- Real-time sync from all major data sources (GitHub, Discord, Slack, Linear, Notion)
- MCP-first interface for AI tools
- Config-driven setup (lightfast.json)
- Knowledge graph for entity relationships
- Startup pricing ($49-99/month, not $500+)
- Three interfaces (MCP, API, Web UI, Chat bots)

---

## Business Model

### Pricing Philosophy

We designed pricing to be transparent, predictable, and accessible to startups while capturing value as teams grow. Every tier has clear limits published upfront. Teams can start free, upgrade when they see value, and scale through self-serve tiers before needing custom enterprise contracts.

Usage limits increase 10x between tiers while price increases 2-3x, making upgrades feel like great value. Add-on pricing is simple and predictable - no surprise bills.

### Pricing Tiers

**Free Tier - $0/month**

The free tier is designed for solo founders and very early teams to try Lightfast without friction. Three integrations covers GitHub + Discord + Linear or GitHub + Slack + Notion - enough to demonstrate value. 1,000 searches per month allows daily usage by 1-2 people. 10,000 indexed entities handles a small startup's GitHub repos and a few months of Discord history.

This tier has full API access (rate-limited) and basic knowledge graph. Teams can experience the core value proposition before paying. We expect most free users are evaluating or using Lightfast for side projects. The goal is to convert 15% to paid within 3 months as they see value.

**Pro Tier - $49/month**

Pro is designed for technical founders actively using Lightfast daily. Ten integrations allows GitHub + Discord + Slack + Linear + Notion + a few others. 10,000 searches per month supports a team of 3-5 people searching multiple times daily. 100,000 indexed entities handles growing GitHub activity and several months of chat history across Discord and Slack.

This tier includes the Slack/Discord bot, full API access (no rate limits), and export capabilities. The $49 price point is impulse-buy range for funded founders - no CFO approval needed, just put it on the company card. This tier should be 70% of revenue in Year 1.

**Team Tier - $99/month**

Team tier supports 5-10 person startups who've validated Lightfast and want to expand usage across the team. Unlimited integrations removes constraints as teams add more tools (Drive, Jira, Confluence, Figma). 50,000 searches per month supports the whole team searching frequently. 500,000 indexed entities handles significant history across all tools.

This tier adds team features: shared searches, team member management, audit logs, and usage analytics. These features matter as multiple people use Lightfast - teams want to see what others search, who has access, and how much they're using. The $99 price point remains self-serve while doubling capacity.

**Enterprise Tier - Custom Pricing**

Enterprise serves teams who've outgrown self-serve tiers, typically 25+ people or companies with specific compliance/security requirements. Pricing averages $2,000/month but varies based on company size and needs.

This tier adds SSO/SAML (required for many companies), BYOC (bring your own compute for data residency), white-label options (for agencies or platform companies), and custom integrations (proprietary tools). Enterprise includes SLA guarantees, dedicated support, and customer success.

We expect 5-10 enterprise customers in Year 1 generating 20-30% of revenue despite being a small percentage of customer count.

### Add-On Pricing

Teams exceeding tier limits can purchase add-ons instead of upgrading tiers:
- **Additional searches:** $5 per 10,000 searches
- **Additional entities:** $10 per 100,000 entities
- **Additional integrations:** $10 per integration (Free/Pro tiers only)

Add-ons provide flexibility for teams with specific high-usage patterns (e.g., normal entity count but high search volume). Add-on revenue should be 5-10% of total revenue.

### Revenue Model Evolution

**Year 1: Prove Self-Serve Model**
Focus on Pro and Team tiers through product-led growth. Self-serve subscriptions drive 80% of revenue, usage-based add-ons contribute 20%. Launch with Pro tier, add Team tier at Month 6, add Enterprise tier at Month 9. Goal: $25K MRR with 200+ paying customers demonstrating self-serve works.

**Year 2: Scale Self-Serve + Add Enterprise**
Continue growing self-serve while adding enterprise sales motion. Subscriptions remain 60% of revenue as absolute dollars grow. API usage (add-ons) stays 20%. Enterprise deals contribute 20% - just 10-15 customers generate significant revenue. Goal: $100K MRR with mix of self-serve volume and enterprise deal size.

**Year 3: Platform + Marketplace**
Launch marketplace for third-party integrations and pre-built search templates. Subscription revenue (40%), API usage (25%), enterprise (30%), and marketplace (5% but growing fast). Marketplace revenue split is 70% to integration developers, 30% to Lightfast. Goal: $250K+ MRR with diversified revenue streams.

---

## Product Principles

### 1. Config-Driven, Vercel-Style Developer Experience

We believe the best developer tools disappear into the background. Teams should spend 5 minutes setting up Lightfast, not 5 hours. Configuration should be declarative (lightfast.json) or visual (web UI), never requiring database schema design or API calls to get started.

When a team adds their GitHub org, we auto-discover all repos and suggest reasonable defaults (index last 6 months, exclude dependabot, include issues/PRs/discussions). Teams can refine from there. When they add Discord, we show all channels and let them pick which to index. Configuration changes take effect immediately with no redeploys.

This principle extends to the MCP server - `npx @lightfast/mcp` should install and configure in one command. Documentation should be concise and example-driven. Error messages should be helpful and actionable.

### 2. Real-Time by Default

Stale search results erode trust. When someone searches for "auth refactor" and the PR merged an hour ago doesn't appear, they assume Lightfast is broken. Real-time sync is table stakes.

We receive webhooks from all data sources and process updates within seconds. When a GitHub PR is created, commented on, reviewed, or merged, the search index updates immediately. When someone posts in Discord or updates a Linear ticket, the change reflects in search results within 2 seconds.

Real-time creates complexity (webhook reliability, processing speed, cost) but it's essential. We handle this complexity so users don't think about sync schedules or manual refreshes. Search should feel like it's searching live data, not a snapshot from yesterday.

### 3. MCP-First, AI-Native Design

The future of software is AI tools working together. Lightfast should be accessible to any AI tool, not just humans clicking in UIs. MCP provides this universal interface - Claude Code, Cursor, Windsurf, and custom agents all speak MCP.

We designed our capabilities around what AI tools need: semantic search (not just keyword search), entity context (not just individual results), relationship traversal (understand connections), and natural language Q&A (synthesize answers). These capabilities map directly to MCP tools.

This doesn't mean we're MCP-only. We also provide REST API, a web UI, and chat bots. But MCP is the primary interface we optimize for, and other interfaces should offer equivalent capabilities.

### 4. Privacy and Security by Design

Company knowledge is sensitive. GitHub repos contain proprietary code, Discord channels have confidential discussions, Linear tickets reveal roadmaps. Teams trust us with this data and we treat that responsibility seriously.

We scope permissions per integration - users only see search results for data they have access to. If someone doesn't have access to a private GitHub repo, they won't see results from it. OAuth tokens are scoped to minimum necessary permissions. API keys can be restricted to specific data sources or query types.

We maintain audit logs of all searches and data access (Team tier and above). We don't train AI models on customer data. We offer SOC 2 Type II compliance for Enterprise customers. We provide BYOC (bring your own compute) for teams with data residency requirements.

Security isn't a checklist - it's a mindset throughout product development. Every new feature includes a threat model. Every integration includes a privacy review.

### 5. Developer Experience is Everything

Our target customer is technical founders who've used Vercel, Linear, and Stripe. They have high expectations for API design, documentation, and error messages. Meeting those expectations is our competitive advantage.

APIs should be intuitive - correct usage should be obvious from the type signatures. Documentation should have working examples for every endpoint. Error messages should explain what went wrong and how to fix it. Rate limits should be clearly documented and returned in headers.

API responses should be fast (<100ms p95 for search) and consistent in shape. TypeScript types should be published and accurate. Client libraries should feel native to each language (JavaScript, Python, Go) not auto-generated wrappers.

We measure DX through time-to-first-query and developer satisfaction surveys. When developers hit errors, we instrument what went wrong and improve docs or error messages. DX is never "done" - it's continuous refinement.

### 6. Transparent, Predictable Pricing

Nobody should need to "contact sales" to know if they can afford Lightfast. Pricing should be published, explained, and predictable. Teams should be able to estimate their costs based on team size and usage.

Every tier has clear limits published upfront. Add-on pricing is simple math ($5 per 10K searches). Enterprise pricing averages $2,000/month and scales with company size - we publish this range. Billing is monthly with clear invoices showing what was used.

We don't do surprise bills. When a team approaches tier limits, we warn them before charging overages. We make it easy to upgrade tiers or purchase add-ons. We provide usage dashboards so teams can see their consumption in real-time.

This transparency builds trust. When teams know exactly what they're paying for and can predict future costs, they're more likely to expand usage and upgrade tiers.

---

## Long-Term Vision

### Near-term (2025-2026): Knowledge Infrastructure Standard

Become the standard way AI tools access company knowledge. Every team using Claude Code, Cursor, or custom agents runs Lightfast to provide company context. When developers build new AI tools, they integrate Lightfast from day one.

We achieve this by providing the best developer experience in the category, maintaining real-time sync reliability, and partnering with major AI tool companies. Success means "Lightfast" becomes the default answer when someone asks "how do I give my AI tool access to company knowledge?"

**Success Indicators:**
- Featured by Anthropic as MCP integration example
- Official partnerships with Cursor, Windsurf, other AI tools
- 5,000+ active projects using Lightfast
- "Lightfast" mentioned in developer job postings
- Conference talks and blog posts assume Lightfast as the knowledge layer

### Mid-term (2027-2028): Universal Company Data Platform

Expand beyond developer tools to the entire company. Sales teams use Lightfast to search CRM data, support tickets, and customer conversations. Marketing teams search campaign data, content calendars, and social media. Operations teams search metrics, reports, and process docs.

The same infrastructure that makes developers productive makes every function productive. We expand integrations to cover every major business tool category. The knowledge graph understands cross-functional workflows (sales discussion → feature request → Linear ticket → GitHub PR → deployment → customer success follow-up).

**Success Indicators:**
- Non-developer functions represent 40% of usage
- 50+ integrations across all business tool categories
- $1M+ ARR
- Knowledge graph tracks cross-functional workflows
- "Lightfast for X" becomes common phrase (Lightfast for sales, for support, etc.)

### Long-term (2029+): AI-Native Operating System for Companies

Build the foundational knowledge layer for AI-native companies where AI agents handle most workflows. Agents use Lightfast as their memory and context system. The knowledge graph understands causality and can explain why things happened. Agents coordinate through shared understanding provided by Lightfast.

We enable the future where companies run on AI orchestration powered by deep, real-time knowledge infrastructure. Lightfast is the memory layer that makes autonomous agents possible in business contexts.

**Success Indicators:**
- Major companies run primarily on AI agents using Lightfast
- Knowledge graph provides causal reasoning, not just correlation
- Agent-to-agent communication happens through Lightfast context
- Platform becomes critical infrastructure like databases or auth systems
- Contributing to cutting-edge AI research on agent coordination

---

## Integrations Roadmap

### Phase 1: MVP (Months 1-3)

**GitHub**
- Pull requests (title, description, comments, reviews, commits, files changed)
- Issues (title, description, comments, labels, assignees, linked PRs)
- Discussions (title, body, comments, categories)
- Commits (message, author, files changed, diff)
- Releases (version, notes, assets)

**Discord**
- Messages (content, author, channel, thread, reactions)
- Threads (linked to parent message)
- Reactions (emoji, users)

### Phase 2: Core Expansion (Months 3-6)

**Slack**
- Messages (content, author, channel, thread, reactions)
- Threads (linked to parent message)
- Reactions (emoji, users)

**Linear**
- Issues (title, description, comments, status, assignee, project, labels)
- Projects (name, description, status, milestones)
- Milestones (name, description, target date, progress)
- Cycles (name, dates, scope)

**Notion**
- Pages (title, content blocks, properties, comments)
- Databases (schema, rows, properties)
- Comments (content, author, page)

### Phase 3: Enterprise (Months 7-12)

**Google Drive**
- Docs (title, content, comments, suggestions)
- Sheets (title, sheet names, cell content, comments)
- Slides (title, slide content, speaker notes, comments)

**Jira**
- Issues (summary, description, comments, status, assignee, sprint)
- Projects (name, description, boards)
- Boards (name, columns, cards)

**Confluence**
- Pages (title, content, comments, labels)
- Spaces (name, description, pages)
- Comments (content, author, page)

### Future: Marketplace & Specialized (Months 13+)

**Design & Product**
- Figma (files, frames, comments, version history)
- Miro (boards, cards, comments)

**Monitoring & Analytics**
- Sentry (errors, issues, releases, performance)
- PostHog (events, dashboards, insights)
- Datadog (metrics, logs, traces)

**Infrastructure**
- PlanetScale (database schema, queries, insights)
- Vercel (deployments, logs, analytics)
- AWS/GCP/Azure (resources, logs, metrics)

**CRM & Sales**
- Salesforce (accounts, contacts, opportunities, notes)
- HubSpot (contacts, deals, tickets, notes)
- Intercom (conversations, users, articles)

**Marketplace Integrations**
Enable third-party developers to build integrations for specialized tools. Provide integration SDK, documentation, and revenue sharing (70% to developer, 30% to Lightfast).

---

## Summary

Lightfast is building the knowledge infrastructure layer for AI tools. We provide real-time semantic search across all company data sources through a universal MCP interface that works with Claude Code, Cursor, Windsurf, and custom agents.

Our target market is technical founders with small teams experiencing context fragmentation across GitHub, Discord, Slack, Linear, and Notion. We solve this with config-driven setup, real-time sync, and four interfaces: MCP for AI tools, REST API for developers, Web UI for teams, and Chat bots for everyone.

We position between low-level infrastructure (embeddings APIs, vector databases) and high-cost enterprise search (Glean). We provide a complete solution at startup-friendly pricing ($49-99/month) with Vercel-quality developer experience.

Long-term, we aim to become the standard knowledge infrastructure for AI-native companies, expanding from developer tools to universal company data platform to the foundational memory layer for autonomous AI agents.
