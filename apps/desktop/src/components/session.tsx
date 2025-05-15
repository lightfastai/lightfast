import React, { useEffect } from "react";
import {
  SESSION_CHAT_API_URL,
  SESSION_CHAT_AUTO_RESUME,
} from "@/config/session-constants";
import { trpc } from "@/trpc";
import { convertDBMessageToUIMessages } from "@/types/internal";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { nanoid } from "@repo/lib";
import { AgentMode } from "@repo/lightfast-js";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";

import { ToolType, useToolExecution } from "../hooks/use-tool-execution";
import { useSessionStore } from "../stores/session-store";
import { BlenderAnalysisDisplay } from "./blender-analysis-display";
import { BlenderPortIndicator } from "./blender-port-indicator";
import { HistoryMenu } from "./history-menu";
import { MessageList } from "./message-list";
import { UserMessageInput } from "./user-message-input";

export interface SessionProps {
  sessionId: string;
}

export const Session: React.FC<SessionProps> = ({ sessionId }) => {
  const { data: session } = useQuery(
    trpc.tenant.session.get.queryOptions({ sessionId }),
  );
  const { data: sessions } = useQuery(trpc.tenant.session.list.queryOptions());

  // Get the session mode from the store
  const sessionMode = useSessionStore((state) => state.sessionMode);
  const markToolCallReady = useSessionStore((state) => state.markToolCallReady);

  // Use our central tool execution hook
  const { executeTool, mapToolNameToType } = useToolExecution();

  const {
    messages,
    input,
    setInput,
    handleSubmit: originalHandleSubmit,
    status,
    error,
    experimental_resume,
    addToolResult,
    stop,
    setMessages,
    data,
  } = useChat({
    id: sessionId,
    api: SESSION_CHAT_API_URL,
    initialMessages: convertDBMessageToUIMessages(session?.messages || []),
    generateId: () => nanoid(),
    sendExtraMessageFields: true,
    experimental_prepareRequestBody: (body) => ({
      message: body.messages.at(-1),
      sessionId: sessionId ?? body.id, // @IMPORTANT we pass the body.id as inference to create the sesssion if doesn't exists...
      sessionMode, // Add the session mode to the request
    }),
    onError: (err) => {
      // @TODO Proper handling of errors on client-side...
      console.error("Chat Error:", err);
    },
    onFinish: () => {
      // window.history.replaceState({}, "", `/search/${id}`);
      console.log("Chat finished successfully");
    },
    onToolCall: async (data) => {
      console.log("🧰 Received tool call from AI SDK", data);

      if (data && data.toolCall) {
        // Extract tool call details
        const toolCallId = data.toolCall.toolCallId;
        const toolName = data.toolCall.toolName;
        const toolArgs = data.toolCall.args as Record<string, unknown>;

        console.log(
          `🧰 Tool call details: ${toolCallId} (${toolName})`,
          toolArgs,
        );

        // Mark this tool call as ready to execute
        markToolCallReady(toolCallId);

        // Check if this is a tool we can auto-execute in agent mode
        if (sessionMode === "agent") {
          // Get the tool type based on name (will return "default" for unknown tools)
          const toolType = mapToolNameToType(toolName) as ToolType;

          if (!toolType) {
            console.error(`Unknown tool type: ${toolName}`);
            return;
          }

          console.log(`🤖 Auto-executing ${toolName} tool: ${toolCallId}`);

          try {
            // Execute the tool using our centralized handler
            const result = await executeTool(toolCallId, toolType, toolArgs);
            console.log(`Tool execution result for ${toolName}:`, result);

            // Report results back to AI
            addToolResult({
              toolCallId: toolCallId,
              result: result,
            });
          } catch (e: any) {
            console.error(`Error auto-executing tool ${toolName}:`, e);

            // Report error back to AI
            addToolResult({
              toolCallId: toolCallId,
              result: {
                success: false,
                error: e?.message || `Failed to execute ${toolName}`,
              },
            });
          }
        } else {
          console.log(
            `🧰 Tool ${toolName} will be executed by the UI component`,
          );
        }
      }
    },
  });

  console.log("messages", messages);

  // Wrap the original handleSubmit to include the sessionMode
  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    mode: AgentMode,
  ) => {
    // If a mode is provided in the call, use it; otherwise use the current store value
    const currentMode = mode || sessionMode;

    // Update the store if needed
    if (mode && mode !== sessionMode) {
      useSessionStore.getState().setSessionMode(mode);
    }

    return originalHandleSubmit(e);
  };

  const inputStatusForUserMessageInput: "ready" | "thinking" =
    status === "submitted" || status === "streaming" ? "thinking" : "ready";

  useEffect(() => {
    if (!SESSION_CHAT_AUTO_RESUME) return;
    if (sessionId && experimental_resume) {
      console.log(`Attempting to resume chat for session: ${sessionId}`);
      experimental_resume();
    }
  }, [sessionId, experimental_resume]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 pt-16 pb-4">
      <header className="flex w-full items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <h1
              className={cn(
                "text-muted-foreground bg-muted-foreground/10 h-6 max-w-64 min-w-20 cursor-default overflow-hidden rounded-md border px-3 py-1 font-mono text-[0.65rem] font-bold whitespace-nowrap",
                !session?.title && status === "submitted" && "animate-pulse",
              )}
            >
              <span
                className={
                  session?.title &&
                  "[mask-image:linear-gradient(to_right,black_50%,transparent_95%)]"
                }
              >
                {session?.title
                  ? session?.title
                  : status === "ready"
                    ? "New Chat"
                    : ""}
              </span>
            </h1>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-xs px-2 py-1 text-xs">
            {session?.title ? session.title : "New Chat"}
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-3">
          {/* <WindowIndicator /> */}
          <BlenderPortIndicator />
          <div className="flex items-center gap-1">
            <Link to="/">
              <Button variant="ghost" size="xs">
                <Plus className="text-muted-foreground size-3" />
              </Button>
            </Link>
            <HistoryMenu sessions={sessions} />
          </div>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col gap-2 overflow-hidden">
        <div className="relative flex h-full w-full flex-col items-end justify-between">
          <div className={cn("bg-background flex h-full w-full flex-col")}>
            <div className="flex h-full w-full flex-col items-center">
              {/* MessageListArea: occupies most space when present */}
              {messages && messages.length > 0 && (
                <div className="w-full flex-1 overflow-y-auto">
                  <MessageList
                    messages={messages || []}
                    status={status}
                    error={error || null}
                    className="w-full"
                    addToolResult={addToolResult}
                    stop={stop}
                    setMessages={setMessages}
                  />
                </div>
              )}

              {/* Display Blender analysis stream */}
              {sessionId && <BlenderAnalysisDisplay sessionId={sessionId} />}

              {/* UserInputArea: always present. At top if MessageListArea is not there, at bottom otherwise. */}
              <div className="w-full overflow-hidden">
                <UserMessageInput
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  className="w-full"
                  status={inputStatusForUserMessageInput}
                  // Props for the main input field
                  stop={stop}
                  setMessages={setMessages}
                />
              </div>
            </div>
          </div>
          {/* {messages.length === 0 && sessions && (
            <div className="flex w-full items-center justify-center">
              <PastSessions sessions={sessions} />
            </div>
          )} */}
        </div>
      </main>
    </div>
  );
};
