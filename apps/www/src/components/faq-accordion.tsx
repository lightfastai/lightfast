"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

interface Faq {
  question: string;
  answer: string;
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      defaultValue={faqs[0]?.question}
    >
      {faqs.map((faq) => (
        <AccordionItem
          key={faq.question}
          value={faq.question}
          className="border-b border-border last:border-b-0"
        >
          <AccordionTrigger
            className={cn(
              "flex justify-between items-center w-full py-6 text-left",
              "hover:no-underline group",
            )}
          >
            <span className="text-base font-medium text-foreground pr-4">
              {faq.question}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 pr-12">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {faq.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
