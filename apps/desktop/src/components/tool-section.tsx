import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/stores/session-store";
import { CheckIcon, Code2Icon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { useBlenderStore } from "../stores/blender-store";
import { CodeBlock } from "./code-block";

interface ToolInvocation {
  type: "tool-invocation";
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    state: string;
    args?: any;
    result?: any;
    error?: string;
  };
}

interface ToolSectionProps {
  part: ToolInvocation;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}

export function ToolSection({ part, addToolResult }: ToolSectionProps) {
  return <ToolInvocationRequest part={part} addToolResult={addToolResult} />;
}

function ToolInvocationRequest({
  part,
  addToolResult,
}: {
  part: ToolInvocation;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}) {
  const { toolInvocation } = part;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = toolInvocation.args?.code || "";
  const executionAttemptedRef = useRef(false);
  const toolCallIdRef = useRef(toolInvocation.toolCallId);

  // Keep track if this specific tool invocation has been processed
  useEffect(() => {
    // Reset our tracking when the tool call ID changes
    if (toolCallIdRef.current !== toolInvocation.toolCallId) {
      console.log(
        `🔄 Tool call ID changed from ${toolCallIdRef.current} to ${toolInvocation.toolCallId}`,
      );
      toolCallIdRef.current = toolInvocation.toolCallId;
      executionAttemptedRef.current = false;
    }
  }, [toolInvocation.toolCallId]);

  // Get the current session mode from the session store
  const sessionMode = useSessionStore((state) => state.sessionMode);
  const autoExecute = sessionMode === "agent";

  // Note: When using Claude 3.7 Sonnet as the reasoning model, tool calls like executeBlenderCode
  // won't be streamed character-by-character. Instead, Claude completes the entire tool call before
  // sending it, which is why the executeBlenderCode accordion appears all at once rather than being
  // built up incrementally. This is different from how OpenAI models handle streaming tool calls.

  // Get Blender store state for code execution and state
  const lastCodeExecution = useBlenderStore((state) => state.lastCodeExecution);
  const blenderSceneInfo = useBlenderStore((state) => state.blenderSceneInfo);
  const initializeMessageListener = useBlenderStore(
    (state) => state.initializeMessageListener,
  );

  // Handle Blender code execution results
  const handleExecuteBlenderCodeResult = useCallback(
    (result: { success: boolean; output?: string; error?: string }) => {
      setPending(false);

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
        const errorMsg = result.error || "Failed to execute code in Blender";
        setError(errorMsg);

        // Check if this might be a partial execution error
        const isPartialExecutionError =
          errorMsg.includes("not in collection") ||
          errorMsg.includes("does not exist") ||
          errorMsg.includes("cannot find");

        // Check if we have partial output despite the error
        const hasPartialOutput = result.output && result.output.length > 0;

        if (isPartialExecutionError && hasPartialOutput) {
          // This is a partial execution - some code ran successfully
          setError(`Partial Success: ${errorMsg}`);

          // Return both the error and the partial output
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
          // Complete failure
          addToolResult({
            toolCallId: toolInvocation.toolCallId,
            result: {
              success: false,
              error: errorMsg,
            },
          });
        }
      }
    },
    [toolInvocation.toolCallId, addToolResult],
  );

  // Handler for executing Blender code
  const handleExecuteBlenderCode = useCallback(async () => {
    setPending(true);
    setError(null);
    console.log(`🧰 Executing Blender code for ${toolInvocation.toolCallId}`);

    // Ensure message listener is initialized
    initializeMessageListener();

    try {
      // First check if Blender is actually connected
      const connectionStatus = await window.blenderConnection.getStatus();
      if (connectionStatus.status !== "connected") {
        setPending(false);
        const errorMsg =
          "Blender is not connected. Current status: " +
          connectionStatus.status;
        setError(errorMsg);

        console.log(
          `❌ Blender not connected. Reporting error for ${toolInvocation.toolCallId}`,
        );
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
          // Execute the code using the Electron API - now waits for response
          console.log(
            `📤 ToolSection: Sending executeBlenderCode request to main process (${toolInvocation.toolCallId})`,
          );
          const result = await window.blenderConnection.executeCode(code);

          console.log(
            `📥 ToolSection: Received direct response from main process for executeBlenderCode (${toolInvocation.toolCallId})`,
            JSON.stringify(result, null, 2),
          );

          // Log the result more explicitly
          if (result.success) {
            console.log(
              `✅ executeBlenderCode succeeded for ${toolInvocation.toolCallId}`,
            );
          } else {
            console.log(
              `⚠️ executeBlenderCode failed for ${toolInvocation.toolCallId}: ${result.error}`,
            );
          }

          // Handle the direct response
          console.log(
            `🔄 ToolSection: Processing executeBlenderCode response for ${toolInvocation.toolCallId}`,
          );

          // Directly add the tool result instead of waiting for the effect to handle it
          handleExecuteBlenderCodeResult(result);
        } catch (e: any) {
          console.error(
            `🔥 Error executing Blender code for ${toolInvocation.toolCallId}:`,
            e,
          );
          setPending(false);
          setError(e?.message || "Failed to execute tool");

          // Add error result to the tool call
          addToolResult({
            toolCallId: toolInvocation.toolCallId,
            result: {
              success: false,
              error: e?.message || "Failed to execute tool",
            },
          });
        }
      } else {
        console.log(`⚠️ No code provided for ${toolInvocation.toolCallId}`);
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
      console.error(
        `🔥 Error in handleExecuteBlenderCode for ${toolInvocation.toolCallId}:`,
        e,
      );
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
  }, [
    toolInvocation.toolCallId,
    addToolResult,
    code,
    initializeMessageListener,
    handleExecuteBlenderCodeResult,
  ]);

  // Handler for getting Blender scene info
  const handleGetBlenderSceneInfo = useCallback(async () => {
    setPending(true);
    setError(null);
    console.log(
      `🧰 Getting Blender scene info for ${toolInvocation.toolCallId}`,
    );

    // Ensure message listener is initialized
    initializeMessageListener();

    try {
      // First check if Blender is actually connected
      const connectionStatus = await window.blenderConnection.getStatus();
      if (connectionStatus.status !== "connected") {
        setPending(false);
        const errorMsg =
          "Blender is not connected. Current status: " +
          connectionStatus.status;
        setError(errorMsg);

        console.log(
          `❌ Blender not connected. Reporting error for ${toolInvocation.toolCallId}`,
        );
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: errorMsg,
          },
        });
        return;
      }

      console.log(
        `🔍 ToolSection: Starting getBlenderSceneInfo execution for ${toolInvocation.toolCallId}`,
      );

      // Get scene info from Blender - now waits for direct response
      console.log(
        `📤 ToolSection: Sending getBlenderSceneInfo request to main process for ${toolInvocation.toolCallId}`,
      );

      const result = await window.blenderConnection.getSceneInfo();

      console.log(
        `✅ ToolSection: getSceneInfo API call completed for ${toolInvocation.toolCallId} with result:`,
        JSON.stringify(result, null, 2),
      );

      // Handle the direct response
      console.log(
        `🔄 ToolSection: Processing getBlenderSceneInfo response for ${toolInvocation.toolCallId}`,
      );
      setPending(false);

      if (result.success) {
        console.log(
          `✅ getBlenderSceneInfo succeeded for ${toolInvocation.toolCallId}`,
        );

        // Directly add the result instead of waiting for the effect to pick it up
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: true,
            message: "Received Blender scene info",
            scene_info: result.scene_info,
          },
        });
      } else {
        const errorMsg =
          result.error || "Failed to get scene info from Blender";
        console.log(
          `⚠️ getBlenderSceneInfo failed for ${toolInvocation.toolCallId}: ${errorMsg}`,
        );
        setError(errorMsg);
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: errorMsg,
          },
        });
      }
    } catch (e: any) {
      console.error(
        `🔥 Error in handleGetBlenderSceneInfo for ${toolInvocation.toolCallId}:`,
        e,
      );
      setPending(false);
      setError(e?.message || "Failed to execute tool");

      // Add error result to the tool call
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: false,
          error: e?.message || "Failed to execute tool",
        },
      });
    }
  }, [toolInvocation.toolCallId, addToolResult, initializeMessageListener]);

  // Handler for reconnecting to Blender
  const handleReconnectBlender = useCallback(async () => {
    setPending(true);
    setError(null);
    console.log(`🧰 Reconnecting to Blender for ${toolInvocation.toolCallId}`);

    try {
      // Handle reconnect Blender tool
      if (!window.blenderConnection) {
        console.error(
          `❌ Blender connection API not available for ${toolInvocation.toolCallId}`,
        );
        throw new Error("Blender connection API not available");
      }

      const status = await window.blenderConnection.getStatus();
      console.log(
        `✅ Got Blender connection status for ${toolInvocation.toolCallId}: ${status.status}`,
      );

      setPending(false);
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: true,
          status,
          message: `Blender connection status: ${status.status}`,
        },
      });
    } catch (e: any) {
      console.error(
        `🔥 Error in handleReconnectBlender for ${toolInvocation.toolCallId}:`,
        e,
      );
      setPending(false);
      setError(e?.message || "Failed to reconnect to Blender");

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: false,
          error: e?.message || "Failed to reconnect to Blender",
        },
      });
    }
  }, [toolInvocation.toolCallId, addToolResult]);

  // Handler for web search tool
  const handleWebSearch = useCallback(async () => {
    setPending(true);
    setError(null);
    console.log(`🔍 Executing web search for ${toolInvocation.toolCallId}`);

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
        console.log(
          `⚠️ No search query provided for ${toolInvocation.toolCallId}`,
        );
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
      console.log(
        `📤 ToolSection: Forwarding web search to backend API for ${toolInvocation.toolCallId} with query: ${query}`,
      );

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
        `📥 ToolSection: Received web search results with ${result.results?.length || 0} items for ${toolInvocation.toolCallId}`,
      );
      setPending(false);

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: true,
          ...result,
        },
      });
    } catch (e: any) {
      console.error(
        `🔥 Error in handleWebSearch for ${toolInvocation.toolCallId}:`,
        e,
      );
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
  }, [toolInvocation.toolCallId, addToolResult, toolInvocation.args]);

  // Handler for other tools
  const handleOtherTool = useCallback(() => {
    console.log(
      `📋 Handling other tool type for ${toolInvocation.toolCallId}: ${toolInvocation.toolName}`,
    );
    setPending(false);

    // Immediately return a result for unknown tool types
    console.log(
      `✅ Automatically accepting unknown tool: ${toolInvocation.toolName} for ${toolInvocation.toolCallId}`,
    );
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
  }, [toolInvocation.toolCallId, toolInvocation.toolName, addToolResult]);

  // Memoized tool execution handler
  const handleToolExecution = useCallback(async () => {
    // Prevent duplicate executions
    if (pending || toolInvocation.result || executionAttemptedRef.current) {
      console.log(`🛑 Skipping execution of ${toolInvocation.toolName} (${toolInvocation.toolCallId}): 
        pending=${pending}, 
        has result=${!!toolInvocation.result}, 
        already attempted=${executionAttemptedRef.current}`);
      return;
    }

    console.log(
      `📱 UI: Handling tool execution for: ${toolInvocation.toolName} (${toolInvocation.toolCallId})`,
    );

    // Mark this tool as having been attempted
    executionAttemptedRef.current = true;

    // Dispatch to the appropriate handler based on tool name
    if (toolInvocation.toolName === "executeBlenderCode") {
      await handleExecuteBlenderCode();
    } else if (toolInvocation.toolName === "getBlenderSceneInfo") {
      await handleGetBlenderSceneInfo();
    } else if (toolInvocation.toolName === "reconnectBlender") {
      await handleReconnectBlender();
    } else if (
      toolInvocation.toolName === "web_search" ||
      toolInvocation.toolName === "search"
    ) {
      await handleWebSearch();
    } else {
      handleOtherTool();
    }
  }, [
    toolInvocation.toolCallId,
    toolInvocation.toolName,
    pending,
    toolInvocation.result,
    handleExecuteBlenderCode,
    handleGetBlenderSceneInfo,
    handleReconnectBlender,
    handleWebSearch,
    handleOtherTool,
  ]);

  // Auto-execute tool if in agent mode
  useEffect(() => {
    if (
      autoExecute &&
      toolInvocation.state === "call" &&
      !pending &&
      !toolInvocation.result &&
      !executionAttemptedRef.current
    ) {
      console.log(
        `⚡ Auto-executing tool in agent mode: ${toolInvocation.toolName} (${toolInvocation.toolCallId})`,
      );
      handleToolExecution();
    }
  }, [
    autoExecute,
    toolInvocation.toolCallId,
    toolInvocation.toolName,
    toolInvocation.state,
    toolInvocation.result,
    pending,
    handleToolExecution,
  ]);

  // Effect to handle Blender code execution results
  useEffect(() => {
    if (!pending || !lastCodeExecution) return;

    // Check if this is a response to our current tool execution
    if (toolInvocation.toolName === "executeBlenderCode") {
      console.log(
        `📥 Received executeBlenderCode result for tool ${toolInvocation.toolCallId}`,
      );
      handleExecuteBlenderCodeResult(lastCodeExecution);
    }
  }, [
    lastCodeExecution,
    pending,
    toolInvocation.toolName,
    toolInvocation.toolCallId,
    handleExecuteBlenderCodeResult,
  ]);

  // Effect to handle Blender scene info results
  useEffect(() => {
    if (!pending || !blenderSceneInfo) return;

    // Check if this is a response to our current tool execution
    if (toolInvocation.toolName === "getBlenderSceneInfo") {
      console.log(
        `📥 Received getBlenderSceneInfo result for tool ${toolInvocation.toolCallId}`,
      );
      setPending(false);

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: true,
          message: "Received Blender scene info",
          scene_info: blenderSceneInfo,
        },
      });
    }
  }, [
    blenderSceneInfo,
    pending,
    toolInvocation.toolName,
    toolInvocation.toolCallId,
    addToolResult,
  ]);

  // Modify the UI to show different views based on session mode
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div
          className={cn(
            "bg-muted/20 border-border flex flex-col gap-1 rounded border",
            toolInvocation.result && "border-green-400/30",
            pending && "border-amber-400/30",
          )}
        >
          <AccordionTrigger className="p-2 hover:no-underline">
            <div className="flex w-full items-center justify-between pr-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[0.65rem] leading-tight font-medium whitespace-nowrap">
                {autoExecute ? (
                  <span
                    className={
                      pending
                        ? "text-amber-500/70"
                        : toolInvocation.result
                          ? "text-green-500/70"
                          : "text-muted-foreground/70"
                    }
                  >
                    {toolInvocation.result
                      ? "Auto-executed:"
                      : pending
                        ? "Executing..."
                        : "Auto-executing:"}
                  </span>
                ) : (
                  "Request:"
                )}
                <pre
                  className={cn(
                    "bg-muted-foreground/10 rounded-md border px-2 py-1 text-[0.65rem]",
                  )}
                >
                  {toolInvocation.toolName.trim()}
                </pre>
                {code && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Code2Icon className="size-3" />
                    <span className="text-xs">
                      {code.length > 50 ? `${code.length} chars` : "View code"}
                    </span>
                  </span>
                )}
                {pending && (
                  <span className="animate-pulse text-xs text-amber-500">
                    Executing...
                  </span>
                )}
                {toolInvocation.result && (
                  <span className="text-xs text-green-500">
                    {toolInvocation.result.success === false
                      ? "Failed"
                      : "Completed"}
                  </span>
                )}
              </div>
              {!autoExecute && !toolInvocation.result && !pending && (
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={pending || executionAttemptedRef.current}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent accordion from toggling
                      console.log(
                        `📱 UI: User clicked execute for tool: ${toolInvocation.toolName}`,
                      );
                      handleToolExecution();
                    }}
                  >
                    <CheckIcon className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending || executionAttemptedRef.current}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent accordion from toggling
                      executionAttemptedRef.current = true;
                      addToolResult?.({
                        toolCallId: toolInvocation.toolCallId,
                        result: {
                          success: false,
                          error: "User declined tool invocation",
                        },
                      });
                    }}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          </AccordionTrigger>

          {/* Collapsible Content: Code and related error */}
          <AccordionContent className="border-t pb-0">
            {code ? (
              <div className="p-2">
                <ScrollArea className="h-48 w-full">
                  <CodeBlock inline={false}>{code}</CodeBlock>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Display partial execution results */}
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

                {/* Regular error display (when not partial) */}
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
                    {toolInvocation.toolName === "executeBlenderCode"
                      ? "No code provided for execution"
                      : "No additional details available"}
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
