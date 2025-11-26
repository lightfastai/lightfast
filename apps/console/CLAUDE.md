# Console - AI Workflow Orchestration Platform

## Mission

Build a general-purpose agent orchestration platform that connects AI to any tool via natural language, enabling anyone to automate complex workflows without code.

## Core Goals

### Product Architecture

- **Integration Layer**: Universal MCP-first protocol supporting 500+ tools (APIs, CLIs, databases, internal systems)
- **Workflow Engine**: AI-native orchestration with multi-step workflows, conditional logic, and error recovery
- **Agent Intelligence**: Natural language → executable workflows with context awareness and learning from failures
- **Sandbox Execution**: Secure, isolated environments (Browserbase, Fly.io) for safe tool execution
- **Marketplace Platform**: Community-driven integration and workflow ecosystem with revenue sharing
- **Developer SDK**: Simple APIs for building custom integrations and hosting MCP servers

### Target Market

- **Phase 1 (Current)**: Dev founders shipping products (v0.dev users, indie hackers, technical founders)
- **Phase 2**: Engineering teams at startups (5-50 person companies)
- **Phase 3**: Integration developers (SaaS companies wanting AI-native integrations)
- **Phase 4**: Enterprises with custom internal tools
- **Positioning**: "Vercel for AI agent workflows" - the platform where any tool becomes AI-orchestrable

### Competitive Advantage

- **vs Zapier/Make** (no-code automation): AI-native workflows that understand intent, not just trigger-action
- **vs n8n** (low-code automation): Conversational interface, auto-healing, learns from production
- **vs Vercel Integrations**: Not just connections, but autonomous orchestration across tools
- **vs Claude/ChatGPT** (general AI): Purpose-built for developer workflows with stateful context
- **Core differentiation**: MCP-first architecture + AI workflow compilation + marketplace ecosystem

### Business Model

#### Phase 1-2: Free to Paid (SaaS)

- **Free**: 5 integrations, 100 workflow runs/month
- **Pro** ($29/mo): Unlimited integrations, 1000 runs/month, priority support
- **Team** ($99/mo): Shared workflows, collaboration, audit logs
- **Enterprise** (Custom): SSO, private integrations, SLA, dedicated support

#### Phase 3-4: Platform Economics

- **Marketplace Revenue**: 70% to integration developers, 30% platform fee
- **Usage-Based**: Additional workflow runs beyond plan limits ($0.10/run)
- **Hosting**: MCP server hosting for integration developers ($49/mo per server)
- **White-Label**: License Console for enterprises ($50k-$200k/year)

#### Revenue Model Evolution

- **Year 1**: SaaS subscriptions (80%), usage (20%)
- **Year 2**: SaaS (60%), marketplace (25%), usage (15%)
- **Year 3**: SaaS (40%), marketplace (35%), enterprise (20%), usage (5%)

### Long-Term Vision

#### Near-term (2025-2026): Developer Workflow Automation

Become the standard way dev teams ship products - from idea to production, orchestrated by AI.

#### Mid-term (2027-2028): Universal Work Automation

Expand beyond dev tools to any professional workflow - sales, marketing, finance, operations. 1000+ integrations, 100k+ users.

#### Long-term (2029+): Ambient AI Operating System

Every digital tool becomes AI-orchestrable via MCP. Console becomes the execution layer for personal and business AI agents.

**Vision**: "Jarvis for everyone" - your AI assistant that can actually do things across your entire digital world.

### Strategic Position in Lightfast Ecosystem

- **Lightfast Core**: Agent execution engine (infrastructure)
- **Console**: Agent orchestration platform (application layer)
- **Synergy**: Console runs on Lightfast's execution engine, proving the platform's capabilities while generating revenue to fund core R&D

### Ultimate Goal

Use commercial success from Console to fund Lightfast's AGI research - building the reasoning and execution capabilities for human-level AI that can orchestrate arbitrary tasks across any domain.

---

## Product Principles

### 1. MCP is the Universal Language

Every integration speaks Model Context Protocol. Build adapters for legacy APIs, but push ecosystem toward MCP-native.

### 2. AI-Native, Not No-Code

Don't make users build workflows in visual editors. Let them describe intent, Console figures out how.

### 3. Context Over Configuration

Console understands your project, your team, your patterns. Suggestions get smarter over time.

### 4. Marketplace-First Growth

Community-contributed integrations and workflows accelerate adoption faster than we could build alone.

### 5. Production is the Benchmark

Following eval philosophy - optimize for real user success, not vanity metrics. Every failure becomes a learning opportunity.

### 6. Security by Design

Sandboxed execution, scoped credentials, audit logs, human-in-the-loop for critical actions.

---

## Success Metrics

### Phase 1: Product-Market Fit (Months 0-6)

- **Primary**: 100 active users, 50% create custom workflows, 80% MoM retention
- **Secondary**: Average 3 integrations/user, 10 workflows executed/user/week
- **Qualitative**: Users say "I can't imagine shipping without Console"

### Phase 2: Integration Ecosystem (Months 6-18)

