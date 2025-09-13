import { createCaller } from "~/trpc/server";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import { MessageType } from "./types";

/**
 * Server-side usage tracking service using TRPC
 * This replaces the direct database usage functions
 */

/**
 * Determines if a model is premium based on schema-defined billing tier
 */
export function isModelPremium(modelId: string): boolean {
	if (!(modelId in ACTIVE_MODELS)) return true; // Unknown models default to premium
	
	const model = ACTIVE_MODELS[modelId as keyof typeof ACTIVE_MODELS];
	return model.billingTier === "premium";
}

/**
 * Get message type based on model's billing tier
 */
export function getMessageType(modelId: string): MessageType {
	if (!(modelId in ACTIVE_MODELS)) return MessageType.PREMIUM; // Unknown models default to premium

	const model = ACTIVE_MODELS[modelId as keyof typeof ACTIVE_MODELS];
	return model.billingTier === "premium" ? MessageType.PREMIUM : MessageType.NON_PREMIUM;
}

/**
 * Get current period string (YYYY-MM)
 */
export function getCurrentPeriod(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Check if user can send a message with specific model
 * Uses TRPC for all database operations
 */
export async function canSendMessage(modelId: string): Promise<{
	allowed: boolean;
	reason?: string;
	remainingMessages?: number;
}> {
	try {
		const caller = await createCaller();
		const messageType = getMessageType(modelId);

		// Check usage limits
		const limitsCheck = await caller.usage.checkLimits({});

		const exceeded =
			messageType === MessageType.PREMIUM
				? limitsCheck.exceeded.premiumMessages
				: limitsCheck.exceeded.nonPremiumMessages;

		if (exceeded) {
			const remaining =
				messageType === MessageType.PREMIUM
					? limitsCheck.remainingQuota.premiumMessages
					: limitsCheck.remainingQuota.nonPremiumMessages;

			return {
				allowed: false,
				reason:
					messageType === MessageType.PREMIUM
						? "Premium message limit exceeded for this month"
						: "Monthly message limit exceeded",
				remainingMessages: remaining,
			};
		}

		const remaining =
			messageType === MessageType.PREMIUM
				? limitsCheck.remainingQuota.premiumMessages
				: limitsCheck.remainingQuota.nonPremiumMessages;

		return {
			allowed: true,
			remainingMessages: remaining,
		};
	} catch (error) {
		console.error("Error checking message limit:", error);
		// On error, default to allowing the message but log the issue
		return {
			allowed: true,
			remainingMessages: 999, // Fallback value
		};
	}
}

/**
 * Track a message being sent (increment usage counters)
 * Uses TRPC for database operations
 */
export async function trackMessageSent(modelId: string): Promise<void> {
	try {
		const caller = await createCaller();
		const messageType = getMessageType(modelId);
		const period = getCurrentPeriod();

		if (messageType === MessageType.PREMIUM) {
			await caller.usage.incrementPremium({
				period,
				count: 1,
			});
		} else {
			await caller.usage.incrementNonPremium({
				period,
				count: 1,
			});
		}

		console.log(`[Usage] Tracked ${messageType} message for model: ${modelId}`);
	} catch (error) {
		console.error("Error tracking message usage:", error);
		// Don't throw here to avoid breaking the chat flow
		// Usage tracking is important but not critical enough to break the user experience
	}
}

/**
 * Custom error for usage limit exceeded
 */
export class UsageLimitExceededError extends Error {
	public readonly code = "USAGE_LIMIT_EXCEEDED";

	constructor(
		message: string,
		public readonly details: {
			modelId: string;
			messageType: MessageType;
			remainingMessages: number;
		},
	) {
		super(message);
		this.name = "UsageLimitExceededError";
	}
}

/**
 * Require message sending permission, throw error if not allowed
 */
export async function requireMessageAccess(modelId: string): Promise<void> {
	const result = await canSendMessage(modelId);

	if (!result.allowed) {
		throw new UsageLimitExceededError(
			result.reason ?? "Message limit exceeded",
			{
				modelId,
				messageType: getMessageType(modelId),
				remainingMessages: result.remainingMessages ?? 0,
			},
		);
	}
}

