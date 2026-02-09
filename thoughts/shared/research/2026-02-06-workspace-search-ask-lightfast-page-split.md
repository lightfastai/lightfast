---
date: "2026-02-06T12:00:00+08:00"
researcher: Claude
git_commit: bf69dc4269d966c37ee8d97212524c8ed51b86b6
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Workspace Search & Ask Lightfast Page Split - Current Architecture"
tags: [research, codebase, workspace-search, answer-interface, chat-app, page-architecture]
status: complete
last_updated: "2026-02-06"
last_updated_by: Claude
---

# Research: Workspace Search & Ask Lightfast Page Split - Current Architecture

**Date**: 2026-02-06
**Researcher**: Claude
**Git Commit**: bf69dc4269d966c37ee8d97212524c8ed51b86b6
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Document the current architecture of the workspace search page (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`) and the chat app (`apps/chat/`) to understand how to split the current single-page toggle-based search/answer into two separate pages: **Search** (semantic search + graph) and **Ask Lightfast** (AI answer interface modeled after the chat app).

## Summary

The current workspace page at `[slug]/[workspaceName]/page.tsx` serves a single `WorkspaceSearch` client component that toggles between two modes via a `ToggleGroup`: "Direct Search" and "AI Answer". These modes share URL state via `nuqs` query parameters. The Search mode renders search controls, filters, and result cards with expandable content. The Answer mode renders `AnswerInterface`, which uses `useChat` from Vercel AI SDK with a custom transport to stream responses from the `/v1/answer` API route.

The chat app (`apps/chat/`) provides a full-featured reference implementation with a distinct landing state, prompt suggestions, message rendering with turns, streaming animations, and extensive use of `@repo/ui/components/ai-elements/` components. The "Ask Lightfast" page should model its UX after this chat app.

---

## Detailed Findings

### 1. Current Workspace Page Architecture

**Server Component**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`

- Accepts `params` (slug, workspaceName) and `searchParams` (q)
- Prefetches `orgTrpc.workspace.store.get` before `<HydrateClient>`
- Renders a single `<WorkspaceSearch>` client component with `orgSlug`, `workspaceName`, `initialQuery`

**Client Component**: `apps/console/src/components/workspace-search.tsx`

- 897 lines, handles both Search and Answer modes
- Uses `useWorkspaceSearchParams()` (nuqs) for URL-persisted state including `interfaceMode` (`m` param, values: `"search"` | `"answer"`)
- Toggle at lines 206-220: `ToggleGroup` switches between "Direct Search" and "AI Answer"
- **Search mode** (lines 237-518): Card-based controls with mode toggle (fast/balanced/thorough), search input, source/type/actor filters, results with expandable content, find-similar, and quick links
- **Answer mode** (lines 230-234): Renders `<AnswerInterface workspaceId={store.id} />`

### 2. Current Answer Interface (Console)

**Component**: `apps/console/src/components/answer-interface.tsx` (119 lines)

- Generates `sessionId` via `crypto.randomUUID()` on mount
- Uses `useAnswerTransport()` hook for custom transport config
- Uses `useChat()` from `@ai-sdk/react` with transport
- Renders `<AnswerMessages>` and `<PromptInput>` from `@repo/ui/components/ai-elements/prompt-input`
- Empty state: simple text "Ask a question about your workspace" (in answer-messages.tsx:339-346)
- No prompt suggestions, no landing branding

**Transport**: `apps/console/src/ai/hooks/use-answer-transport.ts`

- Endpoint: `/v1/answer/answer-v1/{sessionId}`
- Headers: `Content-Type`, `X-Workspace-ID`
- Only sends last message in batch

**Messages**: `apps/console/src/components/answer-messages.tsx` (397 lines)

- Uses turn-based rendering (`buildTurns` function)
- `UserMessage`: right-aligned via `Message` from `@repo/ui`
- `AssistantMessage`: left-aligned with reasoning support, tool rendering, copy action
- Tool results rendered via `answer-tool-results.tsx` (SearchToolResult, ContentsToolResult, FindSimilarToolResult, GraphToolResult, RelatedToolResult)
- Uses `Conversation`, `ConversationContent`, `ConversationScrollButton` from `@repo/ui/components/ai-elements/conversation`
- Bounce-dot loading animation during streaming

### 3. API Routes (What Each Page Will Use)

**Search Page Routes** (3 routes + graph):
| Route | Method | Purpose |
|-------|--------|---------|
| `/v1/search` | POST | Semantic search with 4-path parallel search + reranking |
| `/v1/contents` | POST | Fetch full content by observation/document IDs |
| `/v1/findsimilar` | POST | Find similar content via vector embeddings |
| `/v1/graph/[id]` | GET | BFS graph traversal from observation |
| `/v1/related/[id]` | GET | Direct 1-hop relationships |

**Ask Lightfast Routes** (answer endpoint with 5 built-in tools):
| Route | Method | Purpose |
|-------|--------|---------|
| `/v1/answer/answer-v1/{sessionId}` | POST | Stream AI answer with workspace tools |
| `/v1/answer/answer-v1/{sessionId}` | GET | Resume existing stream |

The answer agent has access to all 5 workspace tools internally: `workspaceSearch`, `workspaceContents`, `workspaceFindSimilar`, `workspaceGraph`, `workspaceRelated`. These tools call the same logic functions (`searchLogic`, `contentsLogic`, etc.) from `apps/console/src/lib/v1/`.

### 4. Chat App Architecture (Reference for Ask Lightfast)

**App Structure**: `apps/chat/src/`

The chat app serves as the design reference for "Ask Lightfast." Key architectural elements:

#### 4a. Landing / Empty State

**ChatEmptyState** (`apps/chat/src/app/(chat)/_components/chat-empty-state.tsx`):
- Centered text: "What can I do for you?" in `text-3xl font-medium font-semibold text-center`
- Personalized greeting for authenticated users: "Welcome back, {email}"
- `mb-8` margin before input

**ChatNewSessionView** (`apps/chat/src/app/(chat)/_components/chat-new-session-view.tsx`):
- Vertically centered layout with `justify-center items-center`
- Three regions stacked: empty state text, prompt input, prompt suggestions
- Max-width container `max-w-3xl` with responsive padding

**PromptSuggestions** (`apps/chat/src/app/(chat)/_components/prompt-suggestions.tsx`):
- 3 category buttons: Summary (BookOpen), Code (Code2), Design (Palette)
- Each category has 4 prompts
- Click category → expands to show prompts with staggered animation
- Click prompt → sends message, resets to categories
- Hidden on mobile, visible on md+ breakpoints

#### 4b. Message Rendering

**ChatMessages** (`apps/chat/src/app/(chat)/_components/chat-messages.tsx`):
- Turn-based: user message + assistant response pairs
- Four turn types: `answer`, `pending`, `ghost`, `system`
- `buildAssistantTurns()` builds turns from message array
- Streaming: SineWaveDots animation, typewriter effect via `useStream` hook
- Actions bar: Copy, Thumbs Up, Thumbs Down (feedback for auth'd users)
- Citations: `InlineCitationCard` with carousel

**User Messages**: Right-aligned, `justify-end`, `Message` component with `variant="chat"`
**Assistant Messages**: Left-aligned, parts-based rendering (text → Response markdown, reasoning → collapsible Reasoning, tools → ToolCallRenderer)

#### 4c. Prompt Input

**ChatPromptInput** (`apps/chat/src/app/(chat)/_components/chat-prompt-input.tsx`):
- Full `PromptInput` composition from `@repo/ui/components/ai-elements/prompt-input`:
  ```
  <PromptInput onSubmit={...} ref={ref}>
    <PromptInputAttachments />
    <PromptInputBody>
      <PromptInputTextarea placeholder="..." />
      <PromptInputToolbar>
        <PromptInputTools>
          <PromptInputButton /> (attachments)
          <PromptInputButton /> (web search)
        </PromptInputTools>
        <PromptInputSubmit status={chatStatus} />
      </PromptInputToolbar>
    </PromptInputBody>
  </PromptInput>
  ```
- Attachment upload support
- Web search toggle button
- Model selection (in toolbar)
- Enter to submit, Shift+Enter for newline

#### 4d. Chat Interface Orchestration

**ChatInterface** (`apps/chat/src/app/(chat)/_components/chat-interface.tsx`):
- Central orchestrator (~1255 lines)
- `useChat` from `@ai-sdk/react` with custom `DefaultChatTransport`
- Transport endpoint: `/api/v/{agentId}/{sessionId}`
- Two view states: `ChatNewSessionView` (empty) vs `ChatExistingSessionView` (messages)
- State hooks: `useModelSelection`, `useAttachmentUpload`, `useBillingContext`, `useSessionState`, `useInlineErrors`, `useDataStream`, `useArtifact`
- Optimistic message cache updates via React Query `setQueryData`
- Session creation on first message (fire-and-forget mutation)
- URL update with `window.history.replaceState`

#### 4e. Layout Structure

**Unauthenticated**: Single column, minimal header, no sidebar
**Authenticated**: Three-region layout (sidebar, header, main content) with `SidebarProvider`

#### 4f. Styling

- Dark theme by default (`defaultTheme="dark"`)
- OKLCH color space for perceptual uniformity
- Custom globals.css overriding `@repo/ui/globals.css`
- Responsive padding: `px-1.5 md:px-3 lg:px-6 xl:px-10`
- Container max-width: `max-w-3xl` for message content
- Gradient overlay above input: `bg-gradient-to-t from-background via-background/80 to-transparent`

### 5. Shared UI Components (from @repo/ui)

#### AI Elements (`packages/ui/src/components/ai-elements/`)

| Component | File | Purpose |
|-----------|------|---------|
| `PromptInput` | `prompt-input.tsx` | Form with textarea, attachments, submit, toolbar |
| `Conversation` | `conversation.tsx` | Auto-scroll container via `use-stick-to-bottom` |
| `Message` | `message.tsx` | Role-based message container (user/assistant) |
| `Response` | `response.tsx` | Memoized markdown renderer via Streamdown + Shiki |
| `Reasoning` | `reasoning.tsx` | Collapsible thinking display with auto-open/close |
| `Actions` | `actions.tsx` | Action buttons with tooltips (copy, feedback) |
| `CodeBlock` | `code-block.tsx` | Syntax-highlighted code with copy/download |
| `Tool` | `tool.tsx` | Tool invocation display container |
| `Artifact` | `artifact.tsx` | Generated artifact pane |
| `InlineCitation` | `inline-citation.tsx` | Source citation with carousel |

#### Standard UI Components Used

| Component | File | Used By |
|-----------|------|---------|
| `Card`, `CardContent` | `card.tsx` | workspace-search.tsx, answer-tool-results.tsx |
| `Badge` | `badge.tsx` | workspace-search.tsx, answer-tool-results.tsx |
| `Button` | `button.tsx` | workspace-search.tsx, answer-interface.tsx |
| `Input` | `input.tsx` | workspace-search.tsx |
| `ToggleGroup` | `toggle-group.tsx` | workspace-search.tsx |
| `Skeleton` | `skeleton.tsx` | workspace-search.tsx |
| `Collapsible` | `collapsible.tsx` | workspace-search.tsx |

### 6. URL State Management

**Current**: `apps/console/src/components/use-workspace-search-params.ts`

Uses `nuqs` with `useQueryStates` for URL-persisted state:
- `q` - Search query (string)
- `mode` - Rerank mode (fast/balanced/thorough)
- `m` - Interface mode (search/answer) **← this is what the toggle controls**
- `sources` - Source type filters (array)
- `types` - Observation type filters (array)
- `actors` - Actor name filters (array)
- `expanded` - Currently expanded result ID

When split into two pages, the `m` parameter becomes unnecessary. Search page keeps `q`, `mode`, `sources`, `types`, `actors`, `expanded`. Ask Lightfast page would have minimal URL state (potentially just a session ID).

### 7. Workspace Routing Structure

**Current routes under** `[slug]/[workspaceName]/`:

```
page.tsx              → Dashboard (search + answer toggle)
insights/page.tsx     → Insights
sources/page.tsx      → Sources management
sources/connect/      → Connect new sources
jobs/page.tsx         → Jobs listing
settings/page.tsx     → Workspace settings
```

**Sidebar navigation** (`apps/console/src/components/app-sidebar.tsx`):
- Dashboard: `/{orgSlug}/{workspaceName}`
- Sources: `/{orgSlug}/{workspaceName}/sources`
- Jobs: `/{orgSlug}/{workspaceName}/jobs`
- Settings: `/{orgSlug}/{workspaceName}/settings`

The "Ask Lightfast" page would need a new route (e.g., `/{orgSlug}/{workspaceName}/ask`) and a corresponding sidebar entry.

### 8. Auth and Workspace Context Flow

**Server side**: The page receives `slug` and `workspaceName` from URL params. It prefetches the workspace store (1:1 relationship).

**Client side**: The `WorkspaceSearch` component fetches the store via `useSuspenseQuery`, which provides the `store.id` (workspaceId). This ID is passed to:
- Search mode: As `X-Workspace-ID` header in fetch calls to `/v1/search`, `/v1/contents`, `/v1/findsimilar`
- Answer mode: As prop to `<AnswerInterface workspaceId={store.id} />`

The answer transport hook (`use-answer-transport.ts`) adds `X-Workspace-ID` to the custom transport headers.

---

## Code References

- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` - Current workspace page (server component)
- `apps/console/src/components/workspace-search.tsx` - Main search/answer client component (897 lines)
- `apps/console/src/components/answer-interface.tsx` - Answer chat interface (119 lines)
- `apps/console/src/components/answer-messages.tsx` - Answer message rendering (397 lines)
- `apps/console/src/components/answer-tool-results.tsx` - Tool result components (234 lines)
- `apps/console/src/components/use-workspace-search-params.ts` - URL state hook (62 lines)
- `apps/console/src/ai/hooks/use-answer-transport.ts` - Answer transport (31 lines)
- `apps/console/src/ai/tools/index.ts` - 5 workspace tools registry
- `apps/console/src/ai/runtime/memory.ts` - Redis memory with 1hr TTL
- `apps/console/src/ai/prompts/system-prompt.ts` - Answer system prompt
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` - Answer streaming API
- `apps/console/src/app/(api)/v1/search/route.ts` - Search API
- `apps/console/src/app/(api)/v1/contents/route.ts` - Contents API
- `apps/console/src/app/(api)/v1/findsimilar/route.ts` - FindSimilar API
- `apps/console/src/app/(api)/v1/graph/[id]/route.ts` - Graph API
- `apps/console/src/app/(api)/v1/related/[id]/route.ts` - Related API
- `apps/console/src/lib/v1/` - Shared logic layer (search, contents, findsimilar, graph, related)
- `apps/console/src/components/app-sidebar.tsx` - Sidebar navigation
- `apps/chat/src/app/(chat)/_components/chat-empty-state.tsx` - Chat landing text
- `apps/chat/src/app/(chat)/_components/chat-new-session-view.tsx` - Chat empty state layout
- `apps/chat/src/app/(chat)/_components/chat-existing-session-view.tsx` - Chat messages layout
- `apps/chat/src/app/(chat)/_components/chat-interface.tsx` - Chat orchestrator (~1255 lines)
- `apps/chat/src/app/(chat)/_components/chat-messages.tsx` - Chat message rendering (~1223 lines)
- `apps/chat/src/app/(chat)/_components/chat-prompt-input.tsx` - Chat prompt input
- `apps/chat/src/app/(chat)/_components/prompt-suggestions.tsx` - Category-based suggestions
- `apps/chat/src/styles/globals.css` - Chat styling (OKLCH dark theme)
- `packages/ui/src/components/ai-elements/prompt-input.tsx` - Shared PromptInput (963 lines)
- `packages/ui/src/components/ai-elements/conversation.tsx` - Shared Conversation (63 lines)
- `packages/ui/src/components/ai-elements/message.tsx` - Shared Message (82 lines)
- `packages/ui/src/components/ai-elements/response.tsx` - Shared Response (233 lines)
- `packages/ui/src/components/ai-elements/reasoning.tsx` - Shared Reasoning (178 lines)
- `packages/ui/src/components/ai-elements/actions.tsx` - Shared Actions (66 lines)

## Architecture Documentation

### Current Single-Page Pattern
```
[slug]/[workspaceName]/page.tsx (server)
  └── WorkspaceSearch (client)
        ├── ToggleGroup: search | answer
        ├── [if search] → Search controls + results + find-similar + graph links
        └── [if answer] → AnswerInterface
                            ├── AnswerMessages (Conversation + turns)
                            └── PromptInput
```

### Chat App Pattern (Reference for Ask Lightfast)
```
apps/chat/
  └── ChatInterface (client orchestrator)
        ├── [if new session] → ChatNewSessionView
        │     ├── ChatEmptyState ("What can I do for you?")
        │     ├── ChatPromptInput (full PromptInput)
        │     └── PromptSuggestions (3 categories × 4 prompts)
        └── [if existing session] → ChatExistingSessionView
              ├── ChatMessages (turn-based, streaming)
              │     ├── UserMessage (right-aligned)
              │     └── AssistantMessage (parts: text, reasoning, tools)
              └── ChatPromptInput (fixed bottom, gradient overlay)
```

### Key Differences: Console Answer vs Chat App

| Aspect | Console Answer | Chat App |
|--------|---------------|----------|
| Landing state | Simple text "Ask a question..." | Branded "What can I do for you?" + suggestions |
| Prompt suggestions | None | 3 categories × 4 prompts with animation |
| Session persistence | Redis (1hr TTL) | Database (permanent) |
| Model selection | Hardcoded claude-sonnet | User-selectable models |
| Attachments | Not supported | Full attachment upload |
| Web search | Not available | Toggle button |
| Citations | Not rendered | InlineCitationCard carousel |
| Feedback | Not available | Thumbs up/down |
| Streaming animation | Bounce dots | SineWaveDots + typewriter |
| Artifacts | Not supported | ArtifactPane side panel |
| Auth | Dual (API key + Clerk session) | Clerk (auth'd + anon) |

## Open Questions

1. **Route path**: Should Ask Lightfast be at `/{slug}/{workspaceName}/ask` or `/{slug}/{workspaceName}/answer`?
2. **Sidebar position**: Where should "Ask Lightfast" appear in the sidebar navigation relative to "Dashboard"?
3. **Prompt suggestions**: What categories/prompts should be workspace-specific? (e.g., "What PRs were merged this week?", "Show deployment history")
4. **Session persistence**: Should Ask Lightfast sessions persist beyond 1hr? The current Redis TTL is ephemeral.
5. **Landing branding**: Should the empty state say "Ask Lightfast" or something workspace-specific?
6. **Search page rename**: Should the current dashboard/search page URL remain at root `/{slug}/{workspaceName}` or move to `/{slug}/{workspaceName}/search`?
