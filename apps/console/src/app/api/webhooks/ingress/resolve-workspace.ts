import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";

export interface ResolvedWorkspace {
  clerkOrgId: string;
  workspaceId: string;
  workspaceName: string;
}

/**
 * Resolve a workspace from a Clerk organization ID.
 * Returns the first active workspace for the org, or null if not found.
 *
 * Note: Returns the first workspace found per org. For Phase 4, this is
 * sufficient — multi-workspace dispatch can be refined in a later phase.
 */
export async function resolveWorkspaceFromOrgId(
  orgId: string
): Promise<ResolvedWorkspace | null> {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.clerkOrgId, orgId),
    columns: {
      id: true,
      name: true,
      clerkOrgId: true,
    },
  });

  if (!workspace) {
    return null;
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    clerkOrgId: workspace.clerkOrgId,
  };
}
