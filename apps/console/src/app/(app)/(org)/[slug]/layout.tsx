import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc, orgTrpc } from "@repo/console-trpc/server";
import {
  SidebarProvider,
  SidebarInset,
} from "@repo/ui/components/ui/sidebar";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { AppSidebar } from "~/components/app-sidebar";
import { Loader2 } from "lucide-react";

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
    orgTrpc.workspace.listByClerkOrgSlug.queryOptions({
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
                <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
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
