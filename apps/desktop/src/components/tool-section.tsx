import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

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

interface ToolSectionProps {
  part: ToolInvocation;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}

export function ToolSection({ part, addToolResult }: ToolSectionProps) {
  const { toolInvocation } = part;
  if (toolInvocation.state === "call") {
    return <ToolInvocationRequest part={part} addToolResult={addToolResult} />;
  }
  return <ToolInvocationResult part={part} />;
}

function ToolInvocationRequest({
  part,
  addToolResult,
}: {
  part: ToolInvocation;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
}) {
  const { toolInvocation } = part;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = toolInvocation.args?.code || "";

  const handleExecuteBlenderCode = async () => {
    setPending(true);
    setError(null);
    try {
      // Check if this is a Blender code execution tool
      if (toolInvocation.toolName === "executeBlenderCode" && code) {
        // Execute the code using the Electron API
        const result = await window.electronAPI.invoke(
          "handle-blender-execute-code",
          {
            code,
          },
        );

        if (result.error) {
          throw new Error(result.error);
        }

        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: true,
            output: result.output || "Code executed successfully",
            message: "Blender code executed successfully",
          },
        });
      } else if (toolInvocation.toolName === "reconnectBlender") {
        // Handle reconnect Blender tool
        if (!window.blenderConnection) {
          throw new Error("Blender connection API not available");
        }

        const status = await window.blenderConnection.getStatus();

        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: true,
            status,
            message: `Blender connection status: ${status.status}`,
          },
        });
      } else {
        // For other tools, use the default "manual" execution
        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            type: "manual-tool-invocation",
            result: {
              success: true,
              message: "Accepted and executed.",
            },
          },
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to execute tool");

      // Add error result to the tool call
      addToolResult({
        toolCallId: toolInvocation.toolCallId,
        result: {
          success: false,
          error: e?.message || "Failed to execute tool",
        },
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-muted/20 border-border my-2 flex flex-col gap-2 rounded border p-4">
      <div className="mb-1 text-xs font-semibold">
        Tool Request: {toolInvocation.toolName}
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
              onClick={handleExecuteBlenderCode}
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
                  toolCallId: toolInvocation.toolCallId,
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

  // Tool-specific renderers
  function renderResult() {
    switch (toolInvocation.toolName) {
      case "webSearch":
        if (result?.results && Array.isArray(result.results)) {
          return <WebSearchResults results={result.results} />;
        }
        break;
      case "searchPolyHaven":
        if (result?.results && Array.isArray(result.results)) {
          return <PolyHavenResults results={result.results} />;
        }
        break;
      case "downloadPolyHavenAsset":
        return <PolyHavenAssetResult asset={result} />;
      case "searchAmbientCG":
        if (result?.results && Array.isArray(result.results)) {
          return <AmbientCGResults results={result.results} />;
        }
        break;
      case "downloadAmbientCGTexture":
        return <AmbientCGAssetResult asset={result} />;
      default:
        // Fallback: pretty-print JSON
        if (result) {
          return (
            <pre className="bg-background mb-2 overflow-x-auto rounded border p-2 text-xs whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          );
        }
    }
    return null;
  }

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
      {renderResult()}
    </div>
  );
}

// Tool-specific result renderers
function WebSearchResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className="rounded border p-2">
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            className="font-semibold underline"
          >
            {r.title}
          </a>
          {r.content && (
            <div className="text-muted-foreground text-xs">{r.content}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PolyHavenResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className="rounded border p-2">
          <div className="font-semibold">{r.name || r.id}</div>
          {r.preview && (
            <img
              src={r.preview}
              alt={r.name}
              className="my-2 max-h-24 rounded"
            />
          )}
          {r.description && (
            <div className="text-muted-foreground text-xs">{r.description}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PolyHavenAssetResult({ asset }: { asset: any }) {
  if (!asset) return null;
  return (
    <div>
      <div className="font-semibold">{asset.name}</div>
      {asset.preview && (
        <img
          src={asset.preview}
          alt={asset.name}
          className="my-2 max-h-32 rounded"
        />
      )}
      {asset.description && (
        <div className="text-muted-foreground mb-2 text-xs">
          {asset.description}
        </div>
      )}
      {asset.downloads && (
        <div className="text-xs">
          <span className="font-semibold">Downloads:</span>
          <ul className="ml-4 list-disc">
            {Object.entries(asset.downloads).map(([k, v]: [string, any]) => (
              <li key={k}>
                <a
                  href={v.url}
                  className="underline"
                  target="_blank"
                  rel="noopener"
                >
                  {k}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AmbientCGResults({ results }: { results: any[] }) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => (
        <li key={i} className="rounded border p-2">
          <div className="font-semibold">{r.name || r.id}</div>
          {r.preview && (
            <img
              src={r.preview}
              alt={r.name}
              className="my-2 max-h-24 rounded"
            />
          )}
          {r.description && (
            <div className="text-muted-foreground text-xs">{r.description}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AmbientCGAssetResult({ asset }: { asset: any }) {
  if (!asset) return null;
  return (
    <div>
      <div className="font-semibold">{asset.name}</div>
      {asset.preview && (
        <img
          src={asset.preview}
          alt={asset.name}
          className="my-2 max-h-32 rounded"
        />
      )}
      {asset.description && (
        <div className="text-muted-foreground mb-2 text-xs">
          {asset.description}
        </div>
      )}
      {asset.downloads && (
        <div className="text-xs">
          <span className="font-semibold">Downloads:</span>
          <ul className="ml-4 list-disc">
            {Object.entries(asset.downloads).map(([k, v]: [string, any]) => (
              <li key={k}>
                <a
                  href={v.url}
                  className="underline"
                  target="_blank"
                  rel="noopener"
                >
                  {k}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
