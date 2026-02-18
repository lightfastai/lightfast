/**
 * Slug and URL derivation from file paths
 */

/**
 * Derive a URL-friendly slug from a file path
 *
 * Transformation steps:
 * 1. Remove basePath prefix if provided
 * 2. Remove file extension (.md, .mdx, etc.)
 * 3. Convert to lowercase
 * 4. Replace spaces and special characters with hyphens
 * 5. Remove leading/trailing slashes
 *
 * @param filePath - Repo-relative file path
 * @param basePath - Optional base path to remove from the file path
 * @returns URL-friendly slug
 *
 * @example
 * ```typescript
 * deriveSlug("apps/docs/src/content/api/search.mdx", "apps/docs/src/content")
 * // Returns: "api/search"
 *
 * deriveSlug("Getting Started.md", "")
 * // Returns: "getting-started"
 * ```
 */
export function deriveSlug(filePath: string, basePath: string): string {
  let slug = filePath;

  // Remove basePath prefix if provided
  if (basePath && slug.startsWith(basePath)) {
    slug = slug.slice(basePath.length);
  }

  // Remove leading slash
  if (slug.startsWith("/")) {
    slug = slug.slice(1);
  }

  // Remove file extension (.md, .mdx, .markdown, etc.)
  slug = slug.replace(/\.(mdx?|markdown)$/i, "");

  // Convert to lowercase
  slug = slug.toLowerCase();

  // Replace spaces with hyphens
  slug = slug.replace(/\s+/g, "-");

  // Replace special characters with hyphens
  slug = slug.replace(/[^a-z0-9\-/]/g, "-");

  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, "-");

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");

  // Remove trailing slash
  if (slug.endsWith("/")) {
    slug = slug.slice(0, -1);
  }

  return slug;
}
