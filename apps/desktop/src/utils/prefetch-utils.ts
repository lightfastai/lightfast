/**
 * This file contains utility functions for prefetching data in the Electron app
 * These utilities help improve loading performance and user experience
 */

import { trpc } from "@/trpc";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";

/**
 * Prefetch essential data for a workspace
 * @param workspaceId The ID of the workspace to prefetch data for
 */
export const prefetchWorkspaceData = (workspaceId: string) => {
  if (!workspaceId) return;

  // Prefetch workspace details
  queryClient.prefetchQuery(
    trpc.tenant.workspace.get.queryOptions({
      workspaceId,
    }),
  );

  // Prefetch session list
  queryClient.prefetchQuery(
    trpc.tenant.session.list.queryOptions({
      workspaceId,
    }),
  );
};

/**
 * Prefetch all workspaces and their essential data
 * Can be used for initial load or background refreshing
 */
export const prefetchAllWorkspaces = async () => {
  try {
    // Fetch the list of workspaces
    const workspaces = await queryClient.fetchQuery(
      trpc.tenant.workspace.getAll.queryOptions(),
    );

    // If we have workspaces, prefetch their essential data
    if (workspaces && workspaces.length > 0) {
      // Prefetch data for the most recent workspace
      prefetchWorkspaceData(workspaces[0].id);
    }

    return workspaces;
  } catch (error) {
    console.error("Error prefetching workspaces:", error);
    return [];
  }
};

/**
 * Prefetch data for a session
 * @param sessionId The ID of the session to prefetch data for
 * @param workspaceId The ID of the workspace this session belongs to
 */
export const prefetchSessionData = (sessionId: string, workspaceId: string) => {
  if (!sessionId || !workspaceId) return;

  // Prefetch session data (you may need to add the actual query endpoint for this)
  // For now, we prefetch workspace data as a fallback
  prefetchWorkspaceData(workspaceId);
};
