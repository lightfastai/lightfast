import type { Octokit } from "octokit";
import { minimatch } from "minimatch";

/**
 * GitHub Content Fetching Service
 *
 * Implements hybrid fetching strategy based on the number of files:
 * - <20 files: Contents API (parallel requests)
 * - 20-300 files: Tree + Blobs API (more efficient)
 */

export interface ChangedFile {
	path: string;
	status: "added" | "modified" | "removed";
}

export interface FetchedFile {
	path: string;
	content: string;
	sha: string;
}

export class GitHubContentService {
	constructor(private octokit: Octokit) {}

	/**
	 * Fetch changed files using optimal strategy based on count
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param changedFiles - List of changed files with their status
	 * @param commitSha - Commit SHA to fetch files from
	 * @param globs - Optional glob patterns to filter files
	 * @returns Map of file path to file content and SHA
	 */
	async fetchChangedFiles(
		owner: string,
		repo: string,
		changedFiles: ChangedFile[],
		commitSha: string,
		globs?: string[]
	): Promise<Map<string, FetchedFile>> {
		// Filter by globs if provided
		const filtered = globs
			? changedFiles.filter((file) =>
					globs.some((glob) => minimatch(file.path, glob))
			  )
			: changedFiles;

		// Filter out removed files (no content to fetch)
		const toFetch = filtered.filter((f) => f.status !== "removed");

		if (toFetch.length === 0) {
			console.log("[GitHubContentService] No files to fetch after filtering");
			return new Map();
		}

		console.log(
			`[GitHubContentService] Fetching ${toFetch.length} files from ${owner}/${repo}`
		);

		// Choose strategy based on count
		if (toFetch.length < 20) {
			return this.fetchViaContents(owner, repo, toFetch, commitSha);
		} else {
			return this.fetchViaTreeAndBlobs(owner, repo, toFetch, commitSha);
		}
	}

	/**
	 * Fetch a single file from GitHub repository
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param path - File path within repository
	 * @param ref - Git reference (branch, tag, or commit SHA)
	 * @returns File content and SHA, or null if not found
	 */
	async fetchSingleFile(
		owner: string,
		repo: string,
		path: string,
		ref: string
	): Promise<FetchedFile | null> {
		try {
			const { data } = await this.octokit.request(
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
			if (
				"content" in data &&
				"type" in data &&
				data.type === "file" &&
				"sha" in data &&
				typeof data.sha === "string"
			) {
				return {
					path,
					content: Buffer.from(data.content, "base64").toString("utf-8"),
					sha: data.sha,
				};
			}

			console.warn(
				`[GitHubContentService] ${path} is not a file (type: ${Array.isArray(data) ? 'array' : (data as any).type})`
			);
			return null;
		} catch (error: any) {
			if (error.status === 404) {
				console.log(`[GitHubContentService] File not found: ${path}`);
				return null;
			}
			console.error(`[GitHubContentService] Error fetching ${path}:`, error);
			throw error;
		}
	}

	/**
	 * Strategy 1: Contents API (small changesets)
	 *
	 * Fetches each file in parallel using the Contents API.
	 * Best for < 20 files.
	 *
	 * @private
	 */
	private async fetchViaContents(
		owner: string,
		repo: string,
		files: ChangedFile[],
		ref: string
	): Promise<Map<string, FetchedFile>> {
		console.log(
			`[GitHubContentService] Using Contents API for ${files.length} files`
		);

		const results = new Map<string, FetchedFile>();

		await Promise.all(
			files.map(async (file) => {
				try {
					const { data } = await this.octokit.request(
						"GET /repos/{owner}/{repo}/contents/{path}",
						{
							owner,
							repo,
							path: file.path,
							ref,
							headers: {
								"X-GitHub-Api-Version": "2022-11-28",
							},
						}
					);

					if ("content" in data && data.type === "file" && "sha" in data) {
						results.set(file.path, {
							path: file.path,
							content: Buffer.from(data.content, "base64").toString("utf-8"),
							sha: data.sha,
						});
					}
				} catch (error: any) {
					if (error.status === 404) {
						console.warn(
							`[GitHubContentService] File not found: ${file.path}`
						);
					} else {
						console.error(
							`[GitHubContentService] Failed to fetch ${file.path}:`,
							error
						);
					}
				}
			})
		);

		console.log(
			`[GitHubContentService] Successfully fetched ${results.size}/${files.length} files via Contents API`
		);
		return results;
	}

	/**
	 * Strategy 2: Tree + Blobs API (large changesets)
	 *
	 * First fetches the tree to get all blob SHAs, then fetches blobs in batches.
	 * Best for 20-300 files.
	 *
	 * @private
	 */
	private async fetchViaTreeAndBlobs(
		owner: string,
		repo: string,
		files: ChangedFile[],
		treeSha: string
	): Promise<Map<string, FetchedFile>> {
		console.log(
			`[GitHubContentService] Using Tree + Blobs API for ${files.length} files`
		);

		const results = new Map<string, FetchedFile>();

		// Step 1: Fetch tree to get all blob SHAs
		const { data: tree } = await this.octokit.request(
			"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
			{
				owner,
				repo,
				tree_sha: treeSha,
				recursive: "true",
				headers: {
					"X-GitHub-Api-Version": "2022-11-28",
				},
			}
		);

		// Step 2: Build path -> SHA map
		const pathToSha = new Map<string, string>();
		for (const item of tree.tree) {
			if (item.type === "blob" && item.path && item.sha) {
				pathToSha.set(item.path, item.sha);
			}
		}

		console.log(
			`[GitHubContentService] Tree contains ${pathToSha.size} blobs, matching ${files.length} requested files`
		);

		// Step 3: Fetch blobs in batches of 20 (parallel within batch)
		const batchSize = 20;
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			await Promise.all(
				batch.map(async (file) => {
					const blobSha = pathToSha.get(file.path);
					if (!blobSha) {
						console.warn(
							`[GitHubContentService] No blob SHA found for ${file.path}`
						);
						return;
					}

					try {
						const { data: blob } = await this.octokit.request(
							"GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
							{
								owner,
								repo,
								file_sha: blobSha,
								headers: {
									"X-GitHub-Api-Version": "2022-11-28",
								},
							}
						);

						results.set(file.path, {
							path: file.path,
							content: Buffer.from(blob.content, "base64").toString("utf-8"),
							sha: blobSha,
						});
					} catch (error) {
						console.error(
							`[GitHubContentService] Failed to fetch blob for ${file.path}:`,
							error
						);
					}
				})
			);
		}

		console.log(
			`[GitHubContentService] Successfully fetched ${results.size}/${files.length} files via Tree + Blobs API`
		);
		return results;
	}

