import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { workspaces } from "../schema";
import { generateWorkspaceName, generateWorkspaceSlug } from "./workspace-names";

/**
 * Get or create default workspace for organization
 * Phase 1: Always creates/returns the default workspace with friendly auto-generated name
 *
 * @param organizationId - Clerk organization ID (this is the primary key in organizations table)
 * @returns Workspace ID (UUID)
 */
export async function getOrCreateDefaultWorkspace(
  organizationId: string,
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

  // Generate friendly workspace name (e.g., "Robust Chicken")
  const friendlyName = generateWorkspaceName();
  const slug = generateWorkspaceSlug(friendlyName);

  // Create default workspace with UUID id
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      // id is auto-generated UUID via $defaultFn
      organizationId,
      name: friendlyName,
      slug,
      isDefault: true,
      settings: {},
    })
    .returning({ id: workspaces.id });

  if (!newWorkspace) {
    throw new Error("Failed to create default workspace");
  }

  return newWorkspace.id;
}
