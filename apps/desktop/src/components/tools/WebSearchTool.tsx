import { useEffect, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { ToolProps } from "./types";

export function WebSearchTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
}: ToolProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);

  const query = toolInvocation.args?.query || "";

  const handleExecute = async () => {
    if (executed) return;

    setPending(true);
    setError(null);
    console.log(`🔍 Executing web search`);

    try {
      // Extract search parameters from tool invocation
      const {
        query,
        max_results,
        search_depth,
        include_domains,
        exclude_domains,
        use_quotes,
        time_range,
      } = toolInvocation.args || {};

      if (!query) {
        setPending(false);
        setError("No search query provided");
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: "No search query provided",
          },
        });
        return;
      }

      // API endpoint for web search
      console.log(`📤 WebSearchTool: Forwarding web search to backend API`);

      const response = await fetch("/api/web-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          max_results: max_results || 10,
          search_depth: search_depth || "basic",
          include_domains: include_domains || [],
          exclude_domains: exclude_domains || [],
          use_quotes: use_quotes,
          time_range: time_range,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Search API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      console.log(
        `📥 WebSearchTool: Received web search results with ${result.results?.length || 0} items`,
      );
      setPending(false);
      setExecuted(true);

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: true,
          ...result,
        },
      });
    } catch (e: any) {
      setPending(false);
      setError(e?.message || "Failed to execute web search");

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: false,
          error: e?.message || "Failed to execute web search",
        },
      });
    }
  };

  // Auto-execute if in agent mode
  useEffect(() => {
    if (autoExecute && !executed) {
      console.log(`🤖 Auto-executing web search tool`);
      handleExecute();
    }
  }, [autoExecute, executed]);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div
          className={cn(
            "bg-muted/20 border-border flex flex-col gap-1 rounded border",
          )}
        >
          <AccordionTrigger className="p-2 hover:no-underline">
            <div className="flex w-full items-center justify-between pr-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[0.65rem] leading-tight font-medium whitespace-nowrap">
                Request:{" "}
                <pre
                  className={cn(
                    "bg-muted-foreground/10 rounded-md border px-2 py-1 text-[0.65rem]",
                  )}
                >
                  {toolInvocation.toolName.trim()}
                </pre>
                {query && (
                  <span className="text-muted-foreground text-xs">
                    "
                    {query.length > 30 ? `${query.substring(0, 30)}...` : query}
                    "
                  </span>
                )}
                {pending && (
                  <span className="animate-pulse text-xs text-amber-500">
                    Searching...
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {!autoExecute && !executed && (
                  <>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecute();
                      }}
                    >
                      <CheckIcon className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExecuted(true);
                        addToolResult({
                          toolCallId: toolInvocation.toolCallId,
                          result: {
                            error: "User declined tool invocation",
                          },
                        });
                      }}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="border-t pb-0">
            <div className="p-4">
              {error ? (
                <div className="text-[0.65rem] leading-tight text-red-600">
                  {error}
                </div>
              ) : (
                <div className="text-[0.65rem]">
                  {pending ? (
                    <div className="text-muted-foreground text-center">
                      Searching the web for: "{query}"
                    </div>
                  ) : toolInvocation.result?.results ? (
                    <div>
                      <div className="mb-2 font-medium">
                        Found {toolInvocation.result.results.length} results
                        for: "{query}"
                      </div>
                      {toolInvocation.result.results.length > 0 ? (
                        <div className="text-muted-foreground">
                          Search completed successfully.
                        </div>
                      ) : (
                        <div className="text-amber-500">No results found.</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-center">
                      Will search the web for: "{query}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
