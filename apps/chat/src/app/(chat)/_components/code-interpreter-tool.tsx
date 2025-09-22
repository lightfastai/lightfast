"use client";

import {
  Tool,
  ToolHeader,
  ToolHeaderMain,
  ToolIcon,
  ToolTitle,
} from "@repo/ui/components/ai-elements/tool";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { AlertCircle, Code2, Loader2 } from "lucide-react";
import { memo } from "react";
import type { CodeInterpreterToolUIPart } from "@repo/chat-ai-types";
import { formatToolErrorPayload } from "./tool-error-utils";

const DEFAULT_ERROR_MESSAGE =
  "We couldn't run the sandbox execution. Please try again.";

interface CodeInterpreterToolProps {
  toolPart: CodeInterpreterToolUIPart;
}

export const CodeInterpreterTool = memo(function CodeInterpreterTool({
  toolPart,
}: CodeInterpreterToolProps) {
  const input = toolPart.input as
    | { task?: string; context?: string; preferredRuntime?: string }
    | undefined;
  const taskPreview = input?.task;
  const runtimePreview = input?.preferredRuntime;

  switch (toolPart.state) {
    case "input-streaming":
    case "input-available": {
      const isPreparing = toolPart.state === "input-streaming";
      const label = isPreparing
        ? "Preparing sandbox run"
        : "Sandbox execution in progress";
      return (
        <Tool className="my-6">
          <ToolHeader>
            <ToolIcon>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </ToolIcon>
            <ToolHeaderMain>
              <ToolTitle className="text-xs">{label}</ToolTitle>
              {taskPreview ? (
                <p className="text-[10px] text-muted-foreground/80">
                  {taskPreview}
                </p>
              ) : null}
              {runtimePreview ? (
                <p className="text-[10px] text-muted-foreground/60">
                  runtime: {runtimePreview}
                </p>
              ) : null}
            </ToolHeaderMain>
          </ToolHeader>
        </Tool>
      );
    }
    case "output-error": {
      const { formattedError, isStructured } = formatToolErrorPayload(
        toolPart.errorText,
        DEFAULT_ERROR_MESSAGE,
      );

      return (
        <div className="my-6 w-full rounded-lg border">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="code-interpreter-error">
              <AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
                <div className="flex flex-1 items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium text-destructive">
                      Sandbox run failed
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3 pt-3">
                  {isStructured ? (
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-2xs leading-relaxed text-muted-foreground">
                      {formattedError}
                    </pre>
                  ) : (
                    <p className="text-2xs text-muted-foreground">
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
    case "output-available": {
      const output = toolPart.output;
      const stdout = output?.stdout ?? "";
      const stderr = output?.stderr ?? "";
      const exitCode = output?.exitCode ?? 0;
      const executionMs = output?.executionMs ?? 0;
      const code = output?.code ?? "";

      const stdoutContent = stdout.trim().length > 0 ? stdout : null;
      const stderrContent = stderr.trim().length > 0 ? stderr : null;

      return (
        <div className="my-6 w-full overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/20">
                <Code2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">
                  Sandbox execution complete
                </span>
                <span className="text-[10px] text-muted-foreground">
                  exit code {exitCode} • {executionMs} ms
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-4">
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Generated code
              </h4>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {code}
              </pre>
            </section>
            {stdoutContent ? (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Standard output
                </h4>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {stdoutContent}
                </pre>
              </section>
            ) : null}
            {stderrContent ? (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Standard error
                </h4>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {stderrContent}
                </pre>
              </section>
            ) : null}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
});
