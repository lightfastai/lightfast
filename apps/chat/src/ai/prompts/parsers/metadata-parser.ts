/**
 * Extensible metadata parser for AI responses
 * 
 * Supports the new ---METADATA--- format while maintaining backward compatibility
 */

import type { ResponseMetadata, CitationMetadata } from "../metadata";
import type { CitationSource } from "@repo/ui/lib/citation-parser";

export interface ParsedMetadata {
	citations: CitationSource[];
	confidence?: number;
	// Extensible for future metadata types
	raw?: ResponseMetadata;
}

/**
 * Parse metadata from AI response text (new extensible format + backward compatibility)
 */
export function parseResponseMetadata(text: string): ParsedMetadata {
	if (!text) return { citations: [] };

	// Try new ---METADATA--- format first
	const metadata = parseMetadataFormat(text);
	if (metadata.citations.length > 0 || metadata.raw) {
		return metadata;
	}

	// Fall back to legacy ---CITATIONS--- format
	const legacyCitations = parseLegacyCitationsFormat(text);
	if (legacyCitations.length > 0) {
		return { citations: legacyCitations };
	}

	// Fall back to legacy text-based citations
	const textCitations = parseLegacyTextCitations(text);
	return { citations: textCitations };
}

/**
 * Parse new ---METADATA--- format
 */
function parseMetadataFormat(text: string): ParsedMetadata {
	try {
		const delimiter = '---METADATA---';
		const delimiterIndex = text.indexOf(delimiter);
		
		if (delimiterIndex === -1) {
			return { citations: [] };
		}
		
		// Extract JSON block after delimiter
		const jsonBlock = text.substring(delimiterIndex + delimiter.length).trim();
		const parsed = JSON.parse(jsonBlock) as ResponseMetadata;
		
		const result: ParsedMetadata = {
			citations: [],
			raw: parsed
		};

		// Extract citations if present
		if (parsed.citations && Array.isArray(parsed.citations)) {
			result.citations = parsed.citations.map(citation => ({
				id: citation.id,
				url: citation.url,
				title: citation.title || generateSourceTitle(citation.url),
				snippet: citation.snippet
			}));
		}

		// Extract confidence if present
		if (parsed.confidence) {
			result.confidence = typeof parsed.confidence === 'object' 
				? parsed.confidence.score 
				: parsed.confidence;
		}

		return result;
	} catch (e) {
		// JSON parsing failed, return empty result
		return { citations: [] };
	}
}

/**
 * Parse legacy ---CITATIONS--- format for backward compatibility
 */
function parseLegacyCitationsFormat(text: string): CitationSource[] {
	try {
		const citationDelimiter = '---CITATIONS---';
		const delimiterIndex = text.indexOf(citationDelimiter);
		
		if (delimiterIndex === -1) {
			return [];
		}
		
		// Extract JSON block after delimiter
		const jsonBlock = text.substring(delimiterIndex + citationDelimiter.length).trim();
		const parsed = JSON.parse(jsonBlock) as { citations: CitationSource[] };
		
		if (parsed?.citations && Array.isArray(parsed.citations)) {
			return parsed.citations.map(citation => ({
				id: citation.id,
				url: citation.url,
				title: citation.title || generateSourceTitle(citation.url),
				snippet: citation.snippet
			}));
		}
	} catch (e) {
		// JSON parsing failed
	}
	
	return [];
}

/**
 * Parse legacy text citation format for backward compatibility
 */
function parseLegacyTextCitations(text: string): CitationSource[] {
	const sources: CitationSource[] = [];
	
	// Find citation list at the end (lines starting with [number] url)
	const citationListRegex = /\[(\d+)\]\s+(https?:\/\/[^\s]+)/gm;
	const citationMatches = [...text.matchAll(citationListRegex)];
	
	// Extract URLs in order and create CitationSource objects
	for (const match of citationMatches) {
		const [, idStr, url] = match;
		if (url && idStr) {
			sources.push({
				id: parseInt(idStr, 10),
				url,
				title: generateSourceTitle(url)
			});
		}
	}
	
	return sources;
}

/**
 * Check if text contains any numbered citations
 */
export function hasResponseMetadata(text: string): boolean {
	// Check for new format
	if (text.includes('---METADATA---')) return true;
	
	// Check for legacy formats
	if (text.includes('---CITATIONS---')) return true;
	
	// Check for in-text citations
	const citationRegex = /\[(\d+)\]/;
	return citationRegex.test(text);
}

/**
 * Generate a meaningful title from URL - universal approach
 */
function generateSourceTitle(url: string): string {
	try {
		const urlObj = new URL(url);
		const domain = urlObj.hostname.replace('www.', '');
		const path = urlObj.pathname;
		
		// Get all path segments, filtering out empty ones
		const pathParts = path.split('/').filter(part => part && part !== 'index');
		
		// Look for the most meaningful path segment (usually the last non-empty one)
		let title = '';
		
		if (pathParts.length > 0) {
			// Start with the last segment and work backwards to find something meaningful
			for (let i = pathParts.length - 1; i >= 0; i--) {
				const segment = pathParts[i];
				
				// Skip undefined segments and common non-meaningful segments
				if (!segment || isNonMeaningfulSegment(segment)) {
					continue;
				}
				
				// Clean up the segment
				const cleaned = cleanUrlSegment(segment);
				
				// If we got something meaningful, use it
				if (cleaned.length > 2) {
					title = cleaned;
					break;
				}
			}
		}
		
		// If we couldn't extract a meaningful title from path, use domain
		if (!title) {
			// Extract main domain name (remove common TLDs and subdomains)
			const domainParts = domain.split('.');
			if (domainParts.length >= 2) {
				title = domainParts[domainParts.length - 2] || ''; // Get the main domain name
			} else {
				title = domainParts[0] || '';
			}
		}
		
		return titleCase(title);
		
	} catch (e) {
		return 'External Source';
	}
}

/**
 * Check if a URL segment is not meaningful for title generation
 */
function isNonMeaningfulSegment(segment: string): boolean {
	const nonMeaningful = [
		// File extensions that don't add meaning
		/\.(html|htm|php|asp|aspx|jsp)$/i,
		// Generic segments
		/^(index|default|home|page|main)$/i,
		// Very short segments
		/^.{1,2}$/,
		// Pure numbers (usually IDs)
		/^\d+$/,
		// Common generic paths
		/^(src|assets|public|static|img|images|js|css)$/i,
	];
	
	return nonMeaningful.some(pattern => pattern.test(segment));
}

/**
 * Clean a URL segment to make it human-readable
 */
function cleanUrlSegment(segment: string): string {
	return segment
		// Remove file extensions
		.replace(/\.(html|htm|php|asp|aspx|jsp|pdf|doc|docx)$/i, '')
		// Convert dashes and underscores to spaces
		.replace(/[-_]/g, ' ')
		// Remove URL encoding
		.replace(/%20/g, ' ')
		// Clean up extra spaces
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Convert string to title case
 */
function titleCase(str: string): string {
	return str.replace(/\w\S*/g, (txt) => 
		txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
	);
}