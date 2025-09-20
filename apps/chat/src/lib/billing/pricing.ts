import { BILLING_LIMITS, ClerkPlanKey  } from "./types";
import type {BillingInterval} from "./types";

/**
 * Centralized pricing configuration for Lightfast Chat
 *
 * This is the single source of truth for all pricing information,
 * used by both billing logic and pricing UI components.
 */

export interface PlanPricing {
	plan: ClerkPlanKey;
	name: string;
	description: string;
	price: number;
	currency: "USD";
	interval: BillingInterval;
	features: string[];
	popular?: boolean;
	buttonText: string;
	annualPrice?: number; // Monthly equivalent for annual billing (e.g., $8 for $96/year)
	annualTotal?: number; // Total annual price (e.g., $96)
	annualSavings?: number; // Percentage savings (e.g., 20 for 20% off)
}

export const PLAN_PRICING: Record<ClerkPlanKey, PlanPricing> = {
	[ClerkPlanKey.FREE_TIER]: {
		plan: ClerkPlanKey.FREE_TIER,
		name: "Free",
		description: "Get started with AI-powered conversations",
		price: 0,
		currency: "USD",
		interval: "month",
		buttonText: "Get Free",
		features: [
			`${BILLING_LIMITS[ClerkPlanKey.FREE_TIER].nonPremiumMessagesPerMonth.toLocaleString()} messages per month`,
			"Access to GPT-5 Nano",
			"Basic AI conversation capabilities",
			"Code generation and explanations",
			"General knowledge and assistance",
			"No credit card required",
		],
	},
	[ClerkPlanKey.PLUS_TIER]: {
		plan: ClerkPlanKey.PLUS_TIER,
		name: "Plus",
		description: "Unlock premium AI models and advanced features",
		price: 10,
		currency: "USD",
		interval: "month",
		buttonText: "Get Plus",
		popular: true,
		annualPrice: 8, // $8/month when billed annually
		annualTotal: 96, // $96/year total
		annualSavings: 20, // 20% savings ($120 -> $96)
		features: [
			"Everything in Free",
			`${BILLING_LIMITS[ClerkPlanKey.PLUS_TIER].nonPremiumMessagesPerMonth.toLocaleString()} standard + ${BILLING_LIMITS[ClerkPlanKey.PLUS_TIER].premiumMessagesPerMonth} premium messages per month`,
			"Access to premium models: Claude 4 Sonnet, GPT-5, GPT-5 Mini, Gemini 2.5 Pro & Flash, Kimi K2",
			"First access to the latest models as they're released",
			"File attachments and document analysis",
			"Real-time web search capabilities",
			"Create and download artifacts (code, documents, diagrams)",
			"Priority support and faster responses",
		],
	},
} as const;

/**
 * Get pricing information for a specific plan
 */
export function getPlanPricing(plan: ClerkPlanKey): PlanPricing {
	return PLAN_PRICING[plan];
}

/**
 * Get all available pricing plans
 */
export function getAllPlanPricing(): PlanPricing[] {
	return Object.values(PLAN_PRICING);
}

/**
 * Get pricing for display (with currency formatting)
 */
export function getFormattedPrice(plan: ClerkPlanKey, interval: BillingInterval = "month"): string {
	const pricing = getPlanPricing(plan);

	if (pricing.price === 0) {
		return "Free";
	}

	if (interval === "annual" && pricing.annualPrice) {
		return `$${pricing.annualPrice}/month`;
	}

	return `$${pricing.price}/${pricing.interval}`;
}

/**
 * Get pricing based on interval
 */
export function getPricingForInterval(plan: ClerkPlanKey, interval: BillingInterval): {
	price: number;
	displayPrice: string;
	totalPrice: number;
	savings?: number;
} {
	const pricing = getPlanPricing(plan);

	if (pricing.price === 0) {
		return {
			price: 0,
			displayPrice: "Free",
			totalPrice: 0,
		};
	}

	if (interval === "annual" && pricing.annualPrice && pricing.annualTotal) {
		return {
			price: pricing.annualPrice,
			displayPrice: `$${pricing.annualPrice}/month`,
			totalPrice: pricing.annualTotal,
			savings: pricing.annualSavings,
		};
	}

	return {
		price: pricing.price,
		displayPrice: `$${pricing.price}/month`,
		totalPrice: pricing.price,
	};
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(plan: ClerkPlanKey, feature: string): boolean {
	const pricing = getPlanPricing(plan);
	return pricing.features.some((f) =>
		f.toLowerCase().includes(feature.toLowerCase()),
	);
}

/**
 * Get the upgrade path for a plan
 */
export function getUpgradePath(currentPlan: ClerkPlanKey): ClerkPlanKey | null {
	if (currentPlan === ClerkPlanKey.FREE_TIER) {
		return ClerkPlanKey.PLUS_TIER;
	}
	return null; // Plus is the highest tier
}

/**
 * Calculate pricing comparison between plans
 */
export interface PricingComparison {
	from: PlanPricing;
	to: PlanPricing;
	monthlySavings: number;
	yearlyTotal: number;
	additionalFeatures: string[];
}

export function comparePlans(
	fromPlan: ClerkPlanKey,
	toPlan: ClerkPlanKey,
): PricingComparison {
	const from = getPlanPricing(fromPlan);
	const to = getPlanPricing(toPlan);

	const monthlySavings = from.price - to.price;
	const yearlyTotal = to.price * 12;

	// Get features that are in 'to' plan but not in 'from' plan
	const additionalFeatures = to.features.filter(
		(feature) =>
			!from.features.includes(feature) && feature !== "Everything in Free",
	);

	return {
		from,
		to,
		monthlySavings,
		yearlyTotal,
		additionalFeatures,
	};
}

/**
 * Get checkout-optimized feature list for display in checkout/upgrade components
 */
export function getCheckoutFeatures(planKey: ClerkPlanKey): string[] {
	const planConfig = BILLING_LIMITS[planKey];
	const planPricing = getPlanPricing(planKey);
	
	switch (planKey) {
		case ClerkPlanKey.FREE_TIER:
			return [
				`✓ ${planConfig.nonPremiumMessagesPerMonth.toLocaleString()} basic messages/month`,
				"✓ Access to basic AI model",
			];
		case ClerkPlanKey.PLUS_TIER:
			return [
				"✓ Everything in Free",
				`✓ ${planConfig.nonPremiumMessagesPerMonth.toLocaleString()} basic + ${planConfig.premiumMessagesPerMonth} premium messages/month`,
				"✓ Web search capability",
				"✓ Access to all AI models",
				"✓ Priority support",
			];
		default:
			// Fallback to pricing config features with checkmarks
			return planPricing.features.map(feature => feature.startsWith("✓") ? feature : `✓ ${feature}`);
	}
}

/**
 * Promotional pricing (for future use)
 */
export interface PromotionalPricing {
	originalPrice: number;
	discountedPrice: number;
	discountPercentage: number;
	validUntil: Date;
	promoCode?: string;
}

// Example promotional pricing structure for future use
export function getPromotionalPricing(
	_plan: ClerkPlanKey,
): PromotionalPricing | null {
	// This could be dynamically loaded from database or config
	// For now, return null (no active promotions)
	return null;
}

