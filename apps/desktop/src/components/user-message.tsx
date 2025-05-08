import type { UIMessage } from "ai";

import { cn } from "@repo/ui/lib/utils";

import { ToolSection } from "./tool-section";

interface UserMessageProps {
  message: UIMessage;
  addToolResult: (args: { toolCallId: string; result: any }) => void;
}

export function UserMessage({ message, addToolResult }: UserMessageProps) {
  const parts = Array.isArray(message.parts) ? message.parts : [];

  return (
    <div
      className={cn(
        "group relative mb-4 flex w-full flex-col",
        "border-input bg-input/30 min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-2xs transition-[color,box-shadow] md:text-sm",
      )}
    >
      {/* Thinking... indicator in bottom left */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-10 flex w-fit flex-row items-end p-2">
        <span className="text-muted-foreground text-xs italic">
          Thinking...
        </span>
      </div>
      <div className="flex items-start">
        <div className="text-foreground flex-grow pt-0.5 text-xs font-normal break-words whitespace-pre-wrap">
          {parts.length > 0 ? (
            parts.map((part, idx) => {
              switch (part.type) {
                case "text":
                  return (
                    <span key={idx} className="text-foreground">
                      {(part as any).text}
                    </span>
                  );
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
            <span className="text-foreground">
              {typeof message.content === "string" ? message.content : ""}
            </span>
          )}
        </div>
      </div>
      {/* Tool invocations rendered separately for layout consistency */}
      {parts.some((part) => part.type === "tool-invocation") && (
        <div className="mt-2 pr-3 pl-10">
          {parts
            .filter((part) => part.type === "tool-invocation")
            .map((part, idx) => (
              <ToolSection
                key={part.toolInvocation?.toolCallId || idx}
                part={{
                  type: "tool-invocation",
                  toolInvocation: part.toolInvocation || part,
                }}
                addToolResult={addToolResult}
              />
            ))}
        </div>
      )}
    </div>
  );
}
