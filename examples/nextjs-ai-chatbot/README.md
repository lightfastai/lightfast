# Lightfast Core AI Chatbot Example

A Next.js AI chatbot demonstrating Lightfast Core v1 infrastructure with memory persistence and streaming responses.

## Features

- 🤖 **AI Gateway Integration** - Uses Vercel AI Gateway for unified model access
- 💾 **Memory Persistence** - Optional Redis-backed conversation history  
- 🔄 **Streaming Responses** - Real-time AI responses with Vercel AI SDK
- 🎨 **Modern UI** - Clean interface with Tailwind CSS
- 🔐 **Environment Validation** - Type-safe environment variables with @t3-oss/env
- ⚡ **Edge Runtime** - Fast, globally distributed API routes

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Optional: Redis for conversation persistence
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### 3. Run Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## Architecture

This example showcases:

- **Lightfast Core v1** - Memory system for conversation persistence
- **Vercel AI Gateway** - Unified access to AI models (OpenAI, Anthropic, etc.)
- **Edge Runtime** - Fast, globally distributed API routes
- **Type-safe Environment** - Validated configuration with @t3-oss/env

## Project Structure

```
nextjs-ai-chatbot/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # Chat API using gateway
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   └── lightfast-chat.tsx  # Chat interface component
├── lib/
│   └── env.ts              # Environment validation
└── package.json           # Dependencies
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

### Change Default Model

Edit the `DEFAULT_MODEL` in `/app/api/chat/route.ts`:

```typescript
const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';
// or
const DEFAULT_MODEL = 'openai/gpt-4o';
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

Customize the AI behavior by editing the system prompt in `/app/api/chat/route.ts`.

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