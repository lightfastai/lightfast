# Lightfast

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/issues)

Lightfast is the memory layer for software teams. We help engineers and AI agents search everything your engineering org knows—code, PRs, docs, decisions—with answers that cite their sources.

**Website**: [lightfast.ai](https://lightfast.ai) | **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs) | **Demo**: [chat.lightfast.ai](https://chat.lightfast.ai)

## About

Lightfast indexes your engineering history so engineers and AI agents can search by meaning, get answers with sources, and trace decisions across your codebase.

Ask questions like:
- "What broke in the last deployment?"
- "Who owns the authentication service?"
- "Why was this architecture decision made?"

Get accurate answers with citations—across your entire engineering ecosystem, in real time.

## What We Remember

| Category | Sources | Examples |
|----------|---------|----------|
| **Code & Changes** | GitHub, GitLab, Bitbucket | Pull requests, commits, code reviews, discussions |
| **Deployments & Infrastructure** | Vercel, Railway, Pulumi, Terraform | Deployment events, build logs, environment changes |
| **Incidents & Errors** | Sentry, PagerDuty | Error events, incident timelines, resolutions, post-mortems |
| **Decisions & Context** | All sources | Why decisions were made, what was discussed, who was involved |
| **People & Ownership** | All sources | Who owns what, who worked on what, who has context |

## API

Four routes power everything:

```
POST /v1/search   — Search and rank results with rationale and highlights
POST /v1/contents — Get full documents, metadata, and relationships
POST /v1/similar  — Find related content based on meaning
POST /v1/answer   — Get synthesized answers with citations (streaming)
```

Available via REST API and MCP tools for agent runtimes. Full documentation at [lightfast.ai/docs/api-reference](https://lightfast.ai/docs/api-reference/overview).

## Principles

- **Search by meaning**: Understand intent, not just match keywords
- **Always cite sources**: Every answer shows where it came from
- **Privacy by default**: Your data stays yours. Complete tenant isolation
- **Continuously improve**: Measure quality, learn from usage, adapt over time

---

## Development

This is a pnpm monorepo built with Turborepo containing the Lightfast platform.

### Prerequisites

- **Node.js**: >= 22.0.0
- **pnpm**: 10.5.2

### Quick Start

```bash
# Clone and install
git clone https://github.com/lightfastai/lightfast.git
cd lightfast
pnpm install

# Set up environment
cp apps/www/.env.example apps/www/.env.local

# Start development
pnpm dev:www      # Marketing site (port 4101)
pnpm dev:console  # Main product (port 4107)
pnpm dev:docs     # Documentation
```

### Project Structure

```
lightfast/
├── core/                 # AI agent framework and orchestration
│   ├── lightfast/       # Core execution engine
│   └── console/         # AI orchestration framework
├── apps/                 # Next.js applications
│   ├── console/         # Main product (port 4107)
│   ├── www/             # Marketing website (port 4101)
│   ├── auth/            # Authentication service
│   ├── chat/            # AI chat demo
│   └── docs/            # Documentation (Fumadocs)
├── api/                  # API definitions (tRPC, schemas)
├── db/                   # Database schemas (Drizzle)
├── packages/             # Shared packages (@repo/*)
├── vendor/               # Third-party integrations (@vendor/*)
└── internal/             # Dev tooling configs
```

### Common Commands

```bash
# Development
pnpm dev:console          # Main product
pnpm dev:www              # Marketing site

# Build & Quality
pnpm build:console        # Build specific app
pnpm lint && pnpm typecheck

# Database (from db/console/)
pnpm db:generate          # Generate migrations
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle studio
```

### Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 22+, pnpm 10.5.2 |
| **Frontend** | Next.js 15, React 19, TypeScript 5.9+, Tailwind CSS v4 |
| **Backend** | Convex, PostgreSQL (PlanetScale), Drizzle ORM, Redis (Upstash) |
| **AI/ML** | Anthropic Claude, OpenAI, Vercel AI SDK 5.0+, Pinecone |
| **DevOps** | Turborepo, Vercel, GitHub Actions |
| **Auth** | Clerk |

## Contributing

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Run quality checks: `pnpm lint && pnpm typecheck`
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Community

- **Discord**: [Join our community](https://discord.gg/YqPDfcar2C)
- **Twitter**: [@lightfastai](https://x.com/lightfastai)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)

## License

Licensed under [Apache License 2.0](LICENSE). See [LICENSING.md](LICENSING.md) for details.

---

**Built with care by the Lightfast team**
