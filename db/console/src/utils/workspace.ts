import { db } from "../client";
import { workspaces } from "../schema";
import { generateWorkspaceSlug } from "./workspace-names";

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
  // Generate internal slug from user-provided name
  const internalSlug = generateWorkspaceSlug(name);

  // Wrap in transaction to prevent race conditions
  return await db.transaction(async (tx) => {
    // Check if name already exists in this organization (names must be unique)
    const { and, eq } = await import("drizzle-orm");

    const existing = await tx.query.workspaces.findFirst({
      where: and(
        eq(workspaces.clerkOrgId, clerkOrgId),
        eq(workspaces.name, name),
      ),
    });

    if (existing) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }

    // Create workspace with nanoid
    // Database unique constraint (workspace_org_name_idx) will catch duplicates
    const [newWorkspace] = await tx
      .insert(workspaces)
      .values({
        // id is auto-generated nanoid via $defaultFn
        clerkOrgId,
        name,                // User-facing, used in URLs
        slug: internalSlug,  // Internal, used for Pinecone
        settings: {},
      })
      .returning({ id: workspaces.id });

    if (!newWorkspace) {
      throw new Error("Failed to create workspace");
    }

    return newWorkspace.id;
  });
}
