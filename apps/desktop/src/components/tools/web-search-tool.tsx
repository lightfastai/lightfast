import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { useToolExecution } from "../../hooks/use-tool-execution";
import { ToolProps } from "./types";

export function WebSearchTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  const [error, setError] = useState<string | null>(null);

  // Use the shared tool execution hook
  const { executeTool, getToolState, declineTool } = useToolExecution();

  // Get current execution state for this tool
  const { pending, executed } = getToolState(toolInvocation.toolCallId);

  const query = toolInvocation.args?.query || "";

  const handleExecute = async () => {
    if (executed) return;

    // Execute through our shared hook
    try {
      const result = await executeTool(
        toolInvocation.toolCallId,
        "webSearch",
        toolInvocation.args || {},
      );

      if (!result.success && result.error) {
        setError(result.error);
      }

      // Report results back to AI
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result,
      });
    } catch (e: any) {
      // Error handling is done inside the hook, this is just a fallback
      setError(e?.message || "Failed to execute web search");
    }
  };

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
                {autoExecute && !readyToExecute && !executed && query && (
                  <span className="text-xs text-blue-500">
                    Waiting for tool to be ready...
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
                        declineTool(toolInvocation.toolCallId);
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
