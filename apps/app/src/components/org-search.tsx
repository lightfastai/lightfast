"use client";

import type { SearchMode, SearchResponse } from "@repo/app-validation";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useOrganization } from "@vendor/clerk/client";
import { useEffect, useRef, useState } from "react";
import { dateRangeFromPreset } from "./search-constants";
import { SearchFilters } from "./search-filters";
import { SearchPromptInput } from "./search-prompt-input";
import { SearchResultsPanel } from "./search-results-panel";
import { useOrgSearchParams } from "./use-org-search-params";

async function executeSearch(
  body: Record<string, unknown>,
  clerkOrgId: string,
  signal: AbortSignal
): Promise<SearchResponse> {
  const response = await fetch("/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Org-ID": clerkOrgId,
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

  return (await response.json()) as SearchResponse;
}

interface OrgSearchProps {
  initialQuery: string;
}

/**
 * Org Search Component with Playground Layout
 *
 * Split-panel UI with left panel controls and right panel results.
 * All state persisted to URL via nuqs for shareable links.
 */
export function OrgSearch({ initialQuery }: OrgSearchProps) {
  const { organization } = useOrganization();

  // URL-persisted state via nuqs
  const {
    query,
    setQuery,
    mode,
    setMode,
    sources,
    setSources,
    types,
    setTypes,
    expandedId,
    setExpandedId,
    limit,
    setLimit,
    offset,
    setOffset,
    agePreset,
    setAgePreset,
    activeTab,
    setActiveTab,
    clearFilters,
  } = useOrgSearchParams(initialQuery);

  // Local state for search results and input
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
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

  const clerkOrgId = organization?.id ?? "";

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
      ...(sources.length > 0 && { sources }),
      ...(types.length > 0 && { types }),
      ...dateRangeFromPreset(agePreset),
    };

    executeSearch(body, clerkOrgId, abortControllerRef.current.signal)
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
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: search container handles keyboard navigation
    <search
      className="flex h-full flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
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
                  sources.length === 0 &&
                  types.length === 0 &&
                  agePreset === "none"
                }
                isSubmitDisabled={isSearching || !inputValue.trim()}
                mode={mode}
                onChange={setInputValue}
                onClear={clearFilters}
                onModeChange={(v) => setMode(v as SearchMode)}
                onSubmit={handlePromptSubmit}
                placeholder="Ask a question or describe what you're looking for..."
                status={isSearching ? "submitted" : "ready"}
                value={inputValue}
              />

              <div className="mt-12">
                <SearchFilters
                  agePreset={agePreset}
                  limit={limit}
                  observationTypes={types}
                  offset={offset}
                  onAgePresetChange={(v) =>
                    void setAgePreset(v as typeof agePreset)
                  }
                  onLimitChange={setLimit}
                  onObservationTypesChange={setTypes}
                  onOffsetChange={setOffset}
                  onSourceTypesChange={setSources}
                  sourceTypes={sources}
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
            onActiveTabChange={(v) => void setActiveTab(v as typeof activeTab)}
            onExpandedIdChange={setExpandedId}
            searchResults={searchResults}
          />
        </div>
      </div>
    </search>
  );
}

// Loading skeleton
export function OrgSearchSkeleton() {
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
