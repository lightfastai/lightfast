---
date: 2026-02-06T06:28:26+0000
researcher: Claude
git_commit: f17aeb87bd8bcd301d811ba7a9b5d15df668aabb
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Adopting @repo/chat-ai and @repo/chat-ai-types patterns for Console Answer"
tags: [research, codebase, chat-ai, chat-ai-types, console-answer, tool-patterns, type-system]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Adopting @repo/chat-ai and @repo/chat-ai-types patterns for Console Answer

**Date**: 2026-02-06T06:28:26+0000
**Researcher**: Claude
**Git Commit**: f17aeb87bd8bcd301d811ba7a9b5d15df668aabb
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Document the patterns in `@repo/chat-ai` and `@repo/chat-ai-types` packages and how they compare to the current console answer implementation at `apps/console/src/app/(api)/v1/answer/[...v]/` and `apps/console/src/components/answer-interface.tsx`.

## Summary

The `@repo/chat-ai` and `@repo/chat-ai-types` packages form the typed AI tool infrastructure for the `apps/chat` application. They establish a pattern of **explicit type definitions for tool inputs/outputs**, **typed tool UI parts via discriminated unions**, and **runtime context with tool-specific configuration**. The console's answer feature implements a parallel but less-typed version of the same architecture using `@lightfastai/ai-sdk` primitives (`createTool`, `createAgent`, `fetchRequestHandler`, `Memory`). Both systems share the same core SDK but diverge significantly in type safety, tool composition, and UI rendering patterns.

## Detailed Findings

### 1. Package Architecture: @repo/chat-ai-types

**Location**: `packages/chat-ai-types/src/`
**Exports**: Root (`index.ts`), `attachments`, `errors`, `feedback`, `models`, `validation`

The types package defines a **complete type system** for the chat experience:

#### Core Type Hierarchy (`packages/chat-ai-types/src/index.ts`)

```
LightfastRuntimeContext = RuntimeContext<AppRuntimeContext>
                        = SystemContext & RequestContext & AppRuntimeContext

Where:
  SystemContext   = { sessionId: string; resourceId: string }
  RequestContext  = { userAgent?: string; ipAddress?: string }
  AppRuntimeContext = {
    userId?: string;
    agentId: string;
    messageId?: string;
    dataStream?: UIMessageStreamWriter<UIMessage>;
    tools?: ToolRuntimeConfig;
  }
```

#### Tool Set Definition (`index.ts:119-128`)

```typescript
export type LightfastAppChatToolSet = {
  webSearch: {
    input: WebSearchToolInput;
    output: WebSearchToolOutput;
  };
  createDocument: {
    input: CreateDocumentToolInput;
    output: CreateDocumentToolOutput;
  };
}
```

This enables typed UI message construction:

```typescript
export type LightfastAppChatUIMessage = UIMessage<
  LightfastAppChatUIMessageMetadata,
  LightfastAppChatUICustomDataTypes,
  LightfastAppChatToolSet & UITools
>;
```

#### Typed Tool UI Parts (`index.ts:191-244`)

Each tool has a discriminated union over 4 states:

```typescript
type ToolUIPartState<TName extends string, TInput, TOutput> =
  | { type: `tool-${TName}`; state: "input-streaming"; input: DeepPartial<TInput> | undefined }
  | { type: `tool-${TName}`; state: "input-available"; input: TInput }
  | { type: `tool-${TName}`; state: "output-available"; input: TInput; output: TOutput }
  | { type: `tool-${TName}`; state: "output-error"; input: TInput | undefined; errorText: string }

export type WebSearchToolUIPart = ToolUIPartState<"webSearch", WebSearchToolInput, WebSearchToolOutput>;
export type CreateDocumentToolUIPart = ToolUIPartState<"createDocument", CreateDocumentToolInput, CreateDocumentToolOutput>;
```

#### Additional Shared Modules

| Module | Purpose |
|--------|---------|
| `attachments.ts` | Attachment constants (MAX_ATTACHMENT_COUNT=4, MAX_ATTACHMENT_BYTES=10MB), MIME helpers, sanitization |
| `errors.ts` | `ChatErrorType` enum (14 error types), `ApiErrorResponse`, `ChatError`, `ChatInlineError`, status code mapping |
| `feedback.ts` | `FeedbackData` (message ID → upvote/downvote), `FeedbackType` |
| `models.ts` | `ModelConfig`, `ProcessedModel<TId>`, `ModelFeatures`, `ThinkingConfig` |
| `validation.ts` | `PromptErrorCode`, `PromptError` |
| `message-loading.ts` | `MessageHistoryFetchState`, `MessageHistoryMeta`, char budgets |
| `message-metrics.ts` | `computeMessageCharCount()`, `createPreviewParts()` |

