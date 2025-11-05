# Lightfast Agent Execution Architecture

## Problem Statement
We need to securely execute untrusted JavaScript code (Lightfast agent bundles) while maintaining streaming AI responses and integration with the existing platform.

## Constraints
- Vercel serverless functions don't support native modules (isolated-vm fails)
- Security is paramount - no sandbox escapes allowed
- Need AI SDK streaming via fetchRequestHandler
- Must scale to thousands of concurrent executions
- Cost-effective and maintainable

## Recommended Architecture: Hybrid Service Model

### Components

#### 1. Next.js Orchestration Layer (apps/cloud)
**Responsibilities:**
- Authentication & authorization
- Bundle validation & caching  
- Request preprocessing
- Response streaming proxy
- Error handling & monitoring

**Implementation:**
```typescript
// /api/execute route
export async function POST(request: NextRequest) {
  // 1. Authenticate & validate request
  // 2. Cache bundle if needed
  // 3. Forward to execution service
  // 4. Stream response back to client
}
```

#### 2. Execution Service (Containerized)
**Responsibilities:**
- Secure code execution in isolated containers
- Direct AI SDK integration
- Streaming response generation
- Resource management & cleanup

**Deployment Options:**
- **Railway/Fly.io**: Containerized apps with auto-scaling
- **AWS Fargate**: Serverless containers
- **Google Cloud Run**: Containerized functions
- **Self-hosted**: Kubernetes deployment

**Security Model:**
```dockerfile
# Lightweight execution container
FROM node:20-alpine

# Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S lightfast -u 1001

# Restricted filesystem
USER lightfast
WORKDIR /app

# Network restrictions via container networking
# CPU/Memory limits via container resources
```

#### 3. Container Orchestration
**Features:**
- Auto-scaling based on load
- Health checks & monitoring
- Rolling deployments
- Resource limits (CPU: 1 core, Memory: 512MB, Time: 30s)

### Request Flow

1. **Client** → POST /api/execute
2. **Next.js** validates auth, caches bundle
3. **Next.js** → HTTP request to **Execution Service**
4. **Execution Service** loads bundle in isolated container
5. **Execution Service** calls AI provider with streaming
6. **Execution Service** → streams response to **Next.js**
7. **Next.js** → streams response to **Client**

### Security Layers

1. **Container Isolation**: Each execution in separate container
2. **Resource Limits**: CPU/memory/time restrictions
3. **Network Restrictions**: Limited outbound access
4. **Filesystem Restrictions**: Read-only except temp directories
5. **Process Limits**: No child process spawning
6. **gVisor/Firecracker**: Additional kernel-level isolation (optional)

### Implementation Phases

#### Phase 1: Basic Service (Week 1)
- Simple Express.js execution service
- Docker containerization
- Deploy to Railway/Fly.io
- Basic Next.js proxy integration

#### Phase 2: Production Security (Week 2)
- Container resource limits
- Network restrictions
- Process monitoring
- Error handling & cleanup

#### Phase 3: Scale & Optimize (Week 3)
- Auto-scaling configuration
- Request pooling/batching
- Performance monitoring
- Cost optimization

## Alternative: QuickJS-WASM (Interim Solution)

If immediate deployment is needed, use WebAssembly sandboxing:

```javascript
import { newQuickJSWASMModule } from 'quickjs-emscripten'

async function executeBundle(bundleCode: string, input: string) {
  const QuickJS = await newQuickJSWASMModule()
  const runtime = QuickJS.newRuntime()
  const context = runtime.newContext()
  
  // Set up Lightfast mocks in WASM context
  context.setProp(context.global, 'console', context.newObject())
  
  try {
    // Execute bundle
    const result = context.evalCode(bundleCode)
    // Handle execution and streaming
  } finally {
    runtime.dispose()
  }
}
```

**Pros:** Works immediately on Vercel, no infrastructure changes
**Cons:** Limited Node.js compatibility, potential Lightfast API gaps

## Decision Matrix

| Solution | Security | Performance | Complexity | Cost | Timeline |
|----------|----------|-------------|------------|------|----------|
| Hybrid Service | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 2-3 weeks |
| QuickJS-WASM | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | 1 week |
| Edge Runtime | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 3-4 weeks |

## Recommendation

**Start with QuickJS-WASM** for immediate functionality, then **migrate to Hybrid Service** for production scale and security.