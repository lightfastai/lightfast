"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

interface Faq {
  answer: string;
  question: string;
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion
      className="w-full"
      collapsible
      defaultValue={faqs[0]?.question}
      type="single"
    >
      {faqs.map((faq) => (
        <AccordionItem
          className="border-border border-b last:border-b-0"
          key={faq.question}
          value={faq.question}
        >
          <AccordionTrigger
            className={cn(
              "flex w-full items-center justify-between py-6 text-left",
              "group hover:no-underline"
            )}
          >
            <span className="pr-4 font-medium text-base text-foreground">
              {faq.question}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pr-12 pb-6">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {faq.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
