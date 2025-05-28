import { cn } from "@repo/ui/lib/utils";

import { ToolResult } from "./tool-result";
import { ToolSection } from "./tool-section";

// Match the types from the actual tool invocation structure
interface ToolInvocationSectionProps {
  part: {
    type: "tool-invocation";
    toolInvocation: {
      toolName?: string;
      toolCallId?: string;
      state: string; // Accept any state string
      args?: Record<string, any>;
      result?: any;
    };
  };
  addToolResult: (args: { toolCallId: string; result: any }) => void;
}

export function ToolInvocationSection({
  part,
  addToolResult,
}: ToolInvocationSectionProps) {
  const { toolInvocation } = part;
  const { state } = toolInvocation;

  const isCallState = state === "call" || state === "partial-call";
  const isResultState = state === "result";

  // Ensure we have required properties for ToolSection
  const safeToolInvocation = {
    ...toolInvocation,
    toolName: toolInvocation.toolName || "Unknown Tool",
    toolCallId: toolInvocation.toolCallId || `tool-${Date.now()}`,
  };

  return (
    <div className={cn("tool-invocation py-2", `state-${state}`)}>
      {isCallState && (
        <ToolSection
          part={{
            type: "tool-invocation",
            toolInvocation: safeToolInvocation,
          }}
          addToolResult={addToolResult}
        />
      )}

      {isResultState && <ToolResult toolInvocation={safeToolInvocation} />}
    </div>
  );
}
