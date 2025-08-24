# Lightfast

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1--Apache--2.0-blue.svg)](LICENSE.md)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/issues)

A cloud-native agent execution engine that abstracts infrastructure complexity, enabling developers to focus on building AI agent applications.

🌐 **Website**: [lightfast.ai](https://lightfast.ai)  
📚 **Documentation**: [docs.lightfast.ai](https://docs.lightfast.ai)  
🎮 **Playground**: [playground.lightfast.ai](https://playground.lightfast.ai)  
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

Lightfast is a monorepo containing multiple applications and packages:

### Core (`core/`)

- **⚡ lightfast** - Core AI agent framework and execution engine

### Applications (`apps/`)

- **🌐 www** - Marketing website and landing pages
- **🔐 auth** - Authentication service and user management  
- **☁️ cloud** - Main platform application
- **🎮 playground** - Interactive agent playground and testing environment
- **🧪 experimental** - Experimental features and prototypes
- **💬 chat** - AI chat application demo
- **📚 docs** - Documentation site

### Packages (`packages/`)

- **🎨 ui** - Shared UI component library based on shadcn/ui
- **⚙️ lib** - Shared utilities and helper functions
- **📧 email** - Email templates and sending utilities
- **🤖 ai-tools** - AI browser automation and tool utilities
- **🔧 site-config** - Shared configuration utilities

### Vendor (`vendor/`)

Third-party integrations and services:
- **📊 analytics** - PostHog and Vercel Analytics
- **🔐 clerk** - Authentication with Clerk
- **📧 email** - Email services with Resend
- **🔍 inngest** - Background job processing
- **📝 observability** - Sentry and BetterStack monitoring
- **🛡️ security** - Arcjet rate limiting and security
- **⚡ upstash** - Redis and rate limiting

## Tech Stack

| Category | Technology | Purpose |
|----------|------------|----------|
| **Frontend** | Next.js 15 | React framework with App Router |
| | React 19 | Latest React features and performance |
| | TypeScript | Type safety and developer experience |
| | Tailwind CSS v4 | Utility-first styling |
| | shadcn/ui | High-quality UI components |
| **Backend** | Node.js 22+ | Runtime environment |
| | Convex | Real-time database (chat app) |
| | PostgreSQL | Primary database |
| | Redis | Caching and rate limiting |
| **AI/ML** | Anthropic Claude | Claude Sonnet 4 integration |
| | OpenAI | GPT-4o integration |
| | Vercel AI SDK | Streaming and AI utilities |
| **DevOps** | Vercel | Deployment and hosting |
| | Turborepo | Build system and caching |
| | pnpm | Package management |
| **Monitoring** | Sentry | Error tracking |
| | PostHog | Analytics |
| | BetterStack | Logging and monitoring |

## Getting Started

### Prerequisites

- **Node.js**: >= 22.0.0
- **pnpm**: 10.5.2 (enforced by packageManager)
- **Git**: Latest version

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
   cp apps/cloud/.env.example apps/cloud/.env.local
   # Edit .env.local files with your configuration
   ```

4. **Start development**
   ```bash
   # Start all main apps
   pnpm run dev
   
   # Or start specific apps
   pnpm run dev:www      # Marketing site (port 4101)
   pnpm run dev:cloud    # Main cloud app
   pnpm run dev:playground # Playground
   pnpm run dev:docs     # Documentation
   ```

## Available Scripts

### Development
- `pnpm run dev` - Start main development servers (www, app, auth)
- `pnpm run dev:www` - Marketing website (localhost:4101)
- `pnpm run dev:cloud` - Main platform application
- `pnpm run dev:auth` - Authentication service
- `pnpm run dev:playground` - Agent playground
- `pnpm run dev:experimental` - Experimental features
- `pnpm run dev:chat` - Chat application
- `pnpm run dev:docs` - Documentation site

### Building
- `pnpm run build` - Build all applications
- `pnpm run build:www` - Build marketing site only
- `pnpm run build:cloud` - Build cloud app only
- `pnpm run build:auth` - Build auth service only
- `pnpm run build:playground` - Build playground only
- `pnpm run build:experimental` - Build experimental features only
- `pnpm run build:chat` - Build chat app only
- `pnpm run build:docs` - Build documentation only

### Code Quality
- `pnpm run lint` - Lint all packages
- `pnpm run lint:fix` - Fix linting issues
- `pnpm run format` - Check code formatting
- `pnpm run format:fix` - Fix formatting issues
- `pnpm run typecheck` - Run TypeScript type checking
- `pnpm run lint:ws` - Check workspace dependencies

### Database
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:migrate:generate` - Generate migration files
- `pnpm run db:studio` - Open database studio

### Utilities
- `pnpm run clean` - Clean all build artifacts
- `pnpm run clean:workspaces` - Clean turbo workspaces
- `pnpm run ui` - Manage UI components

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
- `apps/cloud/README.md` - Main cloud app configuration  
- `apps/playground/README.md` - Playground configuration
- `apps/chat/README.md` - Chat app configuration

## Project Structure

```
lightfast/
├── core/                      # Core framework
│   └── lightfast/            # AI agent framework and execution engine
├── apps/                      # Applications
│   ├── www/                  # Marketing website
│   ├── cloud/                # Main platform app
│   ├── auth/                 # Authentication service
│   ├── playground/           # Interactive playground
│   ├── experimental/         # Experimental features
│   ├── chat/                 # Chat application
│   └── docs/                 # Documentation site
├── packages/                  # Shared packages
│   ├── ui/                   # UI component library
│   ├── lib/                  # Shared utilities
│   ├── ai-tools/             # AI browser automation tools
│   ├── email/                # Email utilities
│   ├── site-config/          # Site configuration
│   └── url-utils/            # URL utilities
├── vendor/                    # Third-party integrations
│   ├── analytics/            # PostHog, Vercel Analytics
│   ├── auth/                 # Authentication services
│   ├── email/                # Email services
│   ├── observability/        # Monitoring and logging
│   └── security/             # Security services
├── internal/                  # Internal tooling
│   ├── eslint/               # ESLint configurations
│   ├── prettier/             # Prettier configurations
│   └── typescript/           # TypeScript configurations
├── scripts/                   # Development scripts
├── submodules/                # Git submodules
│   └── chat/                 # Chat application submodule
└── turbo.json                # Turborepo configuration
```

## Development Workflows

### Working with the Monorepo

1. **Install dependencies**: `pnpm install` (root installs all workspaces)
2. **Run specific app**: `pnpm run dev:www` or `pnpm run dev:cloud`
3. **Build specific app**: `pnpm run build:www`
4. **Add dependency to specific app**: `pnpm add package-name --filter @lightfast/www`
5. **Run script in specific app**: `pnpm --filter @lightfast/www run script-name`

### Adding New Components

```bash
# Add shadcn/ui component to the UI package
pnpm run ui add button

# The component will be available across all apps
```

### Code Quality Workflow

```bash
# Before committing
pnpm run lint:fix     # Fix linting issues
pnpm run format:fix   # Fix formatting
pnpm run typecheck    # Check types
```

## Deployment

### Vercel Deployment

Each application can be deployed separately to Vercel:

1. **Connect to Vercel**
   ```bash
   pnpm run vercel:link
   ```

2. **Configure build settings** (in Vercel dashboard or vercel.json):
   - Build command: `pnpm run build:www` (or specific app)
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

Full API documentation is available at [docs.lightfast.ai/api](https://docs.lightfast.ai/api).

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
- **Documentation**: [docs.lightfast.ai](https://docs.lightfast.ai)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **Discord**: [Join our community](https://discord.gg/YqPDfcar2C)
- **Twitter**: [@lightfastai](https://x.com/lightfastai)

## License

This project is licensed under the [Functional Source License v1.1 with Apache 2.0 Future License](LICENSE.md).

**TL;DR**: You can use this software for any purpose except creating a competing commercial product. After 2 years, it becomes Apache 2.0 licensed.

## Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing code or documentation

---

**Built with ❤️ by the Lightfast team**