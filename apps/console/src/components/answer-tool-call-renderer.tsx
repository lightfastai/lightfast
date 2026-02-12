"use client";

import type { ToolUIPart } from "ai";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type {
  SearchToolUIPart,
  ContentsToolUIPart,
  FindSimilarToolUIPart,
} from "@repo/console-ai-types";
import {
  SearchToolResult,
  ContentsToolResult,
  FindSimilarToolResult,
} from "./answer-tool-results";
import { formatToolErrorPayload } from "./answer-tool-error-utils";

interface ToolCallRendererProps {
  toolPart: ToolUIPart;
  toolName: string;
  className?: string;
}

function getInputPreview(
  input: Record<string, unknown> | undefined,
): string | undefined {
  if (!input) return undefined;
  const firstArg = Object.values(input)[0];
  if (typeof firstArg === "string") return firstArg;
  if (firstArg !== undefined) return JSON.stringify(firstArg);
  return undefined;
}

const TOOL_NAMES = {
  workspaceSearch: "workspace search",
  workspaceContents: "workspace contents",
  workspaceFindSimilar: "find similar",
  workspaceGraph: "graph",
  workspaceRelated: "related",
};

export function ToolCallRenderer({
  toolPart,
  toolName,
  className,
}: ToolCallRendererProps) {
  const displayName =
    (TOOL_NAMES as Record<string, string>)[toolName] ?? toolName;

  // Handle loading states (input-streaming, input-available)
  if (
    toolPart.state === "input-streaming" ||
    toolPart.state === "input-available"
  ) {
    const input = ("input" in toolPart ? toolPart.input : undefined) as
      | Record<string, unknown>
      | undefined;
    const inputPreview = getInputPreview(input);
    const isStreaming = toolPart.state === "input-streaming";

    return (
      <div className={cn("border rounded-lg w-full", className)}>
        <div className="py-3 px-4 hover:bg-muted/50 transition-colors w-full">
          <div className="flex items-center gap-2 flex-1">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <div className="text-left flex-1">
              <div className="font-medium text-xs lowercase text-muted-foreground">
                {isStreaming ? "Preparing" : "Running"} {displayName}
                {inputPreview ? `: ${inputPreview}` : "..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle errors
  if (toolPart.state === "output-error") {
    const { formattedError, isStructured } = formatToolErrorPayload(
      toolPart.errorText,
      "The tool failed to complete. Please try again.",
    );

    const input = ("input" in toolPart ? toolPart.input : undefined) as
      | Record<string, unknown>
      | undefined;
    const inputPreview = getInputPreview(input);
    const errorLabel = `${displayName} failed`;

    return (
      <div className={cn("border rounded-lg w-full", className)}>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value={`tool-error-${toolName}`}>
            <AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
              <div className="flex items-center gap-2 flex-1">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm text-destructive">
                    {errorLabel}
                  </div>
                  {inputPreview && (
                    <div className="text-xs text-muted-foreground/70 mt-1 truncate">
                      {inputPreview}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="pt-3 pb-4">
                {isStructured ? (
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
                    {formattedError}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formattedError}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Handle output-available (final state after error checks)
  if (toolName === "workspaceSearch") {
    return (
      <SearchToolResult
        data={
          (toolPart as SearchToolUIPart & { state: "output-available" })
            .output
        }
      />
    );
  }

  if (toolName === "workspaceContents") {
    return (
      <ContentsToolResult
        data={
          (toolPart as ContentsToolUIPart & { state: "output-available" })
            .output
        }
      />
    );
  }

  if (toolName === "workspaceFindSimilar") {
    return (
      <FindSimilarToolResult
        data={
          (toolPart as FindSimilarToolUIPart & { state: "output-available" })
            .output
        }
      />
    );
  }

  // JSON fallback for other tools
  const output = (toolPart as ToolUIPart & { state: "output-available" }).output;
  const jsonStr =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);

  return (
    <div className={cn("border rounded-lg w-full", className)}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={`tool-output-${toolName}`}>
          <AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <div className="text-left flex-1">
                <div className="font-medium text-xs lowercase text-muted-foreground">
                  {displayName}
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="pt-3 pb-4">
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                {jsonStr}
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
