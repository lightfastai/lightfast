import { MessageResponse } from "@repo/ui-v2/components/ai-elements/message";
import {
  type ToolPart as AiElementsToolPart,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@repo/ui-v2/components/ai-elements/tool";
import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "@repo/ui-v2/components/ai-elements/thinking-steps";
import { mapActivityStatusToThinkingStepStatus } from "@repo/ai/workspace-assistant";
import type { DynamicToolUIPart, ToolUIPart, UIMessage } from "@vendor/ai";
import { memo, useEffect, useRef, useState } from "react";

interface WorkspaceToolPart {
  errorText?: AiElementsToolPart["errorText"];
  input?: AiElementsToolPart["input"];
  output?: AiElementsToolPart["output"];
  state: AiElementsToolPart["state"];
  toolName?: string;
  type: "dynamic-tool" | `tool-${string}`;
}

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

    return (
      <WorkspaceAssistantActivityGroup
        isStreaming={isStreaming}
        parts={[part]}
      />
    );
  }
);

export function WorkspaceAssistantActivityGroup({
  isStreaming,
  parts,
}: {
  isStreaming: boolean;
  parts: UIMessage["parts"];
}) {
  const [open, setOpen] = useState(isStreaming);
  const wasStreamingRef = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
    } else if (wasStreamingRef.current) {
      setOpen(false);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  return (
    <ThinkingSteps onOpenChange={setOpen} open={open}>
      <ThinkingStepsHeader>Thinking</ThinkingStepsHeader>
      <ThinkingStepsContent>
        {parts.map((part, index) => (
          <WorkspaceAssistantActivityPart
            isLast={index === parts.length - 1}
            isStreaming={isStreaming}
            key={`${part.type}-${index}`}
            part={part}
          />
        ))}
      </ThinkingStepsContent>
    </ThinkingSteps>
  );
}

function WorkspaceAssistantActivityPart({
  isLast,
  isStreaming,
  part,
}: {
  isLast: boolean;
  isStreaming: boolean;
  part: UIMessage["parts"][number];
}) {
  if (part.type === "reasoning") {
    return (
      <ThinkingStep
        description={part.text}
        isLast={isLast}
        label="Thinking"
        status={isStreaming ? "active" : "complete"}
      />
    );
  }

  if (part.type === "data-activity") {
    const activity = getActivityData(part);
    const sources = activity.sources ?? [];
    return (
      <ThinkingStep
        description={activity.summary}
        isLast={isLast}
        label={activity.label}
        status={mapActivityStatusToThinkingStepStatus(activity.status)}
      >
        {activity.details?.length || sources.length ? (
          <ThinkingStepDetails details={activity.details} summary="Details">
            {sources.length ? (
              <ThinkingStepSources>
                {sources.map((source) => (
                  <ThinkingStepSource
                    key={`${source.label}-${source.url ?? ""}`}
                    render={
                      source.url ? (
                        <a href={source.url} rel="noreferrer" target="_blank" />
                      ) : undefined
                    }
                  >
                    {source.label}
                  </ThinkingStepSource>
                ))}
              </ThinkingStepSources>
            ) : null}
          </ThinkingStepDetails>
        ) : null}
      </ThinkingStep>
    );
  }

  if (part.type === "step-start") {
    return null;
  }

  if (isGranolaUserConnectorToolPart(part)) {
    return (
      <ThinkingStep
        isLast={isLast}
        label="Used Granola"
        status="complete"
      />
    );
  }

  if (isToolPart(part)) {
    const toolPart = part as unknown as WorkspaceToolPart;
    const label =
      toolPart.type === "dynamic-tool"
        ? formatPartLabel(toolPart.toolName ?? "tool")
        : formatPartLabel(toolPart.type.slice("tool-".length));
    return (
      <ThinkingStep
        isLast={isLast}
        label={label}
        status={toolPart.state === "output-available" ? "complete" : "active"}
      >
        <ThinkingStepDetails summary="Tool details">
          <Tool
            defaultOpen={toolPart.state !== "output-available"}
            key={toolPart.state}
          >
            {toolPart.type === "dynamic-tool" ? (
              <ToolHeader
                state={toolPart.state as DynamicToolUIPart["state"]}
                toolName={toolPart.toolName ?? ""}
                type="dynamic-tool"
              />
            ) : (
              <ToolHeader
                state={toolPart.state as ToolUIPart["state"]}
                type={toolPart.type as ToolUIPart["type"]}
              />
            )}
            <ToolContent>
              <ToolInput input={toolPart.input} />
              <ToolOutput
                errorText={toolPart.errorText}
                output={toolPart.output}
              />
            </ToolContent>
          </Tool>
        </ThinkingStepDetails>
      </ThinkingStep>
    );
  }

  if (part.type === "source-url") {
    const source = part as { title?: string; url?: string };
    return (
      <ThinkingStep isLast={isLast} label="Source" status="complete">
        <ThinkingStepSources>
          <ThinkingStepSource
            render={
              source.url ? (
                <a href={source.url} rel="noreferrer" target="_blank" />
              ) : undefined
            }
          >
            {source.title ?? source.url ?? "URL"}
          </ThinkingStepSource>
        </ThinkingStepSources>
      </ThinkingStep>
    );
  }

  if (part.type === "source-document") {
    const source = part as { filename?: string; title?: string };
    return (
      <ThinkingStep
        description={source.filename}
        isLast={isLast}
        label={source.title ?? source.filename ?? "Document source"}
        status="complete"
      />
    );
  }

  if (part.type === "file") {
    const file = part as {
      filename?: string;
      mediaType?: string;
      url?: string;
    };
    const label = file.filename ?? file.mediaType ?? "File";
    return (
      <ThinkingStep isLast={isLast} label={label} status="complete">
        {file.url ? (
          <ThinkingStepSources>
            <ThinkingStepSource
              render={<a href={file.url} rel="noreferrer" target="_blank" />}
            >
              Open file
            </ThinkingStepSource>
          </ThinkingStepSources>
        ) : null}
      </ThinkingStep>
    );
  }

  if (part.type.startsWith("data-")) {
    return (
      <ThinkingStep
        isLast={isLast}
        label={`${formatPartLabel(part.type.slice("data-".length))} data`}
        status="complete"
      />
    );
  }

  return (
    <ThinkingStep
      isLast={isLast}
      label={`${formatPartLabel(part.type)} received`}
      status="complete"
    />
  );
}

function isToolPart(part: UIMessage["parts"][number]) {
  return (
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function isGranolaUserConnectorToolPart(
  part: UIMessage["parts"][number]
): boolean {
  if (
    !("state" in part) ||
    part.type !== "tool-callUserConnectorTool" ||
    part.state !== "output-available"
  ) {
    return false;
  }

  const output = part.output;
  return (
    typeof output === "object" &&
    output !== null &&
    "provider" in output &&
    output.provider === "granola"
  );
}

function getActivityData(part: UIMessage["parts"][number]) {
  const data =
    "data" in part && typeof part.data === "object" && part.data !== null
      ? (part.data as {
          details?: string[];
          label?: string;
          sources?: Array<{ label: string; url?: string }>;
          status?: "running" | "completed" | "failed";
          summary?: string;
        })
      : {};

  return {
    details: Array.isArray(data.details) ? data.details : undefined,
    label: data.label?.trim() || "Activity",
    sources: Array.isArray(data.sources) ? data.sources : undefined,
    status: data.status,
    summary: data.summary,
  };
}

function formatPartLabel(value: string) {
  return value.split(/[-_]/g).filter(Boolean).join(" ");
}
