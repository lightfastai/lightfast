import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";
import { JsonLd, type SoftwareApplication, type WithContext } from "@vendor/seo/json-ld";
import { siteConfig } from "@repo/site-config";
import { exposureTrial } from "~/lib/fonts";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { getAllPlanPricing } from "@repo/console-billing/pricing";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import Link from "next/link";

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

export const metadata: Metadata = createMetadata({
  title: "Pricing - AI Workflow Automation Platform",
  description:
    "Pricing starts free with 5 integrations and 100 workflow runs per month. Scale with Pro ($29/mo) or Team ($99/mo). Open-source and self-hostable.",
  openGraph: {
    title: "Pricing - AI Workflow Automation Platform",
    description:
      "Simple, transparent pricing for AI workflow automation. Start free with 5 integrations. Scale with Pro or Team plans.",
    url: "https://lightfast.ai/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - AI Workflow Automation Platform",
    description:
      "Simple, transparent pricing for AI workflow automation. Start free with 5 integrations. Scale with Pro or Team plans.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/pricing",
  },
});

export default function PricingPage() {
  const softwareSchema: WithContext<SoftwareApplication> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    applicationCategory: "DeveloperApplication",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Get started with AI workflow automation",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "29",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Scale your workflows with unlimited integrations",
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Collaborate and build together",
      },
    ],
    isAccessibleForFree: true,
    license: "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
  };

  return (
    <>
      <JsonLd code={softwareSchema} />
      <div className="mt-10 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section */}
        <section className="relative">
          <div className="max-w-7xl mx-auto grid grid-cols-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
              <div className="flex w-full flex-col items-center text-center">
                {/* Small label */}
                <div className="mb-8 opacity-80">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Simple & Transparent
                  </p>
                </div>

                {/* Heading */}
                <h1
                  className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
                >
                  Pricing
                </h1>

                {/* Description */}
                <div className="mt-8 px-4">
                  <p className="text-base text-muted-foreground">
                    Simple, transparent pricing for AI workflow automation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Pricing Section */}
        <div className="max-w-7xl px-4 mx-auto w-full py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {getAllPlanPricing().map((plan, _index) => (
              <div
                key={plan.plan}
                className="flex flex-col border border-border rounded-sm p-6 h-full"
              >
                <div className="space-y-1">
                  <h3 className="text-md font-bold text-foreground">{plan.name}</h3>
                  <p className="text-md text-muted-foreground">{plan.description}</p>
                </div>

                <div className="space-y-3 mt-6 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-12">
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">/ {plan.interval}</span>
                    </div>

                    <div className="flex justify-start">
                      <Button variant="default" className="rounded-full">
                        {plan.buttonText}
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-7xl mx-auto w-full px-4 py-10">
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
        </div>
      </div>
    </>
  );
}
