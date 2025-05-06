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
  // Prefer parts for text rendering
  let textParts: string[] = [];
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    textParts = message.parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text" && typeof (part as any).text === "string",
      )
      .map((part) => part.text);
  }
  const contentParts =
    textParts.length > 0
      ? textParts.map((t) => ({ type: "text", value: t }))
      : [
          {
            type: "text",
            value: typeof message.content === "string" ? message.content : "",
          },
        ];
  // Tool parts
  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];
  const hasToolParts = toolParts.length > 0;

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
          {contentParts.map((part, idx) => (
            <span key={idx}>{part.value}</span>
          ))}
        </div>
      </div>
      {hasToolParts && (
        <div className="pr-3 pl-10">
          {toolParts.map((part, idx) => (
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
