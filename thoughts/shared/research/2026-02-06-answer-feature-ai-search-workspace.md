---
date: 2026-02-06T12:00:00+08:00
researcher: Claude
git_commit: 5eaa1050042cde2cbd11f812af558fc900123918
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Answer Feature: AI-Powered Search for Console Workspace"
tags: [research, codebase, answer, ai-search, workspace, chat, tools, prompt-input]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Answer Feature - AI-Powered Search for Console Workspace

**Date**: 2026-02-06T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 5eaa1050042cde2cbd11f812af558fc900123918
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Explore a new "Answer" feature for Lightfast Console that transforms the workspace search page into an AI chat-like interface. The existing 3-4 search APIs become tools the AI can invoke. The UI should still support structured direct calls alongside conversational AI interaction. Reference the existing `apps/chat/` implementation as the design blueprint.

## Summary

This research documents three systems that would converge for the "Answer" feature:

1. **Console Search Infrastructure** - 4 existing search/retrieval APIs that would become AI tools
2. **Chat App Architecture** - Complete AI chat implementation (agent, transport, tools, memory, UI) that serves as the blueprint
3. **Shared UI Components** - The `@repo/ui` PromptInput library already used by chat, reusable for console

The codebase already has all the building blocks. The `@lightfastai/ai-sdk` package provides agent creation, tool factories, memory interfaces, and streaming infrastructure. The `@repo/ui` PromptInput component is a composable prompt input with attachments, tool buttons, and model selection. The console has 4 distinct search/retrieval APIs that map directly to tool definitions.

---

## Detailed Findings

### 1. Console Search APIs (Current Tools Candidates)

The console workspace currently exposes 4 API endpoints that would become tools for the Answer AI:

#### Tool 1: Semantic Search (`/v1/search`)
- **Location**: `apps/console/src/app/(api)/v1/search/route.ts:41-286`
- **What it does**: 4-path parallel search (vector similarity, entity matching, cluster context, actor profiles) with Cohere reranking
- **Input**: Query text, mode (fast/balanced/thorough), filters (sourceTypes, observationTypes, actorNames, dateRange), limit/offset
- **Output**: Ranked results with scores, snippets, entities, cross-source references, context (clusters, actors), latency breakdown
- **Schema**: `V1SearchRequestSchema` at `packages/console-types/src/api/v1/search.ts:42-81`

#### Tool 2: Content Retrieval (`/v1/contents`)
- **Location**: `apps/console/src/app/(api)/v1/contents/route.ts`
- **What it does**: Fetches full content for documents/observations by their IDs
- **Input**: Array of observation IDs
- **Output**: Full content, metadata, and observation details
- **Schema**: `V1ContentsRequestSchema` at `packages/console-types/src/api/v1/contents.ts:12-19`

#### Tool 3: Find Similar (`/v1/findsimilar`)
- **What it does**: Finds semantically similar content to a given document or URL
- **Input**: Document ID or URL, limit, threshold
- **Output**: Similar items with similarity scores and cluster info
- **Schema**: `V1FindSimilarBaseSchema` at `packages/console-types/src/api/v1/findsimilar.ts:13-58`

