"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

const faqs = [
  {
    question: "Which Lightfast plan is right for me?",
    answer: "If you're just getting started with AI agents or building personal projects, the Hobby plan is perfect. For production applications with team collaboration needs, choose Pro. Enterprise is ideal for organizations requiring advanced security, compliance, and dedicated support."
  },
  {
    question: "Can I change plans at any time?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll have immediate access to new features. When downgrading, changes take effect at the next billing cycle."
  },
  {
    question: "How does usage-based pricing work?",
    answer: "Beyond the included limits in each plan, you only pay for what you use. We track agent executions, compute time, and data transfer. You can set spending limits to avoid unexpected charges."
  },
  {
    question: "Do you offer custom pricing for startups?",
    answer: "Yes, we offer special pricing for qualified startups through our startup program. This includes credits, extended limits, and access to Pro features."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, ACH transfers for Enterprise customers, and can arrange custom invoicing for annual contracts."
  },
  {
    question: "Is there a free trial for Pro features?",
    answer: "Yes! Pro plans include a 14-day free trial with full access to all features. No credit card required to start."
  },
  {
    question: "How do team seats work?",
    answer: "Pro plans include 5 team seats. Additional seats are $10/month each. Enterprise plans include custom team configurations."
  },
  {
    question: "What happens if I exceed my plan limits?",
    answer: "We'll notify you when you're approaching limits. You can either upgrade your plan or pay for additional usage at our standard overage rates."
  },
];

export function PricingFAQ() {
  return (
    <section className="px-6 lg:px-8 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about our pricing
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-16 text-center p-8 border rounded-lg bg-muted/30">
          <h3 className="text-xl font-semibold mb-2">
            Still have questions?
          </h3>
          <p className="text-muted-foreground mb-6">
            Our team is here to help you find the right solution.
          </p>
          <div className="flex gap-4 justify-center">
            <a 
              href="mailto:sales@lightfast.ai" 
              className="text-primary hover:underline"
            >
              sales@lightfast.ai
            </a>
            <span className="text-muted-foreground">or</span>
            <a 
              href="/contact" 
              className="text-primary hover:underline"
            >
              Schedule a call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}