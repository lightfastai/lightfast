"use client";

import type {
  ContentsResponse,
  FindSimilarResponse,
  SearchResult,
} from "@repo/app-validation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

// Search result card component with expandable content
export function SearchResultCard({
  result,
  rank: _rank,
  isExpanded,
  onToggleExpand,
  storeId,
}: {
  result: SearchResult;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  storeId: string;
}) {
  const scorePercent = Math.round(result.score * 100);
  const [copiedId, setCopiedId] = useState(false);

  const {
    data: contentData,
    error: contentQueryError,
    isLoading: isLoadingContent,
  } = useQuery({
    queryKey: ["v1-contents", storeId, result.id],
    queryFn: async () => {
      const res = await fetch("/v1/contents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Org-ID": storeId,
        },
        body: JSON.stringify({ ids: [result.id] }),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch content");
      }
      const data = (await res.json()) as ContentsResponse;
      const item = data.data.items[0];
      if (!item) {
        return { content: null, metadata: null };
      }
      return {
        content: item.content ?? null,
        metadata: item.metadata ?? null,
      };
    },
    enabled: isExpanded,
  });
  const contentError =
    contentQueryError instanceof Error ? contentQueryError.message : null;

  const [showSimilar, setShowSimilar] = useState(false);

  const {
    data: similarData,
    isFetching: isLoadingSimilar,
    error: similarQueryError,
    refetch: refetchSimilar,
  } = useQuery<FindSimilarResponse>({
    queryKey: ["findSimilar", storeId, result.id],
    queryFn: async () => {
      const res = await fetch("/v1/findsimilar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Org-ID": storeId,
        },
        body: JSON.stringify({ id: result.id, limit: 5, threshold: 0.5 }),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch similar items");
      }
      return (await res.json()) as FindSimilarResponse;
    },
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const similarError =
    similarQueryError instanceof Error ? similarQueryError.message : null;

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(result.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const fetchSimilar = () => {
    setShowSimilar(true);
    if (!similarData) {
      void refetchSimilar();
    }
  };

  return (
    <Collapsible onOpenChange={onToggleExpand} open={isExpanded}>
      <Card className="rounded-md border-border/50 bg-card/40 py-4 backdrop-blur-md transition-colors hover:border-border">
        <CardContent className="px-4">
          <div className="flex items-start gap-4">
            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
              {/* Title row with expand trigger */}
              <div className="flex items-start justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 text-left transition-colors hover:text-primary">
                    <h3 className="font-medium text-xs leading-tight">
                      {result.title || "Untitled Document"}
                    </h3>
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    className="text-xs"
                    variant={
                      scorePercent >= 80
                        ? "default"
                        : scorePercent >= 60
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {scorePercent}%
                  </Badge>
                  {result.source && (
                    <Badge className="text-xs" variant="outline">
                      {result.source}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Snippet (collapsed view) */}
              {!isExpanded && result.snippet && (
                <p className="line-clamp-2 text-muted-foreground text-xs">
                  {result.snippet}
                </p>
              )}

              {/* Type and date */}
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {result.type && <span>{result.type}</span>}
                {result.occurredAt && (
                  <span>
                    {new Date(result.occurredAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Expanded content */}
              <CollapsibleContent className="space-y-4 pt-2">
                {/* ID and URL */}
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    className="h-6 gap-1 px-2"
                    onClick={handleCopyId}
                    size="sm"
                    variant="ghost"
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
                      className="flex items-center gap-1 text-primary hover:underline"
                      href={result.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View source
                    </a>
                  )}
                </div>

                {/* Entities */}
                {result.entities && result.entities.length > 0 && (
                  <div className="space-y-1">
                    <span className="font-medium text-muted-foreground text-xs">
                      Entities
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {result.entities.map((entity, idx) => (
                        <Badge
                          className="text-xs"
                          key={`${entity.key}-${entity.category}-${idx}`}
                          variant="outline"
                        >
                          {entity.key}
                          <span className="ml-1 text-muted-foreground">
                            ({entity.category})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Content */}
                <div className="space-y-1">
                  <span className="font-medium text-muted-foreground text-xs">
                    Content
                  </span>
                  {isLoadingContent ? (
                    <Skeleton className="h-24 w-full" />
                  ) : contentError ? (
                    <p className="text-destructive text-xs">{contentError}</p>
                  ) : contentData?.content ? (
                    <pre className="max-h-64 overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 text-xs">
                      {contentData.content}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      No content available
                    </p>
                  )}
                </div>

                {/* Metadata */}
                {contentData?.metadata &&
                  Object.keys(contentData.metadata).length > 0 && (
                    <div className="space-y-1">
                      <span className="font-medium text-muted-foreground text-xs">
                        Metadata
                      </span>
                      <pre className="max-h-32 overflow-x-auto overflow-y-auto rounded-lg border bg-muted/50 p-3 text-xs">
                        {JSON.stringify(contentData.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                {/* Find Similar Button and Results */}
                <div className="space-y-2 border-t pt-2">
                  <Button
                    className="gap-1"
                    disabled={isLoadingSimilar}
                    onClick={fetchSimilar}
                    size="sm"
                    variant="outline"
                  >
                    {isLoadingSimilar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Find Similar
                    {similarData && ` (${similarData.data.similar.length})`}
                  </Button>

                  {showSimilar && (
                    <div className="space-y-2">
                      {similarError ? (
                        <p className="text-destructive text-xs">
                          {similarError}
                        </p>
                      ) : isLoadingSimilar ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ) : similarData && similarData.data.similar.length > 0 ? (
                        <>
                          {/* Similar items list */}
                          <div className="space-y-1">
                            {similarData.data.similar.map((item) => (
                              <div
                                className="flex items-start gap-2 rounded border bg-muted/30 p-2 transition-colors hover:bg-muted/50"
                                key={item.id}
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium text-xs">
                                      {item.title}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <Badge
                                        className="text-[10px]"
                                        variant="outline"
                                      >
                                        {Math.round(item.score * 100)}%
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{item.source}</span>
                                    <span>•</span>
                                    <span>{item.type}</span>
                                    {item.entityOverlap !== undefined &&
                                      item.entityOverlap > 0 && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            {Math.round(
                                              item.entityOverlap * 100
                                            )}
                                            % entity overlap
                                          </span>
                                        </>
                                      )}
                                  </div>
                                </div>
                                {item.url && (
                                  <a
                                    className="shrink-0"
                                    href={item.url}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs italic">
                          No similar items found
                        </p>
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
