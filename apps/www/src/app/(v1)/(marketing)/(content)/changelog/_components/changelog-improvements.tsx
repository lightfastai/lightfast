"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

export function ChangelogImprovements({ items }: { items: string[] }) {
  return (
    <Accordion className="w-full" collapsible type="single">
      <AccordionItem
        className="border-border border-b last:border-b-0"
        value="improvements"
      >
        <AccordionTrigger
          className={cn(
            "flex w-full items-center justify-between py-6 text-left",
            "group hover:no-underline"
          )}
        >
          <span className="pr-4 font-medium text-base text-foreground">
            Improvements
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-6">
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                className="text-muted-foreground text-sm leading-relaxed"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
