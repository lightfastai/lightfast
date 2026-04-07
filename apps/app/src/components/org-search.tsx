"use client";

import { useActiveOrg } from "@repo/app-trpc/hooks";
import type { SearchMode } from "@repo/app-validation";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseError } from "@vendor/observability/error/next";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "~/lib/api-client";
import { dateRangeFromPreset } from "./search-constants";
import { SearchFilters } from "./search-filters";
import { SearchPromptInput } from "./search-prompt-input";
import { SearchResultsPanel } from "./search-results-panel";
import { useOrgSearchParams } from "./use-org-search-params";

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
  const activeOrg = useActiveOrg();
  const clerkOrgId = activeOrg?.id ?? "";

  // Typed oRPC client scoped to the active org
  const client = useMemo(() => createApiClient(clerkOrgId), [clerkOrgId]);

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

  // Local input state (what the user is typing, before submission)
  const [inputValue, setInputValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  useEffect(() => {
    if (prevQuery !== query) {
      setPrevQuery(query);
      setInputValue(query);
    }
  }, [query, prevQuery]);

  // Build search request from URL-persisted params
  const searchInput = useMemo(
    () => ({
      query: query.trim(),
      limit,
      offset,
      mode,
      ...(sources.length > 0 && { sources }),
      ...(types.length > 0 && { types }),
      ...dateRangeFromPreset(agePreset),
    }),
    [query, limit, offset, mode, sources, types, agePreset]
  );

  // Search query — fires when URL params change and query is non-empty
  // queryKey includes clerkOrgId to prevent cross-org cache pollution
  const searchQuery = useQuery({
    queryKey: ["search", clerkOrgId, searchInput],
    queryFn: ({ signal }) => client.search(searchInput, { signal }),
    enabled: !!query.trim() && !!clerkOrgId,
    placeholderData: keepPreviousData,
  });

  const isSearching = searchQuery.isFetching;
  const searchResults = searchQuery.data ?? null;
  const error = searchQuery.error ? parseError(searchQuery.error) : null;

  // Submit handler — writes inputValue to URL, triggering the query
  const handlePromptSubmit = async (
    message: PromptInputMessage
  ): Promise<void> => {
    const content = message.text?.trim() ?? "";
    await setQuery(content);
  };

  const handleSearch = () => {
    void setQuery(inputValue);
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
