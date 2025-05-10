import { useEffect, useState } from "react";
import { CheckIcon, Code2Icon, Loader2Icon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { CodeBlock } from "../code-block";
import { ToolProps } from "./types";

export function BlenderCodeTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);

  const code = toolInvocation.args?.code || "";

  const handleExecute = async () => {
    if (executed) return;

    setPending(true);
    setError(null);
    console.log(`🧰 Executing Blender code`);

    try {
      // First check if Blender is actually connected
      const connectionStatus = await window.blenderConnection.getStatus();
      if (connectionStatus.status !== "connected") {
        setPending(false);
        const errorMsg =
          "Blender is not connected. Current status: " +
          connectionStatus.status;
        setError(errorMsg);
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: errorMsg,
          },
        });
        return;
      }

      if (code) {
        try {
          // Execute the code using the Electron API
          console.log(
            `📤 BlenderCodeTool: Sending executeBlenderCode request to main process`,
          );
          const result = await window.blenderConnection.executeCode(code);

          console.log(
            `📥 BlenderCodeTool: Received response from main process`,
          );
          console.log(
            `   Type: ${result.type}, ID: ${result.id}, Success: ${result.success}`,
          );
          if (result.success && result.output) {
            console.log(
              `   Output: ${result.output.substring(0, 50)}${
                result.output.length > 50 ? "..." : ""
              }`,
            );
          } else if (!result.success && result.error) {
            console.log(`   Error: ${result.error}`);
          }

          setPending(false);
          setExecuted(true);

          if (result.success) {
            addToolResult({
              toolCallId: toolInvocation.toolCallId,
              result: {
                success: true,
                output: result.output || "Code executed successfully",
                message: "Blender code executed successfully",
              },
            });
          } else {
            const errorMsg =
              result.error || "Failed to execute code in Blender";
            const isPartialExecutionError =
              errorMsg.includes("not in collection") ||
              errorMsg.includes("does not exist") ||
              errorMsg.includes("cannot find");
            const hasPartialOutput = result.output && result.output.length > 0;

            if (isPartialExecutionError && hasPartialOutput) {
              setError(`Partial Success: ${errorMsg}`);
              addToolResult({
                toolCallId: toolInvocation.toolCallId,
                result: {
                  success: true, // Mark as success so the agent continues
                  partial_error: true,
                  error: errorMsg,
                  output: result.output || "",
                  message:
                    "Code executed with partial success. Some operations completed, but errors occurred.",
                },
              });
            } else {
              setError(errorMsg);
              addToolResult({
                toolCallId: toolInvocation.toolCallId,
                result: {
                  success: false,
                  error: errorMsg,
                },
              });
            }
          }
        } catch (e: any) {
          setPending(false);
          setError(e?.message || "Failed to execute tool");
          addToolResult({
            toolCallId: toolInvocation.toolCallId,
            result: {
              success: false,
              error: e?.message || "Failed to execute tool",
            },
          });
        }
      } else {
        setPending(false);
        setError("No code provided");
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: "No code provided",
          },
        });
      }
    } catch (e: any) {
      setPending(false);
      setError(e?.message || "Failed to execute tool");
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: false,
          error: e?.message || "Failed to execute tool",
        },
      });
    }
  };

  // Only auto-execute when both conditions are met:
  // 1. In agent mode (autoExecute is true)
  // 2. The tool call is fully streamed and ready (readyToExecute is true)
  useEffect(() => {
    if (autoExecute && readyToExecute && !executed && code) {
      console.log(
        `🤖 Auto-executing Blender code tool with complete code (${code.length} chars)`,
      );
      handleExecute();
    }
  }, [autoExecute, readyToExecute, executed, code]);

  // Determine if we're in the "generating code" state
  const isGeneratingCode = code && !readyToExecute && !executed;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div
          className={cn(
            "bg-muted/20 border-border flex flex-col gap-1 rounded border",
            isGeneratingCode && "border-blue-400/30",
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
                {code && (
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      isGeneratingCode
                        ? "text-blue-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {isGeneratingCode ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <Code2Icon className="size-3" />
                    )}
                    <span className="text-xs">
                      {isGeneratingCode
                        ? `Generating code... (${code.length} chars so far)`
                        : code.length > 50
                          ? `${code.length} chars`
                          : "View code"}
                    </span>
                  </span>
                )}
                {pending && (
                  <span className="animate-pulse text-xs text-amber-500">
                    Executing...
                  </span>
                )}
                {autoExecute && !readyToExecute && !executed && code && (
                  <span className="text-xs text-blue-500">
                    Waiting for complete code...
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {!autoExecute && !executed && (
                  <>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={pending || isGeneratingCode}
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
            {code ? (
              <div className="p-2">
                <div
                  className={cn(
                    "relative",
                    isGeneratingCode && "rounded bg-blue-400/5",
                  )}
                >
                  {isGeneratingCode && (
                    <div className="absolute top-0 right-0 m-2 flex items-center gap-1 rounded bg-blue-500/10 px-2 py-1 text-[0.65rem] font-medium text-blue-500">
                      <Loader2Icon className="size-3 animate-spin" />
                      <span>Generating code...</span>
                    </div>
                  )}
                  <ScrollArea className="h-48 w-full">
                    <CodeBlock inline={false}>{code}</CodeBlock>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>

                {toolInvocation.result &&
                  toolInvocation.result.partial_error && (
                    <div className="mt-2 rounded-md border p-2">
                      <div className="mb-1 text-[0.7rem] font-medium text-amber-600 dark:text-amber-500">
                        Partial Success: Some code executed successfully before
                        errors
                      </div>

                      {toolInvocation.result.output && (
                        <div className="text-muted-foreground bg-muted/30 mb-2 rounded p-1 text-[0.65rem] whitespace-pre-wrap">
                          {toolInvocation.result.output}
                        </div>
                      )}

                      {toolInvocation.result.error && (
                        <div className="mt-1 text-[0.65rem] text-red-600">
                          <span className="font-medium">Error:</span>{" "}
                          {toolInvocation.result.error}
                        </div>
                      )}
                    </div>
                  )}

                {error && !toolInvocation.result?.partial_error && (
                  <div
                    className={cn(
                      "mt-1 text-[0.65rem] leading-tight text-red-600",
                    )}
                  >
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground p-4 text-center">
                {error ? (
                  <div className="text-[0.65rem] leading-tight text-red-600">
                    {error}
                  </div>
                ) : (
                  <div className="text-[0.65rem]">
                    No code provided for execution
                  </div>
                )}
              </div>
            )}
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
