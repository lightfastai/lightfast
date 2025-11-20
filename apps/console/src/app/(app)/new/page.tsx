import { Suspense } from "react";
import { prefetch, HydrateClient } from "@repo/console-trpc/server";
import { trpc } from "@repo/console-trpc/server";
import { WorkspaceHeader } from "./_components/workspace-header";
import { WorkspaceFormProvider } from "./_components/workspace-form-provider";
import { OrganizationSelector } from "./_components/organization-selector";
import { WorkspaceNameInput } from "./_components/workspace-name-input";
import { GitHubConnector } from "./_components/github-connector";
import { GitHubConnectorLoading } from "./_components/github-connector-loading";
import { CreateWorkspaceButton } from "./_components/create-workspace-button";

/**
 * Workspace Creation Page
 *
 * Server component with client islands for optimal SSR performance.
 *
 * Architecture:
 * - Server components: Static headers, section labels, structure
 * - Client islands: Interactive forms, mutations, navigation
 * - Form state: Shared via WorkspaceFormProvider context
 * - URL persistence: teamSlug and workspaceName synced via nuqs
 *
 * Performance pattern:
 * - Server-side prefetch of GitHub integration (30-90x faster)
 * - HydrateClient for server-to-client state transfer
 * - Client components use prefetched data via useSuspenseQuery
 * - No client-side fetch on mount (prevents UNAUTHORIZED errors)
 *
 * URL Parameters:
 * - teamSlug: Pre-select organization (e.g., ?teamSlug=lightfast)
 * - workspaceName: Pre-fill workspace name (e.g., ?workspaceName=my-workspace)
 */
export default async function NewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ teamSlug?: string; workspaceName?: string }>;
}) {
  // Prefetch GitHub integration for instant loading
  // CRITICAL: This must happen BEFORE HydrateClient wrapping
  prefetch(trpc.integration.github.list.queryOptions());

  // Read search params for initial form state
  const params = await searchParams;
  const initialWorkspaceName = params.workspaceName || "";

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="min-h-full flex items-start justify-center py-12">
        <div className="w-full max-w-3xl px-6">
          {/* Static Header (Server Component) */}
          <WorkspaceHeader />

          {/* Form with Client Islands */}
          <HydrateClient>
            <WorkspaceFormProvider initialWorkspaceName={initialWorkspaceName}>
              <div className="space-y-8">
                {/* Section 1: General */}
                <div className="flex gap-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
                    1
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">General</h2>

                      <div className="space-y-6">
                        {/* Client Island: Organization Selector */}
                        <OrganizationSelector />

                        {/* Client Island: Workspace Name Input */}
                        <WorkspaceNameInput />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Repository (optional) */}
                <div className="flex gap-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
                    2
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">
                        Source Repository
                      </h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        Optional: Connect a repository to start indexing immediately
                      </p>

                      {/* Client Island: GitHub Connector (with Suspense boundary) */}
                      <Suspense fallback={<GitHubConnectorLoading />}>
                        <GitHubConnector />
                      </Suspense>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Island: Create Button */}
              <CreateWorkspaceButton />
            </WorkspaceFormProvider>
          </HydrateClient>
        </div>
      </div>
    </div>
  );
}
