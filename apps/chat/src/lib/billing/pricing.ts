import type { BillingPlan } from "./types";
import { BILLING_LIMITS } from "./types";

/**
 * Centralized pricing configuration for Lightfast Chat
 *
 * This is the single source of truth for all pricing information,
 * used by both billing logic and pricing UI components.
 */

export interface PlanPricing {
	plan: BillingPlan;
	name: string;
	description: string;
	price: number;
	currency: "USD";
	interval: "month";
	features: string[];
	popular?: boolean;
	buttonText: string;
}

export const PLAN_PRICING: Record<BillingPlan, PlanPricing> = {
	free: {
		plan: "free",
		name: "Free",
		description: "Get started with AI-powered conversations",
		price: 0,
		currency: "USD",
		interval: "month",
		buttonText: "Get Free",
		features: [
			`${BILLING_LIMITS.free.nonPremiumMessagesPerMonth.toLocaleString()} messages per month`,
			"Access to GPT-5 Nano",
			"Basic AI conversation capabilities",
			"Code generation and explanations",
			"General knowledge and assistance",
			"No credit card required",
		],
	},
	plus: {
		plan: "plus",
		name: "Plus",
		description: "Unlock premium AI models and advanced features",
		price: 10,
		currency: "USD",
		interval: "month",
		buttonText: "Get Plus",
		popular: true,
		features: [
			"Everything in Free",
			`${BILLING_LIMITS.plus.nonPremiumMessagesPerMonth.toLocaleString()} standard + ${BILLING_LIMITS.plus.premiumMessagesPerMonth} premium messages per month`,
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
export function getPlanPricing(plan: BillingPlan): PlanPricing {
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
export function getFormattedPrice(plan: BillingPlan): string {
	const pricing = getPlanPricing(plan);

	if (pricing.price === 0) {
		return "Free";
	}

	return `$${pricing.price}/${pricing.interval}`;
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(plan: BillingPlan, feature: string): boolean {
	const pricing = getPlanPricing(plan);
	return pricing.features.some((f) =>
		f.toLowerCase().includes(feature.toLowerCase()),
	);
}

/**
 * Get the upgrade path for a plan
 */
export function getUpgradePath(currentPlan: BillingPlan): BillingPlan | null {
	if (currentPlan === "free") {
		return "plus";
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
	fromPlan: BillingPlan,
	toPlan: BillingPlan,
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
	plan: BillingPlan,
): PromotionalPricing | null {
	// This could be dynamically loaded from database or config
	// For now, return null (no active promotions)
	return null;
}

