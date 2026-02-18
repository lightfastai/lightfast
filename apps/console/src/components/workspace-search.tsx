"use client";

import { useState, useRef, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { V1SearchResponse, RerankMode } from "@repo/console-types";
import { useWorkspaceSearchParams } from "./use-workspace-search-params";
import { SearchPromptInput } from "./search-prompt-input";
import { dateRangeFromPreset } from "./search-constants";
import { SearchFilters } from "./search-filters";
import { SearchResultsPanel } from "./search-results-panel";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import { Separator } from "@repo/ui/components/ui/separator";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

async function executeSearch(
  body: Record<string, unknown>,
  storeId: string,
  signal: AbortSignal,
): Promise<V1SearchResponse> {
  const response = await fetch("/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Workspace-ID": storeId,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: undefined, message: undefined }))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      errorData.message ??
        errorData.error ??
        `Search failed: ${response.status}`,
    );
  }

  return (await response.json()) as V1SearchResponse;
}

interface WorkspaceSearchProps {
  orgSlug: string;
  workspaceName: string;
  initialQuery: string;
}

/**
 * Workspace Search Component with Playground Layout
 *
 * Split-panel UI with left panel controls and right panel results.
 * All state persisted to URL via nuqs for shareable links.
 */
export function WorkspaceSearch({
  orgSlug,
  workspaceName,
  initialQuery,
}: WorkspaceSearchProps) {
  const trpc = useTRPC();

  // URL-persisted state via nuqs
  const {
    query,
    setQuery,
    mode,
    setMode,
    sourceTypes,
    setSourceTypes,
    observationTypes,
    setObservationTypes,
    actorNames,
    setActorNames,
    expandedId,
    setExpandedId,
    limit,
    setLimit,
    offset,
    setOffset,
    includeContext,
    setIncludeContext,
    includeHighlights,
    setIncludeHighlights,
    agePreset,
    setAgePreset,
    activeTab,
    setActiveTab,
    clearFilters,
  } = useWorkspaceSearchParams(initialQuery);

  // Local state for search results and input
  const [searchResults, setSearchResults] = useState<V1SearchResponse | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setInputValue(query);
  }

  // Fetch workspace's single store (1:1 relationship)
  const { data: store } = useSuspenseQuery({
    ...trpc.workspace.store.get.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reference to track current request for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight request when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const performSearch = (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setError("Please enter a search query");
        return;
      }

      if (!store) {
        setError(
          "No store configured for this workspace. Connect a source first.",
        );
        return;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsSearching(true);
      setError(null);
      // Keep previous results visible during loading to avoid flash of empty state

      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        limit,
        offset,
        mode,
        filters: {
          ...(sourceTypes.length > 0 && { sourceTypes }),
          ...(observationTypes.length > 0 && { observationTypes }),
          ...(actorNames.length > 0 && { actorNames }),
          ...dateRangeFromPreset(agePreset),
        },
        includeContext,
        includeHighlights,
      };

      executeSearch(body, store.id, abortControllerRef.current.signal)
        .then((data) => {
          setSearchResults(data);
          setIsSearching(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Search failed");
          setSearchResults(null);
          setIsSearching(false);
        });
  };

  const handleSearch = () => {
    performSearch(query);
  };

  const handlePromptSubmit = async (message: PromptInputMessage): Promise<void> => {
    const content = message.text?.trim() ?? "";
    await setQuery(content);
    performSearch(content);
  };

  // Handle Cmd+Enter keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSearching) {
      e.preventDefault();
      void handleSearch();
    }
  };

  return (
    <div
      role="search"
      className="flex flex-col h-full overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Controls */}
        <div className="flex-1  border-border overflow-hidden flex flex-col">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              <h1 className="text-2xl font-semibold">
                Explore your infrastructure
              </h1>
              {/* Query Input */}
              <SearchPromptInput
                placeholder="Ask a question or describe what you're looking for..."
                onSubmit={handlePromptSubmit}
                status={isSearching ? "submitted" : "ready"}
                isSubmitDisabled={isSearching || !inputValue.trim() || !store}
                submitDisabledReason={
                  !store ? "No store configured for this workspace" : undefined
                }
                value={inputValue}
                onChange={setInputValue}
                onClear={clearFilters}
                isClearDisabled={
                  sourceTypes.length === 0 &&
                  observationTypes.length === 0 &&
                  actorNames.length === 0 &&
                  agePreset === "none"
                }
                clearDisabledReason="No filters applied"
                mode={mode}
                onModeChange={(v) => setMode(v as RerankMode)}
              />

              <div className="mt-12">
                <SearchFilters
                  limit={limit}
                  onLimitChange={setLimit}
                  offset={offset}
                  onOffsetChange={setOffset}
                  includeContext={includeContext}
                  onIncludeContextChange={setIncludeContext}
                  includeHighlights={includeHighlights}
                  onIncludeHighlightsChange={setIncludeHighlights}
                  sourceTypes={sourceTypes}
                  onSourceTypesChange={setSourceTypes}
                  observationTypes={observationTypes}
                  onObservationTypesChange={setObservationTypes}
                  actorNames={actorNames}
                  onActorNamesChange={setActorNames}
                  agePreset={agePreset}
                  onAgePresetChange={(v) => void setAgePreset(v as typeof agePreset)}
                  orgSlug={orgSlug}
                  workspaceName={workspaceName}
                />
              </div>

              {/* Error Display */}
              {error && (
                <>
                  <Separator />
                  <p className="text-sm text-destructive">{error}</p>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT PANEL — Results */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <SearchResultsPanel
            searchResults={searchResults}
            activeTab={activeTab}
            onActiveTabChange={(v) => void setActiveTab(v as typeof activeTab)}
            expandedId={expandedId}
            onExpandedIdChange={setExpandedId}
            offset={offset}
            storeId={store ? store.id : ""}
          />
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
export function WorkspaceSearchSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-4rem)]">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      {/* Panel skeleton */}
      <div className="flex-1 rounded-lg border flex">
        <div className="w-[35%] border-r p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
