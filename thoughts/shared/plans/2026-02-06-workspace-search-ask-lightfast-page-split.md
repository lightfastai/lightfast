# Workspace Search & Ask Lightfast Page Split - Implementation Plan

## Overview

Split the current single workspace page (`/{slug}/{workspaceName}/`) — which toggles between "Direct Search" and "AI Answer" modes — into two separate pages:

1. **Ask Lightfast** at `/{slug}/{workspaceName}/` (root) — AI answer interface modeled after the chat app
2. **Search** at `/{slug}/{workspaceName}/search` — Semantic search with filters and results

## Current State Analysis

The workspace page at `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx` renders a single `WorkspaceSearch` client component (897 lines) that uses a `ToggleGroup` to switch between "Direct Search" and "AI Answer" modes via the `m` URL parameter. Both modes share the same nuqs-managed URL state. The Answer mode renders `<AnswerInterface workspaceId={store.id} />` which is a minimal 119-line component using `useChat` + `AnswerMessages` + `PromptInput`.

### Key Discoveries:
- `workspace-search.tsx:206-220` — ToggleGroup controls `m` param ("search" | "answer")
- `workspace-search.tsx:230-234` — Answer mode: renders `<AnswerInterface>` with min-height container
- `workspace-search.tsx:237-518` — Search mode: controls, filters, results, quick links (~280 lines of JSX)
- `use-workspace-search-params.ts:31` — `m` param defaults to "search"
- `answer-interface.tsx:73-116` — Has its own PromptInput with responsive padding
- `app-sidebar.tsx:27-29` — "Dashboard" nav item points to `/${orgSlug}/${workspaceName}`
- Parent layout at `[slug]/layout.tsx:58-63` provides `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` container
- No layout.tsx exists at `[workspaceName]` level — workspace pages inherit from `[slug]/layout.tsx`
- Chat app's `ChatNewSessionView` uses centered flex layout with `max-w-3xl`, `ChatEmptyState`, prompt suggestions, and `ChatPromptInput`

## Desired End State

After implementation:

1. **`/{slug}/{workspaceName}/`** renders the "Ask Lightfast" page:
   - Chat-app-inspired empty state with "Ask Lightfast" heading
   - Workspace-specific prompt suggestions (3 categories: Explore, Activity, Connections)
   - Full `AnswerInterface` with `AnswerMessages` + `PromptInput`
   - Centered layout similar to chat app's `ChatNewSessionView`

2. **`/{slug}/{workspaceName}/search`** renders the Search page:
   - All current search functionality (mode toggle, filters, results, find-similar, quick links)
   - Same URL params: `q`, `mode`, `sources`, `types`, `actors`, `expanded`
   - No `m` param (interface mode toggle removed)

3. **Sidebar** shows: "Ask Lightfast" (root), "Search", "Sources", "Jobs", "Settings"

### Verification:
- Navigate to `/{slug}/{workspaceName}/` → see Ask Lightfast empty state
- Submit a question → see streamed AI answer with tool results
- Navigate to `/{slug}/{workspaceName}/search` → see search page with filters
- Perform search → see results, expandable content, find-similar
- Sidebar links navigate correctly to both pages
- All existing search functionality preserved
- `pnpm build:console` succeeds
- `pnpm lint && pnpm typecheck` pass

## What We're NOT Doing

- Not adding session persistence beyond 1hr Redis TTL
- Not adding model selection to Ask Lightfast (stays hardcoded claude-sonnet)
- Not adding attachment upload support
- Not adding web search toggle
- Not adding feedback (thumbs up/down)
- Not adding streaming animations beyond current bounce dots
- Not creating a workspace-level layout.tsx
- Not modifying the answer API, transport, or tool system

## Implementation Approach

Extract the search functionality into a new route, then transform the root page into Ask Lightfast. The answer components (`answer-interface.tsx`, `answer-messages.tsx`, `answer-tool-results.tsx`) remain as-is — we only change how they're rendered at the page level and add the empty state + prompt suggestions.

---

## Phase 1: Create Search Sub-Route

