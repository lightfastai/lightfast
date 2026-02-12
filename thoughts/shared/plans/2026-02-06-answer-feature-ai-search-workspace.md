# Answer Feature: AI-Powered Search for Console Workspace

## Overview

Transform the console workspace search page into a dual-mode interface: (1) **Direct Search** — the existing structured search, and (2) **Answer** — an AI chat that uses the 5 existing search/retrieval APIs as tools to answer questions about the workspace. Follows the exact architecture of `apps/chat/src/ai/` with ephemeral Redis memory (TTL-based sessions).

## Current State Analysis

### What Exists
- **5 search APIs** in `apps/console/src/app/(api)/v1/` — search, contents, findsimilar, graph, related
- **Workspace search UI** at `apps/console/src/components/workspace-search.tsx` — full client-side search with URL-persisted filters via nuqs
- **Chat app blueprint** at `apps/chat/src/ai/` — complete agent, tools, memory, prompts, transport architecture
- **AI SDK primitives** in `core/ai-sdk/` — `createAgent()`, `createTool()`, `streamChat()`, `fetchRequestHandler()`, `Memory` interface, `RedisMemory` adapter
- **PromptInput components** in `@repo/ui` — composable prompt input with textarea, toolbar, submit
- **Console types** in `packages/console-types/src/api/v1/` — Zod schemas for all API inputs/outputs
- **MCP definitions** at `core/mcp/src/server.ts` — already wraps 3 of 5 APIs as tools (validates tool-callable design)

### Key Discoveries
- Console has NO `@lightfastai/ai-sdk` or `@ai-sdk/react` dependency yet — needs adding
- `@vendor/upstash` provides Redis client (`vendor/upstash/src/index.ts:5`) but the console doesn't import it directly
- The `core/ai-sdk` already exports `RedisMemory` adapter (`core/ai-sdk/src/core/memory/adapters/redis.ts`) with `getActiveStream()`/`clearActiveStream()` — perfect for ephemeral sessions
- Workspace store is fetched via `orgTrpc.workspace.store.get` returning embedding config and document count
- All console APIs use `withDualAuth()` — supports both API key and Clerk session; session auth requires `X-Workspace-ID` header

## Desired End State

A workspace page with two modes accessible via a toggle in the prompt input:

1. **Direct Search mode** (default): User types query → calls `/v1/search` directly → displays search results list. No AI involved. This is essentially what exists today but driven from the new prompt input.

2. **Answer mode**: User types a natural language question → streams to an AI agent → agent uses 5 tools (search, contents, findsimilar, graph, related) to answer → response streams back with citations and tool call results inline.

### Verification
- Toggle between modes in the UI; Direct Search returns structured results, Answer streams AI responses
- AI can invoke all 5 tools and synthesize results with citations
- Sessions persist in Redis with 1h TTL, clearing automatically
- Streaming works with smooth animation, identical to `apps/chat`

## What We're NOT Doing

- **Persistent chat history** — V1 is ephemeral Redis only (no PlanetScale memory)
- **File attachments** — no attachment support in Answer prompt input
- **Artifact generation** — no createDocument-style artifacts
- **Model selection** — hardcoded to a single model (Claude Sonnet via AI Gateway)
- **Guards/billing** — no usage limits or guard system for V1
- **Authentication changes** — reuses existing `withDualAuth()` pattern
- **Modifying existing search APIs** — tools call them via internal fetch, not by importing their logic

## Implementation Approach

Mirror the `apps/chat/src/ai/` directory structure inside `apps/console/src/ai/`. Tools are thin wrappers that call the existing `/v1/*` APIs via internal fetch (same server, same auth). The workspace page gets a new component that composes the shared PromptInput with a mode toggle.

---

## Phase 1: AI Backend — Agent, Tools, Memory, Route

### Overview
Create the server-side AI infrastructure: tool definitions, agent config, memory adapter, system prompt, and API route handler.

### Changes Required:

