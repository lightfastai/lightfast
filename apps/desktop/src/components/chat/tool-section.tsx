import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

interface ToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args?: any;
}

interface ToolInvocation {
  type: "tool-invocation";
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    state: string;
    args?: any;
    result?: any;
    error?: string;
  };
}

type ToolSectionPart = ToolCall | ToolInvocation;

interface ToolSectionProps {
  part: ToolSectionPart;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}

export function ToolSection({ part, addToolResult }: ToolSectionProps) {
  if (part.type === "tool-call") {
    return <ToolCallRequest part={part} addToolResult={addToolResult} />;
  }
  if (part.type === "tool-invocation") {
    return <ToolInvocationResult part={part} />;
  }
  return null;
}

function ToolCallRequest({
  part,
  addToolResult,
}: {
  part: ToolCall;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = part.args?.code || "";

  return (
    <div className="bg-muted/20 border-border my-2 flex flex-col gap-2 rounded border p-4">
      <div className="mb-1 text-xs font-semibold">
        Tool Request: {part.toolName}
      </div>
      {code && (
        <pre className="bg-background mb-2 overflow-x-auto rounded border p-2 text-xs whitespace-pre-wrap">
          {code}
        </pre>
      )}
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold">Suggested Actions:</span>
        <div className="flex items-center justify-between gap-2 rounded border p-2">
          <span className="flex items-center gap-2 pl-4 text-xs font-semibold">
            <PencilIcon className="h-4 w-4 rounded-full text-orange-500" />
            Execute command
          </span>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                try {
                  // Accept: send result back
                  addToolResult?.({
                    toolCallId: part.toolCallId,
                    result: {
                      type: "manual-tool-invocation",
                      result: {
                        success: true,
                        message: "Accepted and executed.",
                      },
                    },
                  });
                } catch (e: any) {
                  setError(e?.message || "Failed to execute tool");
                } finally {
                  setPending(false);
                }
              }}
            >
              <span className="flex items-center gap-2 text-xs">
                Accept & Run
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                addToolResult?.({
                  toolCallId: part.toolCallId,
                  result: { error: "User declined tool invocation" },
                });
              }}
            >
              <span className="flex items-center gap-2 text-xs">Decline</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolInvocationResult({ part }: { part: ToolInvocation }) {
  const { toolInvocation } = part;
  const code = toolInvocation.args?.code || "";
  const result = toolInvocation.result;
  const error = toolInvocation.error;

  return (
    <div className="bg-muted/20 border-border my-2 flex flex-col gap-2 rounded border p-4">
      <div className="mb-1 text-xs font-semibold">
        Tool Result: {toolInvocation.toolName}
      </div>
      {code && (
        <pre className="bg-background mb-2 overflow-x-auto rounded border p-2 text-xs">
          {code}
        </pre>
      )}
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      {result && (
        <div className="mb-2 text-xs text-green-700">
          {typeof result === "object" && result.result && result.result.message
            ? result.result.message
            : JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}
