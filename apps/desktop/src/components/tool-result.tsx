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