#### 1. Console AI Types
**File**: `apps/console/src/ai/types.ts` (new)
**Changes**: Define the runtime context and tool types for the Answer agent.

```typescript
import type { UIMessage } from "ai";

/** Runtime context injected per-request into Answer tools */
export interface AnswerRuntimeContext {
  workspaceId: string;
  userId: string;
}

/** Context passed through memory operations */
export interface AnswerMemoryContext {
  workspaceId: string;
}

/** Answer-specific message type (standard UIMessage for V1) */
export type AnswerMessage = UIMessage;
```

#### 2. Tool Definitions (5 tools)
**File**: `apps/console/src/ai/tools/search.ts` (new)
**Changes**: Wrap `/v1/search` API as an AI tool.

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { V1SearchRequestSchema } from "@repo/console-types/api/v1/search";
import { z } from "zod";
import type { AnswerRuntimeContext } from "../types";

export function workspaceSearchTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description: "Search through workspace neural memory for relevant documents and observations. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema: z.object({
      query: z.string().describe("The search query text"),
      mode: z.enum(["fast", "balanced", "thorough"]).default("balanced").describe("Search quality mode"),
      limit: z.number().int().min(1).max(20).default(10).describe("Max results"),
      filters: z.object({
        sourceTypes: z.array(z.string()).optional().describe("Filter by source: github, linear, vercel, sentry"),
        observationTypes: z.array(z.string()).optional().describe("Filter by type: commit, pull_request, issue, deployment"),
        actorNames: z.array(z.string()).optional().describe("Filter by actor name"),
      }).optional(),
    }),
    execute: async (input, context) => {
      const { workspaceId } = context as unknown as { workspaceId: string };
      const res = await fetch(`${getBaseUrl()}/v1/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-ID": workspaceId,
          // Internal server-to-server; auth handled at Answer route level
        },
        body: JSON.stringify({
          ...input,
          includeContext: true,
          includeHighlights: true,
        }),
      });
      const data = await res.json();
      return data;
    },
  });
}
```

Similar pattern for 4 more tools:

**File**: `apps/console/src/ai/tools/contents.ts` (new) — wraps `/v1/contents`
**File**: `apps/console/src/ai/tools/find-similar.ts` (new) — wraps `/v1/findsimilar`
**File**: `apps/console/src/ai/tools/graph.ts` (new) — wraps `/v1/graph/[id]` (GET with query params)
**File**: `apps/console/src/ai/tools/related.ts` (new) — wraps `/v1/related/[id]` (GET)

**File**: `apps/console/src/ai/tools/index.ts` (new) — exports the ToolFactorySet

```typescript
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import type { ToolFactorySet } from "@lightfastai/ai-sdk/tool";
import type { AnswerRuntimeContext } from "../types";
import { workspaceSearchTool } from "./search";
import { workspaceContentsTool } from "./contents";
import { workspaceFindSimilarTool } from "./find-similar";
import { workspaceGraphTool } from "./graph";
import { workspaceRelatedTool } from "./related";

export const answerTools: ToolFactorySet<RuntimeContext<AnswerRuntimeContext>> = {
  workspaceSearch: workspaceSearchTool(),
  workspaceContents: workspaceContentsTool(),
  workspaceFindSimilar: workspaceFindSimilarTool(),
  workspaceGraph: workspaceGraphTool(),
  workspaceRelated: workspaceRelatedTool(),
};
```

#### 3. System Prompt
**File**: `apps/console/src/ai/prompts/system-prompt.ts` (new)
**Changes**: Build the Answer agent system prompt with hardcoded workspace context.

```typescript
export function buildAnswerSystemPrompt(workspaceContext: {
  projectName: string;
  projectDescription: string;
}): string {
  return `You are Lightfast Answer, an AI assistant that helps developers understand their workspace activity across GitHub, Linear, Vercel, and Sentry.

## Workspace Context
Project: ${workspaceContext.projectName}
Description: ${workspaceContext.projectDescription}

## Your Capabilities
You have access to 5 workspace tools:
1. **workspaceSearch** - Semantic search across all workspace events (commits, PRs, issues, deployments, errors)
2. **workspaceContents** - Fetch full content for specific observations by ID
3. **workspaceFindSimilar** - Find semantically similar content to a given document
4. **workspaceGraph** - Traverse the relationship graph between events (e.g., which PR fixed which issue, which deploy included which commits)
5. **workspaceRelated** - Get directly related events for a specific observation

## Instructions
- Always use your tools to find information. Never make up facts about the workspace.
- When answering, cite the specific observations you found (include their IDs and URLs).
- Use workspaceSearch first for broad questions, then workspaceContents to get full details.
- Use workspaceGraph and workspaceRelated to trace cross-source connections (e.g., "what deployments included this fix?").
- Keep answers concise and developer-focused.
- Format responses with markdown. Use code blocks for commit SHAs, branch names, and technical identifiers.`;
}
```

For V1, we hardcode the workspace context for localhost testing (the Lightfast project itself):

```typescript
// Hardcoded workspace context for V1 (localhost = Lightfast project)
export const HARDCODED_WORKSPACE_CONTEXT = {
  projectName: "Lightfast",
  projectDescription: "Lightfast is a pnpm monorepo (Turborepo) for building AI agent orchestration tools. It includes a console app (Next.js), marketing site, chat app, and supporting infrastructure across GitHub, Linear, Vercel, and Sentry integrations.",
};
```

#### 4. Memory Adapter
**File**: `apps/console/src/ai/runtime/memory.ts` (new)
**Changes**: Create a Redis memory instance for Answer sessions using the AI SDK's built-in `RedisMemory` adapter with TTL-appropriate key prefixes.

```typescript
import { RedisMemory } from "@lightfastai/ai-sdk/memory";

export function createAnswerMemory() {
  return new RedisMemory({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}
```

Note: The `RedisMemory` from `core/ai-sdk` persists sessions forever. For V1 ephemeral behavior, we create a thin subclass `AnswerRedisMemory` that overrides TTLs (1h for sessions, 1h for messages, matching the transient nature of workspace search conversations). This follows the pattern of `AnonymousRedisMemory` in the chat app.

**File**: `apps/console/src/ai/runtime/memory.ts` (new, refined)

```typescript
import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Memory } from "@lightfastai/ai-sdk/memory";
import type { AnswerMemoryContext } from "../types";

/**
 * Ephemeral Redis memory for Answer sessions.
 * 1-hour TTL on all data - workspace search conversations are transient.
 */
export class AnswerRedisMemory implements Memory<UIMessage, AnswerMemoryContext> {
  // Follows exact pattern of AnonymousRedisMemory from apps/chat
  // Key prefix: answer:session:{sessionId}:*
  // TTL: 3600 seconds (1 hour) for all keys
  // Supports getActiveStream/clearActiveStream for resumable streams
}
```

#### 5. API Route Handler
**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` (new)
**Changes**: Answer API route following the chat app's `api/v/[...v]/route.ts` pattern.

URL pattern: `/v1/answer/{agentId}/{sessionId}` (agentId = "answer-v1")

```typescript
import { createAgent } from "@lightfastai/ai-sdk/agent";
import { fetchRequestHandler } from "@lightfastai/ai-sdk/server/adapters/fetch";
import { withDualAuth } from "../../lib/with-dual-auth";
import { answerTools } from "~/ai/tools";
import { buildAnswerSystemPrompt, HARDCODED_WORKSPACE_CONTEXT } from "~/ai/prompts/system-prompt";
import { AnswerRedisMemory } from "~/ai/runtime/memory";
import type { AnswerRuntimeContext } from "~/ai/types";

export async function POST(request: Request) {
  // 1. Authenticate via withDualAuth (same as search APIs)
  const auth = await withDualAuth(request, requestId);

  // 2. Build system prompt with hardcoded workspace context
  const systemPrompt = buildAnswerSystemPrompt(HARDCODED_WORKSPACE_CONTEXT);

  // 3. Create agent
  const agent = createAgent<AnswerRuntimeContext, typeof answerTools>({
    name: "answer-v1",
    system: systemPrompt,
    tools: answerTools,
    createRuntimeContext: ({ sessionId, resourceId }) => ({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
    }),
    model: gateway("anthropic/claude-sonnet-4-20250514"),
    experimental_transform: smoothStream({ delayInMs: 10 }),
    stopWhen: stepCountIs(8),
  });

  // 4. Create ephemeral memory
  const memory = new AnswerRedisMemory();

  // 5. Delegate to fetchRequestHandler
  return fetchRequestHandler({
    request,
    agent,
    memory,
    // ... lifecycle callbacks
  });
}

export async function GET(request: Request) {
  // Resume stream handler (same pattern as chat)
}
```

#### 6. Internal fetch helper for tools
**File**: `apps/console/src/ai/tools/lib/fetch.ts` (new)
**Changes**: Helper to construct internal API calls from tools to the console's own `/v1/*` endpoints. Since tools run server-side within the same Next.js process, we use `localhost` with the appropriate port and forward the workspace ID.

```typescript
/**
 * Get the base URL for internal API calls.
 * Tools run server-side, so they call the console's own endpoints.
 */
export function getInternalApiBaseUrl(): string {
  // In development, use localhost with the console port
  // In production, use the VERCEL_URL or NEXT_PUBLIC_CONSOLE_URL
  return process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:4107";
}
```

Important: Tools need to forward authentication. Since the Answer route already authenticated the user, tools will pass the workspace ID header and use an internal mechanism (e.g., a shared secret or the same Clerk session cookie forwarded from the original request) to authenticate with the `/v1/*` endpoints. The simplest approach for V1: pass the original request's cookie/auth headers through the runtime context.

### Dependencies to Add
**File**: `apps/console/package.json`
```json
{
  "dependencies": {
    "@lightfastai/ai-sdk": "workspace:*",
    "@ai-sdk/react": "catalog:",
    "@ai-sdk/gateway": "catalog:",
    "@vendor/upstash": "workspace:*"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] All 6 new files exist under `apps/console/src/ai/`
- [ ] Route handler exists at `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

#### Manual Verification:
- [ ] `curl -X POST localhost:4107/v1/answer/answer-v1/test-session -d '{"messages":[{"role":"user","content":"What were the recent commits?"}]}' -H 'Content-Type: application/json' -H 'X-Workspace-ID: <workspace-id>'` returns a streaming response
- [ ] AI invokes `workspaceSearch` tool and returns results
- [ ] Session data appears in Redis with `answer:session:*` keys

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Client-Side Integration — Transport, Hook, and Answer Interface

### Overview
Create the client-side infrastructure: custom transport for the Answer agent, the `useChat` integration, and the Answer chat interface component.

### Changes Required:

#### 1. Answer Transport Hook
**File**: `apps/console/src/ai/hooks/use-answer-transport.ts` (new)
**Changes**: Custom transport for Answer sessions, mirroring `apps/chat/src/hooks/use-chat-transport.ts`.

```typescript
"use client";

import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export function useAnswerTransport({
  sessionId,
  workspaceId,
}: {
  sessionId: string;
  workspaceId: string;
}) {
  return useMemo(() => {
    return new DefaultChatTransport({
      api: `/v1/answer/answer-v1/${sessionId}`,
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-ID": workspaceId,
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => ({
        api,
        headers,
        body: {
          messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
          ...body,
        },
      }),
      prepareReconnectToStreamRequest: ({ api, headers }) => ({ api, headers }),
    });
  }, [sessionId, workspaceId]);
}
```

#### 2. Answer Chat Interface
**File**: `apps/console/src/components/answer-interface.tsx` (new)
**Changes**: The Answer mode chat UI. Renders message history with tool call results and streaming responses.

Key behaviors:
- Uses `useChat` from `@ai-sdk/react` with the Answer transport
- Generates a session ID on mount (ephemeral, not persisted to URL)
- Renders messages with markdown formatting
- Shows tool call results inline (search results as compact cards, graph as node list)
- Streaming text animation via `experimental_transform: smoothStream()`

#### 3. Answer Prompt Input
**File**: `apps/console/src/components/answer-prompt-input.tsx` (new)
**Changes**: Compose the shared `PromptInput` from `@repo/ui` with Answer-specific toolbar.

Toolbar contains:
- **Mode toggle**: "Search" / "Answer" toggle button (switches between direct search and AI mode)
- **Submit button**: Standard PromptInputSubmit

No attachment button, no model selector, no web search toggle (unlike chat app).

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Answer mode renders a chat interface with prompt input
- [ ] Typing a question and pressing Enter sends it to the Answer API
- [ ] Response streams in with smooth animation
- [ ] Tool calls are visible inline (search results displayed as cards within the AI response)
- [ ] New session ID generated on each page load

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Workspace Page — Dual-Mode Integration

### Overview
Integrate both modes into the workspace page: the PromptInput drives both Direct Search (existing) and Answer (new AI chat) modes via a toggle.

### Changes Required:

#### 1. Update Workspace Page
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`
**Changes**: The page remains a server component with prefetch. No changes needed if the workspace search component handles mode internally.

#### 2. Refactor Workspace Search Component
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Replace the existing input/button with the new `PromptInput` and add mode switching.

Key changes:
- Add `mode` state: `"search" | "answer"` (URL-persisted via nuqs as `m` param)
- **Search mode**: When user submits, call `/v1/search` directly (existing `handleSearch()` logic). Display results in existing result cards.
- **Answer mode**: When user submits, pass to `useChat` via the Answer transport. Display chat messages with the Answer interface.
- The PromptInput textarea is shared between modes — the mode toggle button switches which submit handler fires.
- Existing filters (mode selector, source types, observation types, actor names) only show in Search mode.

#### 3. Shared Prompt Input Wrapper
**File**: `apps/console/src/components/workspace-prompt-input.tsx` (new)
**Changes**: The unified prompt input for the workspace page.

```typescript
// Composes PromptInput with:
// - Mode toggle (Search / Answer) in the toolbar
// - Filter controls (only visible in Search mode)
// - Submit button
// In Search mode: onSubmit calls handleSearch()
// In Answer mode: onSubmit calls handleSubmit from useChat
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Workspace page shows the new PromptInput with mode toggle
- [ ] **Search mode**: Submitting runs direct search, shows result cards (same as before)
- [ ] **Answer mode**: Submitting sends to AI, shows streaming chat response
- [ ] Switching modes preserves the query text
- [ ] Mode persisted in URL as `m=search` or `m=answer`
- [ ] Existing URL params (`q`, `mode`, `sources`, `types`, `actors`) still work in Search mode
- [ ] No regressions to existing search functionality

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Tool Response Rendering

### Overview
Build specialized renderers for tool call results within Answer mode messages. When the AI calls `workspaceSearch`, the results should render as compact search result cards, not raw JSON.

### Changes Required:

#### 1. Tool Result Components
**File**: `apps/console/src/components/answer-tool-results.tsx` (new)
**Changes**: React components that render tool call results in the Answer chat.

Components:
- `SearchToolResult` — Renders search results as compact cards (rank, title, score, source badge, snippet)
- `ContentsToolResult` — Renders full content view
- `FindSimilarToolResult` — Renders similar items with similarity scores
- `GraphToolResult` — Renders graph nodes and edges as a compact visualization (list with relationship types)
- `RelatedToolResult` — Renders related events grouped by source

#### 2. Message Renderer with Tool Parts
**File**: `apps/console/src/components/answer-message.tsx` (new)
**Changes**: Render a single Answer message, dispatching tool-call parts to the appropriate tool result component.

Uses the `message.parts` array from `@ai-sdk/react`:
- `text` parts → render as markdown
- `tool-invocation` parts → dispatch to tool result component based on `toolName`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Ask "What were the recent deployments?" → AI calls workspaceSearch → results render as compact cards, not JSON
- [ ] Ask "Show me the full content of [ID]" → AI calls workspaceContents → full content renders nicely
- [ ] Ask "What's related to this PR?" → AI calls workspaceGraph or workspaceRelated → shows relationship visualization
- [ ] Tool call loading states visible while tools execute
- [ ] Multiple tool calls in sequence render correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## File Structure Summary

```
apps/console/src/ai/
├── types.ts                              # AnswerRuntimeContext, AnswerMemoryContext
├── tools/
│   ├── index.ts                          # answerTools ToolFactorySet
│   ├── search.ts                         # workspaceSearchTool
│   ├── contents.ts                       # workspaceContentsTool
│   ├── find-similar.ts                   # workspaceFindSimilarTool
│   ├── graph.ts                          # workspaceGraphTool
│   ├── related.ts                        # workspaceRelatedTool
│   └── lib/
│       └── fetch.ts                      # getInternalApiBaseUrl helper
├── prompts/
│   └── system-prompt.ts                  # buildAnswerSystemPrompt + HARDCODED_WORKSPACE_CONTEXT
├── runtime/
│   └── memory.ts                         # AnswerRedisMemory (1h TTL)
└── hooks/
    └── use-answer-transport.ts           # useAnswerTransport hook

apps/console/src/app/(api)/v1/answer/
└── [...v]/
    └── route.ts                          # POST + GET handlers

apps/console/src/components/
├── workspace-search.tsx                  # Modified: add mode switching
├── workspace-prompt-input.tsx            # New: unified prompt input with mode toggle
├── answer-interface.tsx                  # New: Answer chat message list
├── answer-prompt-input.tsx               # New: (merged into workspace-prompt-input)
├── answer-message.tsx                    # New: single message renderer
└── answer-tool-results.tsx               # New: tool result card components
```

## Testing Strategy

### Unit Tests:
- Tool input schemas validate correctly
- System prompt builder produces expected output with workspace context
- Memory adapter correctly prefixes keys and sets TTL

### Integration Tests:
- Answer route handler authenticates and creates agent
- Tools successfully call internal `/v1/*` APIs
- Streaming response includes tool call parts

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Navigate to workspace page
3. Toggle to Answer mode
4. Ask: "What commits happened this week?" — verify search tool invoked
5. Ask: "Show me the full content of [observation ID from previous results]" — verify contents tool
6. Ask: "What's related to that PR?" — verify graph/related tools
7. Toggle back to Search mode — verify direct search still works
8. Refresh page — verify Answer session is ephemeral (no history restored)

## Performance Considerations

- **Tool execution latency**: Search tools call internal APIs (no network hop in production, but does go through HTTP in dev). The `/v1/search` endpoint with balanced mode takes ~130ms. The AI will likely call 1-3 tools per question.
- **Streaming**: `smoothStream({ delayInMs: 10 })` provides smooth text animation. Tool call results appear as soon as tools complete.
- **Memory**: Redis TTL of 1 hour prevents memory accumulation. No PlanetScale writes.
- **Model**: Using Claude Sonnet for balance of speed and quality. `stopWhen: stepCountIs(8)` prevents runaway tool loops.

## References

- Research document: `thoughts/shared/research/2026-02-06-answer-feature-ai-search-workspace.md`
- Chat app blueprint: `apps/chat/src/ai/`
- AI SDK primitives: `core/ai-sdk/src/core/`
- Console search APIs: `apps/console/src/app/(api)/v1/`
- Console types: `packages/console-types/src/api/v1/`
- PromptInput components: `packages/ui/src/components/ai-elements/prompt-input.tsx`
- MCP tool definitions: `core/mcp/src/server.ts`
