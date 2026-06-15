"use client";

import { MessageResponse } from "@repo/ui/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/ui/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@repo/ui/components/ai-elements/tool";
import type { UIMessage } from "@vendor/ai";
import { memo } from "react";

export const WorkspaceAssistantMessagePart = memo(
  function WorkspaceAssistantMessagePart({
    isStreaming,
    part,
  }: {
    isStreaming: boolean;
    part: UIMessage["parts"][number];
  }) {
    if (part.type === "text") {
      return <MessageResponse>{part.text}</MessageResponse>;
    }

    if (part.type === "reasoning") {
      return (
        <Reasoning defaultOpen={isStreaming} isStreaming={isStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }

    if (isGranolaUserConnectorToolPart(part)) {
      return (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground text-xs">
          Used Granola
        </div>
      );
    }

    if (isToolPart(part)) {
      return (
        <Tool defaultOpen={part.state !== "output-available"}>
          {part.type === "dynamic-tool" ? (
            <ToolHeader
              state={part.state}
              toolName={part.toolName}
              type={part.type}
            />
          ) : (
            <ToolHeader state={part.state} type={part.type} />
          )}
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput errorText={part.errorText} output={part.output} />
          </ToolContent>
        </Tool>
      );
    }

    if (part.type === "source-url") {
      const source = part as { title?: string; url?: string };
      if (!source.url) {
        return null;
      }
      return (
        <a
          className="text-muted-foreground text-sm underline underline-offset-4"
          href={source.url}
          rel="noreferrer"
          target="_blank"
        >
          {source.title ?? source.url}
        </a>
      );
    }

    if (part.type === "source-document") {
      const source = part as { filename?: string; title?: string };
      return (
        <div className="text-muted-foreground text-sm">
          Source: {source.title ?? source.filename ?? "Document"}
        </div>
      );
    }

    if (part.type === "file") {
      const file = part as {
        filename?: string;
        mediaType?: string;
        url?: string;
      };
      const label = file.filename ?? file.mediaType ?? "File";
      if (file.url) {
        return (
          <a
            className="text-muted-foreground text-sm underline underline-offset-4"
            href={file.url}
            rel="noreferrer"
            target="_blank"
          >
            {label}
          </a>
        );
      }
      return <div className="text-muted-foreground text-sm">{label}</div>;
    }

    if (part.type === "step-start") {
      return null;
    }

    if (part.type.startsWith("data-")) {
      return (
        <div className="text-muted-foreground text-sm">
          {formatPartLabel(part.type.slice("data-".length))} data received
        </div>
      );
    }

    return (
      <div className="text-muted-foreground text-sm">
        {formatPartLabel(part.type)} received
      </div>
    );
  }
);

function isGranolaUserConnectorToolPart(part: UIMessage["parts"][number]) {
  if (
    !("state" in part) ||
    part.type !== "tool-callUserConnectorTool" ||
    part.state !== "output-available"
  ) {
    return false;
  }
  const output = (part as { output?: unknown }).output;
  return (
    output &&
    typeof output === "object" &&
    "provider" in output &&
    (output as { provider?: unknown }).provider === "granola"
  );
}

function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return (
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function formatPartLabel(value: string) {
  return value.split(/[-_]/g).filter(Boolean).join(" ");
}
