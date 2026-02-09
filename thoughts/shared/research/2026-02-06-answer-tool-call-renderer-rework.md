---
date: 2026-02-06T06:04:08Z
researcher: Claude
git_commit: f17aeb87
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Rework console answer-messages tool calls to follow chat app's ToolCallRenderer pattern"
tags: [research, codebase, answer-messages, tool-call-renderer, chat-messages, ai-tools, console]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Console Answer Tool Call Rendering vs Chat App ToolCallRenderer Pattern

**Date**: 2026-02-06T06:04:08Z
**Researcher**: Claude
**Git Commit**: f17aeb87
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

How does the console `answer-messages.tsx` handle tool call rendering compared to the chat app's `chat-messages.tsx` `ToolCallRenderer` pattern, to inform a rework of the console approach?

## Summary

The console and chat apps use fundamentally different approaches to tool call rendering. The **chat app** uses a dedicated `ToolCallRenderer` component that receives typed `ToolUIPart` objects from the Vercel AI SDK, dispatches to specialized per-tool components (WebSearchTool, CreateDocumentTool), and handles a 4-state lifecycle (input-streaming, input-available, output-available, output-error). The **console app** uses an inline `renderToolResult()` function that only handles the final result (no loading/error states from the SDK), dispatches to flat data-display components (SearchToolResult, ContentsToolResult, etc.), and extracts tool results via unsafe type casting.

### Key Differences

| Aspect | Console (`answer-messages.tsx`) | Chat (`chat-messages.tsx`) |
|---|---|---|
| **Dispatcher** | Inline `renderToolResult()` function (line 51-87) | Dedicated `ToolCallRenderer` component |
| **Tool Part Type** | Generic `UIMessage["parts"][number]` with unsafe cast | Typed `ToolUIPart` from `@repo/chat-ai-types` |
| **State Machine** | No state awareness - only renders final `result` | Full 4-state: input-streaming → input-available → output-available / output-error |
| **Loading States** | Shows "Executing..." text | Animated icons (Sparkles, Loader2) with contextual labels |
| **Error Handling** | Try-catch around render, generic error text | Collapsible Accordion with formatted error details |
| **Per-Tool Renderers** | Flat data components in `answer-tool-results.tsx` | Full state-aware components (WebSearchTool, CreateDocumentTool) |
| **Tool UI Components** | None (raw divs) | `@repo/ui/components/ai-elements/tool.tsx` primitives |
| **Tool Name Extraction** | `part.type.replace("tool-", "")` | Same approach |
| **Result Extraction** | `(part as unknown as { result?: unknown }).result` | Direct `toolPart.state` / `toolPart.output` access |

## Detailed Findings

### 1. Chat App: ToolCallRenderer Architecture

**Location**: `apps/chat/src/app/(chat)/_components/tool-call-renderer.tsx:24-140`

**Structure**:
```
ToolCallRenderer (dispatcher)
├── WebSearchTool (specialized)
│   ├── input-streaming → Sparkles + "Preparing Web Search"
│   ├── input-available → Loader2 + "Web Search running"
│   ├── output-available → Accordion with results list
│   └── output-error → Accordion with formatted error
├── CreateDocumentTool (specialized)
│   ├── input-streaming → Loader2 + "Preparing document creation"
│   ├── input-available → Loader2 + "Creating document"
│   ├── output-available → Clickable card with artifact link
│   └── output-error → Accordion with formatted error
└── Generic Fallback
    ├── output-error → Accordion with error details + input preview
    └── default → Tool icon with name and first argument preview
```

**Props**: Receives typed `ToolUIPart` (from Vercel AI SDK) and `toolName` string.

**Integration Point** (`chat-messages.tsx:905-917`):
```typescript
if (isToolPart(part)) {
  const toolName = part.type.replace("tool-", "");
  return (
    <div key={`${message.id}-part-${index}`} className="w-full">
      <ToolCallRenderer
        toolPart={part as ToolUIPart}
        toolName={toolName}
        onArtifactClick={onArtifactClick}
      />
    </div>
  );
}
```

