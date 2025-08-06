"use client";

import type { ToolUIPart } from "ai";
import { Camera, ChevronDownIcon } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "@repo/ui/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

interface ScreenshotToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const ScreenshotTool = memo(function ScreenshotTool({ toolPart, className }: ScreenshotToolProps) {
  const [isOpen, setIsOpen] = useState<string[]>([]);
  const state = toolPart.state;
  
  // Extract screenshot URL if available
  const screenshotOutput = state === "output-available" && "output" in toolPart && toolPart.output 
    ? toolPart.output as { screenshot?: string; url?: string; filename?: string } 
    : null;
  const screenshotUrl = screenshotOutput ? (screenshotOutput.screenshot || screenshotOutput.url) : null;

  // If we have a screenshot, show it in an accordion
  if (screenshotUrl) {
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
                <span className="text-muted-foreground">Screenshot taken</span>
                <ChevronDownIcon className="h-3 w-3 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionContent className="pl-5 pt-2">
              <div className="rounded-lg overflow-hidden border border-border/50">
                <img 
                  src={screenshotUrl} 
                  alt="Browser screenshot" 
                  className="w-full"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Show loading/processing state
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Camera className="h-4 w-4" />
      <span>Taking screenshot...</span>
    </div>
  );
});