"use client";

import type { SearchResponse } from "@repo/console-validation";
import { Badge } from "@repo/ui/components/ui/badge";
import { FileText } from "lucide-react";
import { SearchResultCard } from "./search-result-card";

interface SearchResultsListProps {
  expandedId: string;
  offset: number;
  onExpandedIdChange: (id: string) => void;
  searchResults: SearchResponse;
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
        <p className="text-muted-foreground text-sm">
          {searchResults.data.length} results
          <span className="ml-1">
            ({searchResults.latency?.total ?? 0}ms total,{" "}
            {searchResults.latency?.retrieval ?? 0}ms retrieval
            {searchResults.latency?.rerank != null
              ? `, ${searchResults.latency.rerank}ms ${searchResults.meta.mode}`
              : ""}
            )
          </span>
        </p>
        <Badge variant="outline">{searchResults.meta.mode}</Badge>
      </div>

      {/* Result cards */}
      {searchResults.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-sm">No results found</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Try a different query or adjust your filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.data.map((result, index) => (
            <SearchResultCard
              isExpanded={expandedId === result.id}
              key={result.id}
              onToggleExpand={() =>
                onExpandedIdChange(expandedId === result.id ? "" : result.id)
              }
              rank={index + offset + 1}
              result={result}
              storeId={storeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
