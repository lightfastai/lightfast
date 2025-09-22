import { BILLING_LIMITS, ClerkPlanKey } from "./types";
import type { BillingInterval } from "./types";

export interface PlanPricing {
  plan: ClerkPlanKey;
  name: string;
  description: string;
  price: number;
  currency: "USD";
  interval: BillingInterval;
  features: string[];
  popular?: boolean;
  buttonText: string;
  annualPrice?: number;
  annualTotal?: number;
  annualSavings?: number;
}

export const PLAN_PRICING: Record<ClerkPlanKey, PlanPricing> = {
  [ClerkPlanKey.FREE_TIER]: {
    plan: ClerkPlanKey.FREE_TIER,
    name: "Free",
    description: "Get started with AI-powered conversations",
    price: 0,
    currency: "USD",
    interval: "month",
    buttonText: "Get Free",
    features: [
      `${BILLING_LIMITS[ClerkPlanKey.FREE_TIER].nonPremiumMessagesPerMonth.toLocaleString()} messages per month`,
      "Access to GPT-5 Nano",
      "Basic AI conversation capabilities",
      "Code generation and explanations",
      "General knowledge and assistance",
      "No credit card required",
    ],
  },
  [ClerkPlanKey.PLUS_TIER]: {
    plan: ClerkPlanKey.PLUS_TIER,
    name: "Plus",
    description: "Unlock premium AI models and advanced features",
    price: 10,
    currency: "USD",
    interval: "month",
    buttonText: "Get Plus",
    popular: true,
    annualPrice: 8,
    annualTotal: 96,
    annualSavings: 20,
    features: [
      "Everything in Free",
      `${BILLING_LIMITS[ClerkPlanKey.PLUS_TIER].nonPremiumMessagesPerMonth.toLocaleString()} standard + ${BILLING_LIMITS[ClerkPlanKey.PLUS_TIER].premiumMessagesPerMonth} premium messages per month`,
      "Access to premium models: Claude 4 Sonnet, GPT-5, GPT-5 Mini, Gemini 2.5 Pro & Flash, Kimi K2",
      "First access to the latest models as they're released",
      "File attachments and document analysis",
      "Real-time web search capabilities",
      "Create and download artifacts (code, documents, diagrams)",
      "Priority support and faster responses",
    ],
  },
} as const;

export function getPlanPricing(plan: ClerkPlanKey): PlanPricing {
  return PLAN_PRICING[plan];
}

export function getAllPlanPricing(): PlanPricing[] {
  return Object.values(PLAN_PRICING);
}

export function getFormattedPrice(
  plan: ClerkPlanKey,
  interval: BillingInterval = "month",
): string {
  const pricing = getPlanPricing(plan);

  if (pricing.price === 0) {
    return "Free";
  }

  if (interval === "annual" && pricing.annualPrice) {
    return `$${pricing.annualPrice}/month`;
  }

  return `$${pricing.price}/${pricing.interval}`;
}

export function getPricingForInterval(
  plan: ClerkPlanKey,
  interval: BillingInterval,
): {
  price: number;
  displayPrice: string;
  totalPrice: number;
  savings?: number;
} {
  const pricing = getPlanPricing(plan);

  if (pricing.price === 0) {
    return {
      price: 0,
      displayPrice: "Free",
      totalPrice: 0,
    };
  }

  if (interval === "annual" && pricing.annualPrice && pricing.annualTotal) {
    return {
      price: pricing.annualPrice,
      displayPrice: `$${pricing.annualPrice}/month`,
      totalPrice: pricing.annualTotal,
      savings: pricing.annualSavings,
    };
  }

  return {
    price: pricing.price,
    displayPrice: `$${pricing.price}/month`,
    totalPrice: pricing.price,
  };
}

export function planHasFeature(plan: ClerkPlanKey, feature: string): boolean {
  const pricing = getPlanPricing(plan);
  return pricing.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()));
}

export function getUpgradePath(currentPlan: ClerkPlanKey): ClerkPlanKey | null {
  if (currentPlan === ClerkPlanKey.FREE_TIER) {
    return ClerkPlanKey.PLUS_TIER;
  }

  return null;
}

export interface PricingComparison {
  from: PlanPricing;
  to: PlanPricing;
  monthlySavings: number;
  yearlyTotal: number;
  additionalFeatures: string[];
}

export function comparePlans(fromPlan: ClerkPlanKey, toPlan: ClerkPlanKey): PricingComparison {
  const from = getPlanPricing(fromPlan);
  const to = getPlanPricing(toPlan);

  const monthlySavings = from.price - to.price;
  const yearlyTotal = to.price * 12;
  const additionalFeatures = to.features.filter(
    (feature) => !from.features.includes(feature) && feature !== "Everything in Free",
  );

  return {
    from,
    to,
    monthlySavings,
    yearlyTotal,
    additionalFeatures,
  };
}

export function getCheckoutFeatures(planKey: ClerkPlanKey): string[] {
  const planPricing = getPlanPricing(planKey);

  switch (planKey) {
    case ClerkPlanKey.FREE_TIER:
      return [
        "Try Lightfast Chat with no commitment",
        "Access to GPT-5 Nano with unlimited conversations",
        "Code generation, explanations, and debugging assistance",
        "Lightfast UI features including artifacts, templates, and workflows",
      ];
    case ClerkPlanKey.PLUS_TIER:
      return [
        ...planPricing.features.filter((feature) => feature !== "Everything in Free"),
        "Priority access to new features",
      ];
    default:
      return planPricing.features;
  }
}
