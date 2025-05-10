import { useEffect, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

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
  const { toolInvocation } = part;
  if (toolInvocation.state === "call") {
    return <ToolInvocationRequest part={part} addToolResult={addToolResult} />;
  }
  return <ToolInvocationResult part={part} />;
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

  // Get Blender store state for code execution and state
  const lastCodeExecution = useBlenderStore((state) => state.lastCodeExecution);
  const blenderSceneInfo = useBlenderStore((state) => state.blenderSceneInfo);
  const initializeMessageListener = useBlenderStore(
    (state) => state.initializeMessageListener,
  );

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

  const handleExecuteBlenderCode = async () => {
    setPending(true);
    setError(null);

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

      // Check if this is a Blender code execution tool
      if (toolInvocation.toolName === "executeBlenderCode" && code) {
        try {
          // Initialize message listener (this is still useful for other notifications)
          initializeMessageListener();

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
      } else if (toolInvocation.toolName === "reconnectBlender") {
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
      } else if (toolInvocation.toolName === "getBlenderSceneInfo") {
        try {
          // Initialize message listener (this is still useful for other notifications)
          initializeMessageListener();

          // Get scene info from Blender - now waits for direct response
          console.log(
            `📤 ToolSection: Sending getBlenderSceneInfo request to main process`,
          );

          const result = await window.blenderConnection.getSceneInfo();

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
          console.log(
            `🔄 ToolSection: Processing getBlenderSceneInfo response`,
          );
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
      } else {
        // For other tools, use the default "manual" execution
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
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent accordion from toggling
                    handleExecuteBlenderCode();
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
            </div>
          </AccordionTrigger>

          {/* Collapsible Content: Code and related error */}
          {(code || error) && ( // Only render content if there's code or an error to show
            <AccordionContent className="border-t pb-0">
              {code && (
                <div>
                  <ScrollArea className="h-48 w-full">
                    <CodeBlock inline={false}>{code}</CodeBlock>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  {error && (
                    <div
                      className={cn(
                        "mt-1 text-[0.65rem] leading-tight text-red-600",
                      )}
                    >
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Error when no code is present (e.g., tool call setup error), but still an error to display */}
              {!code && error && (
                <div
                  className={cn(
                    "mt-1 text-[0.65rem] leading-tight text-red-600",
                  )}
                >
                  {error}
                </div>
              )}
            </AccordionContent>
          )}
        </div>
      </AccordionItem>
    </Accordion>
  );
}

function ToolInvocationResult({ part }: { part: ToolInvocation }) {
  const { toolInvocation } = part;
  const code = toolInvocation.args?.code || "";
  const result = toolInvocation.result;
  const error = toolInvocation.error;

  // Tool-specific renderers
  function renderResult() {
    switch (toolInvocation.toolName) {
      case "webSearch":
        if (result?.results && Array.isArray(result.results)) {
          return <WebSearchResults results={result.results} />;
        }
        break;
      case "searchPolyHaven":
        if (result?.results && Array.isArray(result.results)) {
          return <PolyHavenResults results={result.results} />;
        }
        break;
      case "downloadPolyHavenAsset":
        return <PolyHavenAssetResult asset={result} />;
      case "searchAmbientCG":
        if (result?.results && Array.isArray(result.results)) {
          return <AmbientCGResults results={result.results} />;
        }
        break;
      case "downloadAmbientCGTexture":
        return <AmbientCGAssetResult asset={result} />;
      case "getBlenderSceneInfo":
        if (result?.scene_info) {
          return <BlenderSceneInfoView state={result.scene_info} />;
        }
        break;
      default:
        // Fallback: pretty-print JSON
        if (result) {
          return (
            <ScrollArea className="max-h-72 w-full">
              <pre
                className={cn(
                  "bg-background mb-2 rounded border p-2 text-xs whitespace-pre-wrap",
                )}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          );
        }
    }
    return null;
  }

  return (
    <div
      className={cn(
        "bg-muted/20 border-border my-2 flex flex-col gap-2 rounded border p-4",
      )}
    >
      <div className="mb-1 text-xs font-semibold">
        Tool Result: {toolInvocation.toolName}
      </div>
      {code && (
        <ScrollArea className="max-h-48 w-full">
          <CodeBlock inline={false}>{code}</CodeBlock>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      {error && <div className={cn("mb-2 text-xs text-red-600")}>{error}</div>}
      {renderResult()}
    </div>
  );
}

// Tool-specific result renderers
function WebSearchResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className={cn("rounded border p-2")}>
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            className="font-semibold underline"
          >
            {r.title}
          </a>
          {r.content && (
            <div className={cn("text-muted-foreground text-xs")}>
              {r.content}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PolyHavenResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className={cn("rounded border p-2")}>
          <div className="font-semibold">{r.name || r.id}</div>
          {r.preview && (
            <img
              src={r.preview}
              alt={r.name}
              className={cn("my-2 max-h-24 rounded")}
            />
          )}
          {r.description && (
            <div className={cn("text-muted-foreground text-xs")}>
              {r.description}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PolyHavenAssetResult({ asset }: { asset: any }) {
  if (!asset) return null;
  return (
    <div>
      <div className="font-semibold">{asset.name}</div>
      {asset.preview && (
        <img
          src={asset.preview}
          alt={asset.name}
          className={cn("my-2 max-h-32 rounded")}
        />
      )}
      {asset.description && (
        <div className={cn("text-muted-foreground mb-2 text-xs")}>
          {asset.description}
        </div>
      )}
      {asset.downloads && (
        <div className="text-xs">
          <span className="font-semibold">Downloads:</span>
          <ul className="ml-4 list-disc">
            {Object.entries(asset.downloads).map(([k, v]: [string, any]) => (
              <li key={k}>
                <a
                  href={v.url}
                  className="underline"
                  target="_blank"
                  rel="noopener"
                >
                  {k}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AmbientCGResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className={cn("rounded border p-2")}>
          <div className="font-semibold">{r.name || r.id}</div>
          {r.preview && (
            <img
              src={r.preview}
              alt={r.name}
              className={cn("my-2 max-h-24 rounded")}
            />
          )}
          {r.description && (
            <div className={cn("text-muted-foreground text-xs")}>
              {r.description}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AmbientCGAssetResult({ asset }: { asset: any }) {
  if (!asset) return null;
  return (
    <div>
      <div className="font-semibold">{asset.name}</div>
      {asset.preview && (
        <img
          src={asset.preview}
          alt={asset.name}
          className={cn("my-2 max-h-32 rounded")}
        />
      )}
      {asset.description && (
        <div className={cn("text-muted-foreground mb-2 text-xs")}>
          {asset.description}
        </div>
      )}
      {asset.downloads && (
        <div className="text-xs">
          <span className="font-semibold">Downloads:</span>
          <ul className="ml-4 list-disc">
            {Object.entries(asset.downloads).map(([k, v]: [string, any]) => (
              <li key={k}>
                <a
                  href={v.url}
                  className="underline"
                  target="_blank"
                  rel="noopener"
                >
                  {k}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BlenderSceneInfoView({ state }: { state: any }) {
  return (
    <div className="space-y-2">
      <div className={cn("rounded border p-2")}>
        <div className="font-semibold">Scene Information</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>Name:</div>
          <div>{state.name || "Unknown"}</div>
          <div>Object Count:</div>
          <div>{state.object_count || 0}</div>
          <div>Materials Count:</div>
          <div>{state.materials_count || 0}</div>
        </div>
      </div>

      {state.objects && state.objects.length > 0 && (
        <div className={cn("rounded border p-2")}>
          <div className="font-semibold">Objects ({state.objects.length})</div>
          <ul className="ml-4 list-disc text-xs">
            {state.objects.map((obj: any, i: number) => (
              <li key={i}>
                {obj.name} ({obj.type}) - Location: [{obj.location.join(", ")}]
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Show full scene info data for debugging */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs">
          Raw Scene Info Data
        </summary>
        <ScrollArea className="max-h-72 w-full">
          <pre
            className={cn(
              "bg-background mt-2 mb-2 rounded border p-2 text-xs whitespace-pre-wrap",
            )}
          >
            {JSON.stringify(state, null, 2)}
          </pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </details>
    </div>
  );
}
