import type { App } from "octokit";

/**
 * Configuration detection result
 */
export interface ConfigDetectionResult {
	exists: boolean;
	path: string | null;
	error?: string;
}

/**
 * Possible lightfast.yml file locations
 */
const CONFIG_PATHS = ["lightfast.yml", ".lightfast.yml", "lightfast.yaml", ".lightfast.yaml"];

/**
 * GitHub Configuration Detector Service
 *
 * Detects lightfast.yml configuration files in GitHub repositories
 */
export class ConfigDetectorService {
	constructor(private app: App) {}

	/**
	 * Detect lightfast.yml configuration file in repository
	 *
	 * Checks multiple common paths for the configuration file:
	 * - lightfast.yml
	 * - .lightfast.yml
	 * - lightfast.yaml
	 * - .lightfast.yaml
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param ref - Git reference (branch, tag, or commit SHA)
	 * @param installationId - GitHub App installation ID
	 * @returns Detection result with path if found
	 */
	async detectConfig(
		owner: string,
		repo: string,
		ref: string,
		installationId: number
	): Promise<ConfigDetectionResult> {
		try {
			const octokit = await this.app.getInstallationOctokit(installationId);

			// Check each possible config path
			for (const path of CONFIG_PATHS) {
				try {
					await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
						owner,
						repo,
						path,
						ref,
						headers: {
							"X-GitHub-Api-Version": "2022-11-28",
						},
					});

					// If we get here, the file exists
					console.log(`[ConfigDetector] Found config at ${path} in ${owner}/${repo}`);
					return {
						exists: true,
						path,
					};
				} catch (error: any) {
					// 404 means file doesn't exist at this path, try next
					if (error.status === 404) {
						continue;
					}

					// Other errors (403 forbidden, 500 server error, etc.)
					console.error(
						`[ConfigDetector] Error checking ${path} in ${owner}/${repo}:`,
						error.message
					);

					// Don't stop on temporary errors, try other paths
					continue;
				}
			}

			// No config found at any path
			console.log(`[ConfigDetector] No config found in ${owner}/${repo}`);
			return {
				exists: false,
				path: null,
			};
		} catch (error: any) {
			// Unexpected error (auth, network, etc.)
			console.error(
				`[ConfigDetector] Failed to detect config in ${owner}/${repo}:`,
				error
			);
			return {
				exists: false,
				path: null,
				error: error.message || "Unknown error",
			};
		}
	}

	/**
	 * Fetch and parse lightfast.yml configuration
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param path - Path to config file (from detectConfig)
	 * @param ref - Git reference (branch, tag, or commit SHA)
	 * @param installationId - GitHub App installation ID
	 * @returns Config file content as string, or null if not found
	 */
	async fetchConfig(
		owner: string,
		repo: string,
		path: string,
		ref: string,
		installationId: number
	): Promise<string | null> {
		try {
			const octokit = await this.app.getInstallationOctokit(installationId);

			const { data } = await octokit.request(
				"GET /repos/{owner}/{repo}/contents/{path}",
				{
					owner,
					repo,
					path,
					ref,
					headers: {
						"X-GitHub-Api-Version": "2022-11-28",
					},
				}
			);

			// Check if it's a file (not directory or submodule)
			if ("content" in data && "type" in data && data.type === "file") {
				const content = Buffer.from(data.content, "base64").toString("utf-8");
				return content;
			}

			console.warn(
				`[ConfigDetector] ${path} is not a file (type: ${Array.isArray(data) ? "array" : (data as any).type})`
			);
			return null;
		} catch (error: any) {
			if (error.status === 404) {
				console.log(`[ConfigDetector] Config file not found: ${path}`);
				return null;
			}
			console.error(`[ConfigDetector] Error fetching ${path}:`, error);
			throw error;
		}
	}
}