**Key Design**: Each specialized tool component implements a full state machine based on `toolPart.state`, providing appropriate visual feedback at every stage of tool execution.

### 2. Chat App: Type System (`@repo/chat-ai-types`)

**Location**: `packages/chat-ai-types/src/index.ts:191-244`

The `ToolUIPartState<TName, TInput, TOutput>` discriminated union models 4 states:

1. **`input-streaming`** (lines 192-199): Tool args being streamed. `input` is `DeepPartial<TInput> | undefined`.
2. **`input-available`** (lines 201-210): Full args received. `input` is complete `TInput`.
3. **`output-available`** (lines 211-221): Execution succeeded. Has `input: TInput` and `output: TOutput`.
4. **`output-error`** (lines 222-232): Execution failed. Has `errorText: string`, optional `input` and `rawInput`.

Concrete types:
- `WebSearchToolUIPart` (lines 240-244): Input `{ query, useAutoprompt?, numResults? }`, Output `{ results[], citationSources[], query }`
- `CreateDocumentToolUIPart` (lines 234-238): Input `{ title, kind }`, Output `{ id, title, kind, content }`

Type guard:
```typescript
export function isToolPart(part: LightfastAppChatUIMessagePart): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}
```

### 3. Chat App: Tool UI Primitives

**Location**: `packages/ui/src/components/ai-elements/tool.tsx`

Composable components used by specialized tool renderers:
- `Tool` (line 8-16): Container with border, shadow, rounded corners
- `ToolHeader` (line 20-25): Flex header with padding
- `ToolIcon` (line 29-37): 24x24 icon wrapper
- `ToolHeaderMain` (line 41-49): Flexible main area
- `ToolTitle` (line 53-55): Truncated title text
- `ToolDescription` (line 59-67): Muted description
- `ToolMeta` (line 71-73): Right-side metadata
- `ToolContent` (line 77-85): Bordered content section
- `ToolFooter` (line 89-94): Footer with border-top

### 4. Chat App: Error Utilities

**Location**: `apps/chat/src/app/(chat)/_components/tool-error-utils.ts:7-43`

`formatToolErrorPayload(errorText, fallback)` returns `{ formattedError: string, isStructured: boolean }`:
- Handles null/undefined, empty strings
- Detects and pretty-prints JSON errors
- Falls back to plain text display

Used consistently across all tool error states.

### 5. Console App: Current Tool Rendering (answer-messages.tsx)

**Location**: `apps/console/src/components/answer-messages.tsx:46-87, 218-242`

**isToolPart** (line 46-48):
```typescript
function isToolPart(part: UIMessage["parts"][number]): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}
```

**renderToolResult** (line 51-87): A switch-style function dispatching by tool name:
- `"search"` / `"workspaceSearch"` → `SearchToolResult`
- `"contents"` / `"workspaceContents"` → `ContentsToolResult`
- `"findsimilar"` / `"workspaceFindSimilar"` → `FindSimilarToolResult`
- `"graph"` / `"workspaceGraph"` → `GraphToolResult`
- `"related"` / `"workspaceRelated"` → `RelatedToolResult`
- Unknown → JSON fallback in `<pre>` block

**AssistantMessage tool rendering** (line 218-242):
```typescript
if (isToolPart(part)) {
  const toolName = part.type.replace("tool-", "");
  const result = (part as unknown as { result?: unknown }).result;
  return (
    <div className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-2 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Tool: {toolName}
      </div>
      {result ? (
        <div className="mt-1">{renderToolResult(toolName, result)}</div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Executing...</div>
      )}
    </div>
  );
}
```

**Key observations**:
- Result extraction uses double cast `(part as unknown as { result?: unknown }).result` — no type safety
- Only two states: has result → render, no result → "Executing..."
- No `toolPart.state` awareness (input-streaming, input-available, output-error)
- No collapsible error display
- No animated loading indicators
- "Tool: {toolName}" label shown as raw text in muted style
- Tool container is a plain div, not using Tool UI primitives

