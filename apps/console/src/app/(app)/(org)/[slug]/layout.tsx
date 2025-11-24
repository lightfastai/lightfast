import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { AppSidebar } from "~/components/app-sidebar";
import { Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "~/lib/org-access-clerk";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Organization layout - prefetches org data using user-scoped endpoint
 *
 * Flow:
 * 1. Layout verifies org access via requireOrgAccess (fetches org directly from Clerk by slug)
 * 2. Prefetches workspace list via user-scoped endpoint (allows pending users)
 * 3. Procedure manually verifies user has access to the org
 * 4. Middleware's organizationSyncOptions syncs org from URL (happens in parallel)
 * 5. Data is hydrated to client → fast render
 * 6. Failure → error boundary catches → proper error UI
 *
 * Why we use requireOrgAccess instead of auth().orgSlug:
 * - After org name changes, setActive() updates cookies but there's propagation delay
 * - auth().orgSlug might return old slug or null during RSC request
 * - requireOrgAccess fetches org directly from Clerk by slug and verifies membership
 * - This avoids race conditions with Clerk cookie propagation
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;

  // Verify user has access to this organization
  // This fetches the org directly from Clerk by slug and verifies membership
  // Independent of auth().orgSlug to avoid race conditions
  try {
    await requireOrgAccess(slug);
  } catch {
    notFound();
  }

  // Prefetch workspace list - uses user-scoped endpoint that allows pending users
  // The procedure manually verifies the user has access to this org
  prefetch(
    userTrpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
      clerkOrgSlug: slug,
    }),
  );

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>
        <SidebarProvider className="h-full min-h-0">
          <AppSidebar />
          <SidebarInset>
            <div className="flex-1 overflow-auto">
              <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Suspense fallback={<PageLoadingSkeleton />}>
                  {children}
                </Suspense>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}

function PageLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
