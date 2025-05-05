import { useState } from "react";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: string;
  args?: any;
  result?: any;
  error?: string;
}

interface ToolSectionProps {
  toolInvocation: ToolInvocation;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}

export function ToolSection({
  toolInvocation,
  addToolResult,
}: ToolSectionProps) {
  switch (toolInvocation.toolName) {
    case "executeBlenderCode":
      return (
        <ExecuteBlenderCodeSection
          toolInvocation={toolInvocation}
          addToolResult={addToolResult}
        />
      );
    case "reconnectBlender":
      return (
        <ReconnectBlenderSection
          toolInvocation={toolInvocation}
          addToolResult={addToolResult}
        />
      );
    default:
      return null;
  }
}

interface ExecuteBlenderCodeSectionProps {
  toolInvocation: ToolInvocation;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}

function ExecuteBlenderCodeSection({
  toolInvocation,
  addToolResult,
}: ExecuteBlenderCodeSectionProps) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = toolInvocation.args?.code || "";

  if (toolInvocation.state !== "call") return null;

  return (
    <div className="bg-muted my-2 flex flex-col gap-2 rounded border p-3">
      <div className="mb-1 text-xs font-semibold">
        Blender Code Execution Request
      </div>
      <pre className="bg-background mb-2 overflow-x-auto rounded border p-2 text-xs">
        {code}
      </pre>
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={executing}
          onClick={async () => {
            setExecuting(true);
            setError(null);
            try {
              const result = await window.electronAPI.invoke(
                "handle-blender-execute-code",
                { code },
              );
              addToolResult?.({
                toolCallId: toolInvocation.toolCallId,
                result,
              });
            } catch (e: any) {
              setError(e?.message || "Failed to execute code");
              addToolResult?.({
                toolCallId: toolInvocation.toolCallId,
                result: { error: e?.message || "Failed to execute code" },
              });
            } finally {
              setExecuting(false);
            }
          }}
        >
          {executing ? "Running..." : "Run in Blender"}
        </button>
        <button
          className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
          disabled={executing}
          onClick={() => {
            addToolResult?.({
              toolCallId: toolInvocation.toolCallId,
              result: { error: "User denied execution" },
            });
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ReconnectBlenderSectionProps {
  toolInvocation: ToolInvocation;
  addToolResult?: (params: { toolCallId: string; result: any }) => void;
}

function ReconnectBlenderSection({
  toolInvocation,
  addToolResult,
}: ReconnectBlenderSectionProps) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (toolInvocation.state !== "call") return null;

  return (
    <div className="bg-muted my-2 flex flex-col gap-2 rounded border p-3">
      <div className="mb-1 text-xs font-semibold">Blender Connection</div>
      <div className="mb-2 text-xs">
        Blender is not connected. Press the button below to attempt
        reconnection.
      </div>
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={executing}
          onClick={async () => {
            setExecuting(true);
            setError(null);
            try {
              const result = await window.electronAPI.invoke(
                "handle-blender-reconnect",
              );
              addToolResult?.({
                toolCallId: toolInvocation.toolCallId,
                result,
              });
            } catch (e: any) {
              setError(e?.message || "Failed to reconnect to Blender");
              addToolResult?.({
                toolCallId: toolInvocation.toolCallId,
                result: {
                  error: e?.message || "Failed to reconnect to Blender",
                },
              });
            } finally {
              setExecuting(false);
            }
          }}
        >
          {executing ? "Reconnecting..." : "Reconnect Blender"}
        </button>
      </div>
    </div>
  );
}
