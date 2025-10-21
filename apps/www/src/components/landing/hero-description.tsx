"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

const accordionItems = [
  {
    id: "item-1",
    trigger: "Universal Integration",
    content:
      "Connect AI to any tool via natural language. Automate complex workflows without code. From GitHub to APIs, databases to CLIs—make every tool AI-orchestrable.",
  },
  {
    id: "item-2",
    trigger: "AI-Native Workflows",
    content:
      "AI-native workflows that understand intent, not just trigger-action. Describe what you want, we figure out how. Context-aware orchestration that learns from production.",
  },
  {
    id: "item-3",
    trigger: "Secure Execution",
    content:
      "Sandboxed execution environments with scoped credentials and audit logs. Human-in-the-loop for critical actions. Security by design, not as an afterthought.",
  },
  {
    id: "item-4",
    trigger: "Ship Faster",
    content:
      "Ship products faster. Focus on building, not configuring integrations. Built for dev founders who need to move fast without sacrificing reliability.",
  },
];

export function HeroDescription() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {accordionItems.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-foreground font-semibold">
            {item.trigger}
          </AccordionTrigger>
          <AccordionContent className="text-foreground/80">
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
