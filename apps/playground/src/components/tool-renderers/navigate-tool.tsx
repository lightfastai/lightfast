"use client";

import type { ToolUIPart } from "ai";
import { Globe, AlertCircle, ChevronDownIcon } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "@repo/ui/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import type { PlaygroundToolSet } from "~/types/playground-ui-messages";

interface NavigateToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const NavigateTool = memo(function NavigateTool({ toolPart, className }: NavigateToolProps) {
  const [isOpen, setIsOpen] = useState<string[]>([]);
  const state = toolPart.state;
  
  // Extract URL from input
  const url = toolPart.input && typeof toolPart.input === "object" && "url" in toolPart.input 
    ? (toolPart.input as { url: string }).url 
    : null;

  // Extract domain from URL with validation
  let domain: string | null = null;
  if (url) {
    try {
      const parsedUrl = new URL(url);
      domain = parsedUrl.hostname.replace("www.", "");
    } catch {
      // If URL parsing fails, use the raw URL or extract domain manually
      domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    }
  }
  
  // Check for errors in output
  const output = state === "output-available" && "output" in toolPart && toolPart.output
    ? toolPart.output as PlaygroundToolSet['stagehandNavigate']['output']
    : null;
  const hasError = output?.success === false;

  // For simple success cases without errors, show inline
  if (state === "output-available" && !hasError) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Globe className="h-4 w-4" />
        <span>Navigated to {domain ?? url ?? "site"}</span>
      </div>
    );
  }

  // For errors, show accordion
  if (hasError) {
    return (
      <div className={cn("w-full", className)}>
        <Accordion 
          type="multiple" 
          value={isOpen}
          onValueChange={setIsOpen}
          className=""
        >
          <AccordionItem value="navigate-error" className="border-0">
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger 
                className="flex items-center gap-1.5 p-0 text-xs focus:outline-none"
              >
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Navigate to {domain ?? url ?? "site"} failed
                </span>
                <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto" />
                <ChevronDownIcon className="h-3 w-3 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionContent className="pl-5 pt-2">
              <div className="space-y-2">
                <div className="text-xs text-destructive font-medium">
                  {output.message || "Navigation failed"}
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <pre className="text-xs font-mono overflow-auto">
                    <code>{JSON.stringify(output, null, 2)}</code>
                  </pre>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Loading state
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Globe className="h-4 w-4" />
      <span>Navigating to {domain ?? url ?? "site"}...</span>
    </div>
  );
});