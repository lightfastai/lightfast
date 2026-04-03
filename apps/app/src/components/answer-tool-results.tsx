"use client";

import type { SearchResponse } from "@repo/app-validation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
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
export function SearchToolResult({ data }: { data: SearchResponse }) {
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
        <AccordionItem value="org-search-results">
          <AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 text-left">
                <div className="font-medium text-muted-foreground text-xs lowercase">
                  search
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
                <div key={result.id}>
                  {result.url ? (
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
                  ) : (
                    <div className="flex items-center gap-3 rounded-sm px-3 py-2">
                      <h4 className="flex-1 overflow-hidden truncate text-ellipsis whitespace-nowrap font-medium text-foreground text-xs">
                        {result.title || "Untitled"}
                      </h4>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
