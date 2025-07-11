import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Tool for executing commands to analyze repository
const executeAnalysisCommandTool = createTool({
	id: "execute_analysis_command",
	description: "Execute shell commands to analyze repository structure and find search-related functionality",
	inputSchema: z.object({
		command: z.string().describe("The shell command to execute"),
		args: z.array(z.string()).optional().describe("Command arguments"),
		description: z.string().optional().describe("Description of what this command does"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		stdout: z.string(),
		stderr: z.string(),
		description: z.string(),
	}),
	execute: async ({ context }) => {
		const { command, args = [], description = "" } = context;
		const executor = new SandboxExecutor();

		try {
			await executor.initialize();
			const result = await executor.runCommand(command, args);

			return {
				success: result.success,
				stdout: result.stdout,
				stderr: result.stderr,
				description: description || `Executed: ${command} ${args.join(" ")}`,
			};
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				description: `Failed to execute: ${command}`,
			};
		} finally {
			await executor.cleanup();
		}
	},
});

// Legacy tool for backward compatibility
const analyzeRepoTool = createTool({
	id: "analyze_repo",
	description: "Analyze repository structure and find search-related functionality",
	inputSchema: z.object({
		repoPath: z.string().describe("Path to the cloned repository"),
		analysisType: z.enum(["structure", "search_files", "search_patterns", "dependencies"]),
	}),
	outputSchema: z.object({
		findings: z.array(z.string()),
		details: z.string(),
		commandsUsed: z.array(z.string()),
	}),
	execute: async ({ context }) => {
		const { repoPath, analysisType } = context;
		const executor = new SandboxExecutor();
		const findings: string[] = [];
		const commandsUsed: string[] = [];
		let details = "";

		try {
			await executor.initialize();

			switch (analysisType) {
				case "structure": {
					// Get repository structure
					const treeCmd = await executor.runCommand("find", [
						repoPath,
						"-type",
						"f",
						"-name",
						"*.js",
						"-o",
						"-name",
						"*.ts",
						"-o",
						"-name",
						"*.jsx",
						"-o",
						"-name",
						"*.tsx",
						"-o",
						"-name",
						"*.py",
						"-o",
						"-name",
						"*.java",
						"-o",
						"-name",
						"*.go",
						"-o",
						"-name",
						"*.rb",
						"-o",
						"-name",
						"*.php",
						"|",
						"head",
						"-50",
					]);
					commandsUsed.push("find for source files");

					if (treeCmd.success) {
						const files = treeCmd.stdout.split("\n").filter((f) => f.trim());
						findings.push(`Found ${files.length} source files`);
						details = `Key files:\n${files.slice(0, 10).join("\n")}`;
					}

					// Check for common search-related directories
					const searchDirs = ["search", "find", "query", "filter", "lookup"];
					for (const dir of searchDirs) {
						const checkDir = await executor.runCommand("find", [repoPath, "-type", "d", "-name", `*${dir}*`]);
						if (checkDir.success && checkDir.stdout.trim()) {
							findings.push(`Found ${dir}-related directories`);
						}
					}
					break;
				}

				case "search_files": {
					// Find files related to search functionality
					const searchPatterns = ["search", "find", "query", "filter", "elastic", "solr", "algolia", "fuse"];

					for (const pattern of searchPatterns) {
						const findCmd = await executor.runCommand("find", [
							repoPath,
							"-type",
							"f",
							"-iname",
							`*${pattern}*`,
							"|",
							"grep",
							"-E",
							"\\.(js|ts|jsx|tsx|py|java|go|rb|php)$",
						]);
						commandsUsed.push(`find files with pattern: ${pattern}`);

						if (findCmd.success && findCmd.stdout.trim()) {
							const files = findCmd.stdout.split("\n").filter((f) => f.trim());
							findings.push(`Found ${files.length} files containing '${pattern}'`);
							details += `\n\nFiles with '${pattern}':\n${files.slice(0, 5).join("\n")}`;
						}
					}
					break;
				}

				case "search_patterns": {
					// Search for search-related code patterns
					const codePatterns = [
						"search\\s*\\(",
						"find\\s*\\(",
						"query\\s*\\(",
						"filter\\s*\\(",
						"elasticsearch",
						"algolia",
						"fuse\\.js",
						"search.*engine",
						"search.*api",
						"search.*service",
					];

					for (const pattern of codePatterns) {
						const grepCmd = await executor.runCommand("grep", [
							"-r",
							"-i",
							"-E",
							pattern,
							repoPath,
							"--include=*.js",
							"--include=*.ts",
							"--include=*.jsx",
							"--include=*.tsx",
							"--include=*.py",
							"|",
							"head",
							"-20",
						]);
						commandsUsed.push(`grep for pattern: ${pattern}`);

						if (grepCmd.success && grepCmd.stdout.trim()) {
							const matches = grepCmd.stdout.split("\n").filter((m) => m.trim()).length;
							findings.push(`Found ${matches} matches for pattern '${pattern}'`);
							if (matches > 0) {
								details += `\n\nPattern '${pattern}' matches:\n${grepCmd.stdout.split("\n").slice(0, 3).join("\n")}`;
							}
						}
					}
					break;
				}

				case "dependencies": {
					// Check package files for search-related dependencies
					const packageFiles = ["package.json", "requirements.txt", "Gemfile", "go.mod", "pom.xml"];

					for (const file of packageFiles) {
						const findPkg = await executor.runCommand("find", [repoPath, "-name", file, "-type", "f"]);
						if (findPkg.success && findPkg.stdout.trim()) {
							const pkgPath = findPkg.stdout.trim().split("\n")[0];
							const catCmd = await executor.runCommand("cat", [pkgPath]);
							commandsUsed.push(`cat ${file}`);

							if (catCmd.success) {
								// Search for search-related packages
								const searchLibs = ["elasticsearch", "algolia", "fuse", "lunr", "search", "solr", "whoosh", "xapian"];
								for (const lib of searchLibs) {
									if (catCmd.stdout.toLowerCase().includes(lib)) {
										findings.push(`Found ${lib} in ${file}`);
									}
								}
							}
						}
					}
					break;
				}
			}

			return {
				findings: findings.length > 0 ? findings : ["No specific search functionality found"],
				details: details || "No additional details",
				commandsUsed,
			};
		} catch (error) {
			return {
				findings: ["Error during analysis"],
				details: error instanceof Error ? error.message : "Unknown error",
				commandsUsed,
			};
		} finally {
			await executor.cleanup();
		}
	},
});

