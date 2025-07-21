# Corrected Analysis: OpenCode DOES Have TodoWrite and TodoRead Tools

## I Was Wrong - OpenCode DOES Use Tool Calls for Task Tracking!

After cloning the correct sst/opencode repository (not the opencode-ai/opencode I initially analyzed), I can confirm:

**OpenCode absolutely HAS TodoWriteTool and TodoReadTool and DOES use tool calls for task tracking.**

## OpenCode's Actual Todo Implementation

### 1. TodoWriteTool and TodoReadTool Exist

```typescript
// From src/tool/todo.ts
export const TodoWriteTool = Tool.define({
  id: "todowrite",
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(TodoInfo).describe("The updated todo list"),
  }),
  async execute(params, opts) {
    const todos = state()
    todos[opts.sessionID] = params.todos  // Session-scoped storage
    return {
      title: `${params.todos.filter(x => x.status !== "completed").length} todos`,
      output: JSON.stringify(params.todos, null, 2),
      metadata: { todos: params.todos },
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
      metadata: { todos },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
```

### 2. Task Schema

```typescript
const TodoInfo = z.object({
  content: z.string().min(1).describe("Brief description of the task"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  priority: z.enum(["high", "medium", "low"]),
  id: z.string().describe("Unique identifier for the todo item"),
})
```

### 3. Session-Scoped State Management

```typescript
const state = App.state("todo-tool", () => {
  const todos: {
    [sessionId: string]: TodoInfo[]  // Per-session todo storage
  } = {}
  return todos
})
```

## OpenCode's Task Management Philosophy

### Smart Usage Guidelines (from todowrite.txt)

**When TO Use Todo Tracking:**
1. **Complex multi-step tasks** - 3+ distinct steps or actions
2. **Non-trivial and complex tasks** - requiring careful planning
3. **User explicitly requests todo list**
4. **Multiple tasks** - numbered or comma-separated lists
5. **After receiving new instructions** - capture requirements as todos
6. **After completing tasks** - mark complete, add follow-ups

**When NOT to Use Todo Tracking:**
1. **Single, straightforward task**
2. **Trivial tasks** - no organizational benefit
3. **Less than 3 trivial steps**
4. **Purely conversational/informational**

### Key Insight: Intelligent Thresholds

OpenCode uses **smart decision-making** about when task tracking adds value:

> "NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly."

This is exactly what I was seeing in the system reminders that recommended complexity thresholds!

## How OpenCode Actually Handles Task Tracking

### 1. Tool-Based Updates (Not Manual)
- Agents **must use TodoWriteTool** to update tasks
- **Session-scoped storage** keeps todos isolated per conversation
- **Real-time updates** via tool calls

### 2. Mixed Approach: Tool Calls + Intelligence
- **Tool calls handle storage/updates** (like hal9000)
- **Agent intelligence decides when to use** (unlike hal9000's "always track")
- **Complexity threshold of 3+ steps** as guideline

### 3. State Management
- **Session-scoped**: `todos[opts.sessionID]`  
- **In-memory with App.state()**: Singleton pattern
- **Rich metadata**: Returns todo arrays for UI rendering

## Comparison: OpenCode vs hal9000

| Aspect | hal9000 | OpenCode | 
|--------|---------|----------|
| **Has Todo Tools** | ✅ TodoWrite | ✅ TodoWrite + TodoRead |
| **Tool-Based Updates** | ✅ Yes | ✅ Yes |
| **Session Scoping** | ✅ threadId | ✅ sessionID |
| **Intelligence Threshold** | ❌ No (always tracks) | ✅ Yes (3+ step rule) |
| **Usage Guidelines** | ❌ Basic | ✅ Detailed examples |
| **State Management** | ❌ External storage | ✅ App.state() pattern |

## The Real Difference

**OpenCode doesn't avoid tool calls for task tracking - they use the SAME approach as hal9000 but with better intelligence about WHEN to use it.**

The key insight is OpenCode's **smart usage guidelines** that prevent over-tracking simple tasks, while hal9000 currently tracks everything regardless of complexity.

## Implications for hal9000

1. **Keep the TodoWrite tool** - OpenCode validates this approach
2. **Add intelligence about when to use it** - implement the 3+ step threshold
3. **Improve usage guidelines** - adopt OpenCode's detailed instructions  
4. **Add TodoRead tool** - for better state visibility
5. **Consider App.state() pattern** - for cleaner state management

## Corrected Conclusion

OpenCode **does use tool calls** for task tracking via TodoWrite/TodoRead tools, just like hal9000. The difference is they're **smarter about when to use them** based on task complexity, not the mechanism itself.

The architectural pattern is validated - tool-based task tracking works well when combined with intelligent usage decisions.