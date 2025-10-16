"use client";

import type { ToolUIPart } from "ai";
import { Camera, ChevronDownIcon, AlertCircle } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "@repo/ui/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import type { PlaygroundToolSet } from "~/types/playground-ui-messages";

interface ScreenshotToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const ScreenshotTool = memo(function ScreenshotTool({ toolPart, className }: ScreenshotToolProps) {
  const [isOpen, setIsOpen] = useState<string[]>([]);
  const state = toolPart.state;
  
  // Extract output with proper typing
  const output = state === "output-available" && "output" in toolPart && toolPart.output 
    ? toolPart.output as PlaygroundToolSet['stagehandScreenshot']['output']
    : null;
  
  // Check if this is an error
  const hasError = output?.success === false;
  const screenshotUrl = output && output.success !== false ? (output.screenshot ?? output.url) : null;

  // Show loading state for non-output states
  if (state !== "output-available") {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Camera className="h-4 w-4" />
        <span>Taking screenshot...</span>
      </div>
    );
  }

  // Main accordion view for both success and error states
  return (
    <div className={cn("w-full", className)}>
      <Accordion 
        type="multiple" 
        value={isOpen}
        onValueChange={setIsOpen}
        className=""
      >
        <AccordionItem value="screenshot" className="border-0">
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger 
              className="flex items-center gap-1.5 p-0 text-xs focus:outline-none"
            >
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {hasError ? "Screenshot failed" : "Screenshot taken"}
              </span>
              {hasError && <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto" />}
              <ChevronDownIcon className="h-3 w-3 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionContent className="pl-5 pt-2">
            {hasError ? (
              <div className="space-y-2">
                <div className="text-xs text-destructive font-medium">
                  {output.error || "Screenshot operation failed"}
                </div>
                {output && (
                  <div className="bg-muted/50 rounded p-2">
                    <pre className="text-xs font-mono overflow-auto">
                      <code>{JSON.stringify(output, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            ) : screenshotUrl ? (
              <div className="rounded-lg overflow-hidden border border-border/50">
                <img 
                  src={screenshotUrl} 
                  alt="Browser screenshot" 
                  className="w-full"
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
});