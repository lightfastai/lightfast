import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Tool for cloning repositories
const cloneRepoTool = createTool({
	id: "clone_repo",
	description: "Clone a git repository into the sandbox",
	inputSchema: z.object({
		repoUrl: z.string().describe("Git repository URL"),
		targetDir: z.string().optional().describe("Target directory name"),
		depth: z.number().optional().default(1).describe("Clone depth (1 for shallow clone)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		repoPath: z.string(),
		message: z.string(),
		stats: z.object({
			fileCount: z.number(),
			totalSize: z.string(),
			mainLanguage: z.string().optional(),
		}),
	}),
	execute: async ({ context }) => {
		const { repoUrl, targetDir, depth } = context;
		const executor = new SandboxExecutor();

		try {
			await executor.initialize();

			// Extract repo name from URL if no target directory specified
			const repoName = targetDir || repoUrl.split("/").pop()?.replace(".git", "") || "cloned-repo";
			const repoPath = `/home/vercel-sandbox/${repoName}`;

			// Check if directory already exists
			const checkDir = await executor.runCommand("test", ["-d", repoPath]);
			if (checkDir.success) {
				// Directory exists, remove it first
				await executor.runCommand("rm", ["-rf", repoPath]);
			}

			// Clone the repository
			const cloneArgs = ["clone"];
			if (depth && depth > 0) {
				cloneArgs.push("--depth", depth.toString());
			}
			cloneArgs.push(repoUrl, repoPath);

			const cloneResult = await executor.runCommand("git", cloneArgs);

			if (!cloneResult.success) {
				return {
					success: false,
					repoPath: "",
					message: `Failed to clone repository: ${cloneResult.stderr}`,
					stats: { fileCount: 0, totalSize: "0", mainLanguage: undefined },
				};
			}

			// Get repository statistics
			// Use bash -c to run piped commands
			const fileCountCmd = await executor.runCommand("bash", ["-c", `find ${repoPath} -type f | wc -l`]);
			const fileCount = parseInt(fileCountCmd.stdout.trim()) || 0;

			const sizeCmd = await executor.runCommand("du", ["-sh", repoPath]);
			const totalSize = sizeCmd.stdout.split("\t")[0] || "Unknown";

			// Try to detect main language
			let mainLanguage: string | undefined;
			const langCheck = await executor.runCommand("bash", ["-c", 
				`find ${repoPath} -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rb" \\) | head -10`
			]);

			if (langCheck.success && langCheck.stdout) {
				const files = langCheck.stdout.trim().split("\n");
				const extensions = files.map((f) => f.split(".").pop()).filter(Boolean);
				const langMap: Record<string, string> = {
					js: "JavaScript",
					ts: "TypeScript",
					py: "Python",
					java: "Java",
					go: "Go",
					rb: "Ruby",
					php: "PHP",
				};

				for (const ext of extensions) {
					if (ext && langMap[ext]) {
						mainLanguage = langMap[ext];
						break;
					}
				}
			}

			return {
				success: true,
				repoPath,
				message: `Successfully cloned repository to ${repoPath}`,
				stats: {
					fileCount,
					totalSize,
					mainLanguage,
				},
			};
		} catch (error) {
			return {
				success: false,
				repoPath: "",
				message: error instanceof Error ? error.message : "Unknown error",
				stats: { fileCount: 0, totalSize: "0", mainLanguage: undefined },
			};
		} finally {
			await executor.cleanup();
		}
	},
});

export const repoCloner = new Agent({
	name: "Repository Cloner",
	description: "Clones git repositories into the sandbox environment",
	instructions: `You are a git repository specialist. Your role is to:
1. Clone repositories safely into the sandbox
2. Handle various git URLs (GitHub, GitLab, Bitbucket, etc.)
3. Provide information about the cloned repository
4. Report any issues during cloning

When cloning repositories:
- Use shallow clones by default for faster operations
- Extract repository statistics after cloning
- Handle errors gracefully
- Provide clear feedback about the cloning process

IMPORTANT: After using the clone_repo tool, always report the exact results in a clear format:
- success: true or false
- repoPath: the exact path where it was cloned
- message: what happened (success or error message)
- stats: file count and total size

Example response format:
"I used the clone_repo tool to clone the repository.
Results:
- success: true
- repoPath: /home/vercel-sandbox/my-repo
- message: Successfully cloned repository
- stats: fileCount: 150, totalSize: 2.5M"

Always use the clone_repo tool to perform the cloning operation.`,
	model: anthropic("claude-4-sonnet-20250514"),
	tools: {
		clone_repo: cloneRepoTool,
	},
});
