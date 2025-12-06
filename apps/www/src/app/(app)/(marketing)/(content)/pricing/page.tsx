import type { Metadata } from "next";
import * as React from "react";
import { ArrowUpRight, ArrowRight, Check, HelpCircle } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import {
  JsonLd,
  type FAQPage,
  type SoftwareApplication,
  type WithContext,
} from "@vendor/seo/json-ld";
import { siteConfig } from "@repo/site-config";
import { exposureTrial } from "~/lib/fonts";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Lightfast Pricing – Team Memory That Scales",
  description:
    "Start with a free team memory plan for up to 3 users. Scale Lightfast neural memory across your organization with simple per-user pricing and generous search allowances.",
  openGraph: {
    title: "Lightfast Pricing – Team Memory That Scales",
    description:
      "Pricing for Lightfast neural memory built for teams. Start free and scale with simple per-user pricing, generous search allowances, and Neural Memory included.",
    url: "https://lightfast.ai/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Pricing",
    description:
      "Team memory for every size team. Start free, scale transparently. Neural Memory, semantic search, and unlimited sources available.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/pricing",
  },
});

// Feature explanations
const featureExplanations = {
  basicNeuralMemory:
    "Captures important decisions, changes, and highlights from your tools. Tracks who did what and when. Enables semantic search to find information by meaning, not just keywords.",

  advancedNeuralMemory:
    "Everything in Basic, plus: Daily/weekly auto-summaries of team activity, expertise profiles showing who knows what, full identity mapping across all platforms, and temporal tracking to see how things evolved over time.",

  actorExpertiseProfiles:
    "AI-generated profiles for each team member showing their expertise domains, contribution patterns, active hours, and collaboration networks. Know instantly who to ask about any topic.",

  semanticSearch:
    "AI-powered search that understands intent and meaning. Find 'authentication bugs' even if the exact words aren't used. Search by concepts, not keywords.",

  identityTracking:
    "Correlates the same person across different platforms using email matching. Links 'john@company.com' on GitHub with 'John Smith' on Linear automatically.",

  fullIdentityMapping:
    "Advanced identity correlation using OAuth connections, email matching, and name similarity. Manually map identities. 100% confidence when users connect accounts.",

  temporalStateTracking:
    "Track how entities evolve over time. Answer questions like 'What was the status last week?' or 'Show me deployments from Q3'. Full historical accuracy.",
};

interface FeatureTooltipProps {
  term: string;
  explanation: string;
}

function FeatureTooltip({ term, explanation }: FeatureTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help group">
          <span className="border-b border-dotted border-muted-foreground/50 group-hover:border-muted-foreground transition-colors">
            {term}
          </span>
          <HelpCircle className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs font-normal bg-background text-foreground border">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}

interface PricingPlan {
  plan: string;
  name: string;
  description: string;
  features: (string | React.ReactNode)[];
  addOns?: string[];
  monthlyPrice: number | string;
  interval: string;
  buttonText: string;
  highlighted?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    plan: "starter",
    name: "Starter",
    description: "Try Lightfast with your team",
    features: [
      "Up to 3 users",
      "2 sources included",
      "2,500 searches/month total",
      "14-day retention",
      "Basic keyword search",
      "REST API access",
      "Community support",
    ],
    monthlyPrice: 0,
    interval: "forever",
    buttonText: "Start Free",
  },
  {
    plan: "team",
    name: "Team",
    description: "Everything you need to scale",
    features: [
      "1,500 searches per user/month",
      "5 sources included",
      "60-day retention",
      <FeatureTooltip
        key="semantic-search"
        term="Semantic search (AI-powered)"
        explanation={featureExplanations.semanticSearch}
      />,
      <FeatureTooltip
        key="basic-neural"
        term="Basic Neural Memory"
        explanation={featureExplanations.basicNeuralMemory}
      />,
      <FeatureTooltip
        key="identity-email"
        term="Identity tracking (email-based)"
        explanation={featureExplanations.identityTracking}
      />,
      "API access (25K calls/day)",
      "Email support",
      "Minimum 3 users",
    ],
    addOns: [
      "+$10 per additional source",
      "+$5 per 1K extra searches",
      "+$20/mo for 180-day retention",
    ],
    monthlyPrice: 12,
    interval: "user/month",
    buttonText: "Start Trial",
    highlighted: true,
  },
  {
    plan: "business",
    name: "Business",
    description: "Unlimited everything. Let's talk.",
    features: [
      "Unlimited searches",
      "Unlimited sources",
      "1-year retention (configurable)",
      <FeatureTooltip
        key="advanced-neural"
        term="Advanced Neural Memory"
        explanation={featureExplanations.advancedNeuralMemory}
      />,
      "Auto-summaries (daily/weekly)",
      <FeatureTooltip
        key="actor-profiles"
        term="Actor expertise profiles"
        explanation={featureExplanations.actorExpertiseProfiles}
      />,
      <FeatureTooltip
        key="full-identity"
        term="Full identity mapping (OAuth/SSO)"
        explanation={featureExplanations.fullIdentityMapping}
      />,
      <FeatureTooltip
        key="temporal-tracking"
        term="Temporal state tracking"
        explanation={featureExplanations.temporalStateTracking}
      />,
      "Priority API access",
      "SSO/SAML",
      "SLA guarantees",
      "Dedicated support",
    ],
    monthlyPrice: "Contact",
    interval: "",
    buttonText: "Contact Sales",
  },
];

