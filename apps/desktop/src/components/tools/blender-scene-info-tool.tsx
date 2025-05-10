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

import { ToolProps } from "./types";

export function BlenderSceneInfoTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);

  const handleExecute = async () => {
    if (executed) return;

    setPending(true);
    setError(null);
    console.log(`🧰 Getting Blender scene info`);

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

      console.log(
        `🔍 BlenderSceneInfoTool: Starting getBlenderSceneInfo execution`,
      );
      console.log(
        `📤 BlenderSceneInfoTool: Sending getBlenderSceneInfo request to main process`,
      );

      const result = await window.blenderConnection.getSceneInfo();

      console.log(
        `✅ BlenderSceneInfoTool: getSceneInfo API call completed with result:`,
        result,
      );
      console.log(
        `📥 BlenderSceneInfoTool: Received direct response from main process for getBlenderSceneInfo`,
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
        `🔄 BlenderSceneInfoTool: Processing getBlenderSceneInfo response`,
      );
      setPending(false);
      setExecuted(true);

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
            <div className="text-muted-foreground p-4 text-center">
              {error ? (
                <div className="text-[0.65rem] leading-tight text-red-600">
                  {error}
                </div>
              ) : (
                <div className="text-[0.65rem]">
                  {pending
                    ? "Fetching scene information from Blender..."
                    : toolInvocation.result?.scene_info
                      ? `Retrieved scene info: "${toolInvocation.result.scene_info.name}" with ${toolInvocation.result.scene_info.object_count} objects`
                      : "Request scene information from Blender"}
                </div>
              )}
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
