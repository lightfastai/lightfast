"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
  ExternalLink,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import type {
  V1SearchResult,
  V1ContentsResponse,
  V1FindSimilarResponse,
} from "@repo/console-types";

// Search result card component with expandable content
export function SearchResultCard({
  result,
  rank: _rank,
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
  const [similarData, setSimilarData] = useState<V1FindSimilarResponse | null>(
    null,
  );
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
            // Set contentData to empty object to prevent re-fetch loop
            setContentData({ content: null, metadata: null });
            setContentError("Content not found");
          }
        })
        .catch((err) => {
          // Set contentData to empty object to prevent re-fetch loop
          setContentData({ content: null, metadata: null });
          setContentError(
            err instanceof Error ? err.message : "Failed to load",
          );
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
      <Card className="border-border/50 rounded-sm py-4 hover:border-border transition-colors">
        <CardContent className="px-4">
          <div className="flex items-start gap-4">
            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title row with expand trigger */}
              <div className="flex items-start justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 hover:text-primary transition-colors text-left">
                    <h3 className="font-medium text-xs leading-tight">
                      {result.title || "Untitled Document"}
                    </h3>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={
                      scorePercent >= 80
                        ? "default"
                        : scorePercent >= 60
                          ? "secondary"
                          : "outline"
                    }
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
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {result.snippet}
                </p>
              )}

              {/* Type and date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground">
                      Entities
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {result.entities.map((entity, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
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
                  <span className="text-xs font-medium text-muted-foreground">
                    Content
                  </span>
                  {isLoadingContent ? (
                    <Skeleton className="h-24 w-full" />
                  ) : contentError ? (
                    <p className="text-xs text-destructive">{contentError}</p>
                  ) : contentData?.content ? (
                    <pre className="text-xs bg-muted/50 border rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {contentData.content}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No content available
                    </p>
                  )}
                </div>

                {/* Metadata */}
                {contentData?.metadata &&
                  Object.keys(contentData.metadata).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Metadata
                      </span>
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
                        <p className="text-xs text-destructive">
                          {similarError}
                        </p>
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
                                {similarData.source.cluster.topic ??
                                  "Uncategorized"}
                              </Badge>
                              <span>
                                ({similarData.source.cluster.memberCount} items)
                              </span>
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
                                    <span className="text-xs font-medium truncate">
                                      {item.title}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                      >
                                        {Math.round(item.score * 100)}%
                                      </Badge>
                                      {item.sameCluster && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px]"
                                        >
                                          Same Cluster
                                        </Badge>
                                      )}
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
                                              item.entityOverlap * 100,
                                            )}
                                            % entity overlap
                                          </span>
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
                        <p className="text-xs text-muted-foreground italic">
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