#### Tool 4: Relationship Graph (`/v1/graph/[id]` and `/v1/related/[id]`)
- **Location**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts:29` and `apps/console/src/app/(api)/v1/related/[id]/route.ts:29`
- **What it does**: BFS traversal of typed relationship graph across sources (GitHub, Vercel, Sentry, Linear)
- **Input**: Observation ID, depth (max 3), relationship type filters
- **Output**: Nodes + typed edges with confidence scores, grouped by source

#### MCP Definitions Already Exist
The MCP server at `core/mcp/src/server.ts` already defines tools for 3 of these:
- `lightfast_search` (line 33-43)
- `lightfast_contents` (line 46-56)
- `lightfast_find_similar` (line 58-74)

These MCP definitions validate that the APIs are already designed as tool-callable interfaces.

---

### 2. Chat App Architecture (Blueprint)

The chat app provides a complete reference implementation across 5 layers:

#### Layer 1: Agent Definition
- **Package**: `@lightfastai/ai-sdk` at `core/ai-sdk/`
- **Factory**: `createAgent<TRuntimeContext, TTools>()` at `core/ai-sdk/src/core/primitives/agent.ts:315`
- **Config**: Agent name, system prompt, tools (as factory set), runtime context builder, model, telemetry
- **Key method**: `agent.buildStreamParams()` at line 159-300 converts options into `streamText()` parameters
- **Context injection**: Runtime dependencies injected per-request via `createRuntimeContext`

#### Layer 2: Tool System
- **Factory**: `createTool<TRuntimeContext, TInputSchema, TOutputSchema>()` at `core/ai-sdk/src/core/primitives/tool.ts:44-72`
- **Pattern**: Returns a factory function that captures runtime context, then creates `ai.tool()` instances
- **Type**: `ToolFactorySet<TRuntimeContext>` is a record of named tool factories
- **Chat tools** defined at `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/tools.ts:17-20`:
  - `webSearch` → Exa-powered web search at `packages/chat-ai/src/web-search.ts:293`
  - `createDocument` → Artifact creation at `packages/chat-ai/src/create-document.ts:31`

#### Layer 3: Server Runtime
- **Adapter**: `fetchRequestHandler()` at `core/ai-sdk/src/core/server/adapters/fetch.ts:128-250` handles HTTP → agent stream
- **Streaming**: `streamChat()` at `core/ai-sdk/src/core/server/runtime.ts:169-622` orchestrates session validation, message processing, `streamText()`, and memory persistence
- **Resume**: `resumeStream()` at line 627-689 for reconnection support
- **Route handler**: `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts:205-855` - full route with auth, guards, billing, telemetry

#### Layer 4: Memory/Persistence
- **Interface**: `Memory<TMessage, TContext>` at `core/ai-sdk/src/core/memory/index.ts:8-40`
- **Methods**: `appendMessage`, `getMessages`, `createSession`, `getSession`, `createStream`, `getActiveStream`, `clearActiveStream`
- **PlanetScale impl**: `apps/chat/src/ai/runtime/memory/planetscale.ts:102-248` for authenticated users
- **Redis impl**: `apps/chat/src/ai/runtime/memory/redis.ts:30-228` for anonymous users (24h TTL)

#### Layer 5: Client Integration
- **Transport**: `useChatTransport()` at `apps/chat/src/hooks/use-chat-transport.ts:17-53` creates custom `DefaultChatTransport` for `useChat`
- **Hook**: `useChat` from `@ai-sdk/react` with transport, manages local message state
- **Pattern**: Sends only last message to server (server reconstructs from memory), spreads `body` for metadata like `webSearchEnabled`

#### System Prompt Builder
- **Location**: `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts:44-96`
- **API**: `buildSystemPrompt({ isAnonymous, includeCitations, webSearchEnabled, basePrompt })`
- **Sections**: Core behavior, security guidelines, capability declaration (web search on/off), artifact instructions, citation format
- **Conditional**: Different prompts for anonymous (120-word limit, no artifacts) vs authenticated (full capabilities)

---

### 3. PromptInput Component Library (Reusable UI)

The `@repo/ui` package provides a composable prompt input system at `packages/ui/src/components/ai-elements/prompt-input.tsx`.

#### Components (all exported)
| Component | Line | Purpose |
|-----------|------|---------|
| `PromptInput` | 302 | Main container - form, attachments, drag-drop |
| `PromptInputBody` | 696 | Flex container for input content |
| `PromptInputTextarea` | 705 | Auto-growing textarea with Enter submit, paste handling |
| `PromptInputToolbar` | 781 | Bottom toolbar container |
| `PromptInputTools` | 793 | Tool buttons container |
| `PromptInputSubmit` | 878 | Submit button with status-dependent icon |
| `PromptInputButton` | 809 | Base button for toolbar actions |
| `PromptInputAttachments` | 185 | Animated attachment preview container |
| `PromptInputAttachment` | 122 | Individual attachment preview with remove |

#### Types
- `PromptInputMessage` (line 264): `{ text?: string; attachments?: PromptInputAttachmentPayload[] }`
- `PromptInputAttachmentItem` (line 54): Extends `FileUIPart` with `id`, `file`, `size`, `storagePath`, `uploadState`
- `PromptInputRef` (line 269): `{ form, clear, reset }` imperative handle

#### Hook
- `usePromptInputAttachments()` (line 105): Access context from child components for `files`, `add`, `remove`, `clear`, `openFileDialog`

#### Chat App Usage Pattern
- `apps/chat/src/app/(chat)/_components/chat-prompt-input.tsx:215-278`: Composes PromptInput with custom toolbar buttons for attachments, web search toggle, model selector, and submit

---

### 4. Current Workspace Search UI

The existing search page at `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` and `apps/console/src/components/workspace-search.tsx`:

#### Page Structure
- Server component prefetches workspace store via `orgTrpc.workspace.store.get`
- Wraps in `<HydrateClient>` and `<Suspense>` with skeleton
- Passes `orgSlug`, `workspaceName`, `initialQuery` (from `?q=` param)

#### Search Component (`workspace-search.tsx:78-812`)
- **URL state**: Uses `nuqs` for query, mode, sources, types, actors, expanded (all URL-persisted, shareable)
- **Search execution**: `handleSearch()` at line 119 POSTs to `/v1/search` with query, mode, filters, context flags
- **Mode selection**: fast/balanced/thorough toggle at line 205
- **Filters**: Source types (GitHub, Vercel), observation types (push, PR, issue, deployment), actor names
- **Results display**: Expandable cards with rank, score, source badges, entities, content lazy-loading, find-similar

#### Result Card Features
- Collapsed: rank badge, title, score%, source badge, snippet (2-line clamp), type, date
- Expanded: ID copy, external link, entities, full content (lazy-loaded from `/v1/contents`), metadata, "Find Similar" (fetches `/v1/findsimilar`)
- Similar items: compact cards with similarity score, cluster info, entity overlap

---

### 5. Relationship Graph System

The recent "definitive links" feature adds typed cross-source relationships:

#### Relationship Types
Defined at `db/console/src/schema/tables/workspace-observation-relationships.ts:27-35`:
- `fixes` - PR/commit fixes an issue
- `resolves` - Commit resolves Sentry issue (via `statusDetails.inCommit`)
- `triggers` - Sentry error triggers Linear issue
- `deploys` - Vercel deployment deploys a commit
- `references` - Generic reference link
- `same_commit` / `same_branch` - Shared reference
- `tracked_in` - GitHub PR tracked in Linear

#### Detection
- Runs after observation capture at `api/console/src/inngest/workflow/neural/relationship-detection.ts:45`
- Matches on commit SHAs, branch names, issue IDs, PR numbers
- Strict type assignment via `determineCommitRelationType()` at line 440

#### APIs
- Graph traversal: `/v1/graph/[id]` - BFS up to depth 3, returns nodes + edges
- Direct connections: `/v1/related/[id]` - 1-hop lookup, grouped by source

---

## Code References

### Console Search Infrastructure
- `apps/console/src/app/(api)/v1/search/route.ts:41-286` - Search endpoint
- `apps/console/src/app/(api)/v1/contents/route.ts` - Content retrieval endpoint
- `apps/console/src/app/(api)/v1/graph/[id]/route.ts:29` - Graph traversal endpoint
- `apps/console/src/app/(api)/v1/related/[id]/route.ts:29` - Related events endpoint
- `apps/console/src/lib/neural/four-path-search.ts:362-524` - 4-path parallel search
- `apps/console/src/components/workspace-search.tsx:78-812` - Current search UI
- `packages/console-types/src/api/v1/search.ts:42-246` - Search schemas
- `core/mcp/src/server.ts:33-74` - MCP tool definitions for search APIs

### Chat App (Blueprint)
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts:205-855` - Chat API route
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/tools.ts:17-20` - Tool definitions
- `apps/chat/src/app/(chat)/_components/chat-interface.tsx:135-1255` - Chat interface
- `apps/chat/src/app/(chat)/_components/chat-prompt-input.tsx:215-278` - Prompt input composition
- `apps/chat/src/hooks/use-chat-transport.ts:17-53` - Custom transport
- `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts:44-96` - System prompt builder

### AI SDK (Shared Infrastructure)
- `core/ai-sdk/src/core/primitives/agent.ts:315` - `createAgent()` factory
- `core/ai-sdk/src/core/primitives/tool.ts:44-72` - `createTool()` factory
- `core/ai-sdk/src/core/server/adapters/fetch.ts:128-250` - `fetchRequestHandler()`
- `core/ai-sdk/src/core/server/runtime.ts:169-622` - `streamChat()` runtime
- `core/ai-sdk/src/core/memory/index.ts:8-40` - Memory interface

### UI Components
- `packages/ui/src/components/ai-elements/prompt-input.tsx:302-692` - PromptInput component
- `packages/ui/src/components/ai-elements/prompt-input.tsx:705-777` - PromptInputTextarea
- `packages/ui/src/components/ai-elements/prompt-input.tsx:878-907` - PromptInputSubmit

### Relationship Graph
- `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164` - Schema
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285` - Detection logic