const faqs = [
  {
    question: "What makes Lightfast worth $12/user?",
    answer:
      "Lightfast gives your team perfect memory. Find any decision, code change, or discussion instantly. Know who worked on what and why. Track how things evolved over time. For a 10-person team at $120/month, you're saving hours of context searching every week. That's easily worth 10x the cost in saved developer time.",
  },
  {
    question: "What's included in the search allowance?",
    answer:
      "Each user on Team plan gets 1,500 searches/month. A search is any query across your connected sources—semantic search, similar content, or AI-generated answers. For a 10-person team, that's 15,000 searches included. Most teams use 200-500 searches per user monthly. Extra searches are just $5 per 1,000. Business plan includes unlimited searches.",
  },
  {
    question: "How do sources and add-ons work?",
    answer:
      "Starter includes 2 sources, Team includes 5 sources (e.g., GitHub, Linear, Slack, Notion, Confluence). Business includes unlimited sources. Additional sources are $10 each on Team plan. A source is an entire workspace or organization—a GitHub org with 100 repos counts as one source. You can also add 180-day retention (+$20/mo) or extra searches as needed.",
  },
  {
    question: "What's included in Neural Memory?",
    answer:
      "Neural Memory captures decisions, incidents, and changes from your tools. It builds expertise profiles to know who worked on what, tracks evolution over time, and generates summaries. This enables powerful queries like 'who knows about auth' or 'what decisions were made about PostgreSQL'. It's included in all paid plans.",
  },
  {
    question: "Why charge per user instead of just usage?",
    answer:
      "Per-user pricing ensures predictable costs and aligns with value—more team members means more knowledge to organize and search. However, we include generous search allowances and charge minimal amounts for overages, so you're not penalized for active usage. This hybrid model is fairer than pure per-seat or pure usage-based pricing.",
  },
  {
    question: "What happens if we exceed our search limit?",
    answer:
      "Your searches continue working seamlessly. We'll notify you at 80% usage. Overages are automatically billed at $5 per 1,000 searches on the Team plan. You can track usage in real-time and upgrade anytime for better rates. Business plan includes unlimited searches.",
  },
  {
    question: "Can small teams use the Starter plan?",
    answer:
      "Yes! Starter plan is free forever for up to 3 users with 2 sources and 2,500 searches/month total. Perfect for small teams, open source projects, or trying Lightfast. You get basic keyword search and 14-day retention. Upgrade to Team when you need semantic search, Neural Memory, and more sources.",
  },
  {
    question: "How does Business plan differ from Team?",
    answer:
      "Business includes unlimited searches and sources, 1-year retention, advanced Neural Memory with auto-summaries, actor expertise profiles, full identity mapping (OAuth/SSO), temporal state tracking, and dedicated support. It's designed for larger organizations that need everything unlimited. Contact sales for custom pricing.",
  },
  {
    question: "How do we estimate which plan we need?",
    answer:
      "Start with Starter if you're 1-3 people just trying Lightfast. Choose Team if you're 3-50 people and need semantic search and Neural Memory. Most teams use 200-500 searches per user monthly, well within the 1,500 included. If you need unlimited everything, SSO, or advanced features, choose Business. You can always start small and upgrade as you grow.",
  },
];

