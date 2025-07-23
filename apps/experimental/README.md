# lightfast-experimental

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1--Apache--2.0-blue.svg)](LICENSE.md)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/experimental)](https://github.com/lightfastai/experimental/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/experimental)](https://github.com/lightfastai/experimental/issues)

An open-source, production-ready AI agent platform featuring multiple specialized agents, secure sandbox execution, and comprehensive task management capabilities. Built with Next.js 15, Mastra, and TypeScript.

## About

Lightfast Experimental is a modern AI agent platform that combines multiple specialized AI agents with a comprehensive development toolkit. This platform serves as both a working application and a research environment for exploring advanced AI agent architectures and capabilities.

### Why Lightfast Experimental?

- ⚡ **Blazing Fast**: Built with Next.js 15, real-time agent interactions
- 🤖 **Multiple Specialized Agents**: Vision, voice, browser automation, code execution, and more
- 🔒 **Secure Sandbox**: Safe code execution with Vercel Sandbox
- 💼 **Production Ready**: Used for research and development at Lightfast
- 🎨 **Modern UI**: Clean, responsive design with shadcn/ui components
- 📱 **Real-time**: Instant message delivery and streaming responses
- 🧠 **Memory System**: Persistent conversation context and thread management
- 🔧 **Extensible**: Easy to add new agents and tools

## Environment Variables

This project uses `@t3-oss/env-nextjs` for type-safe environment variable validation. The environment configuration is defined in `env.ts`.

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# AI API Keys (Required - choose at least one provider)
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key         # For Vercel AI Gateway access
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here  # Required for AI models
OPENAI_API_KEY=sk-your-openai-api-key-here            # For GPT models

# Optional Service APIs
EXA_API_KEY=your-exa-api-key-here                     # For web search functionality
BROWSERBASE_API_KEY=your-browserbase-key              # For browser automation
BROWSERBASE_PROJECT_ID=your-project-id
ELEVENLABS_API_KEY=your-elevenlabs-key               # For voice synthesis
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token         # For file storage

# Database Configuration (optional - defaults to local SQLite)
DATABASE_URL=file:./mastra.db                         # Local SQLite (default)
# DATABASE_URL=your-postgresql-url                    # For production PostgreSQL

# Memory Storage (optional - for production scaling)
UPSTASH_REDIS_REST_URL=your-upstash-url              # Redis for memory storage
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Evaluation and Analytics (optional)
BRAINTRUST_API_KEY=your-braintrust-api-key           # For agent evaluation
BRAINTRUST_PROJECT_ID=lightfast-experimental-agents

# Node Environment
NODE_ENV=development
```

### Environment Variable Categories

#### **🔒 Server-only Variables**
These are only available on the server-side and ensure secure API key handling:
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway access (optional on Vercel deployments)
- `ANTHROPIC_API_KEY` - Claude Sonnet 4 API access
- `OPENAI_API_KEY` - GPT models API access
- `EXA_API_KEY` - Web search functionality
- `BROWSERBASE_API_KEY` - Browser automation service
- `ELEVENLABS_API_KEY` - Voice synthesis
- `BLOB_READ_WRITE_TOKEN` - File storage
- `DATABASE_URL` - Database connection
- `UPSTASH_REDIS_REST_URL` - Redis memory storage
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication

#### **⚙️ Shared Variables**
Available on both client and server:
- `NODE_ENV` - Runtime environment (development/production)

### 🔑 Getting API Keys

- **Vercel AI Gateway**: Get your key from [vercel.com/dashboard/ai](https://vercel.com/dashboard/ai)
- **Anthropic API**: Register at [console.anthropic.com](https://console.anthropic.com) for Claude access
- **OpenAI API**: Get your key from [platform.openai.com](https://platform.openai.com/api-keys)
- **Exa API**: Create account at [exa.ai](https://exa.ai) for web search capabilities
- **BrowserBase**: Sign up at [browserbase.com](https://browserbase.com) for browser automation
- **ElevenLabs**: Register at [elevenlabs.io](https://elevenlabs.io) for voice synthesis

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables** (create `.env.local` with the variables shown above)

3. **Start the Mastra development server** (optional, for agent playground):
   ```bash
   pnpm dev:mastra
   ```

4. **Start the Next.js development server:**
   ```bash
   pnpm dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** and start chatting with agents

## ✨ Features

### 🤖 AI Agents & Chat
- **Multiple Specialized Agents**: Each optimized for specific tasks
  - **A010/A011**: Advanced experimental agents with comprehensive toolsets
  - **C010**: General-purpose conversational agent
  - **Vision Agent**: Image analysis and understanding
  - **Voice Agent**: Text-to-speech and speech-to-text capabilities
  - **Browser Agent**: Web automation and scraping with Playwright
  - **Sandbox Agent**: Secure code execution in isolated environments
  - **Download Agent**: File downloading and management
  - **Planner Agent**: Task planning and decomposition
  - **Searcher Agent**: Web search integration with Exa
  - **Artifact Agent**: Code and document artifact creation

- **Streaming Responses**: Real-time AI response streaming
- **Thread Management**: Organized conversations with persistent history
- **Memory System**: Context-aware conversations with thread and resource scoping
- **Task Management**: Schema-based task tracking with UI components

### 🎨 User Experience
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS v4
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Updates**: Live message delivery and agent interactions
- **Agent Selector**: Easy switching between different AI agents
- **Tool Integration**: Rich tool ecosystem for enhanced agent capabilities

### 🔧 Developer Experience
- **Type-safe**: Full TypeScript with validated environment variables
- **Modern Stack**: Next.js 15 with App Router and latest React features
- **Agent Framework**: Mastra for AI agent orchestration and management
- **Code Quality**: Biome for fast linting and formatting
- **Extensible Architecture**: Easy to add new agents and tools

### 🔐 Security & Sandbox
- **Secure Code Execution**: Vercel Sandbox for safe code running
- **API Key Management**: Secure storage and validation of API keys
- **Memory Isolation**: Thread and resource-scoped memory management
- **Self-hostable**: Complete control over your data and infrastructure

## 🏗️ Architecture

### Frontend
- **Next.js 15**: Latest features with App Router and modern React
- **React 19**: Cutting-edge React features and performance
- **TypeScript**: Full type safety across the application
- **Tailwind CSS v4**: Modern utility-first styling
- **shadcn/ui**: High-quality, accessible UI components

### Backend & AI
- **Mastra**: AI agent orchestration framework
- **Vercel AI SDK**: Streaming and AI utilities
- **Drizzle ORM**: Type-safe database interactions
- **LibSQL/Upstash**: Flexible storage options
- **Vercel Sandbox**: Secure code execution environment

### Infrastructure
- **Vercel**: Production deployment and preview environments
- **Database**: SQLite (development) / PostgreSQL (production)
- **Memory**: In-memory (development) / Redis (production)
- **File Storage**: Vercel Blob for file uploads and management

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|----------|
| **Frontend** | Next.js 15 | React framework with App Router |
| | React 19 | Latest React features and performance |
| | TypeScript | Type safety and developer experience |
| | Tailwind CSS v4 | Utility-first styling |
| | shadcn/ui | High-quality UI components |
| **AI/Agents** | Mastra | AI agent orchestration framework |
| | Vercel AI SDK | Streaming and AI utilities |
| | Anthropic Claude | Claude Sonnet 4 integration |
| | OpenAI | GPT models integration |
| | Vercel AI Gateway | Unified AI model access |
| **Backend** | Drizzle ORM | Type-safe database operations |
| | LibSQL | Lightweight SQLite for development |
| | Upstash Redis | Production memory storage |
| | Vercel Sandbox | Secure code execution |
| **DevOps** | Vercel | Deployment and hosting |
| | pnpm | Fast, efficient package management |
| **Code Quality** | Biome | Fast linting and formatting |
| | TypeScript | Static type checking |
| | Zod | Runtime validation |

## Available Scripts

- `pnpm dev` - Start the Next.js development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run Biome linter and fix issues
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm dev:mastra` - Start Mastra development server
- `pnpm build:mastra` - Build Mastra agent system

## Project Structure

```
├── apps/
│   └── www/              # Next.js 15 web application
│       │   ├── api/      # API routes
│       │   │   └── chat/ # Chat thread endpoints
│       │   ├── chat/     # Chat UI routes
│       │   └── layout.tsx # Root layout
│       ├── components/   # React components
│       │   ├── ui/       # shadcn/ui components
│       │   └── tool-renderers/ # Agent tool displays
│       ├── lib/          # Client utilities
│       └── hooks/        # React hooks
├── packages/
│   ├── ai/               # AI agents and tools (@lightfast/ai)
│   │   └── src/mastra/   # Mastra AI framework
│   │       ├── agents/   # AI agent definitions
│   │       │   ├── experimental/ # A010, A011 agents
│   │       │   ├── pure/ # C010 conversational agent
│   │       │   └── standalone/ # Specialized agents
│   │       ├── tools/    # Tool implementations
│   │       └── lib/      # Utilities and providers
│   ├── types/            # Shared TypeScript types (@lightfast/types)
│   └── evals/            # Evaluation framework (@lightfast/evals)
├── docs/                # Documentation
└── tooling/             # Development tooling and configuration
```

## 🚀 Deployment

### Quick Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lightfastai/experimental)

### Manual Deployment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/lightfastai/experimental.git
   cd experimental
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Build the application**
   ```bash
   pnpm build
   ```

5. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

### Environment Variables for Production

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Optional | Vercel AI Gateway (auto-configured on Vercel) |
| `ANTHROPIC_API_KEY` | Yes | Claude Sonnet 4 API access |
| `OPENAI_API_KEY` | Optional | GPT models API access |
| `EXA_API_KEY` | Optional | Web search functionality |
| `BROWSERBASE_API_KEY` | Optional | Browser automation |
| `ELEVENLABS_API_KEY` | Optional | Voice synthesis |
| `BLOB_READ_WRITE_TOKEN` | Optional | File storage |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | Production | Redis memory storage |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Redis authentication |

## 📚 Documentation

- [**Agent Development Guide**](./docs/agent-testing.md) - Creating and testing agents
- [**Memory System Guide**](./docs/memory-system.md) - Understanding context management
- [**Container Development**](./docs/container-use.md) - Isolated development environments
- [**Next.js Best Practices**](./docs/nextjs.md) - Framework guidelines
- [**Authentication Testing**](./docs/auth-login-process.md) - Login process and test credentials

## 🤝 Contributing

We welcome contributions! Please see our development workflow:

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Run `pnpm typecheck` and `pnpm lint`
5. Submit a pull request

### Code Style
- We use Biome for formatting and linting
- Strict TypeScript with no `any` types
- Direct imports (no index.ts re-exports)
- Zod schemas for all data validation

### Adding New Agents
1. Create agent file in `mastra/agents/`
2. Define tools in `mastra/tools/`
3. Register in `mastra/index.ts`
4. Follow existing patterns and documentation

## 📄 License

This project is licensed under the [Functional Source License v1.1 with Apache 2.0 Future License](LICENSE.md).

**TL;DR**: You can use this software for any purpose except creating a competing commercial product. After 2 years, it becomes Apache 2.0 licensed.

## 🌟 Community

- **Website**: [lightfast.ai](https://lightfast.ai)
- **GitHub**: [github.com/lightfastai/experimental](https://github.com/lightfastai/experimental)
- **Discord**: [Join our community](https://discord.gg/YqPDfcar2C)
- **Twitter**: [@lightfastai](https://x.com/lightfastai)

## 💖 Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing code or documentation

---

**Built with ❤️ by the Lightfast team**