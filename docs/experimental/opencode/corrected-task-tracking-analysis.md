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

## OpenCode's Task Tracking Prompt Engineering

### Core Prompt Strategy

OpenCode embeds task tracking instructions directly in their main system prompt (`anthropic.txt`):

```
# Task Management
You have access to the TodoWrite and TodoRead tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.
```

### Key Prompt Engineering Techniques

#### 1. Strong Language for Importance
- **"VERY frequently"** - emphasizes high usage
- **"EXTREMELY helpful"** - reinforces value
- **"unacceptable"** - creates consequence for not using

#### 2. Specific Usage Examples
Provides detailed examples showing the expected flow:

```
<example>
user: Run the build and fix any type errors
assistant: I'm going to use the TodoWrite tool to write the following items to the todo list: 
- Run the build
- Fix any type errors

I'm now going to run the build using Bash.

Looks like I found 10 type errors. I'm going to use the TodoWrite tool to write 10 items to the todo list.

marking the first todo as in_progress

Let me start working on the first item...

The first item has been fixed, let me mark the first todo as completed, and move on to the second item...
</example>
```

#### 3. Behavioral Requirements
- **"mark todos as completed as soon as you are done"**
- **"Do not batch up multiple tasks"**
- **"giving the user visibility into your progress"**

#### 4. Workflow Integration
Embeds todo usage into standard task workflow:

```
# Doing tasks
The user will primarily request you perform software engineering tasks...
- Use the TodoWrite tool to plan the task if required
- Use the available search tools to understand the codebase
- Implement the solution using all tools available to you
- Verify the solution if possible with tests
```

#### 5. Mandatory Usage Declaration
At the end of the prompt:

```
IMPORTANT: Always use the TodoWrite tool to plan and track tasks throughout the conversation.
```

### Beast Mode Enhancement

In `beast.txt`, OpenCode adds even stronger task tracking requirements:

```
You MUST iterate and keep going until the problem is solved.

Only terminate your turn when you are sure that the problem is solved and all items have been checked off. Use the TodoWrite and TodoRead tools to track and manage steps.

You MUST use the ToolRead tool to verify that all steps are complete or cancelled before ending your turn. If any steps are incomplete, you MUST continue working on them until they are all complete.
```

### Prompt Engineering Lessons

1. **Embed in main prompt** - Don't rely on separate instructions
2. **Use strong emotional language** - "unacceptable", "critical", "MUST"
3. **Provide concrete examples** - Show expected interaction patterns
4. **Integrate with workflows** - Make it part of standard procedures
5. **Add verification requirements** - Force checking completion state
6. **Repeat key messages** - Multiple reinforcement points

## Corrected Conclusion

OpenCode **does use tool calls** for task tracking via TodoWrite/TodoRead tools, just like hal9000. The difference is they're **smarter about when to use them** based on task complexity, plus they use **stronger prompt engineering** to ensure consistent usage.

The architectural pattern is validated - tool-based task tracking works well when combined with intelligent usage decisions and effective prompt engineering techniques.