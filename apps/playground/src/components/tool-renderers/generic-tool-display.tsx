"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ToolUIPart } from "ai";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/components/ui/accordion";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollBar } from "@repo/ui/components/ui/scroll-area";

export interface GenericToolDisplayProps {
  toolPart: ToolUIPart;
  toolName: string;
}

export const GenericToolDisplay = memo(function GenericToolDisplay({ toolPart, toolName }: GenericToolDisplayProps) {
  const state = toolPart.state;
  const error = toolPart.state === "output-error" ? toolPart.errorText : undefined;
  const accordionValue = `tool-${toolName}-${toolPart.toolCallId}`;
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const handleCopy = async (text: string, type: "input" | "output") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "input") {
        setCopiedInput(true);
        setTimeout(() => setCopiedInput(false), 2000);
      } else {
        setCopiedOutput(true);
        setTimeout(() => setCopiedOutput(false), 2000);
      }
    } catch (_err) {
      // Silent fail for copy
    }
  };

  // Check if this is a screenshot tool result
  const isScreenshotTool = toolName === "stagehandScreenshot" && state === "output-available" && "output" in toolPart && toolPart.output;
  const screenshotOutput = isScreenshotTool ? toolPart.output as { screenshot?: string; url?: string; filename?: string } : null;
  const screenshotUrl = screenshotOutput ? (screenshotOutput.screenshot || screenshotOutput.url) : null;

  // Custom display for browser tools with screenshots
  if (isScreenshotTool && screenshotUrl) {
    return (
        <div className="my-6 border rounded-lg w-full">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={accordionValue}>
              <AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-left flex-1">
                    <div className="font-medium text-xs text-muted-foreground">Screenshot taken</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="pt-3">
                  <img 
                    src={screenshotUrl} 
                    alt="Browser screenshot" 
                    className="max-w-full rounded-lg border border-border/50"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
      </div>
    );
  }

  // For all non-output states, show a non-expandable view with loading
  if (state !== "output-available" && state !== "output-error") {
    return (
      <div className="my-6 border rounded-lg w-full cursor-not-allowed">
        <div className="py-3 px-4 flex items-center gap-2">
          <div className="text-left flex-1">
            <div className="font-medium text-xs text-muted-foreground">{toolName}: Processing...</div>
          </div>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Handle error state
  if (state === "output-error") {
    return (
      <div className="my-6 border rounded-lg w-full">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value={accordionValue}>
            <AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
              <div className="flex items-center gap-2 flex-1">
                <div className="text-left flex-1">
                  <div className="font-medium text-xs text-muted-foreground">{toolName}</div>
                </div>
                <AlertCircle className="h-3 w-3 text-destructive" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-xs">{error || "An error occurred"}</p>
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Main accordion view for output-available state
  return (
    <div className="my-6 border rounded-lg w-full">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={accordionValue}>
          <AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
            <div className="flex items-center gap-2 flex-1">
              <div className="text-left flex-1">
                <div className="font-medium text-xs text-muted-foreground">{toolName}</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {/* Input section */}
            {"input" in toolPart &&
              toolPart.input !== undefined &&
              toolPart.input !== null &&
              typeof toolPart.input === "object" && (
                <div className="pt-3">
                  <div className="bg-muted/50 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 pb-0">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center">Input</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleCopy(JSON.stringify(toolPart.input as Record<string, unknown>, null, 2), "input")
                        }
                      >
                        {copiedInput ? (
                          <Check className="h-2 w-2 text-muted-foreground" />
                        ) : (
                          <Copy className="h-2 w-2 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <ScrollAreaPrimitive.Root className="relative max-h-[300px] w-full">
                      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
                        <pre className="text-xs font-mono whitespace-pre overflow-auto p-3 pt-1">
                          {JSON.stringify(toolPart.input as Record<string, unknown>, null, 2)}
                        </pre>
                      </ScrollAreaPrimitive.Viewport>
                      <ScrollBar orientation="vertical" />
                      <ScrollBar orientation="horizontal" />
                      <ScrollAreaPrimitive.Corner />
                    </ScrollAreaPrimitive.Root>
                  </div>
                </div>
              )}

            {/* Output section */}
            {state === "output-available" &&
              toolPart.output !== undefined &&
              toolPart.output !== null &&
              typeof toolPart.output === "object" && (
                <div className="pt-3">
                  <div className="bg-muted/50 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 pb-0">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center">Output</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleCopy(
                            typeof toolPart.output === "string"
                              ? toolPart.output
                              : JSON.stringify(toolPart.output as Record<string, unknown>, null, 2),
                            "output",
                          )
                        }
                      >
                        {copiedOutput ? (
                          <Check className="h-2 w-2 text-muted-foreground" />
                        ) : (
                          <Copy className="h-2 w-2 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <ScrollAreaPrimitive.Root className="relative max-h-[300px] w-full">
                      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
                        <pre className="text-xs font-mono whitespace-pre overflow-auto p-3 pt-1">
                          {typeof toolPart.output === "string"
                            ? toolPart.output
                            : JSON.stringify(toolPart.output as Record<string, unknown>, null, 2)}
                        </pre>
                      </ScrollAreaPrimitive.Viewport>
                      <ScrollBar orientation="vertical" />
                      <ScrollBar orientation="horizontal" />
                      <ScrollAreaPrimitive.Corner />
                    </ScrollAreaPrimitive.Root>
                  </div>
                </div>
              )}

            {/* Loading state */}
            {state !== "output-available" && !("output" in toolPart) && (
              <div className="pt-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing {toolName}...</span>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
});