---

## Architecture Documentation

### Pattern: Tool Factory with Context Injection

The AI SDK uses a factory pattern where tools are defined once but receive runtime context per-request:

```
createTool({ description, inputSchema, execute: (input, context) => ... })
  → returns ToolFactory<TRuntimeContext>
  → at request time: factory(mergedContext) → ai.tool()
```

This pattern allows console search APIs to be wrapped as tools without coupling them to a specific request context.

### Pattern: Custom Transport for useChat

The chat app uses `DefaultChatTransport` from `@ai-sdk/react` to send only the last message (server reconstructs history from memory) and attach metadata via the `body` field. This same pattern could work for the Answer feature with workspace-specific metadata.

### Pattern: PromptInput Composition

The PromptInput library uses composition over configuration. The toolbar area is fully customizable - the chat app adds attachment buttons, web search toggle, and model selector. The Answer feature could replace these with search mode toggles, filter controls, or structured query builders.

### Pattern: Dual Authentication

All console search APIs use `withDualAuth()` supporting both API key and Clerk session auth. The Answer API route would use the same pattern, inheriting the existing auth infrastructure.

---

## Historical Context (from thoughts/)

### Search Evaluation
- `thoughts/shared/plans/2026-02-05-search-api-evaluation-pipeline.md` - Plan for evaluating search quality
- `thoughts/shared/research/2026-02-05-search-api-evaluation-pipeline-golden-dataset-design.md` - Golden dataset design for search eval