### Overview
Create `/{slug}/{workspaceName}/search` page that renders the search functionality currently in `workspace-search.tsx`.

### Changes Required:

#### 1. New Search Page Server Component
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/search/page.tsx` (new)
**Changes**: Create server component that prefetches workspace store and renders search

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { WorkspaceSearch, WorkspaceSearchSkeleton } from "~/components/workspace-search";

export default async function WorkspaceSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { q = "" } = await searchParams;

  prefetch(
    orgTrpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <div className="flex flex-col gap-6 py-2 px-6">
          <Suspense fallback={<WorkspaceSearchSkeleton />}>
            <WorkspaceSearch
              orgSlug={slug}
              workspaceName={workspaceName}
              initialQuery={q}
            />
          </Suspense>
        </div>
      </HydrateClient>
    </div>
  );
}
```

#### 2. Refactor WorkspaceSearch to Search-Only
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**: Remove answer mode toggle, remove `interfaceMode` state, remove `AnswerInterface` import. The component becomes search-only.

- Remove the ToggleGroup (lines ~206-220) and interface mode conditional
- Remove `interfaceMode` / `setInterfaceMode` from the destructured hook
- Remove `AnswerInterface` import (line 43)
- Remove `Lightbulb` icon import (no longer needed)
- Remove the `{interfaceMode === "answer" && ...}` block (lines ~230-234)
- Remove the `{interfaceMode === "search" && ...}` conditional wrapper but keep its children (unwrap the search content)
- Update the header to always show "Search" with the Semantic badge
- Update the description to always show search description

#### 3. Remove `m` Param from URL State Hook
**File**: `apps/console/src/components/use-workspace-search-params.ts`
**Changes**: Remove the `m` (interface mode) parameter since pages are now separate routes

