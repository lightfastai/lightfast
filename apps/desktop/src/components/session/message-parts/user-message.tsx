import type { UIMessage } from "ai";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { cn } from "@repo/ui/lib/utils";

import { ToolSection } from "../../chat/tool-section";

interface UserMessageProps {
  message: UIMessage;
  addToolResult?: (args: { toolCallId: string; result: any }) => void;
}

export function UserMessage({ message, addToolResult }: UserMessageProps) {
  const user = { email: "test@test.com" };
  const parts = Array.isArray(message.parts) ? message.parts : [];

  return (
    <div className={cn("group relative mb-8 flex flex-col")}>
      <div className="flex items-start space-x-2 px-3 py-1">
        <Avatar className="bg-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow select-none">
          <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
          <AvatarFallback>
            {user.email?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-grow pt-0.5 text-sm font-normal break-words whitespace-pre-wrap">
          {parts.length > 0 ? (
            parts.map((part, idx) => {
              switch (part.type) {
                case "text":
                  return <span key={idx}>{(part as any).text}</span>;
                case "step-start":
                  return (
                    <span key={idx} className="text-muted-foreground italic">
                      [Step started]
                    </span>
                  );
                case "tool-invocation":
                  return null; // Rendered below
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
      {/* Tool invocations rendered separately for layout consistency */}
      {parts.some((part) => part.type === "tool-invocation") && (
        <div className="pr-3 pl-10">
          {parts
            .filter((part) => part.type === "tool-invocation")
            .map((part, idx) => (
              <ToolSection
                key={part.toolInvocation?.toolCallId || idx}
                toolInvocation={part.toolInvocation || part}
                addToolResult={addToolResult}
              />
            ))}
        </div>
      )}
    </div>
  );
}
