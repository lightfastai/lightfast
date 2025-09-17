import { createCaller } from "~/trpc/server";
import { getMessageType } from "./message-utils";
import { MessageType } from "./types";
import { toZonedTime, format } from "date-fns-tz";
import { calculateBillingPeriod } from "@api/chat";

/**
 * Enhanced server-side usage tracking service
 * Uses TRPC with timezone-aware period calculation
 */

/**
 * Get current period string with timezone support
 * Now supports both calendar months (free users) and billing anniversaries (paid users)
 */
export async function getCurrentPeriod(timezone = 'UTC', userId?: string): Promise<string> {
  if (userId) {
    // Use subscription-aware billing period calculation
    const period: string = await calculateBillingPeriod(userId, timezone);
    return period;
  } else {
    // Fallback to calendar month (for backward compatibility)
    const now = toZonedTime(new Date(), timezone);
    return format(now, 'yyyy-MM');
  }
}

/**
 * Check if user can send a message with specific model
 * Enhanced with subscription status and grace period logic via TRPC
 */
export async function canSendMessage(
	modelId: string,
	timezone?: string
): Promise<{
	allowed: boolean;
	reason?: string;
	remainingMessages?: number;
	gracePeriod?: {
		active: boolean;
		daysRemaining?: number;
	};
}> {
	try {
		const caller = await createCaller();
		const messageType = getMessageType(modelId);

		// Check usage limits via enhanced TRPC endpoint
		const limitsCheck = await caller.usage.checkLimits({
			timezone: timezone ?? 'UTC',
		});

		const exceeded =
			messageType === MessageType.PREMIUM
				? limitsCheck.exceeded.premiumMessages
				: limitsCheck.exceeded.nonPremiumMessages;

		if (exceeded) {
			const remaining =
				messageType === MessageType.PREMIUM
					? limitsCheck.remainingQuota.premiumMessages
					: limitsCheck.remainingQuota.nonPremiumMessages;

			let reason = messageType === MessageType.PREMIUM
				? "Premium message limit exceeded for this billing period"
				: "Message limit exceeded for this billing period";

			// Add grace period context if applicable
			if (limitsCheck.gracePeriod.active) {
				reason += ` (Grace period: ${limitsCheck.gracePeriod.daysRemaining} days remaining)`;
			}

			return {
				allowed: false,
				reason,
				remainingMessages: remaining,
				gracePeriod: limitsCheck.gracePeriod,
			};
		}

		const remaining =
			messageType === MessageType.PREMIUM
				? limitsCheck.remainingQuota.premiumMessages
				: limitsCheck.remainingQuota.nonPremiumMessages;

		return {
			allowed: true,
			remainingMessages: remaining,
			gracePeriod: limitsCheck.gracePeriod,
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
 * Uses subscription-aware billing period calculation
 */
export async function trackMessageSent(
	userId: string,
	modelId: string,
	timezone?: string
): Promise<void> {
	try {
		const caller = await createCaller();
		const messageType = getMessageType(modelId);
		const period = await getCurrentPeriod(timezone ?? 'UTC', userId);

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

		console.log(`[Usage] Tracked ${messageType} message for model: ${modelId} in period: ${period}`);
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

