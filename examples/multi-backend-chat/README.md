# Lightfast Multi-Backend Chat Example

A comprehensive example demonstrating how to use **Lightfast Core** with multiple backend frameworks. This project showcases the same Lightfast agent working seamlessly across different Node.js web frameworks, giving developers the flexibility to choose their preferred backend technology.

## 🚀 Features

- **🔄 One Agent, Multiple Backends** - Same Lightfast agent configuration works across all frameworks
- **🤖 Advanced AI Tools** - Weather API and calculator tools with proper error handling
- **💾 Memory Persistence** - Optional Redis-backed conversation history with fallback to in-memory storage
- **🔄 Streaming Responses** - Real-time AI responses with smooth streaming across all backends
- **🎨 Modern React Frontend** - Clean chat interface that works with any backend
- **🛡️ Production Ready** - Proper error handling, CORS, logging, and graceful shutdown
- **📊 Built-in Telemetry** - Request tracking and performance monitoring
- **⚡ Framework Showcase** - Compare performance and patterns across frameworks

## 🏗️ Supported Backends

| Backend | Port | Features | Use Case |
|---------|------|----------|----------|
| **Node.js HTTP** | 3001 | Minimal, no dependencies | Learning, minimal setups |
| **Express** | 3002 | Most popular, extensive ecosystem | Traditional web apps, APIs |
| **Hono** | 3003 | Fast, multi-runtime support | Edge computing, Cloudflare Workers |
| **Fastify** | 3004 | High performance, low overhead | High-traffic applications |
| **NestJS** | 3005 | Enterprise architecture, DI | Large applications, microservices |
| **Next.js** | 3000 | Full-stack React framework | Frontend + API routes |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install main dependencies
pnpm install

# Install NestJS dependencies (optional)
pnpm run install:backends
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Required: Vercel AI Gateway API key for model access
AI_GATEWAY_API_KEY=your_gateway_api_key_here

# Optional: Redis for conversation persistence
UPSTASH_REDIS_REST_URL=your_redis_url  # Leave empty for in-memory storage
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

