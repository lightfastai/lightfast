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

export function DefaultTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  // Use the shared tool execution hook
  const { executeTool, getToolState, declineTool } = useToolExecution();

  // Get current execution state for this tool
  const { pending, executed } = getToolState(toolInvocation.toolCallId);

  const handleExecute = async () => {
    if (executed) return;

    try {
      // Use a generic handler for tools not specifically implemented
      const result = await executeTool(
        toolInvocation.toolCallId,
        "default" as any, // Cast needed since 'default' isn't in our ToolType enum
        toolInvocation.args || {},
      );

      // Add the result to the AI
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          type: "manual-tool-invocation",
          result: {
            success: true,
            message: "Accepted and executed.",
          },
        },
      });
    } catch (e) {
      // Error handling is already done in the hook
      console.error("Error executing default tool:", e);
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
                {pending && (
                  <span className="animate-pulse text-xs text-amber-500">
                    Executing...
                  </span>
                )}
                {autoExecute && !readyToExecute && !executed && (
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
            <div className="p-4 text-center">
              <div className="text-muted-foreground text-[0.65rem]">
                {executed ? (
                  <span className="text-green-500">
                    Tool executed successfully
                  </span>
                ) : pending ? (
                  "Processing tool request..."
                ) : (
                  `Request to execute tool: ${toolInvocation.toolName}`
                )}
              </div>

              {toolInvocation.args &&
                Object.keys(toolInvocation.args).length > 0 && (
                  <div className="mt-2 text-left">
                    <div className="text-[0.65rem] font-medium">Arguments:</div>
                    <pre className="bg-muted/30 mt-1 max-h-32 overflow-auto rounded p-2 text-[0.65rem]">
                      {JSON.stringify(toolInvocation.args, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
