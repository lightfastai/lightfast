"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { FileText } from "lucide-react";
import type { V1SearchResponse } from "@repo/console-types";
import { SearchResultCard } from "./search-result-card";

interface SearchResultsListProps {
  searchResults: V1SearchResponse;
  expandedId: string;
  onExpandedIdChange: (id: string) => void;
  offset: number;
  storeId: string;
}

export function SearchResultsList({
  searchResults,
  expandedId,
  onExpandedIdChange,
  offset,
  storeId,
}: SearchResultsListProps) {
  return (
    <div className="space-y-2">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {searchResults.data.length} results
          <span className="ml-1">
            ({searchResults.latency.total}ms total,{" "}
            {searchResults.latency.retrieval}ms retrieval
            {searchResults.latency.rerank
              ? `, ${searchResults.latency.rerank}ms ${searchResults.meta.mode}`
              : ""}
            )
          </span>
        </p>
        <Badge variant="outline">{searchResults.meta.mode}</Badge>
      </div>

      {/* Context clusters & actors */}
      {searchResults.context && (
        <div className="flex flex-wrap gap-4 text-xs">
          {searchResults.context.clusters &&
            searchResults.context.clusters.length > 0 && (
              <div>
                <span className="text-muted-foreground">Topics: </span>
                {searchResults.context.clusters.map((c, i) => (
                  <Badge key={i} variant="secondary" className="mr-1 text-xs">
                    {c.topic ?? "Uncategorized"}
                    {c.keywords.length > 0 &&
                      ` (${c.keywords.slice(0, 2).join(", ")})`}
                  </Badge>
                ))}
              </div>
            )}
          {searchResults.context.relevantActors &&
            searchResults.context.relevantActors.length > 0 && (
              <div>
                <span className="text-muted-foreground">Contributors: </span>
                {searchResults.context.relevantActors.map((a, i) => (
                  <Badge key={i} variant="secondary" className="mr-1 text-xs">
                    {a.displayName}
                    {a.expertiseDomains.length > 0 &&
                      ` (${a.expertiseDomains[0]})`}
                  </Badge>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Result cards */}
      {searchResults.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No results found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different query or adjust your filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.data.map((result, index) => (
            <SearchResultCard
              key={result.id}
              result={result}
              rank={index + offset + 1}
              isExpanded={expandedId === result.id}
              onToggleExpand={() =>
                onExpandedIdChange(expandedId === result.id ? "" : result.id)
              }
              storeId={storeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
