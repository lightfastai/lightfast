"use client";

import type { SearchResponse } from "@repo/app-validation";
import { FileText } from "lucide-react";
import { SearchResultCard } from "./search-result-card";

interface SearchResultsListProps {
  expandedId: string;
  offset: number;
  onExpandedIdChange: (id: string) => void;
  searchResults: SearchResponse;
}

export function SearchResultsList({
  searchResults,
  expandedId,
  onExpandedIdChange,
  offset,
}: SearchResultsListProps) {
  return (
    <div className="space-y-2">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {searchResults.total} results
        </p>
      </div>

      {/* Result cards */}
      {searchResults.results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-sm">No results found</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Try a different query or adjust your filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.results.map((result, index) => (
            <SearchResultCard
              isExpanded={expandedId === result.id}
              key={result.id}
              onToggleExpand={() =>
                onExpandedIdChange(expandedId === result.id ? "" : result.id)
              }
              rank={index + offset + 1}
              result={result}
            />
          ))}
        </div>
      )}
    </div>
  );
}
