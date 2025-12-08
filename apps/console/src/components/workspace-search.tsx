"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Search, Database, FileText, ExternalLink, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

interface WorkspaceSearchProps {
  orgSlug: string;
  workspaceName: string;
  initialQuery: string;
  initialStore: string;
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
  };
}

export function WorkspaceSearch({
  orgSlug,
  workspaceName,
  initialQuery,
  initialStore,
}: WorkspaceSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const [_isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(initialQuery);
  const [selectedStore, setSelectedStore] = useState(initialStore);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch stores list
  const { data: stores } = useSuspenseQuery({
    ...trpc.workspace.stores.list.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update URL with search params
  const updateSearchParams = useCallback((newQuery: string, newStore: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newQuery) {
        params.set("q", newQuery);
      } else {
        params.delete("q");
      }
      if (newStore) {
        params.set("store", newStore);
      } else {
        params.delete("store");
      }
      router.push(`/${orgSlug}/${workspaceName}?${params.toString()}`);
    });
  }, [orgSlug, workspaceName, router, searchParams]);

  // Perform search via API route
  const handleSearch = useCallback(async () => {
    if (!query.trim() || !selectedStore) {
      setError("Please enter a search query and select a store");
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
          store: selectedStore,
          topK: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: undefined })) as { error?: string };
        throw new Error(errorData.error ?? `Search failed: ${response.status}`);
      }

      const data = (await response.json()) as SearchResponse;
      setSearchResults(data);
      void updateSearchParams(query.trim(), selectedStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedStore, orgSlug, workspaceName, updateSearchParams]);

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
            {/* Store Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Select Store</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Choose a store to search" />
                </SelectTrigger>
                <SelectContent>
                  {stores.list.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No stores available. Connect a source first.
                    </div>
                  ) : (
                    stores.list.map((store) => (
                      <SelectItem key={store.id} value={store.slug}>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>{store.slug}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {store.documentCount} docs
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
                disabled={isSearching || !query.trim() || !selectedStore}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
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
                ({searchResults.latency.total}ms)
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
                  Select a store and enter a query to search through your indexed documents
                  using semantic similarity.
                </p>
              </div>
              {stores.total > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3 w-3" />
                  {stores.total} store{stores.total !== 1 ? "s" : ""} available
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
          View Insights →
        </Link>
        <Link
          href={`/${orgSlug}/${workspaceName}/sources`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage Sources →
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
              <Badge
                variant={scorePercent >= 80 ? "default" : scorePercent >= 60 ? "secondary" : "outline"}
                className="shrink-0 text-xs"
              >
                {scorePercent}%
              </Badge>
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
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-64" />
            </div>
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