### 6. Console App: Tool Result Components (answer-tool-results.tsx)

**Location**: `apps/console/src/components/answer-tool-results.tsx:17-233`

These are **data display components** — they receive the final tool output and render it. They have no awareness of the tool execution lifecycle.

| Component | Props | Key Features |
|---|---|---|
| `SearchToolResult` (17-98) | `{ data: V1SearchResponse }` | Shows count, renders first 5 results as cards with rank, title, snippet, score, link |
| `ContentsToolResult` (103-145) | `{ data: V1ContentsResponse }` | Cards with item ID, content in scrollable pre block, optional external link |
| `FindSimilarToolResult` (150-201) | `{ data: V1FindSimilarResponse }` | Count, compact cards with title, metadata, score, link |
| `GraphToolResult` (206-217) | `{ data: unknown }` | JSON fallback in pre block |
| `RelatedToolResult` (222-233) | `{ data: unknown }` | JSON fallback in pre block |

All use `Card`/`CardContent` from `@repo/ui` and `Badge` for scores.

### 7. Console App: AI Tool Definitions

**Location**: `apps/console/src/ai/tools/`

Five tools registered as `ToolFactorySet` at `apps/console/src/ai/tools/index.ts:10-16`:

| Tool Name | File | Purpose | Key Params |
|---|---|---|---|
| `workspaceSearch` | `search.ts:10-72` | Semantic search across workspace events | `query`, `mode`, `limit`, `filters` |
| `workspaceContents` | `contents.ts:10-38` | Fetch full content by observation IDs | `ids: string[]` |
| `workspaceFindSimilar` | `find-similar.ts:10-51` | Find semantically similar content | `id`, `limit`, `threshold` |
| `workspaceGraph` | `graph.ts:10-51` | Traverse relationship graph | `id`, `depth`, `limit` |
| `workspaceRelated` | `related.ts:10-45` | Get directly related events | `id`, `limit` |

All use `createTool<RuntimeContext<AnswerRuntimeContext>>()` from `@lightfastai/ai-sdk/tool` with runtime context injection (workspaceId, userId, authToken).

### 8. Console App: Full Pipeline

1. User query → `AnswerInterface.handleSubmit()` → `answer-interface.tsx:40`
2. Transport sends to `/v1/answer/answer-v1/{sessionId}` → `use-answer-transport.ts:15`
3. API route authenticates, creates agent with 5 tools → `route.ts:68-80`
4. Agent streams response with tool calls → `@lightfastai/ai-sdk`
5. Tool parts arrive as `tool-workspaceSearch` etc. in message parts
6. `isToolPart()` identifies them → `answer-messages.tsx:218`
7. Result extracted via unsafe cast → `answer-messages.tsx:221`
8. `renderToolResult()` dispatches to component → `answer-messages.tsx:233`
9. Data component renders final output → `answer-tool-results.tsx`

## Code References

### Chat App (Reference Implementation)
- `apps/chat/src/app/(chat)/_components/tool-call-renderer.tsx:24-140` - ToolCallRenderer dispatcher
- `apps/chat/src/app/(chat)/_components/web-search-tool.tsx:51-185` - WebSearchTool 4-state renderer
- `apps/chat/src/app/(chat)/_components/create-document-tool.tsx:38-154` - CreateDocumentTool 4-state renderer
- `apps/chat/src/app/(chat)/_components/tool-error-utils.ts:7-43` - Error formatting utility
- `apps/chat/src/app/(chat)/_components/chat-messages.tsx:905-917` - Tool part integration
- `packages/chat-ai-types/src/index.ts:191-244` - ToolUIPartState type definitions
- `packages/ui/src/components/ai-elements/tool.tsx:8-94` - Tool UI primitives

### Console App (Current Implementation)
- `apps/console/src/components/answer-messages.tsx:46-48` - isToolPart guard
- `apps/console/src/components/answer-messages.tsx:51-87` - renderToolResult dispatcher
- `apps/console/src/components/answer-messages.tsx:218-242` - Inline tool rendering
- `apps/console/src/components/answer-tool-results.tsx:17-233` - Tool result components
- `apps/console/src/ai/tools/index.ts:10-16` - Tool registration
- `apps/console/src/ai/tools/search.ts:10-72` - workspaceSearch definition
- `apps/console/src/ai/tools/contents.ts:10-38` - workspaceContents definition
- `apps/console/src/ai/tools/find-similar.ts:10-51` - workspaceFindSimilar definition
- `apps/console/src/ai/tools/graph.ts:10-51` - workspaceGraph definition
- `apps/console/src/ai/tools/related.ts:10-45` - workspaceRelated definition

## Architecture Documentation

### Chat App ToolCallRenderer Pattern

```
Message Part (ToolUIPart)
  ↓
ToolCallRenderer (dispatcher component)
  ├── checks toolName
  │   ├── "webSearch" → WebSearchTool (4-state renderer)
  │   ├── "createDocument" → CreateDocumentTool (4-state renderer)
  │   └── fallback → generic renderer with error handling
  └── each renderer checks toolPart.state
      ├── input-streaming → animated loading with label
      ├── input-available → spinning loader with progress label
      ├── output-available → specialized data display (Accordion, Card, etc.)
      └── output-error → collapsible error with formatted details
```

### Console App Current Pattern

```
Message Part (unknown, cast via double-assert)
  ↓
Inline JSX block in AssistantMessage
  ├── extracts toolName (string replace)
  ├── extracts result (unsafe cast)
  └── conditional:
      ├── has result → renderToolResult(toolName, result)
      │   ├── "search"/"workspaceSearch" → SearchToolResult (data display)
      │   ├── "contents"/"workspaceContents" → ContentsToolResult (data display)
      │   ├── "findsimilar"/"workspaceFindSimilar" → FindSimilarToolResult (data display)
      │   ├── "graph"/"workspaceGraph" → GraphToolResult (JSON fallback)
      │   ├── "related"/"workspaceRelated" → RelatedToolResult (JSON fallback)
      │   └── unknown → JSON pre block
      └── no result → "Executing..." text
```

### Shared Components Available

Both apps can use these shared `@repo/ui` components:
- `Tool`, `ToolHeader`, `ToolIcon`, `ToolHeaderMain`, `ToolTitle` from `@repo/ui/components/ai-elements/tool`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@repo/ui/components/ui/accordion`
- `Card`, `CardContent` from `@repo/ui/components/ui/card`
- `Badge` from `@repo/ui/components/ui/badge`

### Console Tool Names vs Chat Tool Names

The console tools use `workspace`-prefixed names while the chat uses plain names:

| Console Tool Name | Chat Equivalent |
|---|---|
| `workspaceSearch` | `webSearch` |
| `workspaceContents` | _(no equivalent)_ |
| `workspaceFindSimilar` | _(no equivalent)_ |
| `workspaceGraph` | _(no equivalent)_ |
| `workspaceRelated` | _(no equivalent)_ |
| _(no equivalent)_ | `createDocument` |

The console `renderToolResult()` also handles unprefixed names (`"search"`, `"contents"`, etc.) for backwards compatibility.

## Open Questions

1. **Type System**: Should the console define its own `ToolUIPartState` types (like `chat-ai-types` does), or can it reuse/extend the existing `@repo/chat-ai-types` package?
2. **Tool State Availability**: Does the Vercel AI SDK stream `toolPart.state` transitions for the console's custom `@lightfastai/ai-sdk` tools the same way it does for chat tools? The console currently only checks for `result` existence — are state transitions available but unused?
3. **Graph/Related Rendering**: These two tools currently use JSON fallback. Should they get specialized renderers as part of this rework, or remain as JSON fallback with proper state handling?
4. **Tool Error Utils**: Should the `tool-error-utils.ts` from chat be moved to a shared package, or duplicated in console?
5. **Backward Compatibility**: The dual tool name support (`"search"` and `"workspaceSearch"`) — is this still needed after rework?
