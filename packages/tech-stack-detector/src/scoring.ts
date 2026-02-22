import type { ConfidenceLevel, RuleMatch } from "./types.js";

/**
 * Noisy-OR confidence computation.
 * P(detected) = 1 - Product(1 - confidence_i) for all matching signals
 */
export function computeConfidence(signals: RuleMatch[]): number {
	if (signals.length === 0) return 0;

	let productComplement = 1;
	for (const s of signals) {
		productComplement *= 1 - s.confidence;
	}
	return 1 - productComplement;
}

export function confidenceLevel(score: number): ConfidenceLevel {
	if (score >= 0.8) return "detected";
	if (score >= 0.5) return "likely";
	return "possible";
}
