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
import { ArrowRight, ArrowUpRight, Check, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "~/components/nav-link";
import {
  buildPricingFaqStructuredData,
  buildPricingSoftwareStructuredData,
  pricingFaqs,
} from "~/lib/pricing-content";

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
    "Advanced identity correlation using email matching, name similarity, and manual mapping for teams with complex account history.",

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
  features: ReactNode[];
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
      "1 organization",
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
      "Unlimited organization members",
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
    addOns: ["+$5 per 1K extra searches", "+$20/mo for 180-day retention"],
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
      "Unlimited organization members",
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
        term="Full identity mapping"
      />,
      <FeatureTooltip
        explanation={featureExplanations.temporalStateTracking}
        key="temporal-tracking"
        term="Temporal state tracking"
      />,
      "Priority API access",
      "SLA guarantees",
      "Dedicated support",
    ],
    monthlyPrice: "Contact",
    interval: "",
    buttonText: "Contact Sales",
  },
];

export default function PricingPage() {
  const softwareSchema = buildPricingSoftwareStructuredData();
  const faqSchema = buildPricingFaqStructuredData();

  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from static local data.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        type="application/ld+json"
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from static local data.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        type="application/ld+json"
      />
      <div className="flex w-full flex-col gap-20 overflow-x-clip pt-28 pb-32 md:px-10 md:pt-32">
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
                      <h3 className="font-bold text-base text-foreground">
                        {plan.name}
                      </h3>
                      <p className="text-base text-muted-foreground">
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
                          <Button
                            asChild
                            className="rounded-full"
                            variant={plan.highlighted ? "default" : "outline"}
                          >
                            <NavLink external href="mailto:sales@lightfast.ai">
                              {plan.buttonText}
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </NavLink>
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
                    <NavLink
                      className="group inline-flex items-center gap-2 font-medium text-foreground text-sm transition-colors hover:text-muted-foreground"
                      external
                      href="mailto:sales@lightfast.ai"
                    >
                      Talk to sales
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </NavLink>
                  </div>
                </div>

                {/* FAQ Accordion */}
                <Accordion
                  className="w-full"
                  collapsible
                  defaultValue={pricingFaqs[0]?.question}
                  type="single"
                >
                  {pricingFaqs.map((faq) => (
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
