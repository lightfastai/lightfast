# Additional Important OpenCode Patterns

## 1. Configuration Management & Auto-Detection

### Provider Auto-Detection System
OpenCode automatically detects available AI providers in priority order:

```typescript
// Provider priority logic
const providerPriority = [
  'github-copilot',
  'anthropic', 
  'openai',
  'google',
  'azure'
];

// Auto-detection with graceful fallbacks
export async function autoDetectProvider(): Promise<ProviderConfig> {
  for (const provider of providerPriority) {
    if (await hasValidCredentials(provider)) {
      return getProviderConfig(provider);
    }
  }
  throw new Error('No valid AI provider found');
}
```

**Benefits for lightfast-experimental:**
- Reduce configuration complexity
- Better developer experience
- Automatic failover between providers

### Context File Discovery
OpenCode automatically discovers and loads context files:

```typescript
const contextFiles = [
  '.cursorrules',
  'CLAUDE.md', 
  'CLAUDE.local.md',
  '.github/copilot-instructions.md',
  'instructions.md'
];

export async function discoverContextFiles(workingDir: string): Promise<string[]> {
  const foundFiles = [];
  for (const file of contextFiles) {
    const fullPath = path.join(workingDir, file);
    if (await fs.access(fullPath).then(() => true).catch(() => false)) {
      foundFiles.push(await fs.readFile(fullPath, 'utf-8'));
    }
  }
  return foundFiles;
}
```

## 2. Advanced Error Handling Patterns

### Structured Error Types
```typescript
export class NamedError extends Error {
  constructor(
    public readonly name: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = name;
  }
}

export class ProviderError extends NamedError {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super('ProviderError', `${provider}: ${message}`);
  }
}
```

### Error Recovery Strategies
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoffMs: number;
    shouldRetry: (error: Error) => boolean;
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!options.shouldRetry(error) || attempt === options.maxAttempts) {
        throw error;
      }
      
      await new Promise(resolve => 
        setTimeout(resolve, options.backoffMs * attempt)
      );
    }
  }
  
  throw lastError!;
}
```

## 3. Event Bus Architecture

### Type-Safe Event System
```typescript
export class Bus {
  private static events = new Map<string, Set<Function>>();
  
  static event<T>(name: string, schema: z.ZodType<T>) {
    return {
      name,
      schema,
      publish: (data: T) => Bus.publish(name, data),
      subscribe: (handler: (data: T) => void) => Bus.subscribe(name, handler)
    };
  }
  
  static publish<T>(eventName: string, data: T): void {
    const handlers = this.events.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }
}

// Usage
export const SessionEvents = {
  Updated: Bus.event('session.updated', z.object({
    sessionId: z.string(),
    changes: z.record(z.any())
  })),
  
  Deleted: Bus.event('session.deleted', z.object({
    sessionId: z.string()
  }))
};
```

## 4. Migration System

### Schema Evolution Framework
```typescript
export interface Migration {
  version: number;
  name: string;
  up: (storageDir: string) => Promise<void>;
  down?: (storageDir: string) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'add-message-parts',
    up: async (dir) => {
      // Convert old message format to new format
      const messageFiles = await glob('session/message/*/*.json', { cwd: dir });
      for (const file of messageFiles) {
        const oldMessage = await readJSON(file);
        const newMessage = convertToNewFormat(oldMessage);
        await writeJSON(file, newMessage);
      }
    }
  },
  {
    version: 2,
    name: 'separate-message-parts',
    up: async (dir) => {
      // Split message parts into separate files
      const messageFiles = await glob('session/message/*/*.json', { cwd: dir });
      for (const file of messageFiles) {
        const message = await readJSON(file);
        if (message.parts) {
          for (const part of message.parts) {
            const partPath = file.replace('/message/', '/part/') + `/${part.id}.json`;
            await writeJSON(partPath, part);
          }
          delete message.parts;
          await writeJSON(file, message);
        }
      }
    }
  }
];

export async function runMigrations(storageDir: string): Promise<void> {
  const currentVersion = await getCurrentMigrationVersion(storageDir);
  
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      await migration.up(storageDir);
      await setMigrationVersion(storageDir, migration.version);
    }
  }
}
```

## 5. System Prompt Engineering

### Dynamic Prompt Construction
```typescript
export class SystemPrompt {
  private static segments = new Map<string, string>();
  
  static register(key: string, content: string): void {
    this.segments.set(key, content);
  }
  