---

### 2. Package Architecture: @repo/chat-ai

**Location**: `packages/chat-ai/src/`
**Exports**: `./create-document`, `./web-search`

This package contains the **tool factory implementations** that consume `@repo/chat-ai-types`.

#### Web Search Tool (`packages/chat-ai/src/web-search.ts`)

- Imports types from `@repo/chat-ai-types`: `LightfastRuntimeContext`, `WebSearchToolInput`, `WebSearchToolOutput`
- Defines Zod schemas **typed to match the interfaces**: `const inputSchema: z.ZodType<WebSearchToolInput> = z.object({...})`
- Wraps execution with Braintrust tracing: `wrapTraced(async function executeWebSearch(...))`
- Accesses runtime config: `context.tools?.webSearch?.exaApiKey`
- Returns `ToolFactory<LightfastRuntimeContext>` via `createTool<LightfastRuntimeContext, typeof inputSchema, typeof outputSchema>`

#### Create Document Tool (`packages/chat-ai/src/create-document.ts`)

- Uses `context.dataStream` for artifact streaming (data-kind, data-id, data-title, data-clear, data-finish)
- Accesses handler config: `context.tools?.createDocument?.handlers`
- Delegates to artifact handler: `documentHandler.onCreateDocument({...})`

---

### 3. @lightfastai/ai-sdk Core Primitives

**Location**: `core/ai-sdk/src/`

This is the foundational SDK that both chat and console use.

#### createTool (`core/ai-sdk/src/core/primitives/tool.ts:44-72`)

```typescript
function createTool<
  TRuntimeContext = unknown,
  TInputSchema extends z.ZodType = z.ZodType,
  TOutputSchema extends z.ZodType = z.ZodType,
>(config: {
  description: string;
  inputSchema: TInputSchema;
  outputSchema?: TOutputSchema;
  execute: (input: z.infer<TInputSchema>, context: TRuntimeContext) => Promise<...>;
}): ToolFactory<TRuntimeContext>
```

Returns a factory function. When invoked with runtime context, produces a Vercel AI SDK `Tool`.

#### ToolFactory / ToolFactorySet (`tool.ts:8-18`)

```typescript
type ToolFactory<TRuntimeContext> = (context: TRuntimeContext) => AiTool;
type ToolFactorySet<TRuntimeContext> = Record<string, ToolFactory<TRuntimeContext>>;
```

#### createAgent (`core/ai-sdk/src/core/primitives/agent.ts:315-323`)

```typescript
function createAgent<
  TRuntimeContext = {},
  TTools extends ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
>(options: AgentOptions<TRuntimeContext, TTools>): Agent<TRuntimeContext, TTools>
```

AgentOptions combines LightfastConfig (name, system, tools, createRuntimeContext, cache) with VercelAIConfig (model, maxTokens, temperature, toolChoice, stopWhen, etc.).

#### fetchRequestHandler (`core/ai-sdk/src/core/server/adapters/fetch.ts:128-250`)

```typescript
function fetchRequestHandler<TAgent, TRequestContext, TFetchContext>(options: {
  agent: TAgent;
  sessionId: string;
  memory: Memory<UIMessage, TFetchContext>;
  req: Request;
  resourceId: string;
  body?: unknown;
  generateId?: () => string;
  enableResume?: boolean;
  onError?: (event) => void;
}): Promise<Response>
```

Handles POST (new message) and GET (resume stream) flows.

#### Memory Interface (`core/ai-sdk/src/core/memory/index.ts:8-40`)

```typescript
interface Memory<TMessage extends UIMessage = UIMessage, TContext = {}> {
  appendMessage(params: { sessionId; message; context? }): Promise<void>;
  getMessages(sessionId): Promise<TMessage[]>;
  createSession(params: { sessionId; resourceId; context? }): Promise<void>;
  getSession(sessionId): Promise<{ resourceId: string } | null>;
  createStream(params: { sessionId; streamId; context? }): Promise<void>;
  getSessionStreams(sessionId): Promise<string[]>;
  getActiveStream?(sessionId): Promise<string | null>;
  clearActiveStream?(sessionId): Promise<void>;
}
```

---

### 4. Console Answer Implementation (Current)

#### Answer API Route (`apps/console/src/app/(api)/v1/answer/[...v]/route.ts`)

