import { HydrateClient } from "@repo/app-trpc/server";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "~/components/app-header";
import { AppSidebar } from "~/components/app-sidebar";
import { CommandPalette } from "~/components/command-palette";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
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
 * 2. Validates org access and sets up org context
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

  let hasAccess = true;
  try {
    await requireOrgAccess(slug);
  } catch (error) {
    log.debug("[org-layout] access denied", { slug, error: parseError(error) });
    hasAccess = false;
  }
  if (!hasAccess) {
    notFound();
  }

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>
        <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-sidebar">
          <AppSidebar />
          <CommandPalette />
          {/* Right column: header (outside inset) + inset content below */}
          {/* pr-2 pb-2 creates the gap for the inset card — margin on SidebarInset doesn't work because w-full overflows */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2 pb-2">
            {/* h-14 header — same visual level as sidebar's team-switcher row */}
            <div className="flex h-14 shrink-0 items-center justify-end px-4">
              <Suspense fallback={<div className="h-8 w-8" />}>
                <AppHeader />
              </Suspense>
            </div>
            {/* Inset panel: 100% - h-14, rounded card floating in bg-sidebar */}
            <SidebarInset className="overflow-hidden rounded-xl shadow-sm">
              <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}

function PageLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
