import { db } from "../client";
import { orgWorkspaces } from "../schema";
import { generateRandomSlug } from "./workspace-names";
import { EMBEDDING_DEFAULTS } from "@repo/console-validation/constants";
import type { WorkspaceSettings } from "@repo/console-types";

/**
 * Compute workspace key from slug
 * Used for external naming (e.g., Pinecone index prefixes)
 *
 * Format: `ws-<slug>`
 * Example: "robust-chicken" → "ws-robust-chicken"
 */
export function getWorkspaceKey(slug: string): string {
  return `ws-${slug}`;
}

/**
 * Build Pinecone namespace for a workspace
 *
 * Format: {sanitizedClerkOrgId}:ws_{sanitizedWorkspaceId}
 * Example: "org_abc123:ws_xyz789"
 */
export function buildWorkspaceNamespace(
  clerkOrgId: string,
  workspaceId: string,
): string {
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Build default workspace settings with embedding configuration
 */
export function buildWorkspaceSettings(
  clerkOrgId: string,
  workspaceId: string,
): WorkspaceSettings {
  return {
    version: 1,
    embedding: {
      indexName: EMBEDDING_DEFAULTS.indexName,
      namespaceName: buildWorkspaceNamespace(clerkOrgId, workspaceId),
      embeddingDim: EMBEDDING_DEFAULTS.embeddingDim,
      embeddingModel: EMBEDDING_DEFAULTS.embeddingModel,
      embeddingProvider: EMBEDDING_DEFAULTS.embeddingProvider,
      pineconeMetric: EMBEDDING_DEFAULTS.pineconeMetric,
      pineconeCloud: EMBEDDING_DEFAULTS.pineconeCloud,
      pineconeRegion: EMBEDDING_DEFAULTS.pineconeRegion,
      chunkMaxTokens: EMBEDDING_DEFAULTS.chunkMaxTokens,
      chunkOverlap: EMBEDDING_DEFAULTS.chunkOverlap,
    },
  };
}

/**
 * Create a workspace with user-provided name
 *
 * Architecture:
 * - name: User-provided (e.g., "my-project", "api.v2"), must be unique per org
 * - slug: Auto-generated from name for internal use (Pinecone)
 *
 * Concurrency Safety:
 * - Unique constraint on (clerkOrgId, name) enforced at database level
 * - Optimistic insert catches constraint violations
 *
 * @param clerkOrgId - Clerk organization ID
 * @param name - User-provided workspace name (must follow GitHub repo naming rules)
 * @returns Workspace ID (nanoid)
 */
export async function createCustomWorkspace(
  clerkOrgId: string,
  name: string,
): Promise<string> {
  // Generate random slug for Pinecone index naming
  // This decouples user-facing name from internal identifier
  // Slug examples: "robust-chicken", "happy-cat", "modest-pear"
  const slug = generateRandomSlug();

  const { nanoid } = await import("@repo/lib");
  const workspaceId = nanoid();

  try {
    // Optimistic insert — database unique constraint (workspace_org_name_idx) catches duplicates
    const [newWorkspace] = await db
      .insert(orgWorkspaces)
      .values({
        id: workspaceId,
        clerkOrgId,
        name,      // User-facing name (e.g., "My-Awesome-Workspace")
        slug,      // Random slug for Pinecone (e.g., "robust-chicken")
        settings: buildWorkspaceSettings(clerkOrgId, workspaceId),
      })
      .returning({ id: orgWorkspaces.id });

    if (!newWorkspace) {
      throw new Error("Failed to create workspace");
    }

    return newWorkspace.id;
  } catch (error) {
    // Detect unique constraint violation on (clerkOrgId, name).
    // Prefer the PostgreSQL error code exposed by NeonDbError (code "23505" = UNIQUE_VIOLATION).
    // Substring fallback retained in case the error is wrapped without a code property.
    const isUniqueViolation =
      (error instanceof Error &&
        "code" in error &&
        (error as { code: unknown }).code === "23505") ||
      (error instanceof Error &&
        (error.message.includes("unique constraint") ||
          error.message.includes("duplicate key")));

    if (isUniqueViolation) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }
    throw error;
  }
}
