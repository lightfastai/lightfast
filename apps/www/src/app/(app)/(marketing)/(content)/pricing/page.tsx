import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type {
  FAQPage,
  SoftwareApplication,
  WithContext,
} from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import { createMetadata } from "@vendor/seo/metadata";
import { ArrowRight, ArrowUpRight, Check, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import type * as React from "react";

export const metadata: Metadata = createMetadata({
  title: "Lightfast Pricing – Scales With Your Team",
  description:
    "Start free for up to 3 users. Scale your operating layer as your team grows — connect more tools, ingest more events, give more agents access.",
  openGraph: {
    title: "Lightfast Pricing – Scales With Your Team",
    description:
      "Pricing for Lightfast. Start free and scale with simple per-user pricing. Connect more tools, ingest more events, give more agents access.",
    url: "https://lightfast.ai/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Pricing",
    description:
      "For every size team. Start free, scale transparently. Events, semantic search, and unlimited sources available.",
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
  explanation: string;
  term: string;
}

function FeatureTooltip({ term, explanation }: FeatureTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="group inline-flex cursor-help items-center gap-1">
          <span className="border-muted-foreground/50 border-b border-dotted transition-colors group-hover:border-muted-foreground">
            {term}
          </span>
          <HelpCircle className="h-3 w-3 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border bg-background font-normal text-foreground text-xs">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}

interface PricingPlan {
  addOns?: string[];
  buttonText: string;
  description: string;
  features: (string | React.ReactNode)[];
  highlighted?: boolean;
  interval: string;
  monthlyPrice: number | string;
  name: string;
  plan: string;
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
        explanation={featureExplanations.semanticSearch}
        key="semantic-search"
        term="Semantic search (AI-powered)"
      />,
      <FeatureTooltip
        explanation={featureExplanations.basicNeuralMemory}
        key="basic-neural"
        term="Basic Decision Surfacing"
      />,
      <FeatureTooltip
        explanation={featureExplanations.identityTracking}
        key="identity-email"
        term="Identity tracking (email-based)"
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
    monthlyPrice: 20,
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
        explanation={featureExplanations.advancedNeuralMemory}
        key="advanced-neural"
        term="Advanced Decision Surfacing"
      />,
      "Auto-summaries (daily/weekly)",
      <FeatureTooltip
        explanation={featureExplanations.actorExpertiseProfiles}
        key="actor-profiles"
        term="Actor expertise profiles"
      />,
      <FeatureTooltip
        explanation={featureExplanations.fullIdentityMapping}
        key="full-identity"
        term="Full identity mapping (OAuth/SSO)"
      />,
      <FeatureTooltip
        explanation={featureExplanations.temporalStateTracking}
        key="temporal-tracking"
        term="Temporal state tracking"
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
    question: "What makes Lightfast worth $20/user?",
    answer:
      "Lightfast gives your team perfect memory. Find any decision, code change, or discussion instantly. Know who worked on what and why. Track how things evolved over time. For a 10-person team at $200/month, you're saving hours of context searching every week. That's easily worth 10x the cost in saved developer time.",
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
    question: "What's included in decision surfacing?",
    answer:
      "Lightfast captures decisions, incidents, and changes from your tools. It builds expertise profiles to know who worked on what, tracks evolution over time, and generates summaries. This enables powerful queries like 'who knows about auth' or 'what decisions were made about PostgreSQL'. It's included in all paid plans.",
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
      "Yes! Starter plan is free forever for up to 3 users with 2 sources and 2,500 searches/month total. Perfect for small teams, open source projects, or trying Lightfast. You get basic keyword search and 14-day retention. Upgrade to Team when you need semantic search, decision surfacing, and more sources.",
  },
  {
    question: "How does Business plan differ from Team?",
    answer:
      "Business includes unlimited searches and sources, 1-year retention, advanced decision surfacing with auto-summaries, actor expertise profiles, full identity mapping (OAuth/SSO), temporal state tracking, and dedicated support. It's designed for larger organizations that need everything unlimited. Contact sales for custom pricing.",
  },
  {
    question: "How do we estimate which plan we need?",
    answer:
      "Start with Starter if you're 1-3 people just trying Lightfast. Choose Team if you're 3-50 people and need semantic search and decision surfacing. Most teams use 200-500 searches per user monthly, well within the 1,500 included. If you need unlimited everything, SSO, or advanced features, choose Business. You can always start small and upgrade as you grow.",
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
    name: "Lightfast",
    url: "https://lightfast.ai",
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
          "$12 per user/month. 1,500 searches per user, 5 sources, semantic search, decision surfacing included",
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "Contact Sales",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "Custom pricing. Unlimited searches and sources, advanced decision surfacing, SSO",
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
          <div className="mx-auto grid max-w-6xl grid-cols-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
              <div className="flex w-full flex-col items-center text-center">
                {/* Small label */}
                <div className="mb-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-widest">
                    Pricing
                  </p>
                </div>

                {/* Heading */}
                <h1
                  className={
                    "text-balance px-4 font-medium font-pp text-3xl sm:text-4xl md:text-5xl"
                  }
                >
                  Choose the plan that fits your team
                </h1>

                {/* Description */}
                <div className="mt-8 px-4">
                  <p className="text-base text-muted-foreground">
                    Simple pricing that scales with your team. Start free, then
                    scale Lightfast as more people and agents rely on it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="w-full space-y-8">
            {/* Pricing Cards */}
            <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-3">
              {pricingPlans.map((plan) => {
                const price = plan.monthlyPrice;

                return (
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-sm bg-card p-6",
                      plan.highlighted
                        ? "border border-foreground shadow-lg"
                        : "",
                      "md:col-span-2 lg:col-span-1",
                      plan.plan === "business" &&
                        "md:col-start-2 lg:col-start-auto"
                    )}
                    key={plan.plan}
                  >
                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground text-md">
                        {plan.name}
                      </h3>
                      <p className="text-md text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mt-6 flex-1 space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <div
                          className="flex items-start gap-3"
                          key={featureIndex}
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                          <div className="text-foreground text-sm">
                            {feature}
                          </div>
                        </div>
                      ))}

                      {plan.addOns && (
                        <div className="mt-3 border-border/50 border-t pt-3">
                          <p className="mb-2 font-semibold text-foreground text-xs">
                            Scale as needed:
                          </p>
                          {plan.addOns.map((addOn, addOnIndex) => (
                            <div
                              className="flex items-start gap-3"
                              key={addOnIndex}
                            >
                              <span className="text-muted-foreground text-sm">
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
                            <span className="font-bold text-4xl text-foreground">
                              Free
                            </span>
                          ) : price === "Contact" ? null : (
                            <>
                              <span className="font-bold text-4xl text-foreground">
                                ${price}
                              </span>
                              <span className="text-muted-foreground">
                                /{plan.interval}
                              </span>
                            </>
                          )}
                        </div>

                        {plan.plan === "team" && (
                          <p className="text-muted-foreground text-sm">
                            $60/month for 3 users minimum
                          </p>
                        )}

                        <div className="flex justify-start">
                          <a href="mailto:sales@lightfast.ai">
                            <Button
                              className="rounded-full"
                              variant={plan.highlighted ? "default" : "outline"}
                            >
                              {plan.buttonText}
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Button>
                          </a>
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
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="w-full">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-16">
              {/* Left: Badge */}
              <div>
                <span className="inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-xs">
                  FAQ
                </span>
              </div>

              {/* Right: FAQ content - spans 2 columns */}
              <div className="lg:col-span-2">
                {/* Header with CTA */}
                <div className="mb-8 flex flex-col border-border border-b pb-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
                      Find answers.
                    </p>
                  </div>

                  <div className="mt-6 lg:mt-0 lg:text-right">
                    <p className="mb-2 text-muted-foreground text-sm">
                      Any more questions?
                    </p>
                    <a
                      className="group inline-flex items-center gap-2 font-medium text-foreground text-sm transition-colors hover:text-muted-foreground"
                      href="mailto:sales@lightfast.ai"
                    >
                      Talk to sales
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>

                {/* FAQ Accordion */}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
