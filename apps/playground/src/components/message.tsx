"use client";

import { memo } from "react";
import type { PlaygroundUIMessage, PlaygroundUIMessagePart } from "~/types/playground-ui-messages";
import { isTextPart, isReasoningPart, isToolPart } from "~/types/playground-ui-messages";
import { Code, FileText, Globe, Camera, MousePointer, Eye } from "lucide-react";

interface MessageProps {
  message: PlaygroundUIMessage;
}

// Component for rendering tool calls
const ToolCall = memo(({ part }: { part: PlaygroundUIMessagePart }) => {
  if (!isToolPart(part)) return null;

  const toolName = part.type.replace("tool-call-", "");
  let icon = <Code className="w-4 h-4" />;
  let description = toolName;

  // Map tool names to icons and descriptions
  switch (toolName) {
    case "stagehandNavigate":
      icon = <Globe className="w-4 h-4" />;
      description = "Navigating to URL";
      break;
    case "stagehandAct":
      icon = <MousePointer className="w-4 h-4" />;
      description = "Performing action";
      break;
    case "stagehandObserve":
      icon = <Eye className="w-4 h-4" />;
      description = "Observing page";
      break;
    case "stagehandExtract":
      icon = <FileText className="w-4 h-4" />;
      description = "Extracting data";
      break;
    case "stagehandScreenshot":
      icon = <Camera className="w-4 h-4" />;
      description = "Taking screenshot";
      break;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground my-2">
      {icon}
      <span>{description}...</span>
    </div>
  );
});

ToolCall.displayName = "ToolCall";

// Component for rendering tool results
const ToolResult = memo(({ part }: { part: PlaygroundUIMessagePart }) => {
  if (!isToolPart(part) || !part.type.startsWith("tool-result-")) return null;

  // For screenshots, display the image
  if (part.type === "tool-result-stagehandScreenshot" && "result" in part && part.result) {
    const result = part.result as { screenshot?: string };
    if (result.screenshot) {
      return (
        <div className="my-2">
          <img 
            src={result.screenshot} 
            alt="Screenshot" 
            className="max-w-full rounded-lg border border-border/50"
          />
        </div>
      );
    }
  }

  // For other tool results, show a summary
  return (
    <div className="text-xs text-muted-foreground my-1">
      ✓ Action completed
    </div>
  );
});

ToolResult.displayName = "ToolResult";

// Main message component
export const Message = memo(({ message }: MessageProps) => {
  const isUser = message.role === "user";

  return (
    <div className={`mb-4 ${isUser ? "text-right" : "text-left"}`}>
      <div className={`inline-block max-w-[80%] ${isUser ? "ml-auto" : ""}`}>
        {/* Render message parts */}
        {message.parts.map((part, index) => {
          // Text parts
          if (isTextPart(part) && part.text) {
            return (
              <div
                key={index}
                className={`inline-block p-3 rounded-lg mb-1 ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <div className="whitespace-pre-wrap">{part.text}</div>
              </div>
            );
          }

          // Reasoning parts (for o1 models)
          if (isReasoningPart(part) && part.reasoning) {
            return (
              <div key={index} className="text-xs text-muted-foreground italic my-2 p-2 border-l-2 border-muted">
                <div className="font-semibold mb-1">Thinking...</div>
                <div className="whitespace-pre-wrap">{part.reasoning}</div>
              </div>
            );
          }

          // Tool calls
          if (part.type.startsWith("tool-call-")) {
            return <ToolCall key={index} part={part} />;
          }

          // Tool results
          if (part.type.startsWith("tool-result-")) {
            return <ToolResult key={index} part={part} />;
          }

          return null;
        })}
      </div>
    </div>
  );
});

Message.displayName = "Message";