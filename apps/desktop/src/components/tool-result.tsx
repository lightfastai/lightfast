import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { CodeBlock } from "./code-block";
import { Mdx } from "./mdx-components";

interface ToolInvocation {
  toolName?: string;
  toolCallId?: string;
  state: string;
  args?: Record<string, any>;
  result?: any;
  error?: string;
}

interface SearchResultItem {
  title: string;
  url: string;
  content?: string;
}

interface ToolResultProps {
  toolInvocation: ToolInvocation;
}

export function ToolResult({ toolInvocation }: ToolResultProps) {
  const { toolName, result, error } = toolInvocation;
  const code = toolInvocation.args?.code || "";

  // Check for errors in both places - top level and inside result
  const hasDirectError = !!error;
  const hasResultError =
    result &&
    ((typeof result === "object" && result.error) ||
      (typeof result === "object" && result.success === false));

  // Get the error message from wherever it exists
  const errorMessage =
    error ||
    (result && typeof result === "object" && result.error) ||
    (hasResultError ? "Tool execution failed" : null);

  // Special handling for different result types
  function renderSpecializedResult() {
    if (!result) return null;

    // If there's an error inside the result object but not a direct error property
    if (hasResultError && !hasDirectError) {
      return (
        <div
          className={cn("mt-1 p-2 text-[0.65rem] leading-tight text-red-600")}
        >
          Error: {result.error || "Tool execution failed"}
        </div>
      );
    }

    // Handle specific tool types if needed
    switch (toolName) {
      case "generateBlenderCode":
        // Handle both success and error states
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to generate Blender code"}
            </div>
          );
        }

        if (result.code) {
          return (
            <div className="p-2">
              <div className="mb-2 text-[0.65rem]">
                <div className="font-medium">Task:</div>
                <div className="text-muted-foreground">
                  {toolInvocation.args?.task || "No task specified"}
                </div>

                {toolInvocation.args?.scene_info && (
                  <details className="mt-1">
                    <summary className="cursor-pointer font-medium">
                      Scene Info
                    </summary>
                    <div className="text-muted-foreground mt-1">
                      {toolInvocation.args.scene_info.length > 200
                        ? `${toolInvocation.args.scene_info.slice(0, 200)}...`
                        : toolInvocation.args.scene_info}
                    </div>
                  </details>
                )}
              </div>

              <div className="mt-3">
                <div className="mb-1 text-[0.7rem] font-medium">
                  Generated Code:
                </div>
                <ScrollArea className="h-48 w-full">
                  <CodeBlock inline={false}>{result.code}</CodeBlock>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          );
        }
        break;

      case "webSearch":
        if (result.results && Array.isArray(result.results)) {
          return (
            <div className="space-y-2 p-2">
              {result.results.map((item: SearchResultItem, i: number) => (
                <div key={i} className={cn("rounded border p-2")}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn("text-xs font-medium underline")}
                  >
                    {item.title}
                  </a>
                  {item.content && (
                    <p className={cn("mt-1 text-xs")}>{item.content}</p>
                  )}
                </div>
              ))}
            </div>
          );
        }
        break;

      case "deepSceneAnalysis":
        // Handle deep scene analysis results
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to analyze Blender scene"}
            </div>
          );
        }

        if (result.analysis) {
          return (
            <div className="space-y-2 p-2 text-xs">
              <div className={cn("rounded border p-2")}>
                <div className={cn("mb-2 font-medium")}>
                  Deep Scene Analysis
                </div>
                <ScrollArea className="max-h-80 w-full">
                  <div className="whitespace-pre-wrap">
                    <Mdx>{result.analysis}</Mdx>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          );
        }
        break;

      case "analyzeBlenderModel":
        // Handle Blender model analysis results
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to analyze Blender model"}
            </div>
          );
        }

        if (result.analysis) {
          return (
            <div className="space-y-2 p-2 text-xs">
              {/* Show object stats summary */}
              {result.sceneStats && (
                <div className={cn("rounded border p-2")}>
                  <div className={cn("mb-1 font-medium")}>Model Statistics</div>
                  <div>Objects: {result.sceneStats.objectCount}</div>
                  {result.sceneStats.objectTypes && (
                    <details>
                      <summary className={cn("cursor-pointer text-xs")}>
                        Object Types
                      </summary>
                      <ul className="mt-1 list-disc pl-4">
                        {Object.entries(
                          result.sceneStats.objectTypes as Record<
                            string,
                            number
                          >,
                        ).map(([type, count], i) => (
                          <li key={i}>
                            {type}: {count}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Show the full analysis */}
              <div className={cn("rounded border p-2")}>
                <div className={cn("mb-2 font-medium")}>Analysis</div>
                <ScrollArea className="max-h-72 w-full">
                  <div className="whitespace-pre-wrap">{result.analysis}</div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          );
        }
        break;

      case "executeBlenderCode":
        // Handle both success and error states
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to execute Blender code"}
            </div>
          );
        }
        return (
          <div className="p-2">
            {result.output && (
              <div className="text-[0.65rem] leading-tight">
                <div className={cn("mb-1 font-medium")}>Output:</div>
                <ScrollArea className="max-h-48 w-full">
                  <pre className={cn("bg-muted rounded p-2")}>
                    {result.output}
                  </pre>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
          </div>
        );

      case "getBlenderSceneInfo":
        // Handle potential error state
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to get Blender scene info"}
            </div>
          );
        }

        if (result.scene_info) {
          return (
            <div className="space-y-2 p-2 text-xs">
              <div className={cn("rounded border p-2")}>
                <div className={cn("mb-1 font-medium")}>
                  Scene: {result.scene_info.name}
                </div>
                <div>Objects: {result.scene_info.object_count}</div>
                <div>Materials: {result.scene_info.materials_count}</div>
              </div>

              {result.scene_info.objects && (
                <details>
                  <summary className={cn("cursor-pointer")}>
                    Objects ({result.scene_info.objects.length})
                  </summary>
                  <ul className={cn("mt-1 list-disc pl-4")}>
                    {result.scene_info.objects.map((obj: any, i: number) => (
                      <li key={i}>
                        {obj.name} ({obj.type})
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Show full scene info data for debugging */}
              <details className="mt-4">
                <summary className={cn("cursor-pointer text-xs")}>
                  Raw Scene Info Data
                </summary>
                <ScrollArea className="mt-2 max-h-72 w-full overflow-auto rounded-md border">
                  <ScrollBar />
                  <CodeBlock inline={false}>
                    {JSON.stringify(result.scene_info, null, 2)}
                  </CodeBlock>
                </ScrollArea>
              </details>
            </div>
          );
        }
        break;

      case "getBlenderShaderState":
        // Handle potential error state
        if (result.success === false) {
          return (
            <div
              className={cn(
                "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
              )}
            >
              Error: {result.error || "Failed to get Blender shader state"}
            </div>
          );
        }

        if (result.shader_info) {
          return (
            <div className="space-y-2 p-2 text-xs">
              <div className={cn("rounded border p-2")}>
                <div className={cn("mb-1 font-medium")}>Shader Information</div>
                <div>Materials: {result.shader_info.materials_count}</div>
                <div>Node Groups: {result.shader_info.node_groups_count}</div>
              </div>

              {result.shader_info.materials && (
                <details>
                  <summary className={cn("cursor-pointer")}>
                    Materials ({result.shader_info.materials.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {result.shader_info.materials.map((mat: any, i: number) => (
                      <div key={i} className="rounded border p-2">
                        <div className="font-medium">{mat.name}</div>
                        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[0.65rem]">
                          <div>
                            Type: {mat.is_node_based ? "Node-based" : "Basic"}
                          </div>
                          <div>Users: {mat.users}</div>
                          {mat.diffuse_color && (
                            <div>
                              Diffuse: rgba({mat.diffuse_color.join(", ")})
                              <span
                                className="ml-1 inline-block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: `rgba(${mat.diffuse_color[0] * 255}, ${
                                    mat.diffuse_color[1] * 255
                                  }, ${mat.diffuse_color[2] * 255}, ${
                                    mat.diffuse_color[3] || 1
                                  })`,
                                }}
                              ></span>
                            </div>
                          )}
                          {mat.roughness !== undefined && (
                            <div>Roughness: {mat.roughness}</div>
                          )}
                          {mat.metallic !== undefined && (
                            <div>Metallic: {mat.metallic}</div>
                          )}
                          {mat.blend_method && (
                            <div>Blend: {mat.blend_method}</div>
                          )}
                        </div>

                        {mat.nodes && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[0.65rem]">
                              Nodes ({mat.nodes.length})
                            </summary>
                            <ul className="mt-1 list-disc pl-4 text-[0.65rem]">
                              {mat.nodes.map((node: any, j: number) => (
                                <li key={j}>
                                  {node.name} ({node.type})
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {mat.has_output_connection !== undefined && (
                          <div className="mt-1 text-[0.65rem]">
                            Output Connection:{" "}
                            <span
                              className={
                                mat.has_output_connection
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {mat.has_output_connection ? "Yes" : "No"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {result.shader_info.node_groups && (
                <details>
                  <summary className={cn("cursor-pointer")}>
                    Node Groups ({result.shader_info.node_groups.length})
                  </summary>
                  <ul className="mt-1 list-disc pl-4">
                    {result.shader_info.node_groups.map(
                      (group: any, i: number) => (
                        <li key={i}>
                          {group.name} ({group.type}) - {group.users} user(s)
                        </li>
                      ),
                    )}
                  </ul>
                </details>
              )}

              {/* Show full shader info data for debugging */}
              <details className="mt-4">
                <summary className={cn("cursor-pointer text-xs")}>
                  Raw Shader Info Data
                </summary>
                <ScrollArea className="mt-2 max-h-72 w-full overflow-auto rounded-md border">
                  <ScrollBar />
                  <CodeBlock inline={false}>
                    {JSON.stringify(result.shader_info, null, 2)}
                  </CodeBlock>
                </ScrollArea>
              </details>
            </div>
          );
        }
        break;

      default:
        // Default rendering happens below
        break;
    }

    // Default rendering for other tools or when specialized rendering fails
    if (typeof result === "string") {
      return (
        <div className="p-2">
          <Mdx>{result}</Mdx>
        </div>
      );
    } else {
      return (
        <div className="p-2">
          <ScrollArea className="max-h-72 w-full">
            <pre
              className={cn("bg-muted rounded p-2 text-xs whitespace-pre-wrap")}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      );
    }
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div
          className={cn(
            "bg-muted/20 border-border flex flex-col gap-1 rounded border",
          )}
        >
          <AccordionTrigger className="p-2 hover:no-underline">
            <div className="flex w-full items-center justify-between pr-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[0.65rem] leading-tight font-medium whitespace-nowrap">
                Result:{" "}
                <pre
                  className={cn(
                    "bg-muted-foreground/10 rounded-md border px-2 py-1 text-[0.65rem]",
                    hasDirectError || hasResultError
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  )}
                >
                  {toolName || "Unknown Tool"}
                </pre>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="border-t pb-0">
            {code && (
              <div className="p-2">
                <ScrollArea className="h-48 w-full">
                  <CodeBlock inline={false}>{code}</CodeBlock>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
            {error ? (
              <div
                className={cn(
                  "mt-1 p-2 text-[0.65rem] leading-tight text-red-600",
                )}
              >
                Error: {error}
              </div>
            ) : (
              renderSpecializedResult()
            )}
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
