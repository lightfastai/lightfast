import { HydrateClient } from "@repo/app-trpc/server";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { requireOrgAccess } from "~/lib/org-access-clerk";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Why we use requireOrgAccess instead of auth().orgSlug:
 * After org name changes, setActive() updates cookies but there's propagation delay,
 * so auth().orgSlug might return old slug or null during RSC. requireOrgAccess fetches
 * org directly from Clerk by slug and verifies membership, avoiding the race.
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
        <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-10 shrink-0 items-center px-4 lg:hidden">
              <SidebarTrigger />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
            </div>
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
