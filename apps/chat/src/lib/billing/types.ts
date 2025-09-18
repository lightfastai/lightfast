import {
	BILLING_LIMITS as CORE_BILLING_LIMITS,
	MessageType,
	ClerkPlanKey,
	BillingErrorCode,
	UsageLimitExceededError,
	ModelNotAllowedError,
	FeatureNotAllowedError,
	GRACE_PERIOD_DAYS,
	getClerkPlanId,
	hasClerkPlan,
} from "@api/chat/lib/billing/types";
import type {
	BillingInterval,
	BillingPlanLimits,
	BillingError,
} from "@api/chat/lib/billing/types";
import { getVisibleModels } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";

export {
	MessageType,
	ClerkPlanKey,
	BillingErrorCode,
	UsageLimitExceededError,
	ModelNotAllowedError,
	FeatureNotAllowedError,
	GRACE_PERIOD_DAYS,
	getClerkPlanId,
	hasClerkPlan,
};

export type { BillingInterval, BillingPlanLimits, BillingError };

export interface UserUsage {
	userId: string;
	period: string; // YYYY-MM format for monthly, YYYY-MM-DD for anniversary billing
	nonPremiumMessages: number;
	premiumMessages: number;
	lastUpdated: Date;
}

export interface BillingLimits extends BillingPlanLimits {
	allowedModels: string[];
}

const getAnonymousAllowedModels = (): string[] => {
	return getVisibleModels()
		.filter((model) => model.accessLevel === "anonymous")
		.map((model) => model.id as ModelId);
};

const getPlusAllowedModels = (): string[] => {
	return getVisibleModels().map((model) => model.id as ModelId);
};

export const BILLING_LIMITS: Record<ClerkPlanKey, BillingLimits> = {
	[ClerkPlanKey.FREE_TIER]: {
		...CORE_BILLING_LIMITS[ClerkPlanKey.FREE_TIER],
		allowedModels: getAnonymousAllowedModels(),
	},
	[ClerkPlanKey.PLUS_TIER]: {
		...CORE_BILLING_LIMITS[ClerkPlanKey.PLUS_TIER],
		allowedModels: getPlusAllowedModels(),
	},
} as const;
