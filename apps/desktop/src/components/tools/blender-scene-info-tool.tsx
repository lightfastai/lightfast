import { useEffect, useState } from "react";
import { CheckIcon, Loader2, ServerIcon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { useToolExecution } from "../../hooks/use-tool-execution";
import { DEFAULT_BLENDER_PORT } from "../../main/blender-connection";
import { useToolExecutionStore } from "../../stores/tool-execution-store";
import { ToolProps } from "./types";

export function BlenderSceneInfoTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  const [error, setError] = useState<string | null>(null);
  const [blenderPort, setBlenderPort] = useState<number>(DEFAULT_BLENDER_PORT);

  // Use the shared tool execution hook
  const { executeTool, declineTool } = useToolExecution();

  // Use the Zustand store directly to ensure we get real-time updates
  const { getToolState } = useToolExecutionStore();

  // Get port from the window context
  useEffect(() => {
    if (window.blenderConnection) {
      window.blenderConnection.getPort().then((port: number) => {
        setBlenderPort(port);
      });
    }
  }, []);

  // Get pending and executed state from the Zustand store
  const { pending, executed } = getToolState(toolInvocation.toolCallId);

  const handleExecute = async () => {
    if (executed) return;

    // Execute through our shared hook
    try {
      const result = await executeTool(
        toolInvocation.toolCallId,
        "getBlenderSceneInfo",
        {},
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
      setError(e?.message || "Failed to execute tool");
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div
          className={cn(
            "bg-muted/20 border-border flex flex-col gap-1 rounded border",
            // pending && "border-amber-300/50",
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
                {/* Status indicators would go here */}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {/* Port information */}
                <div className="text-muted-foreground mr-3 flex items-center text-[0.65rem]">
                  <ServerIcon className="mr-1 size-3" />
                  <span title="Change port in Blender via the Lightfast panel in the sidebar">
                    Port: {blenderPort}
                  </span>
                </div>
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
            <div className="text-muted-foreground p-4 text-center">
              {error ? (
                <div className="text-[0.65rem] leading-tight text-red-600">
                  {error}
                </div>
              ) : (
                <div className="text-[0.65rem]">
                  {pending ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-5 animate-spin text-amber-500" />
                      <span>Fetching scene information from Blender...</span>
                    </div>
                  ) : toolInvocation.result?.scene_info ? (
                    `Retrieved scene info: "${toolInvocation.result.scene_info.name}" with ${toolInvocation.result.scene_info.object_count} objects`
                  ) : (
                    "Request scene information from Blender"
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
