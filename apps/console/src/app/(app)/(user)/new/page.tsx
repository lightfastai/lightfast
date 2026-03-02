import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { WorkspaceHeader } from "./_components/workspace-header";
import { OrganizationSelector } from "./_components/organization-selector";
import { WorkspaceNameInput } from "./_components/workspace-name-input";
import { SourcesSection } from "./_components/sources-section";
import { SourcesSectionLoading } from "./_components/sources-section-loading";
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
 * 2. This page prefetches connections.github.list (org-scoped, GitHub connection status)
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

  // Prefetch org-scoped connection status for GitHub, Vercel, Linear, and Sentry
  // Avoids client-side fetch waterfall in SourcesSection
  prefetch(orgTrpc.connections.github.list.queryOptions());
  prefetch(orgTrpc.connections.vercel.list.queryOptions());
  prefetch(orgTrpc.connections.linear.get.queryOptions());
  prefetch(orgTrpc.connections.sentry.get.queryOptions());

  return (
    <main className="flex-1 flex items-start justify-center py-4">
      <div className="w-full space-y-4">
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
                <div className="flex-1 min-w-0 space-y-6">
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

              {/* Section 2: Sources (optional) */}
              <div className="flex gap-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
                  2
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Sources</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select sources to connect to this workspace
                    </p>

                    {/* Client Island: Sources Accordion (with Suspense boundary) */}
                    <Suspense fallback={<SourcesSectionLoading />}>
                      <SourcesSection />
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
    </main>
  );
}
