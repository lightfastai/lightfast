import { useSessionStore } from "../stores/session-store";
import { BlenderCodeTool } from "./tools/blender-execute-code-tool";
import { BlenderReconnectTool } from "./tools/blender-reconnect-tool";
import { BlenderSceneInfoTool } from "./tools/blender-scene-info-tool";
import { ToolInvocation } from "./tools/types";

interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: ToolInvocation;
}

interface ToolSectionProps {
  part: ToolInvocationPart;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}

export function ToolSection({ part, addToolResult }: ToolSectionProps) {
  const sessionMode = useSessionStore((state) => state.sessionMode);
  const readyToolCalls = useSessionStore((state) => state.readyToolCalls);
  const autoExecute = sessionMode === "agent";

  const { toolInvocation } = part;
  // Check if this specific tool call is ready to execute
  const isReady = readyToolCalls[toolInvocation.toolCallId] || false;

  // Return the appropriate tool component based on tool name
  switch (toolInvocation.toolName) {
    case "executeBlenderCode":
      return (
        <BlenderCodeTool
          toolInvocation={toolInvocation}
          addToolResult={addToolResult}
          autoExecute={autoExecute}
          readyToExecute={isReady}
        />
      );

    case "getBlenderSceneInfo":
      return (
        <BlenderSceneInfoTool
          toolInvocation={toolInvocation}
          addToolResult={addToolResult}
          autoExecute={autoExecute}
          readyToExecute={isReady}
        />
      );

    case "reconnectBlender":
      return (
        <BlenderReconnectTool
          toolInvocation={toolInvocation}
          addToolResult={addToolResult}
          autoExecute={autoExecute}
          readyToExecute={isReady}
        />
      );

    // Notes: The analyzeBlenderModel tool doesn't need a UI component,
    // it's handled directly in tool-result.tsx like the web-search tool

    default:
      // For tools that don't need a UI component (like webSearch or analyzeBlenderModel)
      // they will be handled by the AI directly and their results displayed in tool-result.tsx
      return null;
  }
}
