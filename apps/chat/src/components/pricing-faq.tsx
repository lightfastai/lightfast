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
    question: "What's included in Lightfast Chat?",
    answer: "Lightfast Chat includes unlimited conversations, access to all the latest AI models (with usage limits), real-time collaboration features, priority support, and enterprise-grade security."
  },
  {
    question: "Which AI models are available?",
    answer: "You get access to all the latest models including GPT-4, Claude 3, Gemini Pro, and more. We continuously add new models as they become available. Usage limits apply based on model costs."
  },
  {
    question: "How does the $8/month pricing work?",
    answer: "It's simple - $8 USD per user per month for Lightfast Chat. No hidden fees, no setup costs. Just straightforward monthly billing for each user in your team. This pricing is specifically for our hosted Lightfast Chat service."
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your current billing period."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards and debit cards. For enterprise customers, we can arrange custom invoicing."
  },
  {
    question: "Can I try Lightfast Chat for free?",
    answer: "Yes! You can use the chat app for free with rate limits applied. This lets you experience the product before upgrading to the paid plan for unlimited usage."
  },
  {
    question: "Is Lightfast Chat open-source?",
    answer: (
      <>
        Yes! Lightfast Chat is fully open-source. We believe in transparency and encourage users to own their infrastructure. 
        You can self-host the entire application on your own servers for complete control over your data and infrastructure. 
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
    answer: "Teams can share conversations, collaborate in real-time, and maintain shared knowledge bases. Each team member needs their own subscription."
  },
  {
    question: "Is my data secure and private?",
    answer: "Absolutely. We use enterprise-grade encryption, never train on your data, and comply with SOC 2 and GDPR standards. Your conversations remain private and secure."
  },
];

export function PricingFAQ() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Top row - heading on left */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">
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
              <AccordionTrigger className="text-left">
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