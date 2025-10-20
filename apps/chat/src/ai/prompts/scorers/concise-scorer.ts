/**
 * Concise response scoring for anonymous users
 * 
 * Evaluates responses based on length and information density to encourage
 * concise, focused answers while preventing resource abuse
 */

export interface ConciseScoreResult {
	score: number;
	lengthPenalty: number;
	reasonCode: string;
	actualLength: number;
	idealRange: [number, number];
}

export interface ConciseScoringOptions {
	/** Target length range for optimal scoring */
	idealRange: [number, number];
	/** Length where penalty starts applying */
	penaltyThreshold: number;
	/** Length where severe penalty applies */
	severePenaltyThreshold: number;
	/** Whether this is for anonymous users (stricter limits) */
	isAnonymous: boolean;
}

// Default scoring configuration
export const ANONYMOUS_CONCISE_CONFIG: ConciseScoringOptions = {
	idealRange: [200, 800],        // 200-800 chars is ideal for anonymous
	penaltyThreshold: 800,         // Start penalizing after 800 chars
	severePenaltyThreshold: 1500,  // Heavy penalty after 1500 chars
	isAnonymous: true,
};

export const AUTHENTICATED_CONCISE_CONFIG: ConciseScoringOptions = {
	idealRange: [300, 2000],       // More generous for authenticated users
	penaltyThreshold: 2000,        // Start penalizing after 2000 chars
	severePenaltyThreshold: 4000,  // Heavy penalty after 4000 chars
	isAnonymous: false,
};

/**
 * Score response conciseness for anonymous users
 * 
 * Scoring logic:
 * - 1.0: Within ideal range with good information density
 * - 0.8-0.9: Slightly outside ideal range but acceptable
 * - 0.5-0.7: Exceeds preferred length but still usable
 * - 0.0-0.4: Too verbose for anonymous users
 */
export function scoreConciseness(
	output: string,
	options: ConciseScoringOptions = ANONYMOUS_CONCISE_CONFIG
): ConciseScoreResult {
	const actualLength = output.length;
	const [idealMin, idealMax] = options.idealRange;
	
	// Perfect score within ideal range
	if (actualLength >= idealMin && actualLength <= idealMax) {
		return {
			score: 1.0,
			lengthPenalty: 0,
			reasonCode: "IDEAL_LENGTH",
			actualLength,
			idealRange: options.idealRange,
		};
	}
	
	// Too short - missing information
	if (actualLength < idealMin) {
		const shortnessPenalty = Math.max(0, (idealMin - actualLength) / idealMin);
		const score = Math.max(0.3, 1.0 - shortnessPenalty * 0.5);
		
		return {
			score,
			lengthPenalty: shortnessPenalty,
			reasonCode: "TOO_SHORT",
			actualLength,
			idealRange: options.idealRange,
		};
	}
	
	// Too long - apply progressive penalties
	if (actualLength > idealMax) {
		// Mild penalty zone (ideal_max to penalty_threshold)
		if (actualLength <= options.penaltyThreshold) {
			const mildExcess = actualLength - idealMax;
			const mildPenaltyRange = options.penaltyThreshold - idealMax;
			const mildPenalty = (mildExcess / mildPenaltyRange) * 0.2; // Up to 20% penalty
			const score = Math.max(0.6, 1.0 - mildPenalty);
			
			return {
				score,
				lengthPenalty: mildPenalty,
				reasonCode: "MILD_EXCESS",
				actualLength,
				idealRange: options.idealRange,
			};
		}
		
		// Severe penalty zone (penalty_threshold to severe_penalty_threshold)
		if (actualLength <= options.severePenaltyThreshold) {
			const severeExcess = actualLength - options.penaltyThreshold;
			const severePenaltyRange = options.severePenaltyThreshold - options.penaltyThreshold;
			const severePenalty = 0.2 + (severeExcess / severePenaltyRange) * 0.4; // 20-60% penalty
			const score = Math.max(0.2, 1.0 - severePenalty);
			
			return {
				score,
				lengthPenalty: severePenalty,
				reasonCode: "SEVERE_EXCESS",
				actualLength,
				idealRange: options.idealRange,
			};
		}
		
		// Extreme penalty zone (beyond severe_penalty_threshold)
		const extremePenalty = 0.8 + Math.min(0.2, (actualLength - options.severePenaltyThreshold) / 2000);
		const score = Math.max(0.0, 1.0 - extremePenalty);
		
		return {
			score,
			lengthPenalty: extremePenalty,
			reasonCode: "EXTREME_EXCESS",
			actualLength,
			idealRange: options.idealRange,
		};
	}
	
	// Fallback (shouldn't reach here)
	return {
		score: 0.5,
		lengthPenalty: 0.5,
		reasonCode: "UNKNOWN",
		actualLength,
		idealRange: options.idealRange,
	};
}

/**
 * Score information density (quality per character)
 * 
 * Higher scores for responses that pack more useful information
 * into fewer characters
 */
export function scoreInformationDensity(output: string): number {
	if (output.length === 0) return 0;
	
	// Simple heuristics for information density
	const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
	const words = output.split(/\s+/).filter(w => w.length > 0);
	const technicalTerms = (output.match(/\b[A-Z][a-z]*[A-Z]\w*\b|\b\w+\(\)\b|\b\d+\.\d+\b/g) ?? []).length;
	const citations = (output.match(/\[\d+\]/g) ?? []).length;
	
	// Information density factors
	const averageWordsPerSentence = words.length / Math.max(1, sentences.length);
	const technicalDensity = technicalTerms / Math.max(1, words.length) * 100;
	const citationDensity = citations / Math.max(1, sentences.length);
	
	// Score based on information richness
	let densityScore = 0.5; // Base score
	
	// Reward moderate sentence length (not too short, not too long)
	if (averageWordsPerSentence >= 8 && averageWordsPerSentence <= 20) {
		densityScore += 0.2;
	}
	
	// Reward technical content
	if (technicalDensity > 2) densityScore += 0.2;
	if (technicalDensity > 5) densityScore += 0.1;
	
	// Reward citations
	if (citations > 0) densityScore += 0.1;
	if (citationDensity > 0.3) densityScore += 0.1;
	
	return Math.min(1.0, densityScore);
}

/**
 * Combined concise scoring for anonymous users
 * 
 * Balances length constraints with information quality
 */
export function scoreAnonymousConciseness(output: string): {
	conciseScore: ConciseScoreResult;
	densityScore: number;
	combinedScore: number;
	recommendedAction: string;
} {
	const conciseScore = scoreConciseness(output, ANONYMOUS_CONCISE_CONFIG);
	const densityScore = scoreInformationDensity(output);
	
	// Weight: 70% length compliance, 30% information density
	const combinedScore = conciseScore.score * 0.7 + densityScore * 0.3;
	
	// Determine recommended action
	let recommendedAction = "ACCEPT";
	if (combinedScore < 0.6) {
		recommendedAction = "IMPROVE_CONCISENESS";
	} else if (conciseScore.reasonCode === "TOO_SHORT") {
		recommendedAction = "ADD_MORE_DETAIL";
	} else if (conciseScore.reasonCode.includes("EXCESS")) {
		recommendedAction = "REDUCE_LENGTH";
	}
	
	return {
		conciseScore,
		densityScore,
		combinedScore,
		recommendedAction,
	};
}