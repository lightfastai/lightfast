// Import the correct types from the ai package
import type { Message } from "ai";
import { useEffect, useState } from "react";
import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useChat } from "ai/react";
import { Send } from "lucide-react";
import { z } from "zod";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

// --- Define Blender Tools Schema (for client-side reference if needed, and backend) ---
const blenderToolSchemas = {
  createBlenderObject: {
    description:
      "Creates a new object (e.g., Cube, Sphere, Suzanne) in the Blender scene.",
    parameters: z.object({
      objectType: z
        .enum(["CUBE", "SPHERE", "MONKEY"])
        .describe("The type of object to create."),
      location: z
        .object({
          x: z.number().optional().default(0).describe("X coordinate"),
          y: z.number().optional().default(0).describe("Y coordinate"),
          z: z.number().optional().default(0).describe("Z coordinate"),
        })
        .optional()
        .describe("Position to create the object."),
      name: z.string().optional().describe("Optional name for the new object."),
    }),
  },
  // --- Add more tool schemas here ---
};
// --- End Blender Tools Definition ---

// Define custom part types for our UI
interface TextPart {
  type: "text";
  text: string;
}

interface ToolInvocationPart {
  type: "tool-invocation";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "result" | "error";
  result?: string;
  error?: string;
}

type DisplayMessagePart = TextPart | ToolInvocationPart;

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/workspace/$workspaceId" });
  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  // State for Blender connection status
  const [blenderStatus, setBlenderStatus] = useState<string>("disconnected");

  // Listen for Blender connection status updates
  useEffect(() => {
    // Set up listener for Blender connection status
    const cleanup = window.blenderConnection?.onStatusUpdate((status) => {
      setBlenderStatus(status.status);
      console.log("Blender connection status:", status);
    });

    // Clean up listener when component unmounts
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: `${import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL}/api/chat`,

      // Implement client-side tool execution via onToolCall
      async onToolCall({
        toolCall,
      }: {
        toolCall: { toolName: string; args: any };
      }) {
        console.log("Client onToolCall received:", toolCall);

        if (toolCall.toolName === "createBlenderObject") {
          try {
            // Invoke the main process handler via IPC
            const result = await window.electronAPI.invoke(
              "handle-blender-create-object",
              toolCall.args,
            );
            console.log(
              "Renderer: Received result from main for tool call:",
              result,
            );
            // Return the result (must be serializable, string is safest)
            return JSON.stringify(result);
          } catch (error: any) {
            console.error(
              "Renderer: Error executing createBlenderObject via IPC:",
              error,
            );
            // Return error information (as a string)
            return JSON.stringify({
              success: false,
              error: `IPC Error: ${error.message}`,
            });
          }
        }

        // Handle other potential client-side tools here if needed

        console.warn(`Tool '${toolCall.toolName}' not handled on client.`);
        return JSON.stringify({
          success: false,
          error: `Tool '${toolCall.toolName}' not implemented on client.`,
        });
      },

      // Removed onToolCallFinished and experimental_onToolCall as they seem invalid/redundant
    });

  if (error) {
    console.error("Chat Error:", error);
  }

  // Helper function to render message parts
  const renderMessagePart = (part: any, messageId: string) => {
    if (part.type === "text") {
      return part.text;
    }

    if (part.type === "tool-invocation") {
      const { toolCallId, toolName, args, state } = part;

      // Log the actual state for debugging
      console.log(`Tool part state: ${state}`, part);

      // Ensure args is stringifiable before proceeding
      let argsString = "[Non-stringifiable args]";
      try {
        argsString = JSON.stringify(args);
      } catch (e) {
        console.error("Could not stringify tool args:", args, e);
      }

      // Handle all possible tool states
      if (state === "call" || state === "calling") {
        return (
          <div
            key={`${messageId}-${toolCallId}-call`}
            className="text-muted-foreground w-full py-2 text-center text-xs italic"
          >
            Calling tool: {toolName}({argsString})...
          </div>
        );
      }

      if (state === "result" || state === "success") {
        // Attempt to parse the result string for display
        let resultDisplay = part.result;
        try {
          if (typeof resultDisplay === "string") {
            resultDisplay = JSON.stringify(JSON.parse(resultDisplay), null, 2);
          }
        } catch (e) {
          /* Ignore parsing error, display as is */
        }
        return (
          <div
            key={`${messageId}-${toolCallId}-result`}
            className="mt-2 mb-2 flex w-full justify-start"
          >
            <div
              className={`bg-muted text-foreground max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm`}
            >
              <span className="font-semibold">Tool Result ({toolName}):</span>
              <pre className="mt-1 text-xs break-all whitespace-pre-wrap">
                {typeof resultDisplay === "string"
                  ? resultDisplay
                  : JSON.stringify(resultDisplay)}
              </pre>
            </div>
          </div>
        );
      }

      if (state === "error" || state === "failed") {
        // Check for specific error codes
        let errorMessage = String(part.error);
        let errorClass = "bg-destructive text-destructive-foreground";

        // Convert JSON string error to object if needed
        let errorObj = part.error;
        if (typeof part.error === "string") {
          try {
            errorObj = JSON.parse(part.error);
          } catch (e) {
            // Not JSON, leave as string
          }
        }

        // Check for specific error codes
        if (
          errorObj &&
          typeof errorObj === "object" &&
          "errorCode" in errorObj
        ) {
          if (errorObj.errorCode === "BLENDER_NOT_CONNECTED") {
            errorClass = "bg-amber-600 text-white";
            errorMessage =
              "⚠️ Blender is not connected. Please start Blender and connect it to the app.";
          }
        }

        return (
          <div
            key={`${messageId}-${toolCallId}-error`}
            className="mt-2 mb-2 flex w-full justify-start"
          >
            <div
              className={`${errorClass} max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm`}
            >
              <span className="font-semibold">Tool Error ({toolName}):</span>
              <pre className="mt-1 text-xs break-all whitespace-pre-wrap">
                {errorMessage}
              </pre>
            </div>
          </div>
        );
      }

      // Handle any other state
      return (
        <div
          key={`${messageId}-${toolCallId}-unknown`}
          className="text-muted-foreground w-full py-2 text-center text-xs italic"
        >
          Tool {toolName} is in state: {state}
        </div>
      );
    }

    // Handle other part types if they exist
    return null;
  };

  // Define custom type guards for message parts
  function isTextPart(part: any): boolean {
    return part?.type === "text" && typeof part.text === "string";
  }

  function isToolInvocationPart(part: any): boolean {
    return (
      part?.type === "tool-invocation" &&
      typeof part.toolCallId === "string" &&
      typeof part.toolName === "string" &&
      typeof part.state === "string"
    );
  }

  return (
    <RootLayout>
      <div className="bg-background flex h-screen flex-col">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="text-foreground text-sm font-medium">
              {workspace?.name}
            </span>
          </div>

          {/* Blender connection status */}
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                blenderStatus === "connected"
                  ? "bg-green-500"
                  : blenderStatus === "listening"
                    ? "animate-pulse bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground text-xs">
              Blender:{" "}
              {blenderStatus === "connected"
                ? "Connected"
                : blenderStatus === "listening"
                  ? "Waiting for connection"
                  : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {error && (
              <div className="flex justify-start">
                <div className="bg-destructive text-destructive-foreground max-w-[80%] rounded-2xl px-4 py-2.5">
                  Error: {error.message}
                </div>
              </div>
            )}
            {(messages as Message[]).map((message) => {
              // Display content based on message role and parts
              return (
                <div key={message.id}>
                  {/* Collect all visible text parts */}
                  {Array.isArray(message.parts) && (
                    <div>
                      {/* Text content (if any) */}
                      {message.parts.some((part) => part.type === "text") && (
                        <div
                          className={`mb-2 flex w-full ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                              message.role === "user"
                                ? "text-primary-foreground bg-orange-500"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {/* Combine all text parts */}
                            {message.parts
                              .filter((part) => part.type === "text")
                              .map((part: any, idx) => (
                                <span key={idx}>{part.text}</span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Tool invocation parts */}
                      {message.parts
                        .filter((part) => part.type === "tool-invocation")
                        .map((part: any, idx) =>
                          renderMessagePart(part, message.id + "-" + idx),
                        )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Loading Indicator */}
            {isLoading && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <div className="bg-muted-foreground h-2 w-2 animate-pulse rounded-full" />
                Thinking...
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-border border-t p-4">
          <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me to do something in Blender..."
                disabled={isLoading}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Send className="size-4" />
              </Button>
            </form>
            <div className="mt-2 text-center">
              <span className="text-muted-foreground text-xs">
                v0 may make mistakes. Please use with discretion.
              </span>
            </div>
          </div>
        </div>
      </div>
    </RootLayout>
  );
}

// Define window interface for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getClientEnv: () => Promise<any>;
      ping: () => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    blenderConnection: {
      onStatusUpdate: (callback: (status: any) => void) => () => void;
      sendToBlender: (message: object) => Promise<any>;
    };
  }
}
