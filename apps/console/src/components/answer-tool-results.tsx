"use client";

import type {
  V1ContentsResponse,
  V1FindSimilarResponse,
  V1SearchResponse,
} from "@repo/console-types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { ExternalLink } from "lucide-react";

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
      <p className="py-2 text-muted-foreground text-sm">No results found.</p>
    );
  }

  return (
    <div className="w-full rounded-lg border">
      <Accordion className="w-full" collapsible type="single">
        <AccordionItem value="workspace-search-results">
          <AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 text-left">
                <div className="font-medium text-muted-foreground text-xs lowercase">
                  workspace search
                </div>
              </div>
              <span className="text-muted-foreground/70 text-xs">
                {resultCount} result{resultCount !== 1 ? "s" : ""}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="pt-3">
              {results.slice(0, 10).map((result) => (
                <div key={result.url}>
                  <a
                    className="group flex items-center gap-3 rounded-sm px-3 py-2 hover:bg-muted/50"
                    href={result.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <h4 className="flex-1 overflow-hidden truncate text-ellipsis whitespace-nowrap font-medium text-foreground text-xs">
                      {result.title || "Untitled"}
                    </h4>
                    <span className="shrink-0 text-muted-foreground/70 text-xs">
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
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground text-sm italic">
        No content found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card className="border-border/50 p-2" key={item.id}>
          <CardContent className="space-y-2 overflow-hidden rounded-xs px-2 py-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="hidden font-medium text-sm">{item.id}</h4>
              {item.metadata &&
                typeof item.metadata === "object" &&
                "url" in item.metadata &&
                typeof item.metadata.url === "string" && (
                  <a
                    className="rounded p-1 hover:bg-muted"
                    href={item.metadata.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
            </div>
            {item.content && (
              <pre className="scrollbar-thin max-h-[400px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-sm bg-muted/30 p-2 text-xs">
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
  if (similar.length === 0) {
    return (
      <div className="text-muted-foreground text-sm italic">
        No similar items found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs">
        {similar.length} similar item{similar.length !== 1 ? "s" : ""}
      </div>
      <div className="space-y-1">
        {similar.map((item) => (
          <Card className="border-border/50 p-2" key={item.id}>
            <CardContent className="flex items-start justify-between gap-2 px-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-xs">{item.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.source} • {item.type}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge className="text-[10px]" variant="outline">
                  {Math.round(item.score * 100)}%
                </Badge>
                {item.url && (
                  <a
                    className="p-1"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
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