- Uses `withDualAuth` for authentication (Clerk + API key), unlike chat's Clerk-only auth
- Extracts `agentId` and `sessionId` from URL path segments
- Creates agent: `createAgent<AnswerRuntimeContext, typeof answerTools>({...})`
- Context factory returns: `{ workspaceId, userId, authToken }`
- Model: `gateway("anthropic/claude-sonnet-4-20250514")`
- Memory: `AnswerRedisMemory` (1-hour TTL ephemeral Redis)
- Supports both POST (new message) and GET (resume)

#### Answer Runtime Context (`apps/console/src/ai/types.ts`)

```typescript
interface AnswerRuntimeContext {
  workspaceId: string;
  userId: string;
  authToken?: string;
}
type AnswerMessage = UIMessage;  // No custom metadata
```

#### Answer Tools (`apps/console/src/ai/tools/`)

Five tools, all following the same pattern:
- `workspaceSearch` - Semantic search via `searchLogic()`
- `workspaceContents` - Content fetch via `contentsLogic()`
- `workspaceFindSimilar` - Similar items via `findsimilarLogic()`
- `workspaceGraph` - Relationship traversal via `graphLogic()`
- `workspaceRelated` - Related events via `relatedLogic()`

Each tool:
- Uses `createTool<RuntimeContext<AnswerRuntimeContext>>({...})` (single generic)
- Defines `inputSchema` inline as `z.object({...})` without type annotation
- Does NOT provide `outputSchema`
- Casts context: `context as unknown as RuntimeContext<AnswerRuntimeContext>`
- Returns untyped result from logic functions

#### Answer UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `AnswerInterface` | `answer-interface.tsx` | Main container, uses `useChat` + `useAnswerTransport`, manages session/messages |
| `AnswerMessages` | `answer-messages.tsx` | Turn-based message rendering, builds user/assistant pairs |
| `AnswerPromptInput` | `answer-prompt-input.tsx` | Simplified prompt input without attachments/model select |
| `ToolCallRenderer` | `answer-tool-call-renderer.tsx` | Generic tool state dispatcher with string-based matching |
| `SearchToolResult` | `answer-tool-results.tsx` | Search output cards |
| `ContentsToolResult` | `answer-tool-results.tsx` | Content display |
| `FindSimilarToolResult` | `answer-tool-results.tsx` | Similar items display |
| `AskLightfastSuggestions` | `ask-lightfast-suggestions.tsx` | Prompt suggestion categories |
| Error utils | `answer-tool-error-utils.ts` | `formatToolErrorPayload()` for error display |

---

### 5. Pattern Comparison: Chat vs Console

#### Type Safety

| Aspect | Chat App | Console Answer |
|--------|----------|----------------|
| Tool input types | Separate interfaces (`WebSearchToolInput`) | Inline Zod schemas only |
| Tool output types | Separate interfaces (`WebSearchToolOutput`) | No output types |
| Tool UI parts | Discriminated unions (`WebSearchToolUIPart`) | Generic `ToolUIPart` |
| Message type | `LightfastAppChatUIMessage` with metadata generics | Bare `UIMessage` |
| Runtime context | `LightfastRuntimeContext` (named alias) | `RuntimeContext<AnswerRuntimeContext>` (inline) |
| createTool generics | 3 generics: `<Context, InputSchema, OutputSchema>` | 1 generic: `<Context>` |
| Context access | Direct property access | Requires `as unknown as` cast |

#### Tool Composition

| Aspect | Chat App | Console Answer |
|--------|----------|----------------|
| Tool location | `@repo/chat-ai` package | `apps/console/src/ai/tools/` |
| Type location | `@repo/chat-ai-types` package | `apps/console/src/ai/types.ts` |
| Assembly | `c010Tools` in `_lib/tools.ts` | `answerTools` in `tools/index.ts` |
| Runtime config | `tools: { createDocument: {...}, webSearch: {...} }` | None (tools call logic functions directly) |
| Observability | Braintrust tracing (`wrapTraced`) | None |

#### UI Rendering

| Aspect | Chat App | Console Answer |
|--------|----------|----------------|
| Tool rendering | Per-tool typed components | Generic dispatcher + result components |
| State handling | Each component handles all 4 states | Dispatcher handles loading/error, results only handle output |
| Error display | Typed error extraction | String-based `formatToolErrorPayload()` |
| Type guards | `isTextPart`, `isReasoningPart` from `@repo/chat-ai-types` | Locally defined `isTextPart`, `isReasoningPart`, `isToolPart` |

#### Transport