export const repoAnalyzer = new Agent({
	name: "Repository Analyzer",
	description: "Analyzes repository structure and identifies search functionality",
	instructions: `You are a repository analysis expert with direct command execution capabilities. Your role is to:
1. Analyze repository structure and codebase
2. Identify search-related functionality, APIs, and implementations
3. Find search libraries, services, and patterns
4. Report findings in a clear, structured manner

You have access to execute_analysis_command tool which allows you to run any shell command needed for analysis:

Example commands you might use:
- find [path] -name "*.js" -o -name "*.py" | head -20
- grep -r -i "search\|query\|filter" [path] --include="*.js" --include="*.ts" | head -30
- cat [path]/package.json | grep -i "search\|elastic\|algolia\|fuse"
- find [path] -type f -name "*search*" -o -name "*query*"
- ls -la [path]/src/search/
- find [path] -name "package.json" -o -name "requirements.txt" -o -name "go.mod"
- grep -r "elasticsearch\|algolia\|solr" [path] --include="*.yml" --include="*.yaml"

When analyzing:
- Start with finding key files (package.json, requirements.txt, etc.)
- Look for search-related directories and files
- Search for search library imports and dependencies
- Find API endpoints and search implementations
- Check configuration files for search services

Use the execute_analysis_command tool to run commands directly. Be creative with your commands to thoroughly analyze the repository.`,
	model: anthropic("claude-4-sonnet-20250514"),
	tools: {
		analyze_repo: analyzeRepoTool,
		execute_analysis_command: executeAnalysisCommandTool,
	},
});
