/**
 * Citation format scoring for AI responses
 * 
 * Validates citation format compliance using the existing metadata parser
 */

import { parseResponseMetadata, hasResponseMetadata } from "../parsers/metadata-parser";

export interface CitationScoreResult {
	score: number;
	hasValidFormat: boolean;
	hasSequentialIds: boolean;
	hasMatchingReferences: boolean;
	citationCount: number;
	issues: string[];
}

/**
 * Validate citation format compliance
 * 
 * Scoring logic:
 * - 1.0: Perfect citation format with sequential IDs and matching references
 * - 0.7: Good format but minor issues (non-sequential IDs or missing references)
 * - 0.3: Has citations but invalid structure (missing required fields)
 * - 0.0: No citations when expected or completely invalid format
 */
export function scoreCitationFormat(output: string, expectsCitations: boolean): CitationScoreResult {
	const metadata = parseResponseMetadata(output);
	const result: CitationScoreResult = {
		score: 0,
		hasValidFormat: false,
		hasSequentialIds: false,
		hasMatchingReferences: false,
		citationCount: metadata.citations.length,
		issues: []
	};

	// If no citations expected, check that none are present
	if (!expectsCitations) {
		const hasMetadataInOutput = hasResponseMetadata(output);
		result.score = hasMetadataInOutput ? 0 : 1;
		if (hasMetadataInOutput) {
			result.issues.push("Citations found when none expected");
		}
		return result;
	}

	// Citations expected but none found
	if (metadata.citations.length === 0) {
		result.issues.push("No citations found when expected");
		return result;
	}

	// Check if citations are properly structured
	const hasValidSources = metadata.citations.every(source => 
		typeof source.id === 'number' && 
		typeof source.url === 'string' && 
		source.url.startsWith('http') &&
		typeof source.title === 'string'
	);

	if (!hasValidSources) {
		result.issues.push("Invalid citation structure (missing id, url, or title)");
		result.score = 0.3;
		return result;
	}

	result.hasValidFormat = true;

	// Check sequential IDs starting from 1
	const ids = metadata.citations.map(s => s.id).sort((a, b) => a - b);
	const expectedIds = Array.from({ length: ids.length }, (_, i) => i + 1);
	const hasSequentialIds = JSON.stringify(ids) === JSON.stringify(expectedIds);
	
	result.hasSequentialIds = hasSequentialIds;
	if (!hasSequentialIds) {
		result.issues.push("Citation IDs are not sequential starting from 1");
	}

	// Check in-text citations match sources
	const inTextCitations = (output.match(/\[(\d+)\]/g) ?? [])
		.map(m => parseInt(m.slice(1, -1)))
		.filter(id => !isNaN(id));
		
	const allReferencedCited = inTextCitations.every(id =>
		metadata.citations.some(source => source.id === id)
	);

	result.hasMatchingReferences = allReferencedCited;
	if (!allReferencedCited) {
		result.issues.push("In-text citations don't match citation sources");
	}

	// Calculate final score
	if (hasSequentialIds && allReferencedCited) {
		result.score = 1.0; // Perfect
	} else {
		result.score = 0.7; // Good but has issues
	}

	return result;
}

/**
 * Score citation completeness (how well citations support the content)
 */
export function scoreCitationCompleteness(output: string): number {
	const metadata = parseResponseMetadata(output);
	
	if (metadata.citations.length === 0) {
		return 0;
	}

	// Count claims that could benefit from citations
	const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 10);
	const factualClaims = sentences.filter(sentence => {
		// Heuristics for factual claims that should have citations
		const indicators = [
			/\b(according to|research shows|studies indicate|data suggests)\b/i,
			/\b(released|announced|published|launched)\b/i,
			/\b(statistics|survey|report|study)\b/i,
			/\b\d+(\.\d+)?%\b/, // Percentages
			/\bin (20\d{2}|January|February|March|April|May|June|July|August|September|October|November|December)\b/i // Dates/years
		];
		
		return indicators.some(pattern => pattern.test(sentence));
	});

	if (factualClaims.length === 0) {
		return 0.8; // No obvious factual claims, citations not critical
	}

	// Compare citation density to factual claim density
	const citationDensity = metadata.citations.length / sentences.length;
	const claimDensity = factualClaims.length / sentences.length;

	// Ideal ratio: roughly one citation per 2-3 factual claims
	const idealRatio = claimDensity / 2.5;
	const ratio = Math.min(citationDensity / idealRatio, 1);

	return Math.max(0.3, ratio); // Minimum score for having some citations
}