"use client";

import type {
  ContentsToolUIPart,
  FindSimilarToolUIPart,
  SearchToolUIPart,
} from "@repo/console-ai-types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";
import type { ToolUIPart } from "ai";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { formatToolErrorPayload } from "./answer-tool-error-utils";
import {
  ContentsToolResult,
  FindSimilarToolResult,
  SearchToolResult,
} from "./answer-tool-results";

interface ToolCallRendererProps {
  className?: string;
  toolName: string;
  toolPart: ToolUIPart;
}

function getInputPreview(
  input: Record<string, unknown> | undefined
): string | undefined {
  if (!input) {
    return undefined;
  }
  const firstArg = Object.values(input)[0];
  if (typeof firstArg === "string") {
    return firstArg;
  }
  if (firstArg !== undefined) {
    return JSON.stringify(firstArg);
  }
  return undefined;
}

const TOOL_NAMES = {
  workspaceSearch: "workspace search",
  workspaceContents: "workspace contents",
  workspaceFindSimilar: "find similar",
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
      <div className={cn("w-full rounded-lg border", className)}>
        <div className="w-full px-4 py-3 transition-colors hover:bg-muted/50">
          <div className="flex flex-1 items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <div className="flex-1 text-left">
              <div className="font-medium text-muted-foreground text-xs lowercase">
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
      "The tool failed to complete. Please try again."
    );

    const input = ("input" in toolPart ? toolPart.input : undefined) as
      | Record<string, unknown>
      | undefined;
    const inputPreview = getInputPreview(input);
    const errorLabel = `${displayName} failed`;

    return (
      <div className={cn("w-full rounded-lg border", className)}>
        <Accordion className="w-full" collapsible type="single">
          <AccordionItem value={`tool-error-${toolName}`}>
            <AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
              <div className="flex flex-1 items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-destructive text-sm">
                    {errorLabel}
                  </div>
                  {inputPreview && (
                    <div className="mt-1 truncate text-muted-foreground/70 text-xs">
                      {inputPreview}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="pt-3 pb-4">
                {isStructured ? (
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[10px] text-muted-foreground leading-relaxed">
                    {formattedError}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">
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
          (toolPart as SearchToolUIPart & { state: "output-available" }).output
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
  const output = (toolPart as ToolUIPart & { state: "output-available" })
    .output;
  const jsonStr =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);

  return (
    <div className={cn("w-full rounded-lg border", className)}>
      <Accordion className="w-full" collapsible type="single">
        <AccordionItem value={`tool-output-${toolName}`}>
          <AccordionTrigger className="px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-left">
                <div className="font-medium text-muted-foreground text-xs lowercase">
                  {displayName}
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="pt-3 pb-4">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-[10px] text-muted-foreground leading-relaxed">
                {jsonStr}
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
