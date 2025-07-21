# OpenCode Architecture Analysis

## Overview
OpenCode is a TypeScript CLI tool by SST that provides an AI-powered coding assistant. This analysis examines their tool call structure and memory system to inform improvements to the hal9000 project.

## Repository Structure
```
opencode/
├── packages/
│   ├── opencode/          # Main CLI package
│   │   ├── src/
│   │   │   ├── app/       # Application lifecycle
│   │   │   ├── session/   # Session management
│   │   │   ├── storage/   # Persistence layer
│   │   │   ├── tool/      # Tool implementations
│   │   │   └── provider/  # AI provider integrations
│   ├── tui/               # Terminal UI (Go)
│   └── web/               # Web interface (Astro)
```

## Tool Call Architecture

### 1. Tool Definition Pattern
Tools are defined using a clean namespace pattern with TypeScript:

```typescript
// Tool definition structure
export namespace Tool {
  interface Metadata {
    [key: string]: any
  }
  
  export type Context<M extends Metadata = Metadata> = {
    sessionID: string
    messageID: string
    abort: AbortSignal
    metadata(input: { title?: string; metadata?: M }): void
  }
  
  export interface Info<Parameters, M extends Metadata> {
    id: string
    description: string
    parameters: Parameters
    execute(
      args: Parameters,
      ctx: Context,
    ): Promise<{
      title: string
      metadata: M
      output: string
    }>
  }
}
```

### 2. Context Propagation
Every tool receives a context object containing:
- `sessionID`: Current conversation session identifier
- `messageID`: Current message being processed
- `abort`: AbortSignal for cancellation support
- `metadata()`: Function to update tool execution metadata in real-time

### 3. Tool Integration with AI SDK
Tools are wrapped into Vercel AI SDK tools with automatic context injection:

```typescript
tools[item.id] = tool({
  id: item.id,
  description: item.description,
  inputSchema: item.parameters as ZodSchema,
  async execute(args, options) {
    const result = await item.execute(args, {
      sessionID: input.sessionID,
      abort: abort.signal,
      messageID: assistantMsg.id,
      metadata: async (val) => {
        // Update tool execution metadata
      },
    })
    return result
  }
})
```

## Memory System Architecture

### 1. Storage Layer
The storage layer provides JSON-based file persistence with atomic writes:

```typescript
export namespace Storage {
  // Atomic write implementation
  export async function writeJSON<T>(key: string, content: T) {
    const target = path.join(dir, key + ".json")
    const tmp = target + Date.now() + ".tmp"
    await Bun.write(tmp, JSON.stringify(content, null, 2))
    await fs.rename(tmp, target).catch(() => {})
    await fs.unlink(tmp).catch(() => {})
    Bus.publish(Event.Write, { key, content })
  }
}
```

Key features:
- Atomic writes using temp file + rename pattern
- Event-driven updates via Bus system
- Support for migrations to handle schema evolution

### 2. State Management
OpenCode uses a singleton service pattern for state management:

```typescript
export function state<State>(
  key: any,
  init: (app: Info) => State,
  shutdown?: (state: Awaited<State>) => Promise<void>,
) {
  return () => {
    const app = ctx.use()
    const services = app.services
    if (!services.has(key)) {
      services.set(key, {
        state: init(app.info),
        shutdown,
      })
    }
    return services.get(key)?.state as State
  }
}
```

### 3. Session Management
Sessions use a hybrid approach with in-memory caching and disk persistence:

```typescript
const state = App.state("session", () => {
  const sessions = new Map<string, Info>()
  const messages = new Map<string, MessageV2.Info[]>()
  const pending = new Map<string, AbortController>()
  
  return { sessions, messages, pending }
})
```

### 4. Data Directory Structure
```
~/.local/share/opencode/project/{project-id}/
└── storage/
    ├── session/
    │   ├── info/          # Session metadata
    │   ├── message/       # Message content
    │   ├── part/          # Message parts (tools, text, etc.)
    │   └── share/         # Sharing information
    └── migration          # Migration version tracker
```

## Key Design Patterns

### 1. Lazy Loading with Caching
Sessions are loaded on-demand and cached in memory:

```typescript
export async function get(id: string) {
  const result = state().sessions.get(id)
  if (result) {
    return result
  }
  const read = await Storage.readJSON<Info>("session/info/" + id)
  state().sessions.set(id, read)
  return read as Info
}
```

### 2. Event-Driven Architecture
All state changes emit events for real-time UI updates:

```typescript
export const Event = {
  Updated: Bus.event("session.updated", z.object({ info: Info })),
  Deleted: Bus.event("session.deleted", z.object({ info: Info })),
}
```

### 3. Tool-Specific State
Tools can maintain their own state using the App.state pattern:

```typescript
const state = App.state("todo-tool", () => {
  const todos: {
    [sessionId: string]: TodoInfo[]
  } = {}
  return todos
})
```

## Security Considerations

1. **File Path Validation**: All file paths are normalized and validated
2. **Atomic Operations**: Prevents data corruption during writes
3. **Session Isolation**: Each session has its own storage namespace
4. **Abort Support**: All operations support cancellation via AbortSignal

## Performance Optimizations

1. **In-Memory Caching**: Frequently accessed data is cached
2. **Lazy Loading**: Data is loaded only when needed
3. **Batch Operations**: Multiple updates can be batched
4. **Event Coalescing**: Rapid updates are debounced

## Recommendations for hal9000

1. **Adopt Context Pattern**: Pass threadId and resourceId through tool context
2. **Implement Storage Layer**: Use atomic writes for reliability
3. **Add State Management**: Create singleton services for shared state
4. **Use Event System**: Enable real-time UI updates
5. **Design for Migration**: Plan for schema evolution from the start