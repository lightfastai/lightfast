import type { UIMessage } from "ai";
import { useEffect, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { cn } from "@repo/ui/lib/utils";

import { ToolSection } from "../../chat/tool-section";

interface AssistantMessageProps {
  message: UIMessage;
  status?: "submitted" | "streaming" | "ready" | "error";
  addToolResult: (args: { toolCallId: string; result: any }) => void;
}

export function AssistantMessage({
  message,
  status = "ready",
  addToolResult,
}: AssistantMessageProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const assistant = { name: "Assistant" };
  const createdAt = message.createdAt;

  // Prefer parts for text rendering
  const parts = Array.isArray(message.parts) ? message.parts : [];

  useEffect(() => {
    // Simplified duration logic for now
    if (createdAt && duration === null) {
      setDuration(0); // Set immediately or calculate if needed
    }
  }, [createdAt, duration]);

  return (
    <div className={cn("group relative mb-8 flex flex-col")}>
      <div className="flex items-center space-x-2 px-3 py-1">
        <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
          <AvatarImage src={`https://avatar.vercel.sh/${assistant.name}`} />
          <AvatarFallback>
            {assistant.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Thinking state or duration */}
        {status === "submitted" ? (
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            Thinking...
          </span>
        ) : duration !== null ? (
          <span className="text-muted-foreground text-xs">
            Thought for {duration} seconds
          </span>
        ) : null}
      </div>
      {/* Render parsed content (text/code/tool) */}
      <div className="pt-3 pr-3 pl-10">
        <div className="text-sm font-normal break-words whitespace-pre-wrap">
          {parts.length > 0 ? (
            parts.map((part, idx) => {
              // Type guard for tool-call (not in TS type but may be present in runtime data)
              // if ((part as any).type === "tool-call") {
              //   return (
              //     <ToolSection
              //       key={(part as any).toolCallId || idx}
              //       part={{ type: "tool-call", ...(part as any) }}
              //       addToolResult={addToolResult}
              //     />
              //   );
              // }
              switch (part.type) {
                case "text":
                  return <span key={idx}>{(part as any).text}</span>;
                case "tool-invocation":
                  return (
                    <ToolSection
                      key={part.toolInvocation?.toolCallId || idx}
                      part={{
                        type: "tool-invocation",
                        toolInvocation: part.toolInvocation || part,
                      }}
                      addToolResult={addToolResult}
                    />
                  );
                default:
                  return null;
              }
            })
          ) : (
            <span>
              {typeof message.content === "string" ? message.content : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