### Accelerator Demo
- `thoughts/shared/plans/2026-02-05-accelerator-demo-search-showcase.md` - Demo plan showcasing cross-source search
- `thoughts/shared/research/2026-02-05-accelerator-demo-search-scenarios.md` - Demo search scenarios
- `thoughts/shared/plans/2026-02-05-accelerator-demo-script.md` - Demo script for cross-source intelligence

### Relationship Graph
- `thoughts/shared/research/2026-02-06-relationship-graph-definitive-links.md` - Definitive links analysis
- `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md` - Implementation plan
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - Early cross-source linking gaps

### Neural Memory Evaluation
- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Scientific eval framework
- `thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md` - Eval environment architecture

---

## Related Research
- `thoughts/shared/research/2026-02-05-lightfast-core-research-concerns.md` - Core research concerns including search quality
- `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md` - Relationship graph analysis

---

## Open Questions

1. **Memory Strategy**: Should Answer conversations persist (like chat with PlanetScale) or be ephemeral (Redis with TTL)? Workspace search conversations may be more transient than general chat.

2. **Tool Granularity**: Should the 4 APIs be exposed as 4 separate tools, or combined into a unified "workspace_query" tool that the AI selects sub-modes for? The MCP server already has 3 separate tools.

3. **Context Window**: How much workspace context (store config, recent activity, available sources) should be injected into the system prompt vs discovered through tools?

4. **Structured → AI Transition**: The user wants controls in the prompt input to switch between structured direct calls and AI-mediated search. How should this toggle work - separate modes, or AI that respects structured parameters when provided?

5. **Relationship Graph as Tool**: Should the graph traversal API be a tool the AI can invoke to explore cross-source connections, or should relationship data be included in search results by default?

6. **Streaming UX**: Chat uses streaming with smooth animation. Should Answer results also stream, or should tool calls (search, graph) return complete results that the AI then synthesizes?

7. **Agent Package Location**: Should Answer tools and agent config live in `packages/console-ai/` (new package), inside `apps/console/src/ai/`, or alongside the existing MCP definitions in `core/mcp/`?
