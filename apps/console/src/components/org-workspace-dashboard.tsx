"use client";

import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { WorkspaceInfo } from "./workspace-info";
import { ConnectedSourcesOverview } from "./connected-sources-overview";
import { OrgChatInterface } from "./org-chat-interface";

interface OrgWorkspaceDashboardProps {
  orgSlug: string;
  orgId: string;
}

/**
 * Org Workspace Dashboard
 *
 * Displays workspace-centric dashboard with:
 * - Workspace metadata
 * - Connected sources overview
 * - Search interface
 */
export function OrgWorkspaceDashboard({ orgSlug, orgId }: OrgWorkspaceDashboardProps) {
  const trpc = useTRPC();

  // Fetch workspace (already prefetched in server component)
  const { data: workspace } = useSuspenseQuery({
    ...trpc.workspace.resolveFromClerkOrgId.queryOptions({
      clerkOrgId: orgId,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch organization (already prefetched in server component)
  const { data: organization } = useSuspenseQuery({
    ...trpc.organization.findByClerkOrgId.queryOptions({
      clerkOrgId: orgId,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch connected sources (dependent on workspace ID)
  const { data: connections = [] } = useQuery({
    ...trpc.integration.workspace.list.queryOptions({
      workspaceId: workspace.workspaceId,
    }),
    enabled: Boolean(workspace.workspaceId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-8 gap-6">
        {/* Workspace Info */}
        <WorkspaceInfo
          workspace={workspace}
          organization={{
            name: organization.name,
            slug: organization.slug,
            imageUrl: organization.imageUrl,
          }}
        />

        {/* Connected Sources Overview */}
        <ConnectedSourcesOverview connections={connections} />

        {/* Search Interface */}
        <div className="mt-8">
          <OrgChatInterface orgSlug={orgSlug} />
        </div>
      </main>
    </div>
  );
}