- Remove `interfaceModes` const
- Remove `m: parseAsStringLiteral(interfaceModes).withDefault("search")`
- Remove `interfaceMode` and `setInterfaceMode` from return object

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm lint && pnpm typecheck` pass

#### Manual Verification:
- [ ] Navigate to `/{slug}/{workspaceName}/search` → see full search page
- [ ] Search functionality works (query, filters, results)
- [ ] No toggle between search/answer visible
- [ ] URL params (`q`, `mode`, `sources`, `types`, `actors`, `expanded`) work correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Transform Root Page into Ask Lightfast

### Overview
Replace the current root workspace page with an Ask Lightfast page that uses a chat-app-inspired UX with empty state and prompt suggestions.

### Changes Required:

#### 1. Create Workspace Prompt Suggestions Component
**File**: `apps/console/src/components/ask-lightfast-suggestions.tsx` (new)
**Changes**: Workspace-specific prompt suggestions modeled after chat app's `prompt-suggestions.tsx`

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Search, Activity, GitBranch, X } from "lucide-react";
import { useState } from "react";

interface PromptCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompts: string[];
}

const categories: PromptCategory[] = [
  {
    id: "explore",
    label: "Explore",
    icon: <Search className="w-4 h-4" />,
    prompts: [
      "What are the main topics in this workspace?",
      "Summarize the most recent documents",
      "What are the key themes across all sources?",
      "Find the most referenced concepts",
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: <Activity className="w-4 h-4" />,
    prompts: [
      "What changed in the last 24 hours?",
      "Show me recent pull requests and their status",
      "What are the latest commits across all repos?",
      "Summarize this week's activity",
    ],
  },
  {
    id: "connections",
    label: "Connections",
    icon: <GitBranch className="w-4 h-4" />,
    prompts: [
      "How are the recent changes connected?",
      "What dependencies exist between components?",
      "Show relationships between recent PRs",
      "Find related documents across sources",
    ],
  },
];

interface AskLightfastSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
}

export function AskLightfastSuggestions({ onSelectPrompt }: AskLightfastSuggestionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visiblePrompts, setVisiblePrompts] = useState<number>(0);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setVisiblePrompts(0);

    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      category.prompts.forEach((_, index) => {
        setTimeout(() => {
          setVisiblePrompts((prev) => prev + 1);
        }, index * 100);
      });
    }
  };

  const handlePromptClick = (prompt: string) => {
    onSelectPrompt(prompt);
    setSelectedCategory(null);
    setVisiblePrompts(0);
  };

  const selectedCategoryData = categories.find(
    (c) => c.id === selectedCategory,
  );

  return (
    <div className="w-full mx-auto">
      {!selectedCategory ? (
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant="outline"
              size="lg"
              className="dark:bg-transparent"
              onClick={() => handleCategoryClick(category.id)}
            >
              {category.icon}
              <span>{category.label}</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="border border-border/50 p-2 rounded-xl bg-background backdrop-blur-2xl shadow-sm">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              {selectedCategoryData?.icon}
              <span>{selectedCategoryData?.label}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={() => {
                setSelectedCategory(null);
                setVisiblePrompts(0);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-1">
            {selectedCategoryData?.prompts.map((prompt, index) => (
              <div
                key={`${selectedCategory}-${prompt}`}
                className={cn(
                  "opacity-0 translate-y-4 transition-all duration-500 ease-out",
                  index < visiblePrompts && "opacity-100 translate-y-0",
                )}
                style={{
                  transitionDelay: `${index * 150}ms`,
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left justify-start whitespace-normal"
                >
                  <span className="text-xs font-base">{prompt}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2. Enhance Answer Interface with Empty State and Suggestions
**File**: `apps/console/src/components/answer-interface.tsx`
**Changes**: Add new/existing session view pattern like the chat app. When no messages, show centered empty state with prompt suggestions. When messages exist, show conversation + bottom input.

Key changes:
- Add `onSendMessage` callback that programmatically submits a prompt (for suggestion clicks)
- Add empty state view with "Ask Lightfast" heading and `<AskLightfastSuggestions>`
- Switch between empty state and conversation view based on `messages.length`
- Keep the existing `AnswerMessages` + `PromptInput` for the conversation view
- Add gradient overlay above input in conversation view (like chat app)

The component should follow the chat app's two-view pattern:
- **Empty state**: Centered vertically with heading → input → suggestions
- **Conversation state**: Messages fill space, input anchored at bottom with gradient

#### 3. Update Root Page Server Component
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`
**Changes**: Replace `WorkspaceSearch` with `AnswerInterface` (the Ask Lightfast page)

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { AskLightfast, AskLightfastSkeleton } from "~/components/ask-lightfast";

export default async function AskLightfastPage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  prefetch(
    orgTrpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
    })
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <HydrateClient>
        <Suspense fallback={<AskLightfastSkeleton />}>
          <AskLightfast orgSlug={slug} workspaceName={workspaceName} />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
```

#### 4. Create Ask Lightfast Page Component
**File**: `apps/console/src/components/ask-lightfast.tsx` (new)
**Changes**: Thin wrapper that fetches workspace store and renders `AnswerInterface`

This component:
- Uses `useSuspenseQuery` to get the workspace store (same pattern as `workspace-search.tsx`)
- Passes `workspaceId` to `AnswerInterface`
- Exports `AskLightfastSkeleton` for Suspense fallback

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AnswerInterface } from "./answer-interface";

interface AskLightfastProps {
  orgSlug: string;
  workspaceName: string;
}

export function AskLightfast({ orgSlug, workspaceName }: AskLightfastProps) {
  const trpc = useTRPC();

  const { data: store } = useSuspenseQuery({
    ...trpc.workspace.store.get.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return <AnswerInterface workspaceId={store.id} />;
}

export function AskLightfastSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[72px] w-full max-w-3xl" />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm lint && pnpm typecheck` pass

#### Manual Verification:
- [ ] Navigate to `/{slug}/{workspaceName}/` → see "Ask Lightfast" empty state
- [ ] See 3 prompt suggestion categories (Explore, Activity, Connections)
- [ ] Click category → see animated prompt list
- [ ] Click prompt → message sent, answer streams back
- [ ] Type question and submit → answer streams correctly with tool results
- [ ] After first message, layout switches from centered to conversation mode
- [ ] Prompt input is anchored at bottom with gradient overlay in conversation mode

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Update Navigation

