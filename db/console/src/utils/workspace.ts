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
 * - Wrapped in transaction to prevent race conditions
 * - Unique constraint on (clerkOrgId, name) enforced at database level
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

  // Wrap in transaction to prevent race conditions
  return await db.transaction(async (tx) => {
    // Check if name already exists in this organization (names must be unique)
    const { and, eq } = await import("drizzle-orm");

    const existing = await tx.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.clerkOrgId, clerkOrgId),
        eq(orgWorkspaces.name, name),
      ),
    });

    if (existing) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }

    // Generate workspace ID first (needed for namespace)
    const { nanoid } = await import("@repo/lib");
    const workspaceId = nanoid();

    // Create workspace with full settings
    // Database unique constraint (workspace_org_name_idx) will catch duplicates
    const [newWorkspace] = await tx
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
  });
}
