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

export function BlenderReconnectTool({
  toolInvocation,
  addToolResult,
  autoExecute = false,
  readyToExecute = false,
}: ToolProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const handleExecute = async () => {
    if (executed) return;

    setPending(true);
    setError(null);
    console.log(`🧰 Reconnecting to Blender`);

    try {
      if (!window.blenderConnection) {
        throw new Error("Blender connection API not available");
      }

      const connectionStatus = await window.blenderConnection.getStatus();
      setStatus(connectionStatus);

      setPending(false);
      setExecuted(true);

      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: true,
          status: connectionStatus,
          message: `Blender connection status: ${connectionStatus.status}`,
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

  // Only auto-execute when the tool call is ready
  useEffect(() => {
    if (autoExecute && readyToExecute && !executed) {
      console.log(`🤖 Auto-executing Blender reconnect tool`);
      handleExecute();
    }
  }, [autoExecute, readyToExecute, executed]);

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
                    Checking connection...
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
                  {pending ? (
                    "Checking Blender connection status..."
                  ) : status ? (
                    <div
                      className={cn(
                        "font-medium",
                        status.status === "connected"
                          ? "text-green-500"
                          : "text-amber-500",
                      )}
                    >
                      Blender connection status: {status.status}
                    </div>
                  ) : (
                    "Get Blender connection status"
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