### Overview
Update the sidebar to reflect the new two-page structure.

### Changes Required:

#### 1. Update Sidebar Navigation Items
**File**: `apps/console/src/components/app-sidebar.tsx`
**Changes**: Replace "Dashboard" with "Ask Lightfast" and add "Search" entry

```typescript
function getWorkspaceNavItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Ask Lightfast",
      href: `/${orgSlug}/${workspaceName}`,
    },
    {
      title: "Search",
      href: `/${orgSlug}/${workspaceName}/search`,
    },
    {
      title: "Sources",
      href: `/${orgSlug}/${workspaceName}/sources`,
    },
    {
      title: "Jobs",
      href: `/${orgSlug}/${workspaceName}/jobs`,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/${workspaceName}/settings`,
    },
  ];
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm lint && pnpm typecheck` pass

#### Manual Verification:
- [ ] Sidebar shows: Ask Lightfast, Search, Sources, Jobs, Settings
- [ ] "Ask Lightfast" is active when on root workspace page
- [ ] "Search" is active when on search page
- [ ] All sidebar links navigate correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Cleanup

### Overview
Remove dead code from the toggle-based architecture.

### Changes Required:

#### 1. Clean Up workspace-search.tsx
**File**: `apps/console/src/components/workspace-search.tsx`
**Changes**:
- Verify no remaining references to `interfaceMode`, `setInterfaceMode`, or `AnswerInterface`
- Remove any dead imports (Lightbulb icon, AnswerInterface, etc.)
- Ensure `WorkspaceSearchSkeleton` export still works for the search page

#### 2. Clean Up use-workspace-search-params.ts
**File**: `apps/console/src/components/use-workspace-search-params.ts`
**Changes**:
- Verify `interfaceModes` const and `m` param are removed (done in Phase 1)
- Ensure no other files reference the removed exports

#### 3. Verify No Broken Imports
Run a project-wide search for:
- `interfaceMode` — should have zero hits outside this plan
- `setInterfaceMode` — should have zero hits
- `"answer"` mode references in workspace search context — should be gone

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm lint && pnpm typecheck` pass
- [ ] No TypeScript errors related to removed types/exports
- [ ] `grep -r "interfaceMode" apps/console/src/` returns no hits (excluding this plan)

#### Manual Verification:
- [ ] Full flow: Navigate to workspace → Ask Lightfast page loads → submit question → answer streams → navigate to Search → search works → navigate back to Ask Lightfast
- [ ] No console errors during navigation between pages

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `/{slug}/{workspaceName}/` — verify Ask Lightfast empty state with prompt suggestions
2. Click "Explore" category — verify animated prompt list appears
3. Click a prompt — verify message sends and AI answer streams back with tool results
4. Type a follow-up question — verify conversation continues
5. Navigate to `/{slug}/{workspaceName}/search` — verify search page loads
6. Enter a query and search — verify results appear with filters working
7. Toggle search mode (fast/balanced/thorough) — verify different results
8. Apply filters (sources, types, actors) — verify filtering works
9. Expand a search result — verify content loads
10. Click sidebar links — verify all navigation works
11. Use browser back/forward — verify URL state works on search page

## References

- Research: `thoughts/shared/research/2026-02-06-workspace-search-ask-lightfast-page-split.md`
- Current workspace page: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/page.tsx`
- Current combined component: `apps/console/src/components/workspace-search.tsx`
- Answer interface: `apps/console/src/components/answer-interface.tsx`
- Answer messages: `apps/console/src/components/answer-messages.tsx`
- Chat app empty state: `apps/chat/src/app/(chat)/_components/chat-empty-state.tsx`
- Chat app new session: `apps/chat/src/app/(chat)/_components/chat-new-session-view.tsx`
- Chat app suggestions: `apps/chat/src/app/(chat)/_components/prompt-suggestions.tsx`
- Sidebar: `apps/console/src/components/app-sidebar.tsx`
