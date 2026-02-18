/**
 * MDX frontmatter extraction and metadata parsing
 *
 * Extracts frontmatter, title, description from MDX files.
 */

import matter from "gray-matter";
import type { MDXMetadata } from "./types";
import { deriveSlug } from "./slug";
import { hashContent } from "./hash";

/**
 * Parse MDX file and extract metadata
 *
 * Extracts:
 * - Frontmatter (YAML)
 * - Title (from frontmatter.title or first h1)
 * - Description (from frontmatter.description)
 * - Slug (derived from file path)
 * - Content hash (SHA-256 of body, excluding frontmatter)
 *
 * @param filePath - Repo-relative file path
 * @param content - Full MDX file content
 * @returns Promise resolving to MDX metadata
 *
 * @example
 * ```typescript
 * const content = `---
 * title: API Reference
 * description: Complete API documentation
 * ---
 * # API Reference
 * ...`;
 *
 * const metadata = await parseMDX("docs/api.mdx", content);
 * // Returns: {
 * //   frontmatter: { title: "API Reference", description: "..." },
 * //   title: "API Reference",
 * //   description: "Complete API documentation",
 * //   slug: "docs/api",
 * //   contentHash: "abc123..."
 * // }
 * ```
 */
export async function parseMDX(
  filePath: string,
  content: string,
): Promise<MDXMetadata> {
  // Parse frontmatter using gray-matter
  const { data: frontmatter, content: body } = matter(content);

  // Extract title from frontmatter or first h1
  let title: string | undefined = undefined;
  if (frontmatter.title && typeof frontmatter.title === "string") {
    title = frontmatter.title;
  } else {
    // Try to find first h1 in the content
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match?.[1]) {
      title = h1Match[1].trim();
    }
  }

  // Extract description from frontmatter
  let description: string | undefined = undefined;
  if (
    frontmatter.description &&
    typeof frontmatter.description === "string"
  ) {
    description = frontmatter.description;
  }

  // Derive slug from file path (remove base path)
  const slug = deriveSlug(filePath, "");

  // Compute content hash (exclude frontmatter for consistent hashing)
  const contentHash = hashContent(body);

  // Normalize empty frontmatter to null (gray-matter returns {} when no frontmatter exists)
  const normalizedFrontmatter =
    Object.keys(frontmatter).length === 0 ? null : frontmatter;

  return {
    frontmatter: normalizedFrontmatter,
    title,
    description,
    slug,
    contentHash,
  };
}
