# HAL9000 - Advanced AI Agent Platform

An advanced AI agent platform built with Mastra, featuring multiple specialized agents, secure sandbox execution, and comprehensive task management capabilities.

## Tech Stack

- **Next.js 15** - App Router with TypeScript
- **Mastra** - AI agent orchestration framework
- **Tailwind CSS v4** - Modern styling
- **shadcn/ui** - UI component library
- **Vercel Sandbox** - Secure code execution
- **AI SDK** - Multi-provider AI integration (Anthropic, OpenAI, OpenRouter)
- **Drizzle ORM** - Type-safe database interactions
- **LibSQL/Upstash** - Flexible storage options

## Features

### 🤖 Specialized AI Agents
- **Math Agent**: Complex mathematical calculations, statistics, and matrix operations
- **Vision Agent**: Image analysis and understanding
- **Voice Agent**: Voice interaction capabilities with ElevenLabs and OpenAI
- **Browser Agent**: Web automation and scraping with Playwright
- **Sandbox Agent**: Secure code execution in isolated environments
- **Chat Agent**: General-purpose conversational AI
- **Download Agent**: File downloading and management
- **Planner Agent**: Task planning and decomposition
- **Searcher Agent**: Web search integration with Exa
- **Artifact Agent**: Code and document artifact creation

### 🔧 Advanced Capabilities
- **Memory System**: Persistent conversation memory with thread and resource scoping
- **Task Management**: Schema-based task tracking with UI components
- **Tool Integration**: Extensible tool system for agent capabilities
- **Workflow Support**: Complex multi-step task execution
- **Type Safety**: Strict TypeScript with Zod schemas throughout

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- API keys for AI providers (see Environment Variables)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hal9000
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables:
```env
# Required: Choose at least one AI provider
OPENROUTER_API_KEY=your_openrouter_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional
OPENAI_API_KEY=your_openai_api_key        # Optional

# Optional services
EXA_API_KEY=your_exa_api_key              # For web search
BROWSERBASE_API_KEY=your_browserbase_key   # For browser automation
BROWSERBASE_PROJECT_ID=your_project_id
ELEVENLABS_API_KEY=your_elevenlabs_key    # For voice
BLOB_READ_WRITE_TOKEN=your_vercel_blob    # For file storage

# Database (optional - defaults to local SQLite)
DATABASE_URL=your_database_url

# Upstash Redis (optional - for production memory)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### Development

1. Start the Mastra dev server (optional, for agent playground):
```bash
pnpm dev:mastra
```

2. Start the Next.js development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Running Tests

```bash
pnpm typecheck    # TypeScript type checking
pnpm lint         # Run Biome linter
```

## Project Structure

```
├── app/                  # Next.js 15 app directory
│   ├── api/             # API routes
│   │   └── chat/        # Chat thread endpoints
│   ├── chat/            # Chat UI routes
│   └── layout.tsx       # Root layout
├── components/          # React components
│   └── ui/              # shadcn/ui components
├── mastra/              # Mastra AI framework
│   ├── agents/          # AI agent definitions
│   ├── tools/           # Tool implementations
│   ├── workflows/       # Multi-step workflows
│   └── lib/             # Utilities and providers
├── lib/                 # Shared utilities
│   ├── database/        # Database client and schema
│   └── sandbox/         # Sandbox execution
├── docs/                # Documentation
├── hooks/               # React hooks
└── types/               # TypeScript type definitions
```

## Key Components

### Agent System

Agents are defined in `mastra/agents/` with specific capabilities:

```typescript
// Example: Math Agent with multiple tools
export const mathAgent = new Agent({
  name: "Math",
  description: "Advanced mathematical computation agent",
  instructions: "You are a mathematical expert...",
  model: anthropic("claude-3-5-sonnet-20241022"),
  tools: {
    calculate: calculateTool,
    factorial: factorialTool,
    fibonacci: fibonacciTool,
    quadraticSolver: quadraticSolverTool,
    statistics: statisticsTool,
    matrixOperations: matrixOperationsTool,
    derivative: derivativeTool,
    integral: integralTool,
  },
});
```

### Memory System

Thread-aware memory with context:

```typescript
// Tools automatically receive threadId and resourceId
export const myTool = createTool({
  id: "thread-aware-tool",
  execute: async ({ context, threadId, resourceId }) => {
    // Use threadId for conversation context
    // Use resourceId for user-specific data
  }
});
```

### Sandbox Execution

Secure code execution with Vercel Sandbox:

```typescript
import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.create();
const result = await sandbox.run({
  code: 'console.log("Hello from sandbox!")',
  language: 'javascript'
});
```

## Usage

### Chat Interface

The main interface is available at `http://localhost:3000`. You'll be redirected to a new chat thread where you can interact with the agents.

### Available Agents

1. **Math Agent** - Advanced calculations, statistics, calculus
   - Example: "Calculate the derivative of x^2 + 3x - 5"
   - Example: "Find the mean and standard deviation of [1,2,3,4,5]"

2. **Sandbox Agent** - Execute code safely
   - Example: "Run a Python script that generates fibonacci numbers"
   - Example: "Create and run a Node.js HTTP server"

3. **Browser Agent** - Web automation
   - Example: "Navigate to example.com and take a screenshot"
   - Example: "Search for 'AI agents' and get the results"

4. **Vision Agent** - Analyze images
   - Example: "Describe this image: [upload image]"
   - Example: "What text is in this screenshot?"

5. **Voice Agent** - Voice interactions
   - Supports text-to-speech and speech-to-text

### API Usage

```bash
# Direct agent API call
curl -X POST http://localhost:4111/api/agents/mathAgent/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Calculate 15 * 7"}],
    "threadId": "test-thread",
    "resourceId": "mathAgent",
    "stream": true
  }'
```

## Development Guidelines

### Code Style

- **Strict TypeScript** - No `any` types
- **Direct imports** - No index.ts re-exports
- **Biome formatting** - Auto-formats on save
- **Zod schemas** - For all data validation

### Adding New Agents

1. Create agent file in `mastra/agents/`
2. Define tools in `mastra/tools/`
3. Register in `mastra/index.ts`
4. Follow patterns in AGENTS.md

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

Environment variables are automatically picked up from your Vercel project settings.

### Production Considerations

- Use Upstash for production memory storage
- Configure appropriate API rate limits
- Set up proper error monitoring
- Review agent permissions and sandboxing

## Documentation

- [Agent Development Guide](./docs/agent-testing.md)
- [Memory System Guide](./docs/memory-system.md)
- [Container Development](./docs/container-use.md)
- [Next.js Best Practices](./docs/nextjs.md)
- [Mastra Best Practices](./AGENTS.md)

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Anthropic Claude](https://docs.anthropic.com)

## License

MIT