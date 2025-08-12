"use client";

import { cn } from "@repo/ui/lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "@repo/ui/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { ThinkingAnimation } from "./thinking-animation";

interface ThinkingAccordionProps {
  status: "thinking" | "streaming" | "reasoning" | "done";
  reasoningText?: string;
  className?: string;
}

export function ThinkingAccordion({ status, reasoningText, className }: ThinkingAccordionProps) {
  const [isOpen, setIsOpen] = useState<string[]>([]);
  
  // Don't show if done and no reasoning text
  if (status === "done" && !reasoningText) return null;
  
  // Show simple thinking indicator when just thinking (no reasoning yet)
  if (status === "thinking" && !reasoningText) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
        <ThinkingAnimation size="sm" />
        <span className="text-xs text-muted-foreground">Thinking</span>
      </div>
    );
  }
  
  
  // If we have reasoning text, show the accordion
  if (reasoningText) {
    // Calculate duration for display
    const wordCount = reasoningText.split(/\s+/).length;
    const duration = Math.min(Math.max(wordCount / 5, 2), 10); // 2-10 seconds based on word count
    
    return (
      <div className={cn("w-full", className)}>
        <Accordion 
          type="multiple" 
          value={isOpen}
          onValueChange={setIsOpen}
          className=""
        >
          <AccordionItem value="reasoning" className="border-0">
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger 
                className="flex items-center gap-1.5 p-0 text-xs focus:outline-none"
              >
                <ThinkingAnimation size="sm" />
                <span className="text-muted-foreground">
                  {status === "reasoning" ? "Reasoning" : `Thought for ${duration}s`}
                </span>
                <ChevronDownIcon className="h-3 w-3 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionContent className="pl-4 pt-2">
              <div className="max-h-[300px] overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {reasoningText}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }
  
  // If reasoning status but no text yet, show reasoning indicator
  if (status === "reasoning" && !reasoningText) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
        <ThinkingAnimation size="sm" />
        <span className="text-xs text-muted-foreground">Reasoning</span>
      </div>
    );
  }
  
  return null;
}