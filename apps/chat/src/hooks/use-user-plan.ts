import { useMemo } from "react";
import { ClerkPlanKey, BILLING_LIMITS, hasClerkPlan } from "~/lib/billing/types";
import type { BillingLimits } from "~/lib/billing/types";
import { useAuth } from "@clerk/nextjs";

/**
 * Hook for detecting user's billing plan and providing plan-based capabilities
 * 
 * This hook integrates with Clerk authentication to determine the user's plan
 * and provides plan-specific limits and capabilities for the chat interface.
 */
export function useUserPlan() {
	const { has, isLoaded, userId } = useAuth();
	
	// Determine user's plan based on Clerk subscription
	const userPlan = useMemo((): ClerkPlanKey => {
		if (!isLoaded || !userId) {
			return ClerkPlanKey.FREE_TIER;
		}
		
		// Check if user has Plus plan subscription
		const hasPlusPlan = hasClerkPlan(has, ClerkPlanKey.PLUS_TIER);
		return hasPlusPlan ? ClerkPlanKey.PLUS_TIER : ClerkPlanKey.FREE_TIER;
	}, [has, isLoaded, userId]);
	
	// Get plan-specific billing limits
	const planLimits = useMemo((): BillingLimits => {
		return BILLING_LIMITS[userPlan];
	}, [userPlan]);
	
	// Determine if user is authenticated
	const isAuthenticated = isLoaded && userId !== null;
	
	// Plan-based capabilities
	const capabilities = useMemo(() => ({
		// Web search availability
		canUseWebSearch: planLimits.hasWebSearch,
		
		// Model access
		canUseAllModels: userPlan === ClerkPlanKey.PLUS_TIER, // Plus users can use all available models
		allowedModels: planLimits.allowedModels,
		
		// Message limits
		nonPremiumMessageLimit: planLimits.nonPremiumMessagesPerMonth,
		premiumMessageLimit: planLimits.premiumMessagesPerMonth,
		
		// Feature access
		canUsePremiumModels: planLimits.premiumMessagesPerMonth > 0,
		canUseArtifacts: isAuthenticated, // Artifacts require authentication
		
		// Plan details
		planName: userPlan === ClerkPlanKey.PLUS_TIER ? "Plus" : "Free",
		isPlusUser: userPlan === ClerkPlanKey.PLUS_TIER,
		isFreeUser: userPlan === ClerkPlanKey.FREE_TIER,
	}), [planLimits, isAuthenticated, userPlan]);
	
	return {
		userPlan,
		planLimits,
		capabilities,
		isAuthenticated,
		isLoaded,
		userId,
	};
}

/**
 * Helper hook for model filtering based on user's plan
 */
export function useModelFiltering() {
	const { capabilities, isAuthenticated } = useUserPlan();
	
	return useMemo(() => ({
		/**
		 * Check if a model is accessible to the current user
		 */
		isModelAccessible: (modelId: string, modelAccessLevel: "anonymous" | "authenticated", modelBillingTier: "non_premium" | "premium") => {
			// Check authentication requirement
			if (!isAuthenticated && modelAccessLevel === "authenticated") {
				return false;
			}
			
			// Check plan-based model restrictions
			if (!capabilities.canUseAllModels && !capabilities.allowedModels.includes(modelId)) {
				return false;
			}
			
			// Check premium model access
			if (modelBillingTier === "premium" && !capabilities.canUsePremiumModels) {
				return false;
			}
			
			return true;
		},
		
		/**
		 * Get reason why a model is not accessible
		 */
		getModelRestrictionReason: (modelId: string, modelAccessLevel: "anonymous" | "authenticated", modelBillingTier: "non_premium" | "premium") => {
			if (!isAuthenticated && modelAccessLevel === "authenticated") {
				return "Authentication required";
			}
			
			if (!capabilities.canUseAllModels && !capabilities.allowedModels.includes(modelId)) {
				return capabilities.isPlusUser ? "Model not available" : "Upgrade to Plus required";
			}
			
			if (modelBillingTier === "premium" && !capabilities.canUsePremiumModels) {
				return "Upgrade to Plus required";
			}
			
			return null;
		},
	}), [capabilities, isAuthenticated]);
}

/**
 * Helper hook for feature restrictions based on user's plan
 */
export function useFeatureRestrictions() {
	const { capabilities } = useUserPlan();
	
	return {
		webSearch: {
			enabled: capabilities.canUseWebSearch,
			disabledReason: capabilities.canUseWebSearch ? null : "Upgrade to Plus for web search",
		},
		
		artifacts: {
			enabled: capabilities.canUseArtifacts,
			disabledReason: capabilities.canUseArtifacts ? null : "Sign in to use artifacts",
		},
		
		premiumModels: {
			enabled: capabilities.canUsePremiumModels,
			disabledReason: capabilities.canUsePremiumModels ? null : "Upgrade to Plus for premium models",
		},
	};
}