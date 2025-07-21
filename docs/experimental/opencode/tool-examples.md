# OpenCode Tool Examples

## Overview
This document showcases specific tool implementations from OpenCode that demonstrate their patterns and practices.

## 1. Read Tool Implementation

```typescript
// packages/opencode/src/tool/read.ts
import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { App } from "../app/app"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

export const ReadTool = Tool.define({
  id: "read",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  async execute(params, ctx) {
    let filePath = params.filePath
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }

    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      // Provide helpful suggestions for typos
      const dir = path.dirname(filePath)
      const base = path.basename(filePath)
      const dirEntries = fs.readdirSync(dir)
      const suggestions = dirEntries
        .filter(entry =>
          entry.toLowerCase().includes(base.toLowerCase()) || 
          base.toLowerCase().includes(entry.toLowerCase())
        )
        .map(entry => path.join(dir, entry))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }
      throw new Error(`File not found: ${filePath}`)
    }

    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset || 0
    
    // Check if it's an image file
    const isImage = isImageFile(filePath)
    if (isImage) throw new Error(`This is an image file of type: ${isImage}\nUse a different tool to process images`)
    
    // Read and process file
    const lines = await file.text().then(text => text.split("\n"))
    const raw = lines.slice(offset, offset + limit).map(line => {
      return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    })
    
    // Format with line numbers
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    
    let output = "<file>\n"
    output += content.join("\n")
    
    if (lines.length > offset + content.length) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${offset + content.length})`
    }
    output += "\n</file>"

    // Track file access for the session
    LSP.touchFile(filePath, false)
    FileTime.read(ctx.sessionID, filePath)

    return {
      title: path.relative(App.info().path.root, filePath),
      output,
      metadata: {
        preview: raw.slice(0, 20).join("\n"),
      },
    }
  },
})
```

Key patterns:
- Path normalization and validation
- Helpful error messages with suggestions
- Session-aware file tracking
- Metadata for UI preview

## 2. Todo Tool with State Management

```typescript
// packages/opencode/src/tool/todo.ts
import { z } from "zod"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { App } from "../app/app"

const TodoInfo = z.object({
  content: z.string().min(1).describe("Brief description of the task"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
  priority: z.enum(["high", "medium", "low"]).describe("Priority level of the task"),
  id: z.string().describe("Unique identifier for the todo item"),
})
type TodoInfo = z.infer<typeof TodoInfo>

// Session-scoped state management
const state = App.state("todo-tool", () => {
  const todos: {
    [sessionId: string]: TodoInfo[]
  } = {}
  return todos
})

export const TodoWriteTool = Tool.define({
  id: "todowrite",
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(TodoInfo).describe("The updated todo list"),
  }),
  async execute(params, opts) {
    const todos = state()
    todos[opts.sessionID] = params.todos
    return {
      title: `${params.todos.filter(x => x.status !== "completed").length} todos`,
      output: JSON.stringify(params.todos, null, 2),
      metadata: {
        todos: params.todos,
      },
    }
  },
})

