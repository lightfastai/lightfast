/**
 * Pinecone namespace for an org
 * Sanitizes clerkOrgId to meet Pinecone namespace constraints.
 * Example: "org_abc123xyz" → "org_abc123xyz"
 */
function sanitize(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 50);
}

export function buildOrgNamespace(clerkOrgId: string): string {
  return sanitize(clerkOrgId);
}
