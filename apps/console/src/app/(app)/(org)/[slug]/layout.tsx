import { Suspense } from "react";
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { AppSidebar } from "~/components/app-sidebar";
import { AppHeader } from "~/components/app-header";
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
// Layout wrapper for answer page with floating header
function AnswerPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset>
      {/* Floating header absolutely positioned over content */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
        <AppHeader />
      </div>

      {/* Content spans full height with floating header, scrollbar at viewport edge */}
      <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden pt-14">
        <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden">
          <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
        </div>
      </div>
    </SidebarInset>
  );
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;

  let hasAccess = true;
  try {
    await requireOrgAccess(slug);
  } catch (error) {
    console.debug("Org access denied for slug:", slug, error);
    hasAccess = false;
  }
  if (!hasAccess) {
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
        <SidebarProvider className="!h-full !min-h-0 overflow-hidden">
          <AppSidebar />
          {/* Use AnswerPageLayout for answer interface pages, StandardOrgLayout for others */}
          <AnswerPageLayout>{children}</AnswerPageLayout>
        </SidebarProvider>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}

function PageLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-full min-h-0 w-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
