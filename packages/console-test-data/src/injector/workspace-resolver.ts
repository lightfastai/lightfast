/**
 * Workspace Resolver
 *
 * Utilities for finding and resolving workspaces for test data injection.
 */

import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq, isNotNull, and } from "drizzle-orm";

import type { WorkspaceTarget } from "../types";

/**
 * Find workspace by name within an organization
 */
export async function findWorkspaceByName(
  orgSlug: string,
  workspaceName: string
): Promise<WorkspaceTarget | null> {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.name, workspaceName),
  });

  if (!workspace) {
    return null;
  }

  return {
    workspaceId: workspace.id,
    clerkOrgId: workspace.clerkOrgId,
  };
}

/**
 * Find workspace by ID
 */
export async function findWorkspaceById(
  workspaceId: string
): Promise<WorkspaceTarget | null> {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    return null;
  }

  return {
    workspaceId: workspace.id,
    clerkOrgId: workspace.clerkOrgId,
  };
}

/**
 * Find all workspaces configured for neural memory
 */
export async function findConfiguredWorkspaces(): Promise<WorkspaceTarget[]> {
  const workspaces = await db.query.orgWorkspaces.findMany({
    where: and(
      isNotNull(orgWorkspaces.indexName),
      isNotNull(orgWorkspaces.embeddingModel)
    ),
  });

  return workspaces.map((ws) => ({
    workspaceId: ws.id,
    clerkOrgId: ws.clerkOrgId,
  }));
}

/**
 * Find workspaces by clerk org ID
 */
export async function findWorkspacesByOrg(
  clerkOrgId: string
): Promise<WorkspaceTarget[]> {
  const workspaces = await db.query.orgWorkspaces.findMany({
    where: eq(orgWorkspaces.clerkOrgId, clerkOrgId),
  });

  return workspaces.map((ws) => ({
    workspaceId: ws.id,
    clerkOrgId: ws.clerkOrgId,
  }));
}

/**
 * Get workspace details for display
 */
export async function getWorkspaceDetails(workspaceId: string) {
  return db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });
}
