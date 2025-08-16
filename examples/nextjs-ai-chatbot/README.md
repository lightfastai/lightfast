# Lightfast Core AI Chatbot Example with fetchRequestHandler

A Next.js AI chatbot demonstrating Lightfast Core's `fetchRequestHandler` pattern - the same architecture used in production chat applications.

## Features

- 🚀 **fetchRequestHandler** - Production-ready request handling with built-in streaming support
- 🤖 **Agent System** - Structured agents with telemetry, error handling, and versioning
- 💾 **Memory Persistence** - Optional Redis-backed conversation history  
- 🔄 **Streaming Responses** - Real-time AI responses with smooth streaming
- 🎨 **Modern UI** - Clean interface with Tailwind CSS
- 🔐 **Environment Validation** - Type-safe environment variables with @t3-oss/env
- ⚡ **Edge Runtime** - Fast, globally distributed API routes
- 📊 **Built-in Telemetry** - Request tracking and performance monitoring

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

Then fill in your values:

```env
# Required: Vercel AI Gateway API key for model access
AI_GATEWAY_API_KEY=your_gateway_api_key_here

# Optional: Redis for conversation persistence
UPSTASH_REDIS_REST_URL=your_redis_url  # Leave empty for in-memory storage
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

**Getting the required keys:**
- **Vercel AI Gateway**: Sign up at [vercel.com/dashboard/ai-gateway](https://vercel.com/dashboard/ai-gateway) to get your API key
- **Upstash Redis** (optional): Get a free instance at [upstash.com](https://upstash.com)

### 3. Run Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## Architecture

This example showcases the production-ready pattern used in Lightfast chat applications:

- **fetchRequestHandler** - Unified request handling with streaming, memory, and error management
- **createAgent** - Structured agent definition with system prompts and tool support
- **Vercel AI Gateway** - Unified access to AI models (OpenAI, Anthropic, etc.)
- **Edge Runtime** - Fast, globally distributed API routes
- **Type-safe Environment** - Validated configuration with @t3-oss/env

## Project Structure

```
nextjs-ai-chatbot/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── [sessionId]/
│   │           └── route.ts  # fetchRequestHandler API
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   └── lightfast-chat.tsx  # Chat interface component
├── lib/
│   └── env.ts              # Environment validation
└── package.json           # Dependencies
```

## API Routes

### Route Pattern: `/api/chat/[sessionId]`

The API route uses the fetchRequestHandler pattern:

```typescript
// Dynamic route handles session management
/api/chat/abc-123-def

// Uses fetchRequestHandler for:
- Automatic streaming response handling
- Memory persistence with Redis
- Error boundaries
- Request/response telemetry
- Resume capabilities
```

## Key Technologies

- Next.js 14 with App Router
- Vercel AI SDK v5
- Lightfast Core v1
- Vercel AI Gateway
- Upstash Redis (optional)
- TypeScript
- Tailwind CSS

## Customization

### Model Configuration

The chatbot uses a fixed model (`openai/gpt-5-nano`) configured in `/app/api/chat/[sessionId]/route.ts`:

```typescript
const MODEL = "openai/gpt-5-nano";
```

### Enable Memory Persistence

1. Sign up for [Upstash Redis](https://upstash.com)
2. Create a database
3. Add credentials to `.env.local`:

```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### System Prompt

Customize the AI behavior by editing the agent definition in `/app/api/chat/[sessionId]/route.ts`:

```typescript
agent: createAgent({
  name: "assistant",
  system: "Your custom system prompt here...",
  // ... other configuration
})
```

### Add Tools

Extend the agent's capabilities by adding tools:

```typescript
const chatTools = {
  calculator: tool({
    description: "Perform calculations",
    parameters: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }) => {
      // Tool implementation
    },
  }),
} as const;
```

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

Add environment variables in the Vercel dashboard.

### Other Platforms

This Next.js app can be deployed to any platform supporting Node.js Edge Runtime.

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Learn More

- [Lightfast Core Documentation](https://docs.lightfast.ai)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js Documentation](https://nextjs.org/docs)

## License

MIT