	/**
	 * List all files in a repository
	 *
	 * Uses the Git Tree API to recursively list all files in the repository.
	 * This is useful for full syncs where we need to discover all files.
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param ref - Git reference (branch, tag, or commit SHA)
	 * @returns Array of file paths
	 */
	async listAllFiles(
		owner: string,
		repo: string,
		ref: string
	): Promise<Array<{ path: string; sha: string }>> {
		console.log(
			`[GitHubContentService] Listing all files in ${owner}/${repo} at ${ref}`
		);

		try {
			// Fetch the tree recursively
			const { data: tree } = await this.octokit.request(
				"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
				{
					owner,
					repo,
					tree_sha: ref,
					recursive: "true",
					headers: {
						"X-GitHub-Api-Version": "2022-11-28",
					},
				}
			);

			// Filter to only include blobs (files, not directories or submodules)
			const files = tree.tree
				.filter((item) => item.type === "blob" && item.path && item.sha)
				.map((item) => ({
					path: item.path!,
					sha: item.sha!,
				}));

			console.log(
				`[GitHubContentService] Found ${files.length} files in ${owner}/${repo}`
			);

			return files;
		} catch (error: any) {
			console.error(
				`[GitHubContentService] Failed to list files in ${owner}/${repo}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Check if a file exists in the repository
	 *
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @param path - File path within repository
	 * @param ref - Git reference (branch, tag, or commit SHA)
	 * @returns true if file exists, false otherwise
	 */
	async fileExists(
		owner: string,
		repo: string,
		path: string,
		ref: string
	): Promise<boolean> {
		try {
			await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
				owner,
				repo,
				path,
				ref,
				headers: {
					"X-GitHub-Api-Version": "2022-11-28",
				},
			});
			return true;
		} catch (error: any) {
			if (error.status === 404) {
				return false;
			}
			// Re-throw other errors
			throw error;
		}
	}
}
