"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import type {
  V1SearchResponse,
  V1ContentsResponse,
  V1FindSimilarResponse,
} from "@repo/console-types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";

const toHostname = (url: string): string => {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
};

/**
 * Render search tool results in an accordion with links
 */
export function SearchToolResult({ data }: { data: V1SearchResponse }) {
  const results = data.data;
  const resultCount = results.length;

  if (resultCount === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No results found.
      </p>
    );
  }

  return (
    <div className="border rounded-lg w-full">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="workspace-search-results">
          <AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 text-left">
                <div className="text-xs font-medium lowercase text-muted-foreground">
                  workspace search
                </div>
              </div>
              <span className="text-xs text-muted-foreground/70">
                {resultCount} result{resultCount !== 1 ? "s" : ""}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="pt-3">
              {results.slice(0, 10).map((result, index) => (
                <div key={`search-result-${index}`}>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-sm px-3 py-2 hover:bg-muted/50"
                  >
                    <h4 className="flex-1 truncate text-xs font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {result.title || "Untitled"}
                    </h4>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                      {toHostname(result.url)}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  </a>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
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

