/**
 * Billing Types and Constants
 */

export type BillingPlan = 'free' | 'plus';

export type MessageType = 'non_premium' | 'premium';

/**
 * Clerk plan structure configured in Clerk dashboard:
 * Free plan: name=free-tier, key=free_tier, plan_id=cplan_free
 * Plus plan: name=plus-tier, key=plus_tier, plan_id=cplan_32cweGLPsMKmT3b5PKCcpMJq0gt
 */
export type ClerkPlanId = 'cplan_free' | 'cplan_32cweGLPsMKmT3b5PKCcpMJq0gt';
export type ClerkPlanKey = 'free_tier' | 'plus_tier';

/**
 * Mapping from our internal billing plans to Clerk plan IDs (used for CheckoutButton)
 */
export const CLERK_PLAN_IDS: Record<BillingPlan, ClerkPlanId> = {
  free: 'cplan_free',
  plus: 'cplan_32cweGLPsMKmT3b5PKCcpMJq0gt',
} as const;

/**
 * Mapping from our internal billing plans to Clerk plan keys (used for subscription checks)
 */
export const CLERK_PLAN_KEYS: Record<BillingPlan, ClerkPlanKey> = {
  free: 'free_tier',
  plus: 'plus_tier',
} as const;

export interface UserUsage {
  userId: string;
  period: string; // YYYY-MM format
  nonPremiumMessages: number;
  premiumMessages: number;
  lastUpdated: Date;
}

export interface BillingLimits {
  plan: BillingPlan;
  nonPremiumMessagesPerMonth: number;
  premiumMessagesPerMonth: number;
  hasWebSearch: boolean;
  allowedModels: string[];
}

export const BILLING_LIMITS: Record<BillingPlan, BillingLimits> = {
  free: {
    plan: 'free',
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 0,
    hasWebSearch: false,
    allowedModels: ['openai/gpt-5-nano'], // Only default model
  },
  plus: {
    plan: 'plus',
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 100,
    hasWebSearch: true,
    allowedModels: [], // Empty means all models allowed
  },
} as const;

export interface BillingError extends Error {
  code: 'USAGE_LIMIT_EXCEEDED' | 'MODEL_NOT_ALLOWED' | 'FEATURE_NOT_ALLOWED';
  details?: Record<string, unknown>;
}

export class UsageLimitExceededError extends Error implements BillingError {
  code = 'USAGE_LIMIT_EXCEEDED' as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UsageLimitExceededError';
  }
}

export class ModelNotAllowedError extends Error implements BillingError {
  code = 'MODEL_NOT_ALLOWED' as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ModelNotAllowedError';
  }
}

export class FeatureNotAllowedError extends Error implements BillingError {
  code = 'FEATURE_NOT_ALLOWED' as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FeatureNotAllowedError';
  }
}

/**
 * Utility function to get Clerk plan ID from internal billing plan (for CheckoutButton)
 */
export function getClerkPlanId(plan: BillingPlan): ClerkPlanId {
  return CLERK_PLAN_IDS[plan];
}

/**
 * Utility function to get Clerk plan key from internal billing plan (for subscription checks)
 */
export function getClerkPlanKey(plan: BillingPlan): ClerkPlanKey {
  return CLERK_PLAN_KEYS[plan];
}