- **Primary**: 50 integrations, 10 community-built, 1000 active users
- **Secondary**: $10k MRR, 500 workflows created, 100k runs/month
- **Qualitative**: First integration developer makes $1k/month from marketplace

### Phase 3: Marketplace Momentum (Months 18-36)

- **Primary**: 200+ integrations, 50+ developers, $100k MRR, 10k users
- **Secondary**: $100k/mo marketplace GMV, 10k+ workflows, 1M+ runs/month
- **Qualitative**: Companies choose tools based on Console integration availability

### Phase 4: Platform Leader (Year 3+)

- **Primary**: 500+ integrations, 100k users, $1M+ MRR
- **Secondary**: Category leader in "AI workflow platforms"
- **Qualitative**: "Console" becomes a verb ("just Console that workflow")

---

## Risk Mitigation

### Technical Risks

- **MCP adoption slow**: Build adapters for top 100 tools ourselves
- **LLM workflow hallucinations**: Validation engine + human-in-the-loop + learning system
- **Multi-tool reliability**: Circuit breakers, retries, transactional workflows
- **Security vulnerabilities**: Sandboxed execution, regular audits, bug bounty

### Market Risks

- **Zapier defensively responds**: Our AI-native workflows are fundamentally different
- **Claude/OpenAI build similar**: We have MCP ecosystem head start + developer focus
- **Integration partners block us**: Build around them, community will build alternatives
- **Low willingness to pay**: Free tier drives adoption, enterprise drives revenue

### Execution Risks

- **Scope creep**: Ship Phase 1 with 6 tools, prove value before expanding
- **Marketplace chicken-egg**: Seed with 20 verified integrations before opening to community
- **Technical debt**: Built on Lightfast's proven execution engine, not building from scratch
- **Team capacity**: Focus ruthlessly on developer workflows, not general automation

---

## Tagline

**"Make every tool AI-orchestrable. Make every workflow conversational. Make shipping products as easy as describing what you want."**

---

## GitHub App Configuration

### Development Setup

**GitHub App Name:** `Lightfast Console App Connector Dev`

**Homepage URL:** `http://localhost:3024`

**Callback URL:** `http://localhost:3024/api/github/user-authorized`

**Setup URL:** `http://localhost:3024/api/github/app-installed`

**Webhook URL:** `https://your-ngrok-url.ngrok.io/api/github/webhooks`

**Installation:** Only on this account (for testing)

**Note:** Port 3024 is the Vercel microfrontends proxy that routes to the console app (port 4107).

### Production Setup

**GitHub App Name:** `Lightfast Console`

**Homepage URL:** `https://console.lightfast.com`

**Callback URL:** `https://console.lightfast.com/api/github/user-authorized`

**Webhook URL:** `https://console.lightfast.com/api/github/webhooks`

**Installation:** Any account

### Permissions Required

**Repository Permissions:**
- Contents: Read & Write (read/write repository files)
- Metadata: Read-only (repository metadata - auto-granted)
- Pull requests: Read & Write (manage PRs)
- Workflows: Read & Write (trigger GitHub Actions)

**Organization Permissions:**
- Members: Read-only (list org members)

**Account Permissions (User OAuth):**
- Email addresses: Read-only (get user email)

### Settings

**User Authorization:**
- ✅ Expire user authorization tokens (provides refresh tokens)
- ☐ Request user authorization (OAuth) during installation (we handle separately)
- ☐ Enable Device Flow (not needed)

**Webhook:**
- ✅ Active (receive events)
- Webhook Secret: Set in environment variables (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

**Where to Install:**
- Development: Only on this account
- Production: Any account

### Environment Variables

After creating the GitHub App, add these to your `.env`:

```bash
# GitHub App Credentials
GITHUB_APP_ID=123456  # From app settings page
GITHUB_CLIENT_ID=Iv1.abc123def456  # From app settings
GITHUB_CLIENT_SECRET=your-client-secret  # Generate in app settings
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"  # Generate and download .pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret  # Generate secure random string

# App URLs (adjust for dev/prod)
NEXT_PUBLIC_APP_URL=http://localhost:4104  # or https://console.lightfast.com
```

### Key Notes

- **Private Key:** Generate in GitHub App settings → "Generate a private key" → Download `.pem` file
- **Client Secret:** Generate in GitHub App settings under "Client secrets"
- **App ID:** Found at top of GitHub App settings page
- **Webhook Secret:** Use cryptographically secure random string (see command above)
- **Separate Apps:** Use different GitHub Apps for development and production



### What are we building? (Jeevans words)
Consider this: an Agent is an individual contributor with limited context about it's environment. The context is subjucated to (1, MaxToken_x]. There is clear degradation when we polute the token graph with unnecesary context.
Lightfast is focusing on pure of context construction and engineering in a multi-agent setting.
While developing software using Claude Code, a core concern is the practice of "multi-agent" environments. How do we get "multiple" agents to communicate effectively.
We have seen interesting examples of this with the advent of "subagents" in Claude Code. The introduction of subagents also us to tap into this hierarchy of multi-agent communication,
however, there are several important factors such as fine-grain system control of the context graph. If we were to build subagents, we need to ensure context degradation doesn't occur
in the main agent. 
