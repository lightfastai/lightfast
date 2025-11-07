/**
 * Glob pattern utilities for file matching
 *
 * @see docs/architecture/phase1/dx-configuration.md
 */

import fg from "fast-glob";
import { join } from "node:path";

/**
 * Match files in a repository against glob patterns
 *
 * Uses fast-glob to efficiently match files against multiple patterns.
 * Patterns are repo-relative and use standard glob syntax:
 * - `*` matches any characters except /
 * - `**` matches any characters including /
 * - `?` matches any single character except /
 * - `[abc]` matches any character in the set
 *
 * @param repoPath - Absolute path to the repository root
 * @param globs - Array of glob patterns (repo-relative)
 * @returns Promise resolving to array of matched file paths (repo-relative)
 *
 * @example
 * ```typescript
 * const files = await matchFiles("/path/to/repo", [
 *   "apps/docs/src/content/**\/*.mdx",
 *   "packages/**\/*.md"
 * ]);
 * // Returns: ["apps/docs/src/content/api/search.mdx", ...]
 * ```
 */
export async function matchFiles(
  repoPath: string,
  globs: string[],
): Promise<string[]> {
  try {
    // Use fast-glob to match files
    // cwd: repoPath ensures patterns are resolved relative to repo root
    // ignore: common directories that should be excluded
    const files = await fg(globs, {
      cwd: repoPath,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/.turbo/**",
      ],
      onlyFiles: true,
      dot: false, // Don't match dotfiles
    });

    // fast-glob returns paths relative to cwd, which is what we want
    return files.sort();
  } catch (error) {
    // If glob matching fails, throw a helpful error
    throw new Error(
      `Failed to match files with globs ${JSON.stringify(globs)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate glob patterns for common issues
 *
 * Checks for:
 * - Empty patterns
 * - Absolute paths (patterns should be repo-relative)
 * - Patterns starting with / (should be relative)
 *
 * @param globs - Array of glob patterns to validate
 * @returns Array of error messages (empty if all patterns are valid)
 *
 * @example
 * ```typescript
 * const errors = validateGlobPatterns(["*.md", "/absolute/path/*.md"]);
 * // Returns: ["Pattern '/absolute/path/*.md' should not start with /"]
 * ```
 */
export function validateGlobPatterns(globs: string[]): string[] {
  const errors: string[] = [];

  for (const glob of globs) {
    if (glob.trim().length === 0) {
      errors.push("Glob pattern must not be empty");
      continue;
    }

    if (glob.startsWith("/")) {
      errors.push(
        `Pattern '${glob}' should not start with / (use repo-relative paths)`,
      );
    }

    // Check for absolute path indicators on Windows
    if (/^[a-zA-Z]:/.test(glob)) {
      errors.push(
        `Pattern '${glob}' appears to be an absolute path (use repo-relative paths)`,
      );
    }
  }

  return errors;
}

/**
 * Check if a file path matches any of the given glob patterns
 *
 * Useful for filtering files during ingestion when you already have a file path
 * and want to check if it matches the configured globs.
 *
 * @param filePath - File path (repo-relative)
 * @param globs - Array of glob patterns
 * @returns true if the file matches any pattern
 *
 * @example
 * ```typescript
 * const matches = matchesGlobs("apps/docs/content/api.mdx", ["**\/*.mdx"]);
 * // Returns: true
 * ```
 */
export function matchesGlobs(filePath: string, globs: string[]): boolean {
  // Use fast-glob's sync matcher for checking individual files
  const matcher = fg.sync;

  // Check if the file matches any of the patterns
  for (const glob of globs) {
    try {
      const matches = matcher(glob, {
        cwd: "/", // Dummy cwd since we're just pattern matching
        onlyFiles: true,
        dot: false,
      });

      // Simple check: does the pattern match the file path?
      // For a more accurate check, we can use micromatch directly
      if (fg.isDynamicPattern(glob)) {
        // Use fast-glob's internal matcher
        const pattern = new RegExp(
          glob
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, "[^/]")
            .replace(/\./g, "\\."),
        );
        if (pattern.test(filePath)) {
          return true;
        }
      } else if (filePath === glob) {
        // Exact match
        return true;
      }
    } catch {
      // If pattern matching fails, skip this pattern
      continue;
    }
  }

  return false;
}
