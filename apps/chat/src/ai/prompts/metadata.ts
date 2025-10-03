/**
 * Extensible metadata system for AI responses
 *
 * Supports multiple types of structured metadata at the end of responses
 */

export interface CitationMetadata {
	citations: {
		id: number;
		url: string;
		title: string;
		snippet?: string;
	}[];
}

export interface ConfidenceMetadata {
	confidence: {
		score: number; // 0-1
		reasoning?: string;
	};
}

export interface FactCheckMetadata {
	fact_checks: {
		claim: string;
		verified: boolean;
		source?: string;
	}[];
}

// Extensible metadata container
export interface ResponseMetadata
	extends Partial<CitationMetadata>,
		Partial<ConfidenceMetadata>,
		Partial<FactCheckMetadata> {
	// Additional metadata types can be added here
}

export type AdditionalMetadata = Record<string, unknown>;

/**
 * Metadata format instructions for prompts
 */
export const METADATA_FORMAT_SECTION = `RESPONSE METADATA:
When providing structured data like citations, confidence scores, or tool usage, end your complete response with a metadata section.

Format: Use ---METADATA--- followed by JSON data containing the relevant metadata types.

Example response format:
React 19 introduces server components [1] which work seamlessly with Next.js [2]. This approach simplifies state management [3].

---METADATA---
{
  "citations": [
    {"id": 1, "url": "https://react.dev/blog/react-19", "title": "React 19 Release", "snippet": "Introducing server components for better performance"},
    {"id": 2, "url": "https://nextjs.org/docs/app-router", "title": "Next.js App Router", "snippet": "Complete guide to the new routing system"},
    {"id": 3, "url": "https://docs.example.com/state", "title": "State Management Guide"}
  ]
}

Available metadata types:
- "citations": Array of source references with numbered IDs
- "confidence": Confidence score and reasoning for the response
- "fact_checks": Verified claims and their sources

Citation Rules (when including citations):
- Use numbered citations [1], [2], [3] in your response text
- Include sequential IDs starting from 1
- Provide URLs and titles (snippets are optional)
- Only cite facts, statistics, API details, version numbers, quotes
- Don't cite common knowledge or your own analysis`;

/**
 * Citation-specific metadata instructions (backward compatibility)
 */
export const CITATION_METADATA_SECTION = `CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.

Format: Use [1], [2], [3] etc. in your text, then end your complete response with metadata.

Example response format:
React 19 introduces server components [1] which work seamlessly with Next.js [2]. This approach simplifies state management [3].

---METADATA---
{
  "citations": [
    {"id": 1, "url": "https://react.dev/blog/react-19", "title": "React 19 Release", "snippet": "Introducing server components for better performance"},
    {"id": 2, "url": "https://nextjs.org/docs/app-router", "title": "Next.js App Router", "snippet": "Complete guide to the new routing system"},
    {"id": 3, "url": "https://docs.example.com/state", "title": "State Management Guide"}
  ]
}

Rules:
- Use numbered citations [1], [2], [3] in your response text
- Always end with ---METADATA--- followed by JSON data
- Include sequential IDs starting from 1
- Provide URLs and titles (snippets are optional)
- Only cite facts, statistics, API details, version numbers, quotes
- Don't cite common knowledge or your own analysis`;

