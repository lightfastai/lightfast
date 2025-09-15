import { ACTIVE_MODELS } from "~/lib/ai/providers/models/active";
import { MessageType } from "./types";

/**
 * Client-safe utility functions for determining message types and model tiers
 * These functions can be used on both client and server side
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
 * Check if a model exists in our active models list
 */
export function isModelActive(modelId: string): boolean {
	return modelId in ACTIVE_MODELS;
}

/**
 * Get model billing tier directly
 */
export function getModelBillingTier(modelId: string): "premium" | "non_premium" {
	if (!(modelId in ACTIVE_MODELS)) return "premium"; // Default to premium for unknown models
	
	const model = ACTIVE_MODELS[modelId as keyof typeof ACTIVE_MODELS];
	return model.billingTier;
}