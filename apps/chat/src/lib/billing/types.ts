/**
 * Billing Types and Constants
 */

export type BillingPlan = 'free' | 'plus';

export type MessageType = 'non_premium' | 'premium';

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