| Aspect | Chat App | Console Answer |
|--------|----------|----------------|
| Hook | `useChatTransport` | `useAnswerTransport` |
| Endpoint | `/api/v/${agentId}/${sessionId}` | `/v1/answer/answer-v1/${sessionId}` |
| Headers | `Content-Type` | `Content-Type`, `X-Workspace-ID` |
| Message sending | Last message only | Last message only |
| Resume | `prepareReconnectToStreamRequest` | `prepareReconnectToStreamRequest` |

---

### 6. @repo/chat-ai-types Consumer Map

These packages are **exclusively consumed by the chat ecosystem**:

| Consumer | Dependency |
|----------|-----------|
| `apps/chat` | `@repo/chat-ai`, `@repo/chat-ai-types` |
| `api/chat` | `@repo/chat-ai-types` |
| `db/chat` | `@repo/chat-ai-types` |
| `packages/chat-api-services` | `@repo/chat-ai-types` |
| `packages/chat-ai` | `@repo/chat-ai-types` |

**No console app files import from either package.**

## Code References

### @repo/chat-ai-types
- `packages/chat-ai-types/src/index.ts` - Core types (LightfastRuntimeContext, tool sets, UI parts, type guards)
- `packages/chat-ai-types/src/attachments.ts` - Attachment constraints and helpers
- `packages/chat-ai-types/src/errors.ts` - Error type system (ChatErrorType, ApiErrorResponse)
- `packages/chat-ai-types/src/feedback.ts` - Feedback types
- `packages/chat-ai-types/src/models.ts` - Model configuration types
- `packages/chat-ai-types/src/validation.ts` - Prompt validation types
- `packages/chat-ai-types/src/message-loading.ts` - Message history types and budgets
- `packages/chat-ai-types/src/message-metrics.ts` - Character counting and preview truncation

### @repo/chat-ai
- `packages/chat-ai/src/web-search.ts` - Web search tool with typed schemas and Braintrust tracing
- `packages/chat-ai/src/create-document.ts` - Document creation tool with artifact streaming

### @lightfastai/ai-sdk Core
- `core/ai-sdk/src/core/primitives/tool.ts` - `createTool`, `ToolFactory`, `ToolFactorySet`
- `core/ai-sdk/src/core/primitives/agent.ts` - `createAgent`, `Agent`, `AgentOptions`
- `core/ai-sdk/src/core/server/adapters/fetch.ts` - `fetchRequestHandler`
- `core/ai-sdk/src/core/server/adapters/types.ts` - `RuntimeContext`, `SystemContext`, `RequestContext`
- `core/ai-sdk/src/core/memory/index.ts` - `Memory` interface

### Console Answer Implementation
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` - API route (POST + GET)
- `apps/console/src/ai/types.ts` - AnswerRuntimeContext, AnswerMessage
- `apps/console/src/ai/tools/index.ts` - answerTools assembly
- `apps/console/src/ai/tools/search.ts` - workspaceSearch tool
- `apps/console/src/ai/tools/contents.ts` - workspaceContents tool
- `apps/console/src/ai/tools/find-similar.ts` - workspaceFindSimilar tool
- `apps/console/src/ai/tools/graph.ts` - workspaceGraph tool
- `apps/console/src/ai/tools/related.ts` - workspaceRelated tool
- `apps/console/src/ai/prompts/system-prompt.ts` - System prompt builder
- `apps/console/src/ai/runtime/memory.ts` - AnswerRedisMemory (1h TTL)
- `apps/console/src/ai/hooks/use-answer-transport.ts` - Transport hook
- `apps/console/src/components/answer-interface.tsx` - Main interface container
- `apps/console/src/components/answer-messages.tsx` - Turn-based message rendering
- `apps/console/src/components/answer-prompt-input.tsx` - Simplified prompt input
- `apps/console/src/components/answer-tool-call-renderer.tsx` - Generic tool dispatcher
- `apps/console/src/components/answer-tool-results.tsx` - Tool-specific result components
- `apps/console/src/components/answer-tool-error-utils.ts` - Error formatting utility
- `apps/console/src/components/ask-lightfast-suggestions.tsx` - Prompt suggestions

### Chat App Reference Implementation
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts` - Chat API route
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/tools.ts` - Tool assembly with types
- `apps/chat/src/app/(chat)/_components/chat-interface.tsx` - Chat interface
- `apps/chat/src/app/(chat)/_components/tool-call-renderer.tsx` - Typed tool rendering
- `apps/chat/src/app/(chat)/_components/web-search-tool.tsx` - Typed web search component
- `apps/chat/src/hooks/use-chat-transport.ts` - Chat transport hook

## Architecture Documentation

### Shared SDK Pattern (Both Apps)

```
createAgent<TContext, TTools>({
  name, system, tools,
  createRuntimeContext: () => TContext,
  model: gateway(modelId),
  ...vercelAIConfig
})
  → fetchRequestHandler({ agent, sessionId, memory, req, resourceId })
    → Agent.buildStreamParams()
      → mergeContext(systemContext, requestContext, agentContext)
      → resolveToolFactories(tools, mergedContext)
      → streamText(resolvedParams)
