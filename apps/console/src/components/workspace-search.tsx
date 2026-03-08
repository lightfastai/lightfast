"use client";

import { useTRPC } from "@repo/console-trpc/react";
import type { RerankMode, V1SearchResponse } from "@repo/console-types";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { dateRangeFromPreset } from "./search-constants";
import { SearchFilters } from "./search-filters";
import { SearchPromptInput } from "./search-prompt-input";
import { SearchResultsPanel } from "./search-results-panel";
import { useWorkspaceSearchParams } from "./use-workspace-search-params";

async function executeSearch(
  body: Record<string, unknown>,
  storeId: string,
  signal: AbortSignal
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
        `Search failed: ${response.status}`
    );
  }

  return (await response.json()) as V1SearchResponse;
}

interface WorkspaceSearchProps {
  initialQuery: string;
  orgSlug: string;
  workspaceName: string;
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
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  useEffect(() => {
    if (prevQuery !== query) {
      setPrevQuery(query);
      setInputValue(query);
    }
  }, [query, prevQuery]);

  // Fetch workspace's single store (1:1 relationship)
  const { data: store } = useSuspenseQuery({
    ...trpc.workspace.store.get.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName,
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
        "No store configured for this workspace. Connect a source first."
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
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Search failed");
        setSearchResults(null);
        setIsSearching(false);
      });
  };

  const handleSearch = () => {
    performSearch(inputValue);
  };

  const handlePromptSubmit = async (
    message: PromptInputMessage
  ): Promise<void> => {
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
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: search landmark captures keyboard events for the search form */}
      <div
        className="flex h-full flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
        role="search"
      >
        {/* Split Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL — Controls */}
          <div className="flex flex-1 flex-col overflow-hidden border-border">
            <ScrollArea className="h-full">
              <div className="space-y-5 p-4">
                <h1 className="font-semibold text-2xl">
                  Explore your infrastructure
                </h1>
                {/* Query Input */}
                <SearchPromptInput
                  clearDisabledReason="No filters applied"
                  isClearDisabled={
                    sourceTypes.length === 0 &&
                    observationTypes.length === 0 &&
                    actorNames.length === 0 &&
                    agePreset === "none"
                  }
                  isSubmitDisabled={isSearching || !inputValue.trim() || !store}
                  mode={mode}
                  onChange={setInputValue}
                  onClear={clearFilters}
                  onModeChange={(v) => setMode(v as RerankMode)}
                  onSubmit={handlePromptSubmit}
                  placeholder="Ask a question or describe what you're looking for..."
                  status={isSearching ? "submitted" : "ready"}
                  submitDisabledReason={
                    store ? undefined : "No store configured for this workspace"
                  }
                  value={inputValue}
                />

                <div className="mt-12">
                  <SearchFilters
                    actorNames={actorNames}
                    agePreset={agePreset}
                    includeContext={includeContext}
                    includeHighlights={includeHighlights}
                    limit={limit}
                    observationTypes={observationTypes}
                    offset={offset}
                    onActorNamesChange={setActorNames}
                    onAgePresetChange={(v) =>
                      void setAgePreset(v as typeof agePreset)
                    }
                    onIncludeContextChange={setIncludeContext}
                    onIncludeHighlightsChange={setIncludeHighlights}
                    onLimitChange={setLimit}
                    onObservationTypesChange={setObservationTypes}
                    onOffsetChange={setOffset}
                    onSourceTypesChange={setSourceTypes}
                    orgSlug={orgSlug}
                    sourceTypes={sourceTypes}
                    workspaceName={workspaceName}
                  />
                </div>

                {/* Error Display */}
                {error && (
                  <>
                    <Separator />
                    <p className="text-destructive text-sm">{error}</p>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT PANEL — Results */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SearchResultsPanel
              activeTab={activeTab}
              expandedId={expandedId}
              offset={offset}
              onActiveTabChange={(v) =>
                void setActiveTab(v as typeof activeTab)
              }
              onExpandedIdChange={setExpandedId}
              searchResults={searchResults}
              storeId={store ? store.id : ""}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// Loading skeleton
export function WorkspaceSearchSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      {/* Panel skeleton */}
      <div className="flex flex-1 rounded-lg border">
        <div className="w-[35%] space-y-4 border-r p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
