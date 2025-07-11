import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { repoAnalyzer } from "../agents/repo-analyzer";
import { repoCloner } from "../agents/repo-cloner";

// Create a report synthesizer agent
const reportSynthesizer = new Agent({
	name: "Report Synthesizer",
	description: "Synthesizes repository analysis findings into comprehensive reports",
	instructions: `You are a technical report writer. Create clear, structured reports about repository search functionality.
Focus on:
- Search implementation details
- Libraries and technologies used
- API endpoints and services
- Code organization for search features
- Recommendations and observations

Write in a professional but accessible style.`,
	model: anthropic("claude-4-sonnet-20250514"),
});

// Step 1: Clone the repository
const cloneRepoStep = createStep({
	id: "clone-repository",
	description: "Clone the git repository",
	inputSchema: z.object({
		repoUrl: z.string(),
		targetDir: z.string().optional(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		repoPath: z.string(),
		stats: z.object({
			fileCount: z.number(),
			totalSize: z.string(),
			mainLanguage: z.string().optional(),
		}),
	}),
	execute: async ({ inputData }) => {
		const { repoUrl, targetDir } = inputData;

		const clonePrompt = `Clone this repository: ${repoUrl}
${targetDir ? `Target directory: ${targetDir}` : ""}

Use the clone_repo tool to clone the repository. Report the exact results including:
- success: true/false
- repoPath: the path where it was cloned
- message: any error or success message
- stats: file count and size information`;

		const response = await repoCloner.generate(clonePrompt);
		console.log("Clone response:", response.text);

		// Extract results from the response
		// The agent should have used the tool and reported the results
		const successMatch = response.text.match(/success[":]*\s*(true|false)/i);
		const pathMatch = response.text.match(/path[":]*\s*([/\w\-.]+)/i);
		const fileCountMatch = response.text.match(/(\d+)\s*files?/i);
		const sizeMatch = response.text.match(/size[":]*\s*([\d.]+\s*[KMG]?B?)/i);
		const errorMatch = response.text.match(/error[":]*\s*([^\n]+)/i) || response.text.match(/failed[":]*\s*([^\n]+)/i);

		const success = successMatch ? successMatch[1] === "true" : false;
		const repoPath = pathMatch ? pathMatch[1] : `/home/vercel-sandbox/${repoUrl.split("/").pop()?.replace(".git", "")}`;

		if (!success && errorMatch) {
			console.error("Clone failed:", errorMatch[1]);
		}

		return {
			success,
			repoPath,
			stats: {
				fileCount: fileCountMatch ? parseInt(fileCountMatch[1]) : 0,
				totalSize: sizeMatch ? sizeMatch[1] : "Unknown",
				mainLanguage: undefined, // Will be determined in analysis
			},
		};
	},
});

// Step 2: Analyze the repository
const analyzeRepoStep = createStep({
	id: "analyze-repository",
	description: "Analyze repository for search functionality",
	inputSchema: z.object({
		repoPath: z.string(),
	}),
	outputSchema: z.object({
		analysisResults: z.object({
			structure: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			searchFiles: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			codePatterns: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			dependencies: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
		}),
	}),
	execute: async ({ inputData }) => {
		const { repoPath } = inputData;
		const analysisResults = {
			structure: { findings: [] as string[], details: "" },
			searchFiles: { findings: [] as string[], details: "" },
			codePatterns: { findings: [] as string[], details: "" },
			dependencies: { findings: [] as string[], details: "" },
		};

		// Comprehensive analysis prompt
		const analysisPrompt = `Analyze the repository at: ${repoPath} for search functionality.

Perform a comprehensive analysis by:
1. First, examine the repository structure - list key directories and files
2. Look for search-related files and directories (search, query, filter, etc.)
3. Check package files (package.json, requirements.txt, etc.) for search libraries
4. Search for search-related code patterns and implementations
5. Look for API endpoints or search services

Use the execute_analysis_command tool to run various commands. Be thorough and creative with your analysis.

Provide your findings in sections:
- Repository Structure
- Search-Related Files
- Code Patterns and Implementations
- Dependencies and Libraries`;

		const fullAnalysis = await repoAnalyzer.generate(analysisPrompt);

		// Parse the comprehensive response into our structure
		const text = fullAnalysis.text;

		// Extract different sections
		const structureMatch = text.match(
			/Repository Structure[:\s]*([\s\S]*?)(?=Search-Related Files|Code Patterns|Dependencies|$)/i,
		);
		analysisResults.structure = extractAnalysisResults(
			structureMatch ? structureMatch[1] : "No structure analysis found",
		);

		const filesMatch = text.match(/Search-Related Files[:\s]*([\s\S]*?)(?=Code Patterns|Dependencies|$)/i);
		analysisResults.searchFiles = extractAnalysisResults(filesMatch ? filesMatch[1] : "No search files found");

		const patternsMatch = text.match(/Code Patterns[:\s]*([\s\S]*?)(?=Dependencies|$)/i);
		analysisResults.codePatterns = extractAnalysisResults(patternsMatch ? patternsMatch[1] : "No code patterns found");

		const depsMatch = text.match(/Dependencies[:\s]*([\s\S]*?)$/i);
		analysisResults.dependencies = extractAnalysisResults(depsMatch ? depsMatch[1] : "No dependencies found");

		return { analysisResults };
	},
});

// Helper function to extract analysis results
function extractAnalysisResults(text: string): { findings: string[]; details: string } {
	const findings: string[] = [];
	let details = "";

	// Extract findings (usually bullet points or listed items)
	const findingPatterns = [
		/found\s+(.+?)(?:\n|$)/gi,
		/discovered\s+(.+?)(?:\n|$)/gi,
		/identified\s+(.+?)(?:\n|$)/gi,
		/•\s*(.+?)(?:\n|$)/g,
		/\*\s*(.+?)(?:\n|$)/g,
		/-\s*(.+?)(?:\n|$)/g,
	];

	for (const pattern of findingPatterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			if (match[1] && !findings.includes(match[1].trim())) {
				findings.push(match[1].trim());
			}
		}
	}

	// Extract details section
	const detailsMatch = text.match(/details?:?\s*([\s\S]+?)(?=findings?:|$)/i);
	if (detailsMatch) {
		details = detailsMatch[1].trim();
	}

	// Ensure we always return the correct type
	const result = {
		findings: findings.length > 0 ? findings : ["No specific findings"],
		details: details || text.substring(0, 200),
	};

	return result;
}

// Step 3: Generate report
const generateReportStep = createStep({
	id: "generate-report",
	description: "Generate comprehensive report",
	inputSchema: z.object({
		repoUrl: z.string(),
		repoPath: z.string(),
		stats: z.object({
			fileCount: z.number(),
			totalSize: z.string(),
			mainLanguage: z.string().optional(),
		}),
		analysisResults: z.object({
			structure: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			searchFiles: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			codePatterns: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
			dependencies: z.object({
				findings: z.array(z.string()),
				details: z.string(),
			}),
		}),
	}),
	outputSchema: z.object({
		report: z.string(),
		summary: z.string(),
		searchCapabilities: z.array(z.string()),
	}),
	execute: async ({ inputData }) => {
		const { repoUrl, repoPath, stats, analysisResults } = inputData;

		const reportPrompt = `Create a comprehensive report about the search functionality in this repository:

Repository: ${repoUrl}
Location: ${repoPath}
Stats: ${stats.fileCount} files, Size: ${stats.totalSize}

Analysis Results:
1. Structure Analysis:
${analysisResults.structure.findings.join("\n- ")}

2. Search Files Found:
${analysisResults.searchFiles.findings.join("\n- ")}

3. Code Patterns:
${analysisResults.codePatterns.findings.join("\n- ")}

4. Dependencies:
${analysisResults.dependencies.findings.join("\n- ")}

Please create a professional report that includes:
1. Executive summary
2. Search implementation overview
3. Technologies and libraries used
4. Key findings and observations
5. Recommendations

Format the report in clear sections with proper headings.`;

		const response = await reportSynthesizer.generate(reportPrompt);

		// Extract search capabilities from the analysis
		const searchCapabilities: string[] = [];

		// Check for specific search technologies
		const allFindings = [
			...analysisResults.searchFiles.findings,
			...analysisResults.codePatterns.findings,
			...analysisResults.dependencies.findings,
		]
			.join(" ")
			.toLowerCase();

		if (allFindings.includes("elasticsearch")) searchCapabilities.push("Elasticsearch integration");
		if (allFindings.includes("algolia")) searchCapabilities.push("Algolia search");
		if (allFindings.includes("solr")) searchCapabilities.push("Apache Solr");
		if (allFindings.includes("fuse")) searchCapabilities.push("Fuzzy search with Fuse.js");
		if (allFindings.includes("lunr")) searchCapabilities.push("Client-side search with Lunr.js");
		if (allFindings.includes("search") || allFindings.includes("query"))
			searchCapabilities.push("Custom search implementation");

		// Create summary
		const summary = `Repository analysis complete. Found ${stats.fileCount} files (${stats.totalSize}). 
Identified ${searchCapabilities.length} search-related capabilities. 
${analysisResults.dependencies.findings.length} search-related dependencies found.`;

		return {
			report: response.text,
			summary,
			searchCapabilities,
		};
	},
});

// Main workflow
export const repoInvestigatorWorkflow = createWorkflow({
	id: "repo-investigator-workflow",
	description: "Clone a repository, investigate search functionality, and generate a report",
	inputSchema: z.object({
		repoUrl: z.string().describe("Git repository URL to investigate"),
		targetDir: z.string().optional().describe("Optional target directory name"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		report: z.string(),
		summary: z.string(),
		searchCapabilities: z.array(z.string()),
	}),
})
	.then(cloneRepoStep)
	.then(
		createStep({
			id: "check-clone-success",
			description: "Check if clone was successful and prepare for analysis",
			inputSchema: z.object({
				success: z.boolean(),
				repoPath: z.string(),
				stats: z.object({
					fileCount: z.number(),
					totalSize: z.string(),
					mainLanguage: z.string().optional(),
				}),
			}),
			outputSchema: z.object({
				repoPath: z.string(),
			}),
			execute: async ({ inputData }) => {
				if (!inputData.success) {
					throw new Error("Failed to clone repository");
				}
				return { repoPath: inputData.repoPath };
			},
		}),
	)
	.then(analyzeRepoStep)
	.then(
		createStep({
			id: "prepare-report-data",
			description: "Prepare data for report generation",
			inputSchema: z.object({
				analysisResults: z.object({
					structure: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					searchFiles: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					codePatterns: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					dependencies: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
				}),
			}),
			outputSchema: z.object({
				repoUrl: z.string(),
				repoPath: z.string(),
				stats: z.object({
					fileCount: z.number(),
					totalSize: z.string(),
					mainLanguage: z.string().optional(),
				}),
				analysisResults: z.object({
					structure: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					searchFiles: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					codePatterns: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
					dependencies: z.object({
						findings: z.array(z.string()),
						details: z.string(),
					}),
				}),
			}),
			execute: async ({ inputData, getStepResult, getInitData }) => {
				const initData = getInitData();
				const cloneResult = getStepResult(cloneRepoStep) as {
					repoPath: string;
					stats: { fileCount: number; totalSize: string; mainLanguage?: string };
				};

				return {
					repoUrl: initData.repoUrl,
					repoPath: cloneResult.repoPath,
					stats: cloneResult.stats,
					analysisResults: inputData.analysisResults,
				};
			},
		}),
	)
	.then(generateReportStep)
	.then(
		createStep({
			id: "finalize-output",
			description: "Finalize the workflow output",
			inputSchema: z.object({
				report: z.string(),
				summary: z.string(),
				searchCapabilities: z.array(z.string()),
			}),
			outputSchema: z.object({
				success: z.boolean(),
				report: z.string(),
				summary: z.string(),
				searchCapabilities: z.array(z.string()),
			}),
			execute: async ({ inputData }) => {
				return {
					success: true,
					...inputData,
				};
			},
		}),
	)
	.commit();
