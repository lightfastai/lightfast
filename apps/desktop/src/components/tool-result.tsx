import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

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

  // Special handling for different result types
  function renderSpecializedResult() {
    if (!result) return null;

    // Handle specific tool types if needed
    switch (toolName) {
      case "webSearch":
        if (result.results && Array.isArray(result.results)) {
          return (
            <div className="space-y-2">
              {result.results.map((item: SearchResultItem, i: number) => (
                <div key={i} className="rounded border p-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium underline"
                  >
                    {item.title}
                  </a>
                  {item.content && (
                    <p className="mt-1 text-xs">{item.content}</p>
                  )}
                </div>
              ))}
            </div>
          );
        }
        break;

      case "executeBlenderCode":
        return (
          <div>
            {result.output && (
              <div className="text-xs">
                <div className="mb-1 font-medium">Output:</div>
                <pre className="bg-muted overflow-auto rounded p-2">
                  {result.output}
                </pre>
              </div>
            )}
          </div>
        );

      case "getBlenderSceneInfo":
        if (result.scene_info) {
          return (
            <div className="space-y-2 text-xs">
              <div className="rounded border p-2">
                <div className="mb-1 font-medium">
                  Scene: {result.scene_info.name}
                </div>
                <div>Objects: {result.scene_info.object_count}</div>
                <div>Materials: {result.scene_info.materials_count}</div>
              </div>

              {result.scene_info.objects && (
                <details>
                  <summary className="cursor-pointer">
                    Objects ({result.scene_info.objects.length})
                  </summary>
                  <ul className="mt-1 list-disc pl-4">
                    {result.scene_info.objects.map((obj: any, i: number) => (
                      <li key={i}>
                        {obj.name} ({obj.type})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
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
      return <Mdx>{result}</Mdx>;
    } else {
      return (
        <pre className="bg-muted overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
    }
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <div className="bg-muted/20 border-border flex flex-col gap-1 rounded border p-2">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex w-full items-center justify-between pr-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[0.65rem] leading-tight font-medium whitespace-nowrap">
                Result:{" "}
                <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                  {toolName || "Unknown Tool"}
                </span>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="pt-1 pb-0">
            {error ? (
              <div className="p-2 text-xs text-red-500">Error: {error}</div>
            ) : (
              renderSpecializedResult()
            )}
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