```

### Chat App Pattern (Fully Typed)

```
@repo/chat-ai-types          @repo/chat-ai              apps/chat
──────────────────           ──────────────              ─────────
WebSearchToolInput  ───────→ webSearchTool()  ──────→ c010Tools
WebSearchToolOutput          - typed schemas            - ToolFactorySet<RuntimeContext<AppRuntimeContext>>
WebSearchToolUIPart          - braintrust tracing
LightfastRuntimeContext      - context.tools access   route.ts
AppRuntimeContext                                      - createAgent<AppRuntimeContext, typeof c010Tools>
LightfastAppChatToolSet                               - createRuntimeContext with tool configs
LightfastAppChatUIMessage
                                                      tool-call-renderer.tsx
                                                      - toolPart as WebSearchToolUIPart
                                                      - per-tool typed components
```

### Console Answer Pattern (Loosely Typed)

```
apps/console/src/ai/types.ts    apps/console/src/ai/tools/    apps/console/src/components/
─────────────────────────────   ──────────────────────────    ──────────────────────────────
AnswerRuntimeContext             workspaceSearchTool()         ToolCallRenderer
- workspaceId                    - inline z.object()           - string-based state checks
- userId                         - no outputSchema             - TOOL_METADATA record
- authToken                      - context cast required       - generic dispatcher
AnswerMessage = UIMessage
                                answerTools                   SearchToolResult
                                - ToolFactorySet<...>         ContentsToolResult
                                                              FindSimilarToolResult
                                route.ts
                                - createAgent<AnswerRuntimeContext>
                                - inline context creation
```

## Historical Context (from thoughts/)

The following research documents provide additional context about the answer feature:

- `thoughts/shared/research/2026-02-06-answer-feature-ai-search-workspace.md` - Research on console search APIs as tool candidates
- `thoughts/shared/research/2026-02-06-answer-tool-call-renderer-rework.md` - Deep analysis comparing Console Answer tool rendering vs Chat App ToolCallRenderer
- `thoughts/shared/research/2026-02-06-answer-interface-layout-scroll-positioning.md` - Scroll positioning bug investigation
- `thoughts/shared/research/2026-02-06-answer-api-auth-token-propagation.md` - Auth token propagation analysis
- `thoughts/shared/research/2026-02-06-workspace-search-ask-lightfast-page-split.md` - Page splitting architecture
- `thoughts/shared/plans/2026-02-06-answer-feature-ai-search-workspace.md` - Implementation plan for AI search
- `thoughts/shared/plans/2026-02-06-answer-tool-call-renderer-rework.md` - Tool renderer rework plan
- `thoughts/shared/plans/2026-02-06-answer-direct-function-call-extraction.md` - Function extraction plan
- `thoughts/shared/plans/2026-02-06-workspace-search-ask-lightfast-page-split.md` - Page split plan

## Related Research

- `thoughts/shared/research/2026-02-06-answer-tool-call-renderer-rework.md` - Most directly related; compares the two rendering patterns in detail

## Open Questions

1. **Shared types package**: Should the console create a `@repo/console-answer-types` package (mirroring `@repo/chat-ai-types`), or extend the existing `@repo/console-types` package with answer-specific types?
2. **Tool implementations package**: Should console answer tools be extracted to a `@repo/console-answer-ai` package (mirroring `@repo/chat-ai`), or remain in `apps/console/src/ai/tools/`?
3. **Output schemas**: The console tools currently have no `outputSchema`. The return types from `searchLogic()`, `contentsLogic()`, etc. are already typed as `V1SearchResponse`, `V1ContentsResponse` in `@repo/console-types`. Should these be reused as Zod schemas?
4. **Tool runtime config**: Chat tools receive config via `context.tools` (e.g., API keys). Console tools call logic functions directly. Should console adopt the runtime config pattern, or is direct function calling appropriate for server-side-only tools?
5. **UI message metadata**: Console uses bare `UIMessage`. Should it adopt custom metadata (like `LightfastAppChatUIMessageMetadata`) for features like token counts, model IDs, or session tracking?