export const TodoReadTool = Tool.define({
  id: "todoread",
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  async execute(_params, opts) {
    const todos = state()[opts.sessionID] ?? []
    return {
      title: `${todos.filter(x => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
```

Key patterns:
- Session-scoped state isolation
- Singleton service pattern
- Rich metadata for UI rendering

## 3. Write Tool with Safety Checks

```typescript
// packages/opencode/src/tool/write.ts
export const WriteTool = Tool.define({
  id: "write",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to write"),
    content: z.string().describe("The content to write to the file"),
  }),
  async execute(params, ctx) {
    let filePath = params.filePath
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }

    const file = Bun.file(filePath)
    const exists = await file.exists()
    
    // Ensure file has been read before writing (safety check)
    if (exists) await FileTime.assert(ctx.sessionID, filePath)

    // Create directory if needed
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Write the file
    await Bun.write(filePath, params.content)
    
    // Update file tracking
    FileTime.read(ctx.sessionID, filePath)
    LSP.touchFile(filePath)

    // Calculate statistics
    const lines = params.content.split("\n").length
    const size = new Blob([params.content]).size
    
    return {
      title: path.relative(App.info().path.root, filePath),
      output: `File ${exists ? "updated" : "created"} successfully (${lines} lines, ${size} bytes)`,
      metadata: {
        existed: exists,
        lines,
        size,
      },
    }
  },
})
```

Key patterns:
- File access tracking per session
- Safety checks before overwriting
- Rich metadata for operation results

## 4. Task Tool (Nested Agent Execution)

```typescript
// packages/opencode/src/tool/task.ts
export const TaskTool = Tool.define({
  id: "task",
  description: DESCRIPTION,
  parameters: z.object({
    description: z.string().describe("A short (3-5 word) description of the task"),
    prompt: z.string().describe("The task for the agent to perform"),
  }),
  async execute(params, ctx) {
    // Create a child session for the task
    const session = await Session.create(ctx.sessionID)
    const msg = await Session.getMessage(ctx.sessionID, ctx.messageID)
    if (msg.role !== "assistant") throw new Error("Not an assistant message")

    const messageID = Identifier.ascending("message")
    
    // Execute the task in a child session
    const result = await Session.chat({
      sessionID: session.id,
      messageID,
      providerID: Provider.OpenCode.id,
      modelID: msg.model,
      parts: [
        {
          type: "text",
          text: params.prompt,
        },
      ],
      stream: false,
    })

    // Process results
    const parts = []
    for await (const chunk of result) {
      parts.push(...chunk.parts)
    }

    const output = parts
      .filter(part => part.type === "text")
      .map(part => part.text)
      .join("")

    return {
      title: params.description,
      output,
      metadata: {
        sessionID: session.id,
        providerID: Provider.OpenCode.id,
        modelID: msg.model,
      },
    }
  },
})
```

Key patterns:
- Hierarchical session management
- Preserving context across nested executions
- Rich metadata for tracing

## 5. Tool Execution in Session Context

```typescript
// How tools are wrapped and executed in session/index.ts
for (const item of await Provider.tools(input.providerID)) {
  if (mode.tools[item.id] === false) continue
  if (input.tools?.[item.id] === false) continue
  if (session.parentID && item.id === "task") continue
  
  tools[item.id] = tool({
    id: item.id as any,
    description: item.description,
    inputSchema: item.parameters as ZodSchema,
    async execute(args, options) {
      const result = await item.execute(args, {
        sessionID: input.sessionID,
        abort: abort.signal,
        messageID: assistantMsg.id,
        metadata: async (val) => {
          const match = processor.partFromToolCall(options.toolCallId)
          if (match && match.state.status === "running") {
            await updatePart({
              ...match,
              state: {
                title: val.title,
                metadata: val.metadata,
                status: "running",
                input: args,
                time: {
                  start: Date.now(),
                },
              },
            })
          }
        },
      })
      return result
    },
    toModelOutput(result) {
      return {
        type: "text",
        value: result.output,
      }
    },
  })
}
```

Key patterns:
- Automatic context injection
- Real-time metadata updates
- Tool filtering based on mode and session type

## Tool Best Practices from OpenCode

1. **Always validate input paths**: Normalize to absolute paths
2. **Track file access**: Use FileTime service for session-aware tracking
3. **Provide helpful errors**: Include suggestions when operations fail
4. **Return rich metadata**: Enable better UI rendering
5. **Use session context**: Isolate state and operations per session
6. **Support cancellation**: Respect abort signals
7. **Update in real-time**: Use metadata callback for progress updates

## Comparison with hal9000 Current Implementation

### Current hal9000 Pattern:
```typescript
export const myTool = createTool({
  id: "my-tool",
  execute: async ({ data }) => {
    // No context about session/thread
    return { result: "..." }
  }
})
```

### Proposed hal9000 Pattern (OpenCode-inspired):
```typescript
export const myTool = createToolWithContext({
  id: "my-tool",
  execute: async ({ data }, context) => {
    const { threadId, resourceId } = context
    
    // Use context for scoped operations
    await trackUsage(threadId, 'my-tool')
    
    // Update progress in real-time
    context.metadata?.({
      title: "Processing...",
      metadata: { progress: 0.5 }
    })
    
    return {
      title: "Operation complete",
      output: "...",
      metadata: { threadId, resourceId }
    }
  }
})
```

This pattern enables:
- Thread-aware operations
- Real-time progress updates
- Better debugging and tracing
- Isolated state management