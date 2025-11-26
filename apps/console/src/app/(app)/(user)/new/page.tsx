import { Suspense } from "react";
import { HydrateClient, prefetch, userTrpc } from "@repo/console-trpc/server";
import { WorkspaceHeader } from "./_components/workspace-header";
import { OrganizationSelector } from "./_components/organization-selector";
import { WorkspaceNameInput } from "./_components/workspace-name-input";
import { GitHubConnector } from "./_components/github-connector";
import { GitHubConnectorLoading } from "./_components/github-connector-loading";
import { CreateWorkspaceButton } from "./_components/create-workspace-button";
import { NewWorkspaceInitializer } from "./_components/new-workspace-initializer";

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
 * - No server-side data fetching needed
 * - Uses cached organization.listUserOrganizations from (app)/layout.tsx
 * - Client components (NewWorkspaceInitializer) handle form initialization
 * - HydrateClient provides server-cached data to client
 *
 * URL Parameters:
 * - teamSlug: Hint for which org to pre-select
 * - workspaceName: Pre-fill workspace name
 *
 * Data Flow:
 * 1. (app)/layout.tsx prefetches organization.listUserOrganizations (user-scoped, no org needed)
 * 2. This page prefetches userSources.github.get (user-scoped, GitHub connection status)
 * 3. Data passed through to client components via HydrateClient
 * 4. NewWorkspaceInitializer reads cache + URL params to set initial form state
 * 5. OrganizationSelector uses cached orgs for dropdown
 * 6. GitHubConnector uses prefetched GitHub connection status (no client-side fetch!)
 *
 * This pattern:
 * - ✅ Uses tRPC consistently (no mixing with Clerk server APIs)
 * - ✅ Works for authenticated users without active org
 * - ✅ Handles timing issues (cache updated optimistically on org creation)
 * - ✅ Prefetches all user-scoped data for instant page load
 */
export default async function NewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ teamSlug?: string; workspaceName?: string }>;
}) {
  // Read search params - pass to client for initialization
  const params = await searchParams;
  const teamSlugHint = params.teamSlug;
  const initialWorkspaceName = params.workspaceName ?? "";

  // Prefetch GitHub user source (user-scoped data, no org needed)
  // This prevents client-side fetch waterfall in GitHubConnector
  prefetch(userTrpc.userSources.github.get.queryOptions());

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="min-h-full flex items-start justify-center py-12">
        <div className="w-full max-w-3xl px-6">
          {/* Static Header (Server Component) */}
          <WorkspaceHeader />

          {/* Form with Client Islands */}
          <HydrateClient>
            {/* Client component handles initialization from cache + URL params */}
            <NewWorkspaceInitializer
              teamSlugHint={teamSlugHint}
              initialWorkspaceName={initialWorkspaceName}
            >
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
            </NewWorkspaceInitializer>
          </HydrateClient>
        </div>
      </div>
    </div>
  );
}
