# Answer Tool Call Renderer Rework — Implementation Plan

## Overview

Rework the console's `answer-messages.tsx` tool call rendering to follow the chat app's `ToolCallRenderer` pattern: a dedicated dispatcher component with proper Vercel AI SDK state handling (`input-streaming`, `input-available`, `output-available`, `output-error`), type-safe tool part access, and shared `@repo/ui` Tool primitives.

## Current State Analysis

The console app renders tool calls inline in `AssistantMessage` with:
- **Unsafe type casting**: `(part as unknown as { result?: unknown }).result` — the SDK provides `output` on `state === 'output-available'`, not `result`
- **Binary state**: Only "has result" vs "Executing..." — ignores 4-state lifecycle
- **No error handling**: Tool errors render as "Executing..." forever
- **Raw divs**: Doesn't use `Tool`/`ToolHeader`/`ToolIcon` primitives from `@repo/ui`
- **Inline dispatch**: `renderToolResult()` function inside the message file instead of a dedicated component

### Key Discoveries:
- `ai@5.0.15` `ToolUIPart` provides `state` discriminated union automatically for all registered tools — **available but unused** (`answer-messages.tsx:221`)
- Chat app's `ToolCallRenderer` at `apps/chat/src/app/(chat)/_components/tool-call-renderer.tsx:24-140` is the reference pattern
- Shared Tool UI primitives at `packages/ui/src/components/ai-elements/tool.tsx:8-94` are ready to use
- `tool-error-utils.ts` (43 lines) is chat-local but generic — should be duplicated in console
- Console tools are: `workspaceSearch`, `workspaceContents`, `workspaceFindSimilar`, `workspaceGraph`, `workspaceRelated`
- Existing result components (`SearchToolResult`, `ContentsToolResult`, `FindSimilarToolResult`) are good data displays — they stay, wrapped in state-aware containers

## Desired End State

After this plan is complete:

1. A dedicated `ToolCallRenderer` component in `apps/console/src/components/answer-tool-call-renderer.tsx` dispatches tool parts by name
2. Each tool has proper 4-state rendering (loading → running → result/error) using Vercel AI SDK `ToolUIPart.state`
3. Tool parts are accessed via `toolPart.state` / `toolPart.output` / `toolPart.input` — no unsafe casts
4. Loading states show animated icons (Sparkles for streaming, Loader2 for executing) with contextual labels like "Searching workspace..."
5. Errors show in collapsible Accordion with formatted details
6. `@repo/ui` Tool primitives (`Tool`, `ToolHeader`, `ToolIcon`, etc.) are used for consistent styling
7. `answer-messages.tsx` is simplified — the tool rendering block delegates entirely to the new renderer

### Verification:
- `pnpm build:console` passes
- `pnpm lint && pnpm typecheck` pass
- Tool calls display correct loading → result transitions in the UI
- Tool errors display in collapsible accordion instead of hanging on "Executing..."

## What We're NOT Doing

- **Not creating a shared types package** for console tool UI parts — the `ai` SDK's `ToolUIPart` is sufficient
- **Not moving `tool-error-utils` to a shared package** — duplicating in console (43 lines, no shared consumer)
- **Not building specialized renderers for Graph/Related** — they keep JSON fallback, but gain state handling
- **Not removing existing result components** — `SearchToolResult`, `ContentsToolResult`, `FindSimilarToolResult` stay as data displays
- **Not changing the AI tool definitions** or server-side behavior
- **Not supporting unprefixed tool names** (`"search"`, `"contents"`) — only the registered `"workspaceSearch"` etc. names flow from the SDK

## Implementation Approach

Create three new files and modify one existing file:

1. **`answer-tool-error-utils.ts`** — Error formatting utility (copied from chat, adapted)
2. **`answer-tool-call-renderer.tsx`** — Dispatcher component with per-tool state rendering
3. **Modify `answer-messages.tsx`** — Replace inline tool rendering with `ToolCallRenderer`
4. **Clean up `answer-tool-results.tsx`** — Remove `GraphToolResult` and `RelatedToolResult` (JSON fallback moves into renderer)

## Phase 1: Error Utility and Tool Call Renderer

### Overview
Create the error formatting utility and the main `ToolCallRenderer` component that handles all 5 console tools with proper 4-state rendering.

### Changes Required:

#### 1. Create Error Utility
**File**: `apps/console/src/components/answer-tool-error-utils.ts` (new)
**Changes**: Copy `formatToolErrorPayload` from chat app — it's generic and 43 lines.

```typescript
interface FormattedToolError {
  formattedError: string;
  isStructured: boolean;
}

export function formatToolErrorPayload(
  errorText: unknown,
  fallback: string,
): FormattedToolError {
  if (errorText === undefined || errorText === null) {
    return { formattedError: fallback, isStructured: false };
  }

  if (typeof errorText === "string") {
    const trimmed = errorText.trim();
    if (!trimmed) {
      return { formattedError: fallback, isStructured: false };
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return {
          formattedError: JSON.stringify(JSON.parse(trimmed), null, 2),
          isStructured: true,
        };
      } catch {
        return { formattedError: trimmed, isStructured: false };
      }
    }

    return { formattedError: trimmed, isStructured: false };
  }

  try {
    return {
      formattedError: JSON.stringify(errorText, null, 2),
      isStructured: true,
    };
  } catch {
    return { formattedError: fallback, isStructured: false };
  }
}
```

