import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

interface UseBillingLimitsOptions {
	enabled?: boolean;
}

/**
 * Hook for checking billing limits for the current authenticated user
 * Returns usage limits, current usage, and remaining quota
 */
export function useBillingLimits({ enabled = true }: UseBillingLimitsOptions = {}) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.checkLimits.queryOptions({}),
		enabled: enabled,
		staleTime: 1000 * 60 * 1, // 1 minute - usage can change frequently
		gcTime: 1000 * 60 * 5, // 5 minutes
	});
}

/**
 * Hook for checking if user can send a message of a specific type
 */
export function useCanSendMessage(messageType: 'nonPremium' | 'premium' = 'nonPremium') {
	const { data: limits, isLoading } = useBillingLimits();

	if (isLoading || !limits) {
		return {
			canSend: true, // Default to allowing while loading
			reason: undefined,
			remainingMessages: undefined,
			isLoading: true,
		};
	}

	const exceeded = messageType === 'premium' 
		? limits.exceeded.premiumMessages 
		: limits.exceeded.nonPremiumMessages;

	const remaining = messageType === 'premium'
		? limits.remainingQuota.premiumMessages
		: limits.remainingQuota.nonPremiumMessages;

	return {
		canSend: !exceeded,
		reason: exceeded 
			? `${messageType === 'premium' ? 'Premium' : 'Monthly'} message limit exceeded`
			: undefined,
		remainingMessages: remaining,
		isLoading: false,
	};
}

/**
 * Hook for getting user's current month usage
 */
export function useCurrentUsage() {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.getCurrentMonth.queryOptions(),
		staleTime: 1000 * 30, // 30 seconds - refresh frequently for current usage
		gcTime: 1000 * 60 * 2, // 2 minutes
	});
}