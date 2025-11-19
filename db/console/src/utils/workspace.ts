import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { workspaces } from "../schema";
import { generateWorkspaceName, generateWorkspaceSlug } from "./workspace-names";

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
 * Get or create default workspace for organization
 * Phase 1: Always creates/returns the default workspace with friendly auto-generated name
 *
 * @param clerkOrgId - Clerk organization ID
 * @returns Workspace ID (UUID)
 */
export async function getOrCreateDefaultWorkspace(
  clerkOrgId: string,
): Promise<string> {
  // Check if default workspace exists
  const existing = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.clerkOrgId, clerkOrgId),
      eq(workspaces.isDefault, true),
    ),
  });

  if (existing) {
    return existing.id;
  }

  // Generate friendly workspace slug (e.g., "robust-chicken" from "Robust Chicken")
  const friendlyName = generateWorkspaceName();
  const slug = generateWorkspaceSlug(friendlyName);

  // Create default workspace with UUID id
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      // id is auto-generated UUID via $defaultFn
      clerkOrgId,
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
