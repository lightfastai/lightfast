import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";
import { SecurityNotice } from "./_components/security-notice";
import { WorkspaceSelector } from "./_components/workspace-selector";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}

/**
 * Organization API Keys Settings Page
 *
 * Server component with client islands for optimal SSR performance.
 * Requires a workspace to be selected since API keys are workspace-scoped.
 *
 * Architecture:
 * - Server components: Static headers, security notice, loading skeletons
 * - Client island: Interactive API key list with mutations
 * - Suspense boundary: Wraps only the data-fetching component
 */
export default async function OrgApiKeysPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { workspaceId } = await searchParams;

  // Prefetch workspaces for the workspace selector
  prefetch(
    orgTrpc.workspace.listByClerkOrgSlug.queryOptions({
      clerkOrgSlug: slug,
    })
  );

  // If no workspace is selected, show the workspace selector
  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Organization API Keys
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Select a workspace to manage its API keys.
          </p>
        </div>
        <HydrateClient>
          <Suspense fallback={<div className="h-24 animate-pulse bg-muted rounded-lg" />}>
            <WorkspaceSelector slug={slug} />
          </Suspense>
        </HydrateClient>
      </div>
    );
  }

  // Prefetch API keys for the selected workspace
  prefetch(orgTrpc.orgApiKeys.list.queryOptions({ workspaceId }));

  return (
    <div className="space-y-6">
      <HydrateClient>
        {/* Workspace selector at top for switching */}
        <Suspense fallback={<div className="h-10 w-64 animate-pulse bg-muted rounded-lg" />}>
          <WorkspaceSelector slug={slug} currentWorkspaceId={workspaceId} />
        </Suspense>

        {/* API Keys List */}
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList workspaceId={workspaceId} />
        </Suspense>
      </HydrateClient>

      {/* Static Security Notice */}
      <SecurityNotice />
    </div>
  );
}
