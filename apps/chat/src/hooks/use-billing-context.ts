import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/chat-trpc/react";
import { useUserPlan } from "./use-user-plan";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType, ClerkPlanKey } from "~/lib/billing/types";
import type { ChatRouterOutputs } from "@api/chat";

type UsageLimitsData = ChatRouterOutputs["usage"]["checkLimits"];

interface UseBillingContextOptions {
	/**
	 * Optional pre-fetched usage data (for batched queries)
	 * When provided, skips internal TRPC call
	 */
	externalUsageData?: UsageLimitsData;
}

/**
 * Unified billing context hook - single source of truth for all billing/usage logic
 * 
 * Provides domain-separated interfaces for:
 * - Model access control
 * - Feature restrictions  
 * - Usage tracking
 * - Plan information
 * 
 * Consolidates logic from use-user-plan, use-usage-limits, use-billing-limits
 */
export function useBillingContext({ externalUsageData }: UseBillingContextOptions = {}) {
	const { userPlan, planLimits, isAuthenticated, isLoaded, userId } = useUserPlan();
	const trpc = useTRPC();
	
	// Fetch current usage limits - use regular query for SSR compatibility
	// When external data is provided, this query is effectively bypassed
	const { data: fetchedUsageLimits, isLoading: isUsageLoading } = useQuery({
		...trpc.usage.checkLimits.queryOptions({}),
		enabled: isAuthenticated && !externalUsageData, // Only fetch when needed
		refetchInterval: 30000, // Keep usage current
		staleTime: 10000, // Fresh for 10 seconds
		retry: (failureCount, error) => {
			// Retry server errors only
			if ('status' in error && typeof error.status === 'number') {
				return error.status >= 500 && failureCount < 2;
			}
			return failureCount < 2;
		},
	});
	
	// Use external data if provided, otherwise use fetched data
	// Provide fallback for SSR/loading states
	const usageLimits = externalUsageData ?? fetchedUsageLimits ?? {
		usage: { nonPremiumMessages: 0, premiumMessages: 0 },
		remainingQuota: { 
			nonPremiumMessages: planLimits.nonPremiumMessagesPerMonth, 
			premiumMessages: planLimits.premiumMessagesPerMonth 
		},
		exceeded: { nonPremiumMessages: false, premiumMessages: false },
		period: new Date().toISOString().slice(0, 7) // YYYY-MM format
	};
	
	// Calculate remaining messages for each type
	const remainingMessages = useMemo(() => {
		if (!isAuthenticated) {
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
		if (!isAuthenticated) {
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
	
	// Get usage summary for display
	const usageSummary = useMemo(() => {
		if (!isAuthenticated) {
			return null;
		}
		
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
	
	// Plan-based capabilities
	const planCapabilities = useMemo(() => ({
		// Web search availability
		canUseWebSearch: planLimits.hasWebSearch,
		
		// Model access
		canUseAllModels: userPlan === ClerkPlanKey.PLUS_TIER,
		allowedModels: planLimits.allowedModels,
		
		// Message limits
		nonPremiumMessageLimit: planLimits.nonPremiumMessagesPerMonth,
		premiumMessageLimit: planLimits.premiumMessagesPerMonth,
		
		// Feature access
		canUsePremiumModels: planLimits.premiumMessagesPerMonth > 0,
		canUseArtifacts: isAuthenticated,
		
		// Plan details
		planName: userPlan === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free",
		isPlusUser: userPlan === ClerkPlanKey.PLUS_TIER,
		isFreeUser: userPlan === ClerkPlanKey.FREE_TIER,
	}), [planLimits, isAuthenticated, userPlan]);
	
	// ========================================
	// DOMAIN-SEPARATED INTERFACE
	// ========================================
	
	// MODEL ACCESS DOMAIN
	const isModelAccessible = useMemo(() => 
		(modelId: string, modelAccessLevel: "anonymous" | "authenticated", modelBillingTier: "non_premium" | "premium") => {
			// Check authentication requirement
			if (!isAuthenticated && modelAccessLevel === "authenticated") {
				return false;
			}
			
			// Check plan-based model restrictions
			if (!planCapabilities.canUseAllModels && !planCapabilities.allowedModels.includes(modelId)) {
				return false;
			}
			
			// Check premium model access
			if (modelBillingTier === "premium" && !planCapabilities.canUsePremiumModels) {
				return false;
			}
			
			return true;
		}
	, [isAuthenticated, planCapabilities]);
	
	const getModelRestrictionReason = useMemo(() =>
		(modelId: string, modelAccessLevel: "anonymous" | "authenticated", modelBillingTier: "non_premium" | "premium") => {
			if (!isAuthenticated && modelAccessLevel === "authenticated") {
				return "Authentication required";
			}
			
			if (!planCapabilities.canUseAllModels && !planCapabilities.allowedModels.includes(modelId)) {
				return planCapabilities.isPlusUser ? "Model not available" : "Upgrade to Plus required";
			}
			
			if (modelBillingTier === "premium" && !planCapabilities.canUsePremiumModels) {
				return "Upgrade to Plus required";
			}
			
			return null;
		}
	, [isAuthenticated, planCapabilities]);
	
	const models = useMemo(() => ({
		/**
		 * Check if a model is accessible to the current user
		 */
		isAccessible: isModelAccessible,
		
		/**
		 * Get reason why a model is not accessible
		 */
		getRestrictionReason: getModelRestrictionReason,
		
		/**
		 * Filter array of models to only include accessible ones
		 */
		filterAccessible: <T extends { id: string; accessLevel: "anonymous" | "authenticated"; billingTier: "non_premium" | "premium" }>(modelList: T[]): T[] => {
			return modelList.filter(model => 
				isModelAccessible(model.id, model.accessLevel, model.billingTier)
			);
		},
	}), [isModelAccessible, getModelRestrictionReason]);
	
	// FEATURE RESTRICTIONS DOMAIN
	const features = useMemo(() => ({
		webSearch: {
			enabled: planCapabilities.canUseWebSearch,
			disabledReason: planCapabilities.canUseWebSearch ? null : "Upgrade to Plus for web search",
		},
		
		artifacts: {
			enabled: planCapabilities.canUseArtifacts,
			disabledReason: planCapabilities.canUseArtifacts ? null : "Sign in to use artifacts",
		},
		
		premiumModels: {
			enabled: planCapabilities.canUsePremiumModels,
			disabledReason: planCapabilities.canUsePremiumModels ? null : "Upgrade to Plus for premium models",
		},
	}), [planCapabilities]);
	
	// USAGE TRACKING DOMAIN
	const usage = useMemo(() => ({
		/**
		 * Check if user can use a specific model (considers usage limits)
		 */
		canUseModel: (modelId: string) => {
				if (!isAuthenticated) {
				// For anonymous users, delegate to anonymous limit system
				return { allowed: true, reason: null };
			}
			
			if (isUsageLoading && !externalUsageData) {
				// Optimistically allow while loading
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
		},
		
		summary: usageSummary,
		remainingMessages,
		hasExceededLimits,
	}), [isAuthenticated, isUsageLoading, externalUsageData, hasExceededLimits, remainingMessages, usageSummary]);
	
	// PLAN INFORMATION DOMAIN
	const plan = useMemo(() => ({
		type: userPlan,
		limits: planLimits,
		capabilities: planCapabilities, // For backward compatibility
		isAuthenticated,
		isPlusUser: userPlan === ClerkPlanKey.PLUS_TIER,
		isFreeUser: userPlan === ClerkPlanKey.FREE_TIER,
		userId,
	}), [userPlan, planLimits, planCapabilities, isAuthenticated, userId]);
	
	return {
		// Domain interfaces
		models,
		features,
		usage,
		plan,
		
		// Loading states
		isLoaded: isLoaded && (!isAuthenticated || !isUsageLoading || !!externalUsageData),
		isLoading: isUsageLoading && !externalUsageData,
		error: null, // Handle errors gracefully
	};
}

/**
 * Simplified hook for just checking if a message can be sent
 */
export function useCanSendMessage(modelId: string | null) {
	const { usage, isLoaded } = useBillingContext();
	
	return useMemo(() => {
		if (!modelId || !isLoaded) {
			return { allowed: true, reason: null };
		}
		
		return usage.canUseModel(modelId);
	}, [modelId, usage.canUseModel, isLoaded]);
}