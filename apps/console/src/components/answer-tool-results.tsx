"use client";

import React from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { ExternalLink } from "lucide-react";
import type {
  V1SearchResponse,
  V1SearchResult,
  V1ContentsResponse,
  V1FindSimilarResponse,
} from "@repo/console-types";

/**
 * Render search tool results as compact cards
 */
export function SearchToolResult({ data }: { data: V1SearchResponse }) {
  const results = data.data;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
  if (!results || results.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No results found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {results.length} result{results.length !== 1 ? "s" : ""} found
      </div>
      <div className="space-y-1">
        {results.slice(0, 5).map((result, idx) => (
          <SearchResultItem key={result.id} result={result} rank={idx + 1} />
        ))}
      </div>
    </div>
  );
}

function SearchResultItem({
  result,
  rank,
}: {
  result: V1SearchResult;
  rank: number;
}) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                {rank}
              </div>
              <h4 className="font-medium text-sm leading-tight truncate">
                {result.title || "Untitled"}
              </h4>
            </div>
            {result.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {result.snippet}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {result.source && <span>{result.source}</span>}
              {result.type && (
                <>
                  <span>•</span>
                  <span>{result.type}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-xs">
              {scorePercent}%
            </Badge>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-muted rounded"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Render contents tool results
 */
export function ContentsToolResult({ data }: { data: V1ContentsResponse }) {
  const items = data.items;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No content found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className="border-border/50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm">{item.id}</h4>
              {item.metadata &&
                typeof item.metadata === "object" &&
                "url" in item.metadata &&
                typeof item.metadata.url === "string" && (
                  <a
                    href={item.metadata.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
            </div>
            {item.content && (
              <pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                {String(item.content)}
              </pre>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Render find similar results
 */
export function FindSimilarToolResult({
  data,
}: {
  data: V1FindSimilarResponse;
}) {
  const similar = data.similar;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
  if (!similar || similar.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No similar items found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {similar.length} similar item{similar.length !== 1 ? "s" : ""}
      </div>
      <div className="space-y-1">
        {similar.map((item) => (
          <Card key={item.id} className="border-border/50">
            <CardContent className="p-2 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{item.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.source} • {item.type}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(item.score * 100)}%
                </Badge>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Render graph/relationship results (simple list view)
 */
export function GraphToolResult({ data }: { data: unknown }): React.ReactNode {
  // For now, render as JSON since graph structure varies
  const jsonStr =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
      <pre className="whitespace-pre-wrap break-words text-[10px]">
        {jsonStr}
      </pre>
    </div>
  );
}

/**
 * Render related tool results
 */
export function RelatedToolResult({ data }: { data: unknown }): React.ReactNode {
  // For now, render as JSON since structure varies
  const jsonStr =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
      <pre className="whitespace-pre-wrap break-words text-[10px]">
        {jsonStr}
      </pre>
    </div>
  );
}
