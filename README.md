# Lightfast

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![License: FSL-1.1](https://img.shields.io/badge/License-FSL--1.1-orange.svg)](LICENSE-FSL.md)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/issues)

A cloud-native agent execution engine that abstracts infrastructure complexity, enabling developers to focus on building AI agent applications.

🌐 **Website**: [lightfast.ai](https://lightfast.ai)
📚 **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
💬 **Chat Demo**: [chat.lightfast.ai](https://chat.lightfast.ai)  

## About

Lightfast is a production-ready agent execution platform that provides the infrastructure layer for the agent economy. We abstract away the complexity of orchestrating AI agents, managing resources, and scaling applications so you can focus on building amazing AI experiences.

### Why Lightfast?

- ⚡ **Vercel-like DX**: Deploy agents in minutes, not days
- 🔧 **State-Machine Engine**: Orchestrate complex workflows with proper resource management
- 🛡️ **Security Layer**: Built-in guards, validation, and runtime constraints
- 🏗️ **Resource Scheduling**: Intelligently manage Linux sandboxes, browser sessions, API quotas
- 🔄 **Advanced Capabilities**: Human-in-the-loop, pause/resume, ambient agents, infinitely long execution
- 📦 **Simple APIs**: Hide complexity while maintaining flexibility

## Architecture

Lightfast is a comprehensive monorepo built with pnpm workspaces and Turborepo, containing CLI tools, applications, and packages:

### Core (`core/`)

The core contains the AI agent framework and execution engine:
- **⚡ lightfast** - Core AI agent framework and execution engine
- **🤖 deus** - Advanced AI orchestration and automation framework

### Applications (`apps/`)

Production-ready Next.js applications with modern architecture:
- **🌐 www** - Marketing website and landing pages (Next.js 15 + App Router)
- **🔐 auth** - Authentication service and user management
- **💬 chat** - AI chat application demo with Convex real-time backend
- **📚 docs** - Documentation site with Fumadocs

### Database (`db/`)

Database schemas, migrations, and related utilities:
- **💬 chat** - Chat application database schemas and migrations

### API (`api/`)

API definitions, schemas, and shared utilities:
- **💬 chat** - Chat application API definitions and utilities
- **🛠️ cli** - CLI API definitions and client utilities

### Supporting Directories

Additional directories for project infrastructure:
- **🔌 api** - API definitions, schemas, and shared API utilities
- **🗄️ db** - Database migrations, schemas, and database-related scripts
- **📚 docs** - Additional documentation and guides
- **🛠️ scripts** - Build scripts, deployment utilities, and automation tools
- **📁 examples** - Example projects and usage demonstrations
  - **🤖 nextjs-ai-chatbot** - Advanced AI chatbot with Next.js
- **🌳 worktrees** - Git worktrees for parallel development branches

## Tech Stack

| Category | Technology | Purpose |
|----------|------------|----------|
| **Runtime** | Node.js 22+ | Runtime environment (enforced minimum) |
| | pnpm 10.5.2 | Package management (enforced via packageManager) |
| **Frontend** | Next.js 15 | React framework with App Router |
| | React 19 | Latest React features and performance improvements |
| | TypeScript 5.9+ | Strict type safety and developer experience |
| | Tailwind CSS v4 | Utility-first styling with new engine |
| | shadcn/ui | High-quality UI components with Radix UI primitives |
| | Jotai | Atomic state management |
| | Zustand | Persistent state management |
| **Backend** | Convex | Real-time database and backend (chat app) |
| | PostgreSQL | Primary database with PlanetScale |
| | Drizzle ORM | Type-safe SQL toolkit |
| | Redis/Upstash | Caching, rate limiting, and queuing |
| **AI/ML** | Anthropic Claude | Claude Sonnet 4 and Haiku integration |
| | OpenAI | GPT-4o and GPT-4o-mini integration |
| | Vercel AI SDK 5.0+ | Streaming, tool calling, and AI utilities |
| | Browserbase | AI browser automation and web scraping |
| | Exa | AI-powered web search |
| **DevOps** | Turborepo 2.5+ | Monorepo build system with intelligent caching |
| | Vercel | Deployment, hosting, and edge functions |
| | GitHub Actions | CI/CD pipelines |
| | ESBuild | Fast TypeScript compilation |
| **Monitoring** | Sentry | Error tracking and performance monitoring |
| | PostHog | Product analytics and feature flags |
| | BetterStack | Logging, monitoring, and alerting |
| | Vercel Analytics | Web vitals and performance metrics |
| **Security** | Arcjet | Rate limiting, bot protection, and security |
| | Clerk | Authentication and user management |
| | Zod | Runtime type validation |
| **Background Jobs** | Inngest | Workflow orchestration and background jobs |
| | QStash | Serverless message queuing |
| **Development** | Changesets | Version management and release automation |
| | Prettier | Code formatting |
| | ESLint | Code linting and quality |
| | Biome | Fast formatter and linter (additional) |

## Getting Started

### Prerequisites

- **Node.js**: >= 22.0.0 (enforced by engines field)
- **pnpm**: 10.5.2 (enforced by packageManager field)
- **Git**: Latest version for worktree and submodule support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lightfastai/lightfast.git
   cd lightfast
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment files for each app you want to run
   cp apps/www/.env.example apps/www/.env.local
   # Edit .env.local files with your configuration
   ```

4. **Start development**
   ```bash
   # Start all main apps
   pnpm run dev
   
   # Or start specific apps
   pnpm run dev:www      # Marketing site (port 4101)
   pnpm run dev:docs     # Documentation
   ```

## Available Scripts

### Development
- `pnpm dev` - Start main development servers (www, docs, auth, chat)
- `pnpm dev:www` - Marketing website (port 4101)
- `pnpm dev:auth` - Authentication service
- `pnpm dev:chat` - Chat application
- `pnpm dev:docs` - Documentation site
- `pnpm dev:email` - Email development server
- `pnpm dev:auth+docs` - Run multiple apps together

### Building
- `pnpm build` - Build all applications (Turbo orchestrated)
- `pnpm build:www` - Build marketing site only
- `pnpm build:auth` - Build auth service only
- `pnpm build:chat` - Build chat app only
- `pnpm build:docs` - Build documentation only

### Code Quality
- `pnpm lint` - Lint all packages with caching
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm format` - Check code formatting (Prettier)
- `pnpm format:fix` - Fix formatting issues automatically
- `pnpm typecheck` - Run TypeScript type checking across all packages
- `pnpm lint:ws` - Check workspace dependencies with Sherif

### Database
- `pnpm db:migrate` - Run database migrations
- `pnpm db:migrate:generate` - Generate migration files  
- `pnpm db:studio` - Open Drizzle database studio

### Utilities
- `pnpm clean` - Clean all build artifacts and caches
- `pnpm clean:workspaces` - Clean Turbo workspaces only
- `pnpm ui` - Manage shadcn/ui components
- `pnpm brain` - Run evaluation scripts
- `pnpm vercel:link` - Link monorepo to Vercel

### Release Management
- `pnpm changeset` - Create a changeset for versioning
- `pnpm version-packages` - Version packages using changesets
- `pnpm release` - Publish packages to npm

## Environment Configuration

Each application uses `@t3-oss/env-nextjs` for type-safe environment variable validation. Environment configurations are defined in each app's `src/env.ts` file.

### Common Environment Variables

```bash
# Node Environment
NODE_ENV=development

# Vercel (automatically set in Vercel deployments)
VERCEL_ENV=development  # development | preview | production

# Database (if using database features)
DATABASE_URL=your-database-url

# Authentication (if using auth features)
CLERK_SECRET_KEY=your-clerk-secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key

# Observability
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
BETTERSTACK_SOURCE_TOKEN=your-betterstack-token

# Security
ARCJET_KEY=your-arcjet-key
```

### App-Specific Configuration

Each application may require additional environment variables. Check each app's README for specific requirements:
- `apps/www/README.md` - Marketing site configuration
- `apps/chat/README.md` - Chat app configuration

## Project Structure

```
lightfast/
├── core/                      # Core AI agent framework and orchestration
│   ├── lightfast/            # AI agent framework and execution engine
│   └── deus/                 # Advanced AI orchestration and automation
├── apps/                      # Next.js applications
│   ├── www/                  # Marketing website (port 4101)
│   ├── auth/                 # Authentication service and user management
│   ├── chat/                 # AI chat application with Convex
│   └── docs/                 # Documentation site with Fumadocs
├── db/                        # Database schemas and migrations
│   └── chat/                 # Chat application database schemas
├── api/                       # API definitions and shared utilities
│   ├── chat/                 # Chat application API definitions
│   └── cli/                  # CLI API definitions and utilities
├── packages/                  # Shared packages (@repo/*)
│   ├── ui/                   # UI component library (shadcn/ui + Radix)
│   ├── lib/                  # Shared utilities and helper functions
│   ├── ai/                   # AI SDK integrations and utilities
│   ├── ai-tools/             # AI browser automation with Browserbase
│   ├── email/                # Email templates and utilities
│   ├── site-config/          # Site configuration utilities
│   ├── url-utils/            # URL manipulation and validation
│   └── vercel-config/        # Vercel deployment configurations
├── vendor/                    # Third-party service integrations (@vendor/*)
│   ├── analytics/            # PostHog and Vercel Analytics
│   ├── clerk/                # Authentication with Clerk
│   ├── db/                   # Database layer (Drizzle + PlanetScale)
│   ├── email/                # Email services with Resend
│   ├── inngest/              # Background job processing
│   ├── next/                 # Next.js configuration and utilities
│   ├── observability/        # Sentry and BetterStack monitoring
│   ├── security/             # Arcjet rate limiting and security
│   ├── storage/              # File storage with Vercel Blob
│   └── upstash/              # Redis, KV, and QStash integration
├── internal/                  # Development tooling configurations
│   ├── eslint/               # ESLint configurations (@repo/eslint-config)
│   ├── prettier/             # Prettier configurations (@repo/prettier-config)
│   └── typescript/           # TypeScript configurations (@repo/typescript-config)
├── docs/                      # Additional documentation and guides
├── examples/                  # Example projects and demonstrations
│   └── nextjs-ai-chatbot/    # Advanced AI chatbot with Next.js
├── scripts/                   # Build scripts and automation tools
├── worktrees/                 # Git worktrees for parallel development
├── .changeset/                # Changesets configuration for releases
├── .github/                   # GitHub Actions and CI/CD workflows
├── .lightfast/                # Lightfast configuration and cache
├── .turbo/                    # Turborepo cache and metadata
├── .vercel/                   # Vercel deployment configuration
├── package.json               # Root workspace configuration
├── pnpm-workspace.yaml        # pnpm workspace definition
├── turbo.json                 # Turborepo task configuration
├── CLAUDE.md                  # Development instructions for Claude
├── SPEC.md                    # Product specification and vision
└── README.md                  # This file
```

## Development Workflows

### Working with the Monorepo

1. **Install dependencies**: `pnpm install` (installs all workspace dependencies)
2. **Run specific app**: `pnpm dev:www` or `pnpm dev:chat`
3. **Build specific app**: `pnpm build:www` (uses Turbo filters)
4. **Add dependency to specific app**: `pnpm add package-name --filter @lightfast/www`
5. **Run script in specific app**: `pnpm --filter @lightfast/www run script-name`

### Package Naming Conventions

The monorepo uses consistent naming conventions across workspaces:

- **Apps**: `@lightfast/[app-name]` (e.g., `@lightfast/www`, `@lightfast/chat`)
- **Packages**: `@repo/[package-name]` (e.g., `@repo/ui`, `@repo/lib`)
- **Vendor**: `@vendor/[service-name]` (e.g., `@vendor/db`, `@vendor/auth`)
- **Core**: `@lightfastai/[tool-name]` (e.g., `@lightfastai/cli`, `@lightfastai/compiler`)

### Workspace Dependencies

All workspace dependencies use `workspace:*` protocol for internal packages:
```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@vendor/db": "workspace:*"
  }
}
```

### Catalog Dependencies

The workspace uses pnpm's catalog feature for consistent versioning across packages:
```yaml
# pnpm-workspace.yaml
catalog:
  '@tanstack/react-query': ^5.80.7
  'next': ^15.4.0
  'react': 19.1.0
  'typescript': ^5.8.2
  # ... more packages
```

Packages can reference catalog versions:
```json
{
  "dependencies": {
    "next": "catalog:",
    "react": "catalog:react19"
  }
}
```

### Adding New Components

```bash
# Add shadcn/ui component to the UI package
pnpm ui add button

# Generate new React component with Turbo
pnpm --filter @repo/ui generate:component

# The component will be available across all apps
```

### Code Quality Workflow

```bash
# Before committing
pnpm lint:fix     # Fix linting issues
pnpm format:fix   # Fix formatting
pnpm typecheck    # Check types
```

## Deployment

### Vercel Deployment

Each application can be deployed separately to Vercel:

1. **Connect to Vercel**
   ```bash
   pnpm vercel:link
   ```

2. **Configure build settings** (in Vercel dashboard or vercel.json):
   - Build command: `pnpm build:www` (or specific app)
   - Output directory: `apps/www/.next` (or specific app)
   - Root directory: `./` (monorepo root)

3. **Set environment variables** in Vercel dashboard

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment-Specific Deployments

- **Development**: Local development servers
- **Preview**: Vercel preview deployments (pull requests)
- **Production**: Vercel production deployments (main branch)

## API Documentation

Lightfast provides several APIs for agent execution and management:

- **Agent API**: Create, manage, and execute agents
- **Workflow API**: Orchestrate complex multi-step workflows  
- **Resource API**: Manage sandboxes, browser sessions, and quotas
- **Webhook API**: Handle real-time events and notifications

Full API documentation is available at [lightfast.ai/docs/api](https://lightfast.ai/docs/api).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Set up environment variables for the apps you're working on
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes and test thoroughly
6. Run code quality checks: `pnpm run lint && pnpm run typecheck`
7. Submit a pull request

### Code Style

- **ESLint**: Configured with `@repo/eslint-config`
- **Prettier**: Configured with `@repo/prettier-config`
- **TypeScript**: Strict mode enabled across all packages
- **Conventional Commits**: Use conventional commit messages

## Community

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **Discord**: [Join our community](https://discord.gg/YqPDfcar2C)
- **Twitter**: [@lightfastai](https://x.com/lightfastai)

## License

Lightfast uses a dual licensing approach:

All components are licensed under [Apache License 2.0](LICENSE) - a permissive open source license.

**For Users**: You're covered by Apache-2.0 for all Lightfast components - use freely in commercial and non-commercial projects.

See [LICENSING.md](LICENSING.md) for complete details.

## Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing code or documentation

---

**Built with ❤️ by the Lightfast team**
