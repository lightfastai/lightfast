import { useEffect, useState } from "react";
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

  // Auto-execute tool if in agent mode
  useEffect(() => {
    if (
      autoExecute &&
      toolInvocation.state === "call" &&
      !pending &&
      !toolInvocation.result
    ) {
      console.log(
        `⚡ Auto-executing tool in agent mode: ${toolInvocation.toolName}`,
      );
      handleToolExecution();
    }
  }, [autoExecute, toolInvocation, pending]);

  // Effect to handle Blender code execution results
  useEffect(() => {
    if (!pending || !lastCodeExecution) return;

    // Check if this is a response to our current tool execution
    if (toolInvocation.toolName === "executeBlenderCode") {
      setPending(false);

      if (lastCodeExecution.success) {
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: true,
            output: lastCodeExecution.output || "Code executed successfully",
            message: "Blender code executed successfully",
          },
        });
      } else {
        setError(
          lastCodeExecution.error || "Failed to execute code in Blender",
        );
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error:
              lastCodeExecution.error || "Failed to execute code in Blender",
          },
        });
      }
    }
  }, [
    lastCodeExecution,
    pending,
    toolInvocation.toolName,
    toolInvocation.toolCallId,
    addToolResult,
  ]);

  // Effect to handle Blender scene info results
  useEffect(() => {
    if (!pending || !blenderSceneInfo) return;

    // Check if this is a response to our current tool execution
    if (toolInvocation.toolName === "getBlenderSceneInfo") {
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

  // Function to handle tool execution
  const handleToolExecution = async () => {
    console.log(
      `📱 UI: Handling tool execution for: ${toolInvocation.toolName}`,
    );

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
  };

  // Handler for executing Blender code
  const handleExecuteBlenderCode = async () => {
    setPending(true);
    setError(null);
    console.log(`🧰 Executing Blender code`);

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
            `📤 ToolSection: Sending executeBlenderCode request to main process`,
          );
          const result = await window.blenderConnection.executeCode(code);

          console.log(
            `📥 ToolSection: Received direct response from main process for executeBlenderCode`,
          );
          console.log(
            `   Type: ${result.type}, ID: ${result.id}, Success: ${result.success}`,
          );
          if (result.success && result.output) {
            console.log(
              `   Output: ${result.output.substring(0, 50)}${result.output.length > 50 ? "..." : ""}`,
            );
          } else if (!result.success && result.error) {
            console.log(`   Error: ${result.error}`);
          }

          // Handle the direct response
          console.log(`🔄 ToolSection: Processing executeBlenderCode response`);
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
            const errorMsg =
              result.error || "Failed to execute code in Blender";

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

  // Handler for getting Blender scene info
  const handleGetBlenderSceneInfo = async () => {
    setPending(true);
    setError(null);
    console.log(`🧰 Getting Blender scene info`);

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
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: false,
            error: errorMsg,
          },
        });
        return;
      }

      console.log(`🔍 ToolSection: Starting getBlenderSceneInfo execution`);

      // Get scene info from Blender - now waits for direct response
      console.log(
        `📤 ToolSection: Sending getBlenderSceneInfo request to main process`,
      );

      const result = await window.blenderConnection.getSceneInfo();

      console.log(
        `✅ ToolSection: getSceneInfo API call completed with result:`,
        result,
      );

      console.log(
        `📥 ToolSection: Received direct response from main process for getBlenderSceneInfo`,
      );
      console.log(
        `   Type: ${result.type}, ID: ${result.id}, Success: ${result.success}`,
      );
      if (result.success && result.scene_info) {
        console.log(`   Scene: ${result.scene_info.name}`);
        console.log(`   Objects: ${result.scene_info.object_count}`);
      } else if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }

      // Handle the direct response
      console.log(`🔄 ToolSection: Processing getBlenderSceneInfo response`);
      setPending(false);

      if (result.success) {
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
  };

  // Handler for reconnecting to Blender
  const handleReconnectBlender = async () => {
    setPending(true);
    setError(null);
    console.log(`🧰 Reconnecting to Blender`);

    try {
      // Handle reconnect Blender tool
      if (!window.blenderConnection) {
        throw new Error("Blender connection API not available");
      }

      const status = await window.blenderConnection.getStatus();

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
  };

  // Handler for other tools
  const handleOtherTool = () => {
    setPending(false);
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
  };

  // Handler for web search tool
  const handleWebSearch = async () => {
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
      console.log(`📤 ToolSection: Forwarding web search to backend API`);

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
        `📥 ToolSection: Received web search results with ${result.results?.length || 0} items`,
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

  // Modify the UI to show different views based on session mode
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
                {autoExecute ? (
                  <span className="text-muted-foreground/70">
                    Auto-executing:
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
              </div>
              {!autoExecute && (
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={pending}
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
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent accordion from toggling
                      addToolResult?.({
                        toolCallId: toolInvocation.toolCallId,
                        result: { error: "User declined tool invocation" },
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
