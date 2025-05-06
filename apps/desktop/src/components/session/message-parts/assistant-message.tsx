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
  addToolResult?: (args: { toolCallId: string; result: any }) => void;
}

// Helper function to parse text and code blocks
const parseMessageContent = (content: string) => {
  const parts = [];
  let lastIndex = 0;
  const regex = /```python\n([\s\S]*?)\n```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: content.substring(lastIndex, match.index),
      });
    }
    // Add the code block
    parts.push({ type: "code", language: "python", value: match[1] });
    lastIndex = regex.lastIndex;
  }

  // Add any remaining text after the last code block
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.substring(lastIndex) });
  }

  return parts;
};

export function AssistantMessage({
  message,
  status = "ready",
  addToolResult,
}: AssistantMessageProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const assistant = { name: "Assistant" };
  const createdAt = message.createdAt;

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
  // For assistant, parse code blocks from joined textParts or content
  let contentParts: { type: string; value: string }[] = [];
  const assistantText =
    textParts.length > 0
      ? textParts.join("\n")
      : typeof message.content === "string"
        ? message.content
        : "";
  contentParts = parseMessageContent(assistantText);

  // Tool parts
  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter((part) => part.type === "tool-invocation")
    : [];
  const hasToolParts = toolParts.length > 0;

  // Determine if there's any visible output
  const hasVisibleOutput =
    contentParts.some((p) => p.type === "text" && p.value.trim().length > 0) ||
    contentParts.some((p) => p.type === "code") ||
    hasToolParts;

  useEffect(() => {
    // Simplified duration logic for now
    if (hasVisibleOutput && createdAt && duration === null) {
      setDuration(0); // Set immediately or calculate if needed
    }
  }, [hasVisibleOutput, createdAt, duration]);

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
      {/* Render parsed content (text/code) and tool parts */}
      {hasVisibleOutput && (
        <div className="pt-3 pr-3 pl-10">
          <div className="text-sm font-normal break-words whitespace-pre-wrap">
            {contentParts.map((part, index) => {
              if (part.type === "text") {
                return <span key={`content-${index}`}>{part.value}</span>;
              }
              if (part.type === "code") {
                return (
                  <pre
                    key={`content-${index}`}
                    className="bg-muted dark:bg-muted/50 border-border my-2 overflow-x-auto rounded-md border p-2 font-mono text-xs"
                  >
                    <code className="text-foreground w-fit whitespace-pre-wrap">
                      {part.value}
                    </code>
                  </pre>
                );
              }
              return null;
            })}
          </div>
          {/* Render separate tool invocation parts if they exist */}
          {hasToolParts &&
            toolParts.map((part, idx) => (
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
