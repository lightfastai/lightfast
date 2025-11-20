import { Suspense } from "react";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { AppSidebar } from "~/components/app-sidebar";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Organization layout - prefetches org data with zero blocking calls
 *
 * Flow:
 * 1. Middleware's organizationSyncOptions syncs org from URL (best effort, non-blocking)
 * 2. Layout prefetches queries (non-blocking)
 * 3. tRPC procedures verify access when executing
 * 4. Success → data hydrated → fast render
 * 5. Failure → error boundary catches → proper error UI
 *
 * No blocking access checks - queries verify access independently
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;

  // Prefetch workspace list - tRPC procedure will verify org access
  // No blocking access check here - let queries handle verification
  prefetch(
    trpc.workspace.listByClerkOrgSlug.queryOptions({
      clerkOrgSlug: slug,
    })
  );

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>
        <Suspense fallback={<OrgLayoutSkeleton />}>
          <SidebarProvider className="h-full min-h-0">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0 border-l border-muted/30">
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </div>
          </SidebarProvider>
        </Suspense>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}

function OrgLayoutSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Skeleton className="h-32 w-96" />
    </div>
  );
}
