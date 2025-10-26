"use client";

import * as React from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

const faqs = [
  {
    question: "What's included in the platform?",
    answer: "Our AI-native workflow orchestration platform lets you connect any tool via natural language. Built for developers who want to ship products faster by automating complex workflows without traditional integration code."
  },
  {
    question: "How is this different from traditional automation tools?",
    answer: "Unlike trigger-action tools, we understand intent. You describe what you want to happen in natural language, and the platform figures out how to orchestrate your tools to make it happen. No predefined templates or manual configuration required."
  },
  {
    question: "What integrations are supported?",
    answer: "We support universal tool integration via natural language. This means you can connect to any API, database, or service without waiting for official integrations. If it has an API or CLI, it can work with our platform."
  },
  {
    question: "What are workflow runs?",
    answer: "A workflow run is a single execution of an automated workflow. For example, if you have a workflow that processes new GitHub issues, each time an issue is created and processed counts as one run."
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the change will take effect at the start of your next billing cycle."
  },
  {
    question: "Can I try it for free?",
    answer: "Yes! The Free plan includes 5 integrations and 100 workflow runs per month. This lets you experience the product and build real workflows before upgrading to a paid plan."
  },
  {
    question: "Is this open-source?",
    answer: (
      <>
        Yes! The platform is fully open-source. We believe in transparency and encourage developers to own their infrastructure.
        You can self-host the entire platform on your own servers for complete control over your data and workflows.
        Check out{" "}
        <Link href="https://github.com/lightfastai/lightfast" className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
          github.com/lightfastai/lightfast
        </Link>{" "}
        for the source code and deployment guides.
      </>
    )
  },
  {
    question: "How does team collaboration work?",
    answer: "On the Team plan, you can share workflows, collaborate in real-time, and maintain shared workspaces. Team members can view, edit, and run shared workflows with proper access controls and audit logging."
  },
];

export function PricingFAQ() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Top row - heading on left */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything you need to know about our pricing
        </p>
      </div>
      <div></div>

      {/* FAQ content spanning full width */}
      <div className="md:col-span-2 mt-8">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-foreground">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
