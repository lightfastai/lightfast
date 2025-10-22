# Lightfast Specification

## Mission
Build the orchestration layer for technical founders scaling startups from 0 → $100M ARR - bridging the gap between founder intent and executed workflows across codebase, team, and tools.

## Product Stack

### Lightfast Core (Operating Layer)
The cloud-native agent execution engine that powers everything:

- **State-Machine Engine**: Orchestrate complex agent workflows with proper resource management
- **Resource Scheduling**: Intelligently manage constrained resources (Linux sandboxes, Browserbase sessions, API quotas)
- **Context Understanding**: Codebase + business content understanding via embedding models
- **Multi-Model Access**: Unified access to all frontier models (Claude, GPT, Gemini, Grok, xAI)
- **Agent Cloud / BYOC**: Flexible execution - use our cloud or bring your own compute
- **Security Layer**: Built-in guards, validation, and runtime constraints
- **Advanced Capabilities**: Human-in-the-loop workflows, pause/resume, ambient agents, infinitely long execution
- **Developer SDK**: Simple APIs that hide complexity while maintaining flexibility

### Deus (Application Layer)
The chat-based orchestration platform for startups:

- **Conversational Interface**: Manus-style chat experience for deep agentic workflows
- **Deep Context Graph**: Unified understanding of codebase + business content (docs, issues, analytics, etc.)
- **Smart Orchestration**: Natural language → executable workflows across entire company
- **Deep Tool Integration**: Semantic understanding of workflows, not just trigger-action
- **Code Tool Native**: Integrates with Claude Code, Codex, Cursor for orchestrated development
- **Team Collaboration**: Non-technical team members can execute technical workflows

## Target Market

### Primary: Technical Founders with Small Teams (1-10 people)

**Profile:**
- Strong DX/startup dev UX focus
- Founder is technical, team is mixed technical/non-technical
- Limited resources, high velocity needed

**Core Pain Points:**
- Context fragmentation across tools (Linear, GitHub, Notion, Slack, etc.)
- Engineering bottlenecked on every workflow
- Non-technical team can't self-serve answers
- Spending 60% of time on integration/data pulls instead of building product

**What They Need:**
- Make small team feel like 50-person company
- Unblock non-technical team from depending on engineering
- Deep integrations that understand context, not surface-level automations

### Secondary: Developers building AI agent products (v0.dev, CodeRabbit, Lovable, HumanLayer)

**Profile:**
- Building agent-first products
- Need robust execution infrastructure
- Want to focus on agent logic, not orchestration complexity

**Positioning for this segment:** Infrastructure layer for the agent economy

## Integration Ecosystem

### Deep Integrations (Not Surface-Level)

**Project Management:**
- Linear, Jira
- Semantic understanding of issues, milestones, dependencies

**Business Context Aggregation:**
- Google Drive, Confluence, Notion
- Understand company knowledge graph

**Dev Workflows:**
- GitHub, Vercel, PostHog, Sentry, PlanetScale
- Correlate deployments → errors → analytics → code

**Code Tools:**
- Claude Code, Codex, Cursor
- Orchestrator can spawn code agents for execution

**Communication:**
- Slack, Discord
- Context-aware notifications and responses

### Architecture Philosophy

```
┌─────────────────────────────────────────────┐
│  Deus (Chat + Orchestration)                │
│  "Why did signups drop 20%?"                │
│  → Orchestrates across tools                │
│  → Returns answer with full context         │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  Lightfast Core (Operating Layer)           │
│  - Codebase understanding (embeddings)      │
│  - Business content understanding           │
│  - Multi-model orchestration                │
│  - Agent Cloud execution                    │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  Integration Layer                          │
│  Linear + GitHub + PostHog + Sentry + ...   │
│  (Deep semantic understanding)              │
└─────────────────────────────────────────────┘
```

## Competitive Advantage

### vs Zapier/Make (no-code automation)
- AI-native workflows that understand intent, not just trigger-action
- Deep semantic understanding of context
- Can execute complex multi-step reasoning

### vs n8n (low-code automation)
- Conversational interface, no workflow building
- Auto-healing, learns from production
- Codebase + business context awareness

### vs Claude/ChatGPT (general AI)
- Purpose-built for startup workflows with stateful context
- Actually executes, not just suggests
- Deep tool integrations with semantic understanding

### vs Cursor/Codex (code assistants)
- Not just code, orchestrates entire company workflows
- Connects codebase to business context (issues, analytics, docs)
- Multi-agent orchestration across tools

### Core Differentiation
**"Vercel-like DX" for agent orchestration** + **codebase understanding** + **deep tool integrations** + **multi-model access**

## Use Cases

### For Technical Founders

**Product Development:**
- "Deploy feature flags for premium tier" → orchestrates GitHub + Vercel + LaunchDarkly
- "Fix the auth bug from Sentry" → spawns Claude Code agent, debugs, creates PR
- "Set up Stripe billing with usage-based pricing" → configures Stripe + implements code + deploys

