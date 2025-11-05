# Execution Service Implementation Plan

## Service Architecture

```
┌─────────────────────────────────────────┐
│           Execution Service             │
│  (Railway/Fly.io Container)            │
├─────────────────────────────────────────┤
│  POST /execute                          │
│  ├─ Load bundle in VM2/isolated-vm      │
│  ├─ Create Lightfast agent              │
│  ├─ Call fetchRequestHandler            │
│  └─ Stream response                     │
├─────────────────────────────────────────┤
│  Security Layers:                       │
│  ├─ Container limits (512MB, 30s)       │
│  ├─ Network restrictions                │
│  ├─ Process isolation                   │
│  └─ File system restrictions            │
└─────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Basic Service (2-3 days)

```typescript
// execution-service/src/server.ts
import express from 'express'
import { createAgent } from 'lightfast/agent'
import { fetchRequestHandler } from 'lightfast/server/adapters/fetch'
import { NodeVM } from 'vm2' // Works fine in dedicated service

const app = express()

app.post('/execute', async (req, res) => {
  const { bundleCode, agentName, input, sessionId } = req.body
  
  try {
    // Execute bundle in VM2 sandbox
    const vm = new NodeVM({
      console: 'redirect',
      sandbox: {},
      require: {
        external: ['lightfast', '@ai-sdk/gateway'],
        root: './node_modules/'
      }
    })
    
    const lightfastConfig = vm.run(bundleCode)
    const agent = lightfastConfig.agents[agentName]
    
    // Create request for fetchRequestHandler
    const agentRequest = new Request(`http://localhost/chat/${sessionId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: input }]
      })
    })
    
    // Use Lightfast's fetchRequestHandler for streaming
    const response = await fetchRequestHandler({
      agent: recreateAgent(agent),
      sessionId,
      memory: new InMemoryMemory(),
      req: agentRequest,
      resourceId: 'execution-service',
      generateId: () => crypto.randomUUID()
    })
    
    // Stream response back
    return response
    
  } finally {
    vm.dispose?.() // Cleanup
  }
})
```

### Phase 2: Containerization (1 day)

```dockerfile
# execution-service/Dockerfile
FROM node:20-alpine

# Security: non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S lightfast -u 1001

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .
RUN chown -R lightfast:nodejs /app
USER lightfast

# Resource limits handled by container orchestration
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### Phase 3: Next.js Integration (1 day)

```typescript
// apps/cloud/src/app/api/execute/route.ts
export async function POST(request: NextRequest) {
  // Validate auth, parse request
  const { bundleUrl, input, agentName, organizationId, sessionId } = 
    await validateRequest(request)
  
  // Fetch bundle (with caching)
  const bundleCode = await fetchBundle(bundleUrl)
  
  // Forward to execution service
  const response = await fetch(`${EXECUTION_SERVICE_URL}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      bundleCode,
      agentName, 
      input,
      sessionId,
      organizationId
    })
  })
  
  // Stream response back to client
  return new Response(response.body, {
    headers: { 
      'content-type': 'text/plain',
      'transfer-encoding': 'chunked' 
    }
  })
}
```

## Deployment Options

### Option A: Railway (Recommended for speed)
```bash
# Deploy execution service to Railway
railway login
railway link
railway deploy

# Auto-scaling, HTTPS, monitoring included
```

### Option B: Fly.io (More control)
```toml
# fly.toml
[build]
  dockerfile = "Dockerfile"

[[services]]
  http_checks = []
  internal_port = 3001
  processes = ["app"]
  protocol = "tcp"
  
[services.concurrency]
  type = "requests"
  hard_limit = 25
  soft_limit = 20

[[services.ports]]
  force_https = true
  handlers = ["http"]
  port = 80

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443

[env]
  NODE_ENV = "production"
```

### Option C: Docker Compose (Local dev)
```yaml
# docker-compose.yml
version: '3.8'
services:
  execution-service:
    build: ./execution-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1'
        reservations:
          memory: 256M
          cpus: '0.5'
```

## Security Implementation

### Container Security
```typescript
// Resource monitoring
const monitor = {
  startTime: Date.now(),
  memoryUsage: process.memoryUsage(),
  
  checkLimits() {
    const runtime = Date.now() - this.startTime
    const memory = process.memoryUsage().heapUsed
    
    if (runtime > 30000) throw new Error('Execution timeout')
    if (memory > 512 * 1024 * 1024) throw new Error('Memory limit exceeded')
  }
}

// Execute with monitoring
const executeWithLimits = async (bundleCode) => {
  const interval = setInterval(() => monitor.checkLimits(), 1000)
  try {
    return await executeBundleInVM(bundleCode)
  } finally {
    clearInterval(interval)
  }
}
```

### Network Security
```typescript
// Restrict outbound connections
const allowedHosts = [
  'api.openai.com',
  'api.anthropic.com', 
  'generativelanguage.googleapis.com'
]

// Proxy AI requests through controlled gateway
```

## Testing Strategy

```typescript
// execution-service/test/integration.test.ts
describe('Agent Execution', () => {
  it('executes simple agent bundle', async () => {
    const bundleCode = `
      const { createAgent } = require('lightfast/agent')
      module.exports = {
        agents: {
          test: createAgent({
            name: 'test',
            system: 'You are helpful',
            model: 'gpt-4o-mini'
          })
        }
      }
    `
    
    const response = await request(app)
      .post('/execute')
      .send({
        bundleCode,
        agentName: 'test',
        input: 'Hello',
        sessionId: 'test-session'
      })
      
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    // Should be streaming response
  })
})
```

## Success Metrics

- ✅ Secure execution (no sandbox escapes)
- ✅ Streaming AI responses via fetchRequestHandler  
- ✅ <200ms latency for simple agents
- ✅ Handle 100+ concurrent executions
- ✅ Proper error handling and cleanup
- ✅ Resource monitoring and limits

## Next Steps

1. **Day 1**: Create basic Express.js execution service
2. **Day 2**: Add VM2 sandboxing and Lightfast integration  
3. **Day 3**: Containerize and deploy to Railway
4. **Day 4**: Update Next.js to proxy requests
5. **Day 5**: End-to-end testing and security validation

This approach gives us proper security, scalability, and maintains the Lightfast streaming architecture.