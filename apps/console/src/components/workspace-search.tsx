"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Search, Database, FileText, ExternalLink, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

interface WorkspaceSearchProps {
  orgSlug: string;
  workspaceName: string;
  initialQuery: string;
}

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SearchResponse {
  results: SearchResult[];
  requestId: string;
  latency: {
    total: number;
    retrieval: number;
    llmFilter: number;
  };
}

interface SearchFilters {
  sourceTypes: string[];
  observationTypes: string[];
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const [_isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    sourceTypes: [],
    observationTypes: [],
  });

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

  // Update URL with search params
  const updateSearchParams = useCallback((newQuery: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newQuery) {
        params.set("q", newQuery);
      } else {
        params.delete("q");
      }
      router.push(`/${orgSlug}/${workspaceName}?${params.toString()}`);
    });
  }, [orgSlug, workspaceName, router, searchParams]);

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
      const response = await fetch(`/${orgSlug}/${workspaceName}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
          topK: 20, // Increase to allow LLM filtering
          filters: {
            sourceTypes: filters.sourceTypes.length > 0 ? filters.sourceTypes : undefined,
            observationTypes: filters.observationTypes.length > 0 ? filters.observationTypes : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: undefined })) as { error?: string };
        throw new Error(errorData.error ?? `Search failed: ${response.status}`);
      }

      const data = (await response.json()) as SearchResponse;
      setSearchResults(data);
      void updateSearchParams(query.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, store, orgSlug, workspaceName, updateSearchParams, filters]);

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
                      variant={filters.sourceTypes.includes(option.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          sourceTypes: prev.sourceTypes.includes(option.value)
                            ? prev.sourceTypes.filter(s => s !== option.value)
                            : [...prev.sourceTypes, option.value],
                        }));
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
                      variant={filters.observationTypes.includes(option.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          observationTypes: prev.observationTypes.includes(option.value)
                            ? prev.observationTypes.filter(s => s !== option.value)
                            : [...prev.observationTypes, option.value],
                        }));
                      }}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {(filters.sourceTypes.length > 0 || filters.observationTypes.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ sourceTypes: [], observationTypes: [] })}
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
              {searchResults.results.length} result{searchResults.results.length !== 1 ? "s" : ""} found
              <span className="ml-2 text-xs">
                ({searchResults.latency.total}ms total, {searchResults.latency.retrieval}ms retrieval
                {searchResults.latency.llmFilter > 0 && `, ${searchResults.latency.llmFilter}ms LLM`})
              </span>
            </p>
          </div>

          {/* Results List */}
          {searchResults.results.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No results found for "{query}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different query or check that documents are indexed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {searchResults.results.map((result, index) => (
                <SearchResultCard key={result.id} result={result} rank={index + 1} />
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

// Search result card component
function SearchResultCard({ result, rank }: { result: SearchResult; rank: number }) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank indicator */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
            {rank}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-tight">
                {result.title || "Untitled Document"}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <Badge
                  variant={scorePercent >= 80 ? "default" : scorePercent >= 60 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {scorePercent}%
                </Badge>
                {/* Score breakdown if available */}
                {result.metadata.relevanceScore !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    (LLM: {Math.round((result.metadata.relevanceScore as number) * 100)}%)
                  </span>
                )}
              </div>
            </div>

            {/* Snippet */}
            {result.snippet && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {result.snippet}
              </p>
            )}

            {/* URL / Actions */}
            {result.url && (
              <div className="flex items-center gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-md"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{result.url}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
