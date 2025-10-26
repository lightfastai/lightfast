import { DEUS_LIMITS, DeusPlanKey } from "./types";
import type { BillingInterval } from "./types";

export interface PlanPricing {
  plan: DeusPlanKey;
  name: string;
  description: string;
  price: number | string;
  currency: "USD";
  interval: BillingInterval;
  features: string[];
  popular?: boolean;
  buttonText: string;
  annualPrice?: number;
  annualTotal?: number;
  annualSavings?: number;
}

export const PLAN_PRICING: Record<DeusPlanKey, PlanPricing> = {
  [DeusPlanKey.FREE]: {
    plan: DeusPlanKey.FREE,
    name: "Free",
    description: "Get started with AI workflow automation",
    price: 0,
    currency: "USD",
    interval: "month",
    buttonText: "Get Started",
    features: [
      `${DEUS_LIMITS[DeusPlanKey.FREE].maxIntegrations} integrations`,
      `${DEUS_LIMITS[DeusPlanKey.FREE].workflowRunsPerMonth.toLocaleString()} workflow runs per month`,
      "AI-native workflow orchestration",
      "Universal tool integration via natural language",
      "Basic intent understanding",
      "Community support",
      "No credit card required",
    ],
  },
  [DeusPlanKey.PRO]: {
    plan: DeusPlanKey.PRO,
    name: "Pro",
    description: "Scale your workflows with unlimited integrations",
    price: 29,
    currency: "USD",
    interval: "month",
    buttonText: "Get Pro",
    popular: true,
    annualPrice: 24,
    annualTotal: 288,
    annualSavings: 60,
    features: [
      "Everything in Free",
      "Unlimited integrations",
      `${DEUS_LIMITS[DeusPlanKey.PRO].workflowRunsPerMonth.toLocaleString()} workflow runs per month`,
      "Advanced AI workflow orchestration",
      "Priority execution queue",
      "Priority support",
      "Advanced analytics",
    ],
  },
  [DeusPlanKey.TEAM]: {
    plan: DeusPlanKey.TEAM,
    name: "Team",
    description: "Collaborate and build together",
    price: 99,
    currency: "USD",
    interval: "month",
    buttonText: "Get Team",
    annualPrice: 82,
    annualTotal: 984,
    annualSavings: 204,
    features: [
      "Everything in Pro",
      "Unlimited integrations",
      `${DEUS_LIMITS[DeusPlanKey.TEAM].workflowRunsPerMonth.toLocaleString()} workflow runs per month`,
      "Shared workflows and collaboration",
      "Team workspace",
      "Audit logs and activity tracking",
      "Priority support",
      "Advanced analytics and insights",
    ],
  },
  [DeusPlanKey.ENTERPRISE]: {
    plan: DeusPlanKey.ENTERPRISE,
    name: "Enterprise",
    description: "Custom infrastructure for your organization",
    price: "Custom",
    currency: "USD",
    interval: "month",
    buttonText: "Contact Sales",
    features: [
      "Everything in Team",
      "Unlimited integrations",
      "Unlimited workflow runs",
      "Single Sign-On (SSO)",
      "Private integrations",
      "Dedicated infrastructure",
      "SLA guarantees",
      "Dedicated support engineer",
      "Custom deployment options",
      "Advanced security controls",
    ],
  },
} as const;

export function getPlanPricing(plan: DeusPlanKey): PlanPricing {
  return PLAN_PRICING[plan];
}

export function getAllPlanPricing(): PlanPricing[] {
  return [
    PLAN_PRICING[DeusPlanKey.FREE],
    PLAN_PRICING[DeusPlanKey.PRO],
    PLAN_PRICING[DeusPlanKey.TEAM],
  ];
}

export function getFormattedPrice(
  plan: DeusPlanKey,
  interval: BillingInterval = "month",
): string {
  const pricing = getPlanPricing(plan);

  if (pricing.price === 0) {
    return "Free";
  }

  if (typeof pricing.price === "string") {
    return pricing.price;
  }

  if (interval === "annual" && pricing.annualPrice) {
    return `$${pricing.annualPrice}/month`;
  }

  return `$${pricing.price}/${pricing.interval}`;
}

export function getPricingForInterval(
  plan: DeusPlanKey,
  interval: BillingInterval,
): {
  price: number | string;
  displayPrice: string;
  totalPrice: number | string;
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

  if (typeof pricing.price === "string") {
    return {
      price: pricing.price,
      displayPrice: pricing.price,
      totalPrice: pricing.price,
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

export function planHasFeature(plan: DeusPlanKey, feature: string): boolean {
  const pricing = getPlanPricing(plan);
  return pricing.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()));
}

export function getUpgradePath(currentPlan: DeusPlanKey): DeusPlanKey | null {
  if (currentPlan === DeusPlanKey.FREE) {
    return DeusPlanKey.PRO;
  }

  if (currentPlan === DeusPlanKey.PRO) {
    return DeusPlanKey.TEAM;
  }

  if (currentPlan === DeusPlanKey.TEAM) {
    return DeusPlanKey.ENTERPRISE;
  }

  return null;
}

export interface PricingComparison {
  from: PlanPricing;
  to: PlanPricing;
  monthlySavings: number | string;
  yearlyTotal: number | string;
  additionalFeatures: string[];
}

export function comparePlans(fromPlan: DeusPlanKey, toPlan: DeusPlanKey): PricingComparison {
  const from = getPlanPricing(fromPlan);
  const to = getPlanPricing(toPlan);

  const monthlySavings =
    typeof from.price === "number" && typeof to.price === "number"
      ? from.price - to.price
      : "N/A";

  const yearlyTotal = typeof to.price === "number" ? to.price * 12 : "Custom";

  const additionalFeatures = to.features.filter(
    (feature) => !from.features.includes(feature) && !feature.startsWith("Everything in"),
  );

  return {
    from,
    to,
    monthlySavings,
    yearlyTotal,
    additionalFeatures,
  };
}

export function getCheckoutFeatures(planKey: DeusPlanKey): string[] {
  const planPricing = getPlanPricing(planKey);

  switch (planKey) {
    case DeusPlanKey.FREE:
      return [
        "Try Deus with no commitment",
        "AI-native workflow orchestration",
        "Universal tool integration via natural language",
        "Up to 5 integrations and 100 workflow runs per month",
      ];
    case DeusPlanKey.PRO:
      return [
        ...planPricing.features.filter((feature) => !feature.startsWith("Everything in")),
        "Priority access to new features",
      ];
    case DeusPlanKey.TEAM:
      return [
        ...planPricing.features.filter((feature) => !feature.startsWith("Everything in")),
        "Priority access to new features",
      ];
    case DeusPlanKey.ENTERPRISE:
      return [
        ...planPricing.features.filter((feature) => !feature.startsWith("Everything in")),
        "White-glove onboarding",
        "Custom contract terms",
      ];
    default:
      return planPricing.features;
  }
}
