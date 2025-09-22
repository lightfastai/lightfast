import { auth } from "@clerk/nextjs/server";
import { ClerkPlanKey, BILLING_LIMITS, hasClerkPlan } from "~/lib/billing/types";
import { buildAnonymousSystemPrompt, buildAuthenticatedSystemPrompt, buildSystemPrompt } from "~/ai/prompts/builders/system-prompt-builder";
import type { c010Tools } from "./tools";

/**
 * Get user's billing plan from Clerk authentication
 */
export const getUserPlan = async (): Promise<ClerkPlanKey> => {
	try {
		const { has } = await auth();
		const hasPlusPlan = hasClerkPlan(has, ClerkPlanKey.PLUS_TIER);
		return hasPlusPlan ? ClerkPlanKey.PLUS_TIER : ClerkPlanKey.FREE_TIER;
	} catch (error) {
		console.warn('[Billing] Failed to get user plan, defaulting to FREE_TIER:', error);
		return ClerkPlanKey.FREE_TIER;
	}
};

// Get active tool names based on authentication status, user plan, and user preferences
export const getActiveToolsForUser = (isAnonymous: boolean, userPlan: ClerkPlanKey, webSearchEnabled: boolean): (keyof typeof c010Tools)[] | undefined => {
	if (isAnonymous) {
		// Anonymous users: only web search tool can be active, and only if enabled
		return webSearchEnabled ? ["webSearch"] : [];
	} else {
		// Authenticated users: tools based on plan and preferences
		const activeTools: (keyof typeof c010Tools)[] = ["createDocument"]; // All authenticated users get artifacts
		
		if (webSearchEnabled) {
			// Check if user's plan allows web search
			const planLimits = BILLING_LIMITS[userPlan];
			if (planLimits.hasWebSearch) {
				activeTools.push("webSearch");
			}
			// If user doesn't have web search access, silently don't add the tool
			// The client should already prevent this, but this is server-side enforcement
		}
		
		return activeTools;
	}
};

// Create conditional system prompts based on authentication status using centralized builders
export const createSystemPromptForUser = (isAnonymous: boolean, webSearchEnabled: boolean): string => {
    // Use the generic builder to thread webSearchEnabled without changing eval call sites elsewhere
    return buildSystemPrompt({
        isAnonymous,
        includeCitations: true,
        includeCodeFormatting: !isAnonymous ? false : true,
        webSearchEnabled,
    });
};
