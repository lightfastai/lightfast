import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";

import { CodeBlock } from "./code-block";

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
      } else if (toolInvocation.toolName === "getBlenderState") {
        // Handle get Blender state tool
        const result = await window.electronAPI.invoke(
          "handle-blender-get-state",
          {},
        );

        if (result.error) {
          throw new Error(result.error);
        }

        addToolResult({
          toolCallId: toolInvocation.toolCallId,
          result: {
            success: true,
            message: "Get Blender state request sent successfully",
            // The actual state data will be received asynchronously
            // and updated in the context/chat elsewhere.
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
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div className="bg-muted/20 border-border flex flex-col gap-1 rounded border p-2">
          <AccordionTrigger className="p-0 hover:no-underline">
            {/* Title Bar */}
            <div className="flex w-full items-center justify-between pr-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[0.65rem] leading-tight font-medium whitespace-nowrap">
                Request:{" "}
                <pre className="bg-muted-foreground/10 rounded-md border px-2 py-1 text-[0.65rem]">
                  {toolInvocation.toolName.trim()}
                </pre>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent accordion from toggling
                    handleExecuteBlenderCode();
                  }}
                >
                  <CheckIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent accordion from toggling
                    addToolResult?.({
                      toolCallId: toolInvocation.toolCallId,
                      result: { error: "User declined tool invocation" },
                    });
                  }}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            </div>
          </AccordionTrigger>

          {/* Collapsible Content: Code and related error */}
          {(code || error) && ( // Only render content if there's code or an error to show
            <AccordionContent className="pt-1 pb-0">
              {code && (
                <div className="mt-1 pt-1">
                  <CodeBlock inline={false}>{code}</CodeBlock>
                  {error && (
                    <div className="mt-1 text-[0.65rem] leading-tight text-red-600">
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Error when no code is present (e.g., tool call setup error), but still an error to display */}
              {!code && error && (
                <div className="mt-1 text-[0.65rem] leading-tight text-red-600">
                  {error}
                </div>
              )}
            </AccordionContent>
          )}
        </div>
      </AccordionItem>
    </Accordion>
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
