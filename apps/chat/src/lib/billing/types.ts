/**
 * Billing Types and Constants
 */
import { getVisibleModels } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";

/**
 * Message types for usage tracking
 */
export enum MessageType {
  NON_PREMIUM = 'non_premium',
  PREMIUM = 'premium',
}

/**
 * Clerk plan structure configured in Clerk dashboard:
 * Free plan: name=free-tier, key=free_tier, plan_id=cplan_free
 * Plus plan: name=plus-tier, key=plus_tier, plan_id=cplan_32cweGLPsMKmT3b5PKCcpMJq0gt
 *   - Supports both monthly ($10/month) and annual ($8/month, $96/year) billing
 */

/**
 * Billing intervals supported by the system
 * Must match Clerk's CommerceSubscriptionPlanPeriod type exactly
 */
export type BillingInterval = 'month' | 'annual';

/**
 * Clerk plan keys - our primary plan identifiers used for auth().has() subscription checks
 */
export enum ClerkPlanKey {
  FREE_TIER = 'free_tier',
  PLUS_TIER = 'plus_tier',
}

import { env } from "~/env";

/**
 * Runtime function to get Clerk plan IDs based on environment
 */
export function getClerkPlanId(planKey: ClerkPlanKey): string {
  const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === 'production';

  switch (planKey) {
    case ClerkPlanKey.FREE_TIER:
      return 'cplan_free';
    case ClerkPlanKey.PLUS_TIER:
      return isProduction 
        ? 'cplan_32azs7rjM8dS6ygaIs0LnclF91f' 
        : 'cplan_32cweGLPsMKmT3b5PKCcpMJq0gt';
    default:
      throw new Error(`Unknown plan key: ${String(planKey)}`);
  }
}

export interface UserUsage {
  userId: string;
  period: string; // YYYY-MM format for monthly, YYYY-MM-DD for anniversary billing
  nonPremiumMessages: number;
  premiumMessages: number;
  lastUpdated: Date;
}


export interface BillingLimits {
  plan: ClerkPlanKey;
  nonPremiumMessagesPerMonth: number;
  premiumMessagesPerMonth: number;
  hasWebSearch: boolean;
  allowedModels: string[];
}

/**
 * Helper functions to derive allowed models from model definitions
 * This replaces hardcoded model lists with computed derivations
 */

/**
 * Get models available to anonymous users (FREE_TIER)
 * Anonymous users can only access models with accessLevel: "anonymous"
 */
const getAnonymousAllowedModels = (): ModelId[] => {
  return getVisibleModels()
    .filter(model => model.accessLevel === "anonymous")
    .map(model => model.id as ModelId);
};

/**
 * Get models available to authenticated users (PLUS_TIER)
 * Plus users can access all visible models
 */
const getPlusAllowedModels = (): ModelId[] => {
  // Plus users can access all visible models regardless of access level
  return getVisibleModels()
    .map(model => model.id as ModelId);
};

export const BILLING_LIMITS: Record<ClerkPlanKey, BillingLimits> = {
  [ClerkPlanKey.FREE_TIER]: {
    plan: ClerkPlanKey.FREE_TIER,
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 0,
    hasWebSearch: false,
    allowedModels: getAnonymousAllowedModels(), // Derived from model definitions
  },
  [ClerkPlanKey.PLUS_TIER]: {
    plan: ClerkPlanKey.PLUS_TIER,
    nonPremiumMessagesPerMonth: 1000,
    premiumMessagesPerMonth: 100,
    hasWebSearch: true,
    allowedModels: getPlusAllowedModels(), // Derived from model definitions  
  },
} as const;

/**
 * Billing error types
 */
export enum BillingErrorCode {
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  MODEL_NOT_ALLOWED = 'MODEL_NOT_ALLOWED',
  FEATURE_NOT_ALLOWED = 'FEATURE_NOT_ALLOWED',
}

export interface BillingError extends Error {
  code: BillingErrorCode;
  details?: Record<string, unknown>;
}

export class UsageLimitExceededError extends Error implements BillingError {
  code = BillingErrorCode.USAGE_LIMIT_EXCEEDED as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UsageLimitExceededError';
  }
}

export class ModelNotAllowedError extends Error implements BillingError {
  code = BillingErrorCode.MODEL_NOT_ALLOWED as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ModelNotAllowedError';
  }
}

export class FeatureNotAllowedError extends Error implements BillingError {
  code = BillingErrorCode.FEATURE_NOT_ALLOWED as const;
  
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FeatureNotAllowedError';
  }
}


/**
 * Type-safe helper to check if user has a specific plan using auth().has()
 */
export function hasClerkPlan(hasFunction: (params: { plan: string }) => boolean, planKey: ClerkPlanKey): boolean {
  return hasFunction({ plan: planKey });
}

/**
 * Grace period configuration for payment failures
 */
export const GRACE_PERIOD_DAYS = 7; // 7 days grace period for past_due subscriptions