**Team Unblocking:**
- PM: "What's blocking the auth milestone?" → pulls Linear + GitHub + Slack context
- PM: "Why did signups drop 20% last week?" → correlates PostHog + Sentry + GitHub deploys
- Support: "Escalate critical bugs" → Sentry → Linear → Slack notification with full context

**Context Retrieval:**
- "What features are we shipping this week?" → pulls from Linear with GitHub PR status
- "Show me all high-priority bugs assigned to backend" → Linear + Sentry correlation
- "What's our churn rate trending?" → queries PostHog with business context

### For Scaling Startups

**Cross-Functional Workflows:**
- Sales: "Get all leads from last week with >$10k ARR potential" → CRM + product usage data
- Marketing: "Create deployment announcement" → GitHub releases + changelog + tweet draft
- Operations: "Generate weekly metrics report" → PostHog + PlanetScale + Notion doc

## Business Model

### Pricing Tiers

**Free Tier:**
- 5 integrations
- 100 workflow runs/month
- Community support
- Access to all models

**Pro ($29/mo):**
- Unlimited integrations
- 1,000 workflow runs/month
- Priority support
- Advanced context understanding

**Team ($99/mo):**
- Everything in Pro
- Shared workflows
- Team collaboration
- Audit logs
- Usage analytics

**Enterprise (Custom):**
- Everything in Team
- SSO / SAML
- Private integrations
- Custom model hosting (BYOC)
- SLA with dedicated support
- White-label options

### Revenue Model Evolution

**Year 1:** SaaS subscriptions (70%), usage-based (30%)
**Year 2:** SaaS (50%), usage-based (30%), enterprise (20%)
**Year 3:** SaaS (40%), usage-based (25%), enterprise (30%), marketplace (5%)

### Marketplace (Future)
- **Integration developers**: Build deep integrations, 70% revenue share
- **Workflow templates**: Pre-built workflows for common use cases
- **MCP server hosting**: $49/mo per custom server

## Product Principles

### 1. Context is Everything
- Unified knowledge graph: codebase + business content + tool state
- Suggestions get smarter over time
- Multi-agent context management to prevent degradation

### 2. Deep Integrations, Not Surface-Level
- Semantic understanding of workflows
- Correlate data across tools intelligently
- Not just trigger-action, full context awareness

### 3. AI-Native, Not No-Code
- Conversational interface for everything
- Let users describe intent, Deus figures out how
- No visual workflow builders

### 4. Fast Iteration for Teams
- Unblock non-technical team from engineering dependencies
- Self-serve answers and workflows
- Engineering can focus on building product

### 5. Production is the Benchmark
- Optimize for real user success, not vanity metrics
- Every failure becomes a learning opportunity
- Auto-healing and error recovery

### 6. Security by Design
- Sandboxed execution for all workflows
- Scoped credentials per integration
- Audit logs for compliance
- Human-in-the-loop for critical actions

## Success Metrics

### Phase 1: Product-Market Fit (Months 0-6)
- **Primary**: 100 active founders, 80% MoM retention, 50% create custom workflows
- **Secondary**: Average 5 integrations/user, 15 workflows executed/user/week
- **Qualitative**: "I can't imagine scaling my startup without Lightfast"

### Phase 2: Team Adoption (Months 6-18)
- **Primary**: 1,000 active users, $10k MRR, non-technical team adoption >30%
- **Secondary**: 500 workflows created, 100k runs/month, 10+ deep integrations
- **Qualitative**: "Our PM/support team is unblocked from engineering"

### Phase 3: Platform Growth (Months 18-36)
- **Primary**: $100k MRR, 10k users, 50+ deep integrations
- **Secondary**: 10k+ workflows, 1M+ runs/month, marketplace launch
- **Qualitative**: "We chose [tool] because it has deep Lightfast integration"

### Phase 4: Category Leader (Year 3+)
- **Primary**: $1M+ MRR, 100k users, category leader in "AI orchestration platforms"
- **Secondary**: 100+ integration partners, 50+ enterprise customers
- **Qualitative**: "Lightfast" becomes a verb for orchestration

## Long-Term Vision

### Near-term (2025-2026): Startup Orchestration Layer
Become the standard way technical founders scale startups - from idea to $100M ARR, orchestrated by AI.

### Mid-term (2027-2028): Universal Work Automation
Expand beyond startup workflows to any professional workflow. Every digital tool becomes AI-orchestrable.

### Long-term (2029+): AGI Execution Brain
Use commercial success to fund AGI research - building the "Jarvis execution brain" that can orchestrate arbitrary tasks with human-level reasoning across any domain.

**Vision:** "Make every startup feel like they have a 50-person team, even when they're just 3 people in a garage."