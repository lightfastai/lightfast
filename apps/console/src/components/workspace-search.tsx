"use client";

import { useState, useCallback, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
  Search,
  Database,
  FileText,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
  Scale,
  Brain,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import type {
  V1SearchResponse,
  V1SearchResult,
  V1ContentsResponse,
  V1FindSimilarResponse,
  RerankMode,
} from "@repo/console-types";
import { useWorkspaceSearchParams } from "./use-workspace-search-params";
import { ActorFilter } from "./actor-filter";

interface WorkspaceSearchProps {
  orgSlug: string;
  workspaceName: string;
  initialQuery: string;
}


const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
];

const OBSERVATION_TYPE_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
];

const MODE_OPTIONS: { value: RerankMode; label: string; icon: typeof Zap; description: string }[] = [
  { value: "fast", label: "Fast", icon: Zap, description: "Vector scores only (~50ms)" },
  { value: "balanced", label: "Balanced", icon: Scale, description: "Cohere rerank (~130ms)" },
  { value: "thorough", label: "Thorough", icon: Brain, description: "LLM scoring (~600ms)" },
];

/**
 * Workspace Search Component
 *
 * Note: Store selector has been removed - each workspace has exactly ONE store (1:1 relationship).
 * The search API automatically uses the workspace's single store.
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
    clearFilters,
  } = useWorkspaceSearchParams(initialQuery);

  // Local state for search results
  const [searchResults, setSearchResults] = useState<V1SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Perform search via API route
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    if (!store) {
      setError("No store configured for this workspace. Connect a source first.");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch("/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-ID": store.id,
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 20,
          offset: 0,
          mode: mode,
          filters: {
            sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
            observationTypes: observationTypes.length > 0 ? observationTypes : undefined,
            actorNames: actorNames.length > 0 ? actorNames : undefined,
          },
          includeContext: true,
          includeHighlights: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: undefined, message: undefined })) as { error?: string; message?: string };
        throw new Error(errorData.message ?? errorData.error ?? `Search failed: ${response.status}`);
      }

      const data = (await response.json()) as V1SearchResponse;
      setSearchResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, store, mode, sourceTypes, observationTypes, actorNames]);

  // Handle enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      void handleSearch();
    }
  }, [handleSearch, isSearching]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Semantic
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Search through your workspace knowledge using natural language
        </p>
      </div>

      {/* Search Controls */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Store Info (read-only) */}
            {store && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Searching in: {store.embeddingModel} ({store.documentCount} docs)</span>
              </div>
            )}

            {/* Search Mode Toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Search Mode</span>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => value && setMode(value as RerankMode)}
                className="justify-start"
              >
                {MODE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    className="gap-1 text-xs"
                    title={option.description}
                  >
                    <option.icon className="h-3 w-3" />
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ask a question or describe what you're looking for..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  disabled={isSearching}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !query.trim() || !store}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4">
              {/* Source Type Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Sources</span>
                <div className="flex flex-wrap gap-1">
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={sourceTypes.includes(option.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        void setSourceTypes(
                          sourceTypes.includes(option.value)
                            ? sourceTypes.filter(s => s !== option.value)
                            : [...sourceTypes, option.value]
                        );
                      }}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Observation Type Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Event Types</span>
                <div className="flex flex-wrap gap-1">
                  {OBSERVATION_TYPE_OPTIONS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={observationTypes.includes(option.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        void setObservationTypes(
                          observationTypes.includes(option.value)
                            ? observationTypes.filter(s => s !== option.value)
                            : [...observationTypes, option.value]
                        );
                      }}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actor Filter */}
              <ActorFilter
                orgSlug={orgSlug}
                workspaceName={workspaceName}
                selectedActors={actorNames}
                onSelectionChange={setActorNames}
              />

              {/* Clear Filters */}
              {(sourceTypes.length > 0 || observationTypes.length > 0 || actorNames.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="self-end"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {searchResults.data.length} result{searchResults.data.length !== 1 ? "s" : ""} found
              <span className="ml-2 text-xs">
                ({searchResults.latency.total}ms total, {searchResults.latency.retrieval}ms retrieval
                {searchResults.latency.rerank > 0 && `, ${searchResults.latency.rerank}ms ${searchResults.meta.mode}`})
              </span>
            </p>
            <Badge variant="outline" className="text-xs">
              {searchResults.meta.mode}
            </Badge>
          </div>

          {/* Search Context */}
          {searchResults.context && (
            <div className="flex flex-wrap gap-4 pb-4 border-b">
              {/* Relevant Clusters */}
              {searchResults.context.clusters && searchResults.context.clusters.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Related Topics</span>
                  <div className="flex flex-wrap gap-1">
                    {searchResults.context.clusters.map((cluster, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs gap-1">
                        <span>{cluster.topic ?? "Uncategorized"}</span>
                        {cluster.keywords.length > 0 && (
                          <span className="text-muted-foreground">
                            ({cluster.keywords.slice(0, 2).join(", ")})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Relevant Actors */}
              {searchResults.context.relevantActors && searchResults.context.relevantActors.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Key Contributors</span>
                  <div className="flex flex-wrap gap-1">
                    {searchResults.context.relevantActors.map((actor, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs gap-1">
                        <span>{actor.displayName}</span>
                        {actor.expertiseDomains.length > 0 && (
                          <span className="text-muted-foreground">
                            • {actor.expertiseDomains[0]}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results List */}
          {searchResults.data.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No results found for &quot;{query}&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different query or check that documents are indexed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {searchResults.data.map((result, index) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  rank={index + 1}
                  isExpanded={expandedId === result.id}
                  onToggleExpand={() => void setExpandedId(expandedId === result.id ? null : result.id)}
                  storeId={store?.id ?? ""}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State - Before Search */}
      {!searchResults && !error && (
        <Card className="border-border/60 border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Search your knowledge base</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Enter a query to search through your indexed documents
                  using semantic similarity.
                </p>
              </div>
              {store && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3 w-3" />
                  {store.documentCount} documents indexed
                </div>
              )}
              {!store && (
                <div className="text-xs text-muted-foreground">
                  Connect a source to start indexing documents
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="flex items-center gap-4 text-sm">
        <Link
          href={`/${orgSlug}/${workspaceName}/insights`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          View Insights
        </Link>
        <Link
          href={`/${orgSlug}/${workspaceName}/sources`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage Sources
        </Link>
      </div>
    </div>
  );
}

// Search result card component with expandable content
function SearchResultCard({
  result,
  rank,
  isExpanded,
  onToggleExpand,
  storeId,
}: {
  result: V1SearchResult;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  storeId: string;
}) {
  const scorePercent = Math.round(result.score * 100);
  const [contentData, setContentData] = useState<{
    content: string | null;
    metadata: Record<string, unknown> | null;
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Similar items state
  const [similarData, setSimilarData] = useState<V1FindSimilarResponse | null>(null);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);

  // Fetch content when expanded
  useEffect(() => {
    if (isExpanded && !contentData && !isLoadingContent) {
      setIsLoadingContent(true);
      setContentError(null);

      fetch("/v1/contents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-ID": storeId,
        },
        body: JSON.stringify({ ids: [result.id] }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch content");
          const data = (await res.json()) as V1ContentsResponse;
          const item = data.items[0];
          if (item) {
            setContentData({
              content: item.content ?? null,
              metadata: item.metadata ?? null,
            });
          } else {
            setContentError("Content not found");
          }
        })
        .catch((err) => {
          setContentError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          setIsLoadingContent(false);
        });
    }
  }, [isExpanded, contentData, isLoadingContent, result.id, storeId]);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(result.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const fetchSimilar = async () => {
    if (similarData) {
      setShowSimilar(true);
      return;
    }

    setIsLoadingSimilar(true);
    setSimilarError(null);
    setShowSimilar(true);

    try {
      const res = await fetch("/v1/findsimilar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-ID": storeId,
        },
        body: JSON.stringify({
          id: result.id,
          limit: 5,
          threshold: 0.5,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch similar items");
      const data = (await res.json()) as V1FindSimilarResponse;
      setSimilarData(data);
    } catch (err) {
      setSimilarError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoadingSimilar(false);
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card className="border-border/60 hover:border-border transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Rank indicator */}
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
              {rank}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title row with expand trigger */}
              <div className="flex items-start justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 hover:text-primary transition-colors text-left">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <h3 className="font-medium text-sm leading-tight">
                      {result.title || "Untitled Document"}
                    </h3>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={scorePercent >= 80 ? "default" : scorePercent >= 60 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {scorePercent}%
                  </Badge>
                  {result.source && (
                    <Badge variant="outline" className="text-xs">
                      {result.source}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Snippet (collapsed view) */}
              {!isExpanded && result.snippet && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {result.snippet}
                </p>
              )}

              {/* Type and date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {result.type && <span>{result.type}</span>}
                {result.occurredAt && (
                  <span>{new Date(result.occurredAt).toLocaleDateString()}</span>
                )}
              </div>

              {/* Expanded content */}
              <CollapsibleContent className="space-y-4 pt-2">
                {/* ID and URL */}
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1"
                    onClick={handleCopyId}
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span className="font-mono">{result.id}</span>
                  </Button>
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View source
                    </a>
                  )}
                </div>

                {/* Entities */}
                {result.entities && result.entities.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Entities</span>
                    <div className="flex flex-wrap gap-1">
                      {result.entities.map((entity, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {entity.key}
                          <span className="ml-1 text-muted-foreground">({entity.category})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Content */}
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Content</span>
                  {isLoadingContent ? (
                    <Skeleton className="h-24 w-full" />
                  ) : contentError ? (
                    <p className="text-xs text-destructive">{contentError}</p>
                  ) : contentData?.content ? (
                    <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {contentData.content}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No content available</p>
                  )}
                </div>

                {/* Metadata */}
                {contentData?.metadata && Object.keys(contentData.metadata).length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Metadata</span>
                    <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto max-h-32 overflow-y-auto">
                      {JSON.stringify(contentData.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Find Similar Button and Results */}
                <div className="space-y-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSimilar}
                    disabled={isLoadingSimilar}
                    className="gap-1"
                  >
                    {isLoadingSimilar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Find Similar
                    {similarData && ` (${similarData.similar.length})`}
                  </Button>

                  {showSimilar && (
                    <div className="space-y-2">
                      {similarError ? (
                        <p className="text-xs text-destructive">{similarError}</p>
                      ) : isLoadingSimilar ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ) : similarData && similarData.similar.length > 0 ? (
                        <>
                          {/* Source cluster info */}
                          {similarData.source.cluster && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>Cluster:</span>
                              <Badge variant="secondary" className="text-xs">
                                {similarData.source.cluster.topic ?? "Uncategorized"}
                              </Badge>
                              <span>({similarData.source.cluster.memberCount} items)</span>
                            </div>
                          )}

                          {/* Similar items list */}
                          <div className="space-y-1">
                            {similarData.similar.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-2 p-2 rounded border bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium truncate">{item.title}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge variant="outline" className="text-[10px]">
                                        {Math.round(item.score * 100)}%
                                      </Badge>
                                      {item.sameCluster && (
                                        <Badge variant="secondary" className="text-[10px]">
                                          Same Cluster
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{item.source}</span>
                                    <span>•</span>
                                    <span>{item.type}</span>
                                    {item.entityOverlap !== undefined && item.entityOverlap > 0 && (
                                      <>
                                        <span>•</span>
                                        <span>{Math.round(item.entityOverlap * 100)}% entity overlap</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0"
                                  >
                                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No similar items found</p>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// Loading skeleton
export function WorkspaceSearchSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Search Controls Skeleton */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State Skeleton */}
      <Card className="border-border/60 border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
