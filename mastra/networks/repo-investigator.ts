import { anthropic } from "@ai-sdk/anthropic";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { repoAnalyzer } from "../agents/repo-analyzer";
import { repoCloner } from "../agents/repo-cloner";
import { repoInvestigatorWorkflow } from "../workflows/repo-investigator-workflow";

// Quick check workflow for simple repository queries
const quickRepoCheckWorkflow = createWorkflow({
	id: "quick-repo-check",
	description: "Quick check for search functionality in a repository",
	inputSchema: z.object({
		repoUrl: z.string().describe("Git repository URL"),
	}),
	outputSchema: z.object({
		hasSearchFunctionality: z.boolean(),
		searchTypes: z.array(z.string()),
		summary: z.string(),
	}),
})
	.then(
		createStep({
			id: "quick-clone-and-check",
			description: "Clone and quickly check for search functionality",
			inputSchema: z.object({
				repoUrl: z.string(),
			}),
			outputSchema: z.object({
				hasSearchFunctionality: z.boolean(),
				searchTypes: z.array(z.string()),
				summary: z.string(),
			}),
			execute: async ({ inputData }) => {
				// First, clone the repository
				const clonePrompt = `Clone this repository with shallow depth: ${inputData.repoUrl}
Use the clone_repo tool with depth: 1 for a quick clone.`;

				const cloneResponse = await repoCloner.generate(clonePrompt);

				// Extract repo path from clone response
				const pathMatch = cloneResponse.text.match(/path[":]*\s*([/\w\-.]+)/i);
				const repoPath = pathMatch ? pathMatch[1] : `/home/vercel-sandbox/repo`;

				// Quick analysis using direct commands
				const quickAnalysisPrompt = `Perform a quick check for search functionality in: ${repoPath}

Run these checks:
1. Check if package.json exists and look for search-related dependencies
2. Look for obvious search-related files or directories
3. Quick grep for search-related keywords

Use the execute_analysis_command tool to run commands directly. Be quick but thorough.`;

				const analysisResponse = await repoAnalyzer.generate(quickAnalysisPrompt);

				// Determine search functionality presence
				const searchIndicators = ["elasticsearch", "algolia", "solr", "fuse", "lunr", "search", "query", "filter"];

				const combinedText = analysisResponse.text.toLowerCase();
				const searchTypes: string[] = [];
				let hasSearchFunctionality = false;

				for (const indicator of searchIndicators) {
					if (combinedText.includes(indicator)) {
						hasSearchFunctionality = true;
						searchTypes.push(indicator);
					}
				}

				const summary = hasSearchFunctionality
					? `Found ${searchTypes.length} search-related indicators: ${searchTypes.join(", ")}`
					: "No obvious search functionality detected in quick scan";

				return {
					hasSearchFunctionality,
					searchTypes,
					summary,
				};
			},
		}),
	)
	.commit();

// Export the repository investigator network
export const repoInvestigatorNetwork = new NewAgentNetwork({
	id: "repo-investigator",
	name: "Repository Investigator Network",
	instructions: `You are an intelligent repository investigation network that can clone git repositories, analyze their search functionality, and provide detailed reports.

You have two main workflows:

1. **Full Investigation Workflow**: For comprehensive repository analysis
   - Clones the repository
   - Analyzes structure, files, code patterns, and dependencies
   - Generates a detailed report about search functionality
   - Identifies specific search technologies and implementations

2. **Quick Check Workflow**: For rapid search functionality detection
   - Performs a shallow clone
   - Quickly scans for search-related indicators
   - Returns a simple yes/no answer with basic details

Examples of what you can investigate:
- "Clone https://github.com/user/repo and analyze its search capabilities"
- "Check if this repository uses Elasticsearch or Algolia"
- "Find all search-related APIs and endpoints in this codebase"
- "Identify the search libraries and patterns used"

The network can detect various search technologies:
- Elasticsearch, Solr, Algolia
- Fuse.js, Lunr.js, and other JavaScript search libraries
- Custom search implementations
- Database full-text search
- API-based search services

IMPORTANT:
- Handle both public and private repositories (with proper credentials)
- Provide actionable insights about search implementations
- Identify both client-side and server-side search solutions
- Report on search architecture and design patterns`,
	model: anthropic("claude-4-sonnet-20250514"),
	agents: {
		repoCloner,
		repoAnalyzer,
	},
	workflows: {
		repoInvestigatorWorkflow,
		quickRepoCheckWorkflow,
	},
});