#### 2. Create Tool Call Renderer
**File**: `apps/console/src/components/answer-tool-call-renderer.tsx` (new)
**Changes**: A dispatcher component that:
- Receives `ToolUIPart` (typed from `ai` SDK) and `toolName` string
- Has per-tool metadata (display name, icon, loading label)
- Switches on `toolPart.state` for the 4-state lifecycle
- Delegates `output-available` state to existing result components
- Uses `@repo/ui` Tool primitives for container/header
- Shows collapsible Accordion for errors

The component structure:

```
ToolCallRenderer (props: { toolPart: ToolUIPart, toolName: string })
├── input-streaming → Tool + ToolHeader with Sparkles + "{displayName}..."
├── input-available → Tool + ToolHeader with Loader2 + "{loadingLabel}"
├── output-error → Accordion with AlertCircle + formatted error
└── output-available → dispatch to:
    ├── workspaceSearch → SearchToolResult
    ├── workspaceContents → ContentsToolResult
    ├── workspaceFindSimilar → FindSimilarToolResult
    ├── workspaceGraph → JSON accordion
    └── workspaceRelated → JSON accordion
```

Tool metadata map:

| Tool Name | Display Name | Loading Label | Icon |
|---|---|---|---|
| `workspaceSearch` | "Search" | "Searching workspace..." | `Search` |
| `workspaceContents` | "Contents" | "Fetching content..." | `FileText` |
| `workspaceFindSimilar` | "Find Similar" | "Finding similar..." | `Layers` |
| `workspaceGraph` | "Graph" | "Traversing relationships..." | `GitBranch` |
| `workspaceRelated` | "Related" | "Finding related events..." | `Link` |

For `output-available`, the renderer extracts `toolPart.output` (type-safe) and passes it to the appropriate result component. For `workspaceGraph` and `workspaceRelated`, it renders the output inside a collapsible Accordion with JSON formatting (same visual as current but with proper state handling).

Input preview for loading states: extract `toolPart.input` to show contextual info — e.g., for search show the query string, for contents show the IDs, for graph/related show the observation ID.

#### 3. Modify answer-messages.tsx
**File**: `apps/console/src/components/answer-messages.tsx`
**Changes**:
- Import `ToolCallRenderer` from `./answer-tool-call-renderer`
- Import `ToolUIPart` type from `ai`
- Remove `renderToolResult` function (lines 51-87)
- Remove imports of individual tool result components (lines 29-34)
- Replace the inline tool rendering block (lines 218-242) with:

```typescript
if (isToolPart(part)) {
  const toolName = part.type.replace("tool-", "");
  return (
    <div key={`${message.id}-tool-${index}`} className="w-full">
      <ToolCallRenderer
        toolPart={part as ToolUIPart}
        toolName={toolName}
      />
    </div>
  );
}
```

This is the same integration pattern used by the chat app at `chat-messages.tsx:905-917`.

#### 4. Clean up answer-tool-results.tsx
**File**: `apps/console/src/components/answer-tool-results.tsx`
**Changes**:
- Remove `GraphToolResult` component (lines 206-217) — JSON fallback moves into `ToolCallRenderer`
- Remove `RelatedToolResult` component (lines 222-233) — same reason
- Keep `SearchToolResult`, `ContentsToolResult`, `FindSimilarToolResult` — they remain as data display components

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build:console` passes with no errors
- [x] `pnpm --filter @lightfast/console typecheck` passes
- [x] `pnpm --filter @lightfast/console lint` passes

#### Manual Verification:
- [ ] Tool calls in answer interface show loading state with animated icon while executing
- [ ] Search tool shows "Searching workspace..." with query preview during execution
- [ ] Tool results display correctly after execution completes (same data, better container)
- [ ] Simulated tool errors (if possible) display in collapsible Accordion
- [ ] No regressions in existing answer interface behavior (text, reasoning parts still work)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

## Testing Strategy

### Manual Testing Steps:
1. Navigate to a workspace in the console app
2. Use the answer/search feature to ask a question that triggers workspace tools
3. Observe that tool calls show animated loading states (not just "Executing...")
4. Observe that search results display in the same card format as before, but inside Tool UI primitives
5. Verify that the streaming text around tool calls still renders correctly

## Performance Considerations

- No additional API calls or data fetching — this is purely a rendering change
- The `memo()` pattern from existing result components is preserved
- The ToolCallRenderer does a simple string switch — negligible overhead

## References

- Research: `thoughts/shared/research/2026-02-06-answer-tool-call-renderer-rework.md`
- Chat ToolCallRenderer: `apps/chat/src/app/(chat)/_components/tool-call-renderer.tsx:24-140`
- Chat WebSearchTool: `apps/chat/src/app/(chat)/_components/web-search-tool.tsx:51-185`
- Tool error utils: `apps/chat/src/app/(chat)/_components/tool-error-utils.ts:7-43`
- Tool UI primitives: `packages/ui/src/components/ai-elements/tool.tsx:8-94`
- Console answer messages: `apps/console/src/components/answer-messages.tsx`
- Console tool results: `apps/console/src/components/answer-tool-results.tsx`
- Console tool definitions: `apps/console/src/ai/tools/index.ts:10-16`
- AI SDK ToolUIPart type: `node_modules/ai/dist/index.d.ts` (lines 1440-1474)
