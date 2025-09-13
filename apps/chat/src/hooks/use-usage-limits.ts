import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useUserPlan } from "./use-user-plan";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType, ClerkPlanKey } from "~/lib/billing/types";
import type { ChatRouterOutputs } from "@api/chat";

type UsageLimitsData = ChatRouterOutputs["usage"]["checkLimits"];

/**
 * Client-side hook for checking usage limits for authenticated users
 * 
 * This hook fetches current usage via TRPC and provides functions to check
 * if messages can be sent based on the user's plan and current usage.
 * 
 * @param externalUsageData - Optional pre-fetched usage data (for batched queries)
 */
export function useUsageLimits(externalUsageData?: UsageLimitsData) {
	const { userPlan, planLimits, isAuthenticated, isLoaded } = useUserPlan();
	const trpc = useTRPC();
	
	// Fetch current usage limits (only for authenticated users and when no external data)
	const { 
		data: fetchedUsageLimits, 
		isLoading: isUsageLoading,
		error: usageError 
	} = useQuery({
		...trpc.usage.checkLimits.queryOptions({}), // Empty params since server uses auth context
		enabled: isAuthenticated && isLoaded && !externalUsageData, // Skip fetch if external data provided
		refetchInterval: 30000, // Refetch every 30 seconds to keep usage current
		staleTime: 10000, // Consider data stale after 10 seconds
		retry: (failureCount, error) => {
			// Don't retry on client errors, but retry on server errors
			if ('status' in error && typeof error.status === 'number') {
				return error.status >= 500 && failureCount < 2;
			}
			return failureCount < 2;
		},
	});
	
	// Use external data if provided, otherwise use fetched data
	const usageLimits = externalUsageData ?? fetchedUsageLimits;
	
	// Calculate remaining messages for each type
	const remainingMessages = useMemo(() => {
		if (!usageLimits || !isAuthenticated) {
			return {
				nonPremium: planLimits.nonPremiumMessagesPerMonth,
				premium: planLimits.premiumMessagesPerMonth,
			};
		}
		
		return {
			nonPremium: usageLimits.remainingQuota.nonPremiumMessages,
			premium: usageLimits.remainingQuota.premiumMessages,
		};
	}, [usageLimits, isAuthenticated, planLimits]);
	
	// Check if user has exceeded limits
	const hasExceededLimits = useMemo(() => {
		if (!usageLimits || !isAuthenticated) {
			return {
				nonPremium: false,
				premium: false,
			};
		}
		
		return {
			nonPremium: usageLimits.exceeded.nonPremiumMessages,
			premium: usageLimits.exceeded.premiumMessages,
		};
	}, [usageLimits, isAuthenticated]);
	
	// Function to check if a specific model can be used
	const canUseModel = useMemo(() => {
		return (modelId: string) => {
			if (!isAuthenticated) {
				// For anonymous users, delegate to anonymous message limit system
				return { allowed: true, reason: null };
			}
			
			if (isUsageLoading && !externalUsageData) {
				// If loading and no external data, optimistically allow (server will validate)
				return { allowed: true, reason: null };
			}
			
			if (usageError) {
				// If there's an error, log it but optimistically allow
				console.warn('[Usage Limits] Error fetching usage data, allowing optimistically:', usageError);
				return { allowed: true, reason: null };
			}
			
			const messageType = getMessageType(modelId);
			
			if (messageType === MessageType.PREMIUM) {
				if (hasExceededLimits.premium) {
					return {
						allowed: false,
						reason: "Premium message limit exceeded. Upgrade or wait for next month.",
						remainingMessages: remainingMessages.premium,
					};
				}
			} else {
				if (hasExceededLimits.nonPremium) {
					return {
						allowed: false,
						reason: "Monthly message limit exceeded. Upgrade or wait for next month.",
						remainingMessages: remainingMessages.nonPremium,
					};
				}
			}
			
			return {
				allowed: true,
				reason: null,
				remainingMessages: messageType === MessageType.PREMIUM 
					? remainingMessages.premium 
					: remainingMessages.nonPremium,
			};
		};
	}, [isAuthenticated, isUsageLoading, usageLimits, usageError, hasExceededLimits, remainingMessages]);
	
	// Get usage summary for display
	const usageSummary = useMemo(() => {
		if (!isAuthenticated || !usageLimits) {
			return null;
		}
		
		// Debug logging for missing data structures
		// usageLimits.usage is always defined at this point
		
		// Handle case where usage doesn't exist (new users)
		// The TRPC response has 'usage' property, not 'currentUsage'
		const currentUsage = usageLimits.usage;
		
		return {
			nonPremiumUsed: currentUsage.nonPremiumMessages,
			nonPremiumLimit: planLimits.nonPremiumMessagesPerMonth,
			nonPremiumRemaining: remainingMessages.nonPremium,
			
			premiumUsed: currentUsage.premiumMessages,
			premiumLimit: planLimits.premiumMessagesPerMonth,
			premiumRemaining: remainingMessages.premium,
			
			period: usageLimits.period,
		};
	}, [isAuthenticated, usageLimits, planLimits, remainingMessages]);
	
	return {
		// Core functions
		canUseModel,
		
		// Usage data
		usageSummary,
		remainingMessages,
		hasExceededLimits,
		
		// Loading states
		isLoading: isUsageLoading && !externalUsageData,
		isLoaded: isLoaded && (!isAuthenticated || !isUsageLoading || !!externalUsageData),
		error: usageError,
		
		// Plan context
		userPlan,
		planLimits,
		isAuthenticated,
		
		// Plan-based capabilities (for backward compatibility)
		capabilities: {
			canUseWebSearch: planLimits.hasWebSearch,
			canUseAllModels: planLimits.allowedModels.length === 0,
			allowedModels: planLimits.allowedModels,
			nonPremiumMessageLimit: planLimits.nonPremiumMessagesPerMonth,
			premiumMessageLimit: planLimits.premiumMessagesPerMonth,
			canUsePremiumModels: planLimits.premiumMessagesPerMonth > 0,
			canUseArtifacts: isAuthenticated,
			planName: userPlan === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free",
			isPlusUser: userPlan === ClerkPlanKey.PLUS_TIER,
			isFreeUser: userPlan === ClerkPlanKey.FREE_TIER,
		},
	};
}

/**
 * Simplified hook for just checking if a message can be sent
 */
export function useCanSendMessage(modelId: string | null) {
	const { canUseModel, isLoaded } = useUsageLimits();
	
	return useMemo(() => {
		if (!modelId || !isLoaded) {
			return { allowed: true, reason: null };
		}
		
		return canUseModel(modelId);
	}, [modelId, canUseModel, isLoaded]);
}