import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { workspaces } from "../schema";

/**
 * Get or create default workspace for organization
 * Phase 1: Always creates/returns the default workspace
 *
 * @param organizationId - Organization ID from Clerk
 * @param orgSlug - GitHub organization slug
 * @returns Workspace ID (e.g., ws_acme_corp)
 */
export async function getOrCreateDefaultWorkspace(
  organizationId: string,
  orgSlug: string,
): Promise<string> {
  // Check if default workspace exists
  const existing = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.organizationId, organizationId),
      eq(workspaces.isDefault, true),
    ),
  });

  if (existing) {
    return existing.id;
  }

  // Create default workspace
  const workspaceId = `ws_${orgSlug}`;
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      id: workspaceId,
      organizationId,
      name: `${orgSlug} Knowledge Base`,
      slug: orgSlug,
      isDefault: true,
      settings: {},
    })
    .returning({ id: workspaces.id });

  if (!newWorkspace) {
    throw new Error("Failed to create default workspace");
  }

  return newWorkspace.id;
}

/**
 * Compute workspace ID from organization slug
 * Phase 1: ws_${orgSlug}
 *
 * @param orgSlug - GitHub organization slug
 * @returns Workspace ID
 */
export function computeWorkspaceId(orgSlug: string): string {
  return `ws_${orgSlug}`;
}