  static build(context: {
    mode: string;
    userContext?: string;
    projectContext?: string;
    toolList?: string[];
  }): string {
    const parts = [];
    
    // Base prompt
    parts.push(this.segments.get('base') || '');
    
    // Mode-specific prompt
    if (context.mode && this.segments.has(`mode.${context.mode}`)) {
      parts.push(this.segments.get(`mode.${context.mode}`)!);
    }
    
    // Project context
    if (context.projectContext) {
      parts.push(`## Project Context\n${context.projectContext}`);
    }
    
    // Available tools
    if (context.toolList?.length) {
      parts.push(`## Available Tools\n${context.toolList.join(', ')}`);
    }
    
    return parts.filter(Boolean).join('\n\n');
  }
}

// Usage
SystemPrompt.register('base', `
You are Claude Code, an AI assistant that helps with software development.
You have access to various tools to read, write, and analyze code.
`);

SystemPrompt.register('mode.plan', `
You are in plan mode. Present your implementation plan and wait for user approval before making changes.
`);
```

## 6. Intelligent Caching System

### Multi-Level Cache Architecture
```typescript
export class CacheManager {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private diskCache: string;
  
  constructor(cacheDir: string) {
    this.diskCache = cacheDir;
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expires > Date.now()) {
      return memoryEntry.data;
    }
    
    // Check disk cache
    try {
      const diskPath = path.join(this.diskCache, `${key}.json`);
      const diskData = await fs.readFile(diskPath, 'utf-8');
      const parsed = JSON.parse(diskData);
      
      if (parsed.expires > Date.now()) {
        // Promote to memory cache
        this.memoryCache.set(key, parsed);
        return parsed.data;
      }
    } catch {
      // Cache miss
    }
    
    return null;
  }
  
  async set<T>(key: string, data: T, ttlMs: number = 300000): Promise<void> {
    const expires = Date.now() + ttlMs;
    const entry = { data, expires };
    
    // Store in memory
    this.memoryCache.set(key, entry);
    
    // Store on disk
    const diskPath = path.join(this.diskCache, `${key}.json`);
    await fs.mkdir(path.dirname(diskPath), { recursive: true });
    await fs.writeFile(diskPath, JSON.stringify(entry));
  }
}
```

## 7. Resource Management

### Automatic Cleanup System
```typescript
export class ResourceManager {
  private resources = new Map<string, { cleanup: () => Promise<void>; timeout: NodeJS.Timeout }>();
  
  register(
    id: string, 
    cleanup: () => Promise<void>, 
    timeoutMs: number = 300000
  ): void {
    // Clean up existing resource if any
    this.cleanup(id);
    
    const timeout = setTimeout(async () => {
      await this.cleanup(id);
    }, timeoutMs);
    
    this.resources.set(id, { cleanup, timeout });
  }
  
  async cleanup(id: string): Promise<void> {
    const resource = this.resources.get(id);
    if (resource) {
      clearTimeout(resource.timeout);
      try {
        await resource.cleanup();
      } catch (error) {
        console.error(`Error cleaning up resource ${id}:`, error);
      }
      this.resources.delete(id);
    }
  }
  
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.resources.keys()).map(id => this.cleanup(id));
    await Promise.allSettled(cleanupPromises);
  }
}

// Global cleanup on process exit
process.on('SIGINT', async () => {
  await ResourceManager.instance.cleanupAll();
  process.exit(0);
});
```

## 8. Performance Monitoring

### Built-in Metrics Collection
```typescript
export class MetricsCollector {
  private metrics = new Map<string, number[]>();
  
  time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    return fn().finally(() => {
      const duration = performance.now() - start;
      this.record(operation, duration);
    });
  }
  
  record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    
    const values = this.metrics.get(metric)!;
    values.push(value);
    
    // Keep only last 1000 measurements
    if (values.length > 1000) {
      values.shift();
    }
  }
  
  getStats(metric: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) return null;
    
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }
}
```

## Key Implementation Recommendations for lightfast-experimental

### 1. High Priority
- **Provider Auto-Detection**: Reduce configuration complexity
- **Context File Discovery**: Automatic project context loading
- **Enhanced Error Handling**: Structured errors with recovery strategies

### 2. Medium Priority  
- **Event Bus System**: Better observability and loose coupling
- **Migration Framework**: Safe schema evolution
- **Resource Management**: Automatic cleanup and memory management

### 3. Low Priority
- **Advanced Caching**: Performance optimization
- **Metrics Collection**: Performance monitoring
- **Dynamic Prompts**: Context-aware prompt engineering

These patterns would significantly enhance lightfast-experimental's robustness, developer experience, and maintainability while building on the existing strong foundation.