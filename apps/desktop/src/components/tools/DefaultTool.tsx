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

export function DefaultTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
}: ToolProps) {
  const [pending, setPending] = useState(false);
  const [executed, setExecuted] = useState(false);

  const handleExecute = () => {
    if (executed) return;

    setPending(true);
    console.log(
      `🧰 Executing default handler for tool: ${toolInvocation.toolName}`,
    );

    // For default tools, we just accept them immediately
    setTimeout(() => {
      setPending(false);
      setExecuted(true);

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
    }, 500); // Small delay for visual feedback
  };

  // Auto-execute if in agent mode
  useEffect(() => {
    if (autoExecute && !executed) {
      console.log(`🤖 Auto-executing default tool handler`);
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
                {pending && (
                  <span className="animate-pulse text-xs text-amber-500">
                    Executing...
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