**Getting the required keys:**
- **Vercel AI Gateway**: Sign up at [vercel.com/dashboard/ai-gateway](https://vercel.com/dashboard/ai-gateway)
- **Upstash Redis** (optional): Get a free instance at [upstash.com](https://upstash.com)

### 3. Choose Your Backend

Run any backend server (pick your favorite framework):

```bash
# Next.js (React frontend + API routes)
pnpm dev                 # http://localhost:3000

# Node.js HTTP (minimal, no framework)
pnpm dev:node           # http://localhost:3001

# Express (most popular Node.js framework)
pnpm dev:express        # http://localhost:3002

# Hono (fast, multi-runtime)
pnpm dev:hono          # http://localhost:3003

# Fastify (high performance)
pnpm dev:fastify       # http://localhost:3004

# NestJS (enterprise, TypeScript-first)
pnpm dev:nestjs        # http://localhost:3005
```

### 4. Test the API

Try the chat API with any backend:

```bash
# Test with curl (replace port with your chosen backend)
curl -X POST http://localhost:3001/api/chat/test-session \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What'\''s the weather in Tokyo?"}]}'

# Or test the weather tool
curl -X POST http://localhost:3002/api/chat/test-session \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Calculate 15 * 23 + 42"}]}'
```

## 🏛️ Architecture

### Shared Configuration

All backends use the same agent configuration from `/shared/agent-config.js`:

```javascript
// Shared tools across all backends
const chatTools = {
  weather: tool({
    description: "Get the current weather in a location",
    parameters: z.object({
      location: z.string().describe("The location to get weather for"),
    }),
    execute: async ({ location }) => {
      // Weather simulation logic
    },
  }),
  calculator: tool({
    description: "Perform basic mathematical calculations", 
    parameters: z.object({
      expression: z.string().describe("Mathematical expression to evaluate"),
    }),
    execute: async ({ expression }) => {
      // Safe calculation logic
    },
  }),
};
```

### Backend Pattern

Each backend follows the same pattern:

1. **Import shared configuration** from `/shared/agent-config.js`
2. **Use `fetchRequestHandler`** from `@lightfastai/core/server/adapters/fetch`
3. **Handle POST `/api/chat/{sessionId}`** endpoint
4. **Include proper CORS, error handling, and logging**

```javascript
// Universal pattern across all backends
const response = await fetchRequestHandler({
  agent: createChatAgent({ sessionId, userId }),
  sessionId,
  memory,
  req: fetchRequest,
  resourceId: userId,
  // ... configuration
});
```

## 📁 Project Structure

```
multi-backend-chat/
├── shared/
│   └── agent-config.js          # Shared Lightfast agent configuration
├── backends/
│   ├── node-http.js            # Native Node.js HTTP server
│   ├── express.js              # Express.js server
│   ├── hono.js                 # Hono server
│   ├── fastify.js              # Fastify server
│   └── nestjs/                 # NestJS application
│       ├── src/
│       │   ├── main.ts         # Application entry point
│       │   ├── app.module.ts   # Root module
│       │   ├── chat/           # Chat feature module
│       │   └── health/         # Health check module
│       └── package.json        # NestJS dependencies
├── app/                        # Next.js frontend
│   ├── api/chat/[sessionId]/route.ts  # Next.js API route
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Chat interface
├── components/
│   └── lightfast-chat.tsx     # React chat component
└── package.json               # Main dependencies and scripts
```

## 🛠️ Backend Comparison

### Performance Characteristics

| Framework | Startup Time | Request Latency | Memory Usage | Bundle Size |
|-----------|--------------|-----------------|--------------|-------------|
| Node.js HTTP | ~50ms | ~5ms | Lowest | Smallest |
| Express | ~100ms | ~8ms | Low | Small |
| Hono | ~80ms | ~6ms | Low | Small |
| Fastify | ~120ms | ~7ms | Low | Medium |
| NestJS | ~800ms | ~12ms | Medium | Large |
| Next.js | ~1200ms | ~15ms | Higher | Largest |

### Framework-Specific Features

#### Node.js HTTP (`/backends/node-http.js`)
- ✅ Zero dependencies (except Lightfast)
- ✅ Minimal memory footprint
- ✅ Maximum control
- ❌ Manual request parsing
- ❌ No built-in middleware

#### Express (`/backends/express.js`)
- ✅ Extensive ecosystem
- ✅ Simple and familiar API
- ✅ Rich middleware support
- ✅ Great documentation
- ❌ Slower than newer frameworks

#### Hono (`/backends/hono.js`)
- ✅ Ultra-fast performance
- ✅ Multi-runtime (Node.js, Workers, Deno)
- ✅ Native Web API support
- ✅ Small bundle size
- ❌ Smaller ecosystem

#### Fastify (`/backends/fastify.js`)
- ✅ High performance
- ✅ Built-in validation
- ✅ Extensive plugin system
- ✅ Great TypeScript support
- ❌ Learning curve

#### NestJS (`/backends/nestjs/`)
- ✅ Enterprise architecture patterns
- ✅ Dependency injection
- ✅ Built-in testing utilities
- ✅ Extensive decorators
- ❌ Higher complexity
- ❌ Slower startup time

## 🔧 Development

### Run Multiple Backends

Start all backends simultaneously for testing:

```bash
# Terminal 1: Node.js HTTP
pnpm dev:node

# Terminal 2: Express  
pnpm dev:express

# Terminal 3: Hono
pnpm dev:hono

# Terminal 4: Fastify
pnpm dev:fastify

# Terminal 5: NestJS
pnpm dev:nestjs

# Terminal 6: Next.js (frontend)
pnpm dev
```

### Health Checks

Each backend provides a health endpoint:

```bash
curl http://localhost:3001/health  # Node.js HTTP
curl http://localhost:3002/health  # Express
curl http://localhost:3003/health  # Hono  
curl http://localhost:3004/health  # Fastify
curl http://localhost:3005/health  # NestJS
```

### Test All Backends

```bash
# Quick test of all running backends
pnpm test:backends
```

## 🚀 Deployment Options

### Traditional Servers
- **VPS/Dedicated**: All backends work great
- **Docker**: Each backend can be containerized
- **PM2**: Process management for Node.js backends

### Platform-as-a-Service
- **Heroku**: All frameworks supported
- **Railway**: Excellent Node.js support
- **Render**: Great for Express, Fastify, NestJS

### Serverless
- **Vercel**: Next.js (native), Hono (excellent)
- **Netlify**: Next.js, Express (with adapter)
- **Cloudflare Workers**: Hono (native), others need adapters

### Container Orchestration
- **Kubernetes**: All backends work well
- **Docker Compose**: Great for development
- **AWS ECS/Fargate**: Production-ready

## 📚 Framework Documentation

- **Lightfast Core**: [docs.lightfast.ai](https://docs.lightfast.ai)
- **Express**: [expressjs.com](https://expressjs.com)
- **Hono**: [hono.dev](https://hono.dev)
- **Fastify**: [fastify.dev](https://fastify.dev)
- **NestJS**: [nestjs.com](https://nestjs.com)
- **Next.js**: [nextjs.org](https://nextjs.org)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your backend implementation
4. Update this README
5. Submit a pull request

Want to add support for another framework? Follow the pattern in existing backends and add:
- Backend implementation in `/backends/`
- Package.json script
- Documentation section

## 📄 License

MIT - See [LICENSE](LICENSE) for details.

---

**Choose your favorite framework and start building AI agents with Lightfast! 🚀**