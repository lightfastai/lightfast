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
 * Architecture:
 * - name: User-facing (e.g., "Robust-Chicken"), used in URLs
 * - slug: Internal identifier (e.g., "robust-chicken"), used for Pinecone
 *
 * @param clerkOrgId - Clerk organization ID
 * @returns Workspace ID (nanoid)
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

  // Generate friendly workspace name (e.g., "Robust-Chicken")
  const friendlyName = generateWorkspaceName();

  // Generate internal slug for Pinecone (e.g., "robust-chicken")
  const internalSlug = generateWorkspaceSlug(friendlyName);

  // Create default workspace with nanoid
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      // id is auto-generated nanoid via $defaultFn
      clerkOrgId,
      name: friendlyName,           // User-facing, used in URLs
      slug: internalSlug,            // Internal, used for Pinecone
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
 * Create a custom workspace with user-provided name
 * Phase 2: User can create multiple workspaces with custom names
 *
 * Architecture:
 * - name: User-provided (e.g., "my-project", "api.v2"), must be unique per org
 * - slug: Auto-generated from name for internal use (Pinecone)
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

  // Check if name already exists in this organization (names must be unique)
  const existing = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.clerkOrgId, clerkOrgId),
      eq(workspaces.name, name),
    ),
  });

  if (existing) {
    throw new Error(`Workspace with name "${name}" already exists`);
  }

  // Create custom workspace with nanoid
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      // id is auto-generated nanoid via $defaultFn
      clerkOrgId,
      name,                // User-facing, used in URLs
      slug: internalSlug,  // Internal, used for Pinecone
      isDefault: false,
      settings: {},
    })
    .returning({ id: workspaces.id });

  if (!newWorkspace) {
    throw new Error("Failed to create workspace");
  }

  return newWorkspace.id;
}