function PricingFaqJsonLd() {
  const structuredData: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return <JsonLd code={structuredData} />;
}

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
        name: "Starter",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "Up to 3 users, 2 sources, 2,500 searches/month, 14-day retention",
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "12",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "$12 per user/month. 1,500 searches per user, 5 sources, semantic search, Neural Memory included",
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "Contact Sales",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "Custom pricing. Unlimited searches and sources, advanced Neural Memory, SSO",
      },
    ],
    isAccessibleForFree: true,
    license: "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
  };

  return (
    <>
      <JsonLd code={softwareSchema} />
      <PricingFaqJsonLd />
      <div className="mt-10 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
        {/* Hero Section */}
        <section className="relative">
          <div className="max-w-6xl mx-auto grid grid-cols-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
              <div className="flex w-full flex-col items-center text-center">
                {/* Small label */}
                <div className="mb-8 opacity-80">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Pricing for team memory
                  </p>
                </div>

                {/* Heading */}
                <h1
                  className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
                >
                  Choose the plan that fits your team
                </h1>

                {/* Description */}
                <div className="mt-8 px-4">
                  <p className="text-base text-muted-foreground">
                    Simple pricing for neural memory built for teams. Start free,
                    then scale Lightfast as more people and agents rely on team
                    memory.
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Want to see how it works before choosing a plan?{" "}
                    <a
                      href="/docs/get-started/overview"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Read the developer overview
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <div className="max-w-6xl px-4 mx-auto w-full py-10">
          <div className="space-y-8 w-full">
            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {pricingPlans.map((plan) => {
                const price = plan.monthlyPrice;

                return (
                  <div
                    key={plan.plan}
                    className={cn(
                      "flex flex-col border rounded-xs p-6 h-full",
                      plan.highlighted
                        ? "border-foreground shadow-lg"
                        : "border-border",
                    )}
                  >
                    <div className="space-y-1">
                      <h3 className="text-md font-bold text-foreground">
                        {plan.name}
                      </h3>
                      <p className="text-md text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>

                    <div className="space-y-3 mt-6 flex-1">
                      {plan.features.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex items-start gap-3"
                        >
                          <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-foreground">
                            {feature}
                          </div>
                        </div>
                      ))}

                      {plan.addOns && (
                        <div className="pt-3 mt-3 border-t border-border/50">
                          <p className="text-xs font-semibold text-foreground mb-2">
                            Scale as needed:
                          </p>
                          {plan.addOns.map((addOn, addOnIndex) => (
                            <div
                              key={addOnIndex}
                              className="flex items-start gap-3"
                            >
                              <span className="text-xs text-muted-foreground">
                                {addOn}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-12">
                      <div className="space-y-4">
                        <div className="flex items-baseline gap-2">
                          {price === 0 ? (
                            <span className="text-4xl font-bold text-foreground">
                              Free
                            </span>
                          ) : price === "Contact" ? null : (
                            <>
                              <span className="text-4xl font-bold text-foreground">
                                ${price}
                              </span>
                              <span className="text-muted-foreground">
                                / {plan.interval}
                              </span>
                            </>
                          )}
                        </div>

                        {plan.plan === "team" && (
                          <p className="text-xs text-muted-foreground">
                            $36/month for 3 users minimum
                          </p>
                        )}

                        <div className="flex justify-start">
                          <Button
                            variant={plan.highlighted ? "default" : "outline"}
                            className="rounded-full"
                          >
                            {plan.buttonText}
                            <ArrowUpRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left side - FAQ label */}
              <div className="md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  FAQs
                </span>
              </div>

              {/* Right side - FAQ content */}
              <div className="md:col-span-10 md:col-start-3">
                {/* Header with CTA */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8 pb-8 border-b border-border">
                  <div className="space-y-1">
                    <p className="text-xl text-muted-foreground">
                      Find answers.
                    </p>
                  </div>

                  <div className="mt-6 lg:mt-0 lg:text-right">
                    <p className="text-sm text-muted-foreground mb-2">
                      Any more questions?
                    </p>
                    <a
                      href="mailto:sales@lightfast.ai"
                      className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors group"
                    >
                      Talk to sales
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>

                {/* FAQ Accordion */}
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  defaultValue="item-0"
                >
                  {faqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
