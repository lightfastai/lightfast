/**
 * Simplified tools for evaluation that actually execute
 * These test real tool calling without complex server dependencies
 */

import { z } from "zod";

// Simple document creation tool for evaluation
export const createDocumentEvalTool = {
	description: "Create a document for coding, writing, or content creation activities",
	inputSchema: z.object({
		title: z.string().describe("The title of the document (2-4 words maximum)"),
		kind: z.enum(["code", "diagram", "text"]).describe("The type of document to create"),
	}),
	execute: async ({ title, kind }: { title: string; kind: "code" | "diagram" | "text" }) => {
		// Simulate actual document creation
		const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		// Validate inputs (this will actually test parameter handling)
		if (!title || title.trim().length === 0) {
			throw new Error("Title cannot be empty");
		}
		
		if (title.split(' ').length > 6) {
			throw new Error("Title too long - should be 2-4 words maximum");
		}
		
		// Generate content based on type
		let content = "";
		switch (kind) {
			case "code":
				content = `// ${title}\n// Generated code document\nconsole.log("Hello from ${title}");`;
				break;
			case "diagram":
				content = `graph TD\n    A[${title}] --> B[Implementation]\n    B --> C[Result]`;
				break;
			case "text":
				content = `# ${title}\n\nThis is a text document about ${title}.\n\n## Content\n\nDocument content goes here.`;
				break;
		}
		
		return {
			id,
			title,
			kind,
			content,
			success: true,
			timestamp: new Date().toISOString(),
		};
	}
};

// Simple web search tool for evaluation (mock but realistic)
export const webSearchEvalTool = {
	description: "Search the web for information",
	inputSchema: z.object({
		query: z.string().describe("The search query"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results to return"),
		contentType: z.enum(["highlights", "summary", "text"]).default("highlights").describe("Type of content to retrieve"),
	}),
	execute: async ({ query, numResults = 5, contentType = "highlights" }: { 
		query: string; 
		numResults?: number; 
		contentType?: "highlights" | "summary" | "text" 
	}) => {
		// Validate inputs
		if (!query || query.trim().length === 0) {
			throw new Error("Query cannot be empty");
		}
		
		if (numResults < 1 || numResults > 10) {
			throw new Error("Number of results must be between 1 and 10");
		}
		
		// Simulate search results (realistic but controlled)
		const results = [];
		for (let i = 0; i < numResults; i++) {
			const resultId = i + 1;
			let content = "";
			
			switch (contentType) {
				case "highlights":
					content = `Key information about ${query} from source ${resultId}...`;
					break;
				case "summary": 
					content = `Summary: ${query} is a topic with multiple aspects including...`;
					break;
				case "text":
					content = `Full text content about ${query} from source ${resultId}. This contains detailed information...`;
					break;
			}
			
			results.push({
				title: `${query} - Result ${resultId}`,
				url: `https://example.com/search/${resultId}`,
				content,
				score: 1.0 - (i * 0.1), // Decreasing relevance score
			});
		}
		
		return {
			query,
			numResults,
			contentType,
			results,
			success: true,
			timestamp: new Date().toISOString(),
			totalFound: results.length,
		};
	}
};

// Calculator tool for testing complex parameters
export const calculatorEvalTool = {
	description: "Perform mathematical calculations",
	inputSchema: z.object({
		operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("Mathematical operation"),
		a: z.number().describe("First number"),
		b: z.number().describe("Second number"),
	}),
	execute: async ({ operation, a, b }: { operation: "add" | "subtract" | "multiply" | "divide"; a: number; b: number }) => {
		// Validate inputs
		if (typeof a !== 'number' || typeof b !== 'number') {
			throw new Error("Both a and b must be numbers");
		}
		
		if (operation === 'divide' && b === 0) {
			throw new Error("Division by zero is not allowed");
		}
		
		let result: number;
		switch (operation) {
			case "add":
				result = a + b;
				break;
			case "subtract":
				result = a - b;
				break;
			case "multiply":
				result = a * b;
				break;
			case "divide":
				result = a / b;
				break;
			default:
				throw new Error(`Unsupported operation: ${operation}`);
		}
		
		return {
			operation,
			a,
			b,
			result,
			calculation: `${a} ${operation === 'add' ? '+' : operation === 'subtract' ? '-' : operation === 'multiply' ? '×' : '÷'} ${b} = ${result}`,
			success: true,
			timestamp: new Date().toISOString(),
		};
	}
};

// Export all tools for easy access
export const evalTools = {
	createDocument: createDocumentEvalTool,
	webSearch: webSearchEvalTool,
	calculator: calculatorEvalTool,
} as const;