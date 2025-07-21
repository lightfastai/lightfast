# OpenCode Implementation Guide for hal9000

## Overview
This guide provides step-by-step instructions for implementing OpenCode's tool context and memory patterns in the hal9000 project.

## Phase 1: Tool Context Enhancement

### 1.1 Update Tool Interface
Create a new tool context type that includes thread and resource information:

```typescript
// types/tool-context.ts
export interface ToolContext {
  threadId: string
  resourceId: string
  abortSignal?: AbortSignal
  metadata?: (update: { title?: string; metadata?: any }) => void
}

// Update tool creation pattern
export const createToolWithContext = <T extends z.ZodType>(config: {
  id: string
  description: string
  inputSchema: T
  execute: (
    params: z.infer<T>,
    context: ToolContext
  ) => Promise<ToolResult>
}) => {
  // Implementation
}
```

### 1.2 Modify Tool Execution
Update existing tools to receive and use context:

```typescript
// Example: save-critical-info.ts
export const saveCriticalInfoTool = createToolWithContext({
  id: "save-critical-info",
  description: "Save critical information",
  inputSchema: z.object({
    information: z.string(),
    category: z.string(),
  }),
  execute: async ({ information, category }, context) => {
    const { threadId, resourceId } = context
    
    // Use context for scoped storage
    const path = `data/${resourceId}/${threadId}/${category}.json`
    
    // Implementation continues...
  }
})
```

### 1.3 Agent Integration
Update agents to pass context to tools:

```typescript
// In agent creation
const agent = createAgent({
  // ... other config
  tools: tools.map(tool => wrapToolWithContext(tool, {
    getContext: (messages) => ({
      threadId: messages.threadId,
      resourceId: messages.resourceId,
    })
  }))
})
```

## Phase 2: Memory System Implementation

### 2.1 Storage Service
Create a storage service with atomic writes:

```typescript
// lib/storage/storage-service.ts
export class StorageService {
  private baseDir: string
  
  async writeJSON<T>(key: string, data: T): Promise<void> {
    const filepath = path.join(this.baseDir, `${key}.json`)
    const tempPath = `${filepath}.${Date.now()}.tmp`
    
    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
    
    // Atomic rename
    await fs.rename(tempPath, filepath)
    
    // Clean up temp file if it still exists
    await fs.unlink(tempPath).catch(() => {})
    
    // Emit update event
    this.emit('write', { key, data })
  }
  
  async readJSON<T>(key: string): Promise<T> {
    const filepath = path.join(this.baseDir, `${key}.json`)
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content)
  }
}
```

### 2.2 Session Management
Implement session management with caching:

```typescript
// lib/session/session-manager.ts
export class SessionManager {
  private cache = new Map<string, SessionInfo>()
  private storage: StorageService
  
  async getSession(sessionId: string): Promise<SessionInfo> {
    // Check cache first
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId)!
    }
    
    // Load from storage
    const session = await this.storage.readJSON<SessionInfo>(
      `sessions/${sessionId}`
    )
    
    // Cache for future use
    this.cache.set(sessionId, session)
    
    return session
  }
  
  async updateSession(
    sessionId: string, 
    updater: (session: SessionInfo) => void
  ): Promise<void> {
    const session = await this.getSession(sessionId)
    updater(session)
    session.updatedAt = Date.now()
    
    // Update cache
    this.cache.set(sessionId, session)
    
    // Persist to storage
    await this.storage.writeJSON(`sessions/${sessionId}`, session)
    
    // Emit update event
    this.emit('session:updated', { sessionId, session })
  }
}
```

### 2.3 App State Management
Create a singleton service pattern:

```typescript
// lib/app/app-state.ts
export class AppState {
  private static instance: AppState
  private services = new Map<string, any>()
  
  static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }
  
  registerService<T>(
    key: string,
    factory: () => T,
    cleanup?: (service: T) => Promise<void>
  ): () => T {
    return () => {
      if (!this.services.has(key)) {
        this.services.set(key, {
          instance: factory(),
          cleanup
        })
      }
      return this.services.get(key).instance
    }
  }
  
  async shutdown(): Promise<void> {
    for (const [key, service] of this.services) {
      if (service.cleanup) {
        await service.cleanup(service.instance)
      }
    }
  }
}
```

## Phase 3: Migration Strategy

### 3.1 Gradual Migration
1. Start with new tools using the context pattern
2. Gradually update existing tools
3. Maintain backward compatibility during transition

### 3.2 Data Migration
```typescript
// lib/storage/migrations/index.ts
export interface Migration {
  version: number
  up: (storageDir: string) => Promise<void>
  down?: (storageDir: string) => Promise<void>
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: async (dir) => {
      // Migrate from old format to new format
      const oldFiles = await glob('**/*.json', { cwd: dir })
      for (const file of oldFiles) {
        // Transform and write in new format
      }
    }
  }
]
```

### 3.3 Feature Flags
Use feature flags during migration:

```typescript
// config/features.ts
export const features = {
  useNewMemorySystem: process.env.USE_NEW_MEMORY === 'true',
  useContextualTools: process.env.USE_CONTEXTUAL_TOOLS === 'true',
}
```

## Phase 4: Integration Checklist

### 4.1 Update Existing Tools
- [ ] file-tools.ts - Add context awareness
- [ ] save-critical-info.ts - Use thread-scoped storage
- [ ] web-search-tools.ts - Pass context through
- [ ] browser-tools.ts - Include session information

### 4.2 Update Agents
- [ ] Modify agent creation to pass context
- [ ] Update memory factory to use new system
- [ ] Ensure backward compatibility

### 4.3 Testing Strategy
1. Unit tests for storage service
2. Integration tests for session management
3. End-to-end tests for tool execution with context
4. Performance benchmarks for caching

### 4.4 Monitoring
- Add metrics for cache hit rates
- Monitor storage performance
- Track memory usage

## Benefits of Implementation

1. **Thread Isolation**: Each conversation maintains its own context
2. **Better Organization**: Files organized by resource/thread
3. **Performance**: In-memory caching reduces disk I/O
4. **Reliability**: Atomic writes prevent corruption
5. **Extensibility**: Clean architecture for future features

## Example: Updated Tool Usage

```typescript
// Before
export const mathTool = createTool({
  execute: async ({ expression }) => {
    const result = evaluate(expression)
    // No context about who's using it or in what conversation
    return { result }
  }
})

// After
export const mathTool = createToolWithContext({
  execute: async ({ expression }, context) => {
    const { threadId, resourceId } = context
    
    // Log usage per thread
    await logUsage(resourceId, threadId, 'math', expression)
    
    const result = evaluate(expression)
    
    // Store calculation history per thread
    await appendToHistory(threadId, { expression, result })
    
    return { result }
  }
})
```

## Timeline Estimate

- Phase 1: 2-3 days (Tool context enhancement)
- Phase 2: 3-4 days (Memory system implementation)
- Phase 3: 2-3 days (Migration and testing)
- Phase 4: 2-3 days (Integration and rollout)

Total: ~2 weeks for complete implementation

## Next Steps

1. Review and approve the implementation plan
2. Create feature branch for development
3. Implement Phase 1 with minimal disruption
4. Gradually roll out remaining phases
5. Monitor and optimize based on usage patterns