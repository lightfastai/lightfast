export enum MessageType {
  NON_PREMIUM = "non_premium",
  PREMIUM = "premium",
}

export type BillingInterval = "month" | "annual";

export enum ClerkPlanKey {
  FREE_TIER = "free_tier",
  PLUS_TIER = "plus_tier",
}

export type DeploymentStage = "development" | "preview" | "production";

interface PlanMapping {
  production: string;
  nonProduction: string;
}

const CLERK_PLAN_IDS: Record<ClerkPlanKey, PlanMapping> = {
  [ClerkPlanKey.FREE_TIER]: {
    production: "cplan_free",
    nonProduction: "cplan_free",
  },
  [ClerkPlanKey.PLUS_TIER]: {
    production: "cplan_32azs7rjM8dS6ygaIs0LnclF91f",
    nonProduction: "cplan_32cweGLPsMKmT3b5PKCcpMJq0gt",
  },
};

function resolveDeploymentStage(explicit?: string): DeploymentStage {
  if (explicit === "production" || explicit === "preview" || explicit === "development") {
    return explicit;
  }

  const envFromProcess =
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development";

  if (envFromProcess === "production") return "production";
  if (envFromProcess === "preview") return "preview";
  return "development";
}

export function getClerkPlanId(
  planKey: ClerkPlanKey,
  options?: { environment?: string },
): string {
  const stage = resolveDeploymentStage(options?.environment);
  const mapping = CLERK_PLAN_IDS[planKey];

  return stage === "production" ? mapping.production : mapping.nonProduction;
}

export interface BillingPlanLimits {
  plan: ClerkPlanKey;
  nonPremiumMessagesPerMonth: number;
  premiumMessagesPerMonth: number;
  hasWebSearch: boolean;
  hasAttachments: boolean;
}

export const BILLING_LIMITS: Record<ClerkPlanKey, BillingPlanLimits> = {
  [ClerkPlanKey.FREE_TIER]: {
    plan: ClerkPlanKey.FREE_TIER,
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 0,
    hasWebSearch: false,
    hasAttachments: true, // Attachments are now available on free tier
  },
  [ClerkPlanKey.PLUS_TIER]: {
    plan: ClerkPlanKey.PLUS_TIER,
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 100,
    hasWebSearch: true,
    hasAttachments: true,
  },
} as const;

export function getMessageLimitsForPlan(
  planKey: ClerkPlanKey,
): BillingPlanLimits {
  return BILLING_LIMITS[planKey];
}

export enum BillingErrorCode {
  USAGE_LIMIT_EXCEEDED = "USAGE_LIMIT_EXCEEDED",
  MODEL_NOT_ALLOWED = "MODEL_NOT_ALLOWED",
  FEATURE_NOT_ALLOWED = "FEATURE_NOT_ALLOWED",
}

export interface BillingError extends Error {
  code: BillingErrorCode;
  details?: Record<string, unknown>;
}

export class UsageLimitExceededError
  extends Error
  implements BillingError
{
  code = BillingErrorCode.USAGE_LIMIT_EXCEEDED as const;

  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = "UsageLimitExceededError";
  }
}

export class ModelNotAllowedError extends Error implements BillingError {
  code = BillingErrorCode.MODEL_NOT_ALLOWED as const;

  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = "ModelNotAllowedError";
  }
}

export class FeatureNotAllowedError extends Error implements BillingError {
  code = BillingErrorCode.FEATURE_NOT_ALLOWED as const;

  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = "FeatureNotAllowedError";
  }
}

export function hasClerkPlan(
  hasFunction: (params: { plan: string }) => boolean,
  planKey: ClerkPlanKey,
): boolean {
  return hasFunction({ plan: planKey });
}

export const GRACE_PERIOD_DAYS = 7;
