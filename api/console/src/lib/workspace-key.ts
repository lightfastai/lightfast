/**
 * Compute canonical workspaceKey from a workspace slug.
 * Used only for external naming (e.g., Pinecone index naming), not as DB identity.
 *
 * Format: `ws-<slug-sanitized>`
 */
export function getWorkspaceKeyFromSlug(slug: string): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .replace(/-{2,}/g, "-");
  return `ws-${sanitize(slug)}